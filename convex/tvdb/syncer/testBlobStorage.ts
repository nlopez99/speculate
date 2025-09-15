import { internalAction } from "../../_generated/server";
import { v } from "convex/values";
import { internal } from "../../_generated/api";

/**
 * Test the blob storage implementation with a small series
 */
export const testBlobStorage = internalAction({
  args: {
    seriesId: v.optional(v.string()), // Default to a small series if not provided
  },
  returns: v.object({
    success: v.boolean(),
    results: v.object({
      syncResult: v.any(),
      storageStats: v.any(),
      coldDataTest: v.object({
        seriesRetrieved: v.boolean(),
        seasonRetrieved: v.boolean(),
        episodesRetrieved: v.boolean(),
      }),
    }),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    try {
      // Use a small series for testing (e.g., a show with only 1-2 seasons)
      const testSeriesId = args.seriesId || "296295"; // Example: "Fargo" Season 1 has ~10 episodes

      console.log(`[TestBlobStorage] Starting test with series ${testSeriesId}`);

      // 1. Run the sync to populate both hot and cold data
      const syncResult = await ctx.runAction(
        internal.tvdb.syncer.actions.syncSeriesDeep,
        {
          seriesId: testSeriesId,
          options: {
            force: true, // Force sync even if recently synced
            maxConcurrentSeasons: 2,
            maxEpisodesPerSeason: 50,
          },
        }
      );

      if (!syncResult.success) {
        throw new Error(`Sync failed: ${syncResult.error}`);
      }

      console.log(`[TestBlobStorage] Sync completed:`, syncResult.stats);

      // 2. Get storage statistics
      const storageStats = await ctx.runQuery(
        internal.tvdb.syncer.blobStorageQueries.getStorageStats,
        {}
      );

      console.log(`[TestBlobStorage] Storage stats:`, storageStats);

      // 3. Test retrieving cold data
      const coldDataTest = {
        seriesRetrieved: false,
        seasonRetrieved: false,
        episodesRetrieved: false,
      };

      try {
        // Test series retrieval
        const fullSeriesData = await ctx.runAction(
          internal.tvdb.syncer.coldDataRetrieval.getFullSeriesData,
          { tvdbId: testSeriesId }
        );
        coldDataTest.seriesRetrieved = !!fullSeriesData && !!fullSeriesData.name;
        console.log(`[TestBlobStorage] Retrieved series: ${fullSeriesData?.name}`);

        // Test season retrieval (if we have seasons)
        if (fullSeriesData?.seasons && fullSeriesData.seasons.length > 0) {
          const firstSeasonId = String(fullSeriesData.seasons[0].id);
          const fullSeasonData = await ctx.runAction(
            internal.tvdb.syncer.coldDataRetrieval.getFullSeasonData,
            { tvdbId: firstSeasonId }
          );
          coldDataTest.seasonRetrieved = !!fullSeasonData && !!fullSeasonData.number;
          console.log(`[TestBlobStorage] Retrieved season ${fullSeasonData?.number}`);

          // Test episode pack retrieval
          const episodes = await ctx.runAction(
            internal.tvdb.syncer.coldDataRetrieval.getFullEpisodeData,
            { seasonTvdbId: firstSeasonId }
          );
          coldDataTest.episodesRetrieved = Array.isArray(episodes) && episodes.length > 0;
          console.log(`[TestBlobStorage] Retrieved ${episodes?.length} episodes`);
        }
      } catch (error) {
        console.error(`[TestBlobStorage] Error retrieving cold data:`, error);
      }

      return {
        success: true,
        results: {
          syncResult,
          storageStats,
          coldDataTest,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[TestBlobStorage] Test failed:`, error);

      return {
        success: false,
        results: {
          syncResult: null,
          storageStats: null,
          coldDataTest: {
            seriesRetrieved: false,
            seasonRetrieved: false,
            episodesRetrieved: false,
          },
        },
        error: errorMessage,
      };
    }
  },
});

/**
 * Compare storage efficiency before and after blob storage
 */
export const compareStorageEfficiency = internalAction({
  args: {},
  returns: v.object({
    hotDataSize: v.object({
      shows: v.number(),
      seasons: v.number(),
      episodes: v.number(),
      total: v.number(),
    }),
    coldDataSize: v.object({
      compressed: v.number(),
      uncompressed: v.number(),
      compressionRatio: v.number(),
    }),
    estimatedSavings: v.object({
      bytesStored: v.number(),
      bytesSaved: v.number(),
      percentageSaved: v.number(),
    }),
  }),
  handler: async (ctx) => {
    // Get counts from hot tables
    const showCount = await ctx.runQuery(
      internal.tvdb.syncer.queries.getEntityCount,
      { table: 'shows' }
    );
    const seasonCount = await ctx.runQuery(
      internal.tvdb.syncer.queries.getEntityCount,
      { table: 'seasons' }
    );
    const episodeCount = await ctx.runQuery(
      internal.tvdb.syncer.queries.getEntityCount,
      { table: 'episodes' }
    );

    // Estimate hot data sizes (approximate bytes per record)
    const avgShowSize = 500;   // ~500 bytes for essential fields
    const avgSeasonSize = 200;  // ~200 bytes for essential fields
    const avgEpisodeSize = 150; // ~150 bytes for essential fields

    const hotDataSize = {
      shows: showCount * avgShowSize,
      seasons: seasonCount * avgSeasonSize,
      episodes: episodeCount * avgEpisodeSize,
      total: (showCount * avgShowSize) + (seasonCount * avgSeasonSize) + (episodeCount * avgEpisodeSize),
    };

    // Get cold data statistics
    const storageStats = await ctx.runQuery(
      internal.tvdb.syncer.blobStorage.getStorageStats,
      {}
    );

    const coldDataSize = {
      compressed: storageStats.totalCompressedSize,
      uncompressed: storageStats.totalUncompressedSize,
      compressionRatio: storageStats.averageCompressionRatio,
    };

    // Calculate estimated savings
    const totalStored = hotDataSize.total + coldDataSize.compressed;
    const wouldBeStored = coldDataSize.uncompressed; // If we stored everything uncompressed in documents
    const saved = wouldBeStored - totalStored;

    const estimatedSavings = {
      bytesStored: totalStored,
      bytesSaved: saved,
      percentageSaved: Math.round((saved / wouldBeStored) * 100),
    };

    console.log(`[CompareStorage] Hot data: ${(hotDataSize.total / 1024 / 1024).toFixed(2)} MB`);
    console.log(`[CompareStorage] Cold data (compressed): ${(coldDataSize.compressed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`[CompareStorage] Cold data (uncompressed): ${(coldDataSize.uncompressed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`[CompareStorage] Compression ratio: ${coldDataSize.compressionRatio}%`);
    console.log(`[CompareStorage] Total savings: ${estimatedSavings.percentageSaved}% (${(saved / 1024 / 1024).toFixed(2)} MB)`);

    return {
      hotDataSize,
      coldDataSize,
      estimatedSavings,
    };
  },
});