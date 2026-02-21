'use strict';

module.exports = {
  async up(queryInterface) {
    const existingTablesRaw = await queryInterface.showAllTables();
    const existingTables = existingTablesRaw.map((table) => typeof table === 'string' ? table : table.tableName);
    if (existingTables.includes("diet_plans")) {
      return;
    }


    await queryInterface.sequelize.query("CREATE TABLE IF NOT EXISTS \"diet_plans\" (\"id\" UUID , \"userId\" UUID REFERENCES \"users\" (\"id\") ON DELETE CASCADE ON UPDATE CASCADE, \"startDate\" TIMESTAMP WITH TIME ZONE NOT NULL, \"endDate\" TIMESTAMP WITH TIME ZONE NOT NULL, \"recommendedWaterIntakeMl\" INTEGER, \"createdAt\" TIMESTAMP WITH TIME ZONE NOT NULL, \"updatedAt\" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY (\"id\"));");

  },

  async down(queryInterface) {
    await queryInterface.dropTable("diet_plans");
  },
};
