import { action, internalAction } from '../../_generated/server';
import { internal } from '../../_generated/api';
import { v } from 'convex/values';
import { getAuthenticatedClient } from './client';
import type { SyncChanges, SyncResult } from './types';

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
      })
    ),
  },
  handler: async (ctx, args): Promise<SyncResult> => {
    // Get authenticated client (reuses existing token)
    const client = await getAuthenticatedClient(ctx);

    try {
      let seriesAction: 'created' | 'updated' | 'skipped' = 'skipped';
      let seriesChanges: SyncChanges | undefined;

      // Check if we should sync the series itself (unless forced)
      const shouldSyncSeries =
        args.options?.force ||
        (await ctx.runQuery(internal.tvdb.syncer.queries.shouldSyncEntity, {
          entityType: 'series',
          entityId: args.seriesId,
        }));

      // Fetch series data from TVDB (needed for seasons list even if series is skipped)
      const seriesData = await client.getSeriesExtended(parseInt(args.seriesId), {
        meta: 'translations',
      });

      // Only update series if needed
      if (shouldSyncSeries) {
        // Use batched mutation to store raw data and upsert series in a single transaction
        const result = await ctx.runMutation(
          internal.tvdb.syncer.internalMutations.storeRawDataAndUpsertSeries,
          {
            tvdbData: seriesData.data,
            tvdbId: args.seriesId,
            rawData: JSON.stringify(seriesData.data),
          }
        );
        seriesAction = result.created ? 'created' : 'updated';
        seriesChanges = result.changes;
      } else {
        console.log(`[Sync] Skipping series update: ${args.seriesId} - recently synced`);
      }

      // ALWAYS check related entities if not shallow (even if series was skipped)
      const relatedSyncs: SyncResult[] = [];
      if (!args.options?.shallow && seriesData.data.seasons) {
        for (const season of seriesData.data.seasons) {
          if (season.id) {
            // Check if season needs syncing
            const shouldSyncSeason =
              args.options?.force ||
              (await ctx.runQuery(internal.tvdb.syncer.queries.shouldSyncEntity, {
                entityType: 'season',
                entityId: season.id.toString(),
              }));

            if (shouldSyncSeason) {
              // Season needs syncing, queue it
              await ctx.runMutation(internal.tvdb.syncer.workpool.enqueueSyncEntity, {
                entityType: 'season',
                entityId: season.id.toString(),
                metadata: {
                  parentId: args.seriesId,
                  seasonNumber: season.number,
                },
              });

              console.log(`[Sync] Queued season for sync: ${season.id} - Season ${season.number}`);
            } else {
              console.log(
                `[Sync] Skipping season: ${season.id} - Season ${season.number} - recently synced`
              );
            }
          }
        }
      }

      return {
        success: true,
        entityType: 'series',
        entityId: args.seriesId,
        action: seriesAction,
        changes: seriesChanges,
        relatedSyncs,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Log failure
      await ctx.runMutation(internal.tvdb.syncer.internalMutations.updateSyncState, {
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
    // Get authenticated client (reuses existing token)
    const client = await getAuthenticatedClient(ctx);

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

      // Use batched mutation to store raw data and upsert episode in a single transaction
      const result = await ctx.runMutation(
        internal.tvdb.syncer.internalMutations.storeRawDataAndUpsertEpisode,
        {
          tvdbData: episodeData.data,
          tvdbId: args.episodeId,
          rawData: JSON.stringify(episodeData.data),
        }
      );

      return {
        success: true,
        entityType: 'episode',
        entityId: args.episodeId,
        action: result.created ? 'created' : 'updated',
        changes: result.changes,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await ctx.runMutation(internal.tvdb.syncer.internalMutations.updateSyncState, {
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
    // Get authenticated client (reuses existing token)
    const client = await getAuthenticatedClient(ctx);

    try {
      let seasonAction: 'created' | 'updated' | 'skipped' = 'skipped';
      let seasonChanges: SyncChanges | undefined;

      // Check if we should sync the season itself (unless forced)
      const shouldSyncSeason =
        args.options?.force ||
        (await ctx.runQuery(internal.tvdb.syncer.queries.shouldSyncEntity, {
          entityType: 'season',
          entityId: args.seasonId,
        }));

      // Fetch season data (needed for episodes list even if season is skipped)
      const seasonData = await client.getSeasonExtended(parseInt(args.seasonId));

      // Only update season if needed
      if (shouldSyncSeason) {
        // Store raw data
        await ctx.runMutation(internal.tvdb.syncer.internalMutations.storeRawData, {
          tvdbId: args.seasonId,
          entityType: 'season',
          data: JSON.stringify(seasonData.data),
        });

        // Upsert season
        const result = await ctx.runMutation(internal.tvdb.syncer.internalMutations.upsertSeason, {
          tvdbData: seasonData.data,
          tvdbId: args.seasonId,
        });
        seasonAction = result.created ? 'created' : 'updated';
        seasonChanges = result.changes;
      } else {
        console.log(`[Sync] Skipping season update: ${args.seasonId} - recently synced`);
      }

      // ALWAYS check episodes if not shallow (even if season was skipped)
      if (!args.options?.shallow && seasonData.data.episodes) {
        for (const episode of seasonData.data.episodes) {
          if (episode.id) {
            // Check if episode needs syncing
            const shouldSyncEpisode =
              args.options?.force ||
              (await ctx.runQuery(internal.tvdb.syncer.queries.shouldSyncEntity, {
                entityType: 'episode',
                entityId: episode.id.toString(),
              }));

            if (shouldSyncEpisode) {
              // Episode needs syncing, queue it
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
              console.log(
                `[Sync] Queued episode for sync: ${episode.id} - S${episode.seasonNumber}E${episode.number}`
              );
            } else {
              console.log(
                `[Sync] Skipping episode: ${episode.id} - S${episode.seasonNumber}E${episode.number} - recently synced`
              );
            }
          }
        }
      }

      return {
        success: true,
        entityType: 'season',
        entityId: args.seasonId,
        action: seasonAction,
        changes: seasonChanges,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await ctx.runMutation(internal.tvdb.syncer.internalMutations.updateSyncState, {
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
    // Get authenticated client (reuses existing token)
    const client = await getAuthenticatedClient(ctx);

    const results = [];
    let currentPage = 0;
    let hasMore = true;
    const sinceSec = Math.floor(args.since / 1000); // Convert ms to seconds

    // Process all pages of updates
    while (hasMore) {
      // Get updates from TVDB (TVDB expects UNIX seconds)
      const updates = await client
        .getUpdates({
          since: sinceSec,
          type: args.entityType,
          action: 'update',
          page: currentPage,
        })
        .catch((err) => {
          console.error('Error fetching updates:', err);
          throw err;
        });

      // Queue all updates from this page
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

      // Check if there are more pages
      const next = updates.links?.next;
      hasMore = !!(next && next !== '');

      if (hasMore) {
        currentPage = parseInt(next!, 10);
        // Small delay between pages to avoid hammering the API
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // Update last incremental sync time (not full sync)
    await ctx.runMutation(internal.tvdb.syncer.internalMutations.updateConfig, {
      key: 'last_incremental_sync',
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
