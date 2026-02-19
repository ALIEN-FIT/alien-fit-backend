'use strict';

module.exports = {
  async up(queryInterface) {
    const existingTablesRaw = await queryInterface.showAllTables();
    const existingTables = existingTablesRaw.map((table) => typeof table === 'string' ? table : table.tableName);
    if (existingTables.includes("messages")) {
      return;
    }

    await queryInterface.sequelize.query("DO 'BEGIN CREATE TYPE \"public\".\"enum_messages_senderRole\" AS ENUM(''user'', ''trainer'', ''admin''); EXCEPTION WHEN duplicate_object THEN null; END';");
    await queryInterface.sequelize.query("DO 'BEGIN CREATE TYPE \"public\".\"enum_messages_messageType\" AS ENUM(''text'', ''call''); EXCEPTION WHEN duplicate_object THEN null; END';");
    await queryInterface.sequelize.query("CREATE TABLE IF NOT EXISTS \"messages\" (\"id\" UUID , \"chatId\" UUID NOT NULL REFERENCES \"chats\" (\"id\") ON DELETE CASCADE ON UPDATE CASCADE, \"senderId\" UUID NOT NULL REFERENCES \"users\" (\"id\") ON DELETE CASCADE ON UPDATE CASCADE, \"senderRole\" \"public\".\"enum_messages_senderRole\" NOT NULL, \"messageType\" \"public\".\"enum_messages_messageType\" NOT NULL DEFAULT 'text', \"content\" TEXT DEFAULT '', \"isRead\" BOOLEAN NOT NULL DEFAULT false, \"createdAt\" TIMESTAMP WITH TIME ZONE NOT NULL, \"updatedAt\" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY (\"id\"));");

  },

  async down(queryInterface) {
    await queryInterface.dropTable("messages");
  },
};
