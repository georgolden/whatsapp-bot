import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from 'redis';
import { RedisEventStore } from './redisEventStore.js';
import type { Event } from './coreTypes.js';

const createRedisClient = () => {
    return createClient({
      url: 'redis://0.0.0.0:6379',
      disableOfflineQueue: true
    });
  };
  
  test('RedisEventStore Integration Tests', async (t) => {
    let redisClient: ReturnType<typeof createClient>;
    let eventStore: RedisEventStore;
  
    // Setup before each test
    t.beforeEach(async () => {
      redisClient = createRedisClient();
      await redisClient.connect();
      
      eventStore = new RedisEventStore(
        'transcriptions_created',  // stream name
        'test_service',           // service name
        'redis://0.0.0.0:6379'
      );
    });
  
    // Cleanup after each test
    t.afterEach(async () => {
      await redisClient.flushAll();
      await redisClient.quit();
      await eventStore.stop();
    });
  
    await t.test('should write and read event', async () => {
      const testEvent: Event = {
        id: 'test-id',
        name: 'transcriptions_created',
        data: { title: 'Test Title', content: 'Test Content' }
      };
  
      const msgId = await eventStore.writeEvent(testEvent);
      assert.ok(msgId, 'Should return message ID');
  
      const streams = await redisClient.xRead(
        [{ key: testEvent.name, id: '0' }],
        { COUNT: 1 }
      );
      
      assert.ok(streams, 'Should find written message');
      assert.equal(streams?.length, 1);
      assert.equal(streams[0].name, testEvent.name);
    });
  
    await t.test('should ensure consumer group creation', async () => {
      // Create group
      await eventStore.ensureConsumerGroup();
      // Second call should handle existing group
      await eventStore.ensureConsumerGroup();
  
      const groups = await redisClient.xInfoGroups(eventStore.streamName);
      assert.equal(groups.length, 1);
      assert.equal(groups[0].name, eventStore.serviceName);
    });
  
    await t.test('should process events', async () => {
      const processed: Event[] = [];
      const testEvent: Event = {
        id: 'test-id',
        name: 'transcriptions_created',
        data: { title: 'Test Title', content: 'Test Content' }
      };
  
      const processPromise = eventStore.processEvents(async (event) => {
        processed.push(event);
        eventStore.stop();
      });
  
      // Give consumer time to set up
      await new Promise(resolve => setTimeout(resolve, 100));
  
      await eventStore.writeEvent(testEvent);
      await processPromise;
  
      assert.equal(processed.length, 1);
      assert.deepEqual(processed[0].data, testEvent.data);
      assert.equal(processed[0].name, testEvent.name);
    });
  
    await t.test('should acknowledge processed events', async () => {
      const testEvent: Event = {
        id: 'test-id',
        name: 'transcriptions_created',
        data: { title: 'Test Title', content: 'Test Content' }
      };
  
      const processPromise = eventStore.processEvents(async () => {
        eventStore.stop();
      });
  
      await new Promise(resolve => setTimeout(resolve, 100));
      await eventStore.writeEvent(testEvent);
      await processPromise;
  
      const pending = await redisClient.xPendingRange(
        eventStore.streamName,
        eventStore.serviceName,
        '-',
        '+',
        10
      );
  
      assert.equal(pending.length, 0, 'Should have no pending messages');
    });
  
    await t.test('should handle handler errors', async () => {
      const testEvent: Event = {
        name: 'transcriptions_created',
        data: { title: 'Test Title', content: 'Test Content' }
      };
  
      await eventStore.writeEvent(testEvent);
  
      await assert.rejects(
        eventStore.processEvents(async () => {
          throw new Error('Handler failed');
        }),
        /Handler failed/
      );
    });
  
    await t.test('should handle multiple consumers in group', async () => {
      const eventStore2 = new RedisEventStore(
        'transcriptions_created',
        'test_service',
        'redis://0.0.0.0:6379'
      );
  
      const processed1: Event[] = [];
      const processed2: Event[] = [];
  
      const handler1 = async (event: Event) => {
        processed1.push(event);
        if (processed1.length + processed2.length === 5) {
          eventStore.stop();
          eventStore2.stop();
        }
      };
  
      const handler2 = async (event: Event) => {
        processed2.push(event);
        if (processed1.length + processed2.length === 5) {
          eventStore.stop();
          eventStore2.stop();
        }
      };
  
      const process1 = eventStore.processEvents(handler1);
      const process2 = eventStore2.processEvents(handler2);
  
      await new Promise(resolve => setTimeout(resolve, 100));
  
      const events: Event[] = Array.from({ length: 5 }, (_, i) => ({
        id: `test-${i}`,
        name: 'transcriptions_created',
        data: { count: i }
      }));
  
      for (const event of events) {
        await eventStore.writeEvent(event);
      }
  
      await Promise.race([
        Promise.all([process1, process2]),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 2000)
        )
      ]);
  
      const totalProcessed = processed1.length + processed2.length;
      assert.equal(totalProcessed, 5, 'All events should be processed');
    });
  
    await t.test('should handle large data', async () => {
      const largeData = { content: 'x'.repeat(1000000) }; // 1MB of data
      const largeEvent: Event = {
        id: 'large-id',
        name: 'transcriptions_created',
        data: largeData
      };
  
      const msgId = await eventStore.writeEvent(largeEvent);
      assert.ok(msgId, 'Should handle large data');
    });
  
    await t.test('should handle special characters', async () => {
      const specialEvent: Event = {
        id: 'special-id',
        name: 'transcriptions_created',
        data: { title: 'тест 测试 🚀 \n\t"\''}
      };
  
      const msgId = await eventStore.writeEvent(specialEvent);
      assert.ok(msgId, 'Should handle special characters');
  
      const processed: Event[] = [];
      const processPromise = eventStore.processEvents(async (event) => {
        processed.push(event);
        eventStore.stop();
      });
  
      await processPromise;
  
      assert.equal(processed.length, 1);
      assert.deepEqual(processed[0].data, specialEvent.data);
    });
  
    await t.test('should handle invalid JSON data', async () => {
      // Write invalid JSON directly to Redis
      await redisClient.xAdd(
        'transcriptions_created',
        '*',
        {
          name: 'transcriptions_created',
          data: 'invalid{json',
          timestamp: new Date().toISOString()
        }
      );
  
      await assert.rejects(
        eventStore.processEvents(async () => {
          eventStore.stop();
        }),
        SyntaxError
      );
    });
  });
