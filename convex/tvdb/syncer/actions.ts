import { action, internalAction } from '../../_generated/server';
import { internal } from '../../_generated/api';
import { v } from 'convex/values';
import { TVDBClient } from '../client/api';
import type { SyncOptions, SyncResult, TVDBEntityData, TVDBUpdateRecord } from './types';

// ============================================================================
// Main Sync Actions
// ============================================================================

export const syncSeries = internalAction({
  args: {
    seriesId: v.string(),
    options: v.optional(
      v.object({
        force: v.optional(v.boolean()),
        shallow: v.optional(v.boolean()),
        priority: v.optional(v.number()),
        maxDepth: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args): Promise<SyncResult> => {
    const client = new TVDBClient();

    // Get API key from config
    const apiKey = await ctx.runQuery(internal.tvdb.syncer.queries.getConfig, {
      key: 'api_key',
    });

    if (!apiKey) {
      throw new Error('TVDB API key not configured');
    }

    // Authenticate
    await client.login({ apikey: apiKey as string });

    try {
      // Check if we should sync (unless forced)
      if (!args.options?.force) {
        const shouldSync = await ctx.runQuery(internal.tvdb.syncer.queries.shouldSyncEntity, {
          entityType: 'series',
          entityId: args.seriesId,
        });

        if (!shouldSync) {
          return {
            success: true,
            entityType: 'series',
            entityId: args.seriesId,
            action: 'skipped',
          };
        }
      }

      // Fetch series data from TVDB
      const seriesData = await client.getSeriesExtended(parseInt(args.seriesId), {
        meta: 'translations',
      });

      // Store raw data for audit/debugging
      await ctx.runMutation(internal.tvdb.syncer.mutations.storeRawData, {
        tvdbId: args.seriesId,
        entityType: 'series',
        data: JSON.stringify(seriesData.data),
        version: 1,
      });

      // Upsert series data
      const result = await ctx.runMutation(internal.tvdb.syncer.mutations.upsertSeries, {
        tvdbData: seriesData.data,
        tvdbId: args.seriesId,
      });

      // Sync related entities if not shallow
      const relatedSyncs: SyncResult[] = [];
      if (!args.options?.shallow && seriesData.data.seasons) {
        for (const season of seriesData.data.seasons) {
          if (season.id) {
            await ctx.runMutation(internal.tvdb.syncer.workpool.enqueueSyncEntity, {
              entityType: 'season',
              entityId: season.id.toString(),
              priority: (args.options?.priority ?? 5) + 1,
              metadata: {
                parentId: args.seriesId,
                seasonNumber: season.number,
              },
            });
          }
        }
      }

      return {
        success: true,
        entityType: 'series',
        entityId: args.seriesId,
        action: result.created ? 'created' : 'updated',
        changes: result.changes,
        relatedSyncs,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Log failure
      await ctx.runMutation(internal.tvdb.syncer.mutations.updateSyncState, {
        entityType: 'series',
        entityId: args.seriesId,
        status: 'failed',
        errorMessage,
      });

      return {
        success: false,
        entityType: 'series',
        entityId: args.seriesId,
        action: 'failed',
        error: errorMessage,
      };
    }
  },
});

export const syncEpisode = internalAction({
  args: {
    episodeId: v.string(),
    options: v.optional(
      v.object({
        force: v.optional(v.boolean()),
        shallow: v.optional(v.boolean()),
        priority: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args): Promise<SyncResult> => {
    const client = new TVDBClient();

    const apiKey = await ctx.runQuery(internal.tvdb.syncer.queries.getConfig, {
      key: 'api_key',
    });

    if (!apiKey) {
      throw new Error('TVDB API key not configured');
    }

    await client.login({ apikey: apiKey as string });

    try {
      // Check if we should sync
      if (!args.options?.force) {
        const shouldSync = await ctx.runQuery(internal.tvdb.syncer.queries.shouldSyncEntity, {
          entityType: 'episode',
          entityId: args.episodeId,
        });

        if (!shouldSync) {
          return {
            success: true,
            entityType: 'episode',
            entityId: args.episodeId,
            action: 'skipped',
          };
        }
      }

      // Fetch episode data
      const episodeData = await client.getEpisodeExtended(parseInt(args.episodeId), 'translations');

      // Store raw data
      await ctx.runMutation(internal.tvdb.syncer.mutations.storeRawData, {
        tvdbId: args.episodeId,
        entityType: 'episode',
        data: JSON.stringify(episodeData.data),
        version: 1,
      });

      // Upsert episode data
      const result = await ctx.runMutation(internal.tvdb.syncer.mutations.upsertEpisode, {
        tvdbData: episodeData.data,
        tvdbId: args.episodeId,
      });

      return {
        success: true,
        entityType: 'episode',
        entityId: args.episodeId,
        action: result.created ? 'created' : 'updated',
        changes: result.changes,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await ctx.runMutation(internal.tvdb.syncer.mutations.updateSyncState, {
        entityType: 'episode',
        entityId: args.episodeId,
        status: 'failed',
        errorMessage,
      });

      return {
        success: false,
        entityType: 'episode',
        entityId: args.episodeId,
        action: 'failed',
        error: errorMessage,
      };
    }
  },
});

export const syncSeason = internalAction({
  args: {
    seasonId: v.string(),
    options: v.optional(
      v.object({
        force: v.optional(v.boolean()),
        shallow: v.optional(v.boolean()),
        priority: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args): Promise<SyncResult> => {
    const client = new TVDBClient();

    const apiKey = await ctx.runQuery(internal.tvdb.syncer.queries.getConfig, {
      key: 'api_key',
    });

    if (!apiKey) {
      throw new Error('TVDB API key not configured');
    }

    await client.login({ apikey: apiKey as string });

    try {
      // Fetch season data
      const seasonData = await client.getSeasonExtended(parseInt(args.seasonId));

      // Store raw data
      await ctx.runMutation(internal.tvdb.syncer.mutations.storeRawData, {
        tvdbId: args.seasonId,
        entityType: 'season',
        data: JSON.stringify(seasonData.data),
        version: 1,
      });

      // Upsert season
      const result = await ctx.runMutation(internal.tvdb.syncer.mutations.upsertSeason, {
        tvdbData: seasonData.data,
        tvdbId: args.seasonId,
      });

      // Queue episodes if not shallow
      if (!args.options?.shallow && seasonData.data.episodes) {
        for (const episode of seasonData.data.episodes) {
          if (episode.id) {
            await ctx.runMutation(internal.tvdb.syncer.workpool.enqueueSyncEntity, {
              entityType: 'episode',
              entityId: episode.id.toString(),
              priority: (args.options?.priority ?? 5) + 1,
              metadata: {
                parentId: args.seasonId,
                seasonNumber: episode.seasonNumber,
                episodeNumber: episode.number,
              },
            });
          }
        }
      }

      return {
        success: true,
        entityType: 'season',
        entityId: args.seasonId,
        action: result.created ? 'created' : 'updated',
        changes: result.changes,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await ctx.runMutation(internal.tvdb.syncer.mutations.updateSyncState, {
        entityType: 'season',
        entityId: args.seasonId,
        status: 'failed',
        errorMessage,
      });

      return {
        success: false,
        entityType: 'season',
        entityId: args.seasonId,
        action: 'failed',
        error: errorMessage,
      };
    }
  },
});

// ============================================================================
// Batch Sync Actions
// ============================================================================

export const syncUpdates = internalAction({
  args: {
    since: v.number(), // Unix timestamp
    entityType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const client = new TVDBClient();

    const apiKey = await ctx.runQuery(internal.tvdb.syncer.queries.getConfig, {
      key: 'api_key',
    });

    if (!apiKey) {
      throw new Error('TVDB API key not configured');
    }

    await client.login({ apikey: apiKey as string });

    // Get updates from TVDB
    const updates = await client.getUpdates({
      since: args.since,
      type: args.entityType,
      action: 'update',
    });

    const results = [];

    // Queue all updates
    for (const update of updates.data) {
      if (update.entityType && update.recordId) {
        const entityType = mapTVDBEntityType(update.entityType);
        if (entityType) {
          await ctx.runMutation(internal.tvdb.syncer.workpool.enqueueSyncEntity, {
            entityType,
            entityId: update.recordId.toString(),
            priority: 3, // Medium priority for updates
            metadata: {
              source: 'webhook',
            },
          });

          results.push({
            entityType,
            entityId: update.recordId.toString(),
            queued: true,
          });
        }
      }
    }

    // Update last sync time
    await ctx.runMutation(internal.tvdb.syncer.mutations.updateConfig, {
      key: 'last_full_sync',
      value: Date.now(),
    });

    return {
      processed: results.length,
      results,
    };
  },
});

// ============================================================================
// Process Queue Action - DEPRECATED
// ============================================================================
// The workpool component handles its own processing automatically
// This action is no longer needed as the workpool manages parallelism and retries

// ============================================================================
// Helper Functions
// ============================================================================

function mapTVDBEntityType(
  tvdbType: string
): 'series' | 'season' | 'episode' | 'movie' | 'person' | 'company' | null {
  const mapping: Record<string, 'series' | 'season' | 'episode' | 'movie' | 'person' | 'company'> =
    {
      series: 'series',
      season: 'season',
      episode: 'episode',
      movie: 'movie',
      people: 'person',
      company: 'company',
    };

  return mapping[tvdbType] || null;
}
