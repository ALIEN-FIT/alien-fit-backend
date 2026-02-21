require('dotenv').config();

const useDbSsl = process.env.DB_SSL === 'true';

const sslDialectOptions = useDbSsl
    ? {
        ssl: {
            require: true,
            rejectUnauthorized: false
        }
    }
    : {};

module.exports = {
    development: {
        url: process.env.DB_URI,
        dialect: 'postgres',
        dialectOptions: sslDialectOptions
    },
    production: {
        url: process.env.DB_URI,
        dialect: 'postgres',
        dialectOptions: sslDialectOptions
    },
    test: {
        dialect: 'sqlite',
        storage: ':memory:'
    }
};
