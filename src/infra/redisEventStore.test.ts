import test from 'node:test';
import assert from 'node:assert/strict';
import { RedisEventStore } from './redisEventStore.js';
import type { Event } from './coreTypes.js';

test('RedisEventStore Integration Tests', async (t) => {
  let eventStore: RedisEventStore;
  const streamName = 'test_stream';

  t.before(async () => {
    eventStore = new RedisEventStore(
      'test_service',
      'redis://0.0.0.0:6379'
    );
    await eventStore.ensureConnection();
  });

  t.after(async () => {
    await eventStore.stop();
  });

  await t.test('should process single event', async () => {
    const processed: Event[] = [];
    let resolveProcessing: () => void;
    const processingDone = new Promise<void>(resolve => {
      resolveProcessing = resolve;
    });
    // Get the read promise
    const { stop } = await eventStore.processEvents(streamName, async (event) => {
      processed.push(event);
      resolveProcessing();
    });
    const testEvent: Event = {
      name: 'test_stream',
      meta: null,
      data: { title: 'Test Title', content: 'Test Content' }
    };

    await eventStore.writeEvent(testEvent);
    await processingDone;
    await stop();
    assert.equal(processed.length, 1);
    assert.deepEqual(processed[0].data, testEvent.data);
  });

  await t.test('should handle multiple events', async () => {
    const processed: Event[] = [];
    const totalEvents = 5;

    let resolveProcessing: () => void;
    const processingDone = new Promise<void>(resolve => {
      resolveProcessing = resolve;
    });

    const { stream, stop } = await eventStore.processEvents(streamName, async (event) => {
      processed.push(event);
      if (processed.length === totalEvents) {
        resolveProcessing();
      }
    });

    // Write events
    for (let i = 0; i < totalEvents; i++) {
      await eventStore.writeEvent({
        name: 'test_stream',
        meta: null,
        data: { count: i }
      });
    }

    await processingDone;
    await stop(); // Graceful shutdown of this stream

    assert.equal(processed.length, totalEvents);
});

await t.test('should handle handler errors', async () => {
  await eventStore.writeEvent({
    name: 'test_stream',
    meta: null,
    data: { test: 'data' }
  });

  const { stream, stop } = await eventStore.processEvents(streamName, async () => {
    throw new Error('Handler failed');
  });

  await assert.rejects(
    async () => await stream,  // Changed this line to properly await the promise
    {
      name: 'Error',
      message: 'Handler failed'
    }
  );
  await stop();
});
});
