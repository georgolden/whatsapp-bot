import { Client, LocalAuth } from 'whatsapp-web.js';
import type { Message } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';

export class WhatsAppClient {
  private client: Client;

  constructor(private handleMessage: (message: string) => Promise<string | undefined>) {
    this.client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
        ],
      },
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.client.on('qr', (qr: string) => {
      qrcode.generate(qr, { small: true });
      console.log('QR Code generated. Scan it with WhatsApp to authenticate.');
    });

    this.client.on('ready', () => {
      console.log('Client is ready! Waiting for messages...');
    });

    this.client.on('message', async (message: Message) => {
      const result = await this.handleMessage(message.body.toLowerCase());
      if (result) {
        await message.reply(result);
      }
    });

    this.client.on('auth_failure', (err: Error) => {
      console.error('Authentication failed:', err);
    });

    this.client.on('disconnected', (reason: string) => {
      console.log('Client was disconnected:', reason);
    });
  }

  public start(): void {
    console.log('Initializing WhatsApp client...');
    this.client.initialize().catch((error) => {
      console.error('Failed to initialize client:', error);
      process.exit(1);
    });
  }
}
