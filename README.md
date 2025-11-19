# Poker Planning

[![CI/CD](https://github.com/Slashgear/poker-planning/actions/workflows/ci.yml/badge.svg)](https://github.com/Slashgear/poker-planning/actions/workflows/ci.yml)
[![Staging](https://img.shields.io/badge/staging-deployed-blue)](https://poker-staging.slashgear.dev)
[![Production](https://img.shields.io/badge/production-deployed-green)](https://poker.slashgear.dev)

Collaborative poker planning web application for agile team estimation using the Fibonacci sequence.

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
- **In-memory storage** with automatic cleanup

### Tests
- **Playwright** for end-to-end tests

### Linting & Formatting
- **oxlint** for fast JavaScript/TypeScript linting
- **oxfmt** for code formatting

## Quick Start

### Prerequisites

- Node.js 22+
- pnpm 10+

### Installation

```bash
# Clone the repository
git clone <url>
cd poc-er-planning

# Install dependencies
pnpm install

# Install Playwright browsers (for tests)
pnpm exec playwright install chromium
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
poc-er-planning/
├── server/              # Hono API server
│   └── index.ts        # API endpoints and SSE handling
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

## API Endpoints

- `POST /api/rooms` - Create a new room
- `POST /api/rooms/:code/join` - Join a room
- `GET /api/rooms/:code` - Get room info
- `GET /api/rooms/:code/events` - SSE connection for updates
- `POST /api/rooms/:code/vote` - Submit a vote
- `POST /api/rooms/:code/reveal` - Reveal all votes
- `POST /api/rooms/:code/reset` - Reset the session
- `DELETE /api/rooms/:code/members/:id` - Remove a member

## Architecture

### Room System
- Rooms are identified by 6-character codes (e.g., `ABC123`)
- Members are tracked via session cookies (httpOnly, 2h expiry)
- Inactive members are automatically removed after 5 minutes
- Empty rooms are automatically deleted

### Real-time Updates
- Server-Sent Events broadcast room state to all connected clients
- Automatic reconnection on connection loss
- Keep-alive pings every 30 seconds

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
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.

## License

ISC
