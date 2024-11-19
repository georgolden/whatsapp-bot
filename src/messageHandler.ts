import { logMessage, validateMessage, measureTime, createMiddlewareChain } from './middleware.js';
import { processMessage } from './commands.js';

const middleware = createMiddlewareChain([logMessage, validateMessage, measureTime]);

export async function handleMessage(message: string): Promise<string | undefined> {
  try {
    const cleanup = await middleware(message);
    const { result, error } = await processMessage(message);
    cleanup();
    if (error) {
      console.error('Error in logic', error);
      return;
    }
    if (!result) {
      console.error('Bug in logic: Empty result');
      return;
    }
    return result;
  } catch (error) {
    console.error('Error in message handler:', error);
    return;
  }
}
