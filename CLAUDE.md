# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a poker planning web application for agile task estimation using the Fibonacci sequence. Teams create dynamic rooms with shareable codes and estimate tasks collaboratively in real-time.

**Tech Stack:**
- **Frontend**: React 19, Tailwind CSS 4, TanStack Router
- **Backend**: Hono server with Server-Sent Events
- **State**: In-memory with session cookies (httpOnly, 2h)

## Key Architecture

### Room-based System
- Rooms are created dynamically with 6-character codes
- Members join by entering their name (unique per room)
- Sessions tracked via httpOnly cookies
- Inactive members removed after 5 minutes
- Empty rooms automatically cleaned up

### API Structure
- `POST /api/rooms` - Create room
- `POST /api/rooms/:code/join` - Join with name
- `GET /api/rooms/:code/events` - SSE for real-time updates
- `POST /api/rooms/:code/vote` - Submit vote
- `POST /api/rooms/:code/reveal` - Reveal votes
- `POST /api/rooms/:code/reset` - Reset round
- `DELETE /api/rooms/:code/members/:id` - Remove member

### Frontend Structure
- `src/pages/Home.tsx` - Room creation
- `src/pages/Room.tsx` - Voting interface with member management
- `src/hooks/useRoom.ts` - Room state and actions hook
- `src/routeTree.gen.ts` - TanStack Router configuration

## Development Commands

```bash
# Run both servers for development
pnpm run dev:server  # Terminal 1 - API (port 3001)
pnpm run dev         # Terminal 2 - Frontend (port 5173)

# Testing
pnpm test            # Run Playwright tests
pnpm lint            # Run oxlint
pnpm format          # Format with oxfmt
```

## Important Patterns

- All members have equal permissions (reveal, reset, remove others)
- Votes hidden until reveal (displayed as '?' or '-')
- Confetti animation on consensus (all votes match)
- Cookie-based session for seamless reconnection
