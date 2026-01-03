# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a poker planning web application for agile task estimation using the Fibonacci sequence. Teams create dynamic rooms with shareable codes and estimate tasks collaboratively in real-time.

**Tech Stack:**
- **Frontend**: React 19, Tailwind CSS 4, TanStack Router
- **Backend**: Hono server with Server-Sent Events
- **Storage**: Redis for room state persistence
- **State**: Session cookies (httpOnly, 2h)
- **PWA**: manifest.json for installable app
- **Accessibility**: @axe-core/react for dev auditing

## Key Architecture

### Room-based System
- Rooms are created dynamically with 6-character codes
- Members join by entering their name (unique per room)
- Sessions tracked via httpOnly cookies
- Inactive members removed after 5 minutes
- Empty rooms automatically cleaned up

### Performance Optimizations
- **Redis SCAN vs KEYS**: Uses non-blocking `SCAN` instead of `KEYS` for iterating rooms
  - Prevents blocking Redis during cleanup and stats operations
  - Cleanup runs every 60s without impacting other operations
  - Safe for production at scale (tested with 150+ concurrent rooms)
  - Located in `server/storage.ts` (`scanKeys()` method)

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
- `src/hooks/useKeyboardShortcuts.ts` - Keyboard shortcuts for voting, reveal, and reset
- `src/hooks/useConfetti.ts` - Confetti animation on consensus
- `src/routeTree.gen.ts` - TanStack Router configuration

## Development Commands

```bash
# Start Redis first
docker-compose up -d redis

# Run both servers for development
REDIS_URL=redis://localhost:6379 pnpm run dev:server  # Terminal 1 - API (port 3001)
pnpm run dev                                          # Terminal 2 - Frontend (port 5173)

# Testing (requires Redis)
REDIS_URL=redis://localhost:6379 pnpm test  # Run Playwright tests
pnpm test:unit                               # Run Vitest unit tests
pnpm lint                                    # Run oxlint
pnpm format                                  # Check formatting with oxfmt

# Load Testing (requires Redis + running server)
pnpm test:load:basic      # Basic workflow (20 users, 3.5min)
pnpm test:load:spike      # Spike test (100 users spike)
pnpm test:load:stress     # Stress test (up to 1000 users, 17min)
pnpm test:load:realistic  # Realistic sessions (500 users, 50-100 rooms, 18min)
pnpm test:load:sse        # SSE endurance (1000 connections, 20min)
pnpm test:load:all        # Run all standard tests

# Docker
docker-compose up -d --build  # Build and run full stack (port 3001)
```

## PWA & Build System

### Progressive Web App
- `public/manifest.json` - PWA configuration
- Screenshots located in `public/*.png` for app store
- Theme color: `#7c3aed` (purple)
- Installable on mobile and desktop

### Build Process
1. `tsc` - TypeScript compilation
2. `vite build` - Frontend bundling

## Accessibility

### Development Tools
- **@axe-core/react** runs automatically in dev mode
- Reports accessibility violations in browser console
- Checks against WCAG guidelines

### Accessibility Features
- Form labels (visually hidden with `sr-only` class when needed)
- ARIA attributes on interactive elements
- Keyboard navigation (arrow keys, tab, etc.)
- Skip links for screen readers
- Live regions for status announcements

## Social Media & SEO

### Meta Tags
- Open Graph tags for Facebook/LinkedIn sharing
- Twitter Card meta tags
- Image: `public/og-image.png` (results screenshot)
- Comprehensive keywords and description

### Screenshots
All screenshots (1280x720) stored in `public/`:
- `01-homepage.png`
- `02-join-room.png`
- `03-voting-session.png`
- `04-results.png` (also used as og-image.png)
- `05-consensus.png`

## Conventions

- **Commits**: Use Conventional Commits format (feat:, fix:, chore:, etc.)
- **Pre-commit**: Husky runs format, lint, and typecheck before each commit
- **Releases**: When creating a release, update version in package.json

## Important Patterns

- All members have equal permissions (reveal, reset, remove others)
- Votes hidden until reveal (displayed as '?' or '-')
- Confetti animation on consensus (all votes match)
- Cookie-based session for seamless reconnection
- Voting values:
  - Fibonacci sequence: 1, 2, 3, 5, 8, 13, 21, 34, 55, 89
  - Special values: '?' (unsure), '☕' (coffee break)
  - All values validated server-side in `server/security.ts` and `server/openapi.ts`
- Keyboard shortcuts for enhanced UX:
  - `1-9`: Vote for first 9 Fibonacci values (1, 2, 3, 5, 8, 13, 21, 34, 55)
  - Note: 89 is available via UI button only (no keyboard shortcut)
  - `V`: Reveal votes (when votes available)
  - `R`: Reset round
  - Shortcuts disabled when typing in input fields
