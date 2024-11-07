export type Result = { result?: string | undefined; error?: string | undefined };

export type ProcessMessage = (message: string) => Promise<Result>;
export type MessageMiddleware = (message: string) => Promise<(() => void) | void>;
