export const reviewsDistributionSchema = {
  type: 'object',
  properties: {
    oneStar: { type: 'integer' },
    twoStar: { type: 'integer' },
    threeStar: { type: 'integer' },
    fourStar: { type: 'integer' },
    fiveStar: { type: 'integer' },
  },
};

export const openingHoursItemSchema = {
  type: 'object',
  properties: {
    day: { type: 'string' },
    hours: { type: 'string' },
  },
};

export const reviewsTagItemSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    count: { type: 'integer' },
  },
};

export const profileResponseSchema = {
  type: 'object',
  properties: {
    // Pantau / Legacy fields
    name: { type: 'string', description: 'Business name' },
    rating: { type: 'number', nullable: true, description: 'Average star rating' },
    reviewCount: { type: 'integer', nullable: true, description: 'Total review count' },
    category: { type: 'string', nullable: true, description: 'Business primary category' },
    address: { type: 'string', nullable: true, description: 'Full business address' },
    phone: { type: 'string', nullable: true, description: 'Phone number' },
    website: { type: 'string', nullable: true, description: 'Website URL' },
    openingHours: {
      type: 'array',
      items: { type: 'string' },
      description: 'Daily opening hours (formatted strings)',
    },
    placeUrl: { type: 'string', description: 'Canonical Google Maps URL' },
    latitude: { type: 'number', nullable: true, description: 'Latitude coordinates' },
    longitude: { type: 'number', nullable: true, description: 'Longitude coordinates' },

    // Apify compass/crawler-google-places (nwua9Gu5YrADL7ZDj) fields
    title: { type: 'string', description: 'Place title (Apify format)' },
    subTitle: { type: 'string', nullable: true, description: 'Place subtitle' },
    totalScore: { type: 'number', nullable: true, description: 'Total star score (Apify format)' },
    reviewsCount: { type: 'integer', nullable: true, description: 'Total reviews count (Apify format)' },
    reviewsDistribution: reviewsDistributionSchema,
    categoryName: { type: 'string', nullable: true, description: 'Primary category name (Apify format)' },
    categories: {
      type: 'array',
      items: { type: 'string' },
      description: 'All place categories',
    },
    neighborhood: { type: 'string', nullable: true },
    street: { type: 'string', nullable: true },
    city: { type: 'string', nullable: true },
    postalCode: { type: 'string', nullable: true },
    state: { type: 'string', nullable: true },
    countryCode: { type: 'string', nullable: true },
    plusCode: { type: 'string', nullable: true },
    phoneUnformatted: { type: 'string', nullable: true },
    cid: { type: 'string', nullable: true, description: 'Google CID (decimal string)' },
    fid: { type: 'string', nullable: true, description: 'Google Feature ID (hex pair)' },
    placeId: { type: 'string', nullable: true, description: 'Google Place ID' },
    location: {
      type: 'object',
      properties: {
        lat: { type: 'number', nullable: true },
        lng: { type: 'number', nullable: true },
      },
    },
    permanentlyClosed: { type: 'boolean' },
    temporarilyClosed: { type: 'boolean' },
    openingHoursDetailed: {
      type: 'array',
      items: openingHoursItemSchema,
      description: 'Structured daily opening hours (Apify format)',
    },
    imageUrl: { type: 'string', nullable: true },
    imagesCount: { type: 'integer', nullable: true },
    imageUrls: {
      type: 'array',
      items: { type: 'string' },
    },
    reviewsTags: {
      type: 'array',
      items: reviewsTagItemSchema,
    },
    peopleAlsoSearch: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
      },
    },
    additionalInfo: {
      type: 'object',
      additionalProperties: true,
    },
    url: { type: 'string', description: 'Canonical Google Maps Place URL (Apify format)' },
    searchPageUrl: { type: 'string', nullable: true },
    searchString: { type: 'string', nullable: true },
    inputPlaceId: { type: 'string', nullable: true },
    inputStartUrl: { type: 'string', nullable: true },
    scrapedAt: { type: 'string' },
  },
};

export const reviewItemSchema = {
  type: 'object',
  properties: {
    // Pantau / Legacy fields
    reviewId: { type: 'string', nullable: true, description: 'Google Maps Review ID' },
    reviewUrl: { type: 'string', nullable: true, description: 'Direct Google Maps Review URL' },
    author: { type: 'string', description: 'Reviewer display name (anonymized if personalData is false)' },
    authorProfileUrl: { type: 'string', nullable: true, description: 'Reviewer profile URL (null if personalData is false)' },
    rating: { type: 'number', description: 'Star rating given (1-5)' },
    relativeTime: { type: 'string', nullable: true, description: 'Relative time of review (e.g. 2 weeks ago)' },
    publishedAtDate: { type: 'string', nullable: true, description: 'Exact ISO 8601 timestamp from Google RPC or estimated date' },
    text: { type: 'string', nullable: true, description: 'Review comment/body' },
    likes: { type: 'integer', description: 'Number of likes/helpful marks' },
    ownerResponse: {
      type: 'object',
      nullable: true,
      properties: {
        text: { type: 'string' },
        date: { type: 'string', nullable: true },
      },
    },

    // Apify compass/crawler-google-places (nwua9Gu5YrADL7ZDj) fields
    name: { type: 'string', nullable: true, description: 'Reviewer name (Apify format)' },
    reviewerId: { type: 'string', nullable: true, description: 'Google Contributor ID' },
    reviewerUrl: { type: 'string', nullable: true, description: 'Google Contributor Profile URL' },
    reviewerPhotoUrl: { type: 'string', nullable: true, description: 'Reviewer avatar photo URL' },
    reviewerNumberOfReviews: { type: 'integer', nullable: true, description: 'Total reviews written by this user' },
    isLocalGuide: { type: 'boolean', description: 'Whether reviewer is a Google Local Guide' },
    stars: { type: 'number', description: 'Star rating (1-5, Apify format)' },
    publishAt: { type: 'string', nullable: true, description: 'Relative publish time (Apify format)' },
    likesCount: { type: 'integer', description: 'Likes count (Apify format)' },
    textTranslated: { type: 'string', nullable: true, description: 'Translated review text' },
    responseFromOwnerDate: { type: 'string', nullable: true, description: 'Owner response ISO date (Apify format)' },
    responseFromOwnerText: { type: 'string', nullable: true, description: 'Owner response text (Apify format)' },
    reviewImageUrls: {
      type: 'array',
      items: { type: 'string' },
      description: 'Attached review photo URLs',
    },
    reviewContext: {
      type: 'object',
      additionalProperties: true,
    },
    reviewDetailedRating: {
      type: 'object',
      additionalProperties: true,
    },
    visitedIn: { type: 'string', nullable: true },
    originalLanguage: { type: 'string', nullable: true, description: 'Original language code of review (e.g. "id", "en")' },
    translatedLanguage: { type: 'string', nullable: true },
    reviewOrigin: { type: 'string', description: 'Review source (e.g. "Google")' },
  },
};

const commonInputProperties = {
  url: {
    type: 'string',
    format: 'uri',
    example: 'https://maps.app.goo.gl/q5Q1NgmEvVk1a86a9',
    description: 'Direct Google Maps Place URL or shortlink (PILIHAN 1: gunakan salah satu)',
  },
  placeId: {
    type: 'string',
    example: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
    description: 'Single Google Maps Place ID (PILIHAN 2: gunakan salah satu)',
  },
  placeIds: {
    type: 'array',
    items: {
      type: 'string',
      example: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
    },
    description: 'Array of Google Maps Place IDs (Apify compatible)',
  },
  startUrls: {
    type: 'array',
    items: {
      type: 'object',
      required: ['url'],
      properties: {
        url: {
          type: 'string',
          format: 'uri',
          example: 'https://maps.app.goo.gl/q5Q1NgmEvVk1a86a9',
          description: 'Google Maps Place URL or shortlink',
        },
      },
    },
    description: 'Array of start URLs to scrape (Apify compatible)',
  },
  searchStringsArray: {
    type: 'array',
    items: { type: 'string' },
    description: 'Array of search queries or URLs (Apify compass/crawler-google-places compatible)',
  },
  locationQuery: {
    type: 'string',
    description: 'Location query appended to searchStringsArray or query (Apify compatible)',
  },
  query: {
    type: 'string',
    description: 'Search query (e.g. "Monumen Nasional")',
  },
  language: { type: 'string', default: 'id', example: 'id', description: 'Language code (e.g. "id", "en")' },
  hl: { type: 'string', example: 'id', description: 'Alias for language' },
  maxReviews: { type: 'integer', default: 5, minimum: 0, maximum: 5000, example: 5, description: 'Maximum reviews to extract' },
  personalData: {
    type: 'boolean',
    default: true,
    example: true,
    description: 'Include reviewer personal data (name, profile URL, photo, reviewerId).',
  },
  scrapeReviewsPersonalData: {
    type: 'boolean',
    default: true,
    example: true,
    description: 'Apify alias for personalData.',
  },
  oneReviewPerRow: {
    type: 'boolean',
    default: false,
    description: 'Apify dataset format option: if true, each dataset row is 1 review merged with place details.',
  },
  reviewsStartDate: { type: 'string', example: '2026-01-01', description: 'Filter reviews starting from this date (YYYY-MM-DD)' },
  reviewsFilterString: { type: 'string', description: 'Filter reviews containing this keyword (Apify compatible)' },
  sortBy: {
    type: 'string',
    enum: ['newest', 'highest', 'lowest', 'relevant', 'mostRelevant', 'highestRanking', 'lowestRanking'],
    default: 'newest',
    example: 'newest',
    description: 'Review sort order',
  },
  reviewsSort: {
    type: 'string',
    enum: ['newest', 'mostRelevant', 'highestRanking', 'lowestRanking', 'highest', 'lowest', 'relevant'],
    default: 'newest',
    example: 'newest',
    description: 'Apify review sort order',
  },
  skipClosedPlaces: {
    type: 'boolean',
    default: false,
    description: 'Skip places that are temporarily or permanently closed (Apify compatible)',
  },
  useProxy: {
    type: 'boolean',
    default: true,
    example: true,
    description: 'Gunakan proxy rotasi otomatis dari Proxifly untuk menghindari limitasi Google. Default: true.',
  },
  proxyUrl: {
    type: 'string',
    example: 'socks5://1.2.3.4:1080',
    description: 'Custom proxy URL tunggal jika ingin menggunakan proxy sendiri (opsional).',
  },
  proxyUrls: {
    type: 'array',
    items: { type: 'string' },
    description: 'Daftar custom proxy URLs jika ingin menggunakan pool proxy sendiri (opsional).',
  },
};

export const getProxyStatsSchema = {
  description: 'Get current proxy pool statistics and health status',
  tags: ['System'],
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean' },
            totalLoaded: { type: 'integer' },
            deadCount: { type: 'integer' },
            activePoolSize: { type: 'integer' },
            lastFetchedAt: { type: 'string', nullable: true },
            sourceUrl: { type: 'string' },
          },
        },
      },
    },
  },
};

export const scrapeProfileSchema = {
  description: 'Scrape Google Business Profile metadata (synchronous)',
  tags: ['Scraper'],
  body: {
    type: 'object',
    properties: commonInputProperties,
    examples: [
      {
        url: 'https://maps.app.goo.gl/q5Q1NgmEvVk1a86a9',
        language: 'id',
      },
    ],
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: profileResponseSchema,
        results: {
          type: 'array',
          items: profileResponseSchema,
        },
      },
    },
    400: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error: { type: 'string' },
      },
    },
    500: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error: { type: 'string' },
      },
    },
  },
};

export const scrapeReviewsSchema = {
  description: 'Scrape Google Business reviews (synchronous)',
  tags: ['Scraper'],
  body: {
    type: 'object',
    properties: commonInputProperties,
    examples: [
      {
        url: 'https://maps.app.goo.gl/q5Q1NgmEvVk1a86a9',
        maxReviews: 5,
        language: 'id',
        personalData: true,
        sortBy: 'newest',
      },
    ],
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            businessName: { type: 'string' },
            placeUrl: { type: 'string' },
            totalScraped: { type: 'integer' },
            reviews: {
              type: 'array',
              items: reviewItemSchema,
            },
          },
        },
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              businessName: { type: 'string' },
              placeUrl: { type: 'string' },
              totalScraped: { type: 'integer' },
              reviews: {
                type: 'array',
                items: reviewItemSchema,
              },
            },
          },
        },
      },
    },
    400: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error: { type: 'string' },
      },
    },
    500: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error: { type: 'string' },
      },
    },
  },
};

export const scrapeFullSchema = {
  description: 'Scrape both Google Business Profile metadata and reviews (synchronous)',
  tags: ['Scraper'],
  body: {
    type: 'object',
    properties: commonInputProperties,
    examples: [
      {
        url: 'https://maps.app.goo.gl/q5Q1NgmEvVk1a86a9',
        maxReviews: 5,
        language: 'id',
        personalData: true,
      },
    ],
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            profile: profileResponseSchema,
            totalReviewsScraped: { type: 'integer' },
            reviews: {
              type: 'array',
              items: reviewItemSchema,
            },
          },
        },
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              profile: profileResponseSchema,
              totalReviewsScraped: { type: 'integer' },
              reviews: {
                type: 'array',
                items: reviewItemSchema,
              },
            },
          },
        },
      },
    },
    400: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error: { type: 'string' },
      },
    },
    500: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error: { type: 'string' },
      },
    },
  },
};

export const scrapeApifyPlacesSchema = {
  description: 'Apify compass/crawler-google-places (nwua9Gu5YrADL7ZDj) compatible endpoint returning exact Apify dataset items',
  tags: ['Apify Compatible'],
  body: {
    type: 'object',
    properties: commonInputProperties,
    examples: [
      {
        startUrls: [{ url: 'https://maps.app.goo.gl/q5Q1NgmEvVk1a86a9' }],
        maxReviews: 10,
        reviewsSort: 'newest',
        language: 'id',
        scrapeReviewsPersonalData: true,
        oneReviewPerRow: false,
      },
    ],
  },
};

export const createJobSchema = {
  description: 'Create an asynchronous background scraping job (recommended for large review counts)',
  tags: ['Jobs'],
  body: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['profile', 'reviews', 'full', 'apify'], default: 'full' },
      ...commonInputProperties,
    },
  },
  response: {
    202: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        jobId: { type: 'string' },
        status: { type: 'string' },
        checkUrl: { type: 'string' },
        createdAt: { type: 'string' },
      },
    },
  },
};

export const getJobStatusSchema = {
  description: 'Check status and get results of an asynchronous scraping job',
  tags: ['Jobs'],
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', description: 'Job ID' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        jobId: { type: 'string' },
        type: { type: 'string' },
        status: { type: 'string', enum: ['queued', 'running', 'completed', 'failed'] },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' },
        error: { type: 'string', nullable: true },
        result: { type: 'object', additionalProperties: true, nullable: true },
      },
    },
    404: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
  },
};
