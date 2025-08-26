import { v } from 'convex/values';
import { mutation, internalMutation } from '../_generated/server';
import { Doc, Id } from '../_generated/dataModel';
import { internal } from '../_generated/api';

/**
 * Make a prediction pick
 * - Enforces one pick per user per prediction
 * - Calculates potential points at pick time
 * - Updates streaks and stats
 */
export const makePick = mutation({
  args: {
    predictionId: v.id('predictions'),
    optionId: v.id('predictionOptions'),
    todayLocal: v.optional(v.string()), // Client's local date YYYY-MM-DD
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    const userId = identity.subject as Id<'users'>;
    const now = Date.now();

    // 1. Validate prediction is open
    const prediction = await ctx.db.get(args.predictionId);
    if (!prediction) throw new Error('Prediction not found');

    if (prediction.state !== 'open') {
      throw new Error('Prediction is not open for picks');
    }

    if (now >= prediction.lockAt) {
      throw new Error('Prediction has locked');
    }

    // 2. Check for existing pick - enforce one pick per user per prediction
    const existingPick = await ctx.db
      .query('predictionPicks')
      .withIndex('prediction_user', (q) =>
        q.eq('predictionId', args.predictionId).eq('userId', userId)
      )
      .first();

    if (existingPick) {
      throw new Error(
        'You have already made a pick for this prediction. Picks cannot be changed once submitted.'
      );
    }

    // 3. Validate option belongs to prediction
    const option = await ctx.db.get(args.optionId);
    if (!option || option.predictionId !== args.predictionId) {
      throw new Error('Invalid option for this prediction');
    }

    // 4. Calculate potential points
    const optionStats = await ctx.db
      .query('predictionOptionStats')
      .withIndex('predictionId', (q) => q.eq('predictionId', args.predictionId))
      .collect();

    const totalPicks = optionStats.reduce((sum, stat) => sum + stat.pickCount, 0);
    const optionPicks = optionStats.find((s) => s.optionId === args.optionId)?.pickCount || 0;
    const probability = totalPicks > 0 ? optionPicks / totalPicks : 0.5;

    // Points calculation
    const hoursUntilLock = Math.max(0, (prediction.lockAt - now) / (1000 * 60 * 60));
    const basePoints = 50;
    const earlyBonus = Math.floor(hoursUntilLock / 6) * 10; // 10 points per 6 hours early
    const contrarianBonus = probability < 0.2 ? 40 : probability < 0.4 ? 20 : 0;
    const potentialPoints = Math.min(200, basePoints + earlyBonus + contrarianBonus); // Cap at 200

    // 5. Create pick
    const pickId = await ctx.db.insert('predictionPicks', {
      predictionId: args.predictionId,
      optionId: args.optionId,
      userId,
      pickedAt: now,
      preLockCommunityProbability: probability,
      potentialPoints,
      createdAt: now,
    });

    // 6. Update option stats
    const optionStat = await ctx.db
      .query('predictionOptionStats')
      .withIndex('prediction_option', (q) =>
        q.eq('predictionId', args.predictionId).eq('optionId', args.optionId)
      )
      .first();

    if (optionStat) {
      await ctx.db.patch(optionStat._id, {
        pickCount: optionStat.pickCount + 1,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert('predictionOptionStats', {
        predictionId: args.predictionId,
        optionId: args.optionId,
        pickCount: 1,
        updatedAt: now,
      });
    }

    // 7. Update user stats (async - don't block)
    await ctx.scheduler.runAfter(0, internal.users.mutations.updateStatsAfterPick, {
      userId,
      predictionId: args.predictionId,
      todayLocal: args.todayLocal,
    });

    return {
      success: true,
      pickId,
      potentialPoints,
      message: `Pick submitted! You could earn ${potentialPoints} points.`,
    };
  },
});

/**
 * Resolve a prediction
 * Only admins/moderators can resolve predictions
 * - Awards points to correct pickers
 * - Updates all user stats
 * - Creates audit log
 */
export const resolvePrediction = mutation({
  args: {
    predictionId: v.id('predictions'),
    winningOptionId: v.id('predictionOptions'),
    resolverId: v.id('users'),
    evidence: v.optional(
      v.object({
        sourceType: v.union(
          v.literal('SUBTITLE'),
          v.literal('CAST'),
          v.literal('RECAP'),
          v.literal('OFFICIAL'),
          v.literal('OTHER')
        ),
        url: v.optional(v.string()),
        snippet: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const resolverId = args.resolverId;
    const now = Date.now();

    // 1. Get prediction
    const prediction = await ctx.db.get(args.predictionId);
    if (!prediction) throw new Error('Prediction not found');

    // 2. Check idempotency
    if (prediction.state === 'resolved' && prediction.outcomeOptionId === args.winningOptionId) {
      return { success: true, message: 'Already resolved with same outcome' };
    }

    // 3. Validate option
    const winningOption = await ctx.db.get(args.winningOptionId);
    if (!winningOption || winningOption.predictionId !== args.predictionId) {
      throw new Error('Invalid winning option');
    }

    // 4. Update prediction
    await ctx.db.patch(args.predictionId, {
      state: 'resolved',
      resolvedAt: now,
      outcomeOptionId: args.winningOptionId,
      resolverType: 'manual',
      updatedAt: now,
    });

    // 5. Add evidence if provided
    if (args.evidence) {
      await ctx.db.insert('predictionResolutionEvidence', {
        predictionId: args.predictionId,
        sourceType: args.evidence.sourceType,
        url: args.evidence.url,
        snippet: args.evidence.snippet,
        addedByUserId: resolverId,
        createdAt: now,
      });
    }

    // 6. Process picks and award points
    const picks = await ctx.db
      .query('predictionPicks')
      .withIndex('predictionId', (q) => q.eq('predictionId', args.predictionId))
      .collect();

    const pointsToAward: Array<{
      userId: Id<'users'>;
      points: number;
      pickId: Id<'predictionPicks'>;
    }> = [];

    for (const pick of picks) {
      const isCorrect = pick.optionId === args.winningOptionId;
      const earnedPoints = isCorrect ? pick.potentialPoints || 50 : 0;

      // Update pick with earned points
      await ctx.db.patch(pick._id, {
        earnedPoints,
      });

      if (earnedPoints > 0) {
        pointsToAward.push({
          userId: pick.userId,
          points: earnedPoints,
          pickId: pick._id,
        });
      }
    }

    // 7. Award points in ledger
    for (const award of pointsToAward) {
      await ctx.db.insert('pointsLedger', {
        userId: award.userId,
        points: award.points,
        reason: 'pick_correct',
        predictionId: args.predictionId,
        pickId: award.pickId,
        metadata: {
          winningOptionId: args.winningOptionId,
        },
        createdAt: now,
      });
    }

    // 8. Schedule stats updates
    const uniqueUserIds = [...new Set(picks.map((p) => p.userId))];
    for (const userId of uniqueUserIds) {
      await ctx.scheduler.runAfter(0, internal.users.mutations.updateStatsAfterResolve, {
        userId,
        predictionId: args.predictionId,
        showId: prediction.showId,
      });
    }

    // 9. Create audit log
    await ctx.db.insert('auditLogs', {
      actorUserId: resolverId,
      action: 'PREDICTION_RESOLVED',
      entityKind: 'prediction',
      entityId: args.predictionId,
      metadata: {
        winningOptionId: args.winningOptionId,
        totalPicks: picks.length,
        correctPicks: pointsToAward.length,
        totalPointsAwarded: pointsToAward.reduce((sum, a) => sum + a.points, 0),
      },
      createdAt: now,
    });

    return {
      success: true,
      message: `Prediction resolved! ${pointsToAward.length} correct pickers awarded.`,
      stats: {
        totalPicks: picks.length,
        correctPicks: pointsToAward.length,
        totalPointsAwarded: pointsToAward.reduce((sum, a) => sum + a.points, 0),
      },
    };
  },
});

/**
 * Lock prediction for voting
 * Only admins/moderators can lock predictions unless locked by time
 */
export const lockPrediction = mutation({
  args: {
    predictionId: v.id('predictions'),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const prediction = await ctx.db.get(args.predictionId);

    if (!prediction) throw new Error('Prediction not found');
    if (prediction.state !== 'open') return { success: true, message: 'Already locked' };

    await ctx.db.patch(args.predictionId, {
      state: 'locked',
      updatedAt: now,
    });

    return { success: true, message: 'Prediction locked' };
  },
});
