'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('training_plan_days', 'name', {
            type: Sequelize.STRING,
            allowNull: true,
        });
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('training_plan_days', 'name');
    },
};
