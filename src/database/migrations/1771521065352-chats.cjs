'use strict';

module.exports = {
  async up(queryInterface) {
    const existingTablesRaw = await queryInterface.showAllTables();
    const existingTables = existingTablesRaw.map((table) => typeof table === 'string' ? table : table.tableName);
    if (existingTables.includes("chats")) {
      return;
    }


    await queryInterface.sequelize.query("CREATE TABLE IF NOT EXISTS \"chats\" (\"id\" UUID , \"userId\" UUID NOT NULL UNIQUE REFERENCES \"users\" (\"id\") ON DELETE CASCADE ON UPDATE CASCADE, \"lastMessageAt\" TIMESTAMP WITH TIME ZONE, \"lastMessagePreview\" VARCHAR(255), \"createdAt\" TIMESTAMP WITH TIME ZONE NOT NULL, \"updatedAt\" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY (\"id\"));");

  },

  async down(queryInterface) {
    await queryInterface.dropTable("chats");
  },
};
