'use strict';

module.exports = {
  async up(queryInterface) {
    const existingTablesRaw = await queryInterface.showAllTables();
    const existingTables = existingTablesRaw.map((table) => typeof table === 'string' ? table : table.tableName);
    if (existingTables.includes("notifications")) {
      return;
    }


    await queryInterface.sequelize.query("CREATE TABLE IF NOT EXISTS \"notifications\" (\"id\" UUID , \"userId\" UUID NOT NULL REFERENCES \"users\" (\"id\") ON DELETE CASCADE ON UPDATE CASCADE, \"byUserId\" UUID REFERENCES \"users\" (\"id\") ON DELETE SET NULL ON UPDATE CASCADE, \"type\" VARCHAR(255) NOT NULL, \"title\" VARCHAR(255) NOT NULL, \"body\" TEXT NOT NULL, \"isSeen\" BOOLEAN DEFAULT false, \"isRead\" BOOLEAN DEFAULT false, \"createdAt\" TIMESTAMP WITH TIME ZONE NOT NULL, \"updatedAt\" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY (\"id\"));");
    await queryInterface.sequelize.query("CREATE INDEX \"notifications_user_id_created_at\" ON \"notifications\" (\"userId\", \"createdAt\")");
    await queryInterface.sequelize.query("CREATE INDEX \"notifications_user_id_is_read\" ON \"notifications\" (\"userId\", \"isRead\")");
    await queryInterface.sequelize.query("CREATE INDEX \"notifications_user_id_is_seen\" ON \"notifications\" (\"userId\", \"isSeen\")");
  },

  async down(queryInterface) {
    await queryInterface.dropTable("notifications");
  },
};
