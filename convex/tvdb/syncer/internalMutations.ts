import { internalMutation } from '../../_generated/server';
import { v } from 'convex/values';
import { SeriesExtendedRecord, EpisodeExtendedRecord, SeasonExtendedRecord } from '../client/api';
import { SyncChanges } from './types';
import { Id } from '../../_generated/dataModel';

// ============================================================================
// Series Mutations
// ============================================================================

export const upsertSeries = internalMutation({
  args: {
    tvdbData: v.any(), // SeriesExtendedRecord
    tvdbId: v.string(),
  },
  handler: async (ctx, args) => {
    const data = args.tvdbData as SeriesExtendedRecord;
    const now = Date.now();

    // Check if series exists
    const existingMapping = await ctx.db
      .query('tvdbIdMapping')
      .withIndex('tvdbId_type', (q) => q.eq('tvdbId', args.tvdbId).eq('tvdbType', 'series'))
      .first();

    let showId = existingMapping?.convexId as string | undefined;
    let created = false;
    const changes: SyncChanges = {
      added: [],
      modified: [],
      removed: [],
      details: {},
    };

    // Transform TVDB data to our schema
    const showData = {
      title: data.name || '',
      slug: data.slug || args.tvdbId,
      overview: data.overview,
      posterUrl: data.image || undefined,
      backdropUrl: data.artworks?.[0]?.image || undefined,
      firstAirYear: data.firstAired ? new Date(data.firstAired).getFullYear() : undefined,
      status: mapSeriesStatus(data.status?.name),
      tvdbId: args.tvdbId,
      tmdbId: data.remoteIds?.find((r) => r.sourceName === 'TheMovieDB')?.id,
      imdbId: data.remoteIds?.find((r) => r.sourceName === 'IMDB')?.id,
      network: data.originalNetwork?.name,
      genres: data.genres?.map((g) => g.name || '').filter(Boolean),
      updatedAt: now,
    };

    if (showId) {
      // Update existing
      const existing = await ctx.db.get(showId as Id<'shows'>);
      if (existing) {
        // Track changes
        for (const [key, value] of Object.entries(showData)) {
          if (existing[key as keyof typeof existing] !== value) {
            changes.modified.push(key);
            changes.details[key] = {
              old: existing[key as keyof typeof existing],
              new: value,
            };
          }
        }

        await ctx.db.patch(showId as Id<'shows'>, showData);
      }
    } else {
      created = true;
      showId = await ctx.db.insert('shows', {
        ...showData,
        followersCount: 0,
        predictionsCount: 0,
        createdAt: now,
      });

      changes.added.push('show');

      // Create mapping
      await ctx.db.insert('tvdbIdMapping', {
        tvdbId: args.tvdbId,
        tvdbType: 'series',
        convexId: showId,
        tmdbId: showData.tmdbId,
        imdbId: showData.imdbId,
        slug: showData.slug,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Update sync state (upsert)
    const existingState = await ctx.db
      .query('tvdbSyncState')
      .withIndex('entityType_entityId', (q) =>
        q.eq('entityType', 'series').eq('entityId', args.tvdbId)
      )
      .first();

    const syncStateData = {
      entityType: 'series' as const,
      entityId: args.tvdbId,
      lastSyncedAt: now,
      lastModifiedAt: data.lastUpdated ? new Date(data.lastUpdated).getTime() : undefined,
      version: (existingState?.version ?? 0) + 1,
      status: 'synced' as const,
    };

    if (existingState) {
      await ctx.db.patch(existingState._id, syncStateData);
    } else {
      await ctx.db.insert('tvdbSyncState', syncStateData);
    }

    return { created, showId, changes };
  },
});

export const upsertEpisode = internalMutation({
  args: {
    tvdbData: v.any(), // EpisodeExtendedRecord
    tvdbId: v.string(),
  },
  handler: async (ctx, args) => {
    const data = args.tvdbData as EpisodeExtendedRecord;
    const now = Date.now();

    // Get series mapping
    const seriesMapping = await ctx.db
      .query('tvdbIdMapping')
      .withIndex('tvdbId_type', (q) =>
        q.eq('tvdbId', data.seriesId?.toString() || '').eq('tvdbType', 'series')
      )
      .first();

    if (!seriesMapping?.convexId) {
      // Series not synced yet - return a special result to trigger parent sync
      return {
        created: false,
        episodeId: undefined,
        changes: {
          added: [],
          modified: [],
          removed: [],
          details: {},
        },
        requiresParentSync: true,
        parentSeriesId: data.seriesId?.toString(),
      };
    }

    // Get or create season
    let season = await ctx.db
      .query('seasons')
      .withIndex('show_seasonNumber', (q) =>
        q
          .eq('showId', seriesMapping.convexId as Id<'shows'>)
          .eq('seasonNumber', data.seasonNumber || 0)
      )
      .first();

    if (!season) {
      // Season not found - create a minimal season stub
      const seasonId = await ctx.db.insert('seasons', {
        showId: seriesMapping.convexId as Id<'shows'>,
        seasonNumber: data.seasonNumber || 0,
        title: `Season ${data.seasonNumber || 0}`,
        tvdbId: undefined, // Episode data doesn't include seasonId
        episodeCount: 0,
        createdAt: now,
        updatedAt: now,
      });

      // Fetch the newly created season to ensure we have the full record
      const newSeason = await ctx.db.get(seasonId);
      if (!newSeason) {
        throw new Error('Failed to create season stub');
      }
      season = newSeason;
    }

    // Check if episode exists
    const existingEpisode = await ctx.db
      .query('episodes')
      .withIndex('show_season_episode', (q) =>
        q
          .eq('showId', seriesMapping.convexId as Id<'shows'>)
          .eq('seasonNumber', data.seasonNumber || 0)
          .eq('episodeNumber', data.number || 0)
      )
      .first();

    let episodeId = existingEpisode?._id;
    let created = false;
    const changes: SyncChanges = {
      added: [],
      modified: [],
      removed: [],
      details: {},
    };

    const episodeData = {
      showId: seriesMapping.convexId as Id<'shows'>,
      seasonId: season._id,
      seasonNumber: data.seasonNumber || 0,
      episodeNumber: data.number || 0,
      title: data.name || `Episode ${data.number}`,
      overview: data.translations?.overviewTranslations?.[0]?.overview,
      // Parse date-only strings as UTC midnight to avoid timezone drift
      airDateUtc: data.aired
        ? new Date(
            /^\d{4}-\d{2}-\d{2}$/.test(data.aired) ? `${data.aired}T00:00:00Z` : data.aired
          ).getTime()
        : undefined,
      runtimeMinutes: data.runtime || undefined, // Convert null to undefined
      tvdbId: args.tvdbId,
      imdbId: data.remoteIds?.find((r) => r.sourceName === 'IMDB')?.id,
      stillUrl: data.image || undefined,
      hasAired: data.aired ? new Date(data.aired) <= new Date() : false,
      updatedAt: now,
    };

    if (episodeId) {
      // Update existing
      const existing = await ctx.db.get(episodeId);
      if (existing) {
        for (const [key, value] of Object.entries(episodeData)) {
          if (existing[key as keyof typeof existing] !== value) {
            changes.modified.push(key);
            changes.details[key] = {
              old: existing[key as keyof typeof existing],
              new: value,
            };
          }
        }

        await ctx.db.patch(episodeId, episodeData);
      }
    } else {
      // Create new
      created = true;
      episodeId = await ctx.db.insert('episodes', {
        ...episodeData,
        createdAt: now,
      });

      changes.added.push('episode');
    }

    // Update sync state (upsert)
    const existingState = await ctx.db
      .query('tvdbSyncState')
      .withIndex('entityType_entityId', (q) =>
        q.eq('entityType', 'episode').eq('entityId', args.tvdbId)
      )
      .first();

    const syncStateData = {
      entityType: 'episode' as const,
      entityId: args.tvdbId,
      lastSyncedAt: now,
      lastModifiedAt: data.lastUpdated ? new Date(data.lastUpdated).getTime() : undefined,
      version: (existingState?.version ?? 0) + 1,
      status: 'synced' as const,
    };

    if (existingState) {
      await ctx.db.patch(existingState._id, syncStateData);
    } else {
      await ctx.db.insert('tvdbSyncState', syncStateData);
    }

    return { created, episodeId, changes };
  },
});

export const upsertSeason = internalMutation({
  args: {
    tvdbData: v.any(), // SeasonExtendedRecord
    tvdbId: v.string(),
  },
  handler: async (ctx, args) => {
    const data = args.tvdbData as SeasonExtendedRecord;
    const now = Date.now();

    // Get series mapping
    const seriesMapping = await ctx.db
      .query('tvdbIdMapping')
      .withIndex('tvdbId_type', (q) =>
        q.eq('tvdbId', data.seriesId?.toString() || '').eq('tvdbType', 'series')
      )
      .first();

    if (!seriesMapping?.convexId) {
      throw new Error(`Series ${data.seriesId} not synced yet`);
    }

    // Check if season exists
    const existingSeason = await ctx.db
      .query('seasons')
      .withIndex('show_seasonNumber', (q) =>
        q.eq('showId', seriesMapping.convexId as Id<'shows'>).eq('seasonNumber', data.number || 0)
      )
      .first();

    let seasonId = existingSeason?._id;
    let created = false;
    const changes: SyncChanges = {
      added: [],
      modified: [],
      removed: [],
      details: {},
    };

    const seasonData = {
      showId: seriesMapping.convexId as Id<'shows'>,
      seasonNumber: data.number || 0,
      title: data.name,
      tvdbId: args.tvdbId,
      posterUrl: data.image || undefined,
      episodeCount: data.episodes?.length,
      updatedAt: now,
    };

    if (seasonId) {
      // Update existing
      await ctx.db.patch(seasonId, seasonData);
    } else {
      // Create new
      created = true;
      seasonId = await ctx.db.insert('seasons', {
        ...seasonData,
        createdAt: now,
      });

      changes.added.push('season');
    }

    // Update sync state (upsert)
    const existingState = await ctx.db
      .query('tvdbSyncState')
      .withIndex('entityType_entityId', (q) =>
        q.eq('entityType', 'season').eq('entityId', args.tvdbId)
      )
      .first();

    const syncStateData = {
      entityType: 'season' as const,
      entityId: args.tvdbId,
      lastSyncedAt: now,
      lastModifiedAt: data.lastUpdated ? new Date(data.lastUpdated).getTime() : undefined,
      version: (existingState?.version ?? 0) + 1,
      status: 'synced' as const,
    };

    if (existingState) {
      await ctx.db.patch(existingState._id, syncStateData);
    } else {
      await ctx.db.insert('tvdbSyncState', syncStateData);
    }

    return { created, seasonId, changes };
  },
});

// ============================================================================
// Queue Management - DEPRECATED: Using workpool instead
// ============================================================================
// These functions are kept for backward compatibility but should not be used
// Use the workpool functions in workpool.ts instead

// ============================================================================
// Sync State Management
// ============================================================================

export const storeAuthToken = internalMutation({
  args: {
    token: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Store token
    const tokenConfig = await ctx.db
      .query('tvdbSyncConfig')
      .withIndex('key', (q) => q.eq('key', 'auth_token'))
      .first();

    if (tokenConfig) {
      await ctx.db.patch(tokenConfig._id, {
        value: args.token,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert('tvdbSyncConfig', {
        key: 'auth_token',
        value: args.token,
        updatedAt: now,
      });
    }

    // Store expiration time
    const expiresConfig = await ctx.db
      .query('tvdbSyncConfig')
      .withIndex('key', (q) => q.eq('key', 'auth_token_expires_at'))
      .first();

    if (expiresConfig) {
      await ctx.db.patch(expiresConfig._id, {
        value: args.expiresAt,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert('tvdbSyncConfig', {
        key: 'auth_token_expires_at',
        value: args.expiresAt,
        updatedAt: now,
      });
    }

    return { success: true };
  },
});

export const updateSyncState = internalMutation({
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
    status: v.union(
      v.literal('synced'),
      v.literal('pending'),
      v.literal('failed'),
      v.literal('conflict')
    ),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('tvdbSyncState')
      .withIndex('entityType_entityId', (q) =>
        q
          .eq(
            'entityType',
            args.entityType as 'series' | 'season' | 'episode' | 'movie' | 'person' | 'company'
          )
          .eq('entityId', args.entityId)
      )
      .first();

    const data = {
      entityType: args.entityType as
        | 'series'
        | 'season'
        | 'episode'
        | 'movie'
        | 'person'
        | 'company',
      entityId: args.entityId,
      lastSyncedAt: Date.now(),
      status: args.status,
      errorMessage: args.errorMessage,
      retryCount: args.status === 'failed' ? (existing?.retryCount || 0) + 1 : 0,
      version: (existing?.version || 0) + 1,
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
    } else {
      await ctx.db.insert('tvdbSyncState', data);
    }
  },
});

// ============================================================================
// Raw Data Storage
// ============================================================================

export const storeRawData = internalMutation({
  args: {
    tvdbId: v.string(),
    entityType: v.string(),
    data: v.string(),
    version: v.number(),
  },
  handler: async (ctx, args) => {
    // Store raw TVDB response for debugging/audit
    await ctx.db.insert('tvdbRawData', {
      tvdbId: args.tvdbId,
      entityType: args.entityType,
      data: args.data,
      version: args.version,
      fetchedAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  },
});

// ============================================================================
// Config Management
// ============================================================================

export const updateConfig = internalMutation({
  args: {
    key: v.union(
      v.literal('api_key'),
      v.literal('rate_limit_requests'),
      v.literal('rate_limit_window_ms'),
      v.literal('sync_enabled'),
      v.literal('last_full_sync'),
      v.literal('last_incremental_sync'),
      v.literal('sync_interval_hours'),
      v.literal('max_retries'),
      v.literal('batch_size')
    ),
    value: v.union(v.string(), v.number(), v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('tvdbSyncConfig')
      .withIndex('key', (q) => q.eq('key', args.key))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert('tvdbSyncConfig', {
        key: args.key,
        value: args.value,
        updatedAt: Date.now(),
      });
    }
  },
});

// ============================================================================
// Cleanup Mutations
// ============================================================================

export const cleanupOldRawData = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const oldData = await ctx.db
      .query('tvdbRawData')
      .filter((q) => q.lt(q.field('expiresAt'), now))
      .collect();

    let deleted = 0;
    for (const item of oldData) {
      await ctx.db.delete(item._id);
      deleted++;
    }

    return { deleted };
  },
});

// ============================================================================
// Sync Logging Mutations
// ============================================================================

export const logSyncStart = internalMutation({
  args: {
    syncId: v.string(),
    entityType: v.string(),
    metadata: v.optional(
      v.object({
        startPage: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('tvdbSyncLog', {
      syncId: args.syncId,
      entityType: args.entityType,
      entityId: 'all',
      action: 'start',
      status: 'started',
      startedAt: Date.now(),
      metadata: args.metadata,
    });
  },
});

export const logSyncProgress = internalMutation({
  args: {
    syncId: v.string(),
    message: v.string(),
    metadata: v.optional(
      v.object({
        page: v.optional(v.number()),
        processed: v.optional(v.number()),
        skipped: v.optional(v.number()),
        currentSeriesId: v.optional(v.string()),
        currentSeriesName: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('tvdbSyncLog', {
      syncId: args.syncId,
      entityType: 'progress',
      entityId: args.metadata?.currentSeriesId || 'batch',
      action: 'progress',
      status: 'started',
      startedAt: Date.now(),
      metadata: args.metadata,
    });
  },
});

export const logSyncComplete = internalMutation({
  args: {
    syncId: v.string(),
    metadata: v.optional(
      v.object({
        totalPages: v.optional(v.number()),
        totalSeries: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('tvdbSyncLog', {
      syncId: args.syncId,
      entityType: 'full_database',
      entityId: 'all',
      action: 'complete',
      status: 'completed',
      startedAt: Date.now(),
      completedAt: Date.now(),
      metadata: args.metadata,
    });
  },
});

export const logSyncError = internalMutation({
  args: {
    syncId: v.string(),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('tvdbSyncLog', {
      syncId: args.syncId,
      entityType: 'error',
      entityId: 'error',
      action: 'error',
      status: 'failed',
      startedAt: Date.now(),
      error: args.error,
    });
  },
});

// ============================================================================
// Helper Functions
// ============================================================================

function mapSeriesStatus(tvdbStatus?: string): 'running' | 'ended' | 'hiatus' | 'unknown' {
  const statusMap: Record<string, 'running' | 'ended' | 'hiatus' | 'unknown'> = {
    Continuing: 'running',
    Ended: 'ended',
    'On Hiatus': 'hiatus',
    Upcoming: 'running',
  };

  return statusMap[tvdbStatus || ''] || 'unknown';
}
