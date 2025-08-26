import { v } from 'convex/values';
import { mutation, internalMutation } from '../_generated/server';
import { Id } from '../_generated/dataModel';

/**
 * Internal: Update user stats after pick
 */
export const updateStatsAfterPick = internalMutation({
  args: {
    userId: v.id('users'),
    predictionId: v.id('predictions'),
    todayLocal: v.optional(v.string()), // Client's local date YYYY-MM-DD
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Use client-provided local day if available, otherwise use UTC
    const today = args.todayLocal || new Date(now).toISOString().split('T')[0];

    // Get or create user stats
    let stats = await ctx.db
      .query('userStats')
      .withIndex('userId', (q) => q.eq('userId', args.userId))
      .first();

    if (!stats) {
      // Create initial stats
      await ctx.db.insert('userStats', {
        userId: args.userId,
        totalPicks: 1,
        correctPicks: 0,
        accuracy: 0,
        pointsBalance: 0,
        lifetimePoints: 0,
        currentStreak: 1,
        bestStreak: 1,
        lastActiveDay: today,
        updatedAt: now,
      });
      return;
    }

    // Update streak
    const lastActive = stats.lastActiveDay;
    
    // Calculate yesterday based on the current day
    // If client provided local day, calculate yesterday from that
    const getYesterday = (todayStr: string) => {
      const today = new Date(todayStr + 'T00:00:00Z');
      const yesterday = new Date(today.getTime() - 86400000);
      return yesterday.toISOString().split('T')[0];
    };
    
    const yesterday = getYesterday(today);

    let newStreak = stats.currentStreak;
    let bestStreak = stats.bestStreak;

    if (lastActive !== today) {
      if (lastActive === yesterday) {
        // Consecutive day
        newStreak += 1;
        bestStreak = Math.max(bestStreak, newStreak);
      } else {
        // Streak broken
        newStreak = 1;
      }
    }

    await ctx.db.patch(stats._id, {
      totalPicks: stats.totalPicks + 1,
      currentStreak: newStreak,
      bestStreak,
      lastActiveDay: today,
      updatedAt: now,
    });

    // Update show-specific stats
    const prediction = await ctx.db.get(args.predictionId);
    if (prediction) {
      let showStats = await ctx.db
        .query('userShowStats')
        .withIndex('user_show', (q) => q.eq('userId', args.userId).eq('showId', prediction.showId))
        .first();

      if (showStats) {
        await ctx.db.patch(showStats._id, {
          totalPredictions: showStats.totalPredictions + 1,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert('userShowStats', {
          userId: args.userId,
          showId: prediction.showId,
          totalPredictions: 1,
          correctPredictions: 0,
          accuracy: 0,
          updatedAt: now,
        });
      }
    }
  },
});

/**
 * Internal: Update user stats after prediction resolution
 */
export const updateStatsAfterResolve = internalMutation({
  args: {
    userId: v.id('users'),
    predictionId: v.id('predictions'),
    showId: v.id('shows'),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get user's pick for this prediction
    const pick = await ctx.db
      .query('predictionPicks')
      .withIndex('prediction_user', (q) =>
        q.eq('predictionId', args.predictionId).eq('userId', args.userId)
      )
      .first();

    if (!pick) return;

    const isCorrect = (pick.earnedPoints || 0) > 0;
    const pointsEarned = pick.earnedPoints || 0;

    // Update global stats
    const stats = await ctx.db
      .query('userStats')
      .withIndex('userId', (q) => q.eq('userId', args.userId))
      .first();

    if (stats) {
      const newCorrect = stats.correctPicks + (isCorrect ? 1 : 0);
      const newAccuracy = stats.totalPicks > 0 ? newCorrect / stats.totalPicks : 0;

      await ctx.db.patch(stats._id, {
        correctPicks: newCorrect,
        accuracy: newAccuracy,
        pointsBalance: stats.pointsBalance + pointsEarned,
        lifetimePoints: stats.lifetimePoints + pointsEarned,
        updatedAt: now,
      });
    }

    // Update show stats
    const showStats = await ctx.db
      .query('userShowStats')
      .withIndex('user_show', (q) => q.eq('userId', args.userId).eq('showId', args.showId))
      .first();

    if (showStats) {
      const newCorrect = showStats.correctPredictions + (isCorrect ? 1 : 0);
      const newAccuracy =
        showStats.totalPredictions > 0 ? newCorrect / showStats.totalPredictions : 0;

      await ctx.db.patch(showStats._id, {
        correctPredictions: newCorrect,
        accuracy: newAccuracy,
        updatedAt: now,
      });
    }
  },
});

/**
 * Update user profile
 */
export const updateProfile = mutation({
  args: {
    handle: v.optional(v.string()),
    displayName: v.optional(v.string()),
    bio: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    timezone: v.optional(v.string()),
    allowDMs: v.optional(v.boolean()),
    notifOptIn: v.optional(v.boolean()),
    spoilerSafeDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    const userId = identity.subject as Id<'users'>;
    const now = Date.now();

    // Validate handle uniqueness if changing
    if (args.handle) {
      const existing = await ctx.db
        .query('users')
        .withIndex('handle', (q) => q.eq('handle', args.handle))
        .first();

      if (existing && existing._id !== userId) {
        throw new Error('Handle already taken');
      }

      // Validate handle format
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(args.handle)) {
        throw new Error('Handle must be 3-20 characters, alphanumeric and underscore only');
      }
    }

    // Update user
    const updates: any = { ...args, updatedAt: now };
    await ctx.db.patch(userId, updates);

    return { success: true };
  },
});

/**
 * Follow/unfollow user
 */
export const toggleFollow = mutation({
  args: {
    targetUserId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    const userId = identity.subject as Id<'users'>;

    if (userId === args.targetUserId) {
      throw new Error('Cannot follow yourself');
    }

    // Check if already following
    const existing = await ctx.db
      .query('follows')
      .withIndex('pair', (q) => q.eq('followerId', userId).eq('followingId', args.targetUserId))
      .first();

    if (existing) {
      // Unfollow
      await ctx.db.delete(existing._id);
      return { success: true, following: false };
    } else {
      // Follow
      await ctx.db.insert('follows', {
        followerId: userId,
        followingId: args.targetUserId,
        createdAt: Date.now(),
      });

      // TODO: Create notification for the followed user

      return { success: true, following: true };
    }
  },
});

/**
 * Follow/unfollow show
 */
export const toggleShowFollow = mutation({
  args: {
    showId: v.id('shows'),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    const userId = identity.subject as Id<'users'>;
    const now = Date.now();

    // Check if already following
    const existing = await ctx.db
      .query('showFollows')
      .withIndex('user_show', (q) => q.eq('userId', userId).eq('showId', args.showId))
      .first();

    if (existing) {
      // Unfollow
      await ctx.db.delete(existing._id);

      // Update show follower count
      const show = await ctx.db.get(args.showId);
      if (show) {
        await ctx.db.patch(args.showId, {
          followersCount: Math.max(0, (show.followersCount || 0) - 1),
          updatedAt: now,
        });
      }

      return { success: true, following: false };
    } else {
      // Follow
      await ctx.db.insert('showFollows', {
        userId,
        showId: args.showId,
        createdAt: now,
      });

      // Update show follower count
      const show = await ctx.db.get(args.showId);
      if (show) {
        await ctx.db.patch(args.showId, {
          followersCount: (show.followersCount || 0) + 1,
          updatedAt: now,
        });
      }

      return { success: true, following: true };
    }
  },
});

/**
 * Update user progress for a show
 */
export const updateShowProgress = mutation({
  args: {
    showId: v.id('shows'),
    episodeId: v.optional(v.id('episodes')),
    seasonNumber: v.optional(v.number()),
    episodeNumber: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    const userId = identity.subject as Id<'users'>;
    const now = Date.now();

    // Get or create progress record
    let progress = await ctx.db
      .query('userProgress')
      .withIndex('user_show', (q) => q.eq('userId', userId).eq('showId', args.showId))
      .first();

    if (progress) {
      // Update existing
      await ctx.db.patch(progress._id, {
        lastWatchedEpisodeId: args.episodeId,
        seasonNumber: args.seasonNumber,
        episodeNumber: args.episodeNumber,
        updatedAt: now,
      });
    } else {
      // Create new
      await ctx.db.insert('userProgress', {
        userId,
        showId: args.showId,
        lastWatchedEpisodeId: args.episodeId,
        seasonNumber: args.seasonNumber,
        episodeNumber: args.episodeNumber,
        updatedAt: now,
      });
    }

    return { success: true };
  },
});
