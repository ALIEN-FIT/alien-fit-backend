// database.ts
import { Sequelize } from 'sequelize';
import { env } from '../config/env.js';
import { debugLogger, errorLogger, infoLogger } from '../config/logger.config.js';

const DB_URL = env.DB_URI;
const isTestEnv = env.NODE_ENV === 'test';

const baseOptions = {
    logging: env.NODE_ENV === 'development' ? (msg: string) => debugLogger.debug(msg) : false,
};

export const sequelize = isTestEnv
    ? new Sequelize(DB_URL.startsWith('sqlite') ? DB_URL : 'sqlite::memory:', {
        ...baseOptions,
        dialect: 'sqlite',
        storage: DB_URL.startsWith('sqlite') ? undefined : ':memory:',
        logging: false,
    })
    : new Sequelize(DB_URL, baseOptions);

if (!isTestEnv) {
    sequelize.sync({ alter: false });
}

export async function initializeDatabase() {
    try {
        await sequelize.authenticate();
        console.log(`DB Connected to ${DB_URL}`);
    } catch (error) {
        console.error('DB Connection Error:', error);
        errorLogger.error('DB Connection Error:', error);
    }
}
