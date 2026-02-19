'use strict';

module.exports = {
  async up(queryInterface) {
    const existingTablesRaw = await queryInterface.showAllTables();
    const existingTables = existingTablesRaw.map((table) => typeof table === 'string' ? table : table.tableName);
    if (existingTables.includes("admin_settings")) {
      return;
    }


    await queryInterface.sequelize.query("CREATE TABLE IF NOT EXISTS \"admin_settings\" (\"id\" UUID , \"settingKey\" VARCHAR(255) NOT NULL UNIQUE, \"settingValue\" TEXT NOT NULL, \"createdAt\" TIMESTAMP WITH TIME ZONE NOT NULL, \"updatedAt\" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY (\"id\"));");
    await queryInterface.sequelize.query("CREATE UNIQUE INDEX \"admin_settings_setting_key\" ON \"admin_settings\" (\"settingKey\")");
  },

  async down(queryInterface) {
    await queryInterface.dropTable("admin_settings");
  },
};
