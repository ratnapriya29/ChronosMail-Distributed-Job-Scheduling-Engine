import { Worker, Job } from 'bullmq';
import { redisConnectionOptions } from '../config/redis.js';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { RateLimiterService } from '../services/rateLimiter.service.js';
import { SlackService } from '../services/slack.service.js';
import { EtherealService } from '../services/ethereal.service.js';
import { ElasticsearchService } from '../services/elasticsearch.service.js';
import { emailQueue } from './email.queue.js';
import type { EmailJobData } from '../types/index.js';

/**
 * BullMQ Worker for Email Job processing with:
 * 1. Multi-worker safe atomic state transition
 * 2. Distributed hourly rate limiting via Redis atomic counters
 * 3. Graceful job rescheduling (never drops jobs)
 * 4. Real-time Slack rate-limit alerting
 * 5. Provider throttling delay (2000ms)
 * 6. Full synchronization with PostgreSQL and Elasticsearch
 */
export const startEmailWorker = () => {
  const worker = new Worker<EmailJobData>(
    env.QUEUE.name,
    async (job: Job<EmailJobData>) => {
      const { emailJobId, sender, recipient, subject, body, userId } = job.data;
      console.log(`[Worker] Picked up job ${job.id} (EmailJob ID: ${emailJobId}) for ${recipient}`);

      // 1. Atomic DB state transition to PROCESSING
      // Guarantees only one worker processes this job even during multi-worker races
      const lockResult = await prisma.emailJob.updateMany({
        where: {
          id: emailJobId,
          status: { in: ['PENDING', 'DELAYED_RATE_LIMIT'] },
        },
        data: {
          status: 'PROCESSING',
        },
      });

      if (lockResult.count === 0) {
        console.log(`[Worker] Job ${emailJobId} skipped (already processed or currently being handled).`);
        return { status: 'SKIPPED' };
      }

      // 2. Check distributed hourly rate limit
      const rateLimitCheck = await RateLimiterService.checkAndIncrement(sender);

      if (!rateLimitCheck.allowed) {
        const delayMs = rateLimitCheck.delayUntilNextHourMs || 3600000;
        const rescheduledAt = new Date(Date.now() + delayMs);

        console.warn(
          `[Worker] ⚠️ Rate limit exceeded for sender "${sender}" (${rateLimitCheck.currentCount}/${rateLimitCheck.limit}). Delaying job to next hour window (+${Math.round(delayMs / 1000)}s)...`
        );

        // Update DB status to DELAYED_RATE_LIMIT
        await prisma.emailJob.update({
          where: { id: emailJobId },
          data: {
            status: 'DELAYED_RATE_LIMIT',
            scheduledAt: rescheduledAt,
            errorMessage: `Hourly limit of ${rateLimitCheck.limit} reached. Rescheduled to next hour window.`,
          },
        });

        // Update Elasticsearch document
        await ElasticsearchService.updateEmailStatus(emailJobId, {
          status: 'DELAYED_RATE_LIMIT',
          errorMessage: `Hourly limit reached. Rescheduled to ${rescheduledAt.toISOString()}`,
        });

        // Reschedule in BullMQ with native delayed job without dropping
        const nextJob = await emailQueue.add('sendEmail', job.data, {
          delay: delayMs,
          jobId: `${emailJobId}-window-${rescheduledAt.getTime()}`,
        });

        await prisma.emailJob.update({
          where: { id: emailJobId },
          data: { bullJobId: nextJob.id },
        });

        // Trigger real-time Slack notification
        await SlackService.sendRateLimitAlert({
          senderId: sender,
          recipient,
          subject,
          limit: rateLimitCheck.limit,
          rescheduledAt,
          userId,
        });

        return {
          status: 'DELAYED_RATE_LIMIT',
          rescheduledAt: rescheduledAt.toISOString(),
          delayMs,
        };
      }

      // 3. Enforce intentional provider throttling delay
      if (env.QUEUE.providerThrottleDelayMs > 0) {
        console.log(`[Worker] Applying provider throttling delay (${env.QUEUE.providerThrottleDelayMs}ms)...`);
        await new Promise((resolve) => setTimeout(resolve, env.QUEUE.providerThrottleDelayMs));
      }

      // 4. Send email via Ethereal fake SMTP
      try {
        const sendResult = await EtherealService.sendEmail({
          from: sender,
          to: recipient,
          subject,
          text: body,
          html: `<div style="font-family: sans-serif; line-height: 1.6; color: #1e293b;">${body.replace(/\n/g, '<br/>')}</div>`,
        });

        const previewUrl = sendResult.previewUrl ? String(sendResult.previewUrl) : null;
        const sentAt = new Date();

        // 5. Update DB record to SENT
        await prisma.emailJob.update({
          where: { id: emailJobId },
          data: {
            status: 'SENT',
            sentAt,
            etherealPreviewUrl: previewUrl,
            errorMessage: null,
          },
        });

        // 6. Update Elasticsearch
        await ElasticsearchService.updateEmailStatus(emailJobId, {
          status: 'SENT',
          sentAt,
          etherealPreviewUrl: previewUrl,
        });

        console.log(`[Worker] ✅ Email ${emailJobId} sent to ${recipient}! Ethereal preview: ${previewUrl}`);

        return {
          status: 'SENT',
          messageId: sendResult.messageId,
          previewUrl,
        };
      } catch (sendError: any) {
        console.error(`[Worker] ❌ Failed to send email ${emailJobId}:`, sendError.message);

        // Update DB status to FAILED
        await prisma.emailJob.update({
          where: { id: emailJobId },
          data: {
            status: 'FAILED',
            errorMessage: sendError.message,
            retryCount: { increment: 1 },
          },
        });

        await ElasticsearchService.updateEmailStatus(emailJobId, {
          status: 'FAILED',
          errorMessage: sendError.message,
        });

        // Re-throw so BullMQ handles configured retries
        throw sendError;
      }
    },
    {
      connection: redisConnectionOptions,
      concurrency: env.QUEUE.workerConcurrency,
    }
  );

  worker.on('ready', () => {
    console.log(`[Worker] Email worker ready with concurrency = ${env.QUEUE.workerConcurrency}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed with error:`, err.message);
  });

  return worker;
};
