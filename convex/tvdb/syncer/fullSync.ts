import { internalAction } from '../../_generated/server';
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
  },
  handler: async (ctx, args) => {
    const startPage = args.startPage ?? 0;

    // Log the sync session
    const syncId = `full_sync_${Date.now()}`;
    await ctx.runMutation(internal.tvdb.syncer.internalMutations.logSyncStart, {
      syncId,
      entityType: 'full_database',
      metadata: { startPage },
    });

    try {
      await ctx.runAction(internal.tvdb.syncer.fullSync.syncAllSeriesPage, {
        page: startPage,
        syncId,
      });

      return {
        syncId,
        success: true,
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
    maxConcurrentSyncs: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const maxConcurrent = args.maxConcurrentSyncs ?? 10;

    try {
      // Get authenticated client (reuses existing token)
      const client = await getAuthenticatedClient(ctx);

      console.log(`[Full Sync] Fetching page ${args.page} from TVDB API`);
      const response = await client.getAllSeries(args.page);

      if (!response.data || response.data.length === 0) {
        console.log(`[Full Sync] No data returned for page ${args.page}`);
        await ctx.runMutation(internal.tvdb.syncer.internalMutations.logSyncComplete, {
          syncId: args.syncId,
          metadata: {
            totalPages: args.page,
            totalSeries: 0,
          },
        });
        return null;
      }

      const series = response.data;
      const links = response.links;

      console.log(`[Full Sync] Page ${args.page}: Found ${series.length} series. Links:`, {
        next: links?.next,
        last: links?.last,
        total_items: links?.total_items,
        page_size: links?.page_size,
      });

      let processed = 0;
      let failed = 0;

      // Process series in batches with the new syncSeriesDeep
      for (let i = 0; i < series.length; i += maxConcurrent) {
        const batch = series.slice(i, i + maxConcurrent);

        // Schedule batch with staggered delays
        for (let j = 0; j < batch.length; j++) {
          const show = batch[j];
          const showId = show?.id?.toString();
          if (!showId) continue;

          try {
            // Schedule with a small stagger to avoid burst scheduling
            const delay = j * 50; // 50ms between each series in batch
            await ctx.scheduler.runAfter(delay, internal.tvdb.syncer.actions.syncSeriesDeep, {
              seriesId: showId,
              options: {
                syncTTLHours: 24, // Default TTL for full sync
                maxConcurrentSeasons: 3, // Limit concurrency within each series
              },
            });
            processed++;
          } catch (error) {
            console.error(`[Full Sync] Failed to schedule series ${showId}:`, error);
            failed++;
          }
        }

        // Small delay between batches to avoid rate limiting
        if (i + maxConcurrent < series.length) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }

        // Log progress periodically
        if ((i + maxConcurrent) % 50 === 0 || i + maxConcurrent >= series.length) {
          console.log(
            `[Full Sync] Page ${args.page} progress: ${i + Math.min(maxConcurrent, series.length - i)}/${series.length} series`
          );
        }
      }

      // Log page completion
      console.log(
        `[Full Sync] Page ${args.page} complete: processed=${processed}, failed=${failed}, total=${series.length}`
      );

      await ctx.runMutation(internal.tvdb.syncer.internalMutations.logSyncProgress, {
        syncId: args.syncId,
        message: `Page ${args.page} complete: Processed ${processed} series, ${failed} failed`,
        metadata: {
          page: args.page,
          processed,
          skipped: 0,
        },
      });

      // Schedule next page if available
      const hasNextPage = links?.next !== undefined && links.next !== null;

      if (hasNextPage) {
        // Schedule the next page as a separate action to avoid long-running actions
        await ctx.scheduler.runAfter(100, internal.tvdb.syncer.fullSync.syncAllSeriesPage, {
          page: args.page + 1,
          syncId: args.syncId,
          maxConcurrentSyncs: maxConcurrent,
        });

        console.log(`[Full Sync] Scheduled page ${args.page + 1}`);
      } else {
        // Complete the sync
        await ctx.runMutation(internal.tvdb.syncer.internalMutations.logSyncComplete, {
          syncId: args.syncId,
          metadata: {
            totalPages: args.page + 1,
            totalSeries: links?.total_items || (args.page + 1) * series.length,
          },
        });

        console.log(
          `[Full Sync] Completed all pages. Total series: ${links?.total_items || 'unknown'}`
        );
      }

      return null;
    } catch (err) {
      console.error(`[Full Sync] Error on page ${args.page}:`, err);

      await ctx.runMutation(internal.tvdb.syncer.internalMutations.logSyncError, {
        syncId: args.syncId,
        error: err instanceof Error ? err.message : 'Unknown error',
      });

      throw err;
    }
  },
});
