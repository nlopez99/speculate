import { Doc, Id } from '../../_generated/dataModel';
import {
  SeriesExtendedRecord,
  SeasonExtendedRecord,
  EpisodeExtendedRecord,
  MovieExtendedRecord,
  PeopleExtendedRecord,
  Company,
  Translation,
} from '../client/api';

// ============================================================================
// Sync Types
// ============================================================================

export interface SyncOptions {
  force?: boolean; // Force sync even if recently synced
  shallow?: boolean; // Don't sync related entities
  priority?: number; // Queue priority
  maxDepth?: number; // How deep to follow relations
}

export interface SyncChanges {
  added: string[];
  modified: string[];
  removed: string[];
  details: Record<string, { old: unknown; new: unknown }>;
}

export interface SyncResult {
  success: boolean;
  entityType: 'series' | 'season' | 'episode' | 'movie' | 'person' | 'company';
  entityId: string;
  action: 'created' | 'updated' | 'skipped' | 'failed';
  changes?: SyncChanges;
  error?: string;
  relatedSyncs?: SyncResult[];
}

export interface SyncProgress {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  currentEntity?: string;
  startedAt: number;
  estimatedCompletionAt?: number;
}

export type TVDBEntityData =
  | SeriesExtendedRecord
  | SeasonExtendedRecord
  | EpisodeExtendedRecord
  | MovieExtendedRecord
  | PeopleExtendedRecord
  | Company;

export interface ConflictResolution<T = TVDBEntityData> {
  strategy: 'tvdb_wins' | 'local_wins' | 'merge' | 'manual';
  fields?: (keyof T)[];
  resolver?: (tvdbData: T, localData: Partial<T>) => T;
}

export interface RateLimitState {
  requests: number;
  windowStart: number;
  retryAfter?: number;
}

// ============================================================================
// Entity Mapping Types
// ============================================================================

export type ConvexEntityId =
  | Id<'shows'>
  | Id<'episodes'>
  | Id<'seasons'>
  | Id<'characters'>;

export interface EntityMapping {
  tvdbId: string;
  convexId?: ConvexEntityId;
  entityType: 'series' | 'season' | 'episode' | 'movie' | 'person' | 'company';
  lastSyncedAt: number;
  version: number;
}

export interface SyncQueueItem {
  id: string;
  entityType: 'series' | 'season' | 'episode' | 'movie' | 'person' | 'company';
  entityId: string;
  action: 'create' | 'update' | 'delete' | 'full_sync';
  priority: number;
  attempts: number;
  scheduledFor: number;
  metadata?: {
    parentId?: string;
    seasonNumber?: number;
    episodeNumber?: number;
    source?: 'manual' | 'cron' | 'webhook' | 'cascade';
  };
}

// ============================================================================
// Transform Functions
// ============================================================================

export interface TransformContext<T = TVDBEntityData> {
  existingData?: Partial<T>;
  mapping?: EntityMapping;
  options?: SyncOptions;
}

export type SeriesTransformer = (
  tvdbData: SeriesExtendedRecord,
  context?: TransformContext<SeriesExtendedRecord>
) => Doc<'shows'>;

export type EpisodeTransformer = (
  tvdbData: EpisodeExtendedRecord,
  context?: TransformContext<EpisodeExtendedRecord>
) => Doc<'episodes'>;

export type SeasonTransformer = (
  tvdbData: SeasonExtendedRecord,
  context?: TransformContext<SeasonExtendedRecord>
) => Doc<'seasons'>;

// ============================================================================
// API Response Types
// ============================================================================

export interface TVDBUpdateRecord {
  entityType: string;
  recordId: number;
  timeStamp: number;
  method: 'create' | 'update' | 'delete';
}

export interface TVDBSyncBatch {
  seriesIds: string[];
  seasonIds: string[];
  episodeIds: string[];
  movieIds: string[];
  peopleIds: string[];
  companyIds: string[];
}
