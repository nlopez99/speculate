import { v } from 'convex/values';

// ============================================================================
// TVDB Sync State Management
// ============================================================================

export const tvdbSyncStateValidator = v.object({
  entityType: v.union(
    v.literal('series'),
    v.literal('season'),
    v.literal('episode'),
    v.literal('movie'),
    v.literal('person'),
    v.literal('company')
  ),
  entityId: v.string(), // TVDB ID
  lastSyncedAt: v.number(),
  lastModifiedAt: v.optional(v.number()), // From TVDB
  version: v.number(),
  status: v.union(
    v.literal('synced'),
    v.literal('pending'),
    v.literal('failed'),
    v.literal('conflict')
  ),
  errorMessage: v.optional(v.string()),
  retryCount: v.optional(v.number()),
  metadata: v.optional(v.object({
    etag: v.optional(v.string()),
    checksum: v.optional(v.string()),
    syncDuration: v.optional(v.number()),
  })),
});

// DEPRECATED: Using workpool component instead of custom queue
// The tvdbSyncQueue table is no longer used

export const tvdbIdMappingValidator = v.object({
  tvdbId: v.string(),
  tvdbType: v.union(
    v.literal('series'),
    v.literal('season'),
    v.literal('episode'),
    v.literal('movie'),
    v.literal('person'),
    v.literal('company')
  ),
  convexId: v.optional(v.string()), // ID in our shows/episodes/etc tables
  tmdbId: v.optional(v.string()),
  imdbId: v.optional(v.string()),
  slug: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const tvdbSyncLogValidator = v.object({
  syncId: v.string(),
  entityType: v.string(),
  entityId: v.string(),
  action: v.string(),
  status: v.union(
    v.literal('started'),
    v.literal('completed'),
    v.literal('failed'),
    v.literal('skipped')
  ),
  startedAt: v.number(),
  completedAt: v.optional(v.number()),
  duration: v.optional(v.number()),
  changes: v.optional(v.object({
    added: v.array(v.string()),
    modified: v.array(v.string()),
    removed: v.array(v.string()),
    details: v.optional(v.record(v.string(), v.object({
      old: v.optional(v.string()),
      new: v.optional(v.string()),
    }))),
  })),
  error: v.optional(v.string()),
  metadata: v.optional(v.object({
    recordsProcessed: v.optional(v.number()),
    apiCalls: v.optional(v.number()),
    cacheHits: v.optional(v.number()),
  })),
});

export const tvdbRawDataValidator = v.object({
  tvdbId: v.string(),
  entityType: v.string(),
  data: v.string(), // JSON stringified data from TVDB API
  version: v.number(),
  fetchedAt: v.number(),
  etag: v.optional(v.string()),
  expiresAt: v.optional(v.number()),
});

export const tvdbSyncConfigValidator = v.object({
  key: v.union(
    v.literal('api_key'),
    v.literal('rate_limit_requests'),
    v.literal('rate_limit_window_ms'),
    v.literal('sync_enabled'),
    v.literal('last_full_sync'),
    v.literal('sync_interval_hours'),
    v.literal('max_retries'),
    v.literal('batch_size')
  ),
  value: v.union(
    v.string(),
    v.number(),
    v.boolean()
  ),
  updatedAt: v.number(),
});