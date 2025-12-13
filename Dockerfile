# Build stage
FROM node:24.12.0-alpine AS builder

WORKDIR /app

# Install compression tools (stable layer, rarely changes)
RUN apk add --no-cache brotli zstd zopfli

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

# Precompress static assets
RUN find dist -type f \( -name "*.js" -o -name "*.css" -o -name "*.html" -o -name "*.svg" -o -name "*.json" \) | while read file; do \
      brotli -k -q 11 "$file"; \
      zstd -k -q --ultra -22 "$file"; \
      zopfli "$file"; \
    done

# Production stage - Node.js server serving both API and static files
FROM node:24.12.0-alpine AS production

WORKDIR /app

# Enable corepack and install pnpm
RUN corepack enable && corepack prepare pnpm@10.17.0 --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies (including tsx for running TypeScript)
RUN pnpm install --frozen-lockfile --prod

# Copy server source code
COPY --from=builder /app/server ./server

# Copy built frontend from builder stage
COPY --from=builder /app/dist ./dist

# Set production environment
ENV NODE_ENV=production

# Expose port (default 3001, can be overridden with PORT env var)
EXPOSE 3001

# Start the server with tsx (TypeScript execution)
CMD ["pnpm", "exec", "tsx", "server/index.ts"]