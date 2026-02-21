'use strict';

module.exports = {
  async up(queryInterface) {
    const existingTablesRaw = await queryInterface.showAllTables();
    const existingTables = existingTablesRaw.map((table) => typeof table === 'string' ? table : table.tableName);
    if (existingTables.includes("user_follows")) {
      return;
    }


    await queryInterface.sequelize.query("CREATE TABLE IF NOT EXISTS \"user_follows\" (\"id\" UUID , \"followerId\" UUID NOT NULL REFERENCES \"users\" (\"id\") ON DELETE CASCADE ON UPDATE CASCADE, \"followingId\" UUID NOT NULL REFERENCES \"users\" (\"id\") ON DELETE CASCADE ON UPDATE CASCADE, \"createdAt\" TIMESTAMP WITH TIME ZONE NOT NULL, \"updatedAt\" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY (\"id\"));");
    await queryInterface.sequelize.query("CREATE UNIQUE INDEX \"user_follows_follower_id_following_id\" ON \"user_follows\" (\"followerId\", \"followingId\")");
    await queryInterface.sequelize.query("CREATE INDEX \"user_follows_follower_id\" ON \"user_follows\" (\"followerId\")");
    await queryInterface.sequelize.query("CREATE INDEX \"user_follows_following_id\" ON \"user_follows\" (\"followingId\")");
  },

  async down(queryInterface) {
    await queryInterface.dropTable("user_follows");
  },
};
