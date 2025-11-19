# Contributing Guide

Thank you for your interest in contributing to Poker Planning! This document describes the processes and conventions for contributing to the project.

## How to Contribute

### Reporting a Bug

1. Check that the bug hasn't already been reported in Issues
2. Create a new Issue with:
   - A descriptive title
   - Steps to reproduce the bug
   - Expected behavior vs observed behavior
   - Your environment (OS, Node version, browser)
   - Screenshots if applicable

### Proposing a Feature

1. Open an Issue to discuss the feature
2. Describe the use case and benefits
3. Wait for feedback before starting development

### Submitting Code

1. Fork the repository
2. Create a branch from `main`:
   ```bash
   git checkout -b feature/my-feature
   # or
   git checkout -b fix/my-fix
   ```
3. Make your changes
4. Test your changes
5. Commit with clear messages
6. Push to your fork
7. Open a Pull Request

## Development Setup

### Installation

```bash
# Clone your fork
git clone https://github.com/YOUR-USERNAME/poc-er-planning.git
cd poc-er-planning

# Install dependencies
pnpm install

# Install Playwright
pnpm exec playwright install chromium
```

### Running

```bash
# Terminal 1 - SSE server
pnpm run dev:server

# Terminal 2 - Frontend
pnpm run dev
```

### Tests

Before submitting code, make sure all tests pass:

```bash
# Run all tests
pnpm test

# Tests with UI for debugging
pnpm test:ui
```

### Linting

Before submitting code, make sure linting passes:

```bash
# Run linter
pnpm lint

# Auto-fix issues
pnpm format
```

## Code Conventions

### TypeScript

- Use strict TypeScript
- Define explicit types for public interfaces
- Avoid `any`, prefer `unknown` if necessary
- Use descriptive names for variables and functions

### React

- Functional components with hooks only
- Use `useMemo` and `useCallback` judiciously for performance
- Typed props with interfaces
- No inline components in JSX

### Styling

- Tailwind CSS only (no custom CSS unless necessary)
- Utility classes in order: layout → spacing → colors → effects
- Use responsive variants: `sm:`, `md:`, `lg:`
- Extract repeated patterns into components

### Naming

**Files:**
- Components: `PascalCase.tsx` (e.g., `PlanningCard.tsx`)
- Hooks: `camelCase.ts` with `use` prefix (e.g., `usePlanningSession.ts`)
- Utilities: `camelCase.ts` (e.g., `teamConfig.ts`)
- Types: `camelCase.ts` (e.g., `team.ts`)

**Code:**
- Components: `PascalCase`
- Functions/variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Types/Interfaces: `PascalCase`

### Git

**Commit messages:**

Follow the conventional format:

```
type(scope): short description

More detailed description if necessary

Fixes #123
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting, no code change
- `refactor`: Refactoring without feature change
- `test`: Adding/modifying tests
- `chore`: Maintenance, dependencies

**Examples:**
```
feat(voting): add ability to change vote
fix(sse): reconnect on connection loss
docs(readme): update installation instructions
test(planning): add multi-user scenario
```

## Tests

### Writing Tests

Playwright tests should:
- Test complete user scenarios
- Simulate multiple users if necessary
- Verify real-time synchronization
- Use the Page Object Pattern (see `tests/helpers/`)

**Example:**

```typescript
test('new scenario', async ({ browser }) => {
  const context = await browser.newContext()
  const page = await context.newPage()
  const planning = new PlanningPage(page)

  await page.goto('/')
  await planning.selectUser('Alice')
  await planning.vote(5)

  // Assertions...

  await context.close()
})
```

### Test Rules

- One test = one user scenario
- Independent tests (no shared state)
- Descriptive names explaining the scenario
- Reset server before each test if necessary
- Generous timeouts for SSE synchronization

## Architecture

### Folder Structure

```
server/          # Hono backend + SSE
src/
  components/    # React UI components
  hooks/         # Custom React hooks
  lib/           # Utility functions
  types/         # TypeScript definitions
tests/
  helpers/       # Page Objects for Playwright
  *.spec.ts      # Test files
```

### Patterns

**State Management:**
- Local state with `useState` for UI
- SSE for shared state between users
- No Redux/Zustand for now

**API Communication:**
- SSE to receive updates (read)
- Fetch POST to send actions (write)
- No polling

**Error Handling:**
- Try/catch in API calls
- Console.error for debugging
- User messages for critical errors

## PR Checklist

- [ ] Code compiles without TypeScript errors
- [ ] All tests pass (`pnpm test`)
- [ ] Linting passes (`pnpm lint`)
- [ ] Code follows project conventions
- [ ] New files have appropriate imports/exports
- [ ] Documentation is updated if necessary
- [ ] Commit messages follow conventions
- [ ] No forgotten console.logs (except for intentional debugging)
- [ ] Accessibility is maintained (aria-labels, etc.)

## Release Process

This project uses semantic versioning and GitHub Actions for automated releases.

### Version Convention

Follow [Semantic Versioning](https://semver.org/):
- **MAJOR** (`v2.0.0`): Breaking changes
- **MINOR** (`v1.1.0`): New features, backward compatible
- **PATCH** (`v1.0.1`): Bug fixes, backward compatible

### Creating a Release

1. **Ensure main is up to date and CI passes**
   ```bash
   git checkout main
   git pull origin main
   ```

2. **Update version in package.json** (if applicable)
   ```bash
   pnpm version patch  # or minor, major
   ```

3. **Create and push a tag**
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

4. **CI will automatically:**
   - Run all tests and linting
   - Build the application
   - Build and push Docker image to GitHub Container Registry
   - Tag the image with the version (e.g., `ghcr.io/owner/repo:1.0.0`)

5. **Deploy to production**
   - Go to GitHub Actions
   - Find the workflow run for your tag
   - The `deploy-production` job will deploy to Scaleway

### Release Checklist

- [ ] All tests pass on main branch
- [ ] CHANGELOG updated (if maintained)
- [ ] Version bumped in package.json
- [ ] Tag follows format `vX.Y.Z`
- [ ] Docker image built and pushed successfully
- [ ] Production deployment verified

### Hotfix Process

For urgent fixes on production:

1. Create a hotfix branch from the latest tag
   ```bash
   git checkout -b hotfix/critical-fix v1.0.0
   ```

2. Make the fix and test

3. Merge to main via PR

4. Create a new patch version tag
   ```bash
   git checkout main
   git pull
   git tag v1.0.1
   git push origin v1.0.1
   ```

## Questions?

Feel free to:
- Open an Issue to discuss
- Ask for clarifications in your PR
- Suggest improvements to this guide

## Code of Conduct

- Respect other contributors
- Accept constructive criticism
- Focus on what's best for the project
- Show empathy

Thank you for contributing!