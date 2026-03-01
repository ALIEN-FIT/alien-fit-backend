'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('static_training_plans', 'priority', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    });

    await queryInterface.addIndex('static_training_plans', ['priority'], {
      name: 'static_training_plans_priority_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('static_training_plans', 'static_training_plans_priority_idx');
    await queryInterface.removeColumn('static_training_plans', 'priority');
  },
};
