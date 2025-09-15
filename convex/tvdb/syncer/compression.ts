"use node";

import { createHash } from 'crypto';
import { brotliCompressSync, brotliDecompressSync, constants } from 'zlib';

/**
 * Canonicalize JSON by sorting keys recursively for consistent hashing
 * Also sorts arrays by their natural order to prevent jitter
 */
export const canonicalizeJson = (obj: any): string => {
  // Recursive key sorter to ensure stable serialization
  const sortKeys = (value: any): any => {
    if (value === null || typeof value !== 'object') {
      return value;
    }

    if (Array.isArray(value)) {
      // Sort arrays for stable hashing (especially episodes)
      const mapped = value.map(sortKeys);

      // Try to sort by common fields if they exist
      if (mapped.length > 0 && mapped[0] && typeof mapped[0] === 'object') {
        if ('episodeNumber' in mapped[0] || 'number' in mapped[0]) {
          // Sort episodes by number
          return mapped.sort((a, b) => (a.episodeNumber || a.number || 0) - (b.episodeNumber || b.number || 0));
        } else if ('id' in mapped[0]) {
          // Sort by ID if available
          return mapped.sort((a, b) => String(a.id).localeCompare(String(b.id)));
        }
      }
      return mapped;
    }

    // Sort object keys and recurse
    const sorted: any = {};
    Object.keys(value)
      .filter(key => value[key] !== undefined) // Strip undefined fields
      .sort()
      .forEach(key => {
        sorted[key] = sortKeys(value[key]);
      });
    return sorted;
  };

  const sorted = sortKeys(obj);
  return JSON.stringify(sorted);
};

/**
 * Compute SHA256 hash of a string
 */
export const computeContentHash = (data: string): string => {
  return createHash('sha256').update(data).digest('hex');
};

/**
 * Compress data using Brotli with maximum quality
 */
export const compressData = (data: string): Buffer => {
  return brotliCompressSync(Buffer.from(data), {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 11,  // Max quality (0-11)
      [constants.BROTLI_PARAM_LGWIN]: 24     // Large window for better compression
    }
  });
};

/**
 * Decompress Brotli-compressed data
 */
export const decompressData = (compressed: Buffer): string => {
  return brotliDecompressSync(compressed).toString();
};

/**
 * Get compression stats for monitoring
 */
export const getCompressionStats = (original: string, compressed: Buffer) => {
  const originalSize = Buffer.byteLength(original);
  const compressedSize = compressed.byteLength;
  const ratio = (1 - compressedSize / originalSize) * 100;

  return {
    originalSize,
    compressedSize,
    ratio: Math.round(ratio * 100) / 100,  // 2 decimal places
    savings: originalSize - compressedSize
  };
};