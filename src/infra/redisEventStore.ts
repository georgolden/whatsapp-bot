  import { createClient, type RedisClientType } from 'redis';
  import type { Event, EventStore } from './coreTypes.js';
  
  type RedisMessage = {
    id: string;
    message: Record<string, string>;
  };
  
  type RedisStreamResponse = {
    name: string;
    messages: RedisMessage[];
  }[];
  
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
  
    async ensureConsumerGroup(): Promise<void> {
      try {
        if (!this.redis.isOpen) {
          await this.redis.connect();
        }
  
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
      if (!this.redis.isOpen) {
        await this.redis.connect();
      }
  
      const eventData = {
        name: event.name,
        data: JSON.stringify(event.data),
        timestamp: event.timestamp || new Date().toISOString()
      };
  
      try {
        const messageId = await this.redis.xAdd(event.name, '*', eventData);
        return messageId;
      } catch (error) {
        console.error('Failed to write event:', error);
        throw error;
      }
    }
  
    async processEvents(handler: (event: Event) => Promise<void>): Promise<void> {
      await this.ensureConsumerGroup();
      this.running = true;
  
      while (this.running) {
        try {
          const streams = await this.redis.xReadGroup(
            this.serviceName,
            this.consumerName,
            { key: this.streamName, id: '>' },
            { COUNT: 1, BLOCK: 5000 }
          ) as RedisStreamResponse;
  
          if (!streams || !streams.length) {
            continue;
          }
  
          const stream = streams[0];
          if (!stream.messages.length) {
            continue;
          }
  
          for (const { id, message } of stream.messages) {
            try {
              const event: Event = {
                id,
                name: message.name,
                data: JSON.parse(message.data),
                timestamp: message.timestamp
              };
  
              await handler(event);
              await this.redis.xAck(this.streamName, this.serviceName, id);
            } catch (error) {
              console.error('Error processing event:', error);
              throw error;
            }
          }
        } catch (error) {
          this.running = false;
          console.error('Error in event processing loop:', error);
          throw error;
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
