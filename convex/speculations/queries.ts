import { v } from 'convex/values';
import { query } from '../_generated/server';
import { Id } from '../_generated/dataModel';

/**
 * Get predictions for an episode with live stats
 */
export const getEpisodePredictions = query({
  args: {
    episodeId: v.id('episodes'),
    includeResolved: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject as Id<'users'> | undefined;

    // Get predictions
    let predictionsQuery = ctx.db
      .query('predictions')
      .withIndex('episodeId', (q) => q.eq('episodeId', args.episodeId));

    const predictions = await predictionsQuery.collect();

    // Filter by state if needed
    const filtered = args.includeResolved
      ? predictions
      : predictions.filter((p) => p.state !== 'resolved');

    // Enrich with stats and user picks
    const enriched = await Promise.all(
      filtered.map(async (prediction) => {
        // Get options
        const options = await ctx.db
          .query('predictionOptions')
          .withIndex('predictionId', (q) => q.eq('predictionId', prediction._id))
          .collect();

        // Get live stats
        const optionStats = await ctx.db
          .query('predictionOptionStats')
          .withIndex('predictionId', (q) => q.eq('predictionId', prediction._id))
          .collect();

        // Get user's pick if authenticated
        let userPick = null;
        if (userId) {
          userPick = await ctx.db
            .query('predictionPicks')
            .withIndex('prediction_user', (q) =>
              q.eq('predictionId', prediction._id).eq('userId', userId)
            )
            .first();
        }

        // Calculate percentages
        const totalPicks = optionStats.reduce((sum, s) => sum + s.pickCount, 0);
        const optionsWithStats = options.map((option) => {
          const stat = optionStats.find((s) => s.optionId === option._id);
          const pickCount = stat?.pickCount || 0;
          const percentage = totalPicks > 0 ? Math.round((pickCount / totalPicks) * 100) : 0;

          return {
            ...option,
            pickCount,
            percentage,
            isUserPick: userPick?.optionId === option._id,
          };
        });

        // Calculate time left
        const now = Date.now();
        let timeLeft = null;
        if (prediction.state === 'open' && prediction.lockAt > now) {
          const msLeft = prediction.lockAt - now;
          const hours = Math.floor(msLeft / (1000 * 60 * 60));
          const minutes = Math.floor((msLeft % (1000 * 60 * 60)) / (1000 * 60));
          timeLeft = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
        }

        return {
          ...prediction,
          options: optionsWithStats,
          totalPicks,
          userPick: userPick
            ? {
                optionId: userPick.optionId,
                potentialPoints: userPick.potentialPoints,
                earnedPoints: userPick.earnedPoints,
              }
            : null,
          timeLeft,
        };
      })
    );

    return enriched;
  },
});

/**
 * Get hot predictions across all shows
 */
export const getHotPredictions = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;
    const now = Date.now();
    const oneDayFromNow = now + 24 * 60 * 60 * 1000;

    // Get predictions closing soon
    const predictions = await ctx.db
      .query('predictions')
      .withIndex('lockAt')
      .filter((q) =>
        q.and(
          q.eq(q.field('state'), 'open'),
          q.gte(q.field('lockAt'), now),
          q.lte(q.field('lockAt'), oneDayFromNow)
        )
      )
      .order('asc')
      .take(limit);

    // Enrich with show info and stats
    const enriched = await Promise.all(
      predictions.map(async (prediction) => {
        const show = await ctx.db.get(prediction.showId);

        // Get total picks from stats
        const optionStats = await ctx.db
          .query('predictionOptionStats')
          .withIndex('predictionId', (q) => q.eq('predictionId', prediction._id))
          .collect();

        const totalPicks = optionStats.reduce((sum, s) => sum + s.pickCount, 0);

        // Calculate urgency score (picks per hour * hours remaining)
        const hoursLeft = Math.max(1, (prediction.lockAt - now) / (1000 * 60 * 60));
        const picksPerHour = totalPicks / Math.max(1, 24 - hoursLeft);
        const urgencyScore = picksPerHour * Math.min(hoursLeft, 6); // Cap influence at 6 hours

        return {
          ...prediction,
          showTitle: show?.title || 'Unknown Show',
          showSlug: show?.slug,
          totalPicks,
          urgencyScore,
          hoursLeft: Math.round(hoursLeft * 10) / 10,
        };
      })
    );

    // Sort by urgency score
    enriched.sort((a, b) => b.urgencyScore - a.urgencyScore);

    return enriched;
  },
});
