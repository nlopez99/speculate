import { v } from 'convex/values';
import { query } from '../_generated/server';
import { Id } from '../_generated/dataModel';

/**
 * Get current user's profile
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const userId = identity.subject as Id<'users'>;

    // Get user
    const user = await ctx.db.get(userId);
    if (!user) return null;

    // Get stats
    const stats = await ctx.db
      .query('userStats')
      .withIndex('userId', (q) => q.eq('userId', userId))
      .first();

    // Calculate level
    const level = calculateLevel(stats?.lifetimePoints || 0);

    // Get rank
    const leaderboard = await ctx.db
      .query('leaderboards')
      .withIndex('kind_period', (q) => q.eq('kind', 'global').eq('periodKey', 'all_time'))
      .first();

    let rank = null;
    if (leaderboard) {
      const entry = leaderboard.top.find((e) => e.userId === userId);
      rank = entry?.rank || null;
    }

    // Get follow counts
    const followersCount = await ctx.db
      .query('follows')
      .withIndex('followingId', (q) => q.eq('followingId', userId))
      .collect()
      .then((f) => f.length);

    const followingCount = await ctx.db
      .query('follows')
      .withIndex('followerId', (q) => q.eq('followerId', userId))
      .collect()
      .then((f) => f.length);

    // Get show follow count
    const showFollowCount = await ctx.db
      .query('showFollows')
      .withIndex('userId', (q) => q.eq('userId', userId))
      .collect()
      .then((f) => f.length);

    return {
      ...user,
      stats: {
        totalPicks: stats?.totalPicks || 0,
        correctPicks: stats?.correctPicks || 0,
        accuracy: stats?.accuracy || 0,
        pointsBalance: stats?.pointsBalance || 0,
        lifetimePoints: stats?.lifetimePoints || 0,
        currentStreak: stats?.currentStreak || 0,
        bestStreak: stats?.bestStreak || 0,
        level: level.name,
        levelProgress: level.progress,
        rank,
      },
      social: {
        followersCount,
        followingCount,
        showFollowCount,
      },
    };
  },
});

/**
 * Get user profile by ID or handle
 */
export const getUserProfile = query({
  args: {
    userId: v.optional(v.id('users')),
    handle: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.userId && !args.handle) {
      throw new Error('Must provide userId or handle');
    }

    const identity = await ctx.auth.getUserIdentity();
    const currentUserId = identity?.subject as Id<'users'> | undefined;

    // Find user
    let user;
    if (args.userId) {
      user = await ctx.db.get(args.userId);
    } else {
      user = await ctx.db
        .query('users')
        .withIndex('handle', (q) => q.eq('handle', args.handle))
        .first();
    }

    if (!user) throw new Error('User not found');

    // Get stats
    const stats = await ctx.db
      .query('userStats')
      .withIndex('userId', (q) => q.eq('userId', user._id))
      .first();

    // Calculate level
    const level = calculateLevel(stats?.lifetimePoints || 0);

    // Get rank
    const leaderboard = await ctx.db
      .query('leaderboards')
      .withIndex('kind_period', (q) => q.eq('kind', 'global').eq('periodKey', 'all_time'))
      .first();

    let rank = null;
    if (leaderboard) {
      const entry = leaderboard.top.find((e) => e.userId === user._id);
      rank = entry?.rank || null;
    }

    // Get social stats
    const followersCount = await ctx.db
      .query('follows')
      .withIndex('followingId', (q) => q.eq('followingId', user._id))
      .collect()
      .then((f) => f.length);

    const followingCount = await ctx.db
      .query('follows')
      .withIndex('followerId', (q) => q.eq('followerId', user._id))
      .collect()
      .then((f) => f.length);

    // Check if current user follows this user
    let isFollowing = false;
    if (currentUserId && currentUserId !== user._id) {
      const follow = await ctx.db
        .query('follows')
        .withIndex('pair', (q) => q.eq('followerId', currentUserId).eq('followingId', user._id))
        .first();
      isFollowing = !!follow;
    }

    // Get recent achievements
    const achievements = await ctx.db
      .query('userAchievements')
      .withIndex('userId', (q) => q.eq('userId', user._id))
      .order('desc')
      .take(5);

    const enrichedAchievements = await Promise.all(
      achievements.map(async (ua) => {
        const achievement = await ctx.db
          .query('achievements')
          .withIndex('key', (q) => q.eq('key', ua.achievementKey))
          .first();
        return {
          ...ua,
          name: achievement?.name,
          description: achievement?.description,
          iconUrl: achievement?.iconUrl,
        };
      })
    );

    // Get top shows (best performance)
    const showStats = await ctx.db
      .query('userShowStats')
      .withIndex('userId', (q) => q.eq('userId', user._id))
      .collect();

    showStats.sort((a, b) => b.accuracy - a.accuracy);

    const topShows = await Promise.all(
      showStats.slice(0, 3).map(async (stat) => {
        const show = await ctx.db.get(stat.showId);
        return {
          showId: stat.showId,
          showTitle: show?.title,
          showSlug: show?.slug,
          accuracy: stat.accuracy,
          totalPredictions: stat.totalPredictions,
        };
      })
    );

    return {
      _id: user._id,
      handle: user.handle,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      createdAt: user.createdAt,
      isCurrentUser: user._id === currentUserId,
      isFollowing,
      stats: {
        totalPicks: stats?.totalPicks || 0,
        correctPicks: stats?.correctPicks || 0,
        accuracy: stats?.accuracy || 0,
        pointsBalance: stats?.pointsBalance || 0,
        lifetimePoints: stats?.lifetimePoints || 0,
        currentStreak: stats?.currentStreak || 0,
        bestStreak: stats?.bestStreak || 0,
        level: level.name,
        rank,
      },
      social: {
        followersCount,
        followingCount,
      },
      achievements: enrichedAchievements,
      topShows,
    };
  },
});

/**
 * Get user's recent activity
 */
export const getUserActivity = query({
  args: {
    userId: v.optional(v.id('users')),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const targetUserId = args.userId || (identity?.subject as Id<'users'>);

    if (!targetUserId) throw new Error('User not specified');

    const limit = args.limit || 20;
    const activities: any[] = [];

    // Get recent picks
    const recentPicks = await ctx.db
      .query('predictionPicks')
      .withIndex('userId', (q) => q.eq('userId', targetUserId))
      .order('desc')
      .take(limit);

    // Enrich picks with prediction info
    for (const pick of recentPicks) {
      const prediction = await ctx.db.get(pick.predictionId);
      if (prediction) {
        const show = await ctx.db.get(prediction.showId);
        const option = await ctx.db.get(pick.optionId);

        activities.push({
          type: 'pick',
          timestamp: pick.pickedAt,
          data: {
            predictionId: prediction._id,
            showTitle: show?.title,
            optionLabel: option?.label,
            potentialPoints: pick.potentialPoints,
            earnedPoints: pick.earnedPoints,
            status: prediction.state,
            isCorrect: prediction.outcomeOptionId === pick.optionId,
          },
        });
      }
    }

    // Get recent comments
    const recentComments = await ctx.db
      .query('comments')
      .withIndex('userId', (q) => q.eq('userId', targetUserId))
      .order('desc')
      .take(Math.floor(limit / 2));

    // Enrich comments
    for (const comment of recentComments) {
      if (comment.isDeleted) continue;

      let context = null;
      if (comment.predictionId) {
        const prediction = await ctx.db.get(comment.predictionId);
        const show = prediction ? await ctx.db.get(prediction.showId) : null;
        context = {
          type: 'prediction',
          showTitle: show?.title,
        };
      } else if (comment.episodeId) {
        const episode = await ctx.db.get(comment.episodeId);
        const show = episode ? await ctx.db.get(episode.showId) : null;
        context = {
          type: 'episode',
          episodeTitle: episode?.title,
          showTitle: show?.title,
        };
      }

      activities.push({
        type: 'comment',
        timestamp: comment.createdAt,
        data: {
          commentId: comment._id,
          snippet: comment.body.substring(0, 100),
          upvotes: comment.upvotes || 0,
          context,
        },
      });
    }

    // Get recent achievements
    const recentAchievements = await ctx.db
      .query('userAchievements')
      .withIndex('userId', (q) => q.eq('userId', targetUserId))
      .order('desc')
      .take(5);

    for (const ua of recentAchievements) {
      const achievement = await ctx.db
        .query('achievements')
        .withIndex('key', (q) => q.eq('key', ua.achievementKey))
        .first();

      activities.push({
        type: 'achievement',
        timestamp: ua.awardedAt,
        data: {
          name: achievement?.name,
          description: achievement?.description,
          iconUrl: achievement?.iconUrl,
        },
      });
    }

    // Sort all activities by timestamp
    activities.sort((a, b) => b.timestamp - a.timestamp);

    return activities.slice(0, limit);
  },
});

/**
 * Get user's followers
 */
export const getUserFollowers = query({
  args: {
    userId: v.id('users'),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;

    // Get follower relationships
    const follows = await ctx.db
      .query('follows')
      .withIndex('followingId', (q) => q.eq('followingId', args.userId))
      .order('desc')
      .take(limit);

    // Get follower details
    const followers = await Promise.all(
      follows.map(async (follow) => {
        const user = await ctx.db.get(follow.followerId);
        const stats = await ctx.db
          .query('userStats')
          .withIndex('userId', (q) => q.eq('userId', follow.followerId))
          .first();

        return {
          userId: follow.followerId,
          handle: user?.handle,
          displayName: user?.displayName,
          avatarUrl: user?.avatarUrl,
          accuracy: stats?.accuracy || 0,
          lifetimePoints: stats?.lifetimePoints || 0,
          followedAt: follow.createdAt,
        };
      })
    );

    return {
      followers,
      hasMore: follows.length === limit,
    };
  },
});

/**
 * Get user's following
 */
export const getUserFollowing = query({
  args: {
    userId: v.id('users'),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;

    // Get following relationships
    const follows = await ctx.db
      .query('follows')
      .withIndex('followerId', (q) => q.eq('followerId', args.userId))
      .order('desc')
      .take(limit);

    // Get following details
    const following = await Promise.all(
      follows.map(async (follow) => {
        const user = await ctx.db.get(follow.followingId);
        const stats = await ctx.db
          .query('userStats')
          .withIndex('userId', (q) => q.eq('userId', follow.followingId))
          .first();

        return {
          userId: follow.followingId,
          handle: user?.handle,
          displayName: user?.displayName,
          avatarUrl: user?.avatarUrl,
          accuracy: stats?.accuracy || 0,
          lifetimePoints: stats?.lifetimePoints || 0,
          followedAt: follow.createdAt,
        };
      })
    );

    return {
      following,
      hasMore: follows.length === limit,
    };
  },
});

/**
 * Search users
 */
export const searchUsers = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    const searchQuery = args.query.toLowerCase();

    // Search by handle (starts with)
    const byHandle = await ctx.db
      .query('users')
      .withIndex('handle')
      .filter((q) => q.gte(q.field('handle'), searchQuery))
      .take(limit);

    // Filter to only those that actually match
    const matches = byHandle.filter(
      (u) =>
        u.handle?.toLowerCase().startsWith(searchQuery) ||
        u.displayName?.toLowerCase().includes(searchQuery)
    );

    // Enrich with stats
    const enriched = await Promise.all(
      matches.map(async (user) => {
        const stats = await ctx.db
          .query('userStats')
          .withIndex('userId', (q) => q.eq('userId', user._id))
          .first();

        return {
          _id: user._id,
          handle: user.handle,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          bio: user.bio,
          accuracy: stats?.accuracy || 0,
          lifetimePoints: stats?.lifetimePoints || 0,
        };
      })
    );

    // Sort by points
    enriched.sort((a, b) => b.lifetimePoints - a.lifetimePoints);

    return enriched;
  },
});

/**
 * Get suggested users to follow
 */
export const getSuggestedUsers = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const userId = identity.subject as Id<'users'>;
    const limit = args.limit || 10;

    // Get current user's followed shows
    const userShows = await ctx.db
      .query('showFollows')
      .withIndex('userId', (q) => q.eq('userId', userId))
      .collect();

    const showIds = userShows.map((s) => s.showId);

    // Get users who follow similar shows
    const similarUsers = new Map<string, number>();

    for (const showId of showIds) {
      const showFollowers = await ctx.db
        .query('showFollows')
        .withIndex('showId', (q) => q.eq('showId', showId))
        .take(100);

      for (const follower of showFollowers) {
        if (follower.userId !== userId) {
          const current = similarUsers.get(follower.userId) || 0;
          similarUsers.set(follower.userId, current + 1);
        }
      }
    }

    // Get current user's following to exclude
    const following = await ctx.db
      .query('follows')
      .withIndex('followerId', (q) => q.eq('followerId', userId))
      .collect();

    const followingIds = new Set(following.map((f) => f.followingId));

    // Filter and sort by similarity
    const candidates = Array.from(similarUsers.entries())
      .filter(([uid]) => !followingIds.has(uid as Id<'users'>))
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit * 2); // Get extra to filter

    // Get user details and stats
    const suggestions = await Promise.all(
      candidates.map(async ([uid, sharedShows]) => {
        const user = await ctx.db.get(uid as Id<'users'>);
        if (!user) return null;

        const stats = await ctx.db
          .query('userStats')
          .withIndex('userId', (q) => q.eq('userId', uid as Id<'users'>))
          .first();

        // Get mutual followers
        const mutualFollowers = await ctx.db
          .query('follows')
          .withIndex('followingId', (q) => q.eq('followingId', uid as Id<'users'>))
          .filter((q) => followingIds.has(q.field('followerId') as any))
          .collect();

        return {
          _id: user._id,
          handle: user.handle,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          bio: user.bio,
          accuracy: stats?.accuracy || 0,
          lifetimePoints: stats?.lifetimePoints || 0,
          sharedShows,
          mutualFollowers: mutualFollowers.length,
          score: sharedShows * 2 + mutualFollowers.length + (stats?.accuracy || 0) / 20,
        };
      })
    );

    // Filter nulls, sort by score, and return top suggestions
    return suggestions
      .filter((s) => s !== null)
      .sort((a, b) => b!.score - a!.score)
      .slice(0, limit)
      .map(({ score, ...user }) => user); // Remove score from output
  },
});

/**
 * Get user's predictions history
 */
export const getUserPredictions = query({
  args: {
    userId: v.optional(v.id('users')),
    showId: v.optional(v.id('shows')),
    status: v.optional(v.union(v.literal('pending'), v.literal('correct'), v.literal('incorrect'))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const targetUserId = args.userId || (identity?.subject as Id<'users'>);

    if (!targetUserId) throw new Error('User not specified');

    const limit = args.limit || 50;

    // Get user's picks
    let picks = await ctx.db
      .query('predictionPicks')
      .withIndex('userId', (q) => q.eq('userId', targetUserId))
      .order('desc')
      .take(limit * 2); // Get extra for filtering

    // Enrich and filter
    const enrichedPicks = await Promise.all(
      picks.map(async (pick) => {
        const prediction = await ctx.db.get(pick.predictionId);
        if (!prediction) return null;

        // Filter by show if specified
        if (args.showId && prediction.showId !== args.showId) return null;

        const show = await ctx.db.get(prediction.showId);
        const option = await ctx.db.get(pick.optionId);
        const winningOption = prediction.outcomeOptionId
          ? await ctx.db.get(prediction.outcomeOptionId)
          : null;

        // Determine status
        let status: 'pending' | 'correct' | 'incorrect' = 'pending';
        if (prediction.state === 'resolved') {
          status = pick.optionId === prediction.outcomeOptionId ? 'correct' : 'incorrect';
        }

        // Filter by status if specified
        if (args.status && status !== args.status) return null;

        // Get episode info if available
        let episode = null;
        if (prediction.episodeId) {
          episode = await ctx.db.get(prediction.episodeId);
        }

        return {
          pickId: pick._id,
          pickedAt: pick.pickedAt,
          predictionId: prediction._id,
          showTitle: show?.title,
          showSlug: show?.slug,
          episodeTitle: episode?.title,
          seasonNumber: episode?.seasonNumber,
          episodeNumber: episode?.episodeNumber,
          templateKey: prediction.templateKey,
          pickedOption: option?.label,
          winningOption: winningOption?.label,
          status,
          potentialPoints: pick.potentialPoints,
          earnedPoints: pick.earnedPoints || 0,
          predictionState: prediction.state,
        };
      })
    );

    // Filter nulls and limit
    return enrichedPicks.filter((p) => p !== null).slice(0, limit);
  },
});

// Helper function
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
