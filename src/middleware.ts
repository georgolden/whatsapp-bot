import type { MessageMiddleware } from './types.js';

export const logMessage: MessageMiddleware = async (message: string) => {
  console.log('Processing message:', message);
};

export const validateMessage: MessageMiddleware = async (message: string) => {
  if (!message.trim()) {
    throw new Error('Empty message');
  }
  if (message.length > 1000) {
    throw new Error('Message too long');
  }
};

export const measureTime: MessageMiddleware = async (message: string) => {
  const start = Date.now();
  return () => {
    const time = Date.now() - start;
    console.log(`Processing time: ${time}ms`);
  };
};

export const createMiddlewareChain = (middlewares: MessageMiddleware[]) => {
  return async (message: string) => {
    const cleanups: Array<() => void> = [];

    for (const middleware of middlewares) {
      const cleanup = await middleware(message);
      if (cleanup) {
        cleanups.push(cleanup);
      }
    }

    return () => {
      for (const cleanup of cleanups.reverse()) {
        cleanup();
      }
    };
  };
};
