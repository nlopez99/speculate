import redaxios from 'redaxios';

// ============================================================================
// Type Definitions
// ============================================================================

export interface LoginRequest {
  apikey: string;
  pin?: string;
}

export interface LoginResponse {
  data: {
    token: string;
  };
  status: string;
}

export interface Alias {
  language?: string;
  name?: string;
}

export interface ArtworkStatus {
  id?: number;
  name?: string;
}

export interface ArtworkType {
  height?: number;
  id?: number;
  imageFormat?: string;
  name?: string;
  recordType?: string;
  slug?: string;
  thumbHeight?: number;
  thumbWidth?: number;
  width?: number;
}

export interface ArtworkBaseRecord {
  height?: number;
  id?: number;
  image?: string;
  includesText?: boolean;
  language?: string;
  score?: number;
  thumbnail?: string;
  type?: number;
  width?: number;
}

export interface ArtworkExtendedRecord extends ArtworkBaseRecord {
  episodeId?: number;
  movieId?: number;
  networkId?: number;
  peopleId?: number;
  seasonId?: number;
  seriesId?: number;
  seriesPeopleId?: number;
  status?: ArtworkStatus;
  tagOptions?: TagOption[];
  thumbnailHeight?: number;
  thumbnailWidth?: number;
  updatedAt?: number;
}

export interface AwardBaseRecord {
  id?: number;
  name?: string;
}

export interface AwardCategoryBaseRecord {
  allowCoNominees?: boolean;
  award?: AwardBaseRecord;
  forMovies?: boolean;
  forSeries?: boolean;
  id?: number;
  name?: string;
}

export interface AwardNomineeBaseRecord {
  character?: Character;
  details?: string;
  episode?: EpisodeBaseRecord;
  id?: number;
  isWinner?: boolean;
  movie?: MovieBaseRecord;
  series?: SeriesBaseRecord;
  year?: string;
  category?: string;
  name?: string;
}

export interface AwardCategoryExtendedRecord extends AwardCategoryBaseRecord {
  nominees?: AwardNomineeBaseRecord[];
}

export interface AwardExtendedRecord extends AwardBaseRecord {
  categories?: AwardCategoryBaseRecord[];
  score?: number;
}

export interface Biography {
  biography?: string;
  language?: string;
}

export interface Character {
  aliases?: Alias[];
  episode?: RecordInfo;
  episodeId?: number | null;
  id?: number;
  image?: string;
  isFeatured?: boolean;
  movieId?: number | null;
  movie?: RecordInfo;
  name?: string;
  nameTranslations?: string[];
  overviewTranslations?: string[];
  peopleId?: number;
  personImgURL?: string;
  peopleType?: string;
  seriesId?: number | null;
  series?: RecordInfo;
  sort?: number;
  tagOptions?: TagOption[];
  type?: number;
  url?: string;
  personName?: string;
}

export interface CompanyRelationShip {
  id?: number | null;
  typeName?: string;
}

export interface ParentCompany {
  id?: number | null;
  name?: string;
  relation?: CompanyRelationShip;
}

export interface Company {
  activeDate?: string;
  aliases?: Alias[];
  country?: string;
  id?: number;
  inactiveDate?: string;
  name?: string;
  nameTranslations?: string[];
  overviewTranslations?: string[];
  primaryCompanyType?: number | null;
  slug?: string;
  parentCompany?: ParentCompany;
  tagOptions?: TagOption[];
}

export interface CompanyType {
  companyTypeId?: number;
  companyTypeName?: string;
}

export interface ContentRating {
  id?: number;
  name?: string;
  description?: string;
  country?: string;
  contentType?: string;
  order?: number;
  fullName?: string;
}

export interface Country {
  id?: string;
  name?: string;
  shortCode?: string;
}

export interface Entity {
  movieId?: number;
  order?: number;
  seriesId?: number;
}

export interface EntityType {
  id?: number;
  name?: string;
  hasSpecials?: boolean;
}

export interface EntityUpdate {
  entityType?: string;
  methodInt?: number;
  method?: string;
  extraInfo?: string;
  userId?: number;
  recordType?: string;
  recordId?: number;
  timeStamp?: number;
  seriesId?: number;
  mergeToId?: number;
  mergeToEntityType?: string;
}

export interface EpisodeBaseRecord {
  absoluteNumber?: number;
  aired?: string;
  airsAfterSeason?: number;
  airsBeforeEpisode?: number;
  airsBeforeSeason?: number;
  finaleType?: string;
  id?: number;
  image?: string;
  imageType?: number | null;
  isMovie?: number;
  lastUpdated?: string;
  linkedMovie?: number;
  name?: string;
  nameTranslations?: string[];
  number?: number;
  overview?: string;
  overviewTranslations?: string[];
  runtime?: number | null;
  seasonNumber?: number;
  seasons?: SeasonBaseRecord[];
  seriesId?: number;
  seasonName?: string;
  year?: string;
}

export interface EpisodeExtendedRecord extends Omit<EpisodeBaseRecord, 'overview'> {
  awards?: AwardBaseRecord[];
  characters?: Character[];
  companies?: Company[];
  contentRatings?: ContentRating[];
  networks?: Company[];
  nominations?: AwardNomineeBaseRecord[];
  productionCode?: string;
  remoteIds?: RemoteID[];
  studios?: Company[];
  tagOptions?: TagOption[];
  trailers?: Trailer[];
  translations?: TranslationExtended;
}

export interface Favorites {
  series?: number[];
  movies?: number[];
  episodes?: number[];
  artwork?: number[];
  people?: number[];
  lists?: number[];
}

export interface FavoriteRecord {
  series?: number;
  movie?: number;
  episode?: number;
  artwork?: number;
  people?: number;
  list?: number;
}

export interface Gender {
  id?: number;
  name?: string;
}

export interface GenreBaseRecord {
  id?: number;
  name?: string;
  slug?: string;
}

export interface Language {
  id?: string;
  name?: string;
  nativeName?: string;
  shortCode?: string;
}

export interface ListBaseRecord {
  aliases?: Alias[];
  id?: number;
  image?: string;
  imageIsFallback?: boolean;
  isOfficial?: boolean;
  name?: string;
  nameTranslations?: string[];
  overview?: string;
  overviewTranslations?: string[];
  remoteIds?: RemoteID[];
  tags?: TagOption[];
  score?: number;
  url?: string;
}

export interface ListExtendedRecord extends Omit<ListBaseRecord, 'tags' | 'overview'> {
  entities?: Entity[];
  score?: number;
}

export interface MovieBaseRecord {
  aliases?: Alias[];
  id?: number;
  image?: string;
  lastUpdated?: string;
  name?: string;
  nameTranslations?: string[];
  overviewTranslations?: string[];
  score?: number;
  slug?: string;
  status?: Status;
  runtime?: number | null;
  year?: string;
}

export interface InspirationType {
  id?: number;
  name?: string;
  description?: string;
  reference_name?: string;
  url?: string;
}

export interface Inspiration {
  id?: number;
  type?: string;
  type_name?: string;
  url?: string;
}

export interface ProductionCountry {
  id?: number;
  country?: string;
  name?: string;
}

export interface Release {
  country?: string;
  date?: string;
  detail?: string;
}

export interface Companies {
  studio?: Company[];
  network?: Company[];
  production?: Company[];
  distributor?: Company[];
  special_effects?: Company[];
}

export interface StudioBaseRecord {
  id?: number;
  name?: string;
  parentStudio?: number;
}

export interface MovieExtendedRecord extends MovieBaseRecord {
  artworks?: ArtworkBaseRecord[];
  audioLanguages?: string[];
  awards?: AwardBaseRecord[];
  boxOffice?: string;
  boxOfficeUS?: string;
  budget?: string;
  characters?: Character[];
  companies?: Companies;
  contentRatings?: ContentRating[];
  first_release?: Release;
  genres?: GenreBaseRecord[];
  inspirations?: Inspiration[];
  lists?: ListBaseRecord[];
  originalCountry?: string;
  originalLanguage?: string;
  production_countries?: ProductionCountry[];
  releases?: Release[];
  remoteIds?: RemoteID[];
  spoken_languages?: string[];
  studios?: StudioBaseRecord[];
  subtitleLanguages?: string[];
  tagOptions?: TagOption[];
  trailers?: Trailer[];
  translations?: TranslationExtended;
}

export interface PeopleBaseRecord {
  aliases?: Alias[];
  id?: number;
  image?: string;
  lastUpdated?: string;
  name?: string;
  nameTranslations?: string[];
  overviewTranslations?: string[];
  score?: number;
}

export interface Race {
  // Empty interface as per spec
}

export interface PeopleExtendedRecord extends PeopleBaseRecord {
  awards?: AwardBaseRecord[];
  biographies?: Biography[];
  birth?: string;
  birthPlace?: string;
  characters?: Character[];
  death?: string;
  gender?: number;
  races?: Race[];
  remoteIds?: RemoteID[];
  slug?: string;
  tagOptions?: TagOption[];
  translations?: TranslationExtended;
}

export interface PeopleType {
  id?: number;
  name?: string;
}

export interface RecordInfo {
  image?: string;
  name?: string;
  year?: string;
}

export interface RemoteID {
  id?: string;
  type?: number;
  sourceName?: string;
}

export interface TranslationSimple {
  [key: string]: string;
}

export interface SearchResult {
  aliases?: string[];
  companies?: string[];
  companyType?: string;
  country?: string;
  director?: string;
  first_air_time?: string;
  genres?: string[];
  id?: string;
  image_url?: string;
  name?: string;
  is_official?: boolean;
  name_translated?: string;
  network?: string;
  objectID?: string;
  officialList?: string;
  overview?: string;
  overviews?: TranslationSimple;
  overview_translated?: string[];
  poster?: string;
  posters?: string[];
  primary_language?: string;
  remote_ids?: RemoteID[];
  status?: string;
  slug?: string;
  studios?: string[];
  title?: string;
  thumbnail?: string;
  translations?: TranslationSimple;
  translationsWithLang?: string[];
  tvdb_id?: string;
  type?: string;
  year?: string;
}

export interface SearchByRemoteIdResult {
  series?: SeriesBaseRecord;
  people?: PeopleBaseRecord;
  movie?: MovieBaseRecord;
  episode?: EpisodeBaseRecord;
  company?: Company;
}

export interface SeasonType {
  alternateName?: string;
  id?: number;
  name?: string;
  type?: string;
}

export interface SeasonBaseRecord {
  id?: number;
  image?: string;
  imageType?: number;
  lastUpdated?: string;
  name?: string;
  nameTranslations?: string[];
  number?: number;
  overviewTranslations?: string[];
  companies?: Companies;
  seriesId?: number;
  type?: SeasonType;
  year?: string;
}

export interface SeasonExtendedRecord extends SeasonBaseRecord {
  artwork?: ArtworkBaseRecord[];
  episodes?: EpisodeBaseRecord[];
  trailers?: Trailer[];
  tagOptions?: TagOption[];
  translations?: Translation[];
}

export interface SeriesAirsDays {
  friday?: boolean;
  monday?: boolean;
  saturday?: boolean;
  sunday?: boolean;
  thursday?: boolean;
  tuesday?: boolean;
  wednesday?: boolean;
}

export interface SeriesBaseRecord {
  aliases?: Alias[];
  averageRuntime?: number | null;
  country?: string;
  defaultSeasonType?: number;
  episodes?: EpisodeBaseRecord[];
  firstAired?: string;
  id?: number;
  image?: string;
  isOrderRandomized?: boolean;
  lastAired?: string;
  lastUpdated?: string;
  name?: string;
  nameTranslations?: string[];
  nextAired?: string;
  originalCountry?: string;
  originalLanguage?: string;
  overviewTranslations?: string[];
  score?: number;
  slug?: string;
  status?: Status;
  year?: string;
}

export interface SeriesExtendedRecord extends SeriesBaseRecord {
  abbreviation?: string;
  airsDays?: SeriesAirsDays;
  airsTime?: string;
  artworks?: ArtworkExtendedRecord[];
  characters?: Character[];
  contentRatings?: ContentRating[];
  lists?: ListBaseRecord[];
  genres?: GenreBaseRecord[];
  companies?: Company[];
  originalNetwork?: Company;
  overview?: string;
  latestNetwork?: Company;
  remoteIds?: RemoteID[];
  seasons?: SeasonBaseRecord[];
  seasonTypes?: SeasonType[];
  tags?: TagOption[];
  trailers?: Trailer[];
  translations?: TranslationExtended;
}

export interface SourceType {
  id?: number;
  name?: string;
  postfix?: string;
  prefix?: string;
  slug?: string;
  sort?: number;
}

export interface Status {
  id?: number | null;
  keepUpdated?: boolean;
  name?: string;
  recordType?: string;
}

export interface Tag {
  allowsMultiple?: boolean;
  helpText?: string;
  id?: number;
  name?: string;
  options?: TagOption[];
}

export interface TagOption {
  helpText?: string;
  id?: number;
  name?: string;
  tag?: number;
  tagName?: string;
}

export interface TagOptionEntity {
  name?: string;
  tagName?: string;
  tagId?: number;
}

export interface Trailer {
  id?: number;
  language?: string;
  name?: string;
  url?: string;
  runtime?: number;
}

export interface Translation {
  aliases?: string[];
  isAlias?: boolean;
  isPrimary?: boolean;
  language?: string;
  name?: string;
  overview?: string;
  tagline?: string;
}

export interface TranslationExtended {
  nameTranslations?: Translation[];
  overviewTranslations?: Translation[];
  alias?: string[];
}

export interface UserInfo {
  id?: number;
  language?: string;
  name?: string;
  type?: string;
}

export interface Links {
  prev?: string | null;
  self?: string | null;
  next?: string;
  total_items?: number;
  page_size?: number;
}

// Response wrapper types
export interface ApiResponse<T> {
  data: T;
  status: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  status: string;
  links?: Links;
}

// Query parameter types
export interface SearchParams {
  query?: string;
  q?: string;
  type?: string;
  year?: number;
  company?: string;
  country?: string;
  director?: string;
  language?: string;
  primaryType?: string;
  network?: string;
  remote_id?: string;
  offset?: number;
  limit?: number;
}

export interface SeriesFilterParams {
  company?: number;
  contentRating?: number;
  country: string;
  genre?: number;
  lang: string;
  sort?: 'score' | 'firstAired' | 'lastAired' | 'name';
  sortType?: 'asc' | 'desc';
  status?: 1 | 2 | 3;
  year?: number;
}

export interface MoviesFilterParams {
  company?: number;
  contentRating?: number;
  country: string;
  genre?: number;
  lang: string;
  sort?: 'score' | 'firstAired' | 'name';
  status?: 1 | 2 | 3;
  year?: number;
}

export interface UpdatesParams {
  since: number;
  type?: string;
  action?: 'delete' | 'update';
  page?: number;
}

export interface SeriesEpisodesParams {
  page: number;
  season?: number;
  episodeNumber?: number;
  airDate?: string;
}

export type SeasonTypeEnum = 'default' | 'official' | 'dvd' | 'absolute' | 'alternate' | 'regional';
export type MetaType = 'translations' | 'episodes';

// ============================================================================
// TVDB API Client
// ============================================================================

export class TVDBClient {
  private client: typeof redaxios;
  private token?: string;

  constructor(baseURL = 'https://api4.thetvdb.com/v4') {
    this.client = redaxios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Set the authentication token
   */
  setToken(token: string): void {
    this.token = token;
    this.client.defaults.headers = {
      ...this.client.defaults.headers,
      Authorization: `Bearer ${token}`,
    };
  }

  /**
   * Authenticate and get a token
   */
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await this.client.post<LoginResponse>('/login', credentials);
    if (response.data.data?.token) {
      this.setToken(response.data.data.token);
    }
    return response.data;
  }

  // ============================================================================
  // Artwork Endpoints
  // ============================================================================

  async getArtworkBase(id: number): Promise<ApiResponse<ArtworkBaseRecord>> {
    const response = await this.client.get<ApiResponse<ArtworkBaseRecord>>(`/artwork/${id}`);
    return response.data;
  }

  async getArtworkExtended(id: number): Promise<ApiResponse<ArtworkExtendedRecord>> {
    const response = await this.client.get<ApiResponse<ArtworkExtendedRecord>>(`/artwork/${id}/extended`);
    return response.data;
  }

  async getAllArtworkStatuses(): Promise<ApiResponse<ArtworkStatus[]>> {
    const response = await this.client.get<ApiResponse<ArtworkStatus[]>>('/artwork/statuses');
    return response.data;
  }

  async getAllArtworkTypes(): Promise<ApiResponse<ArtworkType[]>> {
    const response = await this.client.get<ApiResponse<ArtworkType[]>>('/artwork/types');
    return response.data;
  }

  // ============================================================================
  // Award Endpoints
  // ============================================================================

  async getAllAwards(): Promise<ApiResponse<AwardBaseRecord[]>> {
    const response = await this.client.get<ApiResponse<AwardBaseRecord[]>>('/awards');
    return response.data;
  }

  async getAward(id: number): Promise<ApiResponse<AwardBaseRecord>> {
    const response = await this.client.get<ApiResponse<AwardBaseRecord>>(`/awards/${id}`);
    return response.data;
  }

  async getAwardExtended(id: number): Promise<ApiResponse<AwardExtendedRecord>> {
    const response = await this.client.get<ApiResponse<AwardExtendedRecord>>(`/awards/${id}/extended`);
    return response.data;
  }

  async getAwardCategory(id: number): Promise<ApiResponse<AwardCategoryBaseRecord>> {
    const response = await this.client.get<ApiResponse<AwardCategoryBaseRecord>>(`/awards/categories/${id}`);
    return response.data;
  }

  async getAwardCategoryExtended(id: number): Promise<ApiResponse<AwardCategoryExtendedRecord>> {
    const response = await this.client.get<ApiResponse<AwardCategoryExtendedRecord>>(`/awards/categories/${id}/extended`);
    return response.data;
  }

  // ============================================================================
  // Character Endpoints
  // ============================================================================

  async getCharacterBase(id: number): Promise<ApiResponse<Character>> {
    const response = await this.client.get<ApiResponse<Character>>(`/characters/${id}`);
    return response.data;
  }

  // ============================================================================
  // Company Endpoints
  // ============================================================================

  async getAllCompanies(page?: number): Promise<PaginatedResponse<Company>> {
    const response = await this.client.get<PaginatedResponse<Company>>('/companies', {
      params: page ? { page } : undefined,
    });
    return response.data;
  }

  async getCompanyTypes(): Promise<ApiResponse<CompanyType[]>> {
    const response = await this.client.get<ApiResponse<CompanyType[]>>('/companies/types');
    return response.data;
  }

  async getCompany(id: number): Promise<ApiResponse<Company>> {
    const response = await this.client.get<ApiResponse<Company>>(`/companies/${id}`);
    return response.data;
  }

  // ============================================================================
  // Content Rating Endpoints
  // ============================================================================

  async getAllContentRatings(): Promise<ApiResponse<ContentRating[]>> {
    const response = await this.client.get<ApiResponse<ContentRating[]>>('/content/ratings');
    return response.data;
  }

  // ============================================================================
  // Country Endpoints
  // ============================================================================

  async getAllCountries(): Promise<ApiResponse<Country[]>> {
    const response = await this.client.get<ApiResponse<Country[]>>('/countries');
    return response.data;
  }

  // ============================================================================
  // Entity Endpoints
  // ============================================================================

  async getEntityTypes(): Promise<ApiResponse<EntityType[]>> {
    const response = await this.client.get<ApiResponse<EntityType[]>>('/entities');
    return response.data;
  }

  // ============================================================================
  // Episode Endpoints
  // ============================================================================

  async getAllEpisodes(page?: number): Promise<PaginatedResponse<EpisodeBaseRecord>> {
    const response = await this.client.get<PaginatedResponse<EpisodeBaseRecord>>('/episodes', {
      params: page ? { page } : undefined,
    });
    return response.data;
  }

  async getEpisodeBase(id: number): Promise<ApiResponse<EpisodeBaseRecord>> {
    const response = await this.client.get<ApiResponse<EpisodeBaseRecord>>(`/episodes/${id}`);
    return response.data;
  }

  async getEpisodeExtended(id: number, meta?: 'translations'): Promise<ApiResponse<EpisodeExtendedRecord>> {
    const response = await this.client.get<ApiResponse<EpisodeExtendedRecord>>(`/episodes/${id}/extended`, {
      params: meta ? { meta } : undefined,
    });
    return response.data;
  }

  async getEpisodeTranslation(id: number, language: string): Promise<ApiResponse<Translation>> {
    const response = await this.client.get<ApiResponse<Translation>>(`/episodes/${id}/translations/${language}`);
    return response.data;
  }

  // ============================================================================
  // Gender Endpoints
  // ============================================================================

  async getAllGenders(): Promise<ApiResponse<Gender[]>> {
    const response = await this.client.get<ApiResponse<Gender[]>>('/genders');
    return response.data;
  }

  // ============================================================================
  // Genre Endpoints
  // ============================================================================

  async getAllGenres(): Promise<ApiResponse<GenreBaseRecord[]>> {
    const response = await this.client.get<ApiResponse<GenreBaseRecord[]>>('/genres');
    return response.data;
  }

  async getGenreBase(id: number): Promise<ApiResponse<GenreBaseRecord>> {
    const response = await this.client.get<ApiResponse<GenreBaseRecord>>(`/genres/${id}`);
    return response.data;
  }

  // ============================================================================
  // Inspiration Type Endpoints
  // ============================================================================

  async getAllInspirationTypes(): Promise<ApiResponse<InspirationType[]>> {
    const response = await this.client.get<ApiResponse<InspirationType[]>>('/inspiration/types');
    return response.data;
  }

  // ============================================================================
  // Language Endpoints
  // ============================================================================

  async getAllLanguages(): Promise<ApiResponse<Language[]>> {
    const response = await this.client.get<ApiResponse<Language[]>>('/languages');
    return response.data;
  }

  // ============================================================================
  // List Endpoints
  // ============================================================================

  async getAllLists(page?: number): Promise<PaginatedResponse<ListBaseRecord>> {
    const response = await this.client.get<PaginatedResponse<ListBaseRecord>>('/lists', {
      params: page ? { page } : undefined,
    });
    return response.data;
  }

  async getList(id: number): Promise<ApiResponse<ListBaseRecord>> {
    const response = await this.client.get<ApiResponse<ListBaseRecord>>(`/lists/${id}`);
    return response.data;
  }

  async getListBySlug(slug: string): Promise<ApiResponse<ListBaseRecord>> {
    const response = await this.client.get<ApiResponse<ListBaseRecord>>(`/lists/slug/${slug}`);
    return response.data;
  }

  async getListExtended(id: number): Promise<ApiResponse<ListExtendedRecord>> {
    const response = await this.client.get<ApiResponse<ListExtendedRecord>>(`/lists/${id}/extended`);
    return response.data;
  }

  async getListTranslation(id: number, language: string): Promise<ApiResponse<Translation[]>> {
    const response = await this.client.get<ApiResponse<Translation[]>>(`/lists/${id}/translations/${language}`);
    return response.data;
  }

  // ============================================================================
  // Movie Endpoints
  // ============================================================================

  async getAllMovies(page?: number): Promise<PaginatedResponse<MovieBaseRecord>> {
    const response = await this.client.get<PaginatedResponse<MovieBaseRecord>>('/movies', {
      params: page ? { page } : undefined,
    });
    return response.data;
  }

  async getMovieBase(id: number): Promise<ApiResponse<MovieBaseRecord>> {
    const response = await this.client.get<ApiResponse<MovieBaseRecord>>(`/movies/${id}`);
    return response.data;
  }

  async getMovieExtended(
    id: number,
    options?: { meta?: 'translations'; short?: boolean }
  ): Promise<ApiResponse<MovieExtendedRecord>> {
    const response = await this.client.get<ApiResponse<MovieExtendedRecord>>(`/movies/${id}/extended`, {
      params: options,
    });
    return response.data;
  }

  async getMoviesFilter(params: MoviesFilterParams): Promise<ApiResponse<MovieBaseRecord[]>> {
    const response = await this.client.get<ApiResponse<MovieBaseRecord[]>>('/movies/filter', { params });
    return response.data;
  }

  async getMovieBaseBySlug(slug: string): Promise<ApiResponse<MovieBaseRecord>> {
    const response = await this.client.get<ApiResponse<MovieBaseRecord>>(`/movies/slug/${slug}`);
    return response.data;
  }

  async getMovieTranslation(id: number, language: string): Promise<ApiResponse<Translation>> {
    const response = await this.client.get<ApiResponse<Translation>>(`/movies/${id}/translations/${language}`);
    return response.data;
  }

  async getAllMovieStatuses(): Promise<ApiResponse<Status[]>> {
    const response = await this.client.get<ApiResponse<Status[]>>('/movies/statuses');
    return response.data;
  }

  // ============================================================================
  // People Endpoints
  // ============================================================================

  async getAllPeople(page?: number): Promise<PaginatedResponse<PeopleBaseRecord>> {
    const response = await this.client.get<PaginatedResponse<PeopleBaseRecord>>('/people', {
      params: page ? { page } : undefined,
    });
    return response.data;
  }

  async getPeopleBase(id: number): Promise<ApiResponse<PeopleBaseRecord>> {
    const response = await this.client.get<ApiResponse<PeopleBaseRecord>>(`/people/${id}`);
    return response.data;
  }

  async getPeopleExtended(id: number, meta?: 'translations'): Promise<ApiResponse<PeopleExtendedRecord>> {
    const response = await this.client.get<ApiResponse<PeopleExtendedRecord>>(`/people/${id}/extended`, {
      params: meta ? { meta } : undefined,
    });
    return response.data;
  }

  async getPeopleTranslation(id: number, language: string): Promise<ApiResponse<Translation>> {
    const response = await this.client.get<ApiResponse<Translation>>(`/people/${id}/translations/${language}`);
    return response.data;
  }

  async getAllPeopleTypes(): Promise<ApiResponse<PeopleType[]>> {
    const response = await this.client.get<ApiResponse<PeopleType[]>>('/people/types');
    return response.data;
  }

  // ============================================================================
  // Search Endpoints
  // ============================================================================

  async search(params: SearchParams): Promise<PaginatedResponse<SearchResult>> {
    const response = await this.client.get<PaginatedResponse<SearchResult>>('/search', { params });
    return response.data;
  }

  async searchByRemoteId(remoteId: string): Promise<ApiResponse<SearchByRemoteIdResult[]>> {
    const response = await this.client.get<ApiResponse<SearchByRemoteIdResult[]>>(`/search/remoteid/${remoteId}`);
    return response.data;
  }

  // ============================================================================
  // Season Endpoints
  // ============================================================================

  async getAllSeasons(page?: number): Promise<ApiResponse<SeasonBaseRecord[]>> {
    const response = await this.client.get<ApiResponse<SeasonBaseRecord[]>>('/seasons', {
      params: page ? { page } : undefined,
    });
    return response.data;
  }

  async getSeasonBase(id: number): Promise<ApiResponse<SeasonBaseRecord>> {
    const response = await this.client.get<ApiResponse<SeasonBaseRecord>>(`/seasons/${id}`);
    return response.data;
  }

  async getSeasonExtended(id: number): Promise<ApiResponse<SeasonExtendedRecord>> {
    const response = await this.client.get<ApiResponse<SeasonExtendedRecord>>(`/seasons/${id}/extended`);
    return response.data;
  }

  async getSeasonTypes(): Promise<ApiResponse<SeasonType[]>> {
    const response = await this.client.get<ApiResponse<SeasonType[]>>('/seasons/types');
    return response.data;
  }

  async getSeasonTranslation(id: number, language: string): Promise<ApiResponse<Translation>> {
    const response = await this.client.get<ApiResponse<Translation>>(`/seasons/${id}/translations/${language}`);
    return response.data;
  }

  // ============================================================================
  // Series Endpoints
  // ============================================================================

  async getAllSeries(page?: number): Promise<PaginatedResponse<SeriesBaseRecord>> {
    const response = await this.client.get<PaginatedResponse<SeriesBaseRecord>>('/series', {
      params: page ? { page } : undefined,
    });
    return response.data;
  }

  async getSeriesBase(id: number): Promise<ApiResponse<SeriesBaseRecord>> {
    const response = await this.client.get<ApiResponse<SeriesBaseRecord>>(`/series/${id}`);
    return response.data;
  }

  async getSeriesArtworks(
    id: number,
    options?: { lang?: string; type?: number }
  ): Promise<ApiResponse<SeriesExtendedRecord>> {
    const response = await this.client.get<ApiResponse<SeriesExtendedRecord>>(`/series/${id}/artworks`, {
      params: options,
    });
    return response.data;
  }

  async getSeriesNextAired(id: number): Promise<ApiResponse<SeriesBaseRecord>> {
    const response = await this.client.get<ApiResponse<SeriesBaseRecord>>(`/series/${id}/nextAired`);
    return response.data;
  }

  async getSeriesExtended(
    id: number,
    options?: { meta?: MetaType; short?: boolean }
  ): Promise<ApiResponse<SeriesExtendedRecord>> {
    const response = await this.client.get<ApiResponse<SeriesExtendedRecord>>(`/series/${id}/extended`, {
      params: options,
    });
    return response.data;
  }

  async getSeriesEpisodes(
    id: number,
    seasonType: SeasonTypeEnum,
    params?: SeriesEpisodesParams
  ): Promise<ApiResponse<{ series: SeriesBaseRecord; episodes: EpisodeBaseRecord[] }>> {
    const response = await this.client.get<ApiResponse<{ series: SeriesBaseRecord; episodes: EpisodeBaseRecord[] }>>(
      `/series/${id}/episodes/${seasonType}`,
      { params }
    );
    return response.data;
  }

  async getSeriesSeasonEpisodesTranslated(
    id: number,
    seasonType: SeasonTypeEnum,
    lang: string,
    page: number
  ): Promise<ApiResponse<{ series: SeriesBaseRecord }>> {
    const response = await this.client.get<ApiResponse<{ series: SeriesBaseRecord }>>(
      `/series/${id}/episodes/${seasonType}/${lang}`,
      { params: { page } }
    );
    return response.data;
  }

  async getSeriesFilter(params: SeriesFilterParams): Promise<ApiResponse<SeriesBaseRecord[]>> {
    const response = await this.client.get<ApiResponse<SeriesBaseRecord[]>>('/series/filter', { params });
    return response.data;
  }

  async getSeriesBaseBySlug(slug: string): Promise<ApiResponse<SeriesBaseRecord>> {
    const response = await this.client.get<ApiResponse<SeriesBaseRecord>>(`/series/slug/${slug}`);
    return response.data;
  }

  async getSeriesTranslation(id: number, language: string): Promise<ApiResponse<Translation>> {
    const response = await this.client.get<ApiResponse<Translation>>(`/series/${id}/translations/${language}`);
    return response.data;
  }

  async getAllSeriesStatuses(): Promise<ApiResponse<Status[]>> {
    const response = await this.client.get<ApiResponse<Status[]>>('/series/statuses');
    return response.data;
  }

  // ============================================================================
  // Source Type Endpoints
  // ============================================================================

  async getAllSourceTypes(): Promise<ApiResponse<SourceType[]>> {
    const response = await this.client.get<ApiResponse<SourceType[]>>('/sources/types');
    return response.data;
  }

  // ============================================================================
  // Update Endpoints
  // ============================================================================

  async getUpdates(params: UpdatesParams): Promise<PaginatedResponse<EntityUpdate>> {
    const response = await this.client.get<PaginatedResponse<EntityUpdate>>('/updates', { params });
    return response.data;
  }

  // ============================================================================
  // User Endpoints
  // ============================================================================

  async getUserInfo(): Promise<ApiResponse<UserInfo[]>> {
    const response = await this.client.get<ApiResponse<UserInfo[]>>('/user');
    return response.data;
  }

  async getUserInfoById(id: number): Promise<ApiResponse<UserInfo[]>> {
    const response = await this.client.get<ApiResponse<UserInfo[]>>(`/user/${id}`);
    return response.data;
  }

  async getUserFavorites(): Promise<ApiResponse<Favorites[]>> {
    const response = await this.client.get<ApiResponse<Favorites[]>>('/user/favorites');
    return response.data;
  }

  async createUserFavorite(favorite: FavoriteRecord): Promise<void> {
    await this.client.post('/user/favorites', favorite);
  }
}

// Export a singleton instance
export const tvdbClient = new TVDBClient();

// Export default
export default TVDBClient;