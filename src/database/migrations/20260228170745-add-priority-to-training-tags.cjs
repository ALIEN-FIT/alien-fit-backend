'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('training_tags', 'priority', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    });

    await queryInterface.addIndex('training_tags', ['priority'], {
      name: 'training_tags_priority_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('training_tags', 'training_tags_priority_idx');
    await queryInterface.removeColumn('training_tags', 'priority');
  },
};
