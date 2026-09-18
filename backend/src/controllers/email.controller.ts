import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { EmailService } from '../services/email.service.js';
import { RateLimiterService } from '../services/rateLimiter.service.js';

const scheduleSingleSchema = z.object({
  recipient: z.string().email('Invalid recipient email address'),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  sender: z.string().email().optional(),
  scheduledAt: z.string().optional(),
  delaySeconds: z.number().nonnegative().optional(),
  idempotencyKey: z.string().optional(),
});

const scheduleBatchSchema = z.object({
  recipients: z.array(z.string().email()).min(1, 'At least one recipient email is required'),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  sender: z.string().email().optional(),
  startTime: z.string().optional(),
  delayBetweenEmailsSeconds: z.number().min(0).max(3600).optional(),
  hourlyLimitOverride: z.number().positive().optional(),
});

export class EmailController {
  static async schedule(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = scheduleSingleSchema.parse(req.body);
      const userId = (req as any).user?.id;
      const result = await EmailService.scheduleSingleEmail(parsed, userId);

      res.status(result.isDuplicate ? 200 : 201).json({
        success: true,
        message: result.isDuplicate ? 'Duplicate request ignored (idempotent)' : 'Email scheduled successfully',
        data: result.job,
      });
    } catch (error) {
      next(error);
    }
  }

  static async scheduleBatch(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = scheduleBatchSchema.parse(req.body);
      const userId = (req as any).user?.id;
      const result = await EmailService.scheduleBatch(parsed, userId);

      res.status(201).json({
        success: true,
        message: `Successfully scheduled batch of ${result.totalScheduled} emails`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getScheduled(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '50', 10);
      const data = await EmailService.getScheduledEmails(page, limit);

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getSent(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '50', 10);
      const data = await EmailService.getSentEmails(page, limit);

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await EmailService.cancelScheduledEmail(id);

      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const sender = (req.query.sender as string) || 'demo@reachinbox.ai';
      const stats = await EmailService.getDashboardStats(sender);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  static async resetRateLimit(req: Request, res: Response, next: NextFunction) {
    try {
      const sender = (req.body.sender as string) || 'demo@reachinbox.ai';
      await RateLimiterService.resetRateLimit(sender);

      res.json({
        success: true,
        message: `Rate limit counter for sender ${sender} has been reset.`,
      });
    } catch (error) {
      next(error);
    }
  }
}
