"use node";

import { createHash } from 'crypto';
import { brotliCompressSync, brotliDecompressSync, constants } from 'zlib';

/**
 * Canonicalize JSON by sorting keys recursively for consistent hashing
 */
export const canonicalizeJson = (obj: any): string => {
  // Recursive key sorter to ensure stable serialization
  const sortKeys = (value: any): any => {
    if (value === null || typeof value !== 'object') {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map(sortKeys);
    }
    return Object.keys(value)
      .sort()
      .reduce((sorted, key) => {
        sorted[key] = sortKeys(value[key]);
        return sorted;
      }, {} as any);
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