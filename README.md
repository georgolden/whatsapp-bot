# WhatsApp Bot

A TypeScript-based WhatsApp bot with a clean architecture focused on separation of concerns and extensibility.

## Prerequisites

- Node.js (v18 or higher)
- For Linux systems, you'll need these additional dependencies for Puppeteer:
  ```bash
  sudo apt update
  sudo apt install -y \
    gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 \
    libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 \
    libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 \
    libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 \
    libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 \
    libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation \
    libappindicator1 libnss3 lsb-release xdg-utils wget chromium-browser
  ```

## Installation

1. Clone the repository
   ```bash
   git clone <repository-url>
   cd whatsapp-bot
   ```

2. Install dependencies
   ```bash
   npm install
   ```

## Running the Bot

1. Build the project
   ```bash
   npm run build
   ```

2. Start the bot
   ```bash
   npm start
   ```

3. Scan the QR code with WhatsApp on your phone to authenticate

## Development

Run in development mode with hot reload:
```bash
npm run dev
```

Format code:
```bash
npm run format
```

## Architecture Overview

The bot is built with a layered architecture focusing on separation of concerns:

```
src/
├── adapters/         # Platform-specific adapters (WhatsApp)
├── types.ts          # Core type definitions
├── commands.ts       # Message processing logic (temporary, to be replaced)
├── middleware.ts     # Cross-cutting concerns (logging, validation, etc.)
├── messageHandler.ts # Combines middleware and logic
└── index.ts         # Application entry point
```

### Key Components

1. **WhatsApp Client** (`adapters/whatsapp.adapter.ts`)
   - Handles WhatsApp-specific communication
   - Converts messages to/from platform-agnostic format

2. **Message Processing** (`commands.ts`)
   - Core business logic
   - Returns `string | undefined` results
   - Platform-agnostic

3. **Middleware** (`middleware.ts`)
   - Cross-cutting concerns like logging and validation
   - Chainable async functions
   - Supports cleanup operations

4. **Message Handler** (`messageHandler.ts`)
   - Orchestrates middleware and message processing
   - Handles error cases
   - Provides unified interface for the adapter

### Flow

```
Message → Middleware Chain → Process Message → Response (if any)
```

Each step is independent and can be modified or replaced without affecting others.

## Available Commands

- `help` - Show available commands
- `ping` - Check if bot is alive
- `time` - Get current time
- `echo <message>` - Repeat your message

## Error Handling

- Middleware errors are logged but don't break the flow
- Processing errors return undefined (no response)
- All errors are properly logged for debugging

## Extending

1. **Add New Middleware**
   ```typescript
   const newMiddleware: MessageMiddleware = async (message: string) => {
     // Do something
     return () => { /* cleanup if needed */ }
   }

   // Add to chain in message-handler.ts
   const middleware = createMiddlewareChain([
     logMessage,
     newMiddleware,
     validateMessage,
     measureTime,
   ])
   ```

2. **Replace Command Logic**
   - Create new implementation with same interface
   - Update imports in message-handler.ts
