import { cronJobs } from 'convex/server';
import { internalMutation } from '../_generated/server';
import { internal } from '../_generated/api';
import { Id } from '../_generated/dataModel';

// Define the cron jobs
const crons = cronJobs();

// Update leaderboards daily at 2 AM UTC
crons.daily(
  'updateLeaderboards',
  { hourUTC: 2, minuteUTC: 0 },
  internal.leaderboard.crons.computeAllLeaderboards
);

export default crons;

/**
 * Compute all leaderboards
 */
export const computeAllLeaderboards = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const today = new Date(now).toISOString().split('T')[0];

    // Get ISO week
    const date = new Date(now);
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    const weekKey = `${date.getUTCFullYear()}-W${weekNum.toString().padStart(2, '0')}`;

    // 1. All-time leaderboard - Use the lifetimePoints index
    const topAllTime = await ctx.db
      .query('userStats')
      .withIndex('lifetimePoints')
      .order('desc')
      .take(100);

    const allTimeTop = topAllTime.map((stat, index) => ({
      userId: stat.userId,
      rank: index + 1,
      score: stat.lifetimePoints,
      rating: stat.accuracy,
    }));

    // Upsert pattern - check for existing then update or insert
    const existingAllTime = await ctx.db
      .query('leaderboards')
      .withIndex('kind_period', (q) => 
        q.eq('kind', 'global').eq('periodKey', 'all_time')
      )
      .first();

    if (existingAllTime) {
      await ctx.db.patch(existingAllTime._id, {
        top: allTimeTop,
        createdAt: now,
      });
    } else {
      await ctx.db.insert('leaderboards', {
        kind: 'global',
        periodKey: 'all_time',
        top: allTimeTop,
        createdAt: now,
      });
    }

    // 2. Weekly leaderboard
    const weekStart = now - 7 * 24 * 60 * 60 * 1000;
    const weeklyLedger = await ctx.db
      .query('pointsLedger')
      .withIndex('createdAt')
      .filter((q) => q.gte(q.field('createdAt'), weekStart))
      .collect();

    // Aggregate by user
    const weeklyTotals = new Map<string, number>();
    for (const entry of weeklyLedger) {
      const current = weeklyTotals.get(entry.userId) || 0;
      weeklyTotals.set(entry.userId, current + entry.points);
    }

    // Convert to array and sort
    const weeklyRanked = Array.from(weeklyTotals.entries())
      .map(([userId, points]) => ({ userId, points }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 100);

    // Get user accuracy for weekly leaders
    const weeklyWithStats = await Promise.all(
      weeklyRanked.map(async (entry, index) => {
        const stats = await ctx.db
          .query('userStats')
          .withIndex('userId', (q) => q.eq('userId', entry.userId as Id<'users'>))
          .first();

        return {
          userId: entry.userId as Id<'users'>,
          rank: index + 1,
          score: entry.points,
          rating: stats?.accuracy || 0,
        };
      })
    );

    // Upsert weekly leaderboard
    const existingWeekly = await ctx.db
      .query('leaderboards')
      .withIndex('kind_period', (q) => 
        q.eq('kind', 'weekly').eq('periodKey', weekKey)
      )
      .first();

    if (existingWeekly) {
      await ctx.db.patch(existingWeekly._id, {
        top: weeklyWithStats,
        createdAt: now,
      });
    } else {
      await ctx.db.insert('leaderboards', {
        kind: 'weekly',
        periodKey: weekKey,
        top: weeklyWithStats,
        createdAt: now,
      });
    }

    // 3. Daily leaderboard (last 24 hours)
    const dayStart = now - 24 * 60 * 60 * 1000;
    const dailyLedger = await ctx.db
      .query('pointsLedger')
      .withIndex('createdAt')
      .filter((q) => q.gte(q.field('createdAt'), dayStart))
      .collect();

    // Aggregate by user
    const dailyTotals = new Map<string, number>();
    for (const entry of dailyLedger) {
      const current = dailyTotals.get(entry.userId) || 0;
      dailyTotals.set(entry.userId, current + entry.points);
    }

    // Convert to array and sort
    const dailyRanked = Array.from(dailyTotals.entries())
      .map(([userId, points]) => ({ userId, points }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 100);

    // Get user accuracy for daily leaders
    const dailyWithStats = await Promise.all(
      dailyRanked.map(async (entry, index) => {
        const stats = await ctx.db
          .query('userStats')
          .withIndex('userId', (q) => q.eq('userId', entry.userId as Id<'users'>))
          .first();

        return {
          userId: entry.userId as Id<'users'>,
          rank: index + 1,
          score: entry.points,
          rating: stats?.accuracy || 0,
        };
      })
    );

    // Upsert daily leaderboard
    const existingDaily = await ctx.db
      .query('leaderboards')
      .withIndex('kind_period', (q) => 
        q.eq('kind', 'daily').eq('periodKey', today)
      )
      .first();

    if (existingDaily) {
      await ctx.db.patch(existingDaily._id, {
        top: dailyWithStats,
        createdAt: now,
      });
    } else {
      await ctx.db.insert('leaderboards', {
        kind: 'daily',
        periodKey: today,
        top: dailyWithStats,
        createdAt: now,
      });
    }

    return { success: true, message: 'Leaderboards updated' };
  },
});
