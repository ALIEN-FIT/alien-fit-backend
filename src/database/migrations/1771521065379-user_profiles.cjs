'use strict';

module.exports = {
  async up(queryInterface) {
    const existingTablesRaw = await queryInterface.showAllTables();
    const existingTables = existingTablesRaw.map((table) => typeof table === 'string' ? table : table.tableName);
    if (existingTables.includes("user_profiles")) {
      return;
    }


    await queryInterface.sequelize.query("CREATE TABLE IF NOT EXISTS \"user_profiles\" (\"id\" UUID , \"userId\" UUID NOT NULL UNIQUE REFERENCES \"users\" (\"id\") ON DELETE CASCADE ON UPDATE CASCADE, \"whatDoYouWantToAchieve\" VARCHAR(255), \"goal\" VARCHAR(255), \"activityLevel\" VARCHAR(255), \"trainingLevel\" VARCHAR(255), \"bodyFat\" VARCHAR(255), \"trainingSite\" VARCHAR(255), \"preferredWorkoutTime\" JSONB, \"tools\" JSONB, \"injuries\" JSONB, \"diseases\" JSONB, \"workOutBefore\" BOOLEAN, \"useSupplements\" BOOLEAN, \"intolerances\" JSONB, \"preferredFood\" JSONB, \"training\" JSONB, \"bodyImages\" JSONB, \"createdAt\" TIMESTAMP WITH TIME ZONE NOT NULL, \"updatedAt\" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY (\"id\"));");

  },

  async down(queryInterface) {
    await queryInterface.dropTable("user_profiles");
  },
};
