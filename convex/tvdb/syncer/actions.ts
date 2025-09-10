import { action, internalAction } from '../../_generated/server';
import { internal } from '../../_generated/api';
import { v } from 'convex/values';
import { getAuthenticatedClient } from './client';
import type { SyncChanges, SyncResult } from './types';
import type {
  SeriesExtendedRecord,
  SeasonExtendedRecord,
  EpisodeExtendedRecord,
  SeasonTypeEnum,
} from '../client/api';
import { RegisteredAction } from 'convex/server';

// ============================================================================
// New Optimized Sync Actions
// ============================================================================

export const syncSeriesDeep = internalAction({
  args: {
    seriesId: v.string(),
    options: v.optional(
      v.object({
        force: v.optional(v.boolean()),
        syncTTLHours: v.optional(v.number()),
        maxConcurrentSeasons: v.optional(v.number()),
        maxEpisodesPerSeason: v.optional(v.number()),
      })
    ),
  },
  returns: v.object({
    success: v.boolean(),
    seriesId: v.optional(v.id('shows')),
    stats: v.object({
      seasons: v.number(),
      episodes: v.number(),
      created: v.object({
        series: v.boolean(),
        seasons: v.number(),
        episodes: v.number(),
      }),
      updated: v.object({
        series: v.boolean(),
        seasons: v.number(),
        episodes: v.number(),
      }),
      apiCalls: v.number(),
      duration: v.number(),
    }),
    error: v.optional(v.string()),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    stats: {
      seasons: number;
      episodes: number;
      created: { series: boolean; seasons: number; episodes: number };
      updated: { series: boolean; seasons: number; episodes: number };
      apiCalls: number;
      duration: number;
    };
    error?: string;
  }> => {
    const startTime = Date.now();
    const seriesIdStr = args.seriesId;
    const syncTTLHours = args.options?.syncTTLHours ?? 24;
    const maxConcurrentSeasons = args.options?.maxConcurrentSeasons ?? 5;
    const maxEpisodesPerSeason = args.options?.maxEpisodesPerSeason ?? 500;
    let apiCalls = 0;

    try {
      // Check if we should sync (TTL-based)
      if (!args.options?.force) {
        const syncState = await ctx.runQuery(internal.tvdb.syncer.queries.getSyncState, {
          entityType: 'series',
          entityId: seriesIdStr,
        });

        if (syncState) {
          const hoursSinceSync = (Date.now() - syncState.lastSyncedAt) / (1000 * 60 * 60);
          if (hoursSinceSync < syncTTLHours) {
            console.log(
              `[SyncDeep] Skipping series ${seriesIdStr} - synced ${hoursSinceSync.toFixed(1)}h ago (TTL: ${syncTTLHours}h)`
            );
            return {
              success: true,
              stats: {
                seasons: 0,
                episodes: 0,
                created: { series: false, seasons: 0, episodes: 0 },
                updated: { series: false, seasons: 0, episodes: 0 },
                apiCalls: 0,
                duration: Date.now() - startTime,
              },
            };
          }
        }
      }

      // Create or update sync job
      await ctx.runMutation(internal.tvdb.syncer.internalMutations.upsertSyncJob, {
        entityType: 'series',
        entityId: seriesIdStr,
        status: 'running',
        startedAt: Date.now(),
      });

      // Get authenticated client
      const client = await getAuthenticatedClient(ctx);

      const seriesResponse = await client.getSeriesExtended(parseInt(seriesIdStr), {
        meta: 'translations',
      });
      apiCalls++;

      const seriesData = seriesResponse.data;
      if (!seriesData) {
        throw new Error('No series data returned from TVDB');
      }

      // 2. Fetch all seasons in parallel (with concurrency limit)
      const seasonIds = seriesData.seasons?.map((s) => s.id).filter(Boolean) || [];
      const seasonsData: SeasonExtendedRecord[] = [];

      console.log(
        `[SyncDeep] Fetching ${seasonIds.length} seasons with concurrency limit ${maxConcurrentSeasons}`
      );

      // Process seasons in batches
      for (let i = 0; i < seasonIds.length; i += maxConcurrentSeasons) {
        const batch = seasonIds.slice(i, i + maxConcurrentSeasons);
        const seasonPromises = batch.map(async (seasonId) => {
          try {
            const seasonResponse = await client.getSeasonExtended(seasonId!);
            apiCalls++;
            return seasonResponse.data;
          } catch (error) {
            console.error(`[SyncDeep] Failed to fetch season ${seasonId}:`, error);
            return null;
          }
        });

        const batchResults = await Promise.all(seasonPromises);
        seasonsData.push(...(batchResults.filter(Boolean) as SeasonExtendedRecord[]));

        // Small delay between batches to avoid rate limiting
        if (i + maxConcurrentSeasons < seasonIds.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      // 3. Fetch episodes for each season using the bulk episode endpoints
      const episodesBySeason: Record<string, EpisodeExtendedRecord[]> = {};

      console.log(`[SyncDeep] Fetching episodes for ${seasonsData.length} seasons`);

      for (const season of seasonsData) {
        const seasonIdStr = season.id?.toString() || '';
        if (!seasonIdStr) continue;

        const seasonType = (season.type?.type || 'official') as SeasonTypeEnum;
        const episodes: EpisodeExtendedRecord[] = [];

        try {
          // Fetch all episodes for this season, page by page
          let page = 0;

          while (episodes.length < maxEpisodesPerSeason) {
            try {
              const episodesResponse = await client.getSeriesSeasonEpisodesTranslated(
                parseInt(seriesIdStr),
                seasonType,
                'eng', // Default to English
                page
              );
              apiCalls++;

              const episodeList = episodesResponse.data?.episodes || [];

              // Stop if we got no episodes (end of pagination)
              if (episodeList.length === 0) {
                break;
              }

              // Convert base episodes to extended format with translations
              const extendedEpisodes = episodeList.map(
                (ep) =>
                  ({
                    ...ep,
                    seriesId: parseInt(seriesIdStr),
                    seasonNumber: season.number,
                    translations: {
                      nameTranslations: ep.nameTranslations,
                      overviewTranslations: ep.overviewTranslations,
                    },
                  }) as EpisodeExtendedRecord
              );

              episodes.push(...extendedEpisodes);
              page++;

              // If the response has links.next info, use it (if available in future)
              // For now, we rely on empty response to indicate no more pages
            } catch (error) {
              console.warn(
                `[SyncDeep] Failed to fetch episodes page ${page} for season ${seasonIdStr}:`,
                error
              );
              break; // Stop pagination on error
            }
          }

          if (episodes.length > 0) {
            episodesBySeason[seasonIdStr] = episodes;
          }
        } catch (error) {
          console.error(`[SyncDeep] Failed to fetch episodes for season ${seasonIdStr}:`, error);
        }
      }

      // 4. Bulk upsert everything in a single mutation
      console.log(`[SyncDeep] Bulk upserting series, ${seasonsData.length} seasons, and episodes`);

      const result = await ctx.runMutation(
        internal.tvdb.syncer.internalMutations.bulkUpsertSeriesBundle,
        {
          series: seriesData,
          seasons: seasonsData,
          episodesBySeason,
          syncTTLHours,
        }
      );

      // Update sync job as completed
      await ctx.runMutation(internal.tvdb.syncer.internalMutations.updateSyncJob, {
        entityType: 'series',
        entityId: seriesIdStr,
        status: 'completed',
        completedAt: Date.now(),
        metadata: {
          stats: {
            seasons: result.seasonIds.length,
            episodes: result.episodeCount,
            created: result.created,
            updated: result.updated,
            apiCalls,
            duration: Date.now() - startTime,
          },
        },
      });

      const duration = Date.now() - startTime;
      console.log(
        `[SyncDeep] Completed series ${seriesIdStr} in ${duration}ms: ` +
          `${result.seasonIds.length} seasons, ${result.episodeCount} episodes, ` +
          `${apiCalls} API calls`
      );

      return {
        success: true,
        stats: {
          seasons: result.seasonIds.length,
          episodes: result.episodeCount,
          created: result.created,
          updated: result.updated,
          apiCalls,
          duration,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Update sync job as failed
      await ctx.runMutation(internal.tvdb.syncer.internalMutations.updateSyncJob, {
        entityType: 'series',
        entityId: seriesIdStr,
        status: 'failed',
        completedAt: Date.now(),
        error: errorMessage,
      });

      console.error(`[SyncDeep] Failed to sync series ${seriesIdStr}:`, error);

      return {
        success: false,
        stats: {
          seasons: 0,
          episodes: 0,
          created: { series: false, seasons: 0, episodes: 0 },
          updated: { series: false, seasons: 0, episodes: 0 },
          apiCalls,
          duration: Date.now() - startTime,
        },
        error: errorMessage,
      };
    }
  },
});

// ============================================================================
// Main Sync Actions (Legacy - will be deprecated)
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

      const relatedSyncs: SyncResult[] = [];
      if (!args.options?.shallow && seriesData.data.seasons) {
        for (const season of seriesData.data.seasons) {
          const seasonId = season.id?.toString();
          if (seasonId) {
            const shouldSyncSeason =
              args.options?.force ||
              (await ctx.runQuery(internal.tvdb.syncer.queries.shouldSyncEntity, {
                entityType: 'season',
                entityId: seasonId,
              }));

            if (shouldSyncSeason) {
              await ctx.scheduler.runAfter(0, internal.tvdb.syncer.actions.syncSeason, {
                seasonId,
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
      return {
        success: false,
        entityType: 'series',
        entityId: args.seriesId,
        action: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
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
      return {
        success: false,
        entityType: 'episode',
        entityId: args.episodeId,
        action: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
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
          const episodeId = episode?.id?.toString();
          if (episodeId) {
            // Check if episode needs syncing
            const shouldSyncEpisode =
              args.options?.force ||
              (await ctx.runQuery(internal.tvdb.syncer.queries.shouldSyncEntity, {
                entityType: 'episode',
                entityId: episodeId,
              }));

            if (shouldSyncEpisode) {
              // Episode needs syncing, queue it
              await ctx.scheduler.runAfter(0, internal.tvdb.syncer.actions.syncEpisode, {
                episodeId,
              });

              console.log(
                `[Sync] Syncing episode: ${episode.id} - S${episode.seasonNumber}E${episode.number}`
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
      return {
        success: false,
        entityType: 'season',
        entityId: args.seasonId,
        action: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

// ============================================================================
// Batch Sync Actions
// ============================================================================

// export const syncUpdates = internalAction({
//   args: {
//     since: v.number(), // Unix timestamp
//     entityType: v.optional(v.string()),
//   },
//   handler: async (ctx, args) => {
//     // Get authenticated client (reuses existing token)
//     const client = await getAuthenticatedClient(ctx);

//     const results = [];
//     let currentPage = 0;
//     let hasMore = true;
//     const sinceSec = Math.floor(args.since / 1000); // Convert ms to seconds

//     // Process all pages of updates
//     while (hasMore) {
//       // Get updates from TVDB (TVDB expects UNIX seconds)
//       const updates = await client
//         .getUpdates({
//           since: sinceSec,
//           type: args.entityType,
//           action: 'update',
//           page: currentPage,
//         })
//         .catch((err) => {
//           console.error('Error fetching updates:', err);
//           throw err;
//         });

//       // Queue all updates from this page
//       for (const update of updates.data) {
//         if (update.entityType && update.recordId) {
//           const entityType = mapTVDBEntityType(update.entityType);
//           if (entityType) {
//             await ctx.runMutation(internal.tvdb.syncer.workpool.enqueueSyncEntity, {
//               entityType,
//               entityId: update.recordId.toString(),
//               priority: 3, // Medium priority for updates
//               metadata: {
//                 source: 'webhook',
//               },
//             });

//             results.push({
//               entityType,
//               entityId: update.recordId.toString(),
//               queued: true,
//             });
//           }
//         }
//       }

//       // Check if there are more pages
//       const next = updates.links?.next;
//       hasMore = !!(next && next !== '');

//       if (hasMore) {
//         currentPage = parseInt(next!, 10);
//         // Small delay between pages to avoid hammering the API
//         await new Promise((resolve) => setTimeout(resolve, 100));
//       }
//     }

//     // Update last incremental sync time (not full sync)
//     await ctx.runMutation(internal.tvdb.syncer.internalMutations.updateConfig, {
//       key: 'last_incremental_sync',
//       value: Date.now(),
//     });

//     return {
//       processed: results.length,
//       results,
//     };
//   },
// });

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
