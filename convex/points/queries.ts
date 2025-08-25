import { v } from 'convex/values';
import { query } from '../_generated/server';
import { Id } from '../_generated/dataModel';

/**
 * Get user's points history
 */
export const getPointsHistory = query({
  args: {
    userId: v.optional(v.id('users')),
    limit: v.optional(v.number()),
    reason: v.optional(
      v.union(
        v.literal('pick_correct'),
        v.literal('early_bonus'),
        v.literal('contrarian_bonus'),
        v.literal('streak_bonus'),
        v.literal('tournament_payout'),
        v.literal('admin_adjustment'),
        v.literal('refund')
      )
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity && !args.userId) throw new Error('Not authenticated');

    const userId = args.userId || (identity?.subject as Id<'users'>);
    const limit = args.limit || 50;

    // Build query
    let ledgerQuery = ctx.db
      .query('pointsLedger')
      .withIndex('userId', (q) => q.eq('userId', userId));

    // Filter by reason if specified
    if (args.reason) {
      ledgerQuery = ledgerQuery.filter((q) => q.eq(q.field('reason'), args.reason));
    }

    // Get entries
    const entries = await ledgerQuery.order('desc').take(limit);

    // Enrich with context
    const enriched = await Promise.all(
      entries.map(async (entry) => {
        let context: any = {
          reason: entry.reason,
          points: entry.points,
          timestamp: entry.createdAt,
        };

        // Add prediction context if applicable
        if (entry.predictionId) {
          const prediction = await ctx.db.get(entry.predictionId);
          if (prediction) {
            const show = await ctx.db.get(prediction.showId);
            context.prediction = {
              id: prediction._id,
              templateKey: prediction.templateKey,
              showTitle: show?.title,
            };
          }
        }

        // Add tournament context if applicable
        if (entry.tournamentId) {
          const tournament = await ctx.db.get(entry.tournamentId);
          if (tournament) {
            context.tournament = {
              id: tournament._id,
              title: tournament.title,
              rank: entry.metadata?.rank,
            };
          }
        }

        return {
          ...entry,
          context,
        };
      })
    );

    // Get current balance
    const stats = await ctx.db
      .query('userStats')
      .withIndex('userId', (q) => q.eq('userId', userId))
      .first();

    return {
      entries: enriched,
      currentBalance: stats?.pointsBalance || 0,
      lifetimeEarned: stats?.lifetimePoints || 0,
    };
  },
});

/**
 * Get points breakdown by source
 */
export const getPointsBreakdown = query({
  args: {
    userId: v.optional(v.id('users')),
    period: v.optional(
      v.union(
        v.literal('all_time'),
        v.literal('this_week'),
        v.literal('this_month'),
        v.literal('today')
      )
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity && !args.userId) throw new Error('Not authenticated');

    const userId = args.userId || (identity?.subject as Id<'users'>);
    const period = args.period || 'all_time';

    // Calculate time range
    const now = Date.now();
    let startTime = 0;

    switch (period) {
      case 'today':
        startTime = new Date().setHours(0, 0, 0, 0);
        break;
      case 'this_week':
        startTime = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case 'this_month':
        startTime = now - 30 * 24 * 60 * 60 * 1000;
        break;
    }

    // Get ledger entries
    let entries = await ctx.db
      .query('pointsLedger')
      .withIndex('userId', (q) => q.eq('userId', userId))
      .collect();

    // Filter by time if needed
    if (startTime > 0) {
      entries = entries.filter((e) => e.createdAt >= startTime);
    }

    // Calculate breakdown
    const breakdown = {
      predictions: 0,
      streaks: 0,
      tournaments: 0,
      bonuses: 0,
      refunds: 0,
      adjustments: 0,
      total: 0,
    };

    const details = {
      predictionsCount: 0,
      tournamentsWon: 0,
      streakBonuses: 0,
      largestWin: 0,
      averageWin: 0,
    };

    let winCount = 0;
    let winTotal = 0;

    for (const entry of entries) {
      breakdown.total += entry.points;

      switch (entry.reason) {
        case 'pick_correct':
          breakdown.predictions += entry.points;
          details.predictionsCount++;
          winCount++;
          winTotal += entry.points;
          details.largestWin = Math.max(details.largestWin, entry.points);
          break;
        case 'streak_bonus':
          breakdown.streaks += entry.points;
          details.streakBonuses++;
          break;
        case 'tournament_payout':
          breakdown.tournaments += entry.points;
          details.tournamentsWon++;
          break;
        case 'early_bonus':
        case 'contrarian_bonus':
          breakdown.bonuses += entry.points;
          break;
        case 'refund':
          breakdown.refunds += entry.points;
          break;
        case 'admin_adjustment':
          breakdown.adjustments += entry.points;
          break;
      }
    }

    details.averageWin = winCount > 0 ? Math.round(winTotal / winCount) : 0;

    return {
      breakdown,
      details,
      period,
      entryCount: entries.length,
    };
  },
});

/**
 * Get user's current stats
 */
export const getUserStats = query({
  args: {
    userId: v.optional(v.id('users')),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity && !args.userId) throw new Error('Not authenticated');

    const userId = args.userId || (identity?.subject as Id<'users'>);

    // Get stats
    const stats = await ctx.db
      .query('userStats')
      .withIndex('userId', (q) => q.eq('userId', userId))
      .first();

    if (!stats) {
      // Return default stats for new user
      return {
        userId,
        totalPicks: 0,
        correctPicks: 0,
        accuracy: 0,
        pointsBalance: 0,
        lifetimePoints: 0,
        currentStreak: 0,
        bestStreak: 0,
        level: 'Novice',
        levelProgress: { current: 0, required: 100 },
        rank: null,
      };
    }

    // Calculate level from lifetime points
    const level = calculateLevel(stats.lifetimePoints);

    // Get user's rank
    const leaderboard = await ctx.db
      .query('leaderboards')
      .withIndex('kind_period', (q) => q.eq('kind', 'global').eq('periodKey', 'all_time'))
      .first();

    let rank = null;
    if (leaderboard) {
      const entry = leaderboard.top.find((e) => e.userId === userId);
      if (entry) {
        rank = entry.rank;
      }
    }

    return {
      ...stats,
      level: level.name,
      levelProgress: level.progress,
      rank,
    };
  },
});

/**
 * Get show-specific stats for a user
 */
export const getUserShowStats = query({
  args: {
    userId: v.optional(v.id('users')),
    showId: v.optional(v.id('shows')),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity && !args.userId) throw new Error('Not authenticated');

    const userId = args.userId || (identity?.subject as Id<'users'>);

    if (args.showId) {
      // Get specific show stats
      const stats = await ctx.db
        .query('userShowStats')
        .withIndex('user_show', (q) =>
          q.eq('userId', userId).eq('showId', args.showId as Id<'shows'>)
        )
        .first();

      if (!stats) {
        return {
          userId,
          showId: args.showId,
          totalPredictions: 0,
          correctPredictions: 0,
          accuracy: 0,
        };
      }

      return stats;
    } else {
      // Get all show stats
      const allStats = await ctx.db
        .query('userShowStats')
        .withIndex('userId', (q) => q.eq('userId', userId))
        .collect();

      // Sort by accuracy
      allStats.sort((a, b) => b.accuracy - a.accuracy);

      // Enrich with show info
      const enriched = await Promise.all(
        allStats.map(async (stat) => {
          const show = await ctx.db.get(stat.showId);
          return {
            ...stat,
            showTitle: show?.title,
            showSlug: show?.slug,
          };
        })
      );

      return enriched;
    }
  },
});

// Helper function for level calculation
function calculateLevel(lifetimePoints: number): {
  name: string;
  progress: { current: number; required: number };
} {
  const levels = [
    { name: 'Novice', min: 0, max: 100 },
    { name: 'Apprentice', min: 100, max: 500 },
    { name: 'Investigator', min: 500, max: 1500 },
    { name: 'Detective', min: 1500, max: 3500 },
    { name: 'Expert Detective', min: 3500, max: 7500 },
    { name: 'Master Detective', min: 7500, max: 15000 },
    { name: 'Legendary', min: 15000, max: Infinity },
  ];

  const currentLevel =
    levels.find((l) => lifetimePoints >= l.min && lifetimePoints < l.max) || levels[0];
  const nextLevel = levels[levels.indexOf(currentLevel) + 1];

  return {
    name: currentLevel.name,
    progress: {
      current: lifetimePoints - currentLevel.min,
      required: (nextLevel?.min || currentLevel.max) - currentLevel.min,
    },
  };
}
