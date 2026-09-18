export type EmailStatus = 
  | 'PENDING' 
  | 'PROCESSING' 
  | 'SENT' 
  | 'FAILED' 
  | 'DELAYED_RATE_LIMIT';

export interface EmailJob {
  id: string;
  idempotencyKey: string;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  status: EmailStatus;
  scheduledAt: string;
  sentAt?: string | null;
  delayMs: number;
  etherealPreviewUrl?: string | null;
  errorMessage?: string | null;
  batchId?: string | null;
  createdAt: string;
  updatedAt: string;
  _score?: number;
}

export interface DashboardStats {
  scheduled: number;
  delayedRateLimit: number;
  sent: number;
  failed: number;
  rateLimit: {
    count: number;
    limit: number;
    remaining: number;
  };
}

export interface SearchResponse {
  items: EmailJob[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  source: 'elasticsearch' | 'postgresql_fallback';
}

export interface SlackStatus {
  connected: boolean;
  data: {
    channel?: string;
    hasWebhook: boolean;
    isActive: boolean;
  } | null;
}

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  slackConnected?: boolean;
}
