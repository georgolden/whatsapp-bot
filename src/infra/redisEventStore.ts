import { createClient, type RedisClientType } from 'redis';
import type { Event, EventStore } from './coreTypes.js';

type StreamControl = {
  stream: Promise<void>;
  isRunning: () => boolean;
  stop: () => Promise<void>;
};

export class RedisEventStore implements EventStore {
  redis: RedisClientType;
  running: boolean = false;
  readonly consumerName: string;

  constructor(
    readonly streamName: string,
    readonly serviceName: string,
    redisUrl: string = 'redis://localhost:6379'
  ) {
    this.redis = createClient({ url: redisUrl });
    this.consumerName = `${this.serviceName}-${process.pid}`;
  }

  async ensureConnection(): Promise<void> {
    if (!this.redis.isOpen) {
      await this.redis.connect();
    }
  }

  async ensureConsumerGroup(): Promise<void> {
    await this.ensureConnection();
    try {
      await this.redis.xGroupCreate(this.streamName, this.serviceName, '0', {
        MKSTREAM: true
      });
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('BUSYGROUP')) {
        throw error;
      }
    }
  }

  async writeEvent(event: Event): Promise<string> {
    await this.ensureConnection();

    const eventData = {
      name: event.name,
      data: JSON.stringify(event.data),
      timestamp: event.timestamp || new Date().toISOString()
    };

    return await this.redis.xAdd(event.name, '*', eventData);
  }

  async processEvents(handler: (event: Event) => Promise<void>): Promise<StreamControl> {
    await this.ensureConsumerGroup();
    this.running = true;
    const readPromise = this.startReading(handler);
    return {
      stream: readPromise,
      isRunning: () => this.running,
      stop: async () => {
        this.running = false;
        await readPromise.catch(() => {});
      }
    };
  }

  private async startReading(handler: (event: Event) => Promise<void>): Promise<void> {
    while (this.running) {
      const streams = await this.redis.xReadGroup(
        this.serviceName,
        this.consumerName,
        { key: this.streamName, id: '>' },
        { COUNT: 1 }
      );

      if (!streams?.length) {
        continue;
      }

      const messages = streams[0].messages;
      if (!messages?.length) {
        continue;
      }

      for (const { id, message } of messages) {
        const event: Event = {
          id,
          name: message.name as string,
          data: JSON.parse(message.data as string),
          timestamp: message.timestamp as string
        };

        await handler(event);
        await this.redis.xAck(this.streamName, this.serviceName, id);
      }
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.redis.isOpen) {
      await this.redis.quit();
    }
  }
}
