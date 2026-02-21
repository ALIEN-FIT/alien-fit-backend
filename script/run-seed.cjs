const { existsSync } = require('node:fs');
const { spawnSync } = require('node:child_process');

const prodSeedPath = './dist/database/seed/run-seed.js';
const devSeedPath = './src/database/seed/run-seed.ts';

const command = 'node';
const args = existsSync(prodSeedPath)
    ? [prodSeedPath]
    : ['--loader', 'ts-node/esm', devSeedPath];

const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: process.env,
});

if (result.error) {
    console.error(result.error);
    process.exit(1);
}

process.exit(result.status ?? 0);
