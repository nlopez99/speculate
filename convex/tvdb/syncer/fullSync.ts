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

    // Log the sync session
    const syncId = `full_sync_${Date.now()}`;
    await ctx.runMutation(internal.tvdb.syncer.internalMutations.logSyncStart, {
      syncId,
      entityType: 'full_database',
      metadata: { startPage },
    });

    try {
      // Start iterating through all series
      const result = await ctx.runAction(internal.tvdb.syncer.fullSync.syncAllSeriesPage, {
        page: startPage,
        syncId,
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
    resumeFromId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      // Get authenticated client (reuses existing token)
      const client = await getAuthenticatedClient(ctx);

      // Get series for this page
      console.log(`[Full Sync] Fetching page ${args.page} from TVDB API`);
      const response = await client.getAllSeries(args.page);

      if (!response.data || response.data.length === 0) {
        console.log(`[Full Sync] No data returned for page ${args.page}`);
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

      console.log(`[Full Sync] Page ${args.page}: Found ${series.length} series. Links:`, {
        next: links?.next,
        last: links?.last,
        total_items: links?.total_items,
        page_size: links?.page_size,
      });

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
          // Check if this series is already synced or queued to avoid duplicates
          const existingMapping = await ctx.runQuery(internal.tvdb.syncer.queries.getMapping, {
            tvdbId: show.id.toString(),
            tvdbType: 'series',
          });

          if (existingMapping && !args.resumeFromId) {
            // Skip if already mapped (unless we're resuming from a specific ID)
            console.log(`[Full Sync] Skipping already synced series: ${show.id} - ${show.name}`);
            skipped++;
          } else {
            // Queue the series for deep sync using workpool
            await ctx.runMutation(internal.tvdb.syncer.workpool.enqueueSyncEntity, {
              entityType: 'series',
              entityId: show.id.toString(),
              metadata: {
                source: 'manual',
              },
            });

            processed++;
            console.log(`[Full Sync] Queued series ${processed}: ${show.id} - ${show.name}`);
          }

          // Log progress every 50 series (more frequent for debugging)
          if ((processed + skipped) % 50 === 0) {
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

      // Log page completion
      console.log(
        `[Full Sync] Page ${args.page} complete: processed=${processed}, skipped=${skipped}, total=${processed + skipped}`
      );
      await ctx.runMutation(internal.tvdb.syncer.internalMutations.logSyncProgress, {
        syncId: args.syncId,
        message: `Page ${args.page} complete: Processed ${processed} new series, skipped ${skipped} existing`,
        metadata: {
          page: args.page,
          processed,
          skipped,
        },
      });

      // Process next page if available
      const hasNextPage = links?.next !== undefined && links.next !== null;
      const nextPage = args.page + 1; // TVDB pagination is 0-indexed, increment by 1

      if (hasNextPage) {
        // Schedule next page processing
        console.log(`[Full Sync] Scheduling next page: ${nextPage} (current: ${args.page})`);
        await ctx.scheduler.runAfter(1000, internal.tvdb.syncer.fullSync.syncAllSeriesPage, {
          page: nextPage,
          syncId: args.syncId,
        });
      } else {
        // Mark sync as complete
        console.log(`[Full Sync] No more pages. Completing sync.`);
        await ctx.runMutation(internal.tvdb.syncer.internalMutations.logSyncComplete, {
          syncId: args.syncId,
          metadata: {
            totalPages: args.page + 1,
            totalSeries: links?.total_items || args.page + 1,
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
    } catch (err) {
      console.log(err);

      throw err;
    }
  },
});
