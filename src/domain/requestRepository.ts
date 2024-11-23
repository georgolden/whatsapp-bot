import { Pool } from 'pg';

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
    this.initializeTable().catch((err) => {
      console.error('Failed to initialize table:', err);
      process.exit(1);
    });
  }

  private async initializeTable(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS transcriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        url TEXT NOT NULL UNIQUE,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_transcriptions_url ON transcriptions(url);
    `);
  }

  async getTranscription(url: string): Promise<TranscriptionRecord | null> {
    const {
      rows: [transcription],
    } = await this.pool.query<TranscriptionRecord>(`SELECT * FROM transcriptions WHERE url = $1`, [
      url,
    ]);
    return transcription || null;
  }

  async saveTranscription(url: string, content: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO transcriptions (url, content, created_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (url) 
       DO UPDATE SET 
         content = EXCLUDED.content,
         created_at = CURRENT_TIMESTAMP
       WHERE transcriptions.content != EXCLUDED.content`,
      [url, content],
    );
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
