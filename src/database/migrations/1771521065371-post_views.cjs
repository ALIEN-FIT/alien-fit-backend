'use strict';

module.exports = {
  async up(queryInterface) {
    const existingTablesRaw = await queryInterface.showAllTables();
    const existingTables = existingTablesRaw.map((table) => typeof table === 'string' ? table : table.tableName);
    if (existingTables.includes("post_views")) {
      return;
    }


    await queryInterface.sequelize.query("CREATE TABLE IF NOT EXISTS \"post_views\" (\"id\" UUID , \"postId\" UUID NOT NULL REFERENCES \"posts\" (\"id\") ON DELETE CASCADE ON UPDATE CASCADE, \"userId\" UUID NOT NULL REFERENCES \"users\" (\"id\") ON DELETE NO ACTION ON UPDATE CASCADE, \"lastViewedAt\" TIMESTAMP WITH TIME ZONE NOT NULL, \"createdAt\" TIMESTAMP WITH TIME ZONE NOT NULL, \"updatedAt\" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY (\"id\"));");
    await queryInterface.sequelize.query("CREATE UNIQUE INDEX \"post_views_post_id_user_id\" ON \"post_views\" (\"postId\", \"userId\")");
    await queryInterface.sequelize.query("CREATE INDEX \"post_views_user_id_last_viewed_at\" ON \"post_views\" (\"userId\", \"lastViewedAt\")");
  },

  async down(queryInterface) {
    await queryInterface.dropTable("post_views");
  },
};
