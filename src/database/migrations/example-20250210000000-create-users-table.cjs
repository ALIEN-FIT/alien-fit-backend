/**
 * Migration Example - Create Users Table
 * 
 * This is an example migration showing how to create the users table.
 * You can use this as a template for creating migrations for other tables.
 * 
 * To create a new migration:
 * npm run migration:generate -- <migration-name>
 * 
 * To run migrations:
 * npm run migration:up
 * 
 * To revert last migration:
 * npm run migration:down
 */

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('UserEntities', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true,
                allowNull: false,
            },
            provider: {
                type: Sequelize.STRING,
                allowNull: false,
                unique: true,
            },
            password: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            name: {
                type: Sequelize.STRING(255),
                allowNull: false,
            },
            role: {
                type: Sequelize.ENUM('SUPER_ADMIN', 'USER'),
                defaultValue: 'USER',
                allowNull: false,
            },
            height: {
                type: Sequelize.INTEGER,
                defaultValue: 0,
                allowNull: true,
            },
            weight: {
                type: Sequelize.INTEGER,
                defaultValue: 0,
                allowNull: true,
            },
            age: {
                type: Sequelize.INTEGER,
                allowNull: true,
            },
            gender: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            googleId: {
                type: Sequelize.STRING,
                allowNull: true,
                unique: true,
            },
            isVerified: {
                type: Sequelize.BOOLEAN,
                defaultValue: false,
                allowNull: false,
            },
            isBlocked: {
                type: Sequelize.BOOLEAN,
                defaultValue: false,
                allowNull: false,
            },
            isProfileComplete: {
                type: Sequelize.BOOLEAN,
                defaultValue: false,
                allowNull: true,
            },
            imageId: {
                type: Sequelize.UUID,
                allowNull: true,
            },
            profileBackgroundImageId: {
                type: Sequelize.UUID,
                allowNull: true,
            },
            isOnline: {
                type: Sequelize.BOOLEAN,
                defaultValue: false,
                allowNull: false,
            },
            lastSeen: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            freeDays: {
                type: Sequelize.INTEGER,
                defaultValue: 0,
                allowNull: false,
            },
            createdAt: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            updatedAt: {
                type: Sequelize.DATE,
                allowNull: false,
            },
        });

        // Add indexes
        await queryInterface.addIndex('UserEntities', ['provider'], {
            name: 'users_provider_idx',
        });

        await queryInterface.addIndex('UserEntities', ['googleId'], {
            name: 'users_google_id_idx',
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('UserEntities');
    },
};
