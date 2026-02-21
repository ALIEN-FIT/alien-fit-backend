'use strict';

module.exports = {
  async up(queryInterface) {
    const existingTablesRaw = await queryInterface.showAllTables();
    const existingTables = existingTablesRaw.map((table) => typeof table === 'string' ? table : table.tableName);
    if (existingTables.includes("post_comment_reports")) {
      return;
    }

    await queryInterface.sequelize.query("DO 'BEGIN CREATE TYPE \"public\".\"enum_post_comment_reports_status\" AS ENUM(''pending'', ''reviewed'', ''dismissed''); EXCEPTION WHEN duplicate_object THEN null; END';");
    await queryInterface.sequelize.query("CREATE TABLE IF NOT EXISTS \"post_comment_reports\" (\"id\" UUID , \"commentId\" UUID NOT NULL REFERENCES \"post_comments\" (\"id\") ON DELETE CASCADE ON UPDATE CASCADE, \"userId\" UUID NOT NULL REFERENCES \"users\" (\"id\") ON DELETE NO ACTION ON UPDATE CASCADE, \"reason\" TEXT, \"status\" \"public\".\"enum_post_comment_reports_status\" NOT NULL DEFAULT 'pending', \"createdAt\" TIMESTAMP WITH TIME ZONE NOT NULL, \"updatedAt\" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY (\"id\"));");
    await queryInterface.sequelize.query("CREATE INDEX \"post_comment_reports_comment_id\" ON \"post_comment_reports\" (\"commentId\")");
    await queryInterface.sequelize.query("CREATE UNIQUE INDEX \"post_comment_reports_comment_id_user_id\" ON \"post_comment_reports\" (\"commentId\", \"userId\")");
  },

  async down(queryInterface) {
    await queryInterface.dropTable("post_comment_reports");
  },
};
