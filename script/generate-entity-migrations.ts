import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { sequelize } from '../src/database/db-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type SequelizeModel = {
    getAttributes: () => Record<string, any>;
    getTableName: () => string | { tableName?: string; schema?: string };
    options?: {
        indexes?: ReadonlyArray<Record<string, any>>;
    };
};

const ROOT_DIR = path.resolve(__dirname, '..');
const MODULES_DIR = path.join(ROOT_DIR, 'src', 'modules');
const MIGRATIONS_DIR = path.join(ROOT_DIR, 'src', 'database', 'migrations');

function walk(dirPath: string): string[] {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries.flatMap((entry) => {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            return walk(fullPath);
        }
        return [fullPath];
    });
}

function normalizePathForImport(filePath: string) {
    return pathToFileURL(filePath).href;
}

function toTableName(tableNameValue: string | { tableName?: string; schema?: string }): string {
    if (typeof tableNameValue === 'string') {
        return tableNameValue;
    }

    if (tableNameValue?.schema && tableNameValue?.tableName) {
        return `${tableNameValue.schema}.${tableNameValue.tableName}`;
    }

    return tableNameValue?.tableName ?? String(tableNameValue);
}

function toMigrationName(tableName: string): string {
    return tableName.replace(/\./g, '_').replace(/[^a-zA-Z0-9_]/g, '_');
}

function resolveReferenceTable(refModel: unknown): string | null {
    if (!refModel) return null;

    if (typeof refModel === 'string') {
        return refModel;
    }

    const asRecord = refModel as Record<string, any>;
    if (typeof asRecord.tableName === 'string') {
        return asRecord.tableName;
    }

    if (typeof asRecord.getTableName === 'function') {
        try {
            return toTableName(asRecord.getTableName());
        } catch {
            return null;
        }
    }

    if (typeof asRecord.name === 'string') {
        const maybeModel = (sequelize.models as unknown as Record<string, SequelizeModel>)[asRecord.name];
        if (maybeModel) {
            return toTableName(maybeModel.getTableName());
        }
    }

    return null;
}

function topologicalSort(dependencies: Map<string, Set<string>>): string[] {
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, Set<string>>();

    for (const node of dependencies.keys()) {
        inDegree.set(node, 0);
        adjacency.set(node, new Set());
    }

    for (const [node, deps] of dependencies.entries()) {
        for (const dep of deps) {
            if (!dependencies.has(dep) || dep === node) continue;
            inDegree.set(node, (inDegree.get(node) ?? 0) + 1);
            adjacency.get(dep)?.add(node);
        }
    }

    const queue = Array.from(inDegree.entries())
        .filter(([, degree]) => degree === 0)
        .map(([node]) => node)
        .sort();

    const ordered: string[] = [];
    while (queue.length > 0) {
        const node = queue.shift()!;
        ordered.push(node);

        for (const next of adjacency.get(node) ?? []) {
            const nextDegree = (inDegree.get(next) ?? 1) - 1;
            inDegree.set(next, nextDegree);
            if (nextDegree === 0) {
                queue.push(next);
                queue.sort();
            }
        }
    }

    if (ordered.length !== dependencies.size) {
        const remaining = Array.from(dependencies.keys()).filter((node) => !ordered.includes(node)).sort();
        ordered.push(...remaining);
    }

    return ordered;
}

async function importModelFiles() {
    const allFiles = walk(MODULES_DIR);
    const modelFiles = allFiles
        .filter((filePath) => filePath.endsWith('.entity.ts') || filePath.endsWith('.model.ts'))
        .sort();

    for (const filePath of modelFiles) {
        await import(normalizePathForImport(filePath));
    }

    const associateFiles = allFiles
        .filter((filePath) => filePath.endsWith('associate-models.ts'))
        .sort();

    for (const filePath of associateFiles) {
        await import(normalizePathForImport(filePath));
    }
}

function writeMigrations() {
    const queryGenerator = sequelize.getQueryInterface().queryGenerator as any;
    const models = sequelize.models as unknown as Record<string, SequelizeModel>;
    const tableToModel = new Map<string, SequelizeModel>();

    for (const model of Object.values(models)) {
        tableToModel.set(toTableName(model.getTableName()), model);
    }

    const dependencies = new Map<string, Set<string>>();
    for (const [tableName, model] of tableToModel.entries()) {
        const deps = new Set<string>();
        for (const attribute of Object.values(model.getAttributes())) {
            const refTable = resolveReferenceTable((attribute as any)?.references?.model);
            if (refTable) deps.add(refTable);
        }
        dependencies.set(tableName, deps);
    }

    const orderedTables = topologicalSort(dependencies);
    const timestampBase = Date.now();

    for (const [index, tableName] of orderedTables.entries()) {
        const model = tableToModel.get(tableName);
        if (!model) continue;

        const attributes = model.getAttributes();
        const sqlAttributes = queryGenerator.attributesToSQL(attributes, {
            table: tableName,
            context: 'createTable',
        });
        const createTableSql = queryGenerator.createTableQuery(tableName, sqlAttributes, model.options ?? {});
        const enumQueries = Object.entries(attributes)
            .filter(([, attribute]) => (attribute as any)?.type?.key === 'ENUM')
            .map(([attributeName, attribute]) => queryGenerator.pgEnum(tableName, attributeName, (attribute as any).type))
            .filter(Boolean);
        const indexQueries = (model.options?.indexes ?? []).map((idx) => queryGenerator.addIndexQuery(tableName, idx));

        const migrationContent = `'use strict';\n\nmodule.exports = {\n  async up(queryInterface) {\n    const existingTablesRaw = await queryInterface.showAllTables();\n    const existingTables = existingTablesRaw.map((table) => typeof table === 'string' ? table : table.tableName);\n    if (existingTables.includes(${JSON.stringify(tableName)})) {\n      return;\n    }\n\n${enumQueries
            .map((sql) => `    await queryInterface.sequelize.query(${JSON.stringify(sql)});`)
            .join('\n')}\n    await queryInterface.sequelize.query(${JSON.stringify(createTableSql)});\n${indexQueries
                .map((sql) => `    await queryInterface.sequelize.query(${JSON.stringify(sql)});`)
                .join('\n')}\n  },\n\n  async down(queryInterface) {\n    await queryInterface.dropTable(${JSON.stringify(tableName)});\n  },\n};\n`;

        const migrationFileName = `${timestampBase + index}-${toMigrationName(tableName)}.cjs`;
        const migrationPath = path.join(MIGRATIONS_DIR, migrationFileName);
        fs.writeFileSync(migrationPath, migrationContent, 'utf8');
    }
}

async function main() {
    await importModelFiles();
    writeMigrations();
    console.log(`Generated migrations for ${Object.keys(sequelize.models).length} models.`);
}

main().catch((error) => {
    console.error('Failed to generate entity migrations:', error);
    process.exit(1);
});
