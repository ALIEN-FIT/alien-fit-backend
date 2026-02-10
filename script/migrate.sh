#!/bin/sh
# Script to run migrations in Docker container

set -e

echo "📦 Running database migrations..."

# Check if we're in a Docker container
if [ -f "/.dockerenv" ]; then
    # Inside Docker, use the installed sequelize-cli
    npx sequelize-cli db:migrate
else
    # Outside Docker, use docker compose to run migrations in the app container
    echo "Running migrations via Docker Compose..."
    docker compose exec app npm run migration:up
fi

echo "✅ Migration completed!"
