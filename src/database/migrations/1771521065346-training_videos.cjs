'use strict';

module.exports = {
  async up(queryInterface) {
    const existingTablesRaw = await queryInterface.showAllTables();
    const existingTables = existingTablesRaw.map((table) => typeof table === 'string' ? table : table.tableName);
    if (existingTables.includes("training_videos")) {
      return;
    }


    await queryInterface.sequelize.query("CREATE TABLE IF NOT EXISTS \"training_videos\" (\"id\" UUID , \"title\" VARCHAR(255) NOT NULL, \"description\" TEXT, \"videoUrl\" VARCHAR(255) NOT NULL, \"youtubeVideoId\" VARCHAR(255) UNIQUE, \"isActive\" BOOLEAN NOT NULL DEFAULT false, \"createdAt\" TIMESTAMP WITH TIME ZONE NOT NULL, \"updatedAt\" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY (\"id\"));");

  },

  async down(queryInterface) {
    await queryInterface.dropTable("training_videos");
  },
};
