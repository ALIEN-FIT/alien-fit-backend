'use strict';

module.exports = {
  async up(queryInterface) {
    const existingTablesRaw = await queryInterface.showAllTables();
    const existingTables = existingTablesRaw.map((table) => typeof table === 'string' ? table : table.tableName);
    if (existingTables.includes("post_comments")) {
      return;
    }


    await queryInterface.sequelize.query("CREATE TABLE IF NOT EXISTS \"post_comments\" (\"id\" UUID , \"postId\" UUID NOT NULL REFERENCES \"posts\" (\"id\") ON DELETE CASCADE ON UPDATE CASCADE, \"userId\" UUID NOT NULL REFERENCES \"users\" (\"id\") ON DELETE NO ACTION ON UPDATE CASCADE, \"parentId\" UUID REFERENCES \"post_comments\" (\"id\") ON DELETE SET NULL ON UPDATE CASCADE, \"content\" TEXT NOT NULL DEFAULT '', \"likesCount\" INTEGER NOT NULL DEFAULT 0, \"repliesCount\" INTEGER NOT NULL DEFAULT 0, \"createdAt\" TIMESTAMP WITH TIME ZONE NOT NULL, \"updatedAt\" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY (\"id\"));");
    await queryInterface.sequelize.query("CREATE INDEX \"post_comments_post_id\" ON \"post_comments\" (\"postId\")");
    await queryInterface.sequelize.query("CREATE INDEX \"post_comments_parent_id\" ON \"post_comments\" (\"parentId\")");
  },

  async down(queryInterface) {
    await queryInterface.dropTable("post_comments");
  },
};
