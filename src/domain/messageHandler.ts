import type { ChatMessage, SummaryCreatedEvent } from './types';
import type { EventStore, Client } from '../infra/coreTypes';
import type { YoutubeRequestRepository } from './requestRepository';
import { isValidYoutubeUrl } from './validateMessage';
import { STREAM_NAME } from './constants';

type Dependencies = {
  eventStore: EventStore;
  client: Client;
  youtubeRepository: YoutubeRequestRepository;
};

export const handleMessage = async (
  deps: Dependencies,
  chatMessage: ChatMessage
): Promise<any> => {
  try {
    const { chatId, message: url } = chatMessage;
    
    if (!isValidYoutubeUrl(url)) {
      return { info: 'Please send a valid YouTube video URL' };
    }

    // 1. Check if already processed
    const processed = await deps.youtubeRepository.getProcessedRequest(url);
    if (processed && processed.state === 'COMPLETED') {
        const transcription = await deps.youtubeRepository.getTranscription(url);
        return { chats: [chatId], data: transcription?.content };
    }

    // 2. Try to add to existing processing queue
    const existingId = await deps.youtubeRepository.addToProcessingQueue(url, chatId);
    if (existingId) {
      return { info: 'Your YouTube video is being processed. You will receive the summary when it\'s ready.' };
    }

    // 3. Create new request and emit event
    const requestId = await deps.youtubeRepository.createNewRequest(url, chatId);
    
    const event = {
      name: STREAM_NAME,
      meta: {
        requestId,
        url
      },
      data: {
        url
      }
    };

    await deps.eventStore.writeEvent(event);
    return { info: 'Your YouTube video is being processed. You will receive the summary when it\'s ready.' };
    
  } catch (error) {
    console.error('Error handling message:', error);
    return 'Sorry, there was an error processing your request.';
  }
}

export const handleOutEvent = async (
  deps: Dependencies,
  event: SummaryCreatedEvent
): Promise<any> => {
  const { meta: { request_id, url }, data: { summary } } = event;
  await deps.youtubeRepository.saveTranscription(url, summary);
  await deps.youtubeRepository.markAsCompleted(request_id);
  const chats = await deps.youtubeRepository.getWaitingChats(request_id);
  deps.client.emit('response', { chats, data: summary });
}
