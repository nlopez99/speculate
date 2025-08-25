import { v } from 'convex/values';
import { query } from '../_generated/server';
import { Id } from '../_generated/dataModel';

/**
 * Get leaderboard
 */
export const getLeaderboard = query({
  args: {
    kind: v.union(v.literal('daily'), v.literal('weekly'), v.literal('global')),
    showId: v.optional(v.id('shows')),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const currentUserId = identity?.subject as Id<'users'> | undefined;

    // Determine period key
    let periodKey = 'all_time';
    if (args.kind === 'weekly') {
      // Get current week
      const now = new Date();
      const dayNum = now.getUTCDay() || 7;
      now.setUTCDate(now.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
      const weekNum = Math.ceil(((now.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
      periodKey = `${now.getUTCFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
    } else if (args.kind === 'daily') {
      periodKey = new Date().toISOString().split('T')[0];
    }

    // Get leaderboard
    const leaderboard = await ctx.db
      .query('leaderboards')
      .withIndex('kind_period', (q) =>
        q.eq('kind', args.kind === 'global' ? 'global' : args.kind).eq('periodKey', periodKey)
      )
      .first();

    if (!leaderboard) {
      return { entries: [], userRank: null };
    }

    // Enrich with user data
    const enrichedEntries = await Promise.all(
      leaderboard.top.map(async (entry) => {
        const user = await ctx.db.get(entry.userId);
        const stats = await ctx.db
          .query('userStats')
          .withIndex('userId', (q) => q.eq('userId', entry.userId))
          .first();

        return {
          rank: entry.rank,
          userId: entry.userId,
          username: user?.handle || 'Unknown',
          displayName: user?.displayName || user?.handle || 'Unknown',
          avatarUrl: user?.avatarUrl,
          points: entry.score,
          accuracy: entry.rating || stats?.accuracy || 0,
          totalPicks: stats?.totalPicks || 0,
          currentStreak: stats?.currentStreak || 0,
          isCurrentUser: entry.userId === currentUserId,
        };
      })
    );

    // Find current user's rank if not in top
    let userRank = null;
    if (currentUserId) {
      const userEntry = enrichedEntries.find((e) => e.isCurrentUser);
      if (userEntry) {
        userRank = userEntry;
      } else {
        // Calculate user's rank from stats
        const userStats = await ctx.db
          .query('userStats')
          .withIndex('userId', (q) => q.eq('userId', currentUserId))
          .first();

        if (userStats) {
          // This is simplified - in production, you'd calculate actual rank
          userRank = {
            rank: 999, // Placeholder
            userId: currentUserId,
            username: 'You',
            points: userStats.lifetimePoints,
            accuracy: userStats.accuracy,
            isCurrentUser: true,
          };
        }
      }
    }

    return {
      entries: enrichedEntries,
      userRank,
      periodKey,
      lastUpdated: leaderboard.createdAt,
    };
  },
});
