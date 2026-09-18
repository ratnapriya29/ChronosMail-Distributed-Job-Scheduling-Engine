import { redisClient } from '../config/redis.js';
import { env } from '../config/env.js';

export interface RateLimitCheckResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  delayUntilNextHourMs?: number;
  key: string;
}

export class RateLimiterService {
  /**
   * Generates the Redis key for the current UTC hour window:
   * rate_limit:{sender_id}:{YYYY-MM-DD-HH}
   */
  static getHourWindowKey(senderId: string, date = new Date()): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hour = String(date.getUTCHours()).padStart(2, '0');
    const window = `${year}-${month}-${day}-${hour}`;
    return `rate_limit:${senderId}:${window}`;
  }

  /**
   * Calculates milliseconds remaining until the beginning of the next UTC hour window.
   * Adds a small 1000ms buffer to ensure the clock has flipped into the new window.
   */
  static getMillisUntilNextHour(date = new Date()): number {
    const nextHour = new Date(date);
    nextHour.setUTCHours(date.getUTCHours() + 1, 0, 0, 0);
    const diff = nextHour.getTime() - date.getTime();
    return Math.max(diff + 1000, 5000); // minimum 5s safe delay
  }

  /**
   * Atomically checks and increments the sender's hourly counter using Redis.
   * If limit is exceeded, counter is decremented back, and allowed is false.
   */
  static async checkAndIncrement(
    senderId: string,
    customLimit?: number
  ): Promise<RateLimitCheckResult> {
    const limit = customLimit || env.QUEUE.maxEmailsPerHourPerSender;
    const key = this.getHourWindowKey(senderId);

    try {
      // Atomic increment
      const count = await redisClient.incr(key);

      // On first increment in this window, set TTL of 2 hours (7200s)
      if (count === 1) {
        await redisClient.expire(key, 7200);
      }

      if (count > limit) {
        // Decrement back so this delayed attempt does not artificially consume a slot
        await redisClient.decr(key);
        const delayUntilNextHourMs = this.getMillisUntilNextHour();

        return {
          allowed: false,
          currentCount: count - 1,
          limit,
          delayUntilNextHourMs,
          key,
        };
      }

      return {
        allowed: true,
        currentCount: count,
        limit,
        key,
      };
    } catch (error: any) {
      console.error('[RateLimiter] Error during Redis checkAndIncrement:', error.message);
      // If Redis experiences temporary error, allow job or throw based on safety
      // In production, we log and proceed to avoid dropping jobs
      return {
        allowed: true,
        currentCount: 0,
        limit,
        key,
      };
    }
  }

  /**
   * Retrieve current count for a sender in the current hour window
   */
  static async getCurrentCount(senderId: string): Promise<{ count: number; limit: number; remaining: number }> {
    const limit = env.QUEUE.maxEmailsPerHourPerSender;
    const key = this.getHourWindowKey(senderId);
    const val = await redisClient.get(key);
    const count = val ? parseInt(val, 10) : 0;
    return {
      count,
      limit,
      remaining: Math.max(0, limit - count),
    };
  }

  /**
   * Reset rate limit for a sender (useful for testing and admin overrides)
   */
  static async resetRateLimit(senderId: string): Promise<void> {
    const key = this.getHourWindowKey(senderId);
    await redisClient.del(key);
  }
}
