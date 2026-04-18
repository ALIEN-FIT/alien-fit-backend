'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('messages');

    if (!table.isDeleted) {
      await queryInterface.addColumn('messages', 'isDeleted', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    if (!table.deletedAt) {
      await queryInterface.addColumn('messages', 'deletedAt', {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      });
    }

    if (!table.deletedById) {
      await queryInterface.addColumn('messages', 'deletedById', {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }

    if (!table.deletedByRole) {
      await queryInterface.addColumn('messages', 'deletedByRole', {
        type: Sequelize.ENUM('user', 'trainer', 'admin'),
        allowNull: true,
        defaultValue: null,
      });
    }

    await queryInterface.addIndex('messages', ['isDeleted'], {
      name: 'messages_is_deleted_idx',
    }).catch(() => null);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('messages', 'messages_is_deleted_idx').catch(() => null);

    const table = await queryInterface.describeTable('messages');

    if (table.deletedByRole) {
      await queryInterface.removeColumn('messages', 'deletedByRole');
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "public"."enum_messages_deletedByRole";').catch(() => null);
    }

    if (table.deletedById) {
      await queryInterface.removeColumn('messages', 'deletedById');
    }

    if (table.deletedAt) {
      await queryInterface.removeColumn('messages', 'deletedAt');
    }

    if (table.isDeleted) {
      await queryInterface.removeColumn('messages', 'isDeleted');
    }
  },
};
