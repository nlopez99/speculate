import { internalQuery, internalMutation } from "../../_generated/server";
import { v } from "convex/values";

/**
 * Find blob by type and ID
 */
export const findBlobByTypeAndId = internalQuery({
  args: {
    tvdbType: v.union(v.literal('series'), v.literal('season'), v.literal('episode_pack')),
    tvdbId: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("tvdbRawBlobIndex"),
      storageId: v.id("_storage"),
      contentHash: v.string(),
      byteSize: v.number(),
      uncompressedSize: v.optional(v.number()),
    })
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('tvdbRawBlobIndex')
      .withIndex('type_id', q =>
        q.eq('tvdbType', args.tvdbType).eq('tvdbId', args.tvdbId)
      )
      .first();
  },
});

/**
 * Find blob by type, ID, and hash (for idempotency)
 */
export const findBlobByTypeIdAndHash = internalQuery({
  args: {
    tvdbType: v.union(v.literal('series'), v.literal('season'), v.literal('episode_pack')),
    tvdbId: v.string(),
    contentHash: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("tvdbRawBlobIndex"),
      storageId: v.id("_storage"),
    })
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('tvdbRawBlobIndex')
      .withIndex('type_id_hash', q =>
        q.eq('tvdbType', args.tvdbType)
          .eq('tvdbId', args.tvdbId)
          .eq('contentHash', args.contentHash)
      )
      .first();
  },
});

/**
 * Find blob by content hash (for deduplication)
 */
export const findBlobByHash = internalQuery({
  args: {
    contentHash: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("tvdbRawBlobIndex"),
      storageId: v.id("_storage"),
      tvdbType: v.union(v.literal('series'), v.literal('season'), v.literal('episode_pack')),
      tvdbId: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('tvdbRawBlobIndex')
      .withIndex('contentHash', q => q.eq('contentHash', args.contentHash))
      .first();
  },
});

/**
 * Upsert blob index entry
 */
export const upsertBlobIndex = internalMutation({
  args: {
    tvdbType: v.union(v.literal('series'), v.literal('season'), v.literal('episode_pack')),
    tvdbId: v.string(),
    storageId: v.id("_storage"),
    contentHash: v.string(),
    byteSize: v.number(),
    uncompressedSize: v.number(),
  },
  returns: v.id("tvdbRawBlobIndex"),
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if entry exists
    const existing = await ctx.db
      .query('tvdbRawBlobIndex')
      .withIndex('type_id', q =>
        q.eq('tvdbType', args.tvdbType).eq('tvdbId', args.tvdbId)
      )
      .first();

    if (existing) {
      // Update existing entry
      await ctx.db.patch(existing._id, {
        storageId: args.storageId,
        contentHash: args.contentHash,
        byteSize: args.byteSize,
        uncompressedSize: args.uncompressedSize,
        updatedAt: now,
      });
      return existing._id;
    } else {
      // Create new entry
      return await ctx.db.insert('tvdbRawBlobIndex', {
        tvdbType: args.tvdbType,
        tvdbId: args.tvdbId,
        storageId: args.storageId,
        contentHash: args.contentHash,
        encoding: 'br',
        byteSize: args.byteSize,
        uncompressedSize: args.uncompressedSize,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

/**
 * Get storage statistics for monitoring
 */
export const getStorageStats = internalQuery({
  args: {},
  returns: v.object({
    totalBlobs: v.number(),
    totalCompressedSize: v.number(),
    totalUncompressedSize: v.number(),
    averageCompressionRatio: v.number(),
    byType: v.array(v.object({
      type: v.string(),
      count: v.number(),
      compressedSize: v.number(),
      uncompressedSize: v.number(),
    })),
  }),
  handler: async (ctx) => {
    const allBlobs = await ctx.db.query('tvdbRawBlobIndex').collect();

    const stats = {
      totalBlobs: allBlobs.length,
      totalCompressedSize: 0,
      totalUncompressedSize: 0,
      byType: new Map<string, { count: number; compressed: number; uncompressed: number }>(),
    };

    for (const blob of allBlobs) {
      stats.totalCompressedSize += blob.byteSize;
      stats.totalUncompressedSize += blob.uncompressedSize || blob.byteSize;

      const typeStats = stats.byType.get(blob.tvdbType) || { count: 0, compressed: 0, uncompressed: 0 };
      typeStats.count++;
      typeStats.compressed += blob.byteSize;
      typeStats.uncompressed += blob.uncompressedSize || blob.byteSize;
      stats.byType.set(blob.tvdbType, typeStats);
    }

    const avgRatio = stats.totalUncompressedSize > 0
      ? ((1 - stats.totalCompressedSize / stats.totalUncompressedSize) * 100)
      : 0;

    return {
      totalBlobs: stats.totalBlobs,
      totalCompressedSize: stats.totalCompressedSize,
      totalUncompressedSize: stats.totalUncompressedSize,
      averageCompressionRatio: Math.round(avgRatio * 100) / 100,
      byType: Array.from(stats.byType.entries()).map(([type, data]) => ({
        type,
        count: data.count,
        compressedSize: data.compressed,
        uncompressedSize: data.uncompressed,
      })),
    };
  },
});

/**
 * Check if cold data exists for an entity
 */
export const hasColdData = internalQuery({
  args: {
    tvdbType: v.union(v.literal('series'), v.literal('season'), v.literal('episode_pack')),
    tvdbId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const blobIndex = await ctx.db
      .query('tvdbRawBlobIndex')
      .withIndex('type_id', q =>
        q.eq('tvdbType', args.tvdbType).eq('tvdbId', args.tvdbId)
      )
      .first();

    return blobIndex !== null;
  },
});