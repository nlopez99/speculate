import { v } from 'convex/values';
import { mutation, internalMutation } from '../_generated/server';
import { Id } from '../_generated/dataModel';
import { internal } from '../_generated/api';

/**
 * Toggle episode follow (heart)
 */
export const toggleEpisodeFollow = mutation({
  args: {
    episodeId: v.id('episodes'),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    const userId = identity.subject as Id<'users'>;

    const existing = await ctx.db
      .query('episodeFollows')
      .withIndex('user_episode', (q) => q.eq('userId', userId).eq('episodeId', args.episodeId))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { success: true, followed: false };
    } else {
      await ctx.db.insert('episodeFollows', {
        userId,
        episodeId: args.episodeId,
        createdAt: Date.now(),
      });
      return { success: true, followed: true };
    }
  },
});

/**
 * Track episode view
 */
export const trackView = mutation({
  args: {
    episodeId: v.id('episodes'),
  },
  handler: async (ctx, args) => {
    // Simple implementation - enhance with deduplication as needed
    await ctx.scheduler.runAfter(0, internal.episodes.mutations.updateStats, {
      episodeId: args.episodeId,
      incrementViews: true,
    });

    return { success: true };
  },
});

/**
 * Internal: Update episode stats
 */
export const updateStats = internalMutation({
  args: {
    episodeId: v.id('episodes'),
    incrementViews: v.optional(v.boolean()),
    incrementComments: v.optional(v.boolean()),
    incrementPredictions: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let stats = await ctx.db
      .query('episodeStats')
      .withIndex('episodeId', (q) => q.eq('episodeId', args.episodeId))
      .first();

    if (!stats) {
      await ctx.db.insert('episodeStats', {
        episodeId: args.episodeId,
        predictionsCount: args.incrementPredictions ? 1 : 0,
        commentsCount: args.incrementComments ? 1 : 0,
        viewsCount: args.incrementViews ? 1 : 0,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.patch(stats._id, {
        predictionsCount: stats.predictionsCount + (args.incrementPredictions ? 1 : 0),
        commentsCount: stats.commentsCount + (args.incrementComments ? 1 : 0),
        viewsCount: stats.viewsCount + (args.incrementViews ? 1 : 0),
        updatedAt: Date.now(),
      });
    }
  },
});
