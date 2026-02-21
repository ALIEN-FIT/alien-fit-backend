#!/bin/sh
set -e

echo "🚀 Starting Alien Fit Backend..."

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
until node -e "const { Sequelize } = require('sequelize'); const seq = new Sequelize(process.env.DB_URI); seq.authenticate().then(() => { console.log('Connected'); process.exit(0); }).catch(() => process.exit(1));" 2>/dev/null; do
  echo "⏳ Database is unavailable - sleeping"
  sleep 2
done

echo "✅ Database is ready!"

# Run migrations
echo "📦 Running database migrations..."
npm run migration:up

# if [ $? -eq 0 ]; then
#   echo "✅ Migrations completed successfully!"
# else
#   echo "⚠️  Migration failed or no pending migrations"
# fi

# Execute the main command
echo "🎯 Starting application..."
exec "$@"
