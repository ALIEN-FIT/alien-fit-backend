'use strict';

module.exports = {
  async up(queryInterface) {
    const existingTablesRaw = await queryInterface.showAllTables();
    const existingTables = existingTablesRaw.map((table) => typeof table === 'string' ? table : table.tableName);
    if (existingTables.includes("message_media")) {
      return;
    }


    await queryInterface.sequelize.query("CREATE TABLE IF NOT EXISTS \"message_media\" (\"id\" UUID , \"messageId\" UUID NOT NULL REFERENCES \"messages\" (\"id\") ON DELETE CASCADE ON UPDATE CASCADE, \"mediaId\" UUID NOT NULL REFERENCES \"media\" (\"id\") ON DELETE CASCADE ON UPDATE CASCADE, \"sortOrder\" INTEGER NOT NULL DEFAULT 0, \"createdAt\" TIMESTAMP WITH TIME ZONE NOT NULL, \"updatedAt\" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY (\"id\"));");
    await queryInterface.sequelize.query("CREATE UNIQUE INDEX \"message_media_message_id_media_id\" ON \"message_media\" (\"messageId\", \"mediaId\")");
  },

  async down(queryInterface) {
    await queryInterface.dropTable("message_media");
  },
};
