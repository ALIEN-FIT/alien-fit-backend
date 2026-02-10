# Docker Migration Guide

## Overview

Database migrations are automatically run when the Docker container starts. This ensures your database schema is always up-to-date.

## Automatic Migration on Startup

When you start the application with Docker, the `docker-entrypoint.sh` script:

1. Waits for the database to be ready
2. Automatically runs all pending migrations (`npm run migration:up`)
3. Starts the application

This happens every time the container starts, so your database schema is always in sync with your code.

## Manual Migration Commands

You can also run migrations manually from outside the container:

### Run Migrations
```bash
./script/start.sh migrate
```
or
```bash
docker compose exec app npm run migration:up
```

### Revert Last Migration
```bash
./script/start.sh migrate:down
```
or
```bash
docker compose exec app npm run migration:down
```

### Check Migration Status
```bash
./script/start.sh migrate:status
```
or
```bash
docker compose exec app npm run migration:status
```

### Create New Migration
From your host machine (not inside Docker):
```bash
npm run migration:create add-new-field
```

Then rebuild the Docker image to include the new migration:
```bash
./script/start.sh build
```

## Docker Compose Commands

### Start with Automatic Migrations
```bash
docker compose up -d
# Migrations run automatically on startup
```

### View Migration Logs
```bash
docker compose logs app | grep -i migration
```

### Run Migrations in Running Container
```bash
docker compose exec app npm run migration:up
```

## Development vs Production

### Development Environment

In development mode (docker-compose.dev.yml), the application code is mounted as a volume. Any changes to migration files are immediately available.

```bash
# Start development environment
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Run migrations
docker compose exec app npm run migration:up
```

### Production Environment

In production mode (docker-compose.prod.yml), the application is built into the image. Migration files are copied during the build process.

```bash
# Build production image
docker compose -f docker-compose.yml -f docker-compose.prod.yml build

# Start production environment
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Migrations run automatically on startup
```

## Dockerfile Configuration

The Dockerfile includes:

1. **Migration Files**: Copied from `src/database/migrations/`
2. **Configuration**: Copies `.sequelizerc` and `src/database/config.cjs`
3. **Entrypoint Script**: `docker-entrypoint.sh` runs migrations before starting the app

## Troubleshooting

### Migrations Not Running

Check the logs to see if there are any errors:
```bash
docker compose logs app
```

### Database Connection Issues

The entrypoint script waits for the database, but if you have connection issues:

1. Verify your `DB_URI` environment variable
2. Check that the database service is healthy:
   ```bash
   docker compose ps
   ```

### Migration Fails

If a migration fails:

1. Check the error in the logs
2. Fix the migration file
3. Rebuild the image if in production
4. Restart the container:
   ```bash
   docker compose restart app
   ```

### Rollback Migration

If you need to rollback:
```bash
docker compose exec app npm run migration:down
```

### Fresh Database Setup

To start with a fresh database:

```bash
# Stop all services
docker compose down

# Remove database volume
docker volume rm alien-fit-backend_postgres_data

# Start again (migrations will run on fresh database)
docker compose up -d
```

## CI/CD Integration

In your CI/CD pipeline, migrations will run automatically when the container starts:

```yaml
# Example: GitHub Actions
- name: Build Docker Image
  run: docker compose build

- name: Start Services
  run: docker compose up -d
  # Migrations run automatically

- name: Check Migration Status
  run: docker compose exec -T app npm run migration:status
```

## Best Practices

1. **Test Migrations**: Always test migrations in development before deploying
2. **Backup Production**: Backup your production database before deploying new migrations
3. **Monitor Startup**: Watch the logs during deployment to ensure migrations succeed
4. **Idempotent Migrations**: Write migrations that can run multiple times safely
5. **Version Control**: Always commit migration files to version control

## Example Workflow

### Adding a New Feature with Schema Changes

1. **Create Migration Locally**:
   ```bash
   npm run migration:create add-user-email-verification
   ```

2. **Edit Migration File**:
   Edit the generated `.cjs` file in `src/database/migrations/`

3. **Test Locally**:
   ```bash
   npm run migration:up
   # Test your feature
   ```

4. **Test in Docker**:
   ```bash
   docker compose down
   docker compose up --build
   # Migrations run automatically
   ```

5. **Commit and Deploy**:
   ```bash
   git add src/database/migrations/
   git commit -m "Add email verification"
   git push
   # Your CI/CD will build and deploy with automatic migrations
   ```

## Files Involved

- `docker-entrypoint.sh` - Runs migrations on container startup
- `Dockerfile` - Copies migration files and sets up entrypoint
- `src/database/migrations/` - Migration files (*.cjs)
- `src/database/config.cjs` - Database configuration for migrations
- `.sequelizerc` - Sequelize CLI configuration
- `script/start.sh` - Wrapper script with migration commands

## Additional Resources

- [Main Migrations Guide](./migrations-guide.md)
- [Sequelize Migrations Documentation](https://sequelize.org/docs/v6/other-topics/migrations/)
