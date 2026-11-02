import type { FastifyPluginAsync } from 'fastify';
import { GBPScraper, type ScrapeOptions } from '../scrapers/gbpScraper.js';
import { jobManager, type JobType } from '../services/jobManager.js';
import { proxyManager } from '../services/proxyManager.js';
import {
  scrapeProfileSchema,
  scrapeReviewsSchema,
  scrapeFullSchema,
  scrapeApifyPlacesSchema,
  createJobSchema,
  getJobStatusSchema,
  getProxyStatsSchema,
} from '../schemas/openapiSchemas.js';

interface CommonRequestBody extends ScrapeOptions {
  type?: JobType;
}

const MISSING_TARGET_ERROR =
  'At least one of "url", "placeId", "startUrls", "placeIds", "query", or "searchStringsArray" must be specified.';

export const scrapeRoutes: FastifyPluginAsync = async (fastify) => {
  // Health check
  fastify.get(
    '/health',
    {
      schema: {
        description: 'Check service health status',
        tags: ['System'],
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              timestamp: { type: 'string' },
              actorCompatible: { type: 'string' },
            },
          },
        },
      },
    },
    async () => {
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        actorCompatible: 'compass/crawler-google-places (nwua9Gu5YrADL7ZDj)',
      };
    }
  );

  // Proxy pool health & statistics
  fastify.get(
    '/api/proxy/stats',
    { schema: getProxyStatsSchema },
    async () => {
      const stats = proxyManager.getStats();
      return { success: true, data: stats };
    }
  );

  // Sync: Scrape Profile
  fastify.post<{
    Body: CommonRequestBody;
  }>(
    '/api/scrape/profile',
    { schema: scrapeProfileSchema },
    async (request, reply) => {
      const body = request.body || {};
      const targets = GBPScraper.resolveTargets(body);
      if (targets.length === 0) {
        return reply.status(400).send({
          success: false,
          error: MISSING_TARGET_ERROR,
        });
      }

      try {
        const result = await GBPScraper.scrapeProfile(body);
        return reply.send({
          success: true,
          data: result.data,
          results: result.results,
        });
      } catch (err: any) {
        request.log.error(err);
        return reply.status(500).send({
          success: false,
          error: err.message || 'Error occurred while scraping profile.',
        });
      }
    }
  );

  // Sync: Scrape Reviews
  fastify.post<{
    Body: CommonRequestBody;
  }>(
    '/api/scrape/reviews',
    { schema: scrapeReviewsSchema },
    async (request, reply) => {
      const body = request.body || {};
      const targets = GBPScraper.resolveTargets(body);
      if (targets.length === 0) {
        return reply.status(400).send({
          success: false,
          error: MISSING_TARGET_ERROR,
        });
      }

      try {
        const result = await GBPScraper.scrapeReviews(body);
        return reply.send({
          success: true,
          data: result.data,
          results: result.results,
        });
      } catch (err: any) {
        request.log.error(err);
        return reply.status(500).send({
          success: false,
          error: err.message || 'Error occurred while scraping reviews.',
        });
      }
    }
  );

  // Sync: Scrape Full (Profile + Reviews)
  fastify.post<{
    Body: CommonRequestBody;
  }>(
    '/api/scrape/full',
    { schema: scrapeFullSchema },
    async (request, reply) => {
      const body = request.body || {};
      const targets = GBPScraper.resolveTargets(body);
      if (targets.length === 0) {
        return reply.status(400).send({
          success: false,
          error: MISSING_TARGET_ERROR,
        });
      }

      try {
        const result = await GBPScraper.scrapeFull(body);
        return reply.send({
          success: true,
          data: result.data,
          results: result.results,
        });
      } catch (err: any) {
        request.log.error(err);
        return reply.status(500).send({
          success: false,
          error: err.message || 'Error occurred while scraping full profile and reviews.',
        });
      }
    }
  );

  // Sync: Apify compass/crawler-google-places (nwua9Gu5YrADL7ZDj) Dataset Endpoint
  fastify.post<{
    Body: CommonRequestBody;
  }>(
    '/api/scrape/places',
    { schema: scrapeApifyPlacesSchema },
    async (request, reply) => {
      const body = request.body || {};
      const targets = GBPScraper.resolveTargets(body);
      if (targets.length === 0) {
        return reply.status(400).send({
          success: false,
          error: MISSING_TARGET_ERROR,
        });
      }

      try {
        const items = await GBPScraper.scrapeApifyDataset(body);
        return reply.send({
          success: true,
          actorId: 'nwua9Gu5YrADL7ZDj',
          actorName: 'compass/crawler-google-places',
          totalItems: items.length,
          data: items[0] ?? null,
          results: items,
        });
      } catch (err: any) {
        request.log.error(err);
        return reply.status(500).send({
          success: false,
          error: err.message || 'Error occurred while scraping Apify Google Places dataset.',
        });
      }
    }
  );

  // Direct Apify Actor v2 Run-Sync-Get-Dataset-Items Drop-In Endpoints
  const apifyRunSyncHandler = async (request: any, reply: any) => {
    const body: CommonRequestBody = request.body || {};
    const targets = GBPScraper.resolveTargets(body);
    if (targets.length === 0) {
      return reply.status(400).send({
        error: {
          type: 'invalid-input',
          message: MISSING_TARGET_ERROR,
        },
      });
    }

    try {
      const items = await GBPScraper.scrapeApifyDataset(body);
      return reply.send(items);
    } catch (err: any) {
      request.log.error(err);
      return reply.status(500).send({
        error: {
          type: 'actor-run-failed',
          message: err.message || 'Error occurred while running crawler-google-places.',
        },
      });
    }
  };

  fastify.post(
    '/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items',
    { schema: scrapeApifyPlacesSchema },
    apifyRunSyncHandler
  );

  fastify.post(
    '/v2/acts/nwua9Gu5YrADL7ZDj/run-sync-get-dataset-items',
    { schema: scrapeApifyPlacesSchema },
    apifyRunSyncHandler
  );

  // Async: Create Background Scraping Job
  fastify.post<{
    Body: CommonRequestBody;
  }>(
    '/api/scrape/jobs',
    { schema: createJobSchema },
    async (request, reply) => {
      const body = request.body || {};
      const { type = 'full', ...options } = body;
      const targets = GBPScraper.resolveTargets(options);
      if (targets.length === 0) {
        return reply.status(400).send({
          success: false,
          error: MISSING_TARGET_ERROR,
        });
      }

      const job = jobManager.createJob(type, options);

      return reply.status(202).send({
        success: true,
        jobId: job.id,
        status: job.status,
        checkUrl: `/api/scrape/jobs/${job.id}`,
        createdAt: job.createdAt,
      });
    }
  );

  // Async: Get Job Status
  fastify.get<{
    Params: { id: string };
  }>(
    '/api/scrape/jobs/:id',
    { schema: getJobStatusSchema },
    async (request, reply) => {
      const { id } = request.params;
      const job = jobManager.getJob(id);

      if (!job) {
        return reply.status(404).send({
          error: `Job with ID ${id} not found.`,
        });
      }

      return reply.send({
        jobId: job.id,
        type: job.type,
        status: job.status,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        error: job.error,
        result: job.result,
      });
    }
  );
};
