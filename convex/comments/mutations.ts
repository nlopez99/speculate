import { v } from 'convex/values';
import { mutation } from '../_generated/server';
import { Id } from '../_generated/dataModel';
import { internal } from '../_generated/api';

/**
 * Create a comment
 */
export const createComment = mutation({
  args: {
    body: v.string(),
    predictionId: v.optional(v.id('predictions')),
    episodeId: v.optional(v.id('episodes')),
    parentId: v.optional(v.id('comments')),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    const userId = identity.subject as Id<'users'>;
    const now = Date.now();

    // Validate at least one target
    if (!args.predictionId && !args.episodeId) {
      throw new Error('Comment must be attached to a prediction or episode');
    }

    // Validate parent exists if provided
    if (args.parentId) {
      const parent = await ctx.db.get(args.parentId);
      if (!parent) throw new Error('Parent comment not found');
    }

    // Check for spoilers (basic implementation - enhance as needed)
    const containsSpoiler =
      args.body.toLowerCase().includes('spoiler') ||
      args.body.toLowerCase().includes('dies') ||
      args.body.toLowerCase().includes('kills');

    let visibleAfterUtc = undefined;
    if (containsSpoiler && args.episodeId) {
      const episode = await ctx.db.get(args.episodeId);
      if (episode?.airDateUtc && episode.airDateUtc > now) {
        visibleAfterUtc = episode.airDateUtc + 60 * 60 * 1000; // 1 hour after air
      }
    }

    const commentId = await ctx.db.insert('comments', {
      parentId: args.parentId,
      predictionId: args.predictionId,
      episodeId: args.episodeId,
      userId,
      body: args.body,
      upvotes: 0,
      downvotes: 0,
      containsSpoiler,
      visibleAfterUtc,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    });

    // Update episode stats if needed
    if (args.episodeId) {
      await ctx.scheduler.runAfter(0, internal.episodes.mutations.updateStats, {
        episodeId: args.episodeId,
        incrementComments: true,
      });
    }

    return { success: true, commentId };
  },
});

/**
 * Vote on a comment
 */
export const voteComment = mutation({
  args: {
    commentId: v.id('comments'),
    value: v.union(v.literal(-1), v.literal(0), v.literal(1)), // 0 to remove vote
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    const userId = identity.subject as Id<'users'>;
    const now = Date.now();

    // Get comment
    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error('Comment not found');
    if (comment.isDeleted) throw new Error('Cannot vote on deleted comment');

    // Get existing vote
    const existingVote = await ctx.db
      .query('commentVotes')
      .withIndex('comment_user', (q) => q.eq('commentId', args.commentId).eq('userId', userId))
      .first();

    // Calculate vote deltas
    const oldValue = existingVote?.value || 0;
    const newValue = args.value;
    const upDelta = (newValue === 1 ? 1 : 0) - (oldValue === 1 ? 1 : 0);
    const downDelta = (newValue === -1 ? 1 : 0) - (oldValue === -1 ? 1 : 0);

    // Update or delete vote
    if (args.value === 0) {
      // Remove vote
      if (existingVote) {
        await ctx.db.delete(existingVote._id);
      }
    } else {
      // Upsert vote
      if (existingVote) {
        await ctx.db.patch(existingVote._id, {
          value: args.value,
        });
      } else {
        await ctx.db.insert('commentVotes', {
          commentId: args.commentId,
          userId,
          value: args.value,
          createdAt: now,
        });
      }
    }

    // Recount votes from source of truth to prevent lost updates
    const [upvotes, downvotes] = await Promise.all([
      ctx.db
        .query('commentVotes')
        .withIndex('commentId', (q) => q.eq('commentId', args.commentId))
        .filter((q) => q.eq(q.field('value'), 1))
        .collect()
        .then(votes => votes.length),
      ctx.db
        .query('commentVotes')
        .withIndex('commentId', (q) => q.eq('commentId', args.commentId))
        .filter((q) => q.eq(q.field('value'), -1))
        .collect()
        .then(votes => votes.length),
    ]);
    
    // Update comment with exact counts
    await ctx.db.patch(args.commentId, {
      upvotes,
      downvotes,
      updatedAt: now,
    });

    return {
      success: true,
      newUpvotes: upvotes,
      newDownvotes: downvotes,
    };
  },
});

/**
 * Delete a comment (soft delete)
 */
export const deleteComment = mutation({
  args: {
    commentId: v.id('comments'),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    const userId = identity.subject as Id<'users'>;

    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error('Comment not found');
    if (comment.userId !== userId) throw new Error('Not authorized');

    await ctx.db.patch(args.commentId, {
      isDeleted: true,
      body: '[deleted]',
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});
