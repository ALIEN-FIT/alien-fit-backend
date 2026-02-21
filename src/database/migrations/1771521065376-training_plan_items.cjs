'use strict';

module.exports = {
  async up(queryInterface) {
    const existingTablesRaw = await queryInterface.showAllTables();
    const existingTables = existingTablesRaw.map((table) => typeof table === 'string' ? table : table.tableName);
    if (existingTables.includes("training_plan_items")) {
      return;
    }

    await queryInterface.sequelize.query("DO 'BEGIN CREATE TYPE \"public\".\"enum_training_plan_items_itemType\" AS ENUM(''REGULAR'', ''SUPERSET'', ''DROPSET'', ''CIRCUIT''); EXCEPTION WHEN duplicate_object THEN null; END';");
    await queryInterface.sequelize.query("CREATE TABLE IF NOT EXISTS \"training_plan_items\" (\"id\" UUID , \"dayId\" UUID NOT NULL REFERENCES \"training_plan_days\" (\"id\") ON DELETE CASCADE ON UPDATE CASCADE, \"order\" INTEGER NOT NULL, \"trainingVideoId\" UUID NOT NULL REFERENCES \"training_videos\" (\"id\") ON DELETE NO ACTION ON UPDATE CASCADE, \"title\" VARCHAR(255) NOT NULL, \"videoLink\" VARCHAR(255), \"description\" TEXT, \"duration\" INTEGER, \"repeats\" INTEGER, \"sets\" INTEGER NOT NULL, \"isSuperset\" BOOLEAN DEFAULT false, \"supersetItems\" JSONB, \"itemType\" \"public\".\"enum_training_plan_items_itemType\" NOT NULL DEFAULT 'REGULAR', \"extraVideos\" JSONB, \"dropsetConfig\" JSONB, \"circuitGroup\" VARCHAR(255), \"createdAt\" TIMESTAMP WITH TIME ZONE NOT NULL, \"updatedAt\" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY (\"id\"));");
    await queryInterface.sequelize.query("CREATE UNIQUE INDEX \"training_plan_items_day_id_order\" ON \"training_plan_items\" (\"dayId\", \"order\")");
  },

  async down(queryInterface) {
    await queryInterface.dropTable("training_plan_items");
  },
};
