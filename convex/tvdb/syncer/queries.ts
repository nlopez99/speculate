import { internalQuery, query } from '../../_generated/server';
import { v } from 'convex/values';
import { paginationOptsValidator } from 'convex/server';
import { Doc } from '../../_generated/dataModel';

// ============================================================================
// Config Queries
// ============================================================================

export const getStoredAuthToken = internalQuery({
  handler: async (ctx) => {
    const tokenConfig = await ctx.db
      .query('tvdbSyncConfig')
      .withIndex('key', (q) => q.eq('key', 'auth_token'))
      .first();
    
    const expiresConfig = await ctx.db
      .query('tvdbSyncConfig')
      .withIndex('key', (q) => q.eq('key', 'auth_token_expires_at'))
      .first();
    
    if (!tokenConfig || !expiresConfig) {
      return null;
    }
    
    const token = tokenConfig.value as string;
    const expiresAt = expiresConfig.value as number;
    const now = Date.now();
    
    // Check if token is still valid (with 5 minute buffer)
    if (expiresAt - now < 5 * 60 * 1000) {
      return null; // Token expired or expiring soon
    }
    
    return { token, expiresAt };
  },
});

export const getConfig = internalQuery({
  args: {
    key: v.union(
      v.literal('api_key'),
      v.literal('auth_token'),
      v.literal('auth_token_expires_at'),
      v.literal('rate_limit_requests'),
      v.literal('rate_limit_window_ms'),
      v.literal('sync_enabled'),
      v.literal('last_full_sync'),
      v.literal('sync_interval_hours'),
      v.literal('max_retries'),
      v.literal('batch_size')
    ),
  },
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query('tvdbSyncConfig')
      .withIndex('key', q => q.eq('key', args.key))
      .first();
    
    return config?.value;
  },
});

export const getAllConfig = query({
  handler: async (ctx) => {
    const configs = await ctx.db.query('tvdbSyncConfig').collect();
    
    return configs.reduce((acc, config) => {
      acc[config.key] = config.value;
      return acc;
    }, {} as Record<string, string | number | boolean>);
  },
});

// ============================================================================
// Sync State Queries
// ============================================================================

export const shouldSyncEntity = internalQuery({
  args: {
    entityType: v.union(
      v.literal('series'),
      v.literal('season'),
      v.literal('episode'),
      v.literal('movie'),
      v.literal('person'),
      v.literal('company')
    ),
    entityId: v.string(),
  },
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query('tvdbSyncState')
      .withIndex('entityType_entityId', q =>
        q.eq('entityType', args.entityType).eq('entityId', args.entityId)
      )
      .first();

    if (!state) {
      return true; // Never synced
    }

    // Check if sync is enabled
    const syncEnabled = await ctx.db
      .query('tvdbSyncConfig')
      .withIndex('key', q => q.eq('key', 'sync_enabled'))
      .first();

    if (syncEnabled?.value === false) {
      return false;
    }

    // Skip if recently synced (within last hour by default)
    const syncIntervalHours = await ctx.db
      .query('tvdbSyncConfig')
      .withIndex('key', q => q.eq('key', 'sync_interval_hours'))
      .first();

    const intervalMs = (syncIntervalHours?.value as number || 1) * 60 * 60 * 1000;
    const timeSinceLastSync = Date.now() - state.lastSyncedAt;

    return timeSinceLastSync > intervalMs;
  },
});

export const getSyncState = query({
  args: {
    entityType: v.optional(v.union(
      v.literal('series'),
      v.literal('season'),
      v.literal('episode'),
      v.literal('movie'),
      v.literal('person'),
      v.literal('company')
    )),
    status: v.optional(v.union(
      v.literal('synced'),
      v.literal('pending'),
      v.literal('failed'),
      v.literal('conflict')
    )),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query('tvdbSyncState');

    // Filter by entity type if provided
    if (args.entityType) {
      query = query.filter(q => q.eq(q.field('entityType'), args.entityType));
    }

    if (args.status) {
      query = query.filter(q => q.eq(q.field('status'), args.status));
    }

    return await query.order('desc').paginate(args.paginationOpts);
  },
});

// ============================================================================
// Queue Queries - DEPRECATED
// ============================================================================
// These queries are no longer used as we've migrated to workpool
// The workpool component handles its own queue management

// ============================================================================
// Mapping Queries
// ============================================================================

export const getMapping = internalQuery({
  args: {
    tvdbId: v.string(),
    tvdbType: v.union(
      v.literal('series'),
      v.literal('season'),
      v.literal('episode'),
      v.literal('movie'),
      v.literal('person'),
      v.literal('company')
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('tvdbIdMapping')
      .withIndex('tvdbId_type', q =>
        q.eq('tvdbId', args.tvdbId).eq('tvdbType', args.tvdbType)
      )
      .first();
  },
});

export const getMappingByConvexId = query({
  args: {
    convexId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('tvdbIdMapping')
      .filter(q => q.eq(q.field('convexId'), args.convexId))
      .first();
  },
});

// ============================================================================
// Sync Progress Queries
// ============================================================================

export const getSyncProgress = query({
  args: {
    syncId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let logs;
    
    if (args.syncId) {
      logs = await ctx.db
        .query('tvdbSyncLog')
        .filter(q => q.eq(q.field('syncId'), args.syncId))
        .collect();
    } else {
      // Get latest sync session
      logs = await ctx.db
        .query('tvdbSyncLog')
        .order('desc')
        .take(100);
    }

    const total = logs.length;
    const completed = logs.filter(l => l.status === 'completed').length;
    const failed = logs.filter(l => l.status === 'failed').length;
    const skipped = logs.filter(l => l.status === 'skipped').length;
    const inProgress = logs.filter(l => l.status === 'started').length;

    const firstLog = logs.sort((a, b) => a.startedAt - b.startedAt)[0];
    const lastLog = logs.sort((a, b) => b.startedAt - a.startedAt)[0];

    return {
      total,
      completed,
      failed,
      skipped,
      inProgress,
      startedAt: firstLog?.startedAt,
      lastActivity: lastLog?.startedAt,
      estimatedCompletionAt: inProgress > 0 
        ? Date.now() + (inProgress * 5000) // Rough estimate
        : undefined,
      recentErrors: logs
        .filter(l => l.status === 'failed' && l.error)
        .slice(0, 5)
        .map(l => ({
          entityType: l.entityType,
          entityId: l.entityId,
          error: l.error,
          timestamp: l.startedAt,
        })),
    };
  },
});

// ============================================================================
// Stats Queries
// ============================================================================

export const getSyncStats = query({
  handler: async (ctx) => {
    // Count synced entities
    const syncStates = await ctx.db.query('tvdbSyncState').collect();
    
    const stats = {
      total: syncStates.length,
      synced: syncStates.filter(s => s.status === 'synced').length,
      failed: syncStates.filter(s => s.status === 'failed').length,
      pending: syncStates.filter(s => s.status === 'pending').length,
      conflicts: syncStates.filter(s => s.status === 'conflict').length,
      byEntityType: {} as Record<string, number>,
      lastSyncTimes: {} as Record<string, number>,
    };

    // Group by entity type
    for (const state of syncStates) {
      stats.byEntityType[state.entityType] = (stats.byEntityType[state.entityType] || 0) + 1;
      
      if (!stats.lastSyncTimes[state.entityType] || 
          state.lastSyncedAt > stats.lastSyncTimes[state.entityType]) {
        stats.lastSyncTimes[state.entityType] = state.lastSyncedAt;
      }
    }

    // Get config
    const lastFullSync = await ctx.db
      .query('tvdbSyncConfig')
      .withIndex('key', q => q.eq('key', 'last_full_sync'))
      .first();

    return {
      ...stats,
      // Queue stats removed - workpool manages its own queue
      queue: {
        total: 0,
        ready: 0,
        pending: 0,
        failed: 0,
      },
      lastFullSync: lastFullSync?.value as number | undefined,
    };
  },
});

// ============================================================================
// Search Queries
// ============================================================================

export const searchMappings = query({
  args: {
    query: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const searchTerm = args.query.toLowerCase();
    
    return await ctx.db
      .query('tvdbIdMapping')
      .filter(q =>
        q.or(
          q.eq(q.field('tvdbId'), searchTerm),
          q.eq(q.field('tmdbId'), searchTerm),
          q.eq(q.field('imdbId'), searchTerm)
        )
      )
      .paginate(args.paginationOpts);
  },
});

// ============================================================================
// Sync Log Queries
// ============================================================================

export const getSyncLogs = internalQuery({
  args: {
    syncId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('tvdbSyncLog')
      .withIndex('syncId', q => q.eq('syncId', args.syncId))
      .order('asc')
      .collect();
  },
});