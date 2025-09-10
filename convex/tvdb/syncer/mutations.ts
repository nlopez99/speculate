import { mutation, query } from '../../_generated/server';
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

/**
 * Sync a specific series using the new optimized deep sync
 * This is useful for testing individual series syncs
 */
export const syncSeriesById = mutation({
  args: {
    tvdbSeriesId: v.string(),
    force: v.optional(v.boolean()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    syncJobId: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // Schedule the sync action
    await ctx.scheduler.runAfter(0, internal.tvdb.syncer.actions.syncSeriesDeep, {
      seriesId: args.tvdbSeriesId,
      options: {
        force: args.force,
        syncTTLHours: 24,
        maxConcurrentSeasons: 5,
      },
    });

    return {
      success: true,
      message: `Scheduled deep sync for series ${args.tvdbSeriesId}`,
      syncJobId: `series_${args.tvdbSeriesId}_${Date.now()}`,
    };
  },
});

/**
 * Get sync status for a specific entity
 */
export const getSyncStatus = query({
  args: {
    entityType: v.union(
      v.literal('series'),
      v.literal('season'),
      v.literal('episode')
    ),
    entityId: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      lastSyncedAt: v.number(),
      tvdbLastUpdated: v.optional(v.number()),
      syncVersion: v.number(),
      hoursSinceSync: v.number(),
      currentJobs: v.array(v.object({
        status: v.string(),
        startedAt: v.optional(v.number()),
        error: v.optional(v.string()),
      })),
    })
  ),
  handler: async (ctx, args) => {
    // Get sync state
    const syncState = await ctx.db
      .query('tvdbSyncState')
      .withIndex('entity', (q) => 
        q.eq('entityType', args.entityType).eq('entityId', args.entityId)
      )
      .first();

    if (!syncState) {
      return null;
    }

    // Get current sync jobs
    const jobs = await ctx.db
      .query('syncJobs')
      .withIndex('entity', (q) => 
        q.eq('entityType', args.entityType)
         .eq('entityId', args.entityId)
         .eq('status', 'running')
      )
      .collect();

    const pendingJobs = await ctx.db
      .query('syncJobs')
      .withIndex('entity', (q) => 
        q.eq('entityType', args.entityType)
         .eq('entityId', args.entityId)
         .eq('status', 'pending')
      )
      .collect();

    return {
      lastSyncedAt: syncState.lastSyncedAt,
      tvdbLastUpdated: syncState.tvdbLastUpdated,
      syncVersion: syncState.syncVersion,
      hoursSinceSync: (Date.now() - syncState.lastSyncedAt) / (1000 * 60 * 60),
      currentJobs: [...jobs, ...pendingJobs].map(job => ({
        status: job.status,
        startedAt: job.startedAt,
        error: job.error,
      })),
    };
  },
});
