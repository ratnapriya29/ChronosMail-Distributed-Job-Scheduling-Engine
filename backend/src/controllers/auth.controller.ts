import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';

const googleLoginSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  avatar: z.string().optional(),
  googleId: z.string().optional(),
});

export class AuthController {
  /**
   * Login or sync user from Google OAuth credential
   */
  static async googleLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, name, avatar, googleId } = googleLoginSchema.parse(req.body);

      const user = await prisma.user.upsert({
        where: { email },
        update: {
          name: name || undefined,
          avatar: avatar || undefined,
          googleId: googleId || undefined,
        },
        create: {
          email,
          name: name || 'User',
          avatar: avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`,
          googleId: googleId || undefined,
        },
        include: {
          slackConfig: true,
        },
      });

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.avatar,
            slackConnected: Boolean(user.slackConfig?.isActive && user.slackConfig?.webhookUrl),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current demo user profile
   */
  static async getCurrentUser(req: Request, res: Response, next: NextFunction) {
    try {
      const email = 'demo@reachinbox.ai';
      const user = await prisma.user.upsert({
        where: { email },
        update: {},
        create: {
          id: 'demo-user-id',
          email,
          name: 'ReachInbox Demo Engineer',
          avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=reachinbox',
        },
        include: {
          slackConfig: true,
        },
      });

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.avatar,
            slackConnected: Boolean(user.slackConfig?.isActive && user.slackConfig?.webhookUrl),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
