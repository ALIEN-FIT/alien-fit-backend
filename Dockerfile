# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Copy public folder if needed
COPY --from=builder /app/public ./public

# Copy i18n locales
COPY --from=builder /app/dist/i18n ./dist/i18n

# Expose port
EXPOSE 3000

# Health check using the readiness endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health/ready || exit 1

# Start the application
CMD ["node", "dist/index.js"]
