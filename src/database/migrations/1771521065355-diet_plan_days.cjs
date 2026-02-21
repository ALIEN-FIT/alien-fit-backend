'use strict';

module.exports = {
  async up(queryInterface) {
    const existingTablesRaw = await queryInterface.showAllTables();
    const existingTables = existingTablesRaw.map((table) => typeof table === 'string' ? table : table.tableName);
    if (existingTables.includes("diet_plan_days")) {
      return;
    }


    await queryInterface.sequelize.query("CREATE TABLE IF NOT EXISTS \"diet_plan_days\" (\"id\" UUID , \"planId\" UUID NOT NULL REFERENCES \"diet_plans\" (\"id\") ON DELETE CASCADE ON UPDATE CASCADE, \"dayIndex\" INTEGER NOT NULL, \"date\" TIMESTAMP WITH TIME ZONE NOT NULL, \"weekNumber\" INTEGER NOT NULL, \"createdAt\" TIMESTAMP WITH TIME ZONE NOT NULL, \"updatedAt\" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY (\"id\"));");
    await queryInterface.sequelize.query("CREATE UNIQUE INDEX \"diet_plan_days_plan_id_day_index\" ON \"diet_plan_days\" (\"planId\", \"dayIndex\")");
    await queryInterface.sequelize.query("CREATE UNIQUE INDEX \"diet_plan_days_plan_id_date\" ON \"diet_plan_days\" (\"planId\", \"date\")");
  },

  async down(queryInterface) {
    await queryInterface.dropTable("diet_plan_days");
  },
};
