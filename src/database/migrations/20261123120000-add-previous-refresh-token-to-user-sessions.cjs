'use strict';
/* eslint-disable no-undef */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('user_sessions', 'previousRefreshToken', {
            type: Sequelize.TEXT,
            allowNull: true,
        });
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('user_sessions', 'previousRefreshToken');
    },
};
