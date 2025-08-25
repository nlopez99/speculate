import { v } from 'convex/values';
import { query } from '../_generated/server';
import { Id } from '../_generated/dataModel';

/**
 * Get episode details with all stats
 */
export const getEpisode = query({
  args: {
    episodeId: v.id('episodes'),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject as Id<'users'> | undefined;

    const episode = await ctx.db.get(args.episodeId);
    if (!episode) throw new Error('Episode not found');

    // Get show
    const show = await ctx.db.get(episode.showId);

    // Get season
    const season = await ctx.db.get(episode.seasonId);

    // Get stats
    const stats = await ctx.db
      .query('episodeStats')
      .withIndex('episodeId', (q) => q.eq('episodeId', args.episodeId))
      .first();

    // Check if user follows
    let isFollowing = false;
    if (userId) {
      const follow = await ctx.db
        .query('episodeFollows')
        .withIndex('user_episode', (q) => q.eq('userId', userId).eq('episodeId', args.episodeId))
        .first();
      isFollowing = !!follow;
    }

    // Get prediction count
    const predictions = await ctx.db
      .query('predictions')
      .withIndex('episodeId', (q) => q.eq('episodeId', args.episodeId))
      .collect();

    const activePredictions = predictions.filter((p) => p.state === 'open').length;

    // Calculate time until air
    let timeUntilAir = null;
    let status: 'aired' | 'airing' | 'upcoming' = 'aired';

    if (episode.airDateUtc) {
      const now = Date.now();
      const airTime = episode.airDateUtc;

      if (airTime > now) {
        status = 'upcoming';
        const msLeft = airTime - now;
        const days = Math.floor(msLeft / (1000 * 60 * 60 * 24));
        const hours = Math.floor((msLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((msLeft % (1000 * 60 * 60)) / (1000 * 60));

        if (days > 0) {
          timeUntilAir = `${days}d ${hours}h`;
        } else if (hours > 0) {
          timeUntilAir = `${hours}h ${minutes}m`;
        } else {
          timeUntilAir = `${minutes}m`;
        }
      } else if (airTime > now - 60 * 60 * 1000) {
        // Within an hour of air time
        status = 'airing';
      }
    }

    return {
      ...episode,
      showTitle: show?.title,
      showSlug: show?.slug,
      seasonTitle: season?.title,
      isFollowing,
      status,
      timeUntilAir,
      stats: {
        views: stats?.viewsCount || 0,
        comments: stats?.commentsCount || 0,
        predictions: predictions.length,
        activePredictions,
      },
    };
  },
});

/**
 * Get episodes for a show/season
 */
export const getShowEpisodes = query({
  args: {
    showId: v.id('shows'),
    seasonNumber: v.optional(v.number()),
    includeStats: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject as Id<'users'> | undefined;

    // Build query
    let episodesQuery = ctx.db
      .query('episodes')
      .withIndex('showId', (q) => q.eq('showId', args.showId));

    let episodes = await episodesQuery.collect();

    // Filter by season if specified
    if (args.seasonNumber !== undefined) {
      episodes = episodes.filter((e) => e.seasonNumber === args.seasonNumber);
    }

    // Sort by season and episode number
    episodes.sort((a, b) => {
      if (a.seasonNumber !== b.seasonNumber) {
        return a.seasonNumber - b.seasonNumber;
      }
      return a.episodeNumber - b.episodeNumber;
    });

    // Enrich with stats if requested
    if (args.includeStats) {
      const enriched = await Promise.all(
        episodes.map(async (episode) => {
          const stats = await ctx.db
            .query('episodeStats')
            .withIndex('episodeId', (q) => q.eq('episodeId', episode._id))
            .first();

          // Get prediction count
          const predictions = await ctx.db
            .query('predictions')
            .withIndex('episodeId', (q) => q.eq('episodeId', episode._id))
            .collect();

          const activePredictions = predictions.filter((p) => p.state === 'open').length;

          // Check if user follows
          let isFollowing = false;
          if (userId) {
            const follow = await ctx.db
              .query('episodeFollows')
              .withIndex('user_episode', (q) => q.eq('userId', userId).eq('episodeId', episode._id))
              .first();
            isFollowing = !!follow;
          }

          return {
            ...episode,
            isFollowing,
            stats: {
              views: stats?.viewsCount || 0,
              comments: stats?.commentsCount || 0,
              predictions: predictions.length,
              activePredictions,
            },
          };
        })
      );

      return enriched;
    }

    return episodes;
  },
});

/**
 * Get upcoming episodes across all followed shows
 */
export const getUpcomingEpisodes = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const userId = identity.subject as Id<'users'>;
    const limit = args.limit || 10;
    const now = Date.now();
    const oneWeekFromNow = now + 7 * 24 * 60 * 60 * 1000;

    // Get user's followed shows
    const followedShows = await ctx.db
      .query('showFollows')
      .withIndex('userId', (q) => q.eq('userId', userId))
      .collect();

    const showIds = followedShows.map((f) => f.showId);

    // Get upcoming episodes from followed shows
    const allEpisodes = await Promise.all(
      showIds.map(async (showId) => {
        const episodes = await ctx.db
          .query('episodes')
          .withIndex('showId', (q) => q.eq('showId', showId))
          .filter((q) =>
            q.and(q.gte(q.field('airDateUtc'), now), q.lte(q.field('airDateUtc'), oneWeekFromNow))
          )
          .collect();
        return episodes;
      })
    );

    // Flatten and sort by air date
    const episodes = allEpisodes
      .flat()
      .sort((a, b) => (a.airDateUtc || 0) - (b.airDateUtc || 0))
      .slice(0, limit);

    // Enrich with show info and stats
    const enriched = await Promise.all(
      episodes.map(async (episode) => {
        const show = await ctx.db.get(episode.showId);
        const stats = await ctx.db
          .query('episodeStats')
          .withIndex('episodeId', (q) => q.eq('episodeId', episode._id))
          .first();

        const predictions = await ctx.db
          .query('predictions')
          .withIndex('episodeId', (q) => q.eq('episodeId', episode._id))
          .filter((q) => q.eq(q.field('state'), 'open'))
          .collect();

        // Calculate time until air
        let timeUntilAir = '';
        if (episode.airDateUtc) {
          const msLeft = episode.airDateUtc - now;
          const days = Math.floor(msLeft / (1000 * 60 * 60 * 24));
          const hours = Math.floor((msLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

          if (days > 0) {
            timeUntilAir = `In ${days} day${days > 1 ? 's' : ''}`;
          } else if (hours > 0) {
            timeUntilAir = `In ${hours} hour${hours > 1 ? 's' : ''}`;
          } else {
            timeUntilAir = 'Starting soon';
          }
        }

        return {
          ...episode,
          showTitle: show?.title,
          showSlug: show?.slug,
          timeUntilAir,
          activePredictions: predictions.length,
          stats: {
            views: stats?.viewsCount || 0,
            comments: stats?.commentsCount || 0,
            predictions: predictions.length,
          },
        };
      })
    );

    return enriched;
  },
});

/**
 * Get recently aired episodes for catch-up
 */
export const getRecentlyAired = query({
  args: {
    limit: v.optional(v.number()),
    showId: v.optional(v.id('shows')),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;
    const now = Date.now();
    const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;

    let query = ctx.db
      .query('episodes')
      .withIndex('airDateUtc')
      .filter((q) =>
        q.and(q.gte(q.field('airDateUtc'), threeDaysAgo), q.lte(q.field('airDateUtc'), now))
      );

    let episodes = await query.collect();

    // Filter by show if specified
    if (args.showId) {
      episodes = episodes.filter((e) => e.showId === args.showId);
    }

    // Sort by most recent first
    episodes.sort((a, b) => (b.airDateUtc || 0) - (a.airDateUtc || 0));
    episodes = episodes.slice(0, limit);

    // Enrich with show info and resolution status
    const enriched = await Promise.all(
      episodes.map(async (episode) => {
        const show = await ctx.db.get(episode.showId);

        // Get predictions and their resolution status
        const predictions = await ctx.db
          .query('predictions')
          .withIndex('episodeId', (q) => q.eq('episodeId', episode._id))
          .collect();

        const totalPredictions = predictions.length;
        const resolvedPredictions = predictions.filter((p) => p.state === 'resolved').length;
        const pendingResolution = predictions.filter((p) => p.state === 'locked').length;

        return {
          ...episode,
          showTitle: show?.title,
          showSlug: show?.slug,
          timeSinceAir: getTimeSince(episode.airDateUtc || 0),
          predictionStatus: {
            total: totalPredictions,
            resolved: resolvedPredictions,
            pending: pendingResolution,
            resolutionProgress:
              totalPredictions > 0 ? Math.round((resolvedPredictions / totalPredictions) * 100) : 0,
          },
        };
      })
    );

    return enriched;
  },
});

// Helper function
function getTimeSince(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else {
    return 'Just aired';
  }
}
