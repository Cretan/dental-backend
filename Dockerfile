# =============================================================================
# Dental Backend - Multi-stage Dockerfile for Strapi 5
# Production build with PostgreSQL support
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps

# Install build dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    libc6-compat

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# -----------------------------------------------------------------------------
# Stage 2: Builder
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    libc6-compat

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Strapi admin panel
ENV NODE_ENV=production
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 3: Production
# -----------------------------------------------------------------------------
FROM node:20-alpine AS production

# Install runtime dependencies and curl for health checks
RUN apk add --no-cache \
    libc6-compat \
    curl

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 strapi && \
    adduser --system --uid 1001 strapi

# Copy package files
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/package-lock.json* ./

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/build ./build

# Copy source files needed at runtime
COPY --chown=strapi:strapi ./config ./config
COPY --chown=strapi:strapi ./database ./database
COPY --chown=strapi:strapi ./public ./public
COPY --chown=strapi:strapi ./src ./src
COPY --chown=strapi:strapi ./types ./types

# Create directories for uploads and cache
RUN mkdir -p ./public/uploads && \
    chown -R strapi:strapi ./public && \
    chown -R strapi:strapi ./dist && \
    chown -R strapi:strapi ./build

# Set environment variables
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=1337
ENV DATABASE_CLIENT=postgres

# Switch to non-root user
USER strapi

# Expose port
EXPOSE 1337

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:1337/_health || exit 1

# Start Strapi
CMD ["npm", "run", "start"]
