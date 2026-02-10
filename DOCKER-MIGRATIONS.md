# Docker Migration Setup - Quick Reference

## ✅ What Was Configured

1. **Automatic Migrations on Startup**
   - `docker-entrypoint.sh` runs migrations before starting the app
   - Waits for database to be ready
   - Executes all pending migrations
   - Then starts the application

2. **Dockerfile Updates**
   - Copies migration files to production image
   - Copies `.sequelizerc` and `config.cjs`
   - Sets up the entrypoint script

3. **Docker Compose Integration**
   - Migration commands added to `script/start.sh`
   - Migrations run automatically when container starts
   - Manual migration commands available

## 🚀 Quick Start

### Start Application (Migrations Run Automatically)
```bash
docker compose up -d
```

### Check Migration Status
```bash
./script/start.sh migrate:status
```

### View Migration Logs
```bash
docker compose logs app | grep migration
```

## 📝 Common Commands

| Task | Command |
|------|---------|
| Start services | `docker compose up -d` |
| Run migrations manually | `./script/start.sh migrate` |
| Check migration status | `./script/start.sh migrate:status` |
| Revert last migration | `./script/start.sh migrate:down` |
| Create new migration | `npm run migration:create <name>` |
| View logs | `docker compose logs app` |
| Access app shell | `./script/start.sh app-shell` |
| Rebuild image | `docker compose build` |

## 🔧 Development Workflow

### 1. Create New Migration
```bash
npm run migration:create add-email-column
```

### 2. Edit Migration File
Edit the generated `.cjs` file in `src/database/migrations/`

### 3. Test Locally (Optional)
```bash
npm run migration:up
```

### 4. Build and Test in Docker
```bash
docker compose down
docker compose up --build
```

### 5. Verify Migration
```bash
docker compose logs app | grep migration
./script/start.sh migrate:status
```

## 🚨 Troubleshooting

### Migration Didn't Run
```bash
# Check logs
docker compose logs app

# Run manually
./script/start.sh migrate
```

### Database Connection Error
```bash
# Check database status
docker compose ps

# Restart services
docker compose restart
```

### Need to Rollback
```bash
./script/start.sh migrate:down
```

### Fresh Database
```bash
docker compose down
docker volume rm alien-fit-backend_postgres_data
docker compose up -d
```

## 📁 Key Files

- `docker-entrypoint.sh` - Runs migrations on startup
- `Dockerfile` - Copies migration files
- `src/database/migrations/*.cjs` - Migration files
- `src/database/config.cjs` - Database config
- `.sequelizerc` - Sequelize CLI config
- `script/start.sh` - Management wrapper

## 🎯 Production Deployment

1. Build production image:
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml build
   ```

2. Start production services:
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```

3. Migrations run automatically on startup

4. Monitor logs:
   ```bash
   docker compose logs -f app
   ```

## 💡 Tips

- ✅ Migrations run automatically on every container start
- ✅ Idempotent - safe to run multiple times
- ✅ Database waits for health check before migrations
- ✅ Migration status is logged on startup
- ⚠️  Always backup production before deploying
- ⚠️  Test migrations in development first

## 📚 Full Documentation

- [Complete Migration Guide](../docs/migrations-guide.md)
- [Docker Migrations Guide](../docs/docker-migrations.md)
- [Database Configuration](../src/database/config.cjs)
