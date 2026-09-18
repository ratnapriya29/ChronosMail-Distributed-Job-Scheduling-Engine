import axios from 'axios';
import type { 
  EmailJob, 
  DashboardStats, 
  SearchResponse, 
  SlackStatus, 
  UserProfile 
} from '../types/index.ts';

const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
  // Emails
  async getScheduled(page = 1, limit = 50): Promise<{ items: EmailJob[]; total: number; totalPages: number }> {
    const res = await apiClient.get('/emails/scheduled', { params: { page, limit } });
    return res.data.data;
  },

  async getSent(page = 1, limit = 50): Promise<{ items: EmailJob[]; total: number; totalPages: number }> {
    const res = await apiClient.get('/emails/sent', { params: { page, limit } });
    return res.data.data;
  },

  async scheduleSingle(payload: {
    recipient: string;
    subject: string;
    body: string;
    sender?: string;
    scheduledAt?: string;
    delaySeconds?: number;
    idempotencyKey?: string;
  }) {
    const res = await apiClient.post('/emails/schedule', payload);
    return res.data;
  },

  async scheduleBatch(payload: {
    recipients: string[];
    subject: string;
    body: string;
    sender?: string;
    startTime?: string;
    delayBetweenEmailsSeconds?: number;
    hourlyLimitOverride?: number;
  }) {
    const res = await apiClient.post('/emails/schedule-batch', payload);
    return res.data;
  },

  async cancelEmail(id: string) {
    const res = await apiClient.delete(`/emails/${id}`);
    return res.data;
  },

  async getStats(sender = 'demo@reachinbox.ai'): Promise<DashboardStats> {
    const res = await apiClient.get('/emails/stats', { params: { sender } });
    return res.data.data;
  },

  async resetRateLimit(sender = 'demo@reachinbox.ai') {
    const res = await apiClient.post('/emails/reset-rate-limit', { sender });
    return res.data;
  },

  // Elasticsearch Search
  async searchEmails(query: string, status?: string, page = 1): Promise<SearchResponse> {
    const res = await apiClient.get('/search', {
      params: { q: query, status, page, limit: 20 },
    });
    return res.data.data;
  },

  // Slack Integration
  async getSlackStatus(): Promise<SlackStatus> {
    const res = await apiClient.get('/slack/status');
    return res.data;
  },

  async connectSlackWebhook(webhookUrl: string, channel?: string) {
    const res = await apiClient.post('/slack/connect', { webhookUrl, channel });
    return res.data;
  },

  async disconnectSlack() {
    const res = await apiClient.post('/slack/disconnect');
    return res.data;
  },

  async testSlackAlert() {
    const res = await apiClient.post('/slack/test');
    return res.data;
  },

  // Auth
  async getCurrentUser(): Promise<UserProfile> {
    const res = await apiClient.get('/auth/me');
    return res.data.data.user;
  },

  async googleLogin(profile: { email: string; name?: string; avatar?: string; googleId?: string }): Promise<UserProfile> {
    const res = await apiClient.post('/auth/google', profile);
    return res.data.data.user;
  },
};
