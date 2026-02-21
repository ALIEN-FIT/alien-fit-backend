'use strict';

module.exports = {
  async up(queryInterface) {
    const existingTablesRaw = await queryInterface.showAllTables();
    const existingTables = existingTablesRaw.map((table) => typeof table === 'string' ? table : table.tableName);
    if (existingTables.includes("post_comment_media")) {
      return;
    }


    await queryInterface.sequelize.query("CREATE TABLE IF NOT EXISTS \"post_comment_media\" (\"id\" UUID , \"commentId\" UUID NOT NULL REFERENCES \"post_comments\" (\"id\") ON DELETE CASCADE ON UPDATE CASCADE, \"mediaId\" UUID NOT NULL REFERENCES \"media\" (\"id\") ON DELETE CASCADE ON UPDATE CASCADE, \"sortOrder\" INTEGER NOT NULL DEFAULT 0, \"createdAt\" TIMESTAMP WITH TIME ZONE NOT NULL, \"updatedAt\" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY (\"id\"));");
    await queryInterface.sequelize.query("CREATE UNIQUE INDEX \"post_comment_media_comment_id_media_id\" ON \"post_comment_media\" (\"commentId\", \"mediaId\")");
  },

  async down(queryInterface) {
    await queryInterface.dropTable("post_comment_media");
  },
};
