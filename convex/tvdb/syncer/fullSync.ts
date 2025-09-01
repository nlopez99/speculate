'use node';

import { action, internalAction } from '../../_generated/server';
import { internal } from '../../_generated/api';
import { v } from 'convex/values';
import { getAuthenticatedClient } from './client';

// ============================================================================
// Full Database Sync - Build from scratch
// ============================================================================

export const buildFullDatabase = internalAction({
  args: {
    startPage: v.optional(v.number()),
    resumeFromId: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    syncId: string;
    success: boolean;
    totalPages: number;
    totalSeries: number;
    message: string;
  }> => {
    const startPage = args.startPage ?? 0;
    const batchSize = args.batchSize ?? 500; // TVDB default page size

    // Log the sync session
    const syncId = `full_sync_${Date.now()}`;
    await ctx.runMutation(internal.tvdb.syncer.internalMutations.logSyncStart, {
      syncId,
      entityType: 'full_database',
      metadata: { startPage, batchSize },
    });

    try {
      // Start iterating through all series
      const result = await ctx.runAction(internal.tvdb.syncer.fullSync.syncAllSeriesPage, {
        page: startPage,
        syncId,
        batchSize,
        resumeFromId: args.resumeFromId,
      });

      return {
        syncId,
        success: true,
        totalPages: result.totalPages,
        totalSeries: result.totalSeries,
        message: `Full database sync initiated. Processing ${result.totalSeries} series across ${result.totalPages} pages.`,
      };
    } catch (error) {
      await ctx.runMutation(internal.tvdb.syncer.internalMutations.logSyncError, {
        syncId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  },
});

export const syncAllSeriesPage = internalAction({
  args: {
    page: v.number(),
    syncId: v.string(),
    batchSize: v.number(),
    resumeFromId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get authenticated client (reuses existing token)
    const client = await getAuthenticatedClient();

    // Get series for this page
    const response = await client.getAllSeries(args.page);

    if (!response.data || response.data.length === 0) {
      return {
        page: args.page,
        totalPages: 0,
        totalSeries: 0,
        processed: 0,
        hasMore: false,
      };
    }

    const series = response.data;
    const links = response.links;

    // Resume from a specific ID if provided (for recovery)
    let startProcessing = !args.resumeFromId;
    let processed = 0;
    let skipped = 0;

    for (const show of series) {
      if (!startProcessing) {
        if (show.id?.toString() === args.resumeFromId) {
          startProcessing = true;
        } else {
          skipped++;
          continue;
        }
      }

      if (!show.id) continue;

      try {
        // Queue the series for deep sync using workpool
        await ctx.runMutation(internal.tvdb.syncer.workpool.enqueueSyncEntity, {
          entityType: 'series',
          entityId: show.id.toString(),
          priority: 5, // Medium priority for bulk sync
          metadata: {
            source: 'manual',
          },
        });

        processed++;

        // Log progress every 100 series
        if (processed % 100 === 0) {
          await ctx.runMutation(internal.tvdb.syncer.internalMutations.logSyncProgress, {
            syncId: args.syncId,
            message: `Page ${args.page}: Processed ${processed} series (skipped ${skipped})`,
            metadata: {
              page: args.page,
              processed,
              skipped,
              currentSeriesId: show.id.toString(),
              currentSeriesName: show.name,
            },
          });
        }
      } catch (error) {
        console.error(`Failed to queue series ${show.id}: ${error}`);
        // Continue with next series even if one fails
      }
    }

    // Process next page if available
    const hasNextPage = links?.next !== undefined && links.next !== null;

    if (hasNextPage && links?.next) {
      // Schedule next page processing
      await ctx.scheduler.runAfter(1000, internal.tvdb.syncer.fullSync.syncAllSeriesPage, {
        page: parseInt(links.next, 10),
        syncId: args.syncId,
        batchSize: args.batchSize,
      });
    } else {
      // Mark sync as complete
      await ctx.runMutation(internal.tvdb.syncer.internalMutations.logSyncComplete, {
        syncId: args.syncId,
        metadata: {
          totalPages: args.page + 1,
          totalSeries: args.page * args.batchSize + processed,
        },
      });
    }

    return {
      page: args.page,
      totalPages: links?.last || args.page,
      totalSeries: links?.total_items || processed,
      processed,
      skipped,
      hasMore: hasNextPage,
    };
  },
});

// ============================================================================
// Incremental Update Sync - DEPRECATED
// ============================================================================
// Use syncUpdates from actions.ts instead - it's the canonical implementation
// The cron job correctly uses the one from actions.ts

// ============================================================================
// Status and Monitoring
// ============================================================================

interface SyncLog {
  action: string;
  timestamp?: number;
  metadata?: any;
  message?: string;
}

interface QueueStatus {
  pending: number;
  ready: number;
  failed: number;
}

export const getFullSyncStatus = internalAction({
  args: {
    syncId: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    syncId: string;
    status: 'complete' | 'error' | 'running';
    startedAt?: number;
    completedAt?: number;
    lastActivity?: number;
    progress: {
      currentPage: number;
      processedSeries: number;
      skippedSeries: number;
    };
    queue: {
      pending: number;
      ready: number;
      failed: number;
    };
    errors: Array<{
      timestamp?: number;
      message?: string;
    }>;
  }> => {
    // Get sync logs
    const logs: SyncLog[] = await ctx.runQuery(internal.tvdb.syncer.queries.getSyncLogs, {
      syncId: args.syncId,
    });

    // Get queue status - using workpool status instead
    const queueStatus: QueueStatus = {
      pending: 0,
      ready: 0,
      failed: 0,
    };

    // Calculate progress
    const startLog = logs.find((l) => l.action === 'start');
    const progressLogs = logs.filter((l) => l.action === 'progress');
    const completeLog: SyncLog | undefined = logs.find((l) => l.action === 'complete');
    const errorLogs = logs.filter((l) => l.action === 'error');

    const lastProgress = progressLogs[progressLogs.length - 1];

    return {
      syncId: args.syncId,
      status: completeLog ? 'complete' : errorLogs.length > 0 ? 'error' : 'running',
      startedAt: startLog?.timestamp,
      completedAt: completeLog?.timestamp,
      lastActivity: lastProgress?.timestamp || startLog?.timestamp,
      progress: {
        currentPage: lastProgress?.metadata?.page || 0,
        processedSeries: lastProgress?.metadata?.processed || 0,
        skippedSeries: lastProgress?.metadata?.skipped || 0,
      },
      queue: {
        pending: queueStatus.pending,
        ready: queueStatus.ready,
        failed: queueStatus.failed,
      },
      errors: errorLogs.map((e) => ({
        timestamp: e.timestamp,
        message: e.message,
      })),
    };
  },
});
