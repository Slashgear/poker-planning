# Poker Planning

[![CI/CD](https://github.com/Slashgear/poker-planning/actions/workflows/ci.yml/badge.svg)](https://github.com/Slashgear/poker-planning/actions/workflows/ci.yml)
[![Staging](https://img.shields.io/badge/staging-deployed-blue)](https://poker-staging.slashgear.dev)
[![Production](https://img.shields.io/badge/production-deployed-green)](https://poker.slashgear.dev)

Collaborative poker planning web application for agile team estimation using the Fibonacci sequence.

## Screenshots

<details>
<summary>Click to view screenshots</summary>

### Homepage
Create a new room to start a planning session.

![Homepage](docs/screenshots/01-homepage.png)

### Join Room
Share the room code with your team members.

![Join Room](docs/screenshots/02-join-room.png)

### Voting Session
Team members vote anonymously using Fibonacci values.

![Voting Session](docs/screenshots/03-voting-session.png)

### Results
View vote distribution and average when revealed.

![Results](docs/screenshots/04-results.png)

### Consensus
Celebrate when everyone agrees!

![Consensus](docs/screenshots/05-consensus.png)

</details>

## Features

- **Dynamic rooms** with shareable 6-character codes
- **Real-time synchronization** with SSE (Server-Sent Events)
- **Anonymous votes** until collective reveal
- **Fibonacci sequence** for estimation (1, 2, 3, 5, 8, 13, 21, ?, coffee)
- **Automatic statistics** (average)
- **Confetti celebration** when all votes match
- **Session persistence** via httpOnly cookies (2 hours)
- **Auto-cleanup** of inactive members (5 minutes)
- **Member management** - any member can remove others

## Tech Stack

### Frontend
- **React 19** with TypeScript
- **Vite 7** for build and dev server
- **Tailwind CSS 4** for styling
- **TanStack Router** for client-side routing

### Backend
- **Hono** - Lightweight web framework
- **Server-Sent Events** for real-time synchronization
- **Node.js** with TypeScript
- **Redis/Valkey** - Distributed storage for horizontal scaling
- **ioredis** - Redis/Valkey client with connection pooling

### Tests
- **Playwright** for end-to-end tests

### Linting & Formatting
- **oxlint** for fast JavaScript/TypeScript linting
- **oxfmt** for code formatting

## Quick Start

### Prerequisites

- Node.js 22+
- pnpm 10+
- **Redis or Valkey** (local or remote instance)

### Installation

```bash
# Clone the repository
git clone <url>
cd poker-planning

# Install dependencies
pnpm install

# Install Playwright browsers (for tests)
pnpm exec playwright install chromium

# Configure environment variables
cp .env.example .env
# Edit .env and set your REDIS_URL
```

### Running with Docker Compose

**Full stack (Redis/Valkey + Application) - Production-like environment:**
```bash
# Build and start everything
docker-compose up -d

# View logs
docker-compose logs -f

# Stop everything
docker-compose down

# Application available at http://localhost:3001
```

**Redis/Valkey only (for local development with hot-reload):**
```bash
# Start only Redis
docker-compose up -d redis

# Stop Redis
docker-compose down

# Set in .env:
REDIS_URL=redis://localhost:6379

# Then run the dev servers manually:
# Terminal 1: pnpm run dev:server
# Terminal 2: pnpm run dev
```

### Storage Backend Setup

The application is compatible with both **Redis** and **Valkey** (a fully open-source fork of Redis maintained by the Linux Foundation).

**Valkey with Docker (recommended for open-source stack):**
```bash
docker run -d --name poker-valkey -p 6379:6379 valkey/valkey:alpine
```

**Redis with Docker:**
```bash
docker run -d --name poker-redis -p 6379:6379 redis:alpine
```

**Local Valkey installation:**
```bash
# macOS
brew install valkey
brew services start valkey

# Linux (Ubuntu/Debian)
# Add Valkey repository
curl -fsSL https://packages.valkey.io/gpg | sudo gpg --dearmor -o /usr/share/keyrings/valkey-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/valkey-archive-keyring.gpg] https://packages.valkey.io/deb $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/valkey.list
sudo apt-get update
sudo apt-get install valkey
sudo systemctl start valkey
```

**Local Redis installation:**
```bash
# macOS
brew install redis
brew services start redis

# Linux (Ubuntu/Debian)
sudo apt-get install redis-server
sudo systemctl start redis
```

**Managed services (for production):**

Both Valkey and Redis are protocol-compatible, so you can use managed services:
- **Scaleway Managed Database for Redis**
- **AWS ElastiCache** (supports both Redis and Valkey)
- **DigitalOcean Managed Redis**
- Any Redis-compatible service

Example configuration:
```bash
REDIS_URL=redis://username:password@your-instance.cloud:6379
```

### Development

The application requires 2 servers running in parallel:

```bash
# Terminal 1 - API server
pnpm run dev:server

# Terminal 2 - Vite frontend
pnpm run dev
```

Then open:
- **Frontend**: http://localhost:5173
- **API**: http://localhost:3001

## Usage

1. **Create a room**: Click "Create a Room" on the homepage
2. **Share the link**: Copy the room URL to invite team members
3. **Join**: Each member enters their name to join
4. **Vote**: Click a Fibonacci card to vote
5. **Reveal**: Any member can reveal all votes
6. **Celebrate**: Confetti appears when everyone agrees!
7. **Reset**: Start a new estimation round

## Tests

```bash
# Run all tests
pnpm test

# Interactive mode with UI
pnpm test:ui

# With visible browser
pnpm test:headed

# View HTML report
pnpm test:report
```

## Linting & Formatting

```bash
# Run linter
pnpm lint

# Format code
pnpm format
```

## Project Structure

```
poker-planning/
├── server/              # Hono API server
│   ├── index.ts        # API endpoints and SSE handling
│   ├── storage.ts      # Redis storage layer for rooms
│   └── redis.ts        # Redis client wrapper
├── src/
│   ├── pages/          # Page components
│   │   ├── Home.tsx    # Homepage with room creation
│   │   └── Room.tsx    # Room with voting interface
│   ├── hooks/          # Custom hooks
│   │   ├── useRoom.ts  # Room state and actions
│   │   └── useConfetti.ts
│   ├── routeTree.gen.ts # TanStack Router configuration
│   ├── main.tsx
│   └── index.css
├── tests/              # Playwright tests
└── playwright.config.ts
```

## API Documentation

The API is fully documented using OpenAPI 3.0 specification.

- **Interactive API Docs (Swagger UI)**: [https://poker.slashgear.dev/api/docs](https://poker.slashgear.dev/api/docs)
- **OpenAPI JSON**: [https://poker.slashgear.dev/api/openapi.json](https://poker.slashgear.dev/api/openapi.json)

### Quick Reference

- `POST /api/rooms` - Create a new room
- `POST /api/rooms/:code/join` - Join a room
- `GET /api/rooms/:code` - Get room info
- `GET /api/rooms/:code/events` - SSE connection for updates
- `POST /api/rooms/:code/vote` - Submit a vote
- `POST /api/rooms/:code/reveal` - Reveal all votes
- `POST /api/rooms/:code/reset` - Reset the session
- `DELETE /api/rooms/:code/members/:id` - Remove a member

For detailed request/response schemas, authentication, and examples, see the [interactive API documentation](https://poker.slashgear.dev/api/docs).

## Infrastructure

```mermaid
graph TB
    subgraph "Scaleway fr-par"
        subgraph "GitHub Container Registry"
            GHCR["ghcr.io/slashgear/poker-planning<br/>Docker Images"]
        end

        subgraph "Private Network VPC"
            Redis[("Redis Managed Database<br/>rediss://10.x.x.x:6379<br/>TLS Enabled")]

            subgraph "Serverless Containers"
                Staging["Staging Container<br/>Image: latest<br/>Auto-deploy on push to main"]
                Prod["Production Container<br/>Image: v2.x.x<br/>Deploy on git tags"]
            end
        end

        subgraph "CI/CD"
            GHA["GitHub Actions<br/>Build • Test • Deploy"]
        end
    end

    GHA -->|1. Build & Push| GHCR
    GHA -->|2. Deploy| Staging
    GHA -->|2. Deploy| Prod

    GHCR -.->|Pull Image| Staging
    GHCR -.->|Pull Image| Prod

    Staging -->|rediss://| Redis
    Prod -->|rediss://| Redis

    style Redis fill:#dc3545
    style Staging fill:#17a2b8
    style Prod fill:#28a745
    style GHCR fill:#6c757d
    style GHA fill:#ffc107
```

### Storage & Scalability
- **Redis/Valkey** for distributed session storage
  - Rooms stored with 2-hour TTL (auto-expiry)
  - Supports horizontal scaling across multiple container instances
  - Atomic operations for consistency
  - Protocol-compatible: works with both Redis and Valkey
- Session data persists across container restarts
- Inactive member cleanup runs every minute

### Room System
- Rooms are identified by 6-character codes (e.g., `ABC123`)
- Members are tracked via session cookies (httpOnly, 2h expiry)
- Inactive members are automatically removed after 5 minutes
- Empty rooms are automatically cleaned up by Redis/Valkey TTL

### Real-time Updates
- Server-Sent Events broadcast room state to all connected clients
- Automatic reconnection on connection loss
- Keep-alive pings every 30 seconds
- SSE clients tracked per container (roomClients Map)
- Room state fetched from Redis/Valkey on each broadcast

## Available Scripts

```bash
pnpm run dev          # Start Vite dev server
pnpm run dev:server   # Start API server
pnpm run build        # Production build
pnpm run preview      # Preview build
pnpm lint             # Run linter
pnpm format           # Format code
pnpm test             # Run Playwright tests
pnpm test:ui          # Tests in interactive UI mode
pnpm test:headed      # Tests with visible browser
pnpm test:report      # Show test report
pnpm screenshots      # Generate example screenshots
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.

## License

ISC
