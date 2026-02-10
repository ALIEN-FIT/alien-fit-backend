require('dotenv').config();

module.exports = {
    development: {
        url: process.env.DB_URI,
        dialect: 'postgres',
        dialectOptions: {
            ssl: process.env.DB_SSL === 'true' ? {
                require: true,
                rejectUnauthorized: false
            } : false
        }
    },
    production: {
        url: process.env.DB_URI,
        dialect: 'postgres',
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false
            }
        }
    },
    test: {
        dialect: 'sqlite',
        storage: ':memory:'
    }
};
