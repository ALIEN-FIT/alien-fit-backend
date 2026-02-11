# =========================
# Build stage
# =========================
FROM node:20-alpine AS builder

WORKDIR /app

# ffmpeg is required for thumbnail extraction
RUN apk add --no-cache ffmpeg

# Install deps
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Copy entrypoint script for dev mode
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Build
RUN npm run build

ENTRYPOINT ["docker-entrypoint.sh"]


# =========================
# Production stage
# =========================
FROM node:20-alpine AS production

WORKDIR /app

# Needed for healthcheck
RUN apk add --no-cache wget ffmpeg

COPY package*.json ./
RUN npm ci --only=production

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/dist/i18n ./dist/i18n

# Copy migration files and configuration
COPY --from=builder /app/src/database/migrations ./src/database/migrations
COPY --from=builder /app/src/database/config.cjs ./src/database/config.cjs
COPY --from=builder /app/.sequelizerc ./.sequelizerc

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --spider -q http://localhost:3000/health/ready || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]

CMD ["node", "dist/index.js"]
