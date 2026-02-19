'use strict';

module.exports = {
  async up(queryInterface) {
    const existingTablesRaw = await queryInterface.showAllTables();
    const existingTables = existingTablesRaw.map((table) => typeof table === 'string' ? table : table.tableName);
    if (existingTables.includes("static_training_plan_items")) {
      return;
    }


    await queryInterface.sequelize.query("CREATE TABLE IF NOT EXISTS \"static_training_plan_items\" (\"id\" UUID , \"dayId\" UUID NOT NULL REFERENCES \"static_training_plan_days\" (\"id\") ON DELETE CASCADE ON UPDATE CASCADE, \"order\" INTEGER NOT NULL, \"title\" VARCHAR(255) NOT NULL, \"videoLink\" VARCHAR(255), \"description\" TEXT, \"duration\" INTEGER, \"repeats\" INTEGER, \"sets\" INTEGER NOT NULL, \"trainingVideoId\" UUID NOT NULL REFERENCES \"training_videos\" (\"id\") ON DELETE NO ACTION ON UPDATE CASCADE, \"isSuperset\" BOOLEAN DEFAULT false, \"supersetItems\" JSONB, \"createdAt\" TIMESTAMP WITH TIME ZONE NOT NULL, \"updatedAt\" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY (\"id\"));");
    await queryInterface.sequelize.query("CREATE UNIQUE INDEX \"static_training_plan_items_day_id_order\" ON \"static_training_plan_items\" (\"dayId\", \"order\")");
  },

  async down(queryInterface) {
    await queryInterface.dropTable("static_training_plan_items");
  },
};
