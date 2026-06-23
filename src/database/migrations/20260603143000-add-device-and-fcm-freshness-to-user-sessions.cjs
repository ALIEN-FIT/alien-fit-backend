'use strict';
/* eslint-disable no-undef */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('user_sessions', 'deviceId', {
            type: Sequelize.STRING,
            allowNull: true,
        });

        await queryInterface.addColumn('user_sessions', 'fcmTokenUpdatedAt', {
            type: Sequelize.DATE,
            allowNull: true,
        });

        await queryInterface.addIndex('user_sessions', ['deviceId'], {
            unique: true,
            name: 'user_sessions_deviceId_unique_not_null',
            where: {
                deviceId: {
                    [Sequelize.Op.ne]: null,
                },
            },
        });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('user_sessions', 'user_sessions_deviceId_unique_not_null');
        await queryInterface.removeColumn('user_sessions', 'fcmTokenUpdatedAt');
        await queryInterface.removeColumn('user_sessions', 'deviceId');
    },
};
