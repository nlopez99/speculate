import { mutation } from '../../_generated/server';
import { v } from 'convex/values';
import { internal } from '../../_generated/api';

/**
 * Start a full database sync from TVDB
 * This will iterate through ALL series in TVDB and queue them for syncing
 *
 * WARNING: This is a very large operation that will:
 * - Make thousands of API calls to TVDB
 * - Create millions of database records
 * - Take hours or days to complete
 *
 * Only run this when initially building the database or recovering from data loss
 *
 * Requires TVDB_API_KEY environment variable to be set
 */
export const startFullDatabaseSync = mutation({
  handler: async (ctx, args) => {
    // Enable syncing
    const syncEnabled = await ctx.db
      .query('tvdbSyncConfig')
      .withIndex('key', (q) => q.eq('key', 'sync_enabled'))
      .first();

    if (syncEnabled) {
      await ctx.db.patch(syncEnabled._id, {
        value: true,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert('tvdbSyncConfig', {
        key: 'sync_enabled',
        value: true,
        updatedAt: Date.now(),
      });
    }

    // Log the sync session start
    const syncId = `full_sync_${Date.now()}`;
    await ctx.db.insert('tvdbSyncLog', {
      syncId,
      entityType: 'full_database',
      entityId: 'all',
      action: 'start',
      status: 'started',
      startedAt: Date.now(),
      metadata: {
        initiatedBy: 'manual',
      },
    });

    // Schedule the actual sync to run
    await ctx.scheduler.runAfter(0, internal.tvdb.syncer.fullSync.buildFullDatabase, {
      startPage: 0,
    });

    return {
      success: true,
      syncId,
      message: 'Full database sync initiated. This will take a long time to complete.',
      warning: 'Monitor progress using getSyncStatus query with the returned syncId.',
    };
  },
});

/**
 * Queue a specific series for syncing using workpool
 */
export const queueSeriesSync = mutation({
  args: {
    tvdbSeriesId: v.string(),
    deep: v.optional(v.boolean()), // Whether to sync all seasons/episodes
    priority: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Queue sync using workpool
    await ctx.scheduler.runAfter(0, internal.tvdb.syncer.workpool.enqueueSyncEntity, {
      entityType: 'series',
      entityId: args.tvdbSeriesId,
      priority: args.priority ?? 5,
      shallow: args.deep === false,
      metadata: {
        source: 'manual',
      },
    });

    return {
      success: true,
      message: `Series ${args.tvdbSeriesId} queued for syncing`,
    };
  },
});

/**
 * Enable or disable sync processing
 */
export const setSyncEnabled = mutation({
  args: {
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('tvdbSyncConfig')
      .withIndex('key', (q) => q.eq('key', 'sync_enabled'))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.enabled,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert('tvdbSyncConfig', {
        key: 'sync_enabled',
        value: args.enabled,
        updatedAt: Date.now(),
      });
    }

    return {
      success: true,
      message: `Sync ${args.enabled ? 'enabled' : 'disabled'}`,
    };
  },
});
