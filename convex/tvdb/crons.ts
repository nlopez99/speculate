import { cronJobs } from 'convex/server';
import { internal } from '../_generated/api';

const crons = cronJobs();

// The workpool component handles its own processing automatically
// No need for a separate queue processing cron

// Check for updates every hour
crons.hourly(
  'tvdb-incremental-updates',
  { minuteUTC: 0 },
  internal.tvdb.syncer.actions.syncUpdates,
  {
    // Sync updates from the last 2 hours (with overlap for safety)
    since: Date.now() - 2 * 60 * 60 * 1000,
  }
);

// Clean up old raw data weekly
crons.weekly(
  'tvdb-cleanup-raw-data',
  { dayOfWeek: 'sunday', hourUTC: 3, minuteUTC: 0 },
  internal.tvdb.syncer.internalMutations.cleanupOldRawData
);

export default crons;
