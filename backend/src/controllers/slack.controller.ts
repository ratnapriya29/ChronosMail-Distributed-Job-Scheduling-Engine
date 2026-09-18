import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import axios from 'axios';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { SlackService } from '../services/slack.service.js';

const webhookConnectSchema = z.object({
  webhookUrl: z.string().url('Must be a valid Slack webhook URL (https://hooks.slack.com/...)'),
  channel: z.string().optional(),
  userId: z.string().optional(),
});

export class SlackController {
  /**
   * Save or update Slack webhook URL
   */
  static async connectWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const { webhookUrl, channel, userId } = webhookConnectSchema.parse(req.body);

      // Verify webhook with a test message
      await SlackService.sendTestAlert(webhookUrl);

      // If user provided or demo user
      const targetUserId = userId || 'demo-user-id';

      // Ensure demo user exists if not logged in
      await prisma.user.upsert({
        where: { id: targetUserId },
        update: {},
        create: {
          id: targetUserId,
          email: 'demo@reachinbox.ai',
          name: 'ReachInbox Demo User',
        },
      });

      const config = await prisma.slackConfig.upsert({
        where: { userId: targetUserId },
        update: {
          webhookUrl,
          channel: channel || '#reachinbox-alerts',
          isActive: true,
        },
        create: {
          userId: targetUserId,
          webhookUrl,
          channel: channel || '#reachinbox-alerts',
          isActive: true,
        },
      });

      res.json({
        success: true,
        message: 'Slack webhook connected successfully!',
        data: {
          id: config.id,
          channel: config.channel,
          isActive: config.isActive,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current Slack connection status
   */
  static async getStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req.query.userId as string) || 'demo-user-id';
      const activeConfig = await SlackService.getActiveConfig(userId);

      res.json({
        success: true,
        connected: Boolean(activeConfig && activeConfig.isActive),
        data: activeConfig ? {
          channel: activeConfig.channel || '#reachinbox-alerts',
          hasWebhook: Boolean(activeConfig.webhookUrl),
          isActive: activeConfig.isActive,
        } : null,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Disconnect Slack integration
   */
  static async disconnect(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req.body.userId as string) || 'demo-user-id';

      await prisma.slackConfig.updateMany({
        where: { userId },
        data: { isActive: false, webhookUrl: null },
      });

      res.json({
        success: true,
        message: 'Slack integration disconnected successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Trigger a live test alert to Slack
   */
  static async testAlert(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req.body.userId as string) || 'demo-user-id';
      const config = await SlackService.getActiveConfig(userId);

      if (!config?.webhookUrl) {
        return res.status(400).json({
          success: false,
          message: 'No active Slack webhook configured. Please connect Slack first.',
        });
      }

      await SlackService.sendTestAlert(config.webhookUrl);

      res.json({
        success: true,
        message: 'Test alert sent to your Slack channel!',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Redirect to Slack OAuth URL if credentials exist
   */
  static async oauthStart(req: Request, res: Response) {
    if (!env.SLACK.clientId) {
      return res.status(400).json({
        success: false,
        message: 'SLACK_CLIENT_ID not configured in backend environment.',
      });
    }

    const scope = 'incoming-webhook,chat:write';
    const slackUrl = `https://slack.com/oauth/v2/authorize?client_id=${env.SLACK.clientId}&scope=${scope}&redirect_uri=${encodeURIComponent(
      env.SLACK.redirectUri
    )}`;

    res.redirect(slackUrl);
  }

  /**
   * Slack OAuth callback handler
   */
  static async oauthCallback(req: Request, res: Response) {
    const code = req.query.code as string;
    if (!code) {
      return res.redirect(`${env.FRONTEND_URL}?slack_error=missing_code`);
    }

    try {
      const tokenResponse = await axios.post(
        'https://slack.com/api/oauth.v2.access',
        null,
        {
          params: {
            client_id: env.SLACK.clientId,
            client_secret: env.SLACK.clientSecret,
            code,
            redirect_uri: env.SLACK.redirectUri,
          },
        }
      );

      const data = tokenResponse.data;
      if (!data.ok) {
        console.error('[SlackOAuth] Error exchanging code:', data.error);
        return res.redirect(`${env.FRONTEND_URL}?slack_error=${data.error}`);
      }

      const webhookUrl = data.incoming_webhook?.url;
      const channel = data.incoming_webhook?.channel;
      const teamName = data.team?.name;

      if (webhookUrl) {
        await prisma.slackConfig.upsert({
          where: { userId: 'demo-user-id' },
          update: {
            webhookUrl,
            channel,
            teamName,
            accessToken: data.access_token,
            isActive: true,
          },
          create: {
            userId: 'demo-user-id',
            webhookUrl,
            channel,
            teamName,
            accessToken: data.access_token,
            isActive: true,
          },
        });
      }

      res.redirect(`${env.FRONTEND_URL}?slack_connected=true`);
    } catch (err: any) {
      console.error('[SlackOAuth] Error:', err.message);
      res.redirect(`${env.FRONTEND_URL}?slack_error=internal_error`);
    }
  }
}
