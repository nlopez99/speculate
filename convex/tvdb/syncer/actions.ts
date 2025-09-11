import { action, internalAction, mutation } from '../../_generated/server';
import { internal } from '../../_generated/api';
import { v } from 'convex/values';
import { getAuthenticatedClient } from './client';
import type {
  SeriesExtendedRecord,
  SeasonExtendedRecord,
  EpisodeExtendedRecord,
  SeasonTypeEnum,
} from '../client/api';

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

      // 4. Upsert data in chunks to avoid timeouts
      console.log(`[SyncDeep] Upserting series, ${seasonsData.length} seasons, and episodes`);

      // 4a. First upsert the series
      const seriesResult = await ctx.runMutation(
        internal.tvdb.syncer.internalMutations.upsertSeriesData,
        { series: seriesData }
      );

      // 4b. Then upsert all seasons
      const seasonsResult = await ctx.runMutation(
        internal.tvdb.syncer.internalMutations.upsertSeasonsData,
        {
          showId: seriesResult.seriesId,
          seasons: seasonsData,
        }
      );

      // 4c. Upsert episodes for each season in chunks
      const stats = {
        episodes: 0,
        created: {
          series: seriesResult.created,
          seasons: seasonsResult.created,
          episodes: 0,
        },
        updated: {
          series: seriesResult.updated,
          seasons: seasonsResult.updated,
          episodes: 0,
        },
      };

      // Create a mapping of season TVDB IDs to season Convex IDs
      const seasonIdMap = new Map(
        seasonsResult.seasonIdMapping.map((mapping) => [mapping.tvdbId, mapping.convexId])
      );

      // Process episodes season by season to avoid overwhelming a single mutation
      const EPISODES_PER_BATCH = 50; // Process 50 episodes at a time

      for (const [seasonTvdbId, episodes] of Object.entries(episodesBySeason)) {
        const seasonId = seasonIdMap.get(seasonTvdbId);
        if (!seasonId) {
          console.warn(`[SyncDeep] No season ID found for TVDB season ${seasonTvdbId}`);
          continue;
        }

        const season = seasonsData.find((s) => s.id?.toString() === seasonTvdbId);
        const seasonNumber = season?.number || 0;

        // Process episodes in batches
        for (let i = 0; i < episodes.length; i += EPISODES_PER_BATCH) {
          const batch = episodes.slice(i, i + EPISODES_PER_BATCH);
          
          console.log(
            `[SyncDeep] Upserting ${batch.length} episodes for season ${seasonNumber} ` +
            `(batch ${Math.floor(i / EPISODES_PER_BATCH) + 1}/${Math.ceil(episodes.length / EPISODES_PER_BATCH)})`
          );

          const episodeResult = await ctx.runMutation(
            internal.tvdb.syncer.internalMutations.upsertSeasonEpisodes,
            {
              showId: seriesResult.seriesId,
              seasonId,
              seasonNumber,
              seasonTvdbId,
              episodes: batch,
            }
          );

          stats.episodes += episodeResult.episodeCount;
          stats.created.episodes += episodeResult.created;
          stats.updated.episodes += episodeResult.updated;
        }
      }

      // 4d. Update sync state
      await ctx.runMutation(internal.tvdb.syncer.internalMutations.updateSeriesSyncState, {
        seriesId: seriesIdStr,
        lastUpdated: seriesData.lastUpdated,
      });

      // Update sync job as completed
      await ctx.runMutation(internal.tvdb.syncer.internalMutations.updateSyncJob, {
        entityType: 'series',
        entityId: seriesIdStr,
        status: 'completed',
        completedAt: Date.now(),
        metadata: {
          stats: {
            seasons: seasonsResult.seasonIds.length,
            episodes: stats.episodes,
            created: stats.created,
            updated: stats.updated,
            apiCalls,
            duration: Date.now() - startTime,
          },
        },
      });

      const duration = Date.now() - startTime;
      console.log(
        `[SyncDeep] Completed series ${seriesIdStr} in ${duration}ms: ` +
          `${seasonsResult.seasonIds.length} seasons, ${stats.episodes} episodes, ` +
          `${apiCalls} API calls`
      );

      return {
        success: true,
        stats: {
          seasons: seasonsResult.seasonIds.length,
          episodes: stats.episodes,
          created: stats.created,
          updated: stats.updated,
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
