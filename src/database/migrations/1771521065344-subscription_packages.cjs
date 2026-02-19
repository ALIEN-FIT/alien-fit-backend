'use strict';

module.exports = {
  async up(queryInterface) {
    const existingTablesRaw = await queryInterface.showAllTables();
    const existingTables = existingTablesRaw.map((table) => typeof table === 'string' ? table : table.tableName);
    if (existingTables.includes("subscription_packages")) {
      return;
    }


    await queryInterface.sequelize.query("CREATE TABLE IF NOT EXISTS \"subscription_packages\" (\"id\" UUID , \"name\" VARCHAR(120) NOT NULL, \"description\" TEXT, \"planTypes\" JSON NOT NULL DEFAULT '[\"both\"]', \"prices\" JSON NOT NULL DEFAULT '{}', \"features\" JSON NOT NULL DEFAULT '[]', \"cycles\" INTEGER NOT NULL DEFAULT 1, \"isActive\" BOOLEAN DEFAULT true, \"createdAt\" TIMESTAMP WITH TIME ZONE NOT NULL, \"updatedAt\" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY (\"id\"));");
    await queryInterface.sequelize.query("CREATE INDEX \"subscription_packages_is_active\" ON \"subscription_packages\" (\"isActive\")");
    await queryInterface.sequelize.query("CREATE INDEX \"subscription_packages_name\" ON \"subscription_packages\" (\"name\")");
  },

  async down(queryInterface) {
    await queryInterface.dropTable("subscription_packages");
  },
};
