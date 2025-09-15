"use node";

import { internalAction } from "../../_generated/server";
import { v } from "convex/values";
import { internal } from "../../_generated/api";

/**
 * Retrieve complete series data from cold storage
 */
export const getFullSeriesData = internalAction({
  args: {
    tvdbId: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    // Find the blob index entry
    const blobIndex: any = await ctx.runQuery(
      internal.tvdb.syncer.blobStorageQueries.findBlobByTypeAndId,
      {
        tvdbType: 'series',
        tvdbId: args.tvdbId,
      }
    );

    if (!blobIndex) {
      throw new Error(`No cold data found for series ${args.tvdbId}`);
    }

    // Retrieve and decompress the blob
    const fullData: any = await ctx.runAction(
      internal.tvdb.syncer.blobStorage.getDecompressedBlob,
      {
        storageId: blobIndex.storageId,
      }
    );

    return fullData;
  },
});

/**
 * Retrieve complete season data from cold storage
 */
export const getFullSeasonData = internalAction({
  args: {
    tvdbId: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    // Find the blob index entry
    const blobIndex: any = await ctx.runQuery(
      internal.tvdb.syncer.blobStorageQueries.findBlobByTypeAndId,
      {
        tvdbType: 'season',
        tvdbId: args.tvdbId,
      }
    );

    if (!blobIndex) {
      throw new Error(`No cold data found for season ${args.tvdbId}`);
    }

    // Retrieve and decompress the blob
    const fullData: any = await ctx.runAction(
      internal.tvdb.syncer.blobStorage.getDecompressedBlob,
      {
        storageId: blobIndex.storageId,
      }
    );

    return fullData;
  },
});

/**
 * Retrieve complete episode data for a season from cold storage
 */
export const getFullEpisodeData = internalAction({
  args: {
    seasonTvdbId: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    // Find the episode pack blob for this season
    const blobIndex: any = await ctx.runQuery(
      internal.tvdb.syncer.blobStorageQueries.findBlobByTypeAndId,
      {
        tvdbType: 'episode_pack',
        tvdbId: args.seasonTvdbId,
      }
    );

    if (!blobIndex) {
      throw new Error(`No cold episode data found for season ${args.seasonTvdbId}`);
    }

    // Retrieve and decompress the blob
    const episodePack: any = await ctx.runAction(
      internal.tvdb.syncer.blobStorage.getDecompressedBlob,
      {
        storageId: blobIndex.storageId,
      }
    );

    return episodePack.episodes;
  },
});

/**
 * Get a specific episode's full data from cold storage
 */
export const getFullEpisodeById = internalAction({
  args: {
    episodeTvdbId: v.string(),
    seasonTvdbId: v.string(),
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    // Get all episodes for the season
    const episodes: any = await ctx.runAction(
      internal.tvdb.syncer.coldDataRetrieval.getFullEpisodeData,
      {
        seasonTvdbId: args.seasonTvdbId,
      }
    );

    // Find the specific episode
    const episode: any = episodes.find(
      (ep: any) => String(ep.id) === args.episodeTvdbId
    );

    return episode || null;
  },
});