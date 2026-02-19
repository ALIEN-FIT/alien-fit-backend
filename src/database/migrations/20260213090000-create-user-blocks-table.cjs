'use strict';

/** @type {import('sequelize').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const existingTablesRaw = await queryInterface.showAllTables();
        const existingTables = existingTablesRaw.map((table) => typeof table === 'string' ? table : table.tableName);
        if (existingTables.includes('user_blocks')) {
            return;
        }

        await queryInterface.createTable('user_blocks', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true,
                allowNull: false,
            },
            blockerId: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
            },
            blockedId: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
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

        await queryInterface.addIndex('user_blocks', ['blockerId', 'blockedId'], { unique: true });
        await queryInterface.addIndex('user_blocks', ['blockerId']);
        await queryInterface.addIndex('user_blocks', ['blockedId']);
    },

    async down(queryInterface) {
        await queryInterface.dropTable('user_blocks');
    },
};
