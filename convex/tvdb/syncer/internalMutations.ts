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

    const syncStateData = {
      entityType: 'episode' as const,
      entityId: args.tvdbId,
      lastSyncedAt: now,
      lastModifiedAt: data.lastUpdated ? new Date(data.lastUpdated).getTime() : undefined,
      version: 1,
      status: 'synced' as const,
    };

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

    const syncStateData = {
      entityType: 'season' as const,
      entityId: args.tvdbId,
      lastSyncedAt: now,
      lastModifiedAt: data.lastUpdated ? new Date(data.lastUpdated).getTime() : undefined,
      version: 1,
      status: 'synced' as const,
    };

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
// Batched Mutations for Performance
// ============================================================================

export const storeRawDataAndUpsertSeries = internalMutation({
  args: {
    tvdbData: v.any(),
    tvdbId: v.string(),
    rawData: v.string(),
  },
  handler: async (ctx, args) => {
    // Upsert series (inline the logic from upsertSeries)
    const data = args.tvdbData as SeriesExtendedRecord;
    const now = Date.now();

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
      const existing = await ctx.db.get(showId as Id<'shows'>);
      if (existing) {
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

    return { created, showId, changes };
  },
});

export const storeRawDataAndUpsertEpisode = internalMutation({
  args: {
    tvdbData: v.any(),
    tvdbId: v.string(),
    rawData: v.string(),
  },
  handler: async (ctx, args) => {
    const data = args.tvdbData as EpisodeExtendedRecord;
    const now = Date.now();

    const seriesMapping = data.seriesId
      ? await ctx.db
          .query('tvdbIdMapping')
          .withIndex('tvdbId_type', (q) =>
            q.eq('tvdbId', data.seriesId!.toString()).eq('tvdbType', 'series')
          )
          .first()
      : null;

    if (!seriesMapping?.convexId) {
      return {
        created: false,
        requiresParentSync: true,
        parentSeriesId: data.seriesId?.toString(),
        changes: { added: [], modified: [], removed: [], details: {} },
      };
    }

    const showId = seriesMapping.convexId as Id<'shows'>;

    const seasonMapping = data.seasons?.[0]?.id
      ? await ctx.db
          .query('tvdbIdMapping')
          .withIndex('tvdbId_type', (q) =>
            q.eq('tvdbId', data.seasons![0].id!.toString()).eq('tvdbType', 'season')
          )
          .first()
      : null;

    let seasonId = seasonMapping?.convexId as Id<'seasons'> | undefined;

    if (!seasonId) {
      const seasonNum =
        data.seasonNumber !== undefined && data.seasonNumber !== null ? data.seasonNumber : 0;
      const existingSeason = await ctx.db
        .query('seasons')
        .withIndex('show_seasonNumber', (q) => q.eq('showId', showId).eq('seasonNumber', seasonNum))
        .first();

      if (!existingSeason) {
        seasonId = await ctx.db.insert('seasons', {
          showId,
          seasonNumber: seasonNum,
          title: `Season ${seasonNum}`,
          tvdbId: data.seasons?.[0]?.id?.toString(),
          createdAt: now,
          updatedAt: now,
        });

        if (data.seasons?.[0]?.id) {
          await ctx.db.insert('tvdbIdMapping', {
            tvdbId: data.seasons[0].id.toString(),
            tvdbType: 'season',
            convexId: seasonId,
            createdAt: now,
            updatedAt: now,
          });
        }
      } else {
        seasonId = existingSeason._id;
      }
    }

    const existingMapping = await ctx.db
      .query('tvdbIdMapping')
      .withIndex('tvdbId_type', (q) => q.eq('tvdbId', args.tvdbId).eq('tvdbType', 'episode'))
      .first();

    let episodeId = existingMapping?.convexId as string | undefined;
    let created = false;
    const changes: SyncChanges = {
      added: [],
      modified: [],
      removed: [],
      details: {},
    };

    const episodeData = {
      showId,
      seasonId: seasonId!,
      seasonNumber: data.seasonNumber || 0,
      episodeNumber: data.number || 0,
      title: data.name || `Episode ${data.number}`,
      airDateUtc: data.aired ? new Date(data.aired).getTime() : undefined,
      runtimeMinutes: data.runtime ?? undefined,
      tvdbId: args.tvdbId,
      imdbId: data.remoteIds?.find((r) => r.sourceName === 'IMDB')?.id,
      stillUrl: data.image ?? undefined,
      hasAired: data.aired ? new Date(data.aired) < new Date() : false,
      updatedAt: now,
    };

    if (episodeId) {
      const existing = await ctx.db.get(episodeId as Id<'episodes'>);
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
        await ctx.db.patch(episodeId as Id<'episodes'>, episodeData);
      }
    } else {
      created = true;
      episodeId = await ctx.db.insert('episodes', {
        ...episodeData,
        createdAt: now,
      });
      changes.added.push('episode');

      await ctx.db.insert('tvdbIdMapping', {
        tvdbId: args.tvdbId,
        tvdbType: 'episode',
        convexId: episodeId,
        imdbId: episodeData.imdbId,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { created, episodeId, changes };
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
// Bulk Upsert Mutations - Split into smaller parts to avoid timeouts
// ============================================================================

// Upsert just the series data
export const upsertSeriesData = internalMutation({
  args: {
    series: v.any(), // SeriesExtendedRecord
  },
  returns: v.object({
    seriesId: v.id('shows'),
    created: v.boolean(),
    updated: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const seriesData = args.series as SeriesExtendedRecord;
    const now = Date.now();

    const seriesIdStr = seriesData.id?.toString() || '';
    let existingMapping = await ctx.db
      .query('tvdbIdMapping')
      .withIndex('tvdbId_type', (q) => q.eq('tvdbId', seriesIdStr).eq('tvdbType', 'series'))
      .first();

    let showId: Id<'shows'>;
    let created = false;
    let updated = false;

    const showData = {
      title: seriesData.name || '',
      slug: seriesData.slug || seriesIdStr,
      overview: seriesData.overview,
      posterUrl: seriesData.image || undefined,
      backdropUrl: seriesData.artworks?.[0]?.image || undefined,
      firstAirYear: seriesData.firstAired
        ? new Date(seriesData.firstAired).getFullYear()
        : undefined,
      status: mapSeriesStatus(seriesData.status?.name),
      tvdbId: seriesIdStr,
      tmdbId: seriesData.remoteIds?.find((r) => r.sourceName === 'TheMovieDB')?.id,
      imdbId: seriesData.remoteIds?.find((r) => r.sourceName === 'IMDB')?.id,
      network: seriesData.originalNetwork?.name,
      genres: seriesData.genres?.map((g) => g.name || '').filter(Boolean),
      updatedAt: now,
    };

    if (existingMapping?.convexId) {
      showId = existingMapping.convexId as Id<'shows'>;
      const existing = await ctx.db.get(showId);
      if (existing) {
        // Only update if data has changed
        const hasChanges = Object.entries(showData).some(
          ([key, value]) => existing[key as keyof typeof existing] !== value
        );
        if (hasChanges) {
          await ctx.db.patch(showId, showData);
          updated = true;
        }
      }
    } else {
      created = true;
      showId = await ctx.db.insert('shows', {
        ...showData,
        followersCount: 0,
        predictionsCount: 0,
        createdAt: now,
      });

      await ctx.db.insert('tvdbIdMapping', {
        tvdbId: seriesIdStr,
        tvdbType: 'series',
        convexId: showId,
        tmdbId: showData.tmdbId,
        imdbId: showData.imdbId,
        slug: showData.slug,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { seriesId: showId, created, updated };
  },
});

// Upsert seasons for a show
export const upsertSeasonsData = internalMutation({
  args: {
    showId: v.id('shows'),
    seasons: v.array(v.any()), // SeasonExtendedRecord[]
  },
  returns: v.object({
    seasonIds: v.array(v.id('seasons')),
    seasonIdMapping: v.array(v.object({
      tvdbId: v.string(),
      convexId: v.id('seasons'),
    })),
    created: v.number(),
    updated: v.number(),
  }),
  handler: async (ctx, args) => {
    const seasonsData = args.seasons as SeasonExtendedRecord[];
    const now = Date.now();
    let created = 0;
    let updated = 0;

    // Prefetch existing seasons
    const existingSeasons = await ctx.db
      .query('seasons')
      .withIndex('showId', (q) => q.eq('showId', args.showId))
      .collect();

    const seasonsByNumber = new Map(existingSeasons.map((s) => [s.seasonNumber, s]));

    const seasonIds: Id<'seasons'>[] = [];
    const seasonIdMapping: Array<{ tvdbId: string; convexId: Id<'seasons'> }> = [];

    for (const seasonData of seasonsData) {
      const seasonTvdbId = seasonData.id?.toString() || '';
      const seasonNumber = seasonData.number || 0;

      let existingSeason = seasonsByNumber.get(seasonNumber);
      let seasonId: Id<'seasons'>;

      const seasonDataToSave = {
        showId: args.showId,
        seasonNumber,
        title: seasonData.name,
        tvdbId: seasonTvdbId,
        posterUrl: seasonData.image || undefined,
        episodeCount: seasonData.episodes?.length,
        updatedAt: now,
      };

      if (existingSeason) {
        seasonId = existingSeason._id;
        // Only update if data has changed
        const hasChanges = Object.entries(seasonDataToSave).some(
          ([key, value]) => existingSeason![key as keyof typeof existingSeason] !== value
        );
        if (hasChanges) {
          await ctx.db.patch(seasonId, seasonDataToSave);
          updated++;
        }
      } else {
        seasonId = await ctx.db.insert('seasons', {
          ...seasonDataToSave,
          createdAt: now,
        });
        created++;

        // Create tvdbIdMapping for season if it has a TVDB ID
        if (seasonTvdbId) {
          const existingSeasonMapping = await ctx.db
            .query('tvdbIdMapping')
            .withIndex('tvdbId_type', (q) => q.eq('tvdbId', seasonTvdbId).eq('tvdbType', 'season'))
            .first();

          if (!existingSeasonMapping) {
            await ctx.db.insert('tvdbIdMapping', {
              tvdbId: seasonTvdbId,
              tvdbType: 'season',
              convexId: seasonId,
              tmdbId: undefined,
              imdbId: undefined,
              slug: undefined,
              createdAt: now,
              updatedAt: now,
            });
          }
        }
      }

      seasonIds.push(seasonId);
      if (seasonTvdbId) {
        seasonIdMapping.push({ tvdbId: seasonTvdbId, convexId: seasonId });
      }
    }

    return { seasonIds, seasonIdMapping, created, updated };
  },
});

// Upsert episodes for a single season (chunked)
export const upsertSeasonEpisodes = internalMutation({
  args: {
    showId: v.id('shows'),
    seasonId: v.id('seasons'),
    seasonNumber: v.number(),
    seasonTvdbId: v.string(),
    episodes: v.array(v.any()), // EpisodeExtendedRecord[]
  },
  returns: v.object({
    episodeCount: v.number(),
    created: v.number(),
    updated: v.number(),
  }),
  handler: async (ctx, args) => {
    const episodes = args.episodes as EpisodeExtendedRecord[];
    const now = Date.now();
    let created = 0;
    let updated = 0;

    // Prefetch existing episodes for this season
    const existingEpisodes = await ctx.db
      .query('episodes')
      .withIndex('show_season_episode', (q) =>
        q.eq('showId', args.showId).eq('seasonNumber', args.seasonNumber)
      )
      .collect();

    const episodesByNumber = new Map(existingEpisodes.map((e) => [e.episodeNumber, e]));

    for (const episodeData of episodes) {
      const episodeTvdbId = episodeData.id?.toString() || '';
      const episodeNumber = episodeData.number || 0;

      let existingEpisode = episodesByNumber.get(episodeNumber);

      const episodeDataToSave = {
        showId: args.showId,
        seasonId: args.seasonId,
        seasonNumber: args.seasonNumber,
        episodeNumber,
        title: episodeData.name || `Episode ${episodeNumber}`,
        overview: episodeData.translations?.overviewTranslations?.[0]?.overview,
        airDateUtc: episodeData.aired
          ? new Date(
              /^\d{4}-\d{2}-\d{2}$/.test(episodeData.aired)
                ? `${episodeData.aired}T00:00:00Z`
                : episodeData.aired
            ).getTime()
          : undefined,
        runtimeMinutes: episodeData.runtime || undefined,
        tvdbId: episodeTvdbId,
        imdbId: episodeData.remoteIds?.find((r) => r.sourceName === 'IMDB')?.id,
        stillUrl: episodeData.image || undefined,
        hasAired: episodeData.aired ? new Date(episodeData.aired) <= new Date() : false,
        updatedAt: now,
      };

      if (existingEpisode) {
        // Only update if data has changed
        const hasChanges = Object.entries(episodeDataToSave).some(
          ([key, value]) => existingEpisode![key as keyof typeof existingEpisode] !== value
        );
        if (hasChanges) {
          await ctx.db.patch(existingEpisode._id, episodeDataToSave);
          updated++;
        }
      } else {
        const newEpisodeId = await ctx.db.insert('episodes', {
          ...episodeDataToSave,
          createdAt: now,
        });
        created++;

        // Create tvdbIdMapping for episode if it has a TVDB ID
        if (episodeTvdbId) {
          const existingEpisodeMapping = await ctx.db
            .query('tvdbIdMapping')
            .withIndex('tvdbId_type', (q) =>
              q.eq('tvdbId', episodeTvdbId).eq('tvdbType', 'episode')
            )
            .first();

          if (!existingEpisodeMapping) {
            await ctx.db.insert('tvdbIdMapping', {
              tvdbId: episodeTvdbId,
              tvdbType: 'episode',
              convexId: newEpisodeId,
              tmdbId: undefined,
              imdbId: episodeDataToSave.imdbId,
              slug: undefined,
              createdAt: now,
              updatedAt: now,
            });
          }
        }
      }
    }

    return {
      episodeCount: episodes.length,
      created,
      updated,
    };
  },
});

// Update sync state after successful sync
export const updateSeriesSyncState = internalMutation({
  args: {
    seriesId: v.string(),
    lastUpdated: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();

    const syncState = await ctx.db
      .query('tvdbSyncState')
      .withIndex('entity', (q) => q.eq('entityType', 'series').eq('entityId', args.seriesId))
      .first();

    if (syncState) {
      await ctx.db.patch(syncState._id, {
        lastSyncedAt: now,
        tvdbLastUpdated: args.lastUpdated
          ? new Date(args.lastUpdated).getTime()
          : undefined,
        syncVersion: 2, // Version 2 = bulk sync
      });
    } else {
      await ctx.db.insert('tvdbSyncState', {
        entityType: 'series',
        entityId: args.seriesId,
        lastSyncedAt: now,
        tvdbLastUpdated: args.lastUpdated
          ? new Date(args.lastUpdated).getTime()
          : undefined,
        syncVersion: 2,
      });
    }

    return null;
  },
});

export const bulkUpsertEpisodes = internalMutation({
  args: {
    showId: v.id('shows'),
    seasonId: v.id('seasons'),
    seasonNumber: v.number(),
    episodes: v.array(v.any()), // EpisodeExtendedRecord[]
  },
  returns: v.object({
    created: v.number(),
    updated: v.number(),
  }),
  handler: async (ctx, args) => {
    const episodesData = args.episodes as EpisodeExtendedRecord[];
    const now = Date.now();
    const created = { count: 0 };
    const updated = { count: 0 };

    // Prefetch existing episodes for this season
    const existingEpisodes = await ctx.db
      .query('episodes')
      .withIndex('seasonId', (q) => q.eq('seasonId', args.seasonId))
      .collect();

    const episodesByNumber = new Map(existingEpisodes.map((e) => [e.episodeNumber, e]));

    for (const episodeData of episodesData) {
      const episodeTvdbId = episodeData.id?.toString() || '';
      const episodeNumber = episodeData.number || 0;

      let existingEpisode = episodesByNumber.get(episodeNumber);

      const episodeDataToSave = {
        showId: args.showId,
        seasonId: args.seasonId,
        seasonNumber: args.seasonNumber,
        episodeNumber,
        title: episodeData.name || `Episode ${episodeNumber}`,
        overview: episodeData.translations?.overviewTranslations?.[0]?.overview,
        airDateUtc: episodeData.aired
          ? new Date(
              /^\d{4}-\d{2}-\d{2}$/.test(episodeData.aired)
                ? `${episodeData.aired}T00:00:00Z`
                : episodeData.aired
            ).getTime()
          : undefined,
        runtimeMinutes: episodeData.runtime || undefined,
        tvdbId: episodeTvdbId,
        imdbId: episodeData.remoteIds?.find((r) => r.sourceName === 'IMDB')?.id,
        stillUrl: episodeData.image || undefined,
        hasAired: episodeData.aired ? new Date(episodeData.aired) <= new Date() : false,
        updatedAt: now,
      };

      if (existingEpisode) {
        // Only update if data has changed
        const hasChanges = Object.entries(episodeDataToSave).some(
          ([key, value]) => existingEpisode![key as keyof typeof existingEpisode] !== value
        );
        if (hasChanges) {
          await ctx.db.patch(existingEpisode._id, episodeDataToSave);
          updated.count++;
        }
      } else {
        await ctx.db.insert('episodes', {
          ...episodeDataToSave,
          createdAt: now,
        });
        created.count++;
      }
    }

    return {
      created: created.count,
      updated: updated.count,
    };
  },
});

// ============================================================================
// Sync Job Management
// ============================================================================

export const upsertSyncJob = internalMutation({
  args: {
    entityType: v.union(
      v.literal('series'),
      v.literal('season'),
      v.literal('episode'),
      v.literal('fullSync')
    ),
    entityId: v.string(),
    status: v.union(
      v.literal('pending'),
      v.literal('running'),
      v.literal('completed'),
      v.literal('failed')
    ),
    startedAt: v.optional(v.number()),
    priority: v.optional(v.number()),
  },
  returns: v.object({
    claimed: v.boolean(),
    existingJobId: v.optional(v.id('syncJobs')),
  }),
  handler: async (ctx, args) => {
    // Check if there's already a running job for this entity
    const existing = await ctx.db
      .query('syncJobs')
      .withIndex('entity', (q) =>
        q.eq('entityType', args.entityType).eq('entityId', args.entityId).eq('status', 'running')
      )
      .first();

    if (existing) {
      // Another job is already running for this entity
      if (args.status === 'running') {
        // Can't claim - another job is already running
        return { claimed: false, existingJobId: existing._id };
      }

      // Update the existing job
      await ctx.db.patch(existing._id, {
        status: args.status,
        startedAt: args.startedAt,
      });
      return { claimed: true, existingJobId: existing._id };
    } else {
      // No existing running job - create a new one
      const jobId = await ctx.db.insert('syncJobs', {
        entityType: args.entityType,
        entityId: args.entityId,
        status: args.status,
        priority: args.priority,
        startedAt: args.startedAt,
        retryCount: 0,
      });
      return { claimed: true, existingJobId: jobId };
    }
  },
});

export const updateSyncJob = internalMutation({
  args: {
    entityType: v.union(
      v.literal('series'),
      v.literal('season'),
      v.literal('episode'),
      v.literal('fullSync')
    ),
    entityId: v.string(),
    status: v.union(
      v.literal('pending'),
      v.literal('running'),
      v.literal('completed'),
      v.literal('failed')
    ),
    completedAt: v.optional(v.number()),
    error: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('syncJobs')
      .withIndex('entity', (q) =>
        q.eq('entityType', args.entityType).eq('entityId', args.entityId).eq('status', 'running')
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        completedAt: args.completedAt,
        error: args.error,
        metadata: args.metadata,
      });
    }
    return null;
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
