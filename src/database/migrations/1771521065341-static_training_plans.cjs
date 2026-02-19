'use strict';

module.exports = {
  async up(queryInterface) {
    const existingTablesRaw = await queryInterface.showAllTables();
    const existingTables = existingTablesRaw.map((table) => typeof table === 'string' ? table : table.tableName);
    if (existingTables.includes("static_training_plans")) {
      return;
    }


    await queryInterface.sequelize.query("CREATE TABLE IF NOT EXISTS \"static_training_plans\" (\"id\" UUID , \"name\" VARCHAR(255) NOT NULL, \"subTitle\" VARCHAR(255), \"description\" TEXT, \"imageId\" UUID NOT NULL, \"durationInMinutes\" INTEGER, \"level\" VARCHAR(255), \"createdAt\" TIMESTAMP WITH TIME ZONE NOT NULL, \"updatedAt\" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY (\"id\"));");

  },

  async down(queryInterface) {
    await queryInterface.dropTable("static_training_plans");
  },
};
