'use strict';

module.exports = {
  async up(queryInterface) {
    const existingTablesRaw = await queryInterface.showAllTables();
    const existingTables = existingTablesRaw.map((table) => typeof table === 'string' ? table : table.tableName);
    if (existingTables.includes("user_sessions")) {
      return;
    }


    await queryInterface.sequelize.query("CREATE TABLE IF NOT EXISTS \"user_sessions\" (\"id\" UUID , \"userId\" UUID NOT NULL REFERENCES \"users\" (\"id\") ON DELETE CASCADE ON UPDATE CASCADE, \"refreshToken\" TEXT UNIQUE, \"fcmToken\" VARCHAR(255), \"expiresAt\" TIMESTAMP WITH TIME ZONE, \"createdAt\" TIMESTAMP WITH TIME ZONE NOT NULL, \"updatedAt\" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY (\"id\"));");

  },

  async down(queryInterface) {
    await queryInterface.dropTable("user_sessions");
  },
};
