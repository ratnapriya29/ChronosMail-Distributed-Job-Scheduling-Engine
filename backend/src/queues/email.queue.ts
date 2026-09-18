import { Queue, JobsOptions } from 'bullmq';
import { redisConnectionOptions } from '../config/redis.js';
import { env } from '../config/env.js';
import type { EmailJobData } from '../types/index.js';

export const emailQueue = new Queue<EmailJobData>(env.QUEUE.name, {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      count: 1000,
    },
    removeOnFail: {
      count: 5000,
    },
  },
});

/**
 * Helper to add a delayed or immediate email job to BullMQ
 */
export const addEmailJob = async (
  data: EmailJobData,
  delayMs = 0,
  customJobId?: string
) => {
  const options: JobsOptions = {
    delay: Math.max(0, delayMs),
    jobId: customJobId || data.emailJobId,
  };

  const job = await emailQueue.add('sendEmail', data, options);
  return job;
};
