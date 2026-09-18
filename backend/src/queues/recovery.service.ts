import { prisma } from '../config/prisma.js';
import { emailQueue, addEmailJob } from './email.queue.js';
import type { EmailJobData } from '../types/index.js';

export class RecoveryService {
  /**
   * Scans PostgreSQL for any PENDING or DELAYED_RATE_LIMIT jobs that are missing
   * from Redis/BullMQ (e.g., after an unexpected server or Redis outage)
   * and safely re-enqueues them without duplication.
   */
  static async recoverPendingJobs(): Promise<{
    checked: number;
    recovered: number;
    alreadyPresent: number;
  }> {
    console.log('[Recovery] Initiating server restart recovery routine for pending email jobs...');

    let checked = 0;
    let recovered = 0;
    let alreadyPresent = 0;

    try {
      const pendingJobs = await prisma.emailJob.findMany({
        where: {
          status: {
            in: ['PENDING', 'DELAYED_RATE_LIMIT'],
          },
        },
      });

      checked = pendingJobs.length;
      console.log(`[Recovery] Found ${checked} pending/delayed jobs in database.`);

      for (const job of pendingJobs) {
        try {
          // Check BullMQ by bullJobId or default id
          const searchJobId = job.bullJobId || job.id;
          const existingBullJob = await emailQueue.getJob(searchJobId);

          if (existingBullJob) {
            const state = await existingBullJob.getState();
            if (state === 'delayed' || state === 'waiting' || state === 'active') {
              alreadyPresent++;
              continue;
            }
          }

          // Job is missing in BullMQ or in terminal state despite DB status
          const now = Date.now();
          const scheduledTime = new Date(job.scheduledAt).getTime();
          const remainingDelayMs = Math.max(0, scheduledTime - now);

          const jobData: EmailJobData = {
            emailJobId: job.id,
            sender: job.sender,
            recipient: job.recipient,
            subject: job.subject,
            body: job.body,
            userId: job.userId || undefined,
            scheduledAt: job.scheduledAt.toISOString(),
            idempotencyKey: job.idempotencyKey,
            retryCount: job.retryCount,
          };

          const newBullJob = await addEmailJob(jobData, remainingDelayMs, job.id);

          await prisma.emailJob.update({
            where: { id: job.id },
            data: { bullJobId: newBullJob.id },
          });

          recovered++;
          console.log(`[Recovery] Re-enqueued job ${job.id} for recipient ${job.recipient} with delay ${remainingDelayMs}ms.`);
        } catch (jobErr: any) {
          console.error(`[Recovery] Failed recovering job ${job.id}:`, jobErr.message);
        }
      }

      console.log(
        `[Recovery] Completed successfully: ${checked} checked, ${recovered} recovered, ${alreadyPresent} already active in Redis.`
      );

      return { checked, recovered, alreadyPresent };
    } catch (error: any) {
      console.error('[Recovery] Fatal error during recovery routine:', error.message);
      return { checked, recovered, alreadyPresent };
    }
  }
}
