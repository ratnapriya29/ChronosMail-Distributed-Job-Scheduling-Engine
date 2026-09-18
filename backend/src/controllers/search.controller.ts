import { Request, Response, NextFunction } from 'express';
import { ElasticsearchService } from '../services/elasticsearch.service.js';

export class SearchController {
  /**
   * Search emails via Elasticsearch across body, subject, recipient
   */
  static async search(req: Request, res: Response, next: NextFunction) {
    try {
      const query = (req.query.q as string) || '';
      const status = req.query.status as string | undefined;
      const sender = req.query.sender as string | undefined;
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '20', 10);

      const results = await ElasticsearchService.searchEmails({
        query,
        status,
        sender,
        page,
        limit,
      });

      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      next(error);
    }
  }
}
