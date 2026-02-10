# Database Migrations

This folder contains Sequelize database migrations.

## Quick Reference

### Create a new migration
```bash
npm run migration:create <migration-name>
```

### Run all pending migrations
```bash
npm run migration:up
```

### Revert last migration
```bash
npm run migration:down
```

### Check migration status
```bash
npm run migration:status
```

## Important Notes

- All migration files **must** use the `.cjs` extension (not `.js`)
- This is because the project uses ES modules (`"type": "module"`)
- The `migration:create` script automatically creates files with the correct extension
- Always test migrations in development before running in production

## Example Migration Template

See `example-20250210000000-create-users-table.cjs` for a complete example.

For detailed documentation, see: [docs/migrations-guide.md](../../docs/migrations-guide.md)
