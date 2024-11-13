# WhatsApp Bot

A TypeScript-based WhatsApp bot with a clean architecture focused on separation of concerns and extensibility.

## Prerequisites

### Local Development
- Node.js (v18 or higher)
- For Linux systems, you'll need Chrome dependencies (see Linux Setup below)

### Docker Deployment
- Docker
- Docker Compose (optional, but recommended)

## Installation

### Option 1: Local Development

1. Clone the repository
   ```bash
   git clone <repository-url>
   cd whatsapp-bot
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Build the project
   ```bash
   npm run build
   ```

4. Start the bot
   ```bash
   npm start
   ```

### Option 2: Docker Deployment

1. Clone the repository
   ```bash
   git clone <repository-url>
   cd whatsapp-bot
   ```

2. Build and run with Docker Compose:
   ```bash
   docker-compose up -d
   ```

   Or using Docker directly:
   ```bash
   docker build -t whatsapp-bot .
   docker run -d \
     -v "$(pwd)/.wwebjs_auth:/app/.wwebjs_auth" \
     -v "$(pwd)/.wwebjs_cache:/app/.wwebjs_cache" \
     whatsapp-bot
   ```

3. Check logs for QR code:
   ```bash
   # With Docker Compose
   docker-compose logs -f

   # With Docker
   docker logs -f whatsapp-bot
   ```

4. Scan the QR code with WhatsApp to authenticate

## Development

### Local Development
```bash
# Run with hot reload
npm run dev

# Format code
npm run format

# Type check
npm run check

# Build
npm run build
```

### Docker Development Tips

1. Rebuild container after dependency changes:
   ```bash
   docker-compose build
   ```

2. View logs:
   ```bash
   docker-compose logs -f
   ```

3. Restart container:
   ```bash
   docker-compose restart
   ```

4. Stop container:
   ```bash
   docker-compose down
   ```

### Linux Setup (Local Development Only)
If developing locally on Linux, install Chrome dependencies:
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

## Project Structure
```
.
├── src/                    # Source code
│   ├── adapters/          # Platform-specific adapters
│   ├── types.ts           # Type definitions
│   ├── commands.ts        # Message processing logic
│   ├── middleware.ts      # Cross-cutting concerns
│   ├── messageHandler.ts  # Main message handling
│   └── bot.ts            # Entry point
├── dist/                  # Compiled JavaScript
├── .wwebjs_auth/         # WhatsApp session data
├── .wwebjs_cache/        # WhatsApp cache
├── Dockerfile            # Docker configuration
├── docker-compose.yml    # Docker Compose configuration
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── biome.json           # Biome configuration
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
