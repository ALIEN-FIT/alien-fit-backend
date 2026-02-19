'use strict';

module.exports = {
  async up(queryInterface) {
    const existingTablesRaw = await queryInterface.showAllTables();
    const existingTables = existingTablesRaw.map((table) => typeof table === 'string' ? table : table.tableName);
    if (existingTables.includes("app_versions")) {
      return;
    }


    await queryInterface.sequelize.query("CREATE TABLE IF NOT EXISTS \"app_versions\" (\"id\" UUID , \"platform\" VARCHAR(255) NOT NULL, \"latestVersion\" VARCHAR(255) NOT NULL, \"minAllowedVersion\" VARCHAR(255), \"apkKey\" VARCHAR(255), \"apkUrl\" VARCHAR(255), \"isMandatory\" BOOLEAN NOT NULL DEFAULT false, \"releaseNotes\" JSON, \"metadata\" JSON, \"createdAt\" TIMESTAMP WITH TIME ZONE NOT NULL, \"updatedAt\" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY (\"id\"));");

  },

  async down(queryInterface) {
    await queryInterface.dropTable("app_versions");
  },
};
