# =========================
# Build stage
# =========================
FROM node:20-alpine AS builder

WORKDIR /app

# Install deps
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build
RUN npm run build


# =========================
# Production stage
# =========================
FROM node:20-alpine AS production

WORKDIR /app

# Needed for healthcheck
RUN apk add --no-cache wget

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/dist/i18n ./dist/i18n

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --spider -q http://localhost:3000/health/ready || exit 1

CMD ["node", "dist/index.js"]
