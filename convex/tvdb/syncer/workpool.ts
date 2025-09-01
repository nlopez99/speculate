import {
  Workpool,
  vWorkIdValidator,
  WorkId,
  RetryOption,
  EnqueueOptions,
} from '@convex-dev/workpool';
import { components } from '../../_generated/api';
import { internal } from '../../_generated/api';
import { v } from 'convex/values';
import { internalMutation } from '../../_generated/server';
import { Doc } from '../../_generated/dataModel';

// Create the workpool with appropriate settings for TVDB API syncing
export const tvdbSyncPool = new Workpool(components.tvdbSyncPool, {
  // Limit parallelism to avoid overwhelming TVDB API
  maxParallelism: 50,
  // Enable retries for idempotent sync operations
  retryActionsByDefault: true,
  defaultRetryBehavior: {
    maxAttempts: 3,
    initialBackoffMs: 3000,
    base: 2, // Exponential backoff
  },
  logLevel: 'ERROR' as const,
});

// Queue a sync operation for a TVDB entity
export const enqueueSyncEntity = internalMutation({
  args: {
    entityType: v.union(
      v.literal('series'),
      v.literal('season'),
      v.literal('episode'),
      v.literal('movie'),
      v.literal('person'),
      v.literal('company')
    ),
    entityId: v.string(),
    priority: v.optional(v.number()),
    force: v.optional(v.boolean()),
    shallow: v.optional(v.boolean()),
    metadata: v.optional(
      v.object({
        parentId: v.optional(v.string()),
        seasonNumber: v.optional(v.number()),
        episodeNumber: v.optional(v.number()),
        source: v.optional(
          v.union(
            v.literal('manual'),
            v.literal('cron'),
            v.literal('webhook'),
            v.literal('cascade')
          )
        ),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Enqueue based on entity type
    let workId: WorkId;
    const options: RetryOption & EnqueueOptions = {
      name: `sync-${args.entityType}-${args.entityId}`,

      // Use priority to schedule execution (lower priority = run sooner)
      // Priority 1 = high (immediate), 5 = medium (500ms), 10 = low (1000ms)
      runAfter: args.priority ? (args.priority - 1) * 100 : 1,
      // Retry configuration (uses defaults if not specified)
      retry: true,
      // Store context for monitoring/debugging
      context: {
        entityType: args.entityType,
        entityId: args.entityId,
        metadata: args.metadata,
      },
    };

    switch (args.entityType) {
      case 'series':
        workId = await tvdbSyncPool.enqueueAction(
          ctx,
          internal.tvdb.syncer.actions.syncSeries,
          {
            seriesId: args.entityId,
            options: {
              force: args.force,
              shallow: args.shallow,
              priority: args.priority,
            },
          },
          options
        );
        break;
      case 'season':
        workId = await tvdbSyncPool.enqueueAction(
          ctx,
          internal.tvdb.syncer.actions.syncSeason,
          {
            seasonId: args.entityId,
            options: {
              force: args.force,
              shallow: args.shallow,
              priority: args.priority,
            },
          },
          options
        );
        break;
      case 'episode':
        workId = await tvdbSyncPool.enqueueAction(
          ctx,
          internal.tvdb.syncer.actions.syncEpisode,
          {
            episodeId: args.entityId,
            options: {
              force: args.force,
              shallow: args.shallow,
              priority: args.priority,
            },
          },
          options
        );
        break;
      default:
        throw new Error(`Unsupported entity type: ${args.entityType}`);
    }

    return { workId, enqueued: true };
  },
});

// Handle completion of sync operations
export const handleSyncComplete = tvdbSyncPool.defineOnComplete({
  context: v.object({
    entityType: v.string(),
    entityId: v.string(),
    metadata: v.optional(
      v.object({
        parentId: v.optional(v.string()),
        seasonNumber: v.optional(v.number()),
        episodeNumber: v.optional(v.number()),
        source: v.optional(
          v.union(
            v.literal('manual'),
            v.literal('cron'),
            v.literal('webhook'),
            v.literal('cascade')
          )
        ),
      })
    ),
  }),
  handler: async (ctx, { workId, context, result }) => {
    // Log the result
    const now = Date.now();
    const syncLog: Omit<Doc<'tvdbSyncLog'>, '_id' | '_creationTime'> = {
      syncId: workId,
      entityType: context.entityType,
      entityId: context.entityId,
      action: 'sync',
      status:
        result.kind === 'success' ? 'completed' : result.kind === 'canceled' ? 'skipped' : 'failed',
      startedAt: now,
      completedAt: now,
      duration: 0,
      ...(result.kind === 'failed' ? { error: result.error } : {}),
    };

    await ctx.db.insert('tvdbSyncLog', syncLog);

    // Note: Child entities (seasons/episodes) are already queued by the sync actions themselves
    // No additional queuing logic needed here
  },
});

// Batch enqueue multiple sync operations
export const enqueueSyncBatch = internalMutation({
  args: {
    items: v.array(
      v.object({
        entityType: v.union(
          v.literal('series'),
          v.literal('season'),
          v.literal('episode'),
          v.literal('movie'),
          v.literal('person'),
          v.literal('company')
        ),
        entityId: v.string(),
        priority: v.optional(v.number()),
        metadata: v.optional(
          v.object({
            parentId: v.optional(v.string()),
            seasonNumber: v.optional(v.number()),
            episodeNumber: v.optional(v.number()),
            source: v.optional(
              v.union(
                v.literal('manual'),
                v.literal('cron'),
                v.literal('webhook'),
                v.literal('cascade')
              )
            ),
          })
        ),
      })
    ),
  },
  handler: async (ctx, args) => {
    const results = [];

    // Group by entity type for batch processing
    const seriesItems = args.items.filter((i) => i.entityType === 'series');
    const seasonItems = args.items.filter((i) => i.entityType === 'season');
    const episodeItems = args.items.filter((i) => i.entityType === 'episode');

    // Batch enqueue series syncs
    if (seriesItems.length > 0) {
      const batchArgs = seriesItems.map((item) => ({
        seriesId: item.entityId,
        options: {
          priority: item.priority ?? 5,
        },
      }));

      const workIds: WorkId[] = await tvdbSyncPool.enqueueActionBatch(
        ctx,
        internal.tvdb.syncer.actions.syncSeries,
        batchArgs,
        {
          retry: true,
        }
      );

      results.push(
        ...workIds.map((id, i) => ({
          entityId: seriesItems[i].entityId,
          entityType: 'series' as const,
          workId: id,
        }))
      );
    }

    // Batch enqueue season syncs
    if (seasonItems.length > 0) {
      const batchArgs = seasonItems.map((item) => ({
        seasonId: item.entityId,
        options: {
          priority: item.priority ?? 5,
        },
      }));

      const workIds: WorkId[] = await tvdbSyncPool.enqueueActionBatch(
        ctx,
        internal.tvdb.syncer.actions.syncSeason,
        batchArgs,
        {
          retry: true,
        }
      );

      results.push(
        ...workIds.map((id, i) => ({
          entityId: seasonItems[i].entityId,
          entityType: 'season' as const,
          workId: id,
        }))
      );
    }

    // Batch enqueue episode syncs
    if (episodeItems.length > 0) {
      const batchArgs = episodeItems.map((item) => ({
        episodeId: item.entityId,
        options: {
          priority: item.priority ?? 5,
        },
      }));

      const workIds: WorkId[] = await tvdbSyncPool.enqueueActionBatch(
        ctx,
        internal.tvdb.syncer.actions.syncEpisode,
        batchArgs,
        {
          retry: true,
        }
      );

      results.push(
        ...workIds.map((id, i) => ({
          entityId: episodeItems[i].entityId,
          entityType: 'episode' as const,
          workId: id,
        }))
      );
    }

    return { enqueued: results.length, results };
  },
});

// Get status of a sync operation
export const getSyncStatus = internalMutation({
  args: {
    workId: vWorkIdValidator,
  },
  handler: async (ctx, args) => {
    return await tvdbSyncPool.status(ctx, args.workId);
  },
});

// Cancel a sync operation
export const cancelSync = internalMutation({
  args: {
    workId: vWorkIdValidator,
  },
  handler: async (ctx, args) => {
    await tvdbSyncPool.cancel(ctx, args.workId);
    return { canceled: true };
  },
});

// Cancel all pending sync operations
export const cancelAllSyncs = internalMutation({
  handler: async (ctx) => {
    const count = await tvdbSyncPool.cancelAll(ctx);
    return { canceledCount: count };
  },
});
