'use strict';

module.exports = {
  async up(queryInterface) {
    const existingTablesRaw = await queryInterface.showAllTables();
    const existingTables = existingTablesRaw.map((table) => typeof table === 'string' ? table : table.tableName);
    if (existingTables.includes("diet_meal_items")) {
      return;
    }


    await queryInterface.sequelize.query("CREATE TABLE IF NOT EXISTS \"diet_meal_items\" (\"id\" UUID , \"dayId\" UUID NOT NULL REFERENCES \"diet_plan_days\" (\"id\") ON DELETE CASCADE ON UPDATE CASCADE, \"mealName\" VARCHAR(255) NOT NULL, \"order\" INTEGER NOT NULL, \"foods\" JSONB NOT NULL DEFAULT '[]', \"createdAt\" TIMESTAMP WITH TIME ZONE NOT NULL, \"updatedAt\" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY (\"id\"));");
    await queryInterface.sequelize.query("CREATE UNIQUE INDEX \"diet_meal_items_day_id_meal_name_order\" ON \"diet_meal_items\" (\"dayId\", \"mealName\", \"order\")");
  },

  async down(queryInterface) {
    await queryInterface.dropTable("diet_meal_items");
  },
};
