export type ChatMessage = {
    chatId: string;
    message: string;
  };
  
export type YoutubeAudioRequestData = {
  request_id: string;
  url: string;
};

export type YoutubeAudioRequestedEvent = {
  name: 'youtube_audio_requested';
  data: YoutubeAudioRequestData;
};

export type YoutubeAudioRequestState = 'PROCESSING' | 'COMPLETED' | 'FAILED';

export type SummaryCreatedEvent = {
  name: 'summary_created';
  meta: {
    request_id: string;
    url: string;
  };
  data: {
    title: string;
    summary: string;
  };
};
