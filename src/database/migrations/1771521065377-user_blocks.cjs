'use strict';

module.exports = {
  async up(queryInterface) {
    const existingTablesRaw = await queryInterface.showAllTables();
    const existingTables = existingTablesRaw.map((table) => typeof table === 'string' ? table : table.tableName);
    if (existingTables.includes("user_blocks")) {
      return;
    }


    await queryInterface.sequelize.query("CREATE TABLE IF NOT EXISTS \"user_blocks\" (\"id\" UUID , \"blockerId\" UUID NOT NULL REFERENCES \"users\" (\"id\") ON DELETE NO ACTION ON UPDATE CASCADE, \"blockedId\" UUID NOT NULL REFERENCES \"users\" (\"id\") ON DELETE NO ACTION ON UPDATE CASCADE, \"createdAt\" TIMESTAMP WITH TIME ZONE NOT NULL, \"updatedAt\" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY (\"id\"));");
    await queryInterface.sequelize.query("CREATE UNIQUE INDEX \"user_blocks_blocker_id_blocked_id\" ON \"user_blocks\" (\"blockerId\", \"blockedId\")");
    await queryInterface.sequelize.query("CREATE INDEX \"user_blocks_blocker_id\" ON \"user_blocks\" (\"blockerId\")");
    await queryInterface.sequelize.query("CREATE INDEX \"user_blocks_blocked_id\" ON \"user_blocks\" (\"blockedId\")");
  },

  async down(queryInterface) {
    await queryInterface.dropTable("user_blocks");
  },
};
