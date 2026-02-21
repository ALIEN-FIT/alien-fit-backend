'use strict';

module.exports = {
  async up(queryInterface) {
    const existingTablesRaw = await queryInterface.showAllTables();
    const existingTables = existingTablesRaw.map((table) => typeof table === 'string' ? table : table.tableName);
    if (existingTables.includes("posts")) {
      return;
    }


    await queryInterface.sequelize.query("CREATE TABLE IF NOT EXISTS \"posts\" (\"id\" UUID , \"userId\" UUID NOT NULL REFERENCES \"users\" (\"id\") ON DELETE CASCADE ON UPDATE CASCADE, \"text\" TEXT, \"likesCount\" INTEGER NOT NULL DEFAULT 0, \"commentsCount\" INTEGER NOT NULL DEFAULT 0, \"createdAt\" TIMESTAMP WITH TIME ZONE NOT NULL, \"updatedAt\" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY (\"id\"));");
    await queryInterface.sequelize.query("CREATE INDEX \"posts_user_id\" ON \"posts\" (\"userId\")");
    await queryInterface.sequelize.query("CREATE INDEX \"posts_created_at\" ON \"posts\" (\"createdAt\")");
  },

  async down(queryInterface) {
    await queryInterface.dropTable("posts");
  },
};
