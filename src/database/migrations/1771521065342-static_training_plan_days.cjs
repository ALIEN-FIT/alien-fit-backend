'use strict';

module.exports = {
  async up(queryInterface) {
    const existingTablesRaw = await queryInterface.showAllTables();
    const existingTables = existingTablesRaw.map((table) => typeof table === 'string' ? table : table.tableName);
    if (existingTables.includes("static_training_plan_days")) {
      return;
    }


    await queryInterface.sequelize.query("CREATE TABLE IF NOT EXISTS \"static_training_plan_days\" (\"id\" UUID , \"planId\" UUID NOT NULL REFERENCES \"static_training_plans\" (\"id\") ON DELETE CASCADE ON UPDATE CASCADE, \"dayIndex\" INTEGER NOT NULL, \"weekNumber\" INTEGER NOT NULL DEFAULT 1, \"createdAt\" TIMESTAMP WITH TIME ZONE NOT NULL, \"updatedAt\" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY (\"id\"));");
    await queryInterface.sequelize.query("CREATE UNIQUE INDEX \"static_training_plan_days_plan_id_day_index\" ON \"static_training_plan_days\" (\"planId\", \"dayIndex\")");
  },

  async down(queryInterface) {
    await queryInterface.dropTable("static_training_plan_days");
  },
};
