import { PlaywrightCrawler, Configuration, log } from 'crawlee';
import type { Page, Response, Request as PlaywrightRequest } from 'playwright';
import { SELECTORS } from './selectors.js';
import { config } from '../config.js';
import { proxyManager } from '../services/proxyManager.js';
import { cookieManager } from '../services/cookieManager.js';

export interface ReviewsDistribution {
  oneStar: number;
  twoStar: number;
  threeStar: number;
  fourStar: number;
  fiveStar: number;
}

export interface OpeningHoursItem {
  day: string;
  hours: string;
}

export interface ReviewsTagItem {
  title: string;
  count: number;
}

export interface PeopleAlsoSearchItem {
  category?: string | null;
  title: string;
  reviewsCount?: number | null;
  totalScore?: number | null;
}

export interface GBPProfile {
  // Legacy / Pantau compatible fields
  name: string;
  rating: number | null;
  reviewCount: number | null;
  category: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  openingHours: string[];
  placeUrl: string;
  latitude: number | null;
  longitude: number | null;

  // Apify compass/crawler-google-places (nwua9Gu5YrADL7ZDj) fields
  title: string;
  subTitle: string | null;
  totalScore: number | null;
  reviewsCount: number | null;
  reviewsDistribution: ReviewsDistribution;
  categoryName: string | null;
  categories: string[];
  neighborhood: string | null;
  street: string | null;
  city: string | null;
  postalCode: string | null;
  state: string | null;
  countryCode: string | null;
  plusCode: string | null;
  phoneUnformatted: string | null;
  cid: string | null;
  fid: string | null;
  placeId: string | null;
  location: {
    lat: number | null;
    lng: number | null;
  };
  permanentlyClosed: boolean;
  temporarilyClosed: boolean;
  openingHoursDetailed: OpeningHoursItem[];
  imageUrl: string | null;
  imagesCount: number | null;
  imageUrls: string[];
  reviewsTags: ReviewsTagItem[];
  peopleAlsoSearch: PeopleAlsoSearchItem[];
  additionalInfo: Record<string, Array<Record<string, boolean>>>;
  url: string;
  searchPageUrl: string | null;
  searchString: string | null;
  inputPlaceId: string | null;
  inputStartUrl: string | null;
  scrapedAt: string;
}

export interface GBPReview {
  // Legacy / Pantau compatible fields
  reviewId: string | null;
  reviewUrl: string | null;
  author: string;
  authorProfileUrl: string | null;
  rating: number;
  relativeTime: string | null;
  publishedAtDate: string | null;
  text: string | null;
  likes: number;
  ownerResponse?: {
    text: string;
    date: string | null;
  } | null;

  // Apify compass/crawler-google-places (nwua9Gu5YrADL7ZDj) fields
  name: string | null;
  reviewerId: string | null;
  reviewerUrl: string | null;
  reviewerPhotoUrl: string | null;
  reviewerNumberOfReviews: number | null;
  isLocalGuide: boolean;
  stars: number;
  publishAt: string | null;
  likesCount: number;
  textTranslated: string | null;
  responseFromOwnerDate: string | null;
  responseFromOwnerText: string | null;
  reviewImageUrls: string[];
  reviewContext: Record<string, string>;
  reviewDetailedRating: Record<string, number>;
  visitedIn: string | null;
  originalLanguage: string | null;
  translatedLanguage: string | null;
  reviewOrigin: string;
}

export interface StartUrlItem {
  url: string;
}

export type ReviewSortOption =
  | 'newest'
  | 'highest'
  | 'lowest'
  | 'relevant'
  | 'mostRelevant'
  | 'highestRanking'
  | 'lowestRanking';

export interface ScrapeOptions {
  // Legacy & direct target fields
  startUrls?: Array<StartUrlItem | string>;
  placeIds?: string[];
  placeId?: string;
  url?: string;
  query?: string;
  language?: string;
  hl?: string;
  maxReviews?: number;
  personalData?: boolean;
  reviewsStartDate?: string;
  sortBy?: ReviewSortOption;
  useProxy?: boolean;
  proxyUrl?: string;
  proxyUrls?: string[];

  // Apify compass/crawler-google-places (nwua9Gu5YrADL7ZDj) input fields
  searchStringsArray?: string[];
  locationQuery?: string;
  maxCrawledPlacesPerSearch?: number;
  reviewsSort?: ReviewSortOption;
  reviewsFilterString?: string;
  scrapeReviewsPersonalData?: boolean;
  oneReviewPerRow?: boolean;
  maxImages?: number;
  skipClosedPlaces?: boolean;
  scrapeReviewerName?: boolean;
  scrapeReviewerId?: boolean;
  scrapeReviewerUrl?: boolean;
  scrapeReviewId?: boolean;
  scrapeReviewUrl?: boolean;
  scrapeResponseFromOwnerText?: boolean;
}

/**
 * Parses relative time strings into estimated Date objects
 */
export function parseRelativeDate(raw: string): Date | null {
  if (!raw) return null;
  const text = raw
    .toLowerCase()
    .replace(/^(respon|respons|tanggapan)\s+(dari\s+)?pemilik\s*:\s*/i, '')
    .replace(/^(diedit|edited|bearbeitet|gewijzigd)\s*/i, '')
    .trim();
  const now = new Date();

  // Days
  if (
    text.includes('hari lalu') ||
    text.includes('hari yang lalu') ||
    text.includes('sehari') ||
    text.includes('day ago') ||
    text.includes('days ago') ||
    text.includes('tage') ||
    text.includes('tagen') ||
    text.includes('dagen geleden') ||
    text.includes('días')
  ) {
    const match = text.match(/(\d+)/);
    const days = match ? parseInt(match[1], 10) : 1;
    now.setDate(now.getDate() - days);
    return now;
  }

  // Weeks
  if (
    text.includes('minggu lalu') ||
    text.includes('minggu yang lalu') ||
    text.includes('seminggu') ||
    text.includes('week ago') ||
    text.includes('weeks ago') ||
    text.includes('woche') ||
    text.includes('wochen') ||
    text.includes('weken geleden') ||
    text.includes('semanas')
  ) {
    const match = text.match(/(\d+)/);
    const weeks = match ? parseInt(match[1], 10) : 1;
    now.setDate(now.getDate() - weeks * 7);
    return now;
  }

  // Months
  if (
    text.includes('bulan lalu') ||
    text.includes('bulan yang lalu') ||
    text.includes('sebulan') ||
    text.includes('month ago') ||
    text.includes('months ago') ||
    text.includes('monat') ||
    text.includes('monaten') ||
    text.includes('maand') ||
    text.includes('maanden') ||
    text.includes('meses')
  ) {
    const match = text.match(/(\d+)/);
    const months = match ? parseInt(match[1], 10) : 1;
    now.setMonth(now.getMonth() - months);
    return now;
  }

  // Years
  if (
    text.includes('tahun lalu') ||
    text.includes('tahun yang lalu') ||
    text.includes('setahun') ||
    text.includes('year ago') ||
    text.includes('years ago') ||
    text.includes('jahr') ||
    text.includes('jahren') ||
    text.includes('jaar') ||
    text.includes('años')
  ) {
    const match = text.match(/(\d+)/);
    const years = match ? parseInt(match[1], 10) : 1;
    now.setFullYear(now.getFullYear() - years);
    return now;
  }

  // Yesterday
  if (
    text.includes('kemarin') ||
    text.includes('yesterday') ||
    text.includes('gestern') ||
    text.includes('gisteren')
  ) {
    now.setDate(now.getDate() - 1);
    return now;
  }

  // Hours / Minutes
  if (
    text.includes('jam lalu') ||
    text.includes('jam yang lalu') ||
    text.includes('sejam') ||
    text.includes('hour ago') ||
    text.includes('hours ago') ||
    text.includes('stunde') ||
    text.includes('stunden') ||
    text.includes('uur geleden') ||
    text.includes('menit lalu') ||
    text.includes('menit yang lalu') ||
    text.includes('semenit') ||
    text.includes('minute ago') ||
    text.includes('minutes ago') ||
    text.includes('minute') ||
    text.includes('minuten') ||
    text.includes('baru saja') ||
    text.includes('just now')
  ) {
    return now;
  }

  return null;
}

/**
 * Strip Google Maps private-use Unicode icons and normalize whitespace
 */
function cleanMapsText(raw?: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/[\uE000-\uF8FF]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Normalize review sort option across Apify ('mostRelevant', 'highestRanking', 'lowestRanking', 'newest')
 * and legacy ('relevant', 'highest', 'lowest', 'newest')
 */
function normalizeSortOption(options: ScrapeOptions): 'newest' | 'relevant' | 'highest' | 'lowest' {
  const raw = options.reviewsSort || options.sortBy || 'newest';
  switch (raw) {
    case 'mostRelevant':
    case 'relevant':
      return 'relevant';
    case 'highestRanking':
    case 'highest':
      return 'highest';
    case 'lowestRanking':
    case 'lowest':
      return 'lowest';
    case 'newest':
    default:
      return 'newest';
  }
}

/**
 * Parse address components (street, neighborhood, city, state, postalCode, countryCode)
 */
function parseAddressComponents(address: string | null): {
  street: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  countryCode: string | null;
} {
  if (!address) {
    return {
      street: null,
      neighborhood: null,
      city: null,
      state: null,
      postalCode: null,
      countryCode: null,
    };
  }

  let postalCode: string | null = null;
  const postalMatch = address.match(/\b(\d{5})\b/);
  if (postalMatch) {
    postalCode = postalMatch[1];
  }

  const segments = address
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const street = segments.length > 0 ? segments[0] : null;
  let neighborhood: string | null = null;
  let city: string | null = null;
  let state: string | null = null;
  let countryCode: string | null = 'ID';

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (/^(?:Kec\.|Kecamatan)\s+/i.test(seg)) {
      const kec = seg.replace(/^(?:Kec\.|Kecamatan)\s+/i, '').trim();
      if (i > 1 && !/^(?:Jl\.|Jalan|Gg\.|Gang|No\.)/i.test(segments[i - 1])) {
        neighborhood = `${segments[i - 1]}, ${seg}`;
      } else {
        neighborhood = kec;
      }
      if (segments[i + 1]) {
        city = segments[i + 1].replace(/\b\d{5}\b/, '').trim();
      }
      if (segments[i + 2]) {
        state = segments[i + 2].replace(/\b\d{5}\b/, '').trim();
      }
      break;
    }
  }

  if (!city && segments.length >= 3) {
    city = segments[segments.length - 2].replace(/\b\d{5}\b/, '').trim() || null;
  }
  if (!state && segments.length >= 2) {
    const lastSeg = segments[segments.length - 1].replace(/\b\d{5}\b/, '').trim();
    if (lastSeg && !/^(Indonesia| Belanda|Netherlands|USA|United States|Singapore|Malaysia)$/i.test(lastSeg)) {
      state = lastSeg;
    } else if (segments.length >= 3) {
      state = segments[segments.length - 2].replace(/\b\d{5}\b/, '').trim() || null;
    }
  }

  if (/Indonesia/i.test(address) || /\b(?:Kec\.|Kota|Kabupaten|Bali|Jawa|Jakarta|Sumatera|Kalimantan|Sulawesi|Nusa Tenggara|Banten|Yogyakarta)\b/i.test(address)) {
    countryCode = 'ID';
  }

  return {
    street,
    neighborhood,
    city,
    state,
    postalCode,
    countryCode,
  };
}

/**
 * Format phone number to unformatted E.164-like string (Apify phoneUnformatted)
 */
function formatPhoneUnformatted(phone: string | null, countryCode: string | null = 'ID'): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, '');
  if (!digits) return null;
  if (digits.startsWith('+')) return digits;
  if (countryCode === 'ID' && digits.startsWith('0')) {
    return `+62${digits.slice(1)}`;
  }
  return digits;
}

/**
 * Parse a single review entry from Google Maps internal `qv9Egd` batchexecute / `listentitiesreviews` RPC array
 */
export function parseRpcReviewEntry(
  rawEntry: any,
  cidHex: string | null,
  hl: string = 'id'
): GBPReview | null {
  try {
    const r = Array.isArray(rawEntry?.[0]) && typeof rawEntry?.[0]?.[0] === 'string' ? rawEntry[0] : rawEntry;
    if (!Array.isArray(r) || typeof r[0] !== 'string') {
      return null;
    }

    const reviewId: string = r[0];

    // Timestamps (in microseconds)
    const publishedUsec = typeof r[1]?.[2] === 'number' ? r[1][2] : null;
    const relativeTime: string | null = typeof r[1]?.[6] === 'string' ? r[1][6] : null;
    let publishedAtDate: string | null = null;
    if (publishedUsec && publishedUsec > 1000000000000) {
      publishedAtDate = new Date(Math.floor(publishedUsec / 1000)).toISOString();
    } else if (relativeTime) {
      const est = parseRelativeDate(relativeTime);
      if (est) publishedAtDate = est.toISOString();
    }

    // Reviewer details
    const authorArr = r[1]?.[4];
    const reviewerName: string =
      authorArr?.[5]?.[0] ||
      authorArr?.[0]?.[4] ||
      'Google user';
    const reviewerPhotoUrl: string | null =
      authorArr?.[5]?.[1] ||
      authorArr?.[0]?.[3] ||
      null;
    const reviewerUrl: string | null =
      authorArr?.[5]?.[2]?.[0] ||
      authorArr?.[0]?.[0] ||
      null;
    const reviewerId: string | null =
      authorArr?.[5]?.[3] ||
      (reviewerUrl ? (reviewerUrl.match(/contrib\/(\d+)/)?.[1] ?? null) : null);
    const reviewerNumberOfReviews: number | null =
      typeof authorArr?.[5]?.[5] === 'number' ? authorArr[5][5] : null;
    const isLocalGuide: boolean = Boolean(
      authorArr?.[5]?.[8]?.[0] === true ||
      (typeof authorArr?.[5]?.[10]?.[0] === 'string' && authorArr[5][10][0].toLowerCase().includes('local guide'))
    );

    const reviewOrigin: string =
      typeof r[1]?.[14]?.[0] === 'string' ? r[1][14][0] : 'Google';

    // Rating / Stars
    const stars: number =
      typeof r[2]?.[0]?.[0] === 'number' ? r[2][0][0] : 5;

    // Text & Translation
    const originalLanguage: string | null =
      typeof r[2]?.[14]?.[0] === 'string' ? r[2][14][0] : null;
    const translatedLanguage: string | null =
      typeof r[2]?.[14]?.[1] === 'string' ? r[2][14][1] : null;
    const text: string | null =
      typeof r[2]?.[15]?.[0]?.[0] === 'string' ? r[2][15][0][0] : null;
    const textTranslated: string | null =
      typeof r[2]?.[15]?.[1]?.[0] === 'string' ? r[2][15][1][0] : null;

    // Review Images
    const reviewImageUrls: string[] = [];
    if (Array.isArray(r[2]?.[2])) {
      for (const mediaItem of r[2][2]) {
        const imgUrl =
          mediaItem?.[0]?.[1]?.[6]?.[0] ||
          mediaItem?.[1]?.[6]?.[0] ||
          null;
        if (typeof imgUrl === 'string' && imgUrl.startsWith('http')) {
          reviewImageUrls.push(imgUrl);
        }
      }
    }

    // Detailed rating & context (if present in r[2][6])
    const reviewContext: Record<string, string> = {};
    const reviewDetailedRating: Record<string, number> = {};
    let visitedIn: string | null = null;
    if (Array.isArray(r[2]?.[6])) {
      for (const ctxItem of r[2][6]) {
        const label = ctxItem?.[0]?.[1] || ctxItem?.[1];
        const val = ctxItem?.[2]?.[0]?.[0]?.[1] || ctxItem?.[11]?.[0];
        const ratingNum = ctxItem?.[11]?.[0];
        if (typeof label === 'string' && typeof ratingNum === 'number') {
          reviewDetailedRating[label] = ratingNum;
        } else if (typeof label === 'string' && typeof val === 'string') {
          reviewContext[label] = val;
        }
      }
    }

    // Owner Response (can be in r[3] or r[9])
    let responseFromOwnerText: string | null = null;
    let responseFromOwnerDate: string | null = null;
    const ownerCandidate = Array.isArray(r[3]) && (r[3][14]?.[0]?.[0] || typeof r[3][1] === 'string')
      ? r[3]
      : Array.isArray(r[9]) && (r[9][14]?.[0]?.[0] || typeof r[9][1] === 'string')
        ? r[9]
        : null;

    if (ownerCandidate) {
      responseFromOwnerText =
        ownerCandidate?.[14]?.[0]?.[0] ||
        (typeof ownerCandidate?.[1] === 'string' ? ownerCandidate[1] : null);
      const ownerUsec =
        typeof ownerCandidate?.[2] === 'number'
          ? ownerCandidate[2]
          : typeof ownerCandidate?.[3] === 'number'
            ? ownerCandidate[3]
            : null;
      const ownerRel = typeof ownerCandidate?.[4] === 'string' ? ownerCandidate[4] : null;
      if (ownerUsec && ownerUsec > 1000000000000) {
        responseFromOwnerDate = new Date(Math.floor(ownerUsec / 1000)).toISOString();
      } else if (ownerRel) {
        const estOwner = parseRelativeDate(ownerRel);
        responseFromOwnerDate = estOwner ? estOwner.toISOString() : ownerRel;
      }
    }

    // Likes & Review Share URL
    const likesCount: number = typeof r[4]?.[1] === 'number' ? r[4][1] : 0;
    let reviewUrl: string | null =
      typeof r[4]?.[3]?.[0] === 'string' ? r[4][3][0] : null;

    if (!reviewUrl && reviewId) {
      const cidPart = cidHex ? `!2m1!1s0x0:${cidHex}` : '';
      reviewUrl = `https://www.google.com/maps/reviews/data=!4m8!14m7!1m6!2m5!1s${reviewId}${cidPart}!3m1!1s2@1:${reviewId}%7C%7C?hl=${hl}`;
    }

    const ownerResponse = responseFromOwnerText
      ? {
          text: responseFromOwnerText,
          date: responseFromOwnerDate,
        }
      : null;

    return {
      reviewId,
      reviewUrl,
      author: reviewerName,
      authorProfileUrl: reviewerUrl,
      rating: stars,
      relativeTime,
      publishedAtDate,
      text,
      likes: likesCount,
      ownerResponse,
      name: reviewerName,
      reviewerId,
      reviewerUrl,
      reviewerPhotoUrl,
      reviewerNumberOfReviews,
      isLocalGuide,
      stars,
      publishAt: relativeTime,
      likesCount,
      textTranslated,
      responseFromOwnerDate,
      responseFromOwnerText,
      reviewImageUrls,
      reviewContext,
      reviewDetailedRating,
      visitedIn,
      originalLanguage,
      translatedLanguage,
      reviewOrigin,
    };
  } catch {
    return null;
  }
}

/**
 * Apply privacy / personal data configuration to a review item
 */
function applyReviewPrivacy(review: GBPReview, options: ScrapeOptions): GBPReview {
  const includePersonal =
    options.scrapeReviewsPersonalData !== undefined
      ? options.scrapeReviewsPersonalData
      : options.personalData !== undefined
        ? options.personalData
        : true;

  const showName = options.scrapeReviewerName ?? includePersonal;
  const showId = options.scrapeReviewerId ?? includePersonal;
  const showUrl = options.scrapeReviewerUrl ?? includePersonal;
  const showReviewId = options.scrapeReviewId ?? true;
  const showReviewUrl = options.scrapeReviewUrl ?? true;
  const showOwnerResponse = options.scrapeResponseFromOwnerText ?? true;

  return {
    ...review,
    reviewId: showReviewId ? review.reviewId : null,
    reviewUrl: showReviewUrl ? review.reviewUrl : null,
    author: showName ? review.author : 'Google user',
    name: showName ? review.name : null,
    authorProfileUrl: showUrl ? review.authorProfileUrl : null,
    reviewerUrl: showUrl ? review.reviewerUrl : null,
    reviewerId: showId ? review.reviewerId : null,
    reviewerPhotoUrl: showName ? review.reviewerPhotoUrl : null,
    ownerResponse: showOwnerResponse ? review.ownerResponse : null,
    responseFromOwnerText: showOwnerResponse ? review.responseFromOwnerText : null,
    responseFromOwnerDate: showOwnerResponse ? review.responseFromOwnerDate : null,
  };
}

export class GBPScraper {
  /**
   * Resolve all targets from url, placeId, placeIds, startUrls, query, or searchStringsArray
   */
  public static resolveTargets(options: ScrapeOptions): string[] {
    const targets: string[] = [];
    const lang = options.language || options.hl || 'id';

    const isDummy = (val?: string | null): boolean => {
      if (!val || typeof val !== 'string') return true;
      const s = val.trim().toLowerCase();
      return ['string', 'linkhere', 'placeidhere', 'url', 'query'].includes(s) || s === '';
    };

    const isValidHttpUrl = (str: string): boolean => {
      try {
        const parsed = new URL(str);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    };

    const cleanGoogleUrl = (rawUrl: string): string => {
      if (rawUrl.includes('consent.google.com')) {
        try {
          const parsed = new URL(rawUrl);
          const cont = parsed.searchParams.get('continue');
          if (cont && isValidHttpUrl(cont)) {
            return cont;
          }
        } catch {
          // ignore
        }
      }
      return rawUrl;
    };

    // 1. Single direct URL (highest priority for single place)
    if (options.url && !isDummy(options.url)) {
      const trimmed = cleanGoogleUrl(options.url.trim());
      if (isValidHttpUrl(trimmed)) {
        return [trimmed];
      } else {
        return [`https://www.google.com/maps/search/${encodeURIComponent(trimmed)}?hl=${lang}`];
      }
    }

    // 2. Single placeId
    if (options.placeId && !isDummy(options.placeId)) {
      return [`https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(options.placeId.trim())}`];
    }

    // 3. Array of startUrls (supports both { url: string } and raw string)
    if (options.startUrls && Array.isArray(options.startUrls)) {
      for (const item of options.startUrls) {
        const rawUrl = typeof item === 'string' ? item : item?.url;
        if (rawUrl && !isDummy(rawUrl)) {
          const trimmed = cleanGoogleUrl(rawUrl.trim());
          if (isValidHttpUrl(trimmed)) {
            targets.push(trimmed);
          } else {
            targets.push(`https://www.google.com/maps/search/${encodeURIComponent(trimmed)}?hl=${lang}`);
          }
        }
      }
      if (targets.length > 0) {
        return targets;
      }
    }

    // 4. Array of placeIds
    if (options.placeIds && Array.isArray(options.placeIds)) {
      for (const id of options.placeIds) {
        if (id && !isDummy(id)) {
          targets.push(`https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(id.trim())}`);
        }
      }
      if (targets.length > 0) {
        return targets;
      }
    }

    // 5. Apify searchStringsArray (+ optional locationQuery)
    if (options.searchStringsArray && Array.isArray(options.searchStringsArray)) {
      const locSuffix = options.locationQuery && !isDummy(options.locationQuery)
        ? ` ${options.locationQuery.trim()}`
        : '';
      for (const searchStr of options.searchStringsArray) {
        if (searchStr && !isDummy(searchStr)) {
          const trimmed = searchStr.trim();
          if (isValidHttpUrl(trimmed)) {
            targets.push(cleanGoogleUrl(trimmed));
          } else {
            targets.push(`https://www.google.com/maps/search/${encodeURIComponent(trimmed + locSuffix)}?hl=${lang}`);
          }
        }
      }
      if (targets.length > 0) {
        return targets;
      }
    }

    // 6. Query string search
    if (options.query && !isDummy(options.query)) {
      const locSuffix = options.locationQuery && !isDummy(options.locationQuery)
        ? ` ${options.locationQuery.trim()}`
        : '';
      return [`https://www.google.com/maps/search/${encodeURIComponent(options.query.trim() + locSuffix)}?hl=${lang}`];
    }

    return targets;
  }

  /**
   * Pre-configures page viewport and bypasses Google consent dialogs via SOCS/CONSENT/PREF cookies and language headers
   */
  public static async preparePageForGoogle(page: Page, gotoOptions?: any, options?: ScrapeOptions): Promise<void> {
    const hl = (options?.language || options?.hl || 'id').toLowerCase();
    await page.setViewportSize({ width: 1440, height: 900 }).catch(() => {});
    if (gotoOptions) {
      gotoOptions.waitUntil = 'domcontentloaded';
      gotoOptions.timeout = 35000;
    }

    // Attach early RPC listener before initial page.goto() so reviews loaded during initial navigation
    // (e.g. when a shortlink redirects directly to the Reviews tab via !9m1!1b1) are always captured.
    if (!(page as any).__gbpRpcHooked) {
      const rpcState: {
        rawPayloads: string[];
        lastQv9RequestTemplate: { url: string; headers: Record<string, string>; postData: string } | null;
      } = {
        rawPayloads: [],
        lastQv9RequestTemplate: null,
      };
      (page as any).__gbpRpcHooked = true;
      (page as any).__gbpRpcState = rpcState;

      page.on('request', (req: PlaywrightRequest) => {
        const reqUrl = req.url();
        if (reqUrl.includes('batchexecute') && reqUrl.includes('qv9Egd')) {
          const postData = req.postData();
          if (postData) {
            rpcState.lastQv9RequestTemplate = {
              url: reqUrl,
              headers: req.headers(),
              postData,
            };
          }
        }
      });

      page.on('response', async (res: Response) => {
        const resUrl = res.url();
        if (
          (resUrl.includes('batchexecute') && resUrl.includes('qv9Egd')) ||
          resUrl.includes('listentitiesreviews')
        ) {
          try {
            const text = await res.text();
            if (text) {
              rpcState.rawPayloads.push(text);
            }
          } catch {
            // Ignore body read error on closed page
          }
        }
      });
    }

    try {
      await page.context().setExtraHTTPHeaders({
        'Accept-Language': `${hl}-${hl.toUpperCase()},${hl};q=0.9,en-US;q=0.8,en;q=0.7`,
      }).catch(() => {});

      // Inject authenticated Google session cookies if available
      const injectedCount = await cookieManager.injectCookies(page.context());
      if (injectedCount > 0) {
        log.info(`[GBPScraper] Injected ${injectedCount} authenticated Google session cookies into context`);
      }

      const domains = [
        '.google.com',
        '.google.co.id',
        '.google.nl',
        '.google.de',
        '.google.fr',
        '.google.co.uk',
        '.google.es',
        '.google.it',
        '.google.pl',
        '.google.com.au',
      ];

      // Always inject PREF to set preferred language
      const prefCookies = domains.map((domain) => ({
        name: 'PREF',
        value: `hl=${hl}&gl=${hl.toUpperCase()}`,
        domain,
        path: '/',
        expires: Math.floor(Date.now() / 1000) + 31536000,
      }));
      await page.context().addCookies(prefCookies).catch(() => {});

      // If no authenticated cookies were loaded, inject fallback consent cookies
      if (injectedCount === 0) {
        const fallbackCookies = domains.flatMap((domain) => [
          {
            name: 'SOCS',
            value: 'CAESHAgBEhJnd3NfMjAyNDA3MjMtMF9SQzIaAmVuIAEaBgiA_LyuBg',
            domain,
            path: '/',
            expires: Math.floor(Date.now() / 1000) + 31536000,
          },
          {
            name: 'CONSENT',
            value: 'PENDING+999',
            domain,
            path: '/',
            expires: Math.floor(Date.now() / 1000) + 31536000,
          },
        ]);
        await page.context().addCookies(fallbackCookies).catch(() => {});
      }
    } catch {
      // Ignore cookie injection errors
    }
  }

  /**
   * Handle Google cookie consent popup or redirect if present
   */
  private static async handleConsent(page: Page): Promise<void> {
    try {
      if (page.url().includes('consent.google.com')) {
        log.info(`[Consent] Page is on consent.google.com (${page.url()}). Dismissing consent...`);
        for (const selector of SELECTORS.consentButtons) {
          const button = page.locator(selector).first();
          if (await button.isVisible({ timeout: 1500 }).catch(() => false)) {
            await button.click().catch(() => {});
            await page.waitForTimeout(1000);
            break;
          }
        }

        await page.waitForURL((url) => !url.href.includes('consent.google.com'), { timeout: 10000 }).catch(() => {});

        if (page.url().includes('consent.google.com')) {
          try {
            const continueUrl = new URL(page.url()).searchParams.get('continue');
            if (continueUrl) {
              log.info(`[Consent] Bypassing consent redirect by directly navigating to continue target: ${continueUrl}`);
              await page.goto(continueUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
            }
          } catch {
            // Ignore URL parsing errors
          }
        }
      }

      for (const selector of SELECTORS.consentButtons) {
        const button = page.locator(selector).first();
        if (await button.isVisible({ timeout: 1500 }).catch(() => false)) {
          await button.click().catch(() => {});
          await page.waitForTimeout(1000);
          break;
        }
      }

      for (const frame of page.frames()) {
        if (frame.url().includes('consent.google.com')) {
          for (const selector of SELECTORS.consentButtons) {
            const btn = frame.locator(selector).first();
            if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
              await btn.click().catch(() => {});
              await page.waitForTimeout(1000);
              break;
            }
          }
        }
      }
    } catch {
      // Ignore consent dismissal errors
    }
  }

  /**
   * Navigate to Google Maps and locate the target business
   */
  private static async navigateToBusiness(
    page: Page,
    targetUrl: string,
    options: ScrapeOptions
  ): Promise<string> {
    const hl = (options.language || options.hl || 'id').toLowerCase();

    if (targetUrl.includes('maps.app.goo.gl') || targetUrl.includes('goo.gl')) {
      try {
        const headRes = await fetch(targetUrl, { method: 'HEAD', redirect: 'manual' });
        const location = headRes.headers.get('location');
        if (location && location.startsWith('http')) {
          log.info(`Resolved shortlink ${targetUrl} -> ${location}`);
          targetUrl = location;
        }
      } catch {
        // Proceed with original targetUrl if fetch fails
      }
    }

    if (targetUrl.includes('entry=tts')) {
      targetUrl = targetUrl.replace(/([?&])entry=tts(&|$)/, '$1entry=ttu$2');
    }

    const currentUrl = page.url();
    const isAlreadyOnPlace =
      !currentUrl.includes('consent.google.com') &&
      (await page.locator(SELECTORS.title).first().isVisible({ timeout: 1000 }).catch(() => false));
    if (isAlreadyOnPlace && (currentUrl.includes('/maps/place') || currentUrl.includes('place_id'))) {
      return currentUrl;
    }

    let urlToLoad = targetUrl;
    if (
      !urlToLoad.includes('hl=') &&
      !urlToLoad.includes('maps.app.goo.gl') &&
      !urlToLoad.includes('goo.gl')
    ) {
      urlToLoad += (urlToLoad.includes('?') ? '&' : '?') + `hl=${hl}`;
    }

    log.info(`Navigating to: ${urlToLoad}`);
    await page.goto(urlToLoad, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await this.handleConsent(page);

    if (page.url().includes('consent.google.com')) {
      const continueTarget = new URL(page.url()).searchParams.get('continue');
      if (continueTarget) {
        log.info(`[Consent] Navigating directly to continue target: ${continueTarget}`);
        await page.goto(continueTarget, { waitUntil: 'domcontentloaded', timeout: 35000 });
        await this.handleConsent(page);
      }
    }

    let afterNavUrl = page.url();
    if (afterNavUrl.includes('entry=tts')) {
      const fullDesktopUrl = afterNavUrl.replace(/([?&])entry=tts(&|$)/, '$1entry=ttu$2');
      log.info(`[Limited View Detected] Switching from limited tts mode to desktop ttu: ${fullDesktopUrl}`);
      await page.goto(fullDesktopUrl, { waitUntil: 'domcontentloaded', timeout: 35000 }).catch(() => {});
      await this.handleConsent(page);
      afterNavUrl = page.url();
    }

    if (!afterNavUrl.includes('consent.google.com') && !afterNavUrl.includes(`hl=${hl}`)) {
      const enforcedUrl = afterNavUrl + (afterNavUrl.includes('?') ? '&' : '?') + `hl=${hl}`;
      log.info(`Enforcing requested language '${hl}' on: ${enforcedUrl}`);
      await page.goto(enforcedUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
      await this.handleConsent(page);
    }

    const firstResult = page.locator('a.hfpxzc').first();
    const isList = await firstResult.isVisible({ timeout: 4000 }).catch(() => false);

    if (isList) {
      log.info('Multiple results found. Selecting the first business result...');
      await firstResult.click();
      await page.waitForTimeout(2000);
      await this.handleConsent(page);
    }

    if (page.url().includes('consent.google.com')) {
      throw new Error(`Failed to bypass Google consent page: ${page.url()}`);
    }

    await page.waitForSelector(SELECTORS.title, { timeout: 30000 });
    // Wait briefly for URL to update with full place coordinates/fid if Google Maps pushes state
    await page.waitForTimeout(800);
    return page.url();
  }

  /**
   * Extract coordinates from Google Maps URL (prefers exact pin !3d...!4d... over viewport @lat,lng)
   */
  public static extractCoordinates(url: string): { latitude: number | null; longitude: number | null } {
    const pinMatch = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    if (pinMatch) {
      return {
        latitude: parseFloat(pinMatch[1]),
        longitude: parseFloat(pinMatch[2]),
      };
    }
    const viewMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (viewMatch) {
      return {
        latitude: parseFloat(viewMatch[1]),
        longitude: parseFloat(viewMatch[2]),
      };
    }
    return { latitude: null, longitude: null };
  }

  /**
   * Extract FID, CID (decimal string), and Place ID from URL and page state
   */
  private static async extractIdentifiers(
    page: Page,
    finalUrl: string,
    options: ScrapeOptions
  ): Promise<{ fid: string | null; cid: string | null; placeId: string | null; cidHex: string | null }> {
    let fid: string | null = null;
    let cid: string | null = null;
    let cidHex: string | null = null;
    let placeId: string | null = options.placeId || null;

    const fidMatch = finalUrl.match(/(0x[0-9a-fA-F]+):(0x[0-9a-fA-F]+)/);
    if (fidMatch) {
      fid = `${fidMatch[1]}:${fidMatch[2]}`;
      cidHex = fidMatch[2];
      try {
        cid = BigInt(cidHex).toString(10);
      } catch {
        cid = null;
      }
    }

    const urlPlaceIdMatch = finalUrl.match(/!19s(ChIJ[^!&?]+)/) || finalUrl.match(/place_id[:=]([^&?]+)/);
    if (urlPlaceIdMatch && !placeId) {
      placeId = decodeURIComponent(urlPlaceIdMatch[1]);
    }

    if (!placeId || !fid) {
      const pageIds = await page.evaluate(() => {
        const html = document.documentElement.innerHTML;
        const chijMatch = html.match(/"(ChIJ[a-zA-Z0-9_-]{15,40})"/);
        const hexMatch = html.match(/(0x[0-9a-fA-F]{10,16}:0x[0-9a-fA-F]{10,16})/);
        return {
          placeId: chijMatch ? chijMatch[1] : null,
          fid: hexMatch ? hexMatch[1] : null,
        };
      }).catch(() => ({ placeId: null, fid: null }));

      if (!placeId && pageIds.placeId) {
        placeId = pageIds.placeId;
      }
      if (!fid && pageIds.fid) {
        fid = pageIds.fid;
        const parts = fid.split(':');
        if (parts[1]) {
          cidHex = parts[1];
          try {
            cid = BigInt(cidHex).toString(10);
          } catch {
            // ignore
          }
        }
      }
    }

    return { fid, cid, placeId, cidHex };
  }

  /**
   * Scrape Google Business Profile details for one target (Full Apify + Pantau schema)
   */
  private static async scrapeSingleProfile(
    page: Page,
    targetUrl: string,
    options: ScrapeOptions
  ): Promise<GBPProfile> {
    const finalUrl = await GBPScraper.navigateToBusiness(page, targetUrl, options);

    // Ensure we are on Overview tab if currently on another tab
    const overviewTab = page.locator(SELECTORS.overviewTab).first();
    if (await overviewTab.isVisible({ timeout: 1000 }).catch(() => false)) {
      const isSelected = await overviewTab.getAttribute('aria-selected').catch(() => 'true');
      if (isSelected === 'false') {
        await overviewTab.click().catch(() => {});
        await page.waitForTimeout(800);
      }
    }

    // 1. Title / Name & Subtitle
    const nameEl = page.locator(SELECTORS.title).first();
    const name = cleanMapsText(await nameEl.textContent().catch(() => '')) || '';

    let subTitle: string | null = null;
    const subTitleEl = page.locator(SELECTORS.subTitle).first();
    if (await subTitleEl.isVisible({ timeout: 500 }).catch(() => false)) {
      subTitle = cleanMapsText(await subTitleEl.textContent().catch(() => null));
    }

    // 2. Rating / totalScore
    let rating: number | null = null;
    const ratingEl = page.locator(SELECTORS.rating).first();
    if (await ratingEl.isVisible().catch(() => false)) {
      const rawRating = (await ratingEl.textContent())?.replace(',', '.').trim();
      if (rawRating) {
        const parsed = parseFloat(rawRating);
        if (!isNaN(parsed)) rating = parsed;
      }
    }

    // 3. Review Count / reviewsCount
    let reviewCount: number | null = null;
    const countEl = page.locator(SELECTORS.reviewCount).first();
    if (await countEl.isVisible().catch(() => false)) {
      const rawText = (await countEl.textContent()) || '';
      const ariaLabel = (await countEl.getAttribute('aria-label')) || '';
      const textToParse = ariaLabel || rawText;
      if (textToParse) {
        const digits = textToParse.replace(/\D/g, '');
        if (digits) reviewCount = parseInt(digits, 10);
      }
    }

    if (reviewCount === null) {
      const f7nice = page.locator('div.F7nice').first();
      if (await f7nice.isVisible().catch(() => false)) {
        const f7Text = (await f7nice.textContent()) || '';
        const match = f7Text.match(/\(([\d.,]+)\)/);
        if (match) {
          const parsed = parseInt(match[1].replace(/\D/g, ''), 10);
          if (!isNaN(parsed)) reviewCount = parsed;
        }
      }
    }

    if (reviewCount === null) {
      const tabEl = page
        .locator('button[role="tab"][aria-label*="ulasan" i], button[role="tab"][aria-label*="review" i]')
        .first();
      if (await tabEl.isVisible().catch(() => false)) {
        const tabLabel = (await tabEl.getAttribute('aria-label')) || (await tabEl.textContent()) || '';
        const match = tabLabel.match(/(\d+[\d.,]*)\s*(?:ulasan|review)/i);
        if (match) {
          const parsed = parseInt(match[1].replace(/\D/g, ''), 10);
          if (!isNaN(parsed)) reviewCount = parsed;
        }
      }
    }

    // 4. Categories & Category
    const categories: string[] = [];
    const categoryEls = page.locator(SELECTORS.category);
    const catCount = await categoryEls.count().catch(() => 0);
    for (let i = 0; i < catCount; i++) {
      const text = cleanMapsText(await categoryEls.nth(i).textContent().catch(() => null));
      if (text && !categories.includes(text)) {
        categories.push(text);
      }
    }
    const category = categories.length > 0 ? categories[0] : null;

    // 5. Address & Plus Code
    let address: string | null = null;
    const addressEl = page.locator(SELECTORS.address).first();
    if (await addressEl.isVisible().catch(() => false)) {
      address = cleanMapsText(await addressEl.textContent().catch(() => null));
    }

    let plusCode: string | null = null;
    const plusCodeEl = page.locator(SELECTORS.plusCode).first();
    if (await plusCodeEl.isVisible({ timeout: 500 }).catch(() => false)) {
      plusCode = cleanMapsText(await plusCodeEl.textContent().catch(() => null));
    }

    const addressParts = parseAddressComponents(address);

    // 6. Phone & phoneUnformatted
    let phone: string | null = null;
    const phoneEl = page.locator(SELECTORS.phone).first();
    if (await phoneEl.isVisible().catch(() => false)) {
      phone = cleanMapsText(await phoneEl.textContent().catch(() => null));
    }
    const phoneUnformatted = formatPhoneUnformatted(phone, addressParts.countryCode);

    // 7. Website
    let website: string | null = null;
    const websiteEl = page.locator(SELECTORS.website).first();
    if (await websiteEl.isVisible().catch(() => false)) {
      website = (await websiteEl.getAttribute('href')) || null;
    }

    // 8. Permanently / Temporarily Closed Status
    const closedStatus = await page.evaluate(() => {
      const bodyText = document.body.innerText || '';
      const perm = /Tutup permanen|Permanently closed/i.test(bodyText);
      const temp = /Tutup sementara|Temporarily closed/i.test(bodyText);
      return { permanentlyClosed: perm, temporarilyClosed: temp };
    }).catch(() => ({ permanentlyClosed: false, temporarilyClosed: false }));

    // 9. Opening Hours (both string[] for Pantau and OpeningHoursItem[] for Apify)
    const openingHours: string[] = [];
    const openingHoursDetailed: OpeningHoursItem[] = [];

    const hoursDropdown = page.locator(SELECTORS.openingHoursDropdown).first();
    if (await hoursDropdown.isVisible({ timeout: 1500 }).catch(() => false)) {
      await hoursDropdown.click().catch(() => {});
      await page.waitForTimeout(600);
    }

    const hoursRows = page.locator(SELECTORS.openingHoursTable);
    const count = await hoursRows.count();
    for (let i = 0; i < count; i++) {
      const row = hoursRows.nth(i);
      const cells = row.locator('td');
      const cellCount = await cells.count();
      if (cellCount >= 2) {
        const day = cleanMapsText(await cells.nth(0).textContent());
        const time = cleanMapsText(await cells.nth(1).textContent());
        if (day && time) {
          openingHours.push(`${day}: ${time}`);
          openingHoursDetailed.push({ day, hours: time });
          continue;
        }
      }
      const rowText = cleanMapsText(await row.textContent());
      if (rowText) {
        openingHours.push(rowText);
        const colonIdx = rowText.indexOf(':');
        if (colonIdx > 0) {
          openingHoursDetailed.push({
            day: rowText.slice(0, colonIdx).trim(),
            hours: rowText.slice(colonIdx + 1).trim(),
          });
        }
      }
    }

    if (openingHours.length === 0) {
      const copyBtn = page
        .locator('button.mWUh3d, button[aria-label*="Salin jam buka"], button[data-value*=","]')
        .first();
      if (await copyBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        const val = await copyBtn.getAttribute('data-value');
        if (val) {
          const formatted = val.replace(',', ': ');
          openingHours.push(formatted);
          const parts = val.split(',');
          if (parts.length >= 2) {
            openingHoursDetailed.push({ day: parts[0].trim(), hours: parts.slice(1).join(',').trim() });
          }
        }
      }
    }

    // 10. Hero Image & Images Count
    let imageUrl: string | null = null;
    const imageUrls: string[] = [];
    const heroImgEl = page.locator(SELECTORS.heroImage).first();
    if (await heroImgEl.isVisible({ timeout: 800 }).catch(() => false)) {
      imageUrl = (await heroImgEl.getAttribute('src').catch(() => null)) || null;
      if (imageUrl && imageUrl.startsWith('http')) {
        imageUrls.push(imageUrl);
      }
    }

    let imagesCount: number | null = null;
    const imgCountBtn = page.locator(SELECTORS.imagesCountButton).first();
    if (await imgCountBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      const label =
        (await imgCountBtn.getAttribute('aria-label').catch(() => '')) ||
        (await imgCountBtn.textContent().catch(() => '')) ||
        '';
      const match = label.match(/(\d+[\d.,]*)\s*(?:foto|photo)/i) || label.match(/(\d+[\d.,]*)/);
      if (match) {
        const parsed = parseInt(match[1].replace(/\D/g, ''), 10);
        if (!isNaN(parsed)) imagesCount = parsed;
      }
    }

    // 11. Reviews Distribution & Reviews Tags (visible on Overview or Reviews summary)
    const reviewsDistribution = await GBPScraper.extractReviewsDistribution(page);
    const reviewsTags = await GBPScraper.extractReviewsTags(page);

    // 12. Coordinates & Identifiers (FID, CID, Place ID)
    const { latitude, longitude } = GBPScraper.extractCoordinates(finalUrl);
    const { fid, cid, placeId } = await GBPScraper.extractIdentifiers(page, finalUrl, options);

    if (
      reviewCount === null &&
      reviewsDistribution.oneStar +
        reviewsDistribution.twoStar +
        reviewsDistribution.threeStar +
        reviewsDistribution.fourStar +
        reviewsDistribution.fiveStar >
        0
    ) {
      reviewCount =
        reviewsDistribution.oneStar +
        reviewsDistribution.twoStar +
        reviewsDistribution.threeStar +
        reviewsDistribution.fourStar +
        reviewsDistribution.fiveStar;
    }

    return {
      // Legacy / Pantau fields
      name,
      rating,
      reviewCount,
      category,
      address,
      phone,
      website,
      openingHours,
      placeUrl: finalUrl,
      latitude,
      longitude,

      // Apify compass/crawler-google-places fields
      title: name,
      subTitle,
      totalScore: rating,
      reviewsCount: reviewCount,
      reviewsDistribution,
      categoryName: category,
      categories,
      neighborhood: addressParts.neighborhood,
      street: addressParts.street,
      city: addressParts.city,
      postalCode: addressParts.postalCode,
      state: addressParts.state,
      countryCode: addressParts.countryCode,
      plusCode,
      phoneUnformatted,
      cid,
      fid,
      placeId,
      location: {
        lat: latitude,
        lng: longitude,
      },
      permanentlyClosed: closedStatus.permanentlyClosed,
      temporarilyClosed: closedStatus.temporarilyClosed,
      openingHoursDetailed,
      imageUrl,
      imagesCount,
      imageUrls,
      reviewsTags,
      peopleAlsoSearch: [],
      additionalInfo: {},
      url: finalUrl,
      searchPageUrl: options.query || options.searchStringsArray ? targetUrl : null,
      searchString: options.query || options.searchStringsArray?.[0] || null,
      inputPlaceId: options.placeId || options.placeIds?.[0] || null,
      inputStartUrl: targetUrl,
      scrapedAt: new Date().toISOString(),
    };
  }

  /**
   * Extract 1-5 star review distribution from DOM star histogram rows
   */
  private static async extractReviewsDistribution(page: Page): Promise<ReviewsDistribution> {
    return page
      .evaluate(() => {
        const dist: ReviewsDistribution = {
          oneStar: 0,
          twoStar: 0,
          threeStar: 0,
          fourStar: 0,
          fiveStar: 0,
        };
        const rows = Array.from(
          document.querySelectorAll(
            'tr.BHOKXe[aria-label], table.ExlQHd tr[aria-label], tr[aria-label*="bintang" i], tr[aria-label*="star" i]'
          )
        );
        for (const row of rows) {
          const label = row.getAttribute('aria-label') || '';
          // Examples: "5 bintang, 130 ulasan" or "5 stars, 130 reviews"
          const match = label.match(/(\d)\s*(?:bintang|stars?)[^0-9]*([\d.,]+)/i);
          if (match) {
            const star = parseInt(match[1], 10);
            const count = parseInt(match[2].replace(/\D/g, ''), 10) || 0;
            if (star === 1) dist.oneStar = count;
            else if (star === 2) dist.twoStar = count;
            else if (star === 3) dist.threeStar = count;
            else if (star === 4) dist.fourStar = count;
            else if (star === 5) dist.fiveStar = count;
          }
        }
        return dist;
      })
      .catch(() => ({
        oneStar: 0,
        twoStar: 0,
        threeStar: 0,
        fourStar: 0,
        fiveStar: 0,
      }));
  }

  /**
   * Extract review topic tags and mention counts from Reviews section
   */
  private static async extractReviewsTags(page: Page): Promise<ReviewsTagItem[]> {
    return page
      .evaluate(() => {
        const tags: ReviewsTagItem[] = [];
        const buttons = Array.from(
          document.querySelectorAll('div[role="radiogroup"] button.e2moi, button.e2moi[aria-label]')
        );
        for (const btn of buttons) {
          const spans = Array.from(btn.querySelectorAll('span'));
          if (spans.length >= 2) {
            const title = spans[0].textContent?.trim() || '';
            const countRaw = spans[1].textContent?.replace(/\D/g, '') || '';
            const count = parseInt(countRaw, 10);
            if (title && !isNaN(count) && !/^(Semua|All)$/i.test(title)) {
              tags.push({ title, count });
              continue;
            }
          }
          const aria = btn.getAttribute('aria-label') || '';
          const match = aria.match(/^(.+?),\s*([\d.,]+)\s*(?:ulasan|reviews?|sebutan|mentions?)/i);
          if (match && !/^(Semua|All)$/i.test(match[1].trim())) {
            tags.push({
              title: match[1].trim(),
              count: parseInt(match[2].replace(/\D/g, ''), 10) || 0,
            });
          }
        }
        return tags;
      })
      .catch(() => []);
  }

  /**
   * Extract currently rendered DOM review cards as fallback/supplement to RPC interception
   */
  private static async extractDomReviews(
    page: Page,
    cidHex: string | null,
    latitude: number | null,
    longitude: number | null,
    hl: string
  ): Promise<GBPReview[]> {
    // Expand all visible "See more" / "Lainnya" buttons strictly inside review cards
    await page
      .evaluate(() => {
        const expandButtons = document.querySelectorAll(
          'div.jftiEf button.w8nwRe.kyuRq, div.jftiEf button[aria-label*="Lihat lainnya" i], div.jftiEf button[aria-label*="See more" i]'
        );
        expandButtons.forEach((b: any) => b.click());
      })
      .catch(() => {});

    const rawCardsData = await page
      .evaluate(() => {
        const cards = Array.from(document.querySelectorAll('div.jftiEf'));
        return cards.map((card) => {
          const nameEl = card.querySelector('div.d4r55');
          const rawAuthor = nameEl ? nameEl.textContent?.trim() || '' : '';
          const author = rawAuthor.split(/\n|·|Local Guide/)[0].trim() || 'Anonymous';

          const linkEl = card.querySelector('button.al6Kxe, a[data-href*="contrib"]');
          const authorProfileUrl = linkEl
            ? linkEl.getAttribute('href') || linkEl.getAttribute('data-href')
            : null;
          const reviewerId = authorProfileUrl
            ? authorProfileUrl.match(/contrib\/(\d+)/)?.[1] || null
            : null;

          const photoEl = card.querySelector('button.WEBjve img.NBa7we, img.NBa7we');
          const reviewerPhotoUrl = photoEl ? photoEl.getAttribute('src') : null;

          const subInfoEl = card.querySelector('div.RfnDt');
          const subInfoText = subInfoEl ? subInfoEl.textContent?.trim() || '' : '';
          const isLocalGuide = /Local Guide/i.test(subInfoText);
          const revCountMatch = subInfoText.match(/([\d.,]+)\s*(?:ulasan|reviews?)/i);
          const reviewerNumberOfReviews = revCountMatch
            ? parseInt(revCountMatch[1].replace(/\D/g, ''), 10)
            : null;

          const ratingEl = card.querySelector('span.kvMYJc');
          const ariaLabel = ratingEl ? ratingEl.getAttribute('aria-label') || '' : '';
          const match = ariaLabel.match(/(\d+([.,]\d+)?)/);
          const rating = match ? parseFloat(match[1].replace(',', '.')) : 5;

          const dateEl = card.querySelector('span.rsqaWe');
          const relativeTime = dateEl ? dateEl.textContent?.trim() || null : null;

          const textEl = card.querySelector('span.wiI7pd, span.wiI7m, div.MyEned span, div[lang] span');
          const text = textEl ? textEl.textContent?.trim() || null : null;
          const langAttr =
            card.querySelector('div[lang]')?.getAttribute('lang') ||
            textEl?.parentElement?.getAttribute('lang') ||
            null;

          const likesEl = card.querySelector(
            'span.pkWtMe, button[aria-label*="orang merasa" i], button[aria-label*="people found" i]'
          );
          let likes = 0;
          if (likesEl) {
            const digits = (likesEl.textContent || '').replace(/\D/g, '');
            if (digits) likes = parseInt(digits, 10);
          }

          const reviewImageUrls: string[] = [];
          const imgBtns = Array.from(card.querySelectorAll('button.Tya61d[style*="background-image"]'));
          for (const btn of imgBtns) {
            const style = btn.getAttribute('style') || '';
            const urlMatch = style.match(/url\(["']?(https?:\/\/[^"')]+)["']?\)/i);
            if (urlMatch && urlMatch[1]) {
              reviewImageUrls.push(urlMatch[1]);
            }
          }

          let ownerResponse: { text: string; date: string | null } | null = null;
          const ownerEl = card.querySelector('div.CDe7pd');
          if (ownerEl) {
            const respTextEl = ownerEl.querySelector('div.wiI7pd, div.wiI7m, div[lang]');
            const respDateEl = ownerEl.querySelector('span.DZSIDd, span.DHIhFt');
            const respText = respTextEl
              ? respTextEl.textContent?.replace(/Lainnya|More$/, '').trim() || ''
              : '';
            const respDate = respDateEl ? respDateEl.textContent?.trim() || null : null;
            if (respText) {
              ownerResponse = { text: respText, date: respDate };
            }
          }

          const reviewId =
            card.getAttribute('data-review-id') ||
            card.querySelector('[data-review-id]')?.getAttribute('data-review-id') ||
            null;

          return {
            reviewId,
            author,
            authorProfileUrl,
            reviewerId,
            reviewerPhotoUrl,
            reviewerNumberOfReviews,
            isLocalGuide,
            rating,
            relativeTime,
            text,
            originalLanguage: langAttr,
            likes,
            reviewImageUrls,
            ownerResponse,
          };
        });
      })
      .catch(() => []);

    const domReviews: GBPReview[] = [];
    for (const raw of rawCardsData) {
      const parsedDate = raw.relativeTime ? parseRelativeDate(raw.relativeTime) : null;
      const publishedAtDate = parsedDate ? parsedDate.toISOString() : null;

      let reviewUrl: string | null = null;
      if (raw.reviewId) {
        const latPart = latitude !== null && longitude !== null ? `@${latitude},${longitude},785m/` : '';
        const cidPart = cidHex ? `!2m1!1s0x0:${cidHex}` : '';
        reviewUrl = `https://www.google.com/maps/reviews/${latPart}data=!3m2!1e3!4b1!4m6!14m5!1m4!2m3!1s${raw.reviewId}${cidPart}?entry=ttu&hl=${hl}`;
      }

      let ownerResponse = raw.ownerResponse;
      let responseFromOwnerText: string | null = null;
      let responseFromOwnerDate: string | null = null;
      if (ownerResponse) {
        responseFromOwnerText = ownerResponse.text;
        if (ownerResponse.date) {
          const parsedOwnerDate = parseRelativeDate(ownerResponse.date);
          responseFromOwnerDate = parsedOwnerDate ? parsedOwnerDate.toISOString() : ownerResponse.date;
          ownerResponse = {
            text: ownerResponse.text,
            date: responseFromOwnerDate,
          };
        }
      }

      domReviews.push({
        reviewId: raw.reviewId,
        reviewUrl,
        author: raw.author,
        authorProfileUrl: raw.authorProfileUrl,
        rating: raw.rating,
        relativeTime: raw.relativeTime,
        publishedAtDate,
        text: raw.text,
        likes: raw.likes,
        ownerResponse,
        name: raw.author,
        reviewerId: raw.reviewerId,
        reviewerUrl: raw.authorProfileUrl,
        reviewerPhotoUrl: raw.reviewerPhotoUrl,
        reviewerNumberOfReviews: raw.reviewerNumberOfReviews,
        isLocalGuide: raw.isLocalGuide,
        stars: raw.rating,
        publishAt: raw.relativeTime,
        likesCount: raw.likes,
        textTranslated: null,
        responseFromOwnerDate,
        responseFromOwnerText,
        reviewImageUrls: raw.reviewImageUrls,
        reviewContext: {},
        reviewDetailedRating: {},
        visitedIn: null,
        originalLanguage: raw.originalLanguage,
        translatedLanguage: null,
        reviewOrigin: 'Google',
      });
    }

    return domReviews;
  }

  /**
   * Scrape Google Business reviews for one target using Hybrid RPC (`qv9Egd`) Interceptor + UI Cycling + DOM Fallback
   */
  private static async scrapeSingleReviews(
    page: Page,
    targetUrl: string,
    options: ScrapeOptions,
    existingProfile?: GBPProfile
  ): Promise<{
    businessName: string;
    placeUrl: string;
    totalScraped: number;
    reviews: GBPReview[];
    reviewsDistribution?: ReviewsDistribution;
    reviewsTags?: ReviewsTagItem[];
  }> {
    const hl = (options.language || options.hl || 'id').toLowerCase();
    const maxReviews = Math.min(
      options.maxReviews !== undefined ? options.maxReviews : config.defaultMaxReviews,
      config.maxReviewsLimit
    );
    const startDate = options.reviewsStartDate ? new Date(options.reviewsStartDate) : null;
    const normalizedSort = normalizeSortOption(options);

    // Map of reviewId -> GBPReview (RPC entries take precedence over DOM fallback)
    const collectedReviews = new Map<string, GBPReview>();
    let latestNextPageToken: string | null = null as string | null;
    let lastQv9RequestTemplate: { url: string; headers: Record<string, string>; postData: string } | null =
      null as { url: string; headers: Record<string, string>; postData: string } | null;
    let cidHex: string | null = null;

    const parseRawRpcBody = (bodyText: string) => {
      try {
        const cleaned = bodyText.replace(/^\)\]\}'\s*/, '');
        const lines = cleaned.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('[')) continue;
          try {
            const parsedLine = JSON.parse(trimmed);
            if (!Array.isArray(parsedLine)) continue;

            // Format 1: batchexecute wrb.fr envelope
            for (const item of parsedLine) {
              if (Array.isArray(item) && item[0] === 'wrb.fr' && typeof item[2] === 'string') {
                const payload = JSON.parse(item[2]);
                if (typeof payload?.[1] === 'string' && payload[1].length > 5) {
                  latestNextPageToken = payload[1];
                }
                const reviewsArr = Array.isArray(payload?.[2]) ? payload[2] : null;
                if (reviewsArr) {
                  for (const rawRev of reviewsArr) {
                    const parsedRev = parseRpcReviewEntry(rawRev, cidHex, hl);
                    if (parsedRev && parsedRev.reviewId) {
                      // Remove any earlier DOM-only entry for the same named author without reviewId
                      for (const [k, v] of collectedReviews.entries()) {
                        if (k !== parsedRev.reviewId && v.author && v.author === parsedRev.author) {
                          collectedReviews.delete(k);
                        }
                      }
                      collectedReviews.set(parsedRev.reviewId, parsedRev);
                    }
                  }
                }
              }
            }

            // Format 2: direct listentitiesreviews pb array
            if (Array.isArray(parsedLine[2])) {
              if (typeof parsedLine[1] === 'string' && parsedLine[1].length > 5) {
                latestNextPageToken = parsedLine[1];
              }
              for (const rawRev of parsedLine[2]) {
                const parsedRev = parseRpcReviewEntry(rawRev, cidHex, hl);
                if (parsedRev && parsedRev.reviewId) {
                  for (const [k, v] of collectedReviews.entries()) {
                    if (k !== parsedRev.reviewId && v.author && v.author === parsedRev.author) {
                      collectedReviews.delete(k);
                    }
                  }
                  collectedReviews.set(parsedRev.reviewId, parsedRev);
                }
              }
            }
          } catch {
            // Ignore non-JSON or unrelated line
          }
        }
      } catch {
        // Ignore parse errors
      }
    };

    const onRequest = (req: PlaywrightRequest) => {
      const reqUrl = req.url();
      if (reqUrl.includes('batchexecute') && reqUrl.includes('qv9Egd')) {
        const postData = req.postData();
        if (postData) {
          lastQv9RequestTemplate = {
            url: reqUrl,
            headers: req.headers(),
            postData,
          };
        }
      }
    };

    const onResponse = async (res: Response) => {
      const resUrl = res.url();
      if (
        (resUrl.includes('batchexecute') && resUrl.includes('qv9Egd')) ||
        resUrl.includes('listentitiesreviews')
      ) {
        try {
          const text = await res.text();
          parseRawRpcBody(text);
        } catch {
          // Ignore body read error on closed page
        }
      }
    };

    page.on('request', onRequest);
    page.on('response', onResponse);

    try {
      const finalUrl = existingProfile
        ? existingProfile.placeUrl
        : await GBPScraper.navigateToBusiness(page, targetUrl, options);
      const { latitude, longitude } = GBPScraper.extractCoordinates(finalUrl);
      const cidMatch = finalUrl.match(/:(0x[0-9a-fA-F]+)/);
      cidHex = cidMatch ? cidMatch[1] : null;

      // Parse any RPC responses that were already intercepted during initial navigation / scrapeSingleProfile
      const earlyRpcState = (page as any).__gbpRpcState as
        | {
            rawPayloads: string[];
            lastQv9RequestTemplate: { url: string; headers: Record<string, string>; postData: string } | null;
          }
        | undefined;
      if (earlyRpcState) {
        if (earlyRpcState.lastQv9RequestTemplate && !lastQv9RequestTemplate) {
          lastQv9RequestTemplate = earlyRpcState.lastQv9RequestTemplate;
        }
        for (const payloadText of earlyRpcState.rawPayloads) {
          parseRawRpcBody(payloadText);
        }
      }

      const nameEl = page.locator(SELECTORS.title).first();
      const businessName =
        existingProfile?.name ||
        cleanMapsText(await nameEl.textContent().catch(() => '')) ||
        'Unknown Business';

      if (maxReviews <= 0) {
        return {
          businessName,
          placeUrl: finalUrl,
          totalScraped: 0,
          reviews: [],
        };
      }

      const mergeDomReviews = async () => {
        const domRevs = await GBPScraper.extractDomReviews(page, cidHex, latitude, longitude, hl);
        for (const dRev of domRevs) {
          const key = dRev.reviewId || `${dRev.author}-${dRev.relativeTime}`;
          const existingById = collectedReviews.get(key);
          const existingByAuthor = !existingById
            ? Array.from(collectedReviews.values()).find(
                (r) => r.author && r.author === dRev.author && r.author !== 'Anonymous'
              )
            : null;
          const existing = existingById || existingByAuthor;
          if (!existing) {
            collectedReviews.set(key, dRev);
          } else if (!existing.text && dRev.text) {
            const targetKey = existing.reviewId || key;
            collectedReviews.set(targetKey, { ...existing, text: dRev.text });
          }
        }
      };

      // Harvest any featured review cards rendered on the Overview tab before switching to the Reviews tab
      await mergeDomReviews();

      // Click on the Reviews tab if available (must use real pointer .click() to trigger Google Maps Wiz tab switch & qv9Egd RPC)
      const reviewsTab = page.locator(SELECTORS.reviewsTab).first();
      if (await reviewsTab.isVisible({ timeout: 4000 }).catch(() => false)) {
        await reviewsTab.click({ timeout: 4000 }).catch(() => {});
        await page.waitForTimeout(2200);
      }

      // Extract reviewsDistribution and reviewsTags while on the Reviews tab
      const reviewsDistribution = await GBPScraper.extractReviewsDistribution(page);
      const reviewsTags = await GBPScraper.extractReviewsTags(page);

      // Extract total reviews count for logging
      let totalReviewsCount: number | null = existingProfile?.reviewCount ?? null;
      if (!totalReviewsCount) {
        const countEl = page.locator(SELECTORS.reviewCount).first();
        if (await countEl.isVisible({ timeout: 1500 }).catch(() => false)) {
          const rawCount = await countEl.textContent();
          if (rawCount) {
            const digits = rawCount.replace(/\D/g, '');
            if (digits) totalReviewsCount = parseInt(digits, 10);
          }
        }
      }

      const logReviewProgress = (count: number) => {
        const total = totalReviewsCount || maxReviews;
        const progressCount = Math.min(count, maxReviews);
        console.log(
          `${new Date().toISOString()} INFO ⭐️ [${progressCount}/${total}] Extracting reviews from [${finalUrl}](${finalUrl})`
        );
      };

      // Check and dismiss Google Maps unauthenticated Login modal if triggered
      const checkAndDismissLoginModal = async (): Promise<boolean> => {
        const hasLoginModal = await page
          .evaluate(() => {
            const backdrop = document.querySelector('div.mYFZJb');
            const dialog = document.querySelector('div[role="dialog"]');
            if (!backdrop && !dialog) return false;
            const text = dialog?.textContent || '';
            return Boolean(backdrop || /login|masuk|sign in|fitur terbaik/i.test(text));
          })
          .catch(() => false);

        if (hasLoginModal) {
          await page.keyboard.press('Escape').catch(() => {});
          await page
            .evaluate(() => {
              const closeBtn = document.querySelector(
                'div[role="dialog"] button[jsaction*="dismiss" i], div[role="dialog"] button[aria-label*="Tutup" i], div[role="dialog"] button[aria-label*="Close" i]'
              ) as HTMLElement | null;
              closeBtn?.click();
            })
            .catch(() => {});
          await page.waitForTimeout(300);
          return true;
        }
        return false;
      };

      let isBlockedByLoginWall = false;

      // Helper to select a sort option in UI without hanging on modal backdrop
      const applySortInUi = async (sortKey: 'relevant' | 'newest' | 'highest' | 'lowest'): Promise<boolean> => {
        if (isBlockedByLoginWall) return false;
        try {
          const sortButton = page.locator(SELECTORS.reviewsSortButton).first();
          if (await sortButton.isVisible({ timeout: 1500 }).catch(() => false)) {
            await sortButton.click({ timeout: 2500 }).catch(() => {});
            await page.waitForTimeout(600);

            if (await checkAndDismissLoginModal()) {
              isBlockedByLoginWall = true;
              return false;
            }

            const sortSelector = SELECTORS.sortOptions[sortKey];
            if (sortSelector) {
              const targetOption = page.locator(sortSelector).first();
              if (await targetOption.isVisible({ timeout: 1200 }).catch(() => false)) {
                await targetOption.click({ timeout: 2500 }).catch(() => {});
                await page.waitForTimeout(1500);
                if (await checkAndDismissLoginModal()) {
                  isBlockedByLoginWall = true;
                  return false;
                }
                return true;
              }
            }
          }
        } catch {
          // Ignore sort UI error
        }
        return false;
      };

      // Harvest initial DOM reviews before sorting
      await mergeDomReviews();

      // Apply requested review sort
      if (normalizedSort !== 'relevant') {
        await applySortInUi(normalizedSort);
        await mergeDomReviews();
      }

      // Locate review container for scrolling
      const scrollContainer = page.locator(SELECTORS.reviewsScrollContainer).first();
      const containerFound = await scrollContainer.isVisible({ timeout: 4000 }).catch(() => false);

      let previousReviewCount = 0;
      let scrollStagnantCount = 0;

      while (collectedReviews.size < maxReviews && scrollStagnantCount < 4) {
        await mergeDomReviews();
        const currentCount = collectedReviews.size;

        if (currentCount === previousReviewCount) {
          scrollStagnantCount++;
        } else {
          scrollStagnantCount = 0;
          previousReviewCount = currentCount;
          logReviewProgress(currentCount);
        }

        if (currentCount >= maxReviews || scrollStagnantCount >= 4) {
          break;
        }

        if (containerFound) {
          await scrollContainer
            .evaluate((el) => {
              el.scrollTop = el.scrollHeight;
            })
            .catch(() => {});
        } else {
          await page.mouse.wheel(0, 3000).catch(() => {});
        }

        await page.waitForTimeout(1200);

        // If a nextPageToken was returned by qv9Egd and we have the request template, actively fetch next page
        if (latestNextPageToken && lastQv9RequestTemplate && collectedReviews.size < maxReviews) {
          const tokenToFetch = latestNextPageToken;
          latestNextPageToken = null;
          try {
            const rpcText = await page.evaluate(
              async ({ url, postData, token }) => {
                // Replace token placeholder or append nextPageToken inside f.req
                const decoded = decodeURIComponent(postData);
                if (!decoded.includes(token)) {
                  const updatedPost = postData.replace(
                    /%2Cnull%2C%5Bnull%2C\d+%5D/i,
                    `%2C%22${encodeURIComponent(token)}%22%2C%5Bnull%2C20%5D`
                  );
                  if (updatedPost !== postData) {
                    const res = await fetch(url, {
                      method: 'POST',
                      headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
                      body: updatedPost,
                    });
                    return await res.text();
                  }
                }
                return null;
              },
              {
                url: lastQv9RequestTemplate.url,
                postData: lastQv9RequestTemplate.postData,
                token: tokenToFetch,
              }
            );
            if (rpcText) {
              parseRawRpcBody(rpcText);
            }
          } catch {
            // Ignore active pagination fetch errors
          }
        }
      }

      // If Google Maps allows sort/chip switching without triggering the unauthenticated Login wall,
      // cycle through the remaining sort orders and topic chips to collect additional reviews.
      if (
        !isBlockedByLoginWall &&
        collectedReviews.size < maxReviews &&
        (totalReviewsCount === null || totalReviewsCount > collectedReviews.size)
      ) {
        const allSorts: Array<'newest' | 'relevant' | 'highest' | 'lowest'> = [
          'newest',
          'relevant',
          'highest',
          'lowest',
        ];
        for (const extraSort of allSorts) {
          if (collectedReviews.size >= maxReviews || isBlockedByLoginWall) break;
          if (extraSort === normalizedSort) continue;
          const switched = await applySortInUi(extraSort);
          if (switched) {
            await mergeDomReviews();
            logReviewProgress(collectedReviews.size);
          }
        }

        // Also click through topic filter chips if still below maxReviews and not blocked by Login wall
        if (collectedReviews.size < maxReviews && !isBlockedByLoginWall) {
          const topicChips = page.locator(SELECTORS.reviewsTopicChips);
          const chipCount = await topicChips.count().catch(() => 0);
          for (let i = 0; i < Math.min(chipCount, 10); i++) {
            if (collectedReviews.size >= maxReviews || isBlockedByLoginWall) break;
            const chip = topicChips.nth(i);
            const chipText = (await chip.textContent().catch(() => ''))?.trim() || '';
            if (/^(Semua|All)$/i.test(chipText)) continue;
            if (await chip.isVisible({ timeout: 800 }).catch(() => false)) {
              await chip.evaluate((b: any) => b.click()).catch(() => {});
              await page.waitForTimeout(1000);
              if (await checkAndDismissLoginModal()) {
                isBlockedByLoginWall = true;
                break;
              }
              await mergeDomReviews();
              logReviewProgress(collectedReviews.size);
            }
          }
        }
      }

      // Convert collected map into sorted & filtered array
      let allReviews = Array.from(collectedReviews.values());

      // Sort according to requested sort order
      if (normalizedSort === 'newest') {
        allReviews.sort((a, b) => {
          const tA = a.publishedAtDate ? new Date(a.publishedAtDate).getTime() : 0;
          const tB = b.publishedAtDate ? new Date(b.publishedAtDate).getTime() : 0;
          return tB - tA;
        });
      } else if (normalizedSort === 'highest') {
        allReviews.sort((a, b) => {
          if (b.stars !== a.stars) return b.stars - a.stars;
          const tA = a.publishedAtDate ? new Date(a.publishedAtDate).getTime() : 0;
          const tB = b.publishedAtDate ? new Date(b.publishedAtDate).getTime() : 0;
          return tB - tA;
        });
      } else if (normalizedSort === 'lowest') {
        allReviews.sort((a, b) => {
          if (a.stars !== b.stars) return a.stars - b.stars;
          const tA = a.publishedAtDate ? new Date(a.publishedAtDate).getTime() : 0;
          const tB = b.publishedAtDate ? new Date(b.publishedAtDate).getTime() : 0;
          return tB - tA;
        });
      }

      // Filter by reviewsFilterString if specified
      if (options.reviewsFilterString && options.reviewsFilterString.trim() !== '') {
        const keyword = options.reviewsFilterString.trim().toLowerCase();
        allReviews = allReviews.filter((r) => (r.text || '').toLowerCase().includes(keyword));
      }

      // Filter by reviewsStartDate if specified and apply privacy settings
      const finalReviews: GBPReview[] = [];
      for (const rev of allReviews) {
        if (startDate && rev.publishedAtDate) {
          const revDate = new Date(rev.publishedAtDate);
          if (!isNaN(revDate.getTime()) && revDate < startDate) {
            continue;
          }
        }
        finalReviews.push(applyReviewPrivacy(rev, options));
        if (finalReviews.length >= maxReviews) {
          break;
        }
      }

      return {
        businessName,
        placeUrl: finalUrl,
        totalScraped: finalReviews.length,
        reviews: finalReviews,
        reviewsDistribution,
        reviewsTags,
      };
    } finally {
      page.off('request', onRequest);
      page.off('response', onResponse);
    }
  }

  /**
   * Scrape Google Business Profile details (supports single or multiple targets)
   */
  public static async scrapeProfile(options: ScrapeOptions): Promise<{ data: GBPProfile; results: GBPProfile[] }> {
    const targets = GBPScraper.resolveTargets(options);
    if (targets.length === 0) {
      throw new Error('At least one of "startUrls", "placeIds", "url", "query", or "searchStringsArray" must be provided.');
    }

    const results: GBPProfile[] = [];
    let scrapeError: Error | null = null;

    const crawleeConfig = new Configuration({
      persistStorage: false,
      purgeOnStart: true,
    });

    const proxyConfiguration = await proxyManager.getProxyConfiguration(options);

    const crawler = new PlaywrightCrawler(
      {
        headless: config.headless,
        proxyConfiguration,
        useSessionPool: true,
        sessionPoolOptions: {
          maxPoolSize: 100,
          sessionOptions: {
            maxErrorScore: 1,
          },
        },
        maxRequestRetries: config.maxRequestRetries || 5,
        maxRequestsPerCrawl: targets.length,
        navigationTimeoutSecs: config.navigationTimeoutSecs,
        requestHandlerTimeoutSecs: 120,
        launchContext: {
          launchOptions: {
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-blink-features=AutomationControlled',
              '--ignore-certificate-errors',
              '--ignore-ssl-errors',
              `--lang=${(options.language || options.hl || 'id').toLowerCase()}`,
            ],
          },
          userAgent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        },
        preNavigationHooks: [
          async ({ page }, gotoOptions: any) => {
            await GBPScraper.preparePageForGoogle(page, gotoOptions, options);
          },
        ],
        errorHandler({ request, session, proxyInfo }, error) {
          if (proxyInfo?.url) {
            proxyManager.markDead(proxyInfo.url);
            log.warning(
              `[Proxy Rotator] Proxy ${proxyInfo.url} failed for ${request.url} (${error.message}). Retiring session and switching proxy...`
            );
          }
          session?.retire();
        },
        failedRequestHandler({ request, proxyInfo }, error) {
          if (proxyInfo?.url) {
            proxyManager.markDead(proxyInfo.url);
          }
          log.error(
            `[Crawler] Request ${request.url} failed after maximum retries with proxy ${proxyInfo?.url || 'direct'}: ${error.message}`
          );
        },
        async requestHandler({ page, request, proxyInfo }) {
          if (proxyInfo?.url) {
            log.info(`[Crawler] Scraping profile ${request.url} via proxy: ${proxyInfo.url}`);
          }
          try {
            const profile = await GBPScraper.scrapeSingleProfile(page, request.url, options);
            if (options.skipClosedPlaces && (profile.permanentlyClosed || profile.temporarilyClosed)) {
              log.info(`Skipping closed place: ${profile.title}`);
              return;
            }
            results.push(profile);
          } catch (err: any) {
            scrapeError = err;
            throw err;
          }
        },
      },
      crawleeConfig
    );

    const requests = targets.map((target) => ({
      url: target,
      uniqueKey: `${target}-${Date.now()}-${Math.random()}`,
    }));

    await crawler.run(requests);

    if (scrapeError && results.length === 0) {
      throw scrapeError;
    }
    if (results.length === 0) {
      throw new Error('Failed to scrape Google Business Profile details.');
    }

    return { data: results[0], results };
  }

  /**
   * Scrape Google Business reviews (supports single or multiple targets)
   */
  public static async scrapeReviews(options: ScrapeOptions): Promise<{
    data: {
      businessName: string;
      placeUrl: string;
      totalScraped: number;
      reviews: GBPReview[];
    };
    results: Array<{
      businessName: string;
      placeUrl: string;
      totalScraped: number;
      reviews: GBPReview[];
    }>;
  }> {
    const targets = GBPScraper.resolveTargets(options);
    if (targets.length === 0) {
      throw new Error('At least one of "startUrls", "placeIds", "url", "query", or "searchStringsArray" must be provided.');
    }

    const results: Array<{
      businessName: string;
      placeUrl: string;
      totalScraped: number;
      reviews: GBPReview[];
    }> = [];
    let scrapeError: Error | null = null;

    const crawleeConfig = new Configuration({
      persistStorage: false,
      purgeOnStart: true,
    });

    const proxyConfiguration = await proxyManager.getProxyConfiguration(options);

    const crawler = new PlaywrightCrawler(
      {
        headless: config.headless,
        proxyConfiguration,
        useSessionPool: true,
        sessionPoolOptions: {
          maxPoolSize: 100,
          sessionOptions: {
            maxErrorScore: 1,
          },
        },
        maxRequestRetries: config.maxRequestRetries || 5,
        maxRequestsPerCrawl: targets.length,
        navigationTimeoutSecs: config.navigationTimeoutSecs,
        requestHandlerTimeoutSecs: 240,
        launchContext: {
          launchOptions: {
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-blink-features=AutomationControlled',
              '--ignore-certificate-errors',
              '--ignore-ssl-errors',
              `--lang=${(options.language || options.hl || 'id').toLowerCase()}`,
            ],
          },
          userAgent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        },
        preNavigationHooks: [
          async ({ page }, gotoOptions: any) => {
            await GBPScraper.preparePageForGoogle(page, gotoOptions, options);
          },
        ],
        errorHandler({ request, session, proxyInfo }, error) {
          if (proxyInfo?.url) {
            proxyManager.markDead(proxyInfo.url);
            log.warning(
              `[Proxy Rotator] Proxy ${proxyInfo.url} failed for ${request.url} (${error.message}). Retiring session and switching proxy...`
            );
          }
          session?.retire();
        },
        failedRequestHandler({ request, proxyInfo }, error) {
          if (proxyInfo?.url) {
            proxyManager.markDead(proxyInfo.url);
          }
          log.error(
            `[Crawler] Request ${request.url} failed after maximum retries with proxy ${proxyInfo?.url || 'direct'}: ${error.message}`
          );
        },
        async requestHandler({ page, request, proxyInfo }) {
          if (proxyInfo?.url) {
            log.info(`[Crawler] Scraping reviews ${request.url} via proxy: ${proxyInfo.url}`);
          }
          try {
            const item = await GBPScraper.scrapeSingleReviews(page, request.url, options);
            results.push(item);
          } catch (err: any) {
            scrapeError = err;
            throw err;
          }
        },
      },
      crawleeConfig
    );

    const requests = targets.map((target) => ({
      url: target,
      uniqueKey: `${target}-${Date.now()}-${Math.random()}`,
    }));

    await crawler.run(requests);

    if (scrapeError && results.length === 0) {
      throw scrapeError;
    }
    if (results.length === 0) {
      throw new Error('Failed to scrape Google Business reviews.');
    }

    return { data: results[0], results };
  }

  /**
   * Scrape both profile details and reviews for one target
   */
  private static async scrapeSingleFull(
    page: Page,
    targetUrl: string,
    options: ScrapeOptions
  ): Promise<{
    profile: GBPProfile;
    totalReviewsScraped: number;
    reviews: GBPReview[];
  }> {
    const profile = await GBPScraper.scrapeSingleProfile(page, targetUrl, options);
    const reviewsData = await GBPScraper.scrapeSingleReviews(page, targetUrl, options, profile);

    // Enrich profile with reviewsDistribution & reviewsTags discovered on the Reviews tab if Overview didn't have them
    if (
      reviewsData.reviewsDistribution &&
      profile.reviewsDistribution.oneStar +
        profile.reviewsDistribution.twoStar +
        profile.reviewsDistribution.threeStar +
        profile.reviewsDistribution.fourStar +
        profile.reviewsDistribution.fiveStar ===
        0
    ) {
      profile.reviewsDistribution = reviewsData.reviewsDistribution;
    }
    if (reviewsData.reviewsTags && reviewsData.reviewsTags.length > 0 && profile.reviewsTags.length === 0) {
      profile.reviewsTags = reviewsData.reviewsTags;
    }

    return {
      profile,
      totalReviewsScraped: reviewsData.totalScraped,
      reviews: reviewsData.reviews,
    };
  }

  /**
   * Scrape both profile details and reviews (supports single or multiple targets)
   */
  public static async scrapeFull(options: ScrapeOptions): Promise<{
    data: {
      profile: GBPProfile;
      totalReviewsScraped: number;
      reviews: GBPReview[];
    };
    results: Array<{
      profile: GBPProfile;
      totalReviewsScraped: number;
      reviews: GBPReview[];
    }>;
  }> {
    const targets = GBPScraper.resolveTargets(options);
    if (targets.length === 0) {
      throw new Error('At least one of "startUrls", "placeIds", "url", "query", or "searchStringsArray" must be provided.');
    }

    const results: Array<{
      profile: GBPProfile;
      totalReviewsScraped: number;
      reviews: GBPReview[];
    }> = [];
    let scrapeError: Error | null = null;

    const crawleeConfig = new Configuration({
      persistStorage: false,
      purgeOnStart: true,
    });

    const proxyConfiguration = await proxyManager.getProxyConfiguration(options);

    const crawler = new PlaywrightCrawler(
      {
        headless: config.headless,
        proxyConfiguration,
        useSessionPool: true,
        sessionPoolOptions: {
          maxPoolSize: 100,
          sessionOptions: {
            maxErrorScore: 1,
          },
        },
        maxRequestRetries: config.maxRequestRetries || 5,
        maxRequestsPerCrawl: targets.length,
        navigationTimeoutSecs: config.navigationTimeoutSecs,
        requestHandlerTimeoutSecs: 300,
        launchContext: {
          launchOptions: {
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-blink-features=AutomationControlled',
              '--ignore-certificate-errors',
              '--ignore-ssl-errors',
              `--lang=${(options.language || options.hl || 'id').toLowerCase()}`,
            ],
          },
          userAgent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        },
        preNavigationHooks: [
          async ({ page }, gotoOptions: any) => {
            await GBPScraper.preparePageForGoogle(page, gotoOptions, options);
          },
        ],
        errorHandler({ request, session, proxyInfo }, error) {
          if (proxyInfo?.url) {
            proxyManager.markDead(proxyInfo.url);
            log.warning(
              `[Proxy Rotator] Proxy ${proxyInfo.url} failed for ${request.url} (${error.message}). Retiring session and switching proxy...`
            );
          }
          session?.retire();
        },
        failedRequestHandler({ request, proxyInfo }, error) {
          if (proxyInfo?.url) {
            proxyManager.markDead(proxyInfo.url);
          }
          log.error(
            `[Crawler] Request ${request.url} failed after maximum retries with proxy ${proxyInfo?.url || 'direct'}: ${error.message}`
          );
        },
        async requestHandler({ page, request, proxyInfo }) {
          if (proxyInfo?.url) {
            log.info(`[Crawler] Scraping full ${request.url} via proxy: ${proxyInfo.url}`);
          }
          try {
            const item = await GBPScraper.scrapeSingleFull(page, request.url, options);
            if (options.skipClosedPlaces && (item.profile.permanentlyClosed || item.profile.temporarilyClosed)) {
              log.info(`Skipping closed place: ${item.profile.title}`);
              return;
            }
            results.push(item);
          } catch (err: any) {
            scrapeError = err;
            throw err;
          }
        },
      },
      crawleeConfig
    );

    const requests = targets.map((target) => ({
      url: target,
      uniqueKey: `${target}-${Date.now()}-${Math.random()}`,
    }));

    await crawler.run(requests);

    if (scrapeError && results.length === 0) {
      throw scrapeError;
    }
    if (results.length === 0) {
      throw new Error('Failed to scrape Google Business Profile and reviews.');
    }

    return { data: results[0], results };
  }

  /**
   * Scrape and return items in exact Apify `compass/crawler-google-places` (`nwua9Gu5YrADL7ZDj`) dataset format.
   * Supports both standard place objects (with nested `reviews` array) and `oneReviewPerRow: true` flattened rows.
   */
  public static async scrapeApifyDataset(options: ScrapeOptions): Promise<any[]> {
    const fullResult = await GBPScraper.scrapeFull({
      ...options,
      personalData:
        options.scrapeReviewsPersonalData !== undefined
          ? options.scrapeReviewsPersonalData
          : options.personalData !== undefined
            ? options.personalData
            : true,
    });

    const datasetItems: any[] = [];

    for (const item of fullResult.results) {
      const { profile, reviews } = item;
      const apifyPlaceBase = {
        title: profile.title,
        subTitle: profile.subTitle,
        description: null,
        price: null,
        categoryName: profile.categoryName,
        address: profile.address,
        neighborhood: profile.neighborhood,
        street: profile.street,
        city: profile.city,
        postalCode: profile.postalCode,
        state: profile.state,
        countryCode: profile.countryCode,
        website: profile.website,
        phone: profile.phone,
        phoneUnformatted: profile.phoneUnformatted,
        claimThisBusiness: false,
        location: profile.location,
        totalScore: profile.totalScore,
        permanentlyClosed: profile.permanentlyClosed,
        temporarilyClosed: profile.temporarilyClosed,
        placeId: profile.placeId,
        categories: profile.categories,
        fid: profile.fid,
        cid: profile.cid,
        reviewsCount: profile.reviewsCount,
        imagesCount: profile.imagesCount,
        imageCategories: [],
        scrapedAt: profile.scrapedAt,
        googleFoodUrl: null,
        hotelStars: null,
        hotelDescription: null,
        checkInDate: null,
        checkOutDate: null,
        similarHotelsNearby: null,
        hotelReviewSummary: null,
        openingHours: profile.openingHoursDetailed,
        openingHoursStrings: profile.openingHours,
        peopleAlsoSearch: profile.peopleAlsoSearch,
        placesTags: [],
        reviewsTags: profile.reviewsTags,
        additionalInfo: profile.additionalInfo,
        gasPrices: [],
        questionsAndAnswers: [],
        updatesFromCustomers: null,
        url: profile.url,
        searchPageUrl: profile.searchPageUrl,
        searchString: profile.searchString,
        language: options.language || options.hl || 'id',
        rank: 1,
        isAdvertisement: false,
        imageUrl: profile.imageUrl,
        kgmid: null,
        plusCode: profile.plusCode,
        imageUrls: profile.imageUrls,
        reviewsDistribution: profile.reviewsDistribution,
      };

      if (options.oneReviewPerRow && reviews.length > 0) {
        for (const rev of reviews) {
          datasetItems.push({
            ...apifyPlaceBase,
            ...rev,
            // Preserve place title if review `name` is reviewer name (Apify uses `title` for place, `name` for reviewer)
            title: profile.title,
          });
        }
      } else {
        datasetItems.push({
          ...apifyPlaceBase,
          reviews,
        });
      }
    }

    return datasetItems;
  }
}
