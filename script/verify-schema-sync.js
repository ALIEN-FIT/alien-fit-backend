import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { sequelize } from '../src/database/db-config.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const MODULES_DIR = path.join(ROOT_DIR, 'src', 'modules');
function walk(dirPath) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries.flatMap((entry) => {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            return walk(fullPath);
        }
        return [fullPath];
    });
}
function toTableName(tableNameValue) {
    if (typeof tableNameValue === 'string') {
        return tableNameValue;
    }
    if (tableNameValue?.schema && tableNameValue?.tableName) {
        return `${tableNameValue.schema}.${tableNameValue.tableName}`;
    }
    return tableNameValue?.tableName ?? String(tableNameValue);
}
async function importModelFiles() {
    const allFiles = walk(MODULES_DIR);
    const modelFiles = allFiles
        .filter((filePath) => filePath.endsWith('.entity.ts') || filePath.endsWith('.model.ts'))
        .sort();
    for (const filePath of modelFiles) {
        await import(pathToFileURL(filePath).href);
    }
    const associateFiles = allFiles
        .filter((filePath) => filePath.endsWith('associate-models.ts'))
        .sort();
    for (const filePath of associateFiles) {
        await import(pathToFileURL(filePath).href);
    }
}
async function verifySchema() {
    await importModelFiles();
    const models = sequelize.models;
    const mismatches = [];
    let checkedCount = 0;
    for (const [modelName, model] of Object.entries(models)) {
        const tableName = toTableName(model.getTableName());
        checkedCount += 1;
        let dbColumns;
        try {
            dbColumns = await sequelize.getQueryInterface().describeTable(tableName);
        }
        catch (error) {
            mismatches.push(`[${modelName}] missing table: ${tableName}`);
            continue;
        }
        const modelAttributes = model.getAttributes();
        for (const [attributeName, attribute] of Object.entries(modelAttributes)) {
            const columnName = attribute.field || attributeName;
            if (!dbColumns[columnName]) {
                mismatches.push(`[${modelName}] missing column: ${tableName}.${columnName}`);
            }
        }
    }
    if (mismatches.length > 0) {
        console.error(`Schema drift found. Checked ${checkedCount} models.`);
        for (const mismatch of mismatches) {
            console.error(` - ${mismatch}`);
        }
        process.exit(1);
    }
    console.log(`Schema verification passed. Checked ${checkedCount} models with no missing tables/columns.`);
}
verifySchema().catch((error) => {
    console.error('Schema verification failed:', error);
    process.exit(1);
});
