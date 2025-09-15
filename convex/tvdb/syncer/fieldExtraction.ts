import type { SeriesExtendedRecord, SeasonExtendedRecord, EpisodeExtendedRecord } from '../client/api';

/**
 * Extract only the essential queryable fields from full series data
 * These are the "hot" fields that remain in the indexed database
 */
export const extractHotSeriesFields = (series: SeriesExtendedRecord) => {
  // Find external IDs
  const tmdbId = series.remoteIds?.find((r: any) => r.sourceName === 'TheMovieDB.com')?.id;
  const imdbId = series.remoteIds?.find((r: any) => r.sourceName === 'IMDB')?.id;

  // Map status to our simplified enum
  const mapStatus = (status?: { name?: string }) => {
    const statusName = status?.name?.toLowerCase();
    if (statusName?.includes('continuing')) return 'running';
    if (statusName?.includes('ended')) return 'ended';
    if (statusName?.includes('upcoming')) return 'hiatus';
    return 'unknown';
  };

  return {
    title: series.name || '',
    slug: series.slug || '',
    tvdbId: String(series.id),
    tmdbId: tmdbId ? String(tmdbId) : undefined,
    imdbId: imdbId ? String(imdbId) : undefined,
    status: mapStatus(series.status),
    firstAirYear: series.firstAired ? new Date(series.firstAired).getFullYear() : undefined,
    // Only essential fields for queries - full data in cold storage
  };
};

/**
 * Extract only the essential queryable fields from full season data
 */
export const extractHotSeasonFields = (season: SeasonExtendedRecord, showId: string) => {
  return {
    showId,
    seasonNumber: season.number || 0,
    title: season.name,
    tvdbId: String(season.id),
    episodeCount: season.episodes?.length,
    // Only essential fields for queries - full data in cold storage
  };
};

/**
 * Extract only the essential queryable fields from full episode data
 */
export const extractHotEpisodeFields = (
  episodes: EpisodeExtendedRecord[],
  showId: string,
  seasonId: string,
  seasonNumber: number
) => {
  return episodes.map(ep => {
    const airDate = ep.aired ? new Date(ep.aired) : undefined;
    const hasAired = airDate ? airDate < new Date() : false;

    return {
      showId,
      seasonId,
      seasonNumber,
      episodeNumber: ep.number || 0,
      title: ep.name || `Episode ${ep.number}`,
      tvdbId: String(ep.id),
      airDateUtc: airDate?.getTime(),
      hasAired,
      // Runtime omitted from hot data - available in cold storage
      // Overview omitted from hot data - available in cold storage
      // Still URLs omitted from hot data - available in cold storage
    };
  });
};

/**
 * Compute a fingerprint of hot fields to detect changes
 * This prevents unnecessary writes when data hasn't actually changed
 */
export const computeHotFieldsFingerprint = (data: any): string => {
  // Sort keys and stringify for consistent hashing
  const sortedData = JSON.stringify(data, Object.keys(data).sort());

  // Simple hash using Node's crypto (if available) or fallback
  if (typeof require !== 'undefined') {
    const crypto = require('crypto');
    return crypto.createHash('sha1').update(sortedData).digest('hex');
  }

  // Fallback: simple string hash for browser environment
  let hash = 0;
  for (let i = 0; i < sortedData.length; i++) {
    const char = sortedData.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
};

/**
 * Check if hot fields have changed by comparing fingerprints
 */
export const hasHotFieldsChanged = (newData: any, existingFingerprint?: string): boolean => {
  if (!existingFingerprint) return true;
  const newFingerprint = computeHotFieldsFingerprint(newData);
  return newFingerprint !== existingFingerprint;
};

/**
 * Extract episode pack data for cold storage
 * Groups all episodes for a season into a single compressed blob
 */
export const createEpisodePack = (
  seriesId: number,
  seasonId: number,
  seasonNumber: number,
  episodes: EpisodeExtendedRecord[]
) => {
  // Sort episodes by episode number for stable packing
  const sortedEpisodes = [...episodes].sort((a, b) => {
    const numA = a.number || 0;
    const numB = b.number || 0;
    return numA - numB;
  });

  return {
    seriesId,
    seasonId,
    seasonNumber,
    episodeCount: sortedEpisodes.length,
    episodes: sortedEpisodes.map(ep => ({
      ...ep,
      // Ensure all episode data is included for cold storage
      _metadata: {
        packedAt: Date.now(),
        sourceApi: 'tvdb-v4',
      }
    })),
  };
};