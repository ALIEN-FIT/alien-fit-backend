'use strict';

module.exports = {
  async up(queryInterface) {
    const existingTablesRaw = await queryInterface.showAllTables();
    const existingTables = existingTablesRaw.map((table) => typeof table === 'string' ? table : table.tableName);
    if (existingTables.includes("static_training_plan_trainings")) {
      return;
    }

    await queryInterface.sequelize.query("DO 'BEGIN CREATE TYPE \"public\".\"enum_static_training_plan_trainings_type\" AS ENUM(''REGULAR'', ''SUPERSET'', ''DROPSET'', ''CIRCUIT''); EXCEPTION WHEN duplicate_object THEN null; END';");
    await queryInterface.sequelize.query("CREATE TABLE IF NOT EXISTS \"static_training_plan_trainings\" (\"id\" UUID , \"planId\" UUID NOT NULL REFERENCES \"static_training_plans\" (\"id\") ON DELETE CASCADE ON UPDATE CASCADE, \"order\" INTEGER NOT NULL, \"type\" \"public\".\"enum_static_training_plan_trainings_type\" NOT NULL DEFAULT 'REGULAR', \"title\" VARCHAR(255), \"description\" TEXT, \"sets\" INTEGER, \"repeats\" INTEGER, \"duration\" INTEGER, \"trainingVideoId\" UUID REFERENCES \"training_videos\" (\"id\") ON DELETE SET NULL ON UPDATE CASCADE, \"items\" JSONB, \"config\" JSONB, \"createdAt\" TIMESTAMP WITH TIME ZONE NOT NULL, \"updatedAt\" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY (\"id\"));");
    await queryInterface.sequelize.query("CREATE UNIQUE INDEX \"static_training_plan_trainings_plan_id_order\" ON \"static_training_plan_trainings\" (\"planId\", \"order\")");
  },

  async down(queryInterface) {
    await queryInterface.dropTable("static_training_plan_trainings");
  },
};
