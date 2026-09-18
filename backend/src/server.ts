import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { redisClient } from './config/redis.js';
import { initEtherealTransporter } from './config/ethereal.js';
import { ElasticsearchService } from './services/elasticsearch.service.js';
import { RecoveryService } from './queues/recovery.service.js';
import { startEmailWorker } from './queues/email.worker.js';

const startServer = async () => {
  console.log('====================================================');
  console.log('  ReachInbox Distributed Email Job Scheduler Server');
  console.log('====================================================');

  try {
    // 1. Initialize Ethereal fake SMTP transporter
    console.log('[Startup] Initializing Ethereal test SMTP...');
    await initEtherealTransporter();

    // 2. Initialize Elasticsearch index if available
    console.log('[Startup] Setting up Elasticsearch schema...');
    await ElasticsearchService.initIndex();

    // 3. Run Crash / Server Restart Recovery Routine
    console.log('[Startup] Running job recovery routine against PostgreSQL & Redis...');
    await RecoveryService.recoverPendingJobs();

    // 4. Start BullMQ Email Worker
    console.log(`[Startup] Launching BullMQ worker pool (concurrency: ${env.QUEUE.workerConcurrency})...`);
    const worker = startEmailWorker();

    // 5. Start Express HTTP Server
    const app = createApp();
    const server = app.listen(env.PORT, () => {
      console.log(`[Server] HTTP server running on http://localhost:${env.PORT}`);
      console.log(`[Dashboard] BullMQ Dashboard mounted on http://localhost:${env.PORT}/admin/queues`);
      console.log(`[Health] Health check available on http://localhost:${env.PORT}/health`);
      console.log('====================================================');
    });

    // Graceful Shutdown Handler
    const shutdown = async (signal: string) => {
      console.log(`\n[Shutdown] Received ${signal}. Closing gracefully...`);
      server.close(async () => {
        console.log('[Shutdown] Closed HTTP server.');
        try {
          await worker.close();
          console.log('[Shutdown] Closed BullMQ worker.');
          await redisClient.quit();
          console.log('[Shutdown] Disconnected Redis.');
          await prisma.$disconnect();
          console.log('[Shutdown] Disconnected Prisma.');
          process.exit(0);
        } catch (err: any) {
          console.error('[Shutdown] Error during cleanup:', err.message);
          process.exit(1);
        }
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error: any) {
    console.error('[Startup] Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
