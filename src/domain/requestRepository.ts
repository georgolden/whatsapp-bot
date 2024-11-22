import { Pool, PoolClient } from 'pg';
import { randomUUID } from 'crypto';
import type { YoutubeAudioRequestState } from './types';

interface YoutubeRequestRecord {
  id: string;
  url: string;
  state: YoutubeAudioRequestState;
  created_at: Date;
  updated_at: Date;
  waiting_chats?: string[];
}

interface TranscriptionRecord {
  id: string;
  url: string;
  content: string;
  created_at: Date;
}

export class YoutubeRequestRepository {
  private pool: Pool;
  
  constructor(connectionUrl: string) {
    this.pool = new Pool({ connectionString: connectionUrl });
    this.initializeTable().catch(err => {
      console.error('Failed to initialize table:', err);
      process.exit(1);
    });
  }

  private async initializeTable(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS youtube_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        url TEXT NOT NULL UNIQUE,
        state TEXT NOT NULL CHECK (state IN ('PROCESSING', 'COMPLETED', 'FAILED')),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS waiting_chats (
        request_id UUID REFERENCES youtube_requests(id) ON DELETE CASCADE,
        chat_id TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (request_id, chat_id)
      );

      CREATE TABLE IF NOT EXISTS transcriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        url TEXT NOT NULL UNIQUE,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_request_url ON youtube_requests(url);
      CREATE INDEX IF NOT EXISTS idx_request_state ON youtube_requests(state);
      CREATE INDEX IF NOT EXISTS idx_transcriptions_url ON transcriptions(url);
    `);
  }

  private async withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getProcessedRequest(url: string): Promise<YoutubeRequestRecord | null> {
    const { rows: [request] } = await this.pool.query<YoutubeRequestRecord>(
      `SELECT * FROM youtube_requests 
       WHERE url = $1 AND state = 'COMPLETED'`,
      [url]
    );
    return request || null;
  }

  async addToProcessingQueue(url: string, chatId: string): Promise<string | null> {
    return this.withTransaction(async (client) => {
      const { rows: [request] } = await client.query<{ id: string }>(
        `SELECT id FROM youtube_requests 
         WHERE url = $1 AND state = 'PROCESSING'`,
        [url]
      );

      if (!request) return null;

      await client.query(
        `INSERT INTO waiting_chats (request_id, chat_id)
         VALUES ($1, $2)
         ON CONFLICT (request_id, chat_id) DO NOTHING`,
        [request.id, chatId]
      );

      return request.id;
    });
  }

  async createNewRequest(url: string, chatId: string): Promise<string> {
    return this.withTransaction(async (client) => {
      const { rows: [existing] } = await client.query(
        `SELECT id FROM youtube_requests WHERE url = $1`,
        [url]
      );

      if (existing) {
        throw new Error('Request already exists');
      }

      const requestId = randomUUID();

      await client.query(
        `INSERT INTO youtube_requests (id, url, state)
         VALUES ($1, $2, 'PROCESSING')`,
        [requestId, url]
      );

      await client.query(
        `INSERT INTO waiting_chats (request_id, chat_id)
         VALUES ($1, $2)`,
        [requestId, chatId]
      );

      return requestId;
    });
  }

  async getWaitingChats(requestId: string): Promise<string[]> {
    const { rows } = await this.pool.query<{ chat_id: string }>(
      `SELECT chat_id FROM waiting_chats WHERE request_id = $1`,
      [requestId]
    );
    return rows.map(row => row.chat_id);
  }

  async removeFromWaitingQueue(requestId: string): Promise<string[]> {
    return this.withTransaction(async (client) => {
      const { rows } = await client.query<{ chat_id: string }>(
        `DELETE FROM waiting_chats 
         WHERE request_id = $1
         RETURNING chat_id`,
        [requestId]
      );
      return rows.map(row => row.chat_id);
    });
  }

  async markAsCompleted(id: string): Promise<string[]> {
    return this.withTransaction(async (client) => {
      await client.query(
        `UPDATE youtube_requests 
         SET state = 'COMPLETED', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [id]
      );
      return this.removeFromWaitingQueue(id);
    });
  }

  async markAsFailed(id: string): Promise<string[]> {
    return this.withTransaction(async (client) => {
      await client.query(
        `UPDATE youtube_requests 
         SET state = 'FAILED', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [id]
      );
      return this.removeFromWaitingQueue(id);
    });
  }

  async getRequestByUrl(url: string): Promise<YoutubeRequestRecord | null> {
    const { rows: [request] } = await this.pool.query<YoutubeRequestRecord>(
      `SELECT r.*, array_agg(w.chat_id) as waiting_chats
       FROM youtube_requests r
       LEFT JOIN waiting_chats w ON r.id = w.request_id
       WHERE r.url = $1
       GROUP BY r.id`,
      [url]
    );
    
    return request || null;
  }

  async getTranscription(url: string): Promise<TranscriptionRecord | null> {
    const { rows: [transcription] } = await this.pool.query<TranscriptionRecord>(
      `SELECT * FROM transcriptions WHERE url = $1`,
      [url]
    );
    return transcription || null;
  }

  async saveTranscription(url: string, content: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO transcriptions (url, content)
       VALUES ($1, $2)
       ON CONFLICT (url) DO UPDATE SET content = EXCLUDED.content`,
      [url, content]
    );
  }

  async getUrlByRequestId(requestId: string): Promise<string | null> {
    const { rows: [request] } = await this.pool.query<{ url: string }>(
      `SELECT url FROM youtube_requests WHERE id = $1`,
      [requestId]
    );
    return request?.url || null;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
