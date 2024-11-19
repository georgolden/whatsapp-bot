import { WhatsAppClient } from './adapters/whatsapp.adapter.js';
import { handleMessage } from './messageHandler.js';

// Error handling
process.on('unhandledRejection', (error: Error) => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

// Create and start WhatsApp client
const whatsappClient = new WhatsAppClient(handleMessage);
whatsappClient.start();
