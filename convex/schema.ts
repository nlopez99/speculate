import { defineSchema, defineTable } from 'convex/server';
import { authTables } from '@convex-dev/auth/server';
import { Infer, v } from 'convex/values';

/* =====================
 * USERS & PROFILES
 * ===================== */

const usersValidator = v.object({
  ...authTables.users.validator.fields,
  // Core profile
  handle: v.optional(v.string()), // unique-ish username
  displayName: v.optional(v.string()),
  avatarUrl: v.optional(v.string()),
  bio: v.optional(v.string()),
  // Preferences
  timezone: v.optional(v.string()),
  allowDMs: v.optional(v.boolean()),
  notifOptIn: v.optional(v.boolean()),
  // Spoiler-safe defaults
  spoilerSafeDefault: v.optional(v.boolean()), // default “progress-aware feed”
  createdAt: v.number(),
  updatedAt: v.number(),
});

const followsValidator = v.object({
  followerId: v.id('users'),
  followingId: v.id('users'),
  createdAt: v.number(),
});

const userProgressValidator = v.object({
  userId: v.id('users'),
  showId: v.id('shows'),
  // Last *fully watched* episode for spoiler gating
  lastWatchedEpisodeId: v.optional(v.id('episodes')),
  // Explicit progress numbers help when episode ids aren’t set yet
  seasonNumber: v.optional(v.number()),
  episodeNumber: v.optional(v.number()),
  updatedAt: v.number(),
});

/* =====================
 * CATALOG (TMDB/IMDB MAPPINGS)
 * ===================== */

const showsValidator = v.object({
  title: v.string(),
  slug: v.string(), // for deep links
  overview: v.optional(v.string()),
  posterUrl: v.optional(v.string()),
  backdropUrl: v.optional(v.string()),
  firstAirYear: v.optional(v.number()),
  status: v.union(
    v.literal('running'),
    v.literal('ended'),
    v.literal('hiatus'),
    v.literal('unknown')
  ),
  // External IDs
  tmdbId: v.optional(v.string()),
  imdbId: v.optional(v.string()),
  tvdbId: v.optional(v.string()),
  network: v.optional(v.string()),
  genres: v.optional(v.array(v.string())),
  // Aggregates (denormalized)
  followersCount: v.optional(v.number()),
  predictionsCount: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const seasonsValidator = v.object({
  showId: v.id('shows'),
  seasonNumber: v.number(),
  title: v.optional(v.string()),
  tmdbId: v.optional(v.string()),
  posterUrl: v.optional(v.string()),
  episodeCount: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const episodesValidator = v.object({
  showId: v.id('shows'),
  seasonId: v.id('seasons'),
  seasonNumber: v.number(),
  episodeNumber: v.number(),
  title: v.string(),
  overview: v.optional(v.string()),
  airDateUtc: v.optional(v.number()), // ms since epoch
  runtimeMinutes: v.optional(v.number()),
  tmdbId: v.optional(v.string()),
  imdbId: v.optional(v.string()),
  stillUrl: v.optional(v.string()),
  // Convenience flags
  hasAired: v.optional(v.boolean()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const charactersValidator = v.object({
  showId: v.id('shows'),
  name: v.string(),
  tmdbId: v.optional(v.string()),
  actorName: v.optional(v.string()),
  headshotUrl: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

/* =====================
 * DISCOVERY / FOLLOWING / WATCHLIST
 * ===================== */

const showFollowsValidator = v.object({
  userId: v.id('users'),
  showId: v.id('shows'),
  createdAt: v.number(),
});

const watchlistImportsValidator = v.object({
  userId: v.id('users'),
  provider: v.union(v.literal('trakt'), v.literal('tmdb')),
  status: v.union(v.literal('pending'), v.literal('success'), v.literal('error')),
  importedShowCount: v.optional(v.number()),
  errorMessage: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

/* =====================
 * PREDICTIONS (TEMPLATED)
 * ===================== */

const predictionTemplatesValidator = v.object({
  // Catalog of allowed templates (system-owned)
  key: v.string(), // e.g., "APPEARS", "SAYS_QUOTE", "EVENT", "WINNER", "YES_NO"
  title: v.string(),
  description: v.optional(v.string()),
  // What fields this template requires in prediction.params
  schema: v.any(), // (JSON schema-ish; enforced app-side)
  enabled: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const predictionsValidator = v.object({
  authorUserId: v.id('users'), // who created the prompt (could be system user)
  templateKey: v.string(), // must exist in predictionTemplates.key
  scope: v.union(v.literal('episode'), v.literal('season'), v.literal('show')),
  showId: v.id('shows'),
  seasonId: v.optional(v.id('seasons')),
  episodeId: v.optional(v.id('episodes')),
  // Parameterization for the template (characterId, quote string, etc.)
  params: v.any(),
  // Options (denormalized for fast read; also stored in predictionOptions)
  kind: v.union(v.literal('binary'), v.literal('multiple_choice')),
  lockAt: v.number(), // when picks close
  state: v.union(v.literal('open'), v.literal('locked'), v.literal('resolved'), v.literal('void')),
  // Outcome (post-resolution)
  resolvedAt: v.optional(v.number()),
  outcomeOptionId: v.optional(v.id('predictionOptions')),
  // Confidence/meta (optional; you can ignore until you implement auto-resolve)
  confidence: v.optional(v.number()), // 0..1
  resolverType: v.optional(v.union(v.literal('auto'), v.literal('assisted'), v.literal('manual'))),
  // Aggregates
  picksCount: v.optional(v.number()),
  commentsCount: v.optional(v.number()),
  // Moderation
  isHidden: v.optional(v.boolean()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const predictionOptionsValidator = v.object({
  predictionId: v.id('predictions'),
  label: v.string(), // "Yes", "No", or choice text
  value: v.string(), // canonical machine value
  ordinal: v.number(), // 0..N for stable ordering
  createdAt: v.number(),
});

/** ✅ Extended to include potential/earned points snapshots */
const predictionPicksValidator = v.object({
  predictionId: v.id('predictions'),
  optionId: v.id('predictionOptions'),
  userId: v.id('users'),
  pickedAt: v.number(),
  // Hedge/switch mechanics
  switchedFromOptionId: v.optional(v.id('predictionOptions')),
  switchPenaltyApplied: v.optional(v.boolean()),
  // For odds/difficulty snapshotting
  preLockCommunityProbability: v.optional(v.number()), // p in [0,1] at pick time
  // MVP scoring snapshots
  potentialPoints: v.optional(v.number()),
  earnedPoints: v.optional(v.number()),
  createdAt: v.number(),
});

const predictionResolutionEvidenceValidator = v.object({
  predictionId: v.id('predictions'),
  sourceType: v.union(
    v.literal('SUBTITLE'),
    v.literal('CAST'),
    v.literal('RECAP'),
    v.literal('OFFICIAL'),
    v.literal('OTHER')
  ),
  url: v.optional(v.string()),
  snippet: v.optional(v.string()),
  timestampSec: v.optional(v.number()),
  addedByUserId: v.optional(v.id('users')), // null/system for auto
  createdAt: v.number(),
});

const predictionAppealsValidator = v.object({
  predictionId: v.id('predictions'),
  userId: v.id('users'),
  message: v.string(),
  status: v.union(v.literal('open'), v.literal('accepted'), v.literal('rejected')),
  resolvedByUserId: v.optional(v.id('users')),
  resolvedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

/* =====================
 * SOCIAL: COMMENTS / THREADS
 * ===================== */

/** ✅ Extended to support up/down votes and spoilers */
const commentsValidator = v.object({
  // Threading minimalism: parent is optional
  parentId: v.optional(v.id('comments')),
  // Attach to either a prediction or an episode
  predictionId: v.optional(v.id('predictions')),
  episodeId: v.optional(v.id('episodes')),
  userId: v.id('users'),
  body: v.string(),
  // Denormalized engagement
  likeCount: v.optional(v.number()), // kept for backward compat (unused by MVP)
  upvotes: v.optional(v.number()),
  downvotes: v.optional(v.number()),
  // Spoilers & visibility
  containsSpoiler: v.optional(v.boolean()),
  visibleAfterUtc: v.optional(v.number()),
  isDeleted: v.optional(v.boolean()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

/** ✅ New: track per-user up/down votes to prevent duplicates */
const commentVotesValidator = v.object({
  commentId: v.id('comments'),
  userId: v.id('users'),
  value: v.union(v.literal(-1), v.literal(1)),
  createdAt: v.number(),
});

/* =====================
 * RATINGS / LEADERBOARDS / ACHIEVEMENTS
 * ===================== */

const userRatingsValidator = v.object({
  userId: v.id('users'),
  scope: v.union(v.literal('global'), v.literal('show'), v.literal('season')),
  showId: v.optional(v.id('shows')),
  seasonId: v.optional(v.id('seasons')),
  rating: v.number(), // ELO/Glicko value
  rd: v.optional(v.number()), // rating deviation (if using Glicko)
  lastUpdatedAt: v.number(),
});

const ratingEventsValidator = v.object({
  userId: v.id('users'),
  predictionId: v.id('predictions'),
  delta: v.number(),
  ratingAfter: v.number(),
  createdAt: v.number(),
});

const leaderboardsValidator = v.object({
  kind: v.union(
    v.literal('daily'),
    v.literal('weekly'),
    v.literal('season'),
    v.literal('show'),
    v.literal('global')
  ),
  showId: v.optional(v.id('shows')),
  seasonId: v.optional(v.id('seasons')),
  // Snapshot for a time period (e.g., 2025-08-24)
  periodKey: v.string(),
  top: v.array(
    v.object({
      userId: v.id('users'),
      rank: v.number(),
      score: v.number(), // tournament score or points
      rating: v.optional(v.number()),
    })
  ),
  createdAt: v.number(),
});

const achievementsValidator = v.object({
  key: v.string(), // e.g., "first_win", "10_correct", "streak_7"
  name: v.string(),
  description: v.optional(v.string()),
  iconUrl: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const userAchievementsValidator = v.object({
  userId: v.id('users'),
  achievementKey: v.string(),
  awardedAt: v.number(),
  // Cosmetic payloads (frames, emojis, etc.)
  rewardPayload: v.optional(v.any()),
});

/* =====================
 * TOURNAMENTS / PROMPT SETS / DAILY SPECULATE
 * ===================== */

const promptSetsValidator = v.object({
  title: v.string(), // “Weekend Cup: Only Murders S3E5”
  scope: v.union(v.literal('daily'), v.literal('episode'), v.literal('multi')),
  showId: v.optional(v.id('shows')),
  episodeIds: v.optional(v.array(v.id('episodes'))),
  predictionIds: v.array(v.id('predictions')), // frozen at publish time
  publishedAt: v.number(),
  lockAt: v.number(),
  createdBy: v.id('users'),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const tournamentsValidator = v.object({
  title: v.string(),
  type: v.union(v.literal('cup'), v.literal('bracket'), v.literal('swiss')),
  visibility: v.union(v.literal('global'), v.literal('private'), v.literal('creator')),
  scope: v.union(v.literal('show'), v.literal('episode'), v.literal('multi')),
  showId: v.optional(v.id('shows')),
  promptSetId: v.id('promptSets'),
  status: v.union(
    v.literal('upcoming'),
    v.literal('open'),
    v.literal('locked'),
    v.literal('resolved')
  ),
  capacity: v.optional(v.number()),
  lockAt: v.number(),
  resolveBy: v.number(),
  prizes: v.optional(v.any()), // cosmetic rewards schema
  createdBy: v.id('users'),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const tournamentEntriesValidator = v.object({
  tournamentId: v.id('tournaments'),
  userId: v.id('users'),
  // Snapshot of picks for promptSet.predictionIds
  picks: v.array(
    v.object({
      predictionId: v.id('predictions'),
      optionId: v.id('predictionOptions'),
    })
  ),
  score: v.optional(v.number()),
  rank: v.optional(v.number()),
  joinedAt: v.number(),
  updatedAt: v.number(),
});

const privatePoolsValidator = v.object({
  tournamentId: v.id('tournaments'),
  code: v.string(), // join code
  creatorUserId: v.id('users'),
  maxEntrants: v.optional(v.number()),
  createdAt: v.number(),
});

/* =====================
 * NOTIFICATIONS / REFERRALS / SHARING
 * ===================== */

const notificationsValidator = v.object({
  userId: v.id('users'),
  type: v.union(
    v.literal('pre_lock'),
    v.literal('post_resolve'),
    v.literal('digest'),
    v.literal('streak'),
    v.literal('friend_joined'),
    v.literal('tournament_invite')
  ),
  payload: v.any(),
  scheduledAt: v.number(),
  sentAt: v.optional(v.number()),
  clickedAt: v.optional(v.number()),
  createdAt: v.number(),
});

const deviceTokensValidator = v.object({
  userId: v.id('users'),
  platform: v.union(v.literal('ios'), v.literal('android'), v.literal('web')),
  token: v.string(),
  lastSeenAt: v.number(),
  createdAt: v.number(),
});

const referralsValidator = v.object({
  inviterUserId: v.id('users'),
  code: v.string(),
  invitedUserId: v.optional(v.id('users')),
  acceptedAt: v.optional(v.number()),
  createdAt: v.number(),
});

const shareLinksValidator = v.object({
  kind: v.union(
    v.literal('prediction'),
    v.literal('episode'),
    v.literal('tournament'),
    v.literal('profile')
  ),
  targetId: v.string(), // keep generic; resolve app-side
  code: v.string(), // short id
  createdBy: v.id('users'),
  createdAt: v.number(),
});

/* =====================
 * MODERATION / AUDIT (lightweight)
 * ===================== */

const reportsValidator = v.object({
  reporterUserId: v.id('users'),
  targetKind: v.union(v.literal('comment'), v.literal('prediction'), v.literal('user')),
  targetId: v.string(),
  reason: v.string(),
  status: v.union(v.literal('open'), v.literal('closed')),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const auditLogsValidator = v.object({
  actorUserId: v.optional(v.id('users')),
  action: v.string(), // e.g., "PREDICTION_RESOLVED"
  entityKind: v.string(), // "prediction", "tournament", etc.
  entityId: v.string(),
  metadata: v.optional(v.any()),
  createdAt: v.number(),
});

/* =====================
 * ✅ MVP ADDITIONS: POINTS/STATS, LIVE COUNTS, EPISODE + VOTES
 * ===================== */

/** Immutable, auditable points events */
const pointsLedgerValidator = v.object({
  userId: v.id('users'),
  points: v.number(), // positive or negative
  reason: v.union(
    v.literal('pick_correct'),
    v.literal('early_bonus'),
    v.literal('contrarian_bonus'),
    v.literal('streak_bonus'),
    v.literal('tournament_payout'),
    v.literal('admin_adjustment'),
    v.literal('refund')
  ),
  predictionId: v.optional(v.id('predictions')),
  pickId: v.optional(v.id('predictionPicks')),
  tournamentId: v.optional(v.id('tournaments')),
  metadata: v.optional(v.any()),
  createdAt: v.number(),
});

/** Denormalized per-user hot stats for fast reads */
const userStatsValidator = v.object({
  userId: v.id('users'),
  totalPicks: v.number(),
  correctPicks: v.number(),
  accuracy: v.number(), // 0..1
  pointsBalance: v.number(),
  lifetimePoints: v.number(),
  currentStreak: v.number(),
  bestStreak: v.number(),
  lastActiveDay: v.string(), // "YYYY-MM-DD" in user TZ
  // Optional levelization for UI
  level: v.optional(v.string()),
  levelProgress: v.optional(v.object({ current: v.number(), required: v.number() })),
  updatedAt: v.number(),
});

/** Per-user x show stats powering Profile “Show Stats” */
const userShowStatsValidator = v.object({
  userId: v.id('users'),
  showId: v.id('shows'),
  totalPredictions: v.number(),
  correctPredictions: v.number(),
  accuracy: v.number(),
  updatedAt: v.number(),
});

/** Live pick counts per option for fast percentages */
const predictionOptionStatsValidator = v.object({
  predictionId: v.id('predictions'),
  optionId: v.id('predictionOptions'),
  pickCount: v.number(),
  updatedAt: v.number(),
});

/** Episode save/heart */
const episodeFollowsValidator = v.object({
  userId: v.id('users'),
  episodeId: v.id('episodes'),
  createdAt: v.number(),
});

/** Episode counters (keep write hotspots off core catalog rows) */
const episodeStatsValidator = v.object({
  episodeId: v.id('episodes'),
  predictionsCount: v.number(),
  commentsCount: v.number(),
  viewsCount: v.number(),
  updatedAt: v.number(),
});

/* =====================
 * EXPORT TYPES
 * ===================== */

export type User = Infer<typeof usersValidator>;
export type Show = Infer<typeof showsValidator>;
export type Season = Infer<typeof seasonsValidator>;
export type Episode = Infer<typeof episodesValidator>;
export type Character = Infer<typeof charactersValidator>;
export type Prediction = Infer<typeof predictionsValidator>;
export type PredictionOption = Infer<typeof predictionOptionsValidator>;
export type PredictionPick = Infer<typeof predictionPicksValidator>;
export type Tournament = Infer<typeof tournamentsValidator>;
export type TournamentEntry = Infer<typeof tournamentEntriesValidator>;

// New exports
export type PointsLedger = Infer<typeof pointsLedgerValidator>;
export type UserStats = Infer<typeof userStatsValidator>;
export type UserShowStats = Infer<typeof userShowStatsValidator>;
export type PredictionOptionStats = Infer<typeof predictionOptionStatsValidator>;
export type CommentVote = Infer<typeof commentVotesValidator>;
export type EpisodeFollow = Infer<typeof episodeFollowsValidator>;
export type EpisodeStats = Infer<typeof episodeStatsValidator>;

/* =====================
 * DEFINE SCHEMA + INDEXES
 * ===================== */

export default defineSchema({
  // Auth
  ...authTables,

  users: defineTable(usersValidator).index('handle', ['handle']).index('createdAt', ['createdAt']),

  follows: defineTable(followsValidator)
    .index('followerId', ['followerId'])
    .index('followingId', ['followingId'])
    .index('pair', ['followerId', 'followingId']),

  userProgress: defineTable(userProgressValidator)
    .index('user_show', ['userId', 'showId'])
    .index('show', ['showId']),

  shows: defineTable(showsValidator)
    .index('slug', ['slug'])
    .index('status', ['status'])
    .index('tmdbId', ['tmdbId']),

  seasons: defineTable(seasonsValidator)
    .index('showId', ['showId'])
    .index('show_seasonNumber', ['showId', 'seasonNumber']),

  episodes: defineTable(episodesValidator)
    .index('showId', ['showId'])
    .index('seasonId', ['seasonId'])
    .index('airDateUtc', ['airDateUtc'])
    .index('show_season_episode', ['showId', 'seasonNumber', 'episodeNumber'])
    .index('show_airDateUtc', ['showId', 'airDateUtc']) // For upcoming episodes by show
    .index('tmdbId', ['tmdbId']),

  characters: defineTable(charactersValidator).index('showId', ['showId']).index('name', ['name']),

  showFollows: defineTable(showFollowsValidator)
    .index('userId', ['userId'])
    .index('showId', ['showId'])
    .index('user_show', ['userId', 'showId']),

  watchlistImports: defineTable(watchlistImportsValidator)
    .index('userId', ['userId'])
    .index('provider', ['provider']),

  predictionTemplates: defineTable(predictionTemplatesValidator)
    .index('key', ['key'])
    .index('enabled', ['enabled']),

  predictions: defineTable(predictionsValidator)
    .index('showId', ['showId'])
    .index('episodeId', ['episodeId'])
    .index('state', ['state'])
    .index('lockAt', ['lockAt'])
    .index('authorUserId', ['authorUserId'])
    .index('episode_state', ['episodeId', 'state'])
    // ✅ helpful additions
    .index('show_state', ['showId', 'state'])
    .index('templateKey', ['templateKey']),

  predictionOptions: defineTable(predictionOptionsValidator)
    .index('predictionId', ['predictionId'])
    .index('prediction_ordinal', ['predictionId', 'ordinal']),

  predictionPicks: defineTable(predictionPicksValidator)
    .index('predictionId', ['predictionId'])
    .index('userId', ['userId'])
    .index('prediction_user', ['predictionId', 'userId'])
    .index('optionId', ['optionId']),

  predictionResolutionEvidence: defineTable(predictionResolutionEvidenceValidator)
    .index('predictionId', ['predictionId'])
    .index('sourceType', ['sourceType']),

  predictionAppeals: defineTable(predictionAppealsValidator)
    .index('predictionId', ['predictionId'])
    .index('userId', ['userId'])
    .index('status', ['status']),

  // ✅ comments extended + sort indexes
  comments: defineTable(commentsValidator)
    .index('predictionId', ['predictionId'])
    .index('episodeId', ['episodeId'])
    .index('parentId', ['parentId'])
    .index('userId', ['userId'])
    .index('prediction_createdAt', ['predictionId', 'createdAt'])
    .index('episode_createdAt', ['episodeId', 'createdAt']),

  // ✅ new: per-user votes
  commentVotes: defineTable(commentVotesValidator)
    .index('commentId', ['commentId'])
    .index('userId', ['userId'])
    .index('comment_user', ['commentId', 'userId']),

  userRatings: defineTable(userRatingsValidator)
    .index('userId', ['userId'])
    .index('scope', ['scope'])
    .index('showId', ['showId'])
    .index('seasonId', ['seasonId'])
    .index('user_scope_show', ['userId', 'scope', 'showId']),

  ratingEvents: defineTable(ratingEventsValidator)
    .index('userId', ['userId'])
    .index('predictionId', ['predictionId'])
    .index('createdAt', ['createdAt']),

  leaderboards: defineTable(leaderboardsValidator)
    .index('kind', ['kind'])
    .index('periodKey', ['periodKey'])
    .index('kind_period', ['kind', 'periodKey'])
    .index('kind_period_created', ['kind', 'periodKey', 'createdAt']) // For latest version lookup
    .index('show_season_period', ['showId', 'seasonId', 'periodKey'])
    .index('kind_period_show', ['kind', 'periodKey', 'showId']),

  achievements: defineTable(achievementsValidator).index('key', ['key']),

  userAchievements: defineTable(userAchievementsValidator)
    .index('userId', ['userId'])
    .index('achievementKey', ['achievementKey'])
    .index('user_achievement', ['userId', 'achievementKey']),

  promptSets: defineTable(promptSetsValidator)
    .index('scope', ['scope'])
    .index('showId', ['showId'])
    .index('lockAt', ['lockAt']),

  tournaments: defineTable(tournamentsValidator)
    .index('status', ['status'])
    .index('promptSetId', ['promptSetId'])
    .index('showId', ['showId'])
    .index('lockAt', ['lockAt']),

  tournamentEntries: defineTable(tournamentEntriesValidator)
    .index('tournamentId', ['tournamentId'])
    .index('userId', ['userId'])
    .index('tournament_user', ['tournamentId', 'userId']),

  privatePools: defineTable(privatePoolsValidator)
    .index('tournamentId', ['tournamentId'])
    .index('code', ['code']),

  notifications: defineTable(notificationsValidator)
    .index('userId', ['userId'])
    .index('scheduledAt', ['scheduledAt'])
    .index('type', ['type']),

  deviceTokens: defineTable(deviceTokensValidator)
    .index('userId', ['userId'])
    .index('platform', ['platform']),

  referrals: defineTable(referralsValidator)
    .index('inviterUserId', ['inviterUserId'])
    .index('code', ['code']),

  shareLinks: defineTable(shareLinksValidator).index('kind', ['kind']).index('code', ['code']),

  reports: defineTable(reportsValidator)
    .index('status', ['status'])
    .index('target', ['targetKind', 'targetId']),

  auditLogs: defineTable(auditLogsValidator)
    .index('entity', ['entityKind', 'entityId'])
    .index('action', ['action'])
    .index('createdAt', ['createdAt']),

  pointsLedger: defineTable(pointsLedgerValidator)
    .index('userId', ['userId'])
    .index('createdAt', ['createdAt'])
    .index('userId_createdAt', ['userId', 'createdAt']),

  userStats: defineTable(userStatsValidator)
    .index('userId', ['userId'])
    .index('lifetimePoints', ['lifetimePoints'])
    .index('pointsBalance', ['pointsBalance']),

  userShowStats: defineTable(userShowStatsValidator)
    .index('userId', ['userId'])
    .index('showId', ['showId'])
    .index('user_show', ['userId', 'showId']),

  predictionOptionStats: defineTable(predictionOptionStatsValidator)
    .index('predictionId', ['predictionId'])
    .index('prediction_option', ['predictionId', 'optionId']),

  episodeFollows: defineTable(episodeFollowsValidator).index('user_episode', [
    'userId',
    'episodeId',
  ]),

  episodeStats: defineTable(episodeStatsValidator).index('episodeId', ['episodeId']),
});
