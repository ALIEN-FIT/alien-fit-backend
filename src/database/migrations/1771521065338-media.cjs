'use strict';

module.exports = {
  async up(queryInterface) {
    const existingTablesRaw = await queryInterface.showAllTables();
    const existingTables = existingTablesRaw.map((table) => typeof table === 'string' ? table : table.tableName);
    if (existingTables.includes("media")) {
      return;
    }

    await queryInterface.sequelize.query("DO 'BEGIN CREATE TYPE \"public\".\"enum_media_mediaType\" AS ENUM(''image'', ''video'', ''document'', ''audio''); EXCEPTION WHEN duplicate_object THEN null; END';");
    await queryInterface.sequelize.query("CREATE TABLE IF NOT EXISTS \"media\" (\"id\" UUID , \"key\" VARCHAR(255) NOT NULL, \"url\" VARCHAR(255) NOT NULL, \"originalName\" VARCHAR(255), \"contentType\" VARCHAR(255) NOT NULL, \"mediaType\" \"public\".\"enum_media_mediaType\" NOT NULL, \"size\" INTEGER, \"thumbnails\" JSON, \"metadata\" JSON, \"createdAt\" TIMESTAMP WITH TIME ZONE NOT NULL, \"updatedAt\" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY (\"id\"));");

  },

  async down(queryInterface) {
    await queryInterface.dropTable("media");
  },
};
