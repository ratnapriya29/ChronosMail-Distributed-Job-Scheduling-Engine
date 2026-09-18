import { esClient, isElasticsearchAvailable, checkElasticsearchHealth } from '../config/elasticsearch.js';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import type { EmailJob } from '@prisma/client';

export class ElasticsearchService {
  private static index = env.ELASTICSEARCH.index;

  /**
   * Initializes the Elasticsearch index with appropriate analyzer and mappings
   */
  static async initIndex(): Promise<boolean> {
    const available = await checkElasticsearchHealth();
    if (!available) {
      console.warn('[Elasticsearch] Server unreachable. Search operations will fall back to PostgreSQL.');
      return false;
    }

    try {
      const exists = await esClient.indices.exists({ index: this.index });
      if (!exists) {
        console.log(`[Elasticsearch] Creating index '${this.index}'...`);
        await esClient.indices.create({
          index: this.index,
          mappings: {
            properties: {
              id: { type: 'keyword' },
              idempotencyKey: { type: 'keyword' },
              sender: { type: 'keyword' },
              recipient: {
                type: 'text',
                fields: {
                  keyword: { type: 'keyword', ignore_above: 256 },
                },
              },
              subject: { type: 'text' },
              body: { type: 'text' },
              status: { type: 'keyword' },
              scheduledAt: { type: 'date' },
              sentAt: { type: 'date' },
              etherealPreviewUrl: { type: 'keyword' },
              createdAt: { type: 'date' },
            },
          },
        });
        console.log(`[Elasticsearch] Index '${this.index}' ready.`);
      }
      return true;
    } catch (error: any) {
      console.error('[Elasticsearch] Error initializing index:', error.message);
      return false;
    }
  }

  /**
   * Index or upsert an email job document
   */
  static async indexEmail(job: Partial<EmailJob>): Promise<void> {
    if (!isElasticsearchAvailable()) return;

    try {
      await esClient.update({
        index: this.index,
        id: job.id!,
        doc: {
          id: job.id,
          idempotencyKey: job.idempotencyKey,
          sender: job.sender,
          recipient: job.recipient,
          subject: job.subject,
          body: job.body,
          status: job.status,
          scheduledAt: job.scheduledAt ? new Date(job.scheduledAt).toISOString() : undefined,
          sentAt: job.sentAt ? new Date(job.sentAt).toISOString() : undefined,
          etherealPreviewUrl: job.etherealPreviewUrl,
          createdAt: job.createdAt ? new Date(job.createdAt).toISOString() : undefined,
        },
        doc_as_upsert: true,
      });
    } catch (error: any) {
      console.warn(`[Elasticsearch] Could not index email ${job.id}:`, error.message);
    }
  }

  /**
   * Update the status and sent fields of an existing email document
   */
  static async updateEmailStatus(
    id: string,
    data: {
      status: string;
      sentAt?: Date;
      etherealPreviewUrl?: string | null;
      errorMessage?: string | null;
    }
  ): Promise<void> {
    if (!isElasticsearchAvailable()) return;

    try {
      await esClient.update({
        index: this.index,
        id,
        doc: {
          status: data.status,
          sentAt: data.sentAt ? data.sentAt.toISOString() : undefined,
          etherealPreviewUrl: data.etherealPreviewUrl,
          errorMessage: data.errorMessage,
        },
      });
    } catch (error: any) {
      console.warn(`[Elasticsearch] Could not update email status for ${id}:`, error.message);
    }
  }

  /**
   * Fulltext search across recipient, subject, and body text with pagination
   */
  static async searchEmails(params: {
    query?: string;
    status?: string;
    sender?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const from = (page - 1) * limit;

    // Check if Elasticsearch is available; if not, gracefully use database search fallback
    if (!isElasticsearchAvailable()) {
      return this.searchDatabaseFallback(params);
    }

    try {
      const mustClauses: any[] = [];
      const filterClauses: any[] = [];

      if (params.query && params.query.trim()) {
        mustClauses.push({
          multi_match: {
            query: params.query.trim(),
            fields: ['recipient^3', 'subject^2', 'body'],
            fuzziness: 'AUTO',
          },
        });
      } else {
        mustClauses.push({ match_all: {} });
      }

      if (params.status) {
        filterClauses.push({ term: { status: params.status } });
      }

      if (params.sender) {
        filterClauses.push({ term: { sender: params.sender } });
      }

      const response = await esClient.search({
        index: this.index,
        from,
        size: limit,
        sort: [{ scheduledAt: { order: 'desc' } }],
        query: {
          bool: {
            must: mustClauses,
            filter: filterClauses,
          },
        },
      });

      const total = typeof response.hits.total === 'number' 
        ? response.hits.total 
        : (response.hits.total?.value || 0);

      const items = response.hits.hits.map((hit: any) => ({
        ...hit._source,
        _score: hit._score,
      }));

      return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        source: 'elasticsearch',
      };
    } catch (error: any) {
      console.error('[Elasticsearch] Search query failed, falling back to DB:', error.message);
      return this.searchDatabaseFallback(params);
    }
  }

  /**
   * Resilient fallback to PostgreSQL full search when Elasticsearch is not running
   */
  private static async searchDatabaseFallback(params: {
    query?: string;
    status?: string;
    sender?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (params.status) {
      where.status = params.status;
    }

    if (params.sender) {
      where.sender = params.sender;
    }

    if (params.query && params.query.trim()) {
      const q = params.query.trim();
      where.OR = [
        { recipient: { contains: q, mode: 'insensitive' } },
        { subject: { contains: q, mode: 'insensitive' } },
        { body: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.emailJob.count({ where }),
      prisma.emailJob.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledAt: 'desc' },
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      source: 'postgresql_fallback',
    };
  }
}
