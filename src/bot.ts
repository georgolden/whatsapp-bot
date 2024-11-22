import { WhatsAppClient } from './adapters/whatsapp.adapter';
import { YoutubeRequestRepository } from './domain/requestRepository';
import { RedisEventStore } from './infra/redisEventStore';
import { handleMessage, handleOutEvent } from './domain/messageHandler';
import { config } from './config';
import { ChatMessage } from './domain/types';
import { SERVICE_NAME, SUMMARY_STREAM } from './domain/constants';
import { createClient } from 'redis';

// Error handling
process.on('unhandledRejection', (error: Error) => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

const init = async () => {
  const whatsappClient = new WhatsAppClient();
  const eventStore = new RedisEventStore(SERVICE_NAME, config.REDIS_URL);
  const cache = createClient({ url: config.REDIS_URL });
  const dependencies = {
    youtubeRepository: new YoutubeRequestRepository(config.DATABASE_URL),
    eventStore,
    client: whatsappClient,
    cache,
  };
  await cache.connect();
  eventStore.processEvents(SUMMARY_STREAM, (event) => handleOutEvent(dependencies, event));
  whatsappClient.on('request', (req: ChatMessage) => handleMessage(dependencies, req));
  whatsappClient.start();
};

init().catch(error => {
  console.error('Failed to initialize application:', error);
  process.exit(1);
});
