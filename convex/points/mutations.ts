import { v } from 'convex/values';
import { mutation, internalMutation } from '../_generated/server';
import { Id } from '../_generated/dataModel';

/**
 * Award bonus points (admin/system action)
 */
export const awardBonusPoints = mutation({
  args: {
    userId: v.id('users'),
    points: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    // TODO: Add admin check here
    // const isAdmin = await checkIfAdmin(identity.subject);
    // if (!isAdmin) throw new Error("Not authorized");

    const now = Date.now();

    // Add to ledger
    await ctx.db.insert('pointsLedger', {
      userId: args.userId,
      points: args.points,
      reason: 'admin_adjustment',
      metadata: {
        adminNote: args.reason,
        adminId: identity.subject,
      },
      createdAt: now,
    });

    // Update user stats
    const stats = await ctx.db
      .query('userStats')
      .withIndex('userId', (q) => q.eq('userId', args.userId))
      .first();

    if (stats) {
      await ctx.db.patch(stats._id, {
        pointsBalance: stats.pointsBalance + args.points,
        lifetimePoints: stats.lifetimePoints + Math.max(0, args.points), // Only add positive to lifetime
        updatedAt: now,
      });
    }

    return { success: true, message: `Awarded ${args.points} points` };
  },
});

/**
 * Deduct points (for future features like power-ups, badges, etc.)
 */
export const spendPoints = mutation({
  args: {
    points: v.number(),
    reason: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    const userId = identity.subject as Id<'users'>;
    const now = Date.now();

    // Check balance
    const stats = await ctx.db
      .query('userStats')
      .withIndex('userId', (q) => q.eq('userId', userId))
      .first();

    if (!stats || stats.pointsBalance < args.points) {
      throw new Error('Insufficient points balance');
    }

    // Deduct from ledger (negative entry)
    await ctx.db.insert('pointsLedger', {
      userId,
      points: -args.points,
      reason: 'admin_adjustment', // Or create new reason types
      metadata: {
        spendReason: args.reason,
        ...args.metadata,
      },
      createdAt: now,
    });

    // Update stats
    await ctx.db.patch(stats._id, {
      pointsBalance: stats.pointsBalance - args.points,
      updatedAt: now,
    });

    return {
      success: true,
      newBalance: stats.pointsBalance - args.points,
    };
  },
});

/**
 * Award streak bonus (called by cron daily)
 */
export const awardStreakBonus = internalMutation({
  args: {
    userId: v.id('users'),
    streakDays: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Calculate bonus based on streak length
    let bonus = 0;
    if (args.streakDays >= 30) {
      bonus = 100;
    } else if (args.streakDays >= 14) {
      bonus = 50;
    } else if (args.streakDays >= 7) {
      bonus = 25;
    } else if (args.streakDays >= 3) {
      bonus = 10;
    } else {
      return; // No bonus for streaks < 3 days
    }

    // Check if already awarded today
    const today = new Date(now).toISOString().split('T')[0];
    const existingBonus = await ctx.db
      .query('pointsLedger')
      .withIndex('userId', (q) => q.eq('userId', args.userId))
      .filter((q) =>
        q.and(
          q.eq(q.field('reason'), 'streak_bonus'),
          q.gte(q.field('createdAt'), new Date(today).getTime())
        )
      )
      .first();

    if (existingBonus) {
      return; // Already awarded today
    }

    // Award bonus
    await ctx.db.insert('pointsLedger', {
      userId: args.userId,
      points: bonus,
      reason: 'streak_bonus',
      metadata: {
        streakDays: args.streakDays,
      },
      createdAt: now,
    });

    // Update stats
    const stats = await ctx.db
      .query('userStats')
      .withIndex('userId', (q) => q.eq('userId', args.userId))
      .first();

    if (stats) {
      await ctx.db.patch(stats._id, {
        pointsBalance: stats.pointsBalance + bonus,
        lifetimePoints: stats.lifetimePoints + bonus,
        updatedAt: now,
      });
    }
  },
});

/**
 * Process tournament payout
 */
export const processTournamentPayout = internalMutation({
  args: {
    tournamentId: v.id('tournaments'),
    payouts: v.array(
      v.object({
        userId: v.id('users'),
        rank: v.number(),
        points: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    for (const payout of args.payouts) {
      // Add to ledger
      await ctx.db.insert('pointsLedger', {
        userId: payout.userId,
        points: payout.points,
        reason: 'tournament_payout',
        tournamentId: args.tournamentId,
        metadata: {
          rank: payout.rank,
        },
        createdAt: now,
      });

      // Update stats
      const stats = await ctx.db
        .query('userStats')
        .withIndex('userId', (q) => q.eq('userId', payout.userId))
        .first();

      if (stats) {
        await ctx.db.patch(stats._id, {
          pointsBalance: stats.pointsBalance + payout.points,
          lifetimePoints: stats.lifetimePoints + payout.points,
          updatedAt: now,
        });
      }
    }

    return { success: true, totalPaid: args.payouts.length };
  },
});

/**
 * Refund points for void prediction
 */
export const refundVoidPrediction = internalMutation({
  args: {
    predictionId: v.id('predictions'),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get all picks for this prediction
    const picks = await ctx.db
      .query('predictionPicks')
      .withIndex('predictionId', (q) => q.eq('predictionId', args.predictionId))
      .collect();

    // Refund half of potential points to each picker
    for (const pick of picks) {
      const refundAmount = Math.floor((pick.potentialPoints || 0) / 2);

      if (refundAmount > 0) {
        // Add to ledger
        await ctx.db.insert('pointsLedger', {
          userId: pick.userId,
          points: refundAmount,
          reason: 'refund',
          predictionId: args.predictionId,
          pickId: pick._id,
          metadata: {
            originalPotential: pick.potentialPoints,
            refundPercentage: 50,
          },
          createdAt: now,
        });

        // Update stats
        const stats = await ctx.db
          .query('userStats')
          .withIndex('userId', (q) => q.eq('userId', pick.userId))
          .first();

        if (stats) {
          await ctx.db.patch(stats._id, {
            pointsBalance: stats.pointsBalance + refundAmount,
            lifetimePoints: stats.lifetimePoints + refundAmount,
            updatedAt: now,
          });
        }
      }
    }

    return { success: true, refundedPicks: picks.length };
  },
});
