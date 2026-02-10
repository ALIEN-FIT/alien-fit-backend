#!/usr/bin/env node

/**
 * Helper script to generate Sequelize migrations with .cjs extension
 * Usage: node script/generate-migration.js <migration-name>
 * Example: node script/generate-migration.js add-email-to-users
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const migrationName = process.argv[2];

if (!migrationName) {
    console.error('❌ Error: Migration name is required');
    console.log('Usage: node script/generate-migration.js <migration-name>');
    console.log('Example: node script/generate-migration.js add-email-to-users');
    process.exit(1);
}

console.log(`📝 Generating migration: ${migrationName}`);

// Generate migration using sequelize-cli
exec(`npx sequelize-cli migration:generate --name ${migrationName}`, (error, stdout, stderr) => {
    if (error) {
        console.error('❌ Error generating migration:', error);
        return;
    }

    console.log(stdout);

    // Find the generated .js file
    const migrationsDir = path.join(__dirname, '..', 'src', 'database', 'migrations');
    const files = fs.readdirSync(migrationsDir);
    const generatedFile = files.find(f => f.endsWith('.js') && f.includes(migrationName));

    if (generatedFile) {
        const oldPath = path.join(migrationsDir, generatedFile);
        const newPath = path.join(migrationsDir, generatedFile.replace('.js', '.cjs'));

        // Rename .js to .cjs
        fs.renameSync(oldPath, newPath);
        console.log(`✅ Renamed to .cjs extension: ${path.basename(newPath)}`);
        console.log(`📁 Location: src/database/migrations/${path.basename(newPath)}`);
    } else {
        console.log('⚠️  Could not find generated file to rename. Please manually rename .js to .cjs');
    }
});
