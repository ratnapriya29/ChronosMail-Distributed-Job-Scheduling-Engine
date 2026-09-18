import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../config/prisma.js';
import { addEmailJob, emailQueue } from '../queues/email.queue.js';
import { ElasticsearchService } from './elasticsearch.service.js';
import { RateLimiterService } from './rateLimiter.service.js';
import type { 
  EmailJobData, 
  ScheduleEmailPayload, 
  BatchSchedulePayload 
} from '../types/index.js';

export class EmailService {
  /**
   * Schedule a single email with idempotency and native BullMQ delay
   */
  static async scheduleSingleEmail(payload: ScheduleEmailPayload, userId?: string) {
    const sender = payload.sender || 'demo@reachinbox.ai';
    const recipient = payload.recipient.trim();
    const subject = payload.subject.trim();
    const body = payload.body.trim();
    const idempotencyKey = payload.idempotencyKey || `single-${uuidv4()}`;

    // Calculate delay in milliseconds
    let delayMs = 0;
    let targetScheduledAt = new Date();

    if (payload.scheduledAt) {
      const scheduledTime = new Date(payload.scheduledAt).getTime();
      const now = Date.now();
      delayMs = Math.max(0, scheduledTime - now);
      targetScheduledAt = new Date(now + delayMs);
    } else if (payload.delaySeconds && payload.delaySeconds > 0) {
      delayMs = payload.delaySeconds * 1000;
      targetScheduledAt = new Date(Date.now() + delayMs);
    }

    // Check for existing idempotency key to prevent duplicates
    const existing = await prisma.emailJob.findUnique({
      where: { idempotencyKey },
    });

    if (existing) {
      console.log(`[EmailService] Idempotency match found for key ${idempotencyKey}, returning existing record.`);
      return {
        job: existing,
        isDuplicate: true,
      };
    }

    // 1. Persist record in PostgreSQL with PENDING state
    const emailJob = await prisma.emailJob.create({
      data: {
        idempotencyKey,
        userId: userId || null,
        sender,
        recipient,
        subject,
        body,
        status: 'PENDING',
        scheduledAt: targetScheduledAt,
        delayMs,
      },
    });

    // 2. Index in Elasticsearch immediately
    await ElasticsearchService.indexEmail(emailJob);

    // 3. Enqueue delayed job into BullMQ
    const jobData: EmailJobData = {
      emailJobId: emailJob.id,
      sender,
      recipient,
      subject,
      body,
      userId,
      scheduledAt: targetScheduledAt.toISOString(),
      idempotencyKey,
    };

    const bullJob = await addEmailJob(jobData, delayMs, emailJob.id);

    // Update job with BullMQ assigned ID
    const updatedJob = await prisma.emailJob.update({
      where: { id: emailJob.id },
      data: { bullJobId: bullJob.id },
    });

    return {
      job: updatedJob,
      isDuplicate: false,
    };
  }

  /**
   * Schedule a batch of leads (e.g. from parsed CSV/TXT) with staggered delays
   */
  static async scheduleBatch(payload: BatchSchedulePayload, userId?: string) {
    const sender = payload.sender || 'outreach@reachinbox.ai';
    const batchId = `batch-${uuidv4().substring(0, 8)}`;
    const delayBetweenMs = (payload.delayBetweenEmailsSeconds || 2) * 1000;

    let baseDelayMs = 0;
    if (payload.startTime) {
      const startMs = new Date(payload.startTime).getTime();
      baseDelayMs = Math.max(0, startMs - Date.now());
    }

    const results = [];

    for (let i = 0; i < payload.recipients.length; i++) {
      const recipient = payload.recipients[i].trim();
      if (!recipient) continue;

      const recipientDelayMs = baseDelayMs + (i * delayBetweenMs);
      const scheduledAt = new Date(Date.now() + recipientDelayMs);
      const idempotencyKey = `${batchId}-${recipient}-${i}`;

      // Create DB record
      const emailJob = await prisma.emailJob.create({
        data: {
          idempotencyKey,
          userId: userId || null,
          sender,
          recipient,
          subject: payload.subject,
          body: payload.body,
          status: 'PENDING',
          scheduledAt,
          delayMs: recipientDelayMs,
          batchId,
        },
      });

      // Index in Elasticsearch
      await ElasticsearchService.indexEmail(emailJob);

      // Enqueue to BullMQ
      const jobData: EmailJobData = {
        emailJobId: emailJob.id,
        sender,
        recipient,
        subject: payload.subject,
        body: payload.body,
        userId,
        scheduledAt: scheduledAt.toISOString(),
        idempotencyKey,
      };

      const bullJob = await addEmailJob(jobData, recipientDelayMs, emailJob.id);

      await prisma.emailJob.update({
        where: { id: emailJob.id },
        data: { bullJobId: bullJob.id },
      });

      results.push(emailJob);
    }

    return {
      batchId,
      totalScheduled: results.length,
      firstDelivery: results[0]?.scheduledAt,
      lastDelivery: results[results.length - 1]?.scheduledAt,
      jobs: results,
    };
  }

  /**
   * Fetch scheduled jobs (PENDING, DELAYED_RATE_LIMIT, PROCESSING)
   */
  static async getScheduledEmails(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const where = {
      status: {
        in: ['PENDING', 'DELAYED_RATE_LIMIT', 'PROCESSING'],
      },
    };

    const [total, items] = await Promise.all([
      prisma.emailJob.count({ where }),
      prisma.emailJob.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledAt: 'asc' },
      }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Fetch sent jobs (SENT, FAILED)
   */
  static async getSentEmails(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const where = {
      status: {
        in: ['SENT', 'FAILED'],
      },
    };

    const [total, items] = await Promise.all([
      prisma.emailJob.count({ where }),
      prisma.emailJob.findMany({
        where,
        skip,
        take: limit,
        orderBy: { sentAt: 'desc' },
      }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Cancel a scheduled email before it executes
   */
  static async cancelScheduledEmail(id: string) {
    const job = await prisma.emailJob.findUnique({ where: { id } });
    if (!job) throw new Error('Email job not found');

    if (job.status === 'SENT') {
      throw new Error('Cannot cancel an email that has already been sent');
    }

    // Remove from BullMQ
    if (job.bullJobId) {
      const bullJob = await emailQueue.getJob(job.bullJobId);
      if (bullJob) {
        await bullJob.remove();
      }
    }

    // Delete or update status
    await prisma.emailJob.delete({ where: { id } });

    // Update Elasticsearch
    await ElasticsearchService.updateEmailStatus(id, {
      status: 'CANCELLED',
    });

    return { success: true, message: 'Email job cancelled successfully' };
  }

  /**
   * Get dashboard summary statistics
   */
  static async getDashboardStats(sender = 'demo@reachinbox.ai') {
    const [scheduledCount, delayedRateLimitCount, sentCount, failedCount] = await Promise.all([
      prisma.emailJob.count({ where: { status: 'PENDING' } }),
      prisma.emailJob.count({ where: { status: 'DELAYED_RATE_LIMIT' } }),
      prisma.emailJob.count({ where: { status: 'SENT' } }),
      prisma.emailJob.count({ where: { status: 'FAILED' } }),
    ]);

    const rateLimitInfo = await RateLimiterService.getCurrentCount(sender);

    return {
      scheduled: scheduledCount,
      delayedRateLimit: delayedRateLimitCount,
      sent: sentCount,
      failed: failedCount,
      rateLimit: rateLimitInfo,
    };
  }
}
