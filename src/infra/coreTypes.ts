export interface Event<T = unknown> {
  id?: string;
  name: string;
  data: T;
  meta: any;
  timestamp?: string;
}

export interface EventStore {
  writeEvent(event: Event): Promise<string>;
  processEvents(streamName: string, handler: (event: Event) => Promise<any>): Promise<any>;
}

export interface Client {
  on<T = any>(event: string | symbol, handler: (data: T) => void): void;
  emit<T = any>(event: string | symbol, data: T): boolean;
}
