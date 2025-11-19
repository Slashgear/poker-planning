# Build stage
FROM ghcr.io/nodejs/node:22.16.0-alpine AS builder

WORKDIR /app

# Enable corepack and install pnpm
RUN corepack enable && corepack prepare pnpm@10.17.0 --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the frontend application
RUN pnpm run build

# Build the server TypeScript to JavaScript
RUN pnpm exec tsc server/index.ts --outDir server-dist --module ESNext --moduleResolution bundler --target ES2022 --esModuleInterop --skipLibCheck

# Production stage - Node.js server serving both API and static files
FROM ghcr.io/nodejs/node:22.16.0-alpine AS production

WORKDIR /app

# Enable corepack and install pnpm
RUN corepack enable && corepack prepare pnpm@10.17.0 --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy compiled server code
COPY --from=builder /app/server-dist ./server
COPY team.config.json ./

# Copy built frontend from builder stage
COPY --from=builder /app/dist ./dist

# Expose port (default 3001, can be overridden with PORT env var)
EXPOSE 3001

# Start the server
CMD ["node", "server/index.js"]