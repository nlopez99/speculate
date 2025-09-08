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
  },
  handler: async (ctx, args): Promise<void> => {
    try {
      // Get authenticated client (reuses existing token)
      const client = await getAuthenticatedClient(ctx);

      // Get series for this page
      let hasNextPage = true;
      let page = args.page;
      while (hasNextPage) {
        console.log(`[Full Sync] Fetching page ${page} from TVDB API`);
        const response = await client.getAllSeries(page);

        if (!response.data || response.data.length === 0) {
          console.log(`[Full Sync] No data returned for page ${page}`);
          return;
        }

        const series = response.data;
        const links = response.links;

        console.log(`[Full Sync] Page ${page}: Found ${series.length} series. Links:`, {
          next: links?.next,
          last: links?.last,
          total_items: links?.total_items,
          page_size: links?.page_size,
        });

        let processed = 0;
        let skipped = 0;
        const BATCH_SIZE = 5; // Process 5 series at a time to limit concurrency
        const BATCH_DELAY_MS = 100; // Small delay between batches

        // Process series in batches to avoid overwhelming the database
        for (let i = 0; i < series.length; i += BATCH_SIZE) {
          const batch = series.slice(i, i + BATCH_SIZE);

          // Process each batch with limited concurrency
          await Promise.all(
            batch.map(async (show) => {
              const showId = show?.id?.toString();
              if (!showId) return;

              try {
                // Stagger the scheduling slightly within the batch
                const delay = (i % BATCH_SIZE) * 50;
                await ctx.scheduler.runAfter(delay, internal.tvdb.syncer.actions.syncSeries, {
                  seriesId: showId,
                });

                processed++;
              } catch (error) {
                console.error(`Failed to queue series ${showId}: ${error}`);
              }
            })
          );

          // Add a small delay between batches to prevent connection pool exhaustion
          if (i + BATCH_SIZE < series.length) {
            await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
          }
        }

        // Log page completion
        console.log(
          `[Full Sync] Page ${page} complete: processed=${processed}, skipped=${skipped}, total=${processed + skipped}`
        );

        await ctx.runMutation(internal.tvdb.syncer.internalMutations.logSyncProgress, {
          syncId: args.syncId,
          message: `Page ${page} complete: Processed ${processed} new series, skipped ${skipped} existing`,
          metadata: {
            page: page,
            processed,
            skipped,
          },
        });

        // Process next page if available
        hasNextPage = links?.next !== undefined && links.next !== null;

        if (hasNextPage) {
          page++;
        } else {
          await ctx.runMutation(internal.tvdb.syncer.internalMutations.logSyncComplete, {
            syncId: args.syncId,
            metadata: {
              totalPages: page + 1,
              totalSeries: links?.total_items || page + 1,
            },
          });
        }
      }
    } catch (err) {
      console.log(err);

      throw err;
    }
  },
});
