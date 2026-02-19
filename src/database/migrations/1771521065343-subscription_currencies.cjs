'use strict';

module.exports = {
  async up(queryInterface) {
    const existingTablesRaw = await queryInterface.showAllTables();
    const existingTables = existingTablesRaw.map((table) => typeof table === 'string' ? table : table.tableName);
    if (existingTables.includes("subscription_currencies")) {
      return;
    }


    await queryInterface.sequelize.query("CREATE TABLE IF NOT EXISTS \"subscription_currencies\" (\"code\" VARCHAR(10) NOT NULL , \"isActive\" BOOLEAN DEFAULT true, \"createdAt\" TIMESTAMP WITH TIME ZONE NOT NULL, \"updatedAt\" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY (\"code\"));");
    await queryInterface.sequelize.query("CREATE INDEX \"subscription_currencies_is_active\" ON \"subscription_currencies\" (\"isActive\")");
  },

  async down(queryInterface) {
    await queryInterface.dropTable("subscription_currencies");
  },
};
