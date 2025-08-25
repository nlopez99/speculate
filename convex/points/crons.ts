import { cronJobs } from 'convex/server';
import { internalMutation } from '../_generated/server';
import { internal } from '../_generated/api';

const crons = cronJobs();

// Check and award streak bonuses daily at 1 AM UTC
crons.daily(
  'awardStreakBonuses',
  { hourUTC: 1, minuteUTC: 0 },
  internal.points.crons.checkAndAwardStreaks
);

export default crons;

/**
 * Check all users for streak bonuses
 */
export const checkAndAwardStreaks = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const today = new Date(now).toISOString().split('T')[0];
    const yesterday = new Date(now - 86400000).toISOString().split('T')[0];

    // Get all users with active streaks
    const activeUsers = await ctx.db
      .query('userStats')
      .filter((q) => q.eq(q.field('lastActiveDay'), yesterday))
      .collect();

    let awarded = 0;

    for (const user of activeUsers) {
      // Award milestone bonuses
      const streakDays = user.currentStreak;

      if (streakDays === 3 || streakDays === 7 || streakDays === 14 || streakDays === 30) {
        await ctx.scheduler.runAfter(0, internal.points.mutations.awardStreakBonus, {
          userId: user.userId,
          streakDays,
        });
        awarded++;
      }
    }

    return {
      success: true,
      checked: activeUsers.length,
      awarded,
    };
  },
});
