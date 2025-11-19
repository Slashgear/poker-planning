# Poker Planning

[![CI/CD](https://github.com/Slashgear/poker-planning/actions/workflows/ci.yml/badge.svg)](https://github.com/Slashgear/poker-planning/actions/workflows/ci.yml)
[![Staging](https://img.shields.io/badge/staging-deployed-blue)](https://poker-staging.slashgear.dev)
[![Production](https://img.shields.io/badge/production-deployed-green)](https://poker.slashgear.dev)

Collaborative poker planning web application for agile team estimation using the Fibonacci sequence.

## Features

- **Real-time planning session** with SSE (Server-Sent Events) synchronization
- **Anonymous votes** until collective reveal
- **Fibonacci sequence** for estimation (0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, ?)
- **Automatic statistics** (average, mode, vote count)
- **Team configuration** via JSON file or environment variable
- **Modern interface** with animations and visual effects
- **Multi-user** - multiple people can vote simultaneously

## Tech Stack

### Frontend
- **React 19** with TypeScript
- **Vite 7** for build and dev server
- **Tailwind CSS 4** for styling
- **TanStack** (Query, Router, Table)

### Backend
- **Hono** - Lightweight web framework for SSE server
- **Server-Sent Events** for real-time synchronization
- **Node.js** with TypeScript

### Tests
- **Playwright** for multi-user end-to-end tests

### Linting
- **oxlint** for fast JavaScript/TypeScript linting

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
# Terminal 1 - SSE server
pnpm run dev:server

# Terminal 2 - Vite frontend
pnpm run dev
```

Then open multiple browsers/tabs at:
- **Frontend**: http://localhost:5173
- **SSE API**: http://localhost:3001

### Team Configuration

Edit the `team.config.json` file to define your team members:

```json
["Alice", "Bob", "Charlie", "Diana"]
```

You can also override the team via environment variable:

```bash
VITE_TEAM_MEMBERS="Alice,Bob,Charlie" pnpm run dev
```

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

Tests simulate complete sessions with multiple users voting simultaneously and verify real-time synchronization.

## Linting

```bash
# Run linter
pnpm lint

# Fix auto-fixable issues
pnpm format
```

## Project Structure

```
poc-er-planning/
├── server/              # Hono SSE server
│   └── index.ts        # API endpoints and SSE handling
├── src/
│   ├── components/     # React components
│   │   ├── PlanningSession.tsx
│   │   └── PlanningCard.tsx
│   ├── hooks/          # Custom hooks
│   │   └── usePlanningSession.ts
│   ├── lib/            # Utilities
│   │   └── teamConfig.ts
│   ├── types/          # TypeScript types
│   │   └── team.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── tests/              # Playwright tests
│   ├── helpers/
│   │   └── planning-page.ts
│   └── planning-session.spec.ts
├── team.config.json    # Team configuration
└── playwright.config.ts
```

## Usage Flow

1. **User selection**: Each member opens the app and selects their name
2. **Voting**: Each member clicks a Fibonacci card to vote
3. **Synchronization**: Votes are synchronized in real-time via SSE
4. **Reveal**: Anyone can reveal votes (even if not everyone has voted)
5. **Statistics**: Automatic display of average, mode, and vote count
6. **New estimation**: Reset the session for a new task

## SSE Architecture

The system uses Server-Sent Events for synchronization:

- **Hono server** maintains shared state in memory
- **Automatic broadcast** to all connected clients
- **Automatic reconnection** on connection loss
- **Regular ping** to keep connection alive

### API Endpoints

- `GET /events` - SSE connection for updates
- `POST /vote` - Record a vote
- `POST /init-votes` - Initialize votes for a user
- `POST /reveal` - Reveal all votes
- `POST /reset` - Reset the session
- `GET /state` - Get current state

## Design

The interface uses:
- Purple/pink/slate gradient background
- Frosted glass effects (backdrop blur)
- Smooth animations with Tailwind
- Interactive poker cards with hover effects
- Responsive design

## Available Scripts

```bash
pnpm run dev          # Start Vite dev server
pnpm run dev:server   # Start SSE server
pnpm run build        # Production build
pnpm run preview      # Preview build
pnpm lint            # Run linter
pnpm format          # Fix linting issues
pnpm test            # Run Playwright tests
pnpm test:ui         # Tests in interactive UI mode
pnpm test:headed     # Tests with visible browser
pnpm test:report     # Show test report
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.

## License

ISC