'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('subscriptions', 'isFrozen', {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        });

        await queryInterface.addColumn('subscriptions', 'frozenAt', {
            type: Sequelize.DATE,
            allowNull: true,
        });

        await queryInterface.addColumn('subscriptions', 'freezingEndDate', {
            type: Sequelize.DATE,
            allowNull: true,
        });
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('subscriptions', 'freezingEndDate');
        await queryInterface.removeColumn('subscriptions', 'frozenAt');
        await queryInterface.removeColumn('subscriptions', 'isFrozen');
    },
};