export interface Event<T = unknown> {
    id?: string;
    name: string;
    data: T;
    timestamp?: string;
  }
  
export interface EventStore {
  writeEvent(event: Event): Promise<string>;
  processEvents(handler: (event: Event) => Promise<void>): Promise<any>;
}
