export type EmailStatus = 
  | 'PENDING' 
  | 'PROCESSING' 
  | 'SENT' 
  | 'FAILED' 
  | 'DELAYED_RATE_LIMIT';

export interface EmailJobData {
  emailJobId: string;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  userId?: string;
  scheduledAt: string;
  idempotencyKey: string;
  retryCount?: number;
}

export interface ScheduleEmailPayload {
  recipient: string;
  subject: string;
  body: string;
  sender?: string;
  scheduledAt?: string; // ISO string or empty for immediate
  delaySeconds?: number;
  idempotencyKey?: string;
}

export interface BatchSchedulePayload {
  recipients: string[];
  subject: string;
  body: string;
  sender?: string;
  startTime?: string;
  delayBetweenEmailsSeconds?: number;
  hourlyLimitOverride?: number;
}

export interface SearchQueryParams {
  query?: string;
  status?: string;
  sender?: string;
  page?: number;
  limit?: number;
}

export interface SlackWebhookPayload {
  webhookUrl: string;
  channel?: string;
  userId?: string;
}
