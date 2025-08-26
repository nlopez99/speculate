import { v } from 'convex/values';
import { mutation, internalMutation } from '../_generated/server';
import { Id } from '../_generated/dataModel';

/**
 * Create or update show from external data (TMDB/IMDB)
 */
export const upsertShow = internalMutation({
  args: {
    tmdbId: v.string(),
    title: v.string(),
    slug: v.string(),
    overview: v.optional(v.string()),
    posterUrl: v.optional(v.string()),
    backdropUrl: v.optional(v.string()),
    firstAirYear: v.optional(v.number()),
    status: v.union(
      v.literal('running'),
      v.literal('ended'),
      v.literal('hiatus'),
      v.literal('unknown')
    ),
    imdbId: v.optional(v.string()),
    tvdbId: v.optional(v.string()),
    network: v.optional(v.string()),
    genres: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if exists
    const existing = await ctx.db
      .query('shows')
      .withIndex('tmdbId', (q) => q.eq('tmdbId', args.tmdbId))
      .first();

    if (existing) {
      // Update
      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: now,
      });
      return existing._id;
    } else {
      // Create
      const showId = await ctx.db.insert('shows', {
        ...args,
        followersCount: 0,
        predictionsCount: 0,
        createdAt: now,
        updatedAt: now,
      });
      return showId;
    }
  },
});

/**
 * Import seasons and episodes from external API
 */
export const importShowContent = internalMutation({
  args: {
    showId: v.id('shows'),
    seasons: v.array(
      v.object({
        seasonNumber: v.number(),
        title: v.optional(v.string()),
        tmdbId: v.optional(v.string()),
        posterUrl: v.optional(v.string()),
        episodeCount: v.optional(v.number()),
        episodes: v.array(
          v.object({
            seasonNumber: v.number(),
            episodeNumber: v.number(),
            title: v.string(),
            overview: v.optional(v.string()),
            airDateUtc: v.optional(v.number()),
            runtimeMinutes: v.optional(v.number()),
            tmdbId: v.optional(v.string()),
            imdbId: v.optional(v.string()),
            stillUrl: v.optional(v.string()),
          })
        ),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    for (const seasonData of args.seasons) {
      // Check if season exists
      let season = await ctx.db
        .query('seasons')
        .withIndex('show_seasonNumber', (q) =>
          q.eq('showId', args.showId).eq('seasonNumber', seasonData.seasonNumber)
        )
        .first();

      if (!season) {
        // Create season
        const seasonId = await ctx.db.insert('seasons', {
          showId: args.showId,
          seasonNumber: seasonData.seasonNumber,
          title: seasonData.title,
          tmdbId: seasonData.tmdbId,
          posterUrl: seasonData.posterUrl,
          episodeCount: seasonData.episodeCount,
          createdAt: now,
          updatedAt: now,
        });

        season = await ctx.db.get(seasonId);
      }

      // Import episodes
      for (const episodeData of seasonData.episodes) {
        const existing = await ctx.db
          .query('episodes')
          .withIndex('show_season_episode', (q) =>
            q
              .eq('showId', args.showId)
              .eq('seasonNumber', episodeData.seasonNumber)
              .eq('episodeNumber', episodeData.episodeNumber)
          )
          .first();

        if (!existing) {
          await ctx.db.insert('episodes', {
            showId: args.showId,
            seasonId: season?._id as Id<'seasons'>,
            ...episodeData,
            hasAired: episodeData.airDateUtc ? episodeData.airDateUtc < now : false,
            createdAt: now,
            updatedAt: now,
          });
        } else {
          // Update if air date changed
          await ctx.db.patch(existing._id, {
            ...episodeData,
            hasAired: episodeData.airDateUtc ? episodeData.airDateUtc < now : false,
            updatedAt: now,
          });
        }
      }
    }

    return { success: true };
  },
});

/**
 * Import show from watchlist service
 */
export const importFromWatchlist = mutation({
  args: {
    provider: v.union(v.literal('trakt'), v.literal('tmdb')),
    externalId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    const userId = identity.subject as Id<'users'>;
    const now = Date.now();

    // Create import record
    const importId = await ctx.db.insert('watchlistImports', {
      userId,
      provider: args.provider,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });

    // TODO: Trigger external API fetch
    // This would typically call your backend service to fetch from TMDB/Trakt
    // and then call upsertShow and importShowContent

    // For now, mark as success
    await ctx.db.patch(importId, {
      status: 'success',
      importedShowCount: 1,
      updatedAt: now,
    });

    return { success: true, importId };
  },
});

/**
 * Update show stats (internal)
 */
export const updateShowStats = internalMutation({
  args: {
    showId: v.id('shows'),
    incrementFollowers: v.optional(v.number()),
    incrementPredictions: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const show = await ctx.db.get(args.showId);
    if (!show) return;

    const updates: any = {
      updatedAt: Date.now(),
    };

    if (args.incrementFollowers) {
      updates.followersCount = Math.max(0, (show.followersCount || 0) + args.incrementFollowers);
    }

    if (args.incrementPredictions) {
      updates.predictionsCount = Math.max(
        0,
        (show.predictionsCount || 0) + args.incrementPredictions
      );
    }

    await ctx.db.patch(args.showId, updates);
  },
});

/**
 * Mark episodes as aired (cron job)
 */
export const markEpisodesAsAired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Find episodes that should be marked as aired
    const unaired = await ctx.db
      .query('episodes')
      .withIndex('airDateUtc')
      .filter((q) => q.and(q.lte(q.field('airDateUtc'), now), q.eq(q.field('hasAired'), false)))
      .collect();

    // Update them
    for (const episode of unaired) {
      await ctx.db.patch(episode._id, {
        hasAired: true,
        updatedAt: now,
      });

      // Lock predictions for this episode
      const predictions = await ctx.db
        .query('predictions')
        .withIndex('episodeId', (q) => q.eq('episodeId', episode._id))
        .filter((q) => q.eq(q.field('state'), 'open'))
        .collect();

      for (const prediction of predictions) {
        if (prediction.lockAt <= now) {
          await ctx.db.patch(prediction._id, {
            state: 'locked',
            updatedAt: now,
          });
        }
      }
    }

    return { updated: unaired.length };
  },
});
