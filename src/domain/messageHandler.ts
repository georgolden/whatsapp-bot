import type { ChatMessage, SummaryCreatedEvent } from './types';
import type { EventStore, Client } from '../infra/coreTypes';
import type { YoutubeRequestRepository } from './requestRepository';
import { isValidYoutubeUrl } from './validateMessage';
import { STREAM_NAME } from './constants';
import type { RedisClientType } from 'redis';

type Dependencies = {
  eventStore: EventStore;
  client: Client;
  youtubeRepository: YoutubeRequestRepository;
  cache: RedisClientType;
};

export const handleMessage = async (deps: Dependencies, chatMessage: ChatMessage): Promise<any> => {
  try {
    const { chatId, message: url } = chatMessage;
    console.log('Entered handler', chatMessage);

    if (!isValidYoutubeUrl(url)) {
      console.log('Invalid url', url);

      return { info: 'Please send a valid YouTube video URL' };
    }

    const event = {
      name: STREAM_NAME,
      meta: {
        url,
      },
      data: {
        url,
      },
    };
    await deps.cache.sAdd(url, chatId);
    await deps.eventStore.writeEvent(event);
    console.log('Event written', event);

    return {
      info: "Your YouTube video is being processed. You will receive the summary when it's ready.",
    };
  } catch (error) {
    console.error('Error handling message:', error);
    return 'Sorry, there was an error processing your request.';
  }
};

export const handleOutEvent = async (
  deps: Dependencies,
  event: SummaryCreatedEvent,
): Promise<any> => {
  console.log('Incoming event: ', event);
  const {
    meta: { url },
    data: { summary },
  } = event;
  await deps.youtubeRepository.saveTranscription(url, summary);
  const chats = await deps.cache.sPop(url, await deps.cache.sCard(url));
  deps.client.emit('response', { chats, data: summary });
  console.log('Summary emitted: ', { chats, summary });
};
