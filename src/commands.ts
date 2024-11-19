import type { Result } from './types.js';

const commands: Record<string, () => Promise<Result>> = {
  help: async () => ({
    result:
      'Available commands:\n' +
      'help - Show this message\n' +
      'ping - Check if bot is alive\n' +
      'time - Get current time\n' +
      'echo <message> - Repeat your message',
  }),

  ping: async () => ({ result: 'Pong! 🏓' }),

  time: async () => ({ result: new Date().toLocaleString() }),
};

export async function processMessage(message: string): Promise<Result> {
  if (message.startsWith('echo ')) {
    return { result: message.slice(5) };
  }

  const handler = commands[message];

  if (handler) {
    return handler();
  }

  return { error: 'No command found' };
}
