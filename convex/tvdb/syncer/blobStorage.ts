"use node";

import { internalAction } from "../../_generated/server";
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { canonicalizeJson, computeContentHash, compressData, getCompressionStats } from "./compression";

/**
 * Store compressed TVDB data blob in Convex Storage
 */
export const storeCompressedBlob = internalAction({
  args: {
    tvdbType: v.union(v.literal('series'), v.literal('season'), v.literal('episode_pack')),
    tvdbId: v.string(),
    payload: v.any(),
  },
  returns: v.object({
    storageId: v.id("_storage"),
    contentHash: v.string(),
    isNew: v.boolean(),
    compressionRatio: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const canonical = canonicalizeJson(args.payload);
    const contentHash = computeContentHash(canonical);

    // Check if we already have this exact content for this specific entity
    // This ensures idempotency per (type, id, hash)
    const existingWithSameHash: { _id: any; storageId: any } | null = await ctx.runQuery(
      internal.tvdb.syncer.blobStorageQueries.findBlobByTypeIdAndHash,
      {
        tvdbType: args.tvdbType,
        tvdbId: args.tvdbId,
        contentHash,
      }
    );

    if (existingWithSameHash) {
      return {
        storageId: existingWithSameHash.storageId,
        contentHash,
        isNew: false,
      };
    }

    // Compress the data
    const compressed = compressData(canonical);
    const stats = getCompressionStats(canonical, compressed);

    // Store in Convex Storage
    const blob = new Blob([compressed]);
    const storageId = await ctx.storage.store(blob);

    // Record in index
    await ctx.runMutation(internal.tvdb.syncer.blobStorageQueries.upsertBlobIndex, {
      tvdbType: args.tvdbType,
      tvdbId: args.tvdbId,
      storageId,
      contentHash,
      byteSize: compressed.byteLength,
      uncompressedSize: Buffer.byteLength(canonical),
    });

    const compressionRatio = (stats.originalSize / stats.compressedSize).toFixed(2);
    console.log(
      `[BlobStorage] Stored ${args.tvdbType}/${args.tvdbId} - ` +
      `Brotli ratio ~${compressionRatio}x (${stats.compressedSize}B compressed from ${stats.originalSize}B)`
    );

    return {
      storageId,
      contentHash,
      isNew: true,
      compressionRatio: stats.ratio,
    };
  },
});

/**
 * Retrieve and decompress a blob
 */
export const getDecompressedBlob = internalAction({
  args: {
    storageId: v.id("_storage"),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const blob = await ctx.storage.get(args.storageId);
    if (!blob) {
      throw new Error(`Blob not found: ${args.storageId}`);
    }

    const { brotliDecompressSync } = await import('zlib');
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const decompressed = brotliDecompressSync(buffer).toString();

    return JSON.parse(decompressed);
  },
});