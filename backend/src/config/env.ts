import dotenv from 'dotenv';
import path from 'path';

// Load .env from backend directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',

  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgrespassword@localhost:5432/reachinbox_scheduler?schema=public',

  REDIS: {
    url: process.env.REDIS_URL || undefined,
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  ELASTICSEARCH: {
    node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
    index: process.env.ELASTICSEARCH_INDEX || 'reachinbox_emails',
  },

  QUEUE: {
    name: 'email-scheduler-queue',
    workerConcurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
    providerThrottleDelayMs: parseInt(process.env.PROVIDER_THROTTLE_DELAY_MS || '2000', 10),
    maxEmailsPerHourPerSender: parseInt(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || '5', 10),
  },

  SLACK: {
    defaultWebhookUrl: process.env.SLACK_DEFAULT_WEBHOOK_URL || '',
    clientId: process.env.SLACK_CLIENT_ID || '',
    clientSecret: process.env.SLACK_CLIENT_SECRET || '',
    redirectUri: process.env.SLACK_REDIRECT_URI || 'http://localhost:5000/api/slack/oauth/callback',
  },

 ETHEREAL: {
  user: process.env.ETHEREAL_USER || '',
  pass: process.env.ETHEREAL_PASS || '',
},
};
