'use strict';

module.exports = {
  async up(queryInterface) {
    const existingTablesRaw = await queryInterface.showAllTables();
    const existingTables = existingTablesRaw.map((table) => typeof table === 'string' ? table : table.tableName);
    if (existingTables.includes("post_saves")) {
      return;
    }


    await queryInterface.sequelize.query("CREATE TABLE IF NOT EXISTS \"post_saves\" (\"id\" UUID , \"postId\" UUID NOT NULL REFERENCES \"posts\" (\"id\") ON DELETE CASCADE ON UPDATE CASCADE, \"userId\" UUID NOT NULL REFERENCES \"users\" (\"id\") ON DELETE NO ACTION ON UPDATE CASCADE, \"createdAt\" TIMESTAMP WITH TIME ZONE NOT NULL, \"updatedAt\" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY (\"id\"));");
    await queryInterface.sequelize.query("CREATE UNIQUE INDEX \"post_saves_post_id_user_id\" ON \"post_saves\" (\"postId\", \"userId\")");
  },

  async down(queryInterface) {
    await queryInterface.dropTable("post_saves");
  },
};
