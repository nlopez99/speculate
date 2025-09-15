"use node";

import { internalAction, internalQuery } from "../../_generated/server";
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
    const blobIndex = await ctx.runQuery(
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
    const fullData = await ctx.runAction(
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
    const blobIndex = await ctx.runQuery(
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
    const fullData = await ctx.runAction(
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
    const blobIndex = await ctx.runQuery(
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
    const episodePack = await ctx.runAction(
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
    const episodes = await ctx.runAction(
      internal.tvdb.syncer.coldDataRetrieval.getFullEpisodeData,
      {
        seasonTvdbId: args.seasonTvdbId,
      }
    );

    // Find the specific episode
    const episode = episodes.find(
      (ep: any) => String(ep.id) === args.episodeTvdbId
    );

    return episode || null;
  },
});

/**
 * Check if cold data exists for an entity
 */
export const hasColdData = internalQuery({
  args: {
    tvdbType: v.union(v.literal('series'), v.literal('season'), v.literal('episode_pack')),
    tvdbId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const blobIndex = await ctx.db
      .query('tvdbRawBlobIndex')
      .withIndex('type_id', q =>
        q.eq('tvdbType', args.tvdbType).eq('tvdbId', args.tvdbId)
      )
      .first();

    return blobIndex !== null;
  },
});