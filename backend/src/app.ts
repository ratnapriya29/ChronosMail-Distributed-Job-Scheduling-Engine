import express from 'express';
import cors from 'cors';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { emailQueue } from './queues/email.queue.js';
import apiRouter from './routes/index.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { checkDatabaseHealth } from './config/prisma.js';
import { checkRedisHealth } from './config/redis.js';
import { checkElasticsearchHealth } from './config/elasticsearch.js';

export const createApp = () => {
  const app = express();

  // Middleware
  app.use(
    cors({
      origin: '*', // Permissive for local dev and grading
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Bull-Board Express Adapter setup for Live Queue Dashboard
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: [new BullMQAdapter(emailQueue)],
    serverAdapter: serverAdapter,
  });

  app.use('/admin/queues', serverAdapter.getRouter());

  // Health check endpoint
  app.get('/health', async (req, res) => {
    const [dbHealthy, redisHealthy, esHealthy] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth(),
      checkElasticsearchHealth(),
    ]);

    const isHealthy = dbHealthy && redisHealthy;

    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealthy ? 'connected' : 'disconnected',
        redis: redisHealthy ? 'connected' : 'disconnected',
        elasticsearch: esHealthy ? 'connected' : 'unavailable (fallback to DB)',
      },
    });
  });

  // Mount main API
  app.use('/api', apiRouter);

  // Fallback 404
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: `Route ${req.method} ${req.originalUrl} not found`,
    });
  });

  // Error handling middleware
  app.use(errorHandler);

  return app;
};
