import Redis from 'ioredis';
import { env } from './env.js';

// Configuration for BullMQ Redis connections
export const redisConnectionOptions = {
  host: env.REDIS.host,
  port: env.REDIS.port,
  password: env.REDIS.password,
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  retryStrategy(times: number) {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
};

// General-purpose Redis client for distributed counters and caching
export const redisClient = new Redis(redisConnectionOptions);

redisClient.on('connect', () => {
  console.log(`[Redis] Connected successfully to ${env.REDIS.host}:${env.REDIS.port}`);
});

redisClient.on('error', (err) => {
  console.error('[Redis] Connection error:', err.message);
});

export const checkRedisHealth = async (): Promise<boolean> => {
  try {
    const ping = await redisClient.ping();
    return ping === 'PONG';
  } catch {
    return false;
  }
};
