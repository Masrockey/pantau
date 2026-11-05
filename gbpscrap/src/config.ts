export const config = {
  port: Number(process.env.PORT) || 3016,
  host: process.env.HOST || '0.0.0.0',
  headless: process.env.HEADLESS !== 'false',
  defaultMaxReviews: Number(process.env.DEFAULT_MAX_REVIEWS) || 20,
  maxReviewsLimit: Number(process.env.MAX_REVIEWS_LIMIT) || 5000,
  navigationTimeoutSecs: Number(process.env.NAV_TIMEOUT_SECS) || 60,
  // Proxy configuration
  useProxy: process.env.USE_PROXY !== 'true', // Default to true
  proxyListUrl: process.env.PROXY_LIST_URL || 'https://cdn.jsdelivr.net/gh/proxyscrape/free-proxy-list@main/proxies/all/data.json',
  proxyRefreshIntervalMinutes: Number(process.env.PROXY_REFRESH_MINS) || 30,
  proxyPoolSize: Number(process.env.PROXY_POOL_SIZE) || 1000,
  maxRequestRetries: Number(process.env.MAX_REQUEST_RETRIES) || 5,
};

