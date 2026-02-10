# Database Migrations Guide

## Overview

This project now uses Sequelize migrations to manage database schema changes. Migrations allow you to version control your database schema and ensure consistency across different environments.

## Important Changes

- `sequelize.sync({ alter: false })` is now set in `src/database/db-config.ts`
- Database schema changes should be done through migrations, not through model sync

## Available Scripts

### Run Migrations
```bash
npm run migration:up
```
Runs all pending migrations to update your database schema.

### Revert Last Migration
```bash
npm run migration:down
```
Reverts the most recently applied migration.

### Revert All Migrations
```bash
npm run migration:down:all
```
Reverts all applied migrations (use with caution).

### Check Migration Status
```bash
npm run migration:status
```
Shows which migrations have been applied and which are pending.

### Generate New Migration
```bash
npm run migration:create <migration-name>
```
Creates a new migration file with the specified name (automatically uses .cjs extension).

Example:
```bash
npm run migration:create add-email-to-users
```

## Migration File Structure

Migrations are located in `src/database/migrations/` and **must use the `.cjs` extension** (not `.js`) because this project uses ES modules (`"type": "module"` in package.json).

When you generate a new migration, manually rename it from `.js` to `.cjs`:

```bash
npm run migration:generate -- add-email-to-users
# Then rename the generated file from .js to .cjs
```

Migration structure:

```javascript
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Define schema changes to apply
    await queryInterface.createTable('TableName', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      // ... other columns
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
  },

  async down(queryInterface, Sequelize) {
    // Define how to revert the changes
    await queryInterface.dropTable('TableName');
  },
};
```

## Creating Migrations for Existing Models

Since you're transitioning from auto-sync to migrations, you'll need to create migrations for your existing tables. Here's the process:

### 1. For New Projects (Fresh Database)
- Create initial migrations for all your tables
- Run `npm run migration:up` to create the schema

### 2. For Existing Databases
If your database already has tables:

**Option A: Skip Initial Migration (Recommended for existing production databases)**
```bash
# Mark migrations as completed without running them
npx sequelize-cli db:migrate --to XXXXXXXXXXXXXX-create-initial-tables.js
```

**Option B: Fresh Start**
1. Backup your data
2. Drop all tables
3. Run `npm run migration:up`
4. Restore your data

## Common Migration Operations

### Create a Table
```javascript
await queryInterface.createTable('TableName', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  createdAt: Sequelize.DATE,
  updatedAt: Sequelize.DATE,
});
```

### Add a Column
```javascript
await queryInterface.addColumn('TableName', 'newColumn', {
  type: Sequelize.STRING,
  allowNull: true,
});
```

### Remove a Column
```javascript
await queryInterface.removeColumn('TableName', 'columnName');
```

### Add an Index
```javascript
await queryInterface.addIndex('TableName', ['columnName'], {
  name: 'table_column_idx',
});
```

### Add a Foreign Key
```javascript
await queryInterface.addConstraint('ChildTable', {
  fields: ['parentId'],
  type: 'foreign key',
  name: 'fk_child_parent',
  references: {
    table: 'ParentTable',
    field: 'id',
  },
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});
```

## Best Practices

1. **Never edit applied migrations** - Always create a new migration to modify the schema
2. **Test migrations** - Test both `up` and `down` methods in development
3. **Backup before migrations** - Always backup production data before running migrations
4. **One change per migration** - Keep migrations focused on a single change
5. **Descriptive names** - Use clear, descriptive names for migrations
6. **Review before production** - Always review migrations before applying to production

## Workflow Example

1. Make changes to your Sequelize model/entity files
2. Create a migration that reflects those changes:
   ```bash
   npm run migration:generate -- add-field-to-model
   ```
3. Edit the generated migration file to define the `up` and `down` methods
4. Test the migration locally:
   ```bash
   npm run migration:up
   ```
5. Verify the changes in your database
6. Test reverting (optional but recommended):
   ```bash
   npm run migration:down
   npm run migration:up
   ```
7. Commit the migration file to version control
8. Deploy and run migrations in production:
   ```bash
   npm run migration:up
   ```

## Table Name Conventions

Sequelize generates table names from your model class names. Make sure your migration table names match:
- `UserEntity` → `UserEntities`
- `PostEntity` → `PostEntities`
- etc.

## Environment Configuration

Migration configuration is in `src/database/config.cjs` and uses your `.env` file:
- `DB_URI` - Database connection string
- `NODE_ENV` - Environment (development/production/test)

## Troubleshooting

### Migration fails with "relation already exists"
Your table likely exists from the old auto-sync. Either:
- Drop the table manually and re-run the migration
- Mark the migration as complete without running it

### Can't connect to database during migration
- Verify your `DB_URI` in `.env`
- Ensure the database server is running
- Check your database credentials

### Migration runs but changes don't appear
- Check the SequelizeMeta table to see which migrations ran
- Verify you're connected to the correct database
- Check for errors in the migration output

## References

- [Sequelize Migrations Documentation](https://sequelize.org/docs/v6/other-topics/migrations/)
- [Sequelize CLI Documentation](https://github.com/sequelize/cli)
