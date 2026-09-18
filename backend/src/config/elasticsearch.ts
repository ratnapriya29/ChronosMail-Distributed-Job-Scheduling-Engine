import { Client } from '@elastic/elasticsearch';
import { env } from './env.js';

export const esClient = new Client({
  node: env.ELASTICSEARCH.node,
  maxRetries: 3,
  requestTimeout: 4000,
  sniffOnStart: false,
});

let esAvailable = false;

export const isElasticsearchAvailable = () => esAvailable;

export const checkElasticsearchHealth = async (): Promise<boolean> => {
  try {
    const health = await esClient.ping();
    esAvailable = Boolean(health);
    return esAvailable;
  } catch (err: any) {
    esAvailable = false;
    return false;
  }
};
