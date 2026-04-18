'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('messages');

    if (!table.parentMessageId) {
      await queryInterface.addColumn('messages', 'parentMessageId', {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'messages',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }

    await queryInterface.addIndex('messages', ['parentMessageId'], {
      name: 'messages_parent_message_id_idx',
    }).catch(() => null);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('messages', 'messages_parent_message_id_idx').catch(() => null);

    const table = await queryInterface.describeTable('messages');
    if (table.parentMessageId) {
      await queryInterface.removeColumn('messages', 'parentMessageId');
    }
  },
};
