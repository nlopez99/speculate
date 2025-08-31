// ============================================================================
// TVDB Syncer Module
// ============================================================================
//
// This module provides a complete syncing solution for maintaining a local
// copy of TVDB data with the following features:
//
// - Idempotent sync operations (prevent duplicates)  
// - Automatic parallelism management using @convex-dev/workpool
// - Built-in retry logic with exponential backoff
// - Rate limiting and backpressure management
// - Incremental updates using TVDB's update API
// - Conflict resolution and version tracking
// - Comprehensive monitoring and status tracking
//
// Usage:
// 1. Set TVDB_API_KEY environment variable
// 2. Queue entities for syncing using workpool.enqueueSyncEntity
// 3. The workpool automatically manages processing with configured parallelism
// 4. Monitor progress using workpool.getSyncStatus
//
// ============================================================================

export * from './types';
export * as actions from './actions';
export * as mutations from './mutations';
export * as queries from './queries';
export * as workpool from './workpool';

// Public API functions for external use
export { syncSeries, syncEpisode, syncSeason, syncUpdates } from './actions';

// Workpool-based queue management (preferred)
export { enqueueSyncEntity, enqueueSyncBatch, getSyncStatus, cancelSync, cancelAllSyncs } from './workpool';

// Configuration and state management
export { updateConfig } from './mutations';
export { getSyncStats, getSyncProgress } from './queries';
