import axios from 'axios';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';

export interface SlackRateLimitAlertOptions {
  senderId: string;
  recipient: string;
  subject: string;
  limit: number;
  rescheduledAt: Date;
  userId?: string;
}

export class SlackService {
  /**
   * Retrieves active Slack configuration for a user, or falls back to system default env webhook
   */
  static async getActiveConfig(userId?: string) {
    if (userId) {
      try {
        const config = await prisma.slackConfig.findUnique({
          where: { userId },
        });
        if (config && config.isActive && config.webhookUrl) {
          return config;
        }
      } catch (err: any) {
        console.warn('[SlackService] Error checking DB for Slack config:', err.message);
      }
    }

    // Fallback to system-level default webhook if set
    if (env.SLACK.defaultWebhookUrl) {
      return {
        webhookUrl: env.SLACK.defaultWebhookUrl,
        channel: '#reachinbox-alerts',
        isActive: true,
      };
    }

    return null;
  }

  /**
   * Post rate-limit alert to Slack.
   * If Slack is not configured or fails, it gracefully logs and does not crash.
   */
  static async sendRateLimitAlert(options: SlackRateLimitAlertOptions): Promise<boolean> {
    const config = await this.getActiveConfig(options.userId);

    if (!config || !config.webhookUrl) {
      console.log(`[SlackService] Slack alert skipped: No active webhook connected for sender ${options.senderId}.`);
      return false;
    }

    const payload = {
      text: `⚠️ Rate Limit Exceeded: Hourly limit (${options.limit}/hr) reached for ${options.senderId}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '⚠️ Email Hourly Rate Limit Reached',
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Sender *${options.senderId}* has reached the maximum configured threshold of *${options.limit} emails/hour*.`,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Target Recipient:*\n\`${options.recipient}\``,
            },
            {
              type: 'mrkdwn',
              text: `*Subject:*\n${options.subject}`,
            },
            {
              type: 'mrkdwn',
              text: `*Action Taken:*\nJob safely delayed to next window`,
            },
            {
              type: 'mrkdwn',
              text: `*Rescheduled Delivery:*\n<!date^${Math.floor(options.rescheduledAt.getTime() / 1000)}^{date_num} {time_secs}|${options.rescheduledAt.toISOString()}>`,
            },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `ReachInbox Distributed Queue Scheduler • ${new Date().toUTCString()}`,
            },
          ],
        },
      ],
    };

    try {
      await axios.post(config.webhookUrl, payload, { timeout: 5000 });
      console.log(`[SlackService] Rate limit alert successfully dispatched to Slack.`);
      return true;
    } catch (error: any) {
      console.error('[SlackService] Failed to dispatch Slack webhook alert:', error.message);
      return false;
    }
  }

  /**
   * Send test message to verify Slack webhook connectivity
   */
  static async sendTestAlert(webhookUrl: string): Promise<boolean> {
    const payload = {
      text: '🚀 ReachInbox Email Scheduler: Slack Webhook Connected Successfully!',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '✅ *ReachInbox Email Scheduler: Connection Verified*\nYour Slack channel is now connected and will receive real-time rate limit alerts.',
          },
        },
      ],
    };

    try {
      await axios.post(webhookUrl, payload, { timeout: 5000 });
      return true;
    } catch (error: any) {
      console.error('[SlackService] Test webhook failed:', error.message);
      throw new Error(`Failed to send message to Slack webhook: ${error.message}`);
    }
  }
}
