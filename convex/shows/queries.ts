import { v } from 'convex/values';
import { query } from '../_generated/server';
import { Id } from '../_generated/dataModel';

/**
 * Get show details with all enrichments
 */
export const getShow = query({
  args: {
    showId: v.optional(v.id('shows')),
    slug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.showId && !args.slug) {
      throw new Error('Must provide showId or slug');
    }

    const { showId, slug } = args;

    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject as Id<'users'> | undefined;

    // Find show
    let show;
    if (showId) show = await ctx.db.get(showId);
    else if (slug)
      show = await ctx.db
        .query('shows')
        .withIndex('slug', (q) => q.eq('slug', slug))
        .first();
    else throw new Error('[Invariant] Must provide showId or slug');

    if (!show) throw new Error('Show not found');

    // Check if user follows
    let isFollowing = false;
    let userProgress = null;

    if (userId) {
      const follow = await ctx.db
        .query('showFollows')
        .withIndex('user_show', (q) => q.eq('userId', userId).eq('showId', show._id))
        .first();
      isFollowing = !!follow;

      // Get user progress
      userProgress = await ctx.db
        .query('userProgress')
        .withIndex('user_show', (q) => q.eq('userId', userId).eq('showId', show._id))
        .first();
    }

    // Get seasons
    const seasons = await ctx.db
      .query('seasons')
      .withIndex('showId', (q) => q.eq('showId', show._id))
      .collect();

    seasons.sort((a, b) => a.seasonNumber - b.seasonNumber);

    // Get total episodes
    const episodes = await ctx.db
      .query('episodes')
      .withIndex('showId', (q) => q.eq('showId', show._id))
      .collect();

    // Get active predictions
    const predictions = await ctx.db
      .query('predictions')
      .withIndex('show_state', (q) => q.eq('showId', show._id).eq('state', 'open'))
      .collect();

    // Calculate community accuracy
    // Note: This requires loading all picks for the show's predictions
    // For better performance at scale, consider maintaining accuracy as a denormalized field
    const predictionIds = predictions.map((p) => p._id);
    const allPicks = [];
    for (const predId of predictionIds) {
      const picks = await ctx.db
        .query('predictionPicks')
        .withIndex('predictionId', (q) => q.eq('predictionId', predId))
        .collect();
      allPicks.push(...picks);
    }

    const resolvedPredictions = await ctx.db
      .query('predictions')
      .withIndex('show_state', (q) => q.eq('showId', show._id).eq('state', 'resolved'))
      .collect();

    let communityAccuracy = 0;
    if (resolvedPredictions.length > 0) {
      const correctPicks = allPicks.filter((pick) => {
        const pred = resolvedPredictions.find((p) => p._id === pick.predictionId);
        return pred?.outcomeOptionId === pick.optionId;
      });
      communityAccuracy = Math.round((correctPicks.length / allPicks.length) * 100);
    }

    // Get next episode
    const now = Date.now();
    const nextEpisode = episodes
      .filter((e) => e.airDateUtc && e.airDateUtc > now)
      .sort((a, b) => (a.airDateUtc || 0) - (b.airDateUtc || 0))[0];

    // Get top predictors
    const showStats = await ctx.db
      .query('userShowStats')
      .withIndex('showId', (q) => q.eq('showId', show._id))
      .collect();

    showStats.sort((a, b) => b.accuracy - a.accuracy);

    const topPredictors = await Promise.all(
      showStats.slice(0, 5).map(async (stat) => {
        const user = await ctx.db.get(stat.userId);
        return {
          userId: stat.userId,
          handle: user?.handle,
          displayName: user?.displayName,
          avatarUrl: user?.avatarUrl,
          accuracy: stat.accuracy,
          totalPredictions: stat.totalPredictions,
        };
      })
    );

    return {
      ...show,
      isFollowing,
      userProgress: userProgress
        ? {
            lastWatchedSeason: userProgress.seasonNumber,
            lastWatchedEpisode: userProgress.episodeNumber,
            lastWatchedEpisodeId: userProgress.lastWatchedEpisodeId,
          }
        : null,
      stats: {
        totalSeasons: seasons.length,
        totalEpisodes: episodes.length,
        activePredictions: predictions.length,
        totalFollowers: show.followersCount || 0,
        communityAccuracy,
      },
      seasons: seasons.map((s) => ({
        _id: s._id,
        seasonNumber: s.seasonNumber,
        title: s.title,
        episodeCount: s.episodeCount,
      })),
      nextEpisode: nextEpisode
        ? {
            _id: nextEpisode._id,
            title: nextEpisode.title,
            seasonNumber: nextEpisode.seasonNumber,
            episodeNumber: nextEpisode.episodeNumber,
            airDateUtc: nextEpisode.airDateUtc,
          }
        : null,
      topPredictors,
    };
  },
});

/**
 * Get trending shows
 */
export const getTrendingShows = query({
  args: {
    limit: v.optional(v.number()),
    timeWindow: v.optional(v.union(v.literal('day'), v.literal('week'), v.literal('month'))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject as Id<'users'> | undefined;
    const limit = args.limit || 20;
    const timeWindow = args.timeWindow || 'week';

    // Calculate time range
    const now = Date.now();
    let startTime = now;
    switch (timeWindow) {
      case 'day':
        startTime = now - 24 * 60 * 60 * 1000;
        break;
      case 'week':
        startTime = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case 'month':
        startTime = now - 30 * 24 * 60 * 60 * 1000;
        break;
    }

    // Get all shows
    const shows = await ctx.db
      .query('shows')
      .withIndex('status')
      .filter((q) => q.neq(q.field('status'), 'ended'))
      .collect();

    // Calculate trending scores
    const showsWithScores = await Promise.all(
      shows.map(async (show) => {
        // Get recent predictions
        const recentPredictions = await ctx.db
          .query('predictions')
          .withIndex('showId', (q) => q.eq('showId', show._id))
          .filter((q) => q.gte(q.field('createdAt'), startTime))
          .collect();

        // Get recent follows
        const recentFollows = await ctx.db
          .query('showFollows')
          .withIndex('showId', (q) => q.eq('showId', show._id))
          .filter((q) => q.gte(q.field('createdAt'), startTime))
          .collect();

        // Get recent activity (picks)
        const activePredictionIds = recentPredictions
          .filter((p) => p.state === 'open')
          .map((p) => p._id);

        let recentPicksCount = 0;
        if (activePredictionIds.length > 0) {
          const picks = await ctx.db
            .query('predictionPicks')
            .filter((q) => {
              return (
                activePredictionIds.includes(q.field('predictionId') as any) &&
                q.gte(q.field('createdAt'), startTime)
              );
            })
            .collect();
          recentPicksCount = picks.length;
        }

        // Calculate trending score
        const score =
          recentPredictions.length * 10 +
          recentFollows.length * 5 +
          recentPicksCount * 2 +
          (show.followersCount || 0) * 0.1;

        // Check if user follows
        let isFollowing = false;
        if (userId) {
          const follow = await ctx.db
            .query('showFollows')
            .withIndex('user_show', (q) => q.eq('userId', userId).eq('showId', show._id))
            .first();
          isFollowing = !!follow;
        }

        // Get next episode
        const nextEpisode = await ctx.db
          .query('episodes')
          .withIndex('showId', (q) => q.eq('showId', show._id))
          .filter((q) => q.gte(q.field('airDateUtc'), now))
          .order('asc')
          .first();

        return {
          ...show,
          trendingScore: score,
          isFollowing,
          recentActivity: {
            predictions: recentPredictions.length,
            follows: recentFollows.length,
            picks: recentPicksCount,
          },
          nextEpisode: nextEpisode
            ? {
                title: nextEpisode.title,
                airDateUtc: nextEpisode.airDateUtc,
                seasonNumber: nextEpisode.seasonNumber,
                episodeNumber: nextEpisode.episodeNumber,
              }
            : null,
        };
      })
    );

    // Sort by trending score and limit
    showsWithScores.sort((a, b) => b.trendingScore - a.trendingScore);

    return showsWithScores.slice(0, limit);
  },
});

/**
 * Get user's followed shows
 */
export const getMyShows = query({
  args: {
    status: v.optional(
      v.union(v.literal('all'), v.literal('airing'), v.literal('upcoming'), v.literal('ended'))
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const userId = identity.subject as Id<'users'>;
    const now = Date.now();

    // Get followed shows
    const follows = await ctx.db
      .query('showFollows')
      .withIndex('userId', (q) => q.eq('userId', userId))
      .collect();

    // Get show details
    const shows = await Promise.all(
      follows.map(async (follow) => {
        const show = await ctx.db.get(follow.showId);
        if (!show) return null;

        // Get user progress
        const progress = await ctx.db
          .query('userProgress')
          .withIndex('user_show', (q) => q.eq('userId', userId).eq('showId', follow.showId))
          .first();

        // Get next episode
        const nextEpisode = await ctx.db
          .query('episodes')
          .withIndex('showId', (q) => q.eq('showId', follow.showId))
          .filter((q) => q.gte(q.field('airDateUtc'), now))
          .order('asc')
          .first();

        // Get active predictions count
        const activePredictions = await ctx.db
          .query('predictions')
          .withIndex('show_state', (q) => q.eq('showId', follow.showId).eq('state', 'open'))
          .collect();

        // Determine show status
        let showStatus: 'airing' | 'upcoming' | 'ended' = 'ended';
        if (nextEpisode) {
          const daysUntil = (nextEpisode.airDateUtc! - now) / (1000 * 60 * 60 * 24);
          showStatus = daysUntil <= 7 ? 'airing' : 'upcoming';
        } else if (show.status === 'running') {
          showStatus = 'airing';
        }

        return {
          ...show,
          followedAt: follow.createdAt,
          userProgress: progress
            ? {
                lastWatchedSeason: progress.seasonNumber,
                lastWatchedEpisode: progress.episodeNumber,
                updatedAt: progress.updatedAt,
              }
            : null,
          nextEpisode: nextEpisode
            ? {
                _id: nextEpisode._id,
                title: nextEpisode.title,
                seasonNumber: nextEpisode.seasonNumber,
                episodeNumber: nextEpisode.episodeNumber,
                airDateUtc: nextEpisode.airDateUtc,
              }
            : null,
          activePredictions: activePredictions.length,
          showStatus,
        };
      })
    );

    // Filter nulls
    let validShows = shows.filter((s) => s !== null);

    // Filter by status if specified
    if (args.status && args.status !== 'all') {
      if (args.status === 'ended') {
        validShows = validShows.filter((s) => s!.showStatus === 'ended');
      } else if (args.status === 'airing') {
        validShows = validShows.filter((s) => s!.showStatus === 'airing');
      } else if (args.status === 'upcoming') {
        validShows = validShows.filter((s) => s!.showStatus === 'upcoming');
      }
    }

    // Sort by next episode date or last activity
    validShows.sort((a, b) => {
      if (a!.nextEpisode && b!.nextEpisode) {
        return (a?.nextEpisode?.airDateUtc ?? 0) - (b?.nextEpisode?.airDateUtc ?? 0);
      }
      if (a!.nextEpisode) return -1;
      if (b!.nextEpisode) return 1;
      return b!.followedAt - a!.followedAt;
    });

    return validShows;
  },
});

/**
 * Search shows
 */
export const searchShows = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
    includeEnded: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject as Id<'users'> | undefined;
    const limit = args.limit || 20;
    const searchQuery = args.query.toLowerCase();

    // Get all shows
    let shows = await ctx.db.query('shows').collect();

    // Filter by status
    if (!args.includeEnded) {
      shows = shows.filter((s) => s.status !== 'ended');
    }

    // Search filter
    shows = shows.filter(
      (show) =>
        show.title.toLowerCase().includes(searchQuery) ||
        show.overview?.toLowerCase().includes(searchQuery) ||
        show.genres?.some((g) => g.toLowerCase().includes(searchQuery))
    );

    // Score by relevance
    const scored = shows.map((show) => {
      let score = 0;

      // Title match
      if (show.title.toLowerCase() === searchQuery) {
        score += 100;
      } else if (show.title.toLowerCase().startsWith(searchQuery)) {
        score += 50;
      } else if (show.title.toLowerCase().includes(searchQuery)) {
        score += 20;
      }

      // Popularity boost
      score += (show.followersCount || 0) * 0.01;
      score += (show.predictionsCount || 0) * 0.001;

      return { show, score };
    });

    // Sort by score
    scored.sort((a, b) => b.score - a.score);

    // Get top results
    const topResults = scored.slice(0, limit);

    // Enrich with user context
    const enriched = await Promise.all(
      topResults.map(async ({ show, score }) => {
        let isFollowing = false;
        if (userId) {
          const follow = await ctx.db
            .query('showFollows')
            .withIndex('user_show', (q) => q.eq('userId', userId).eq('showId', show._id))
            .first();
          isFollowing = !!follow;
        }

        // Get active predictions
        const activePredictions = await ctx.db
          .query('predictions')
          .withIndex('show_state', (q) => q.eq('showId', show._id).eq('state', 'open'))
          .collect();

        return {
          ...show,
          relevanceScore: score,
          isFollowing,
          activePredictions: activePredictions.length,
        };
      })
    );

    return enriched;
  },
});

/**
 * Get recommended shows
 */
export const getRecommendedShows = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const userId = identity.subject as Id<'users'>;
    const limit = args.limit || 10;

    // Get user's followed shows
    const myShows = await ctx.db
      .query('showFollows')
      .withIndex('userId', (q) => q.eq('userId', userId))
      .collect();

    const myShowIds = new Set(myShows.map((s) => s.showId));

    // Get genres from followed shows
    const genreCount = new Map<string, number>();
    for (const follow of myShows) {
      const show = await ctx.db.get(follow.showId);
      if (show?.genres) {
        for (const genre of show.genres) {
          genreCount.set(genre, (genreCount.get(genre) || 0) + 1);
        }
      }
    }

    // Get shows not followed
    const allShows = await ctx.db
      .query('shows')
      .withIndex('status')
      .filter((q) => q.neq(q.field('status'), 'ended'))
      .collect();

    const candidateShows = allShows.filter((s) => !myShowIds.has(s._id));

    // Score candidates
    const scored = candidateShows.map((show) => {
      let score = 0;

      // Genre similarity
      if (show.genres) {
        for (const genre of show.genres) {
          score += (genreCount.get(genre) || 0) * 10;
        }
      }

      // Popularity factor
      score += Math.log10((show.followersCount || 0) + 1) * 5;
      score += Math.log10((show.predictionsCount || 0) + 1) * 2;

      // Boost for active shows
      if (show.status === 'running') {
        score += 20;
      }

      return { show, score };
    });

    // Sort by score
    scored.sort((a, b) => b.score - a.score);

    // Get collaborative filtering boost
    // Find users who follow similar shows
    const similarUsers = new Map<string, number>();
    for (const showId of myShowIds) {
      const followers = await ctx.db
        .query('showFollows')
        .withIndex('showId', (q) => q.eq('showId', showId))
        .take(100);

      for (const follower of followers) {
        if (follower.userId !== userId) {
          similarUsers.set(follower.userId, (similarUsers.get(follower.userId) || 0) + 1);
        }
      }
    }

    // Get shows these similar users follow
    const collaborativeBoost = new Map<string, number>();
    for (const [similarUserId, similarity] of similarUsers.entries()) {
      const theirShows = await ctx.db
        .query('showFollows')
        .withIndex('userId', (q) => q.eq('userId', similarUserId as Id<'users'>))
        .take(20);

      for (const show of theirShows) {
        if (!myShowIds.has(show.showId)) {
          collaborativeBoost.set(
            show.showId,
            (collaborativeBoost.get(show.showId) || 0) + similarity
          );
        }
      }
    }

    // Apply collaborative boost
    for (const item of scored) {
      const boost = collaborativeBoost.get(item.show._id) || 0;
      item.score += boost * 3;
    }

    // Re-sort with boost
    scored.sort((a, b) => b.score - a.score);

    // Return enriched recommendations
    const recommendations = scored.slice(0, limit).map(({ show, score }) => ({
      ...show,
      recommendationScore: score,
      isFollowing: false,
    }));

    return recommendations;
  },
});

/**
 * Get show's seasons with episode counts
 */
export const getShowSeasons = query({
  args: {
    showId: v.id('shows'),
  },
  handler: async (ctx, args) => {
    const seasons = await ctx.db
      .query('seasons')
      .withIndex('showId', (q) => q.eq('showId', args.showId))
      .collect();

    seasons.sort((a, b) => a.seasonNumber - b.seasonNumber);

    // Get episode counts
    const enriched = await Promise.all(
      seasons.map(async (season) => {
        const episodes = await ctx.db
          .query('episodes')
          .withIndex('seasonId', (q) => q.eq('seasonId', season._id))
          .collect();

        const airedCount = episodes.filter((e) => e.hasAired).length;

        return {
          ...season,
          actualEpisodeCount: episodes.length,
          airedEpisodeCount: airedCount,
        };
      })
    );

    return enriched;
  },
});
