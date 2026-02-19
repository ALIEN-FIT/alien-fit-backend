'use strict';

module.exports = {
  async up(queryInterface) {
    const existingTablesRaw = await queryInterface.showAllTables();
    const existingTables = existingTablesRaw.map((table) => typeof table === 'string' ? table : table.tableName);
    if (existingTables.includes("daily_tracking")) {
      return;
    }


    await queryInterface.sequelize.query("CREATE TABLE IF NOT EXISTS \"daily_tracking\" (\"id\" UUID , \"userId\" UUID NOT NULL REFERENCES \"users\" (\"id\") ON DELETE CASCADE ON UPDATE CASCADE, \"date\" DATE NOT NULL, \"trainingDone\" BOOLEAN DEFAULT false, \"dietDone\" BOOLEAN DEFAULT false, \"waterIntakeMl\" INTEGER NOT NULL DEFAULT 0, \"waterIntakeRecords\" JSONB NOT NULL DEFAULT '[]', \"trainingCompletedItemIds\" JSONB DEFAULT '[]', \"dietCompletedItemIds\" JSONB DEFAULT '[]', \"extraTrainingEntries\" JSONB DEFAULT '[]', \"extraFoodEntries\" JSONB DEFAULT '[]', \"createdAt\" TIMESTAMP WITH TIME ZONE NOT NULL, \"updatedAt\" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY (\"id\"));");
    await queryInterface.sequelize.query("CREATE UNIQUE INDEX \"daily_tracking_user_id_date\" ON \"daily_tracking\" (\"userId\", \"date\")");
  },

  async down(queryInterface) {
    await queryInterface.dropTable("daily_tracking");
  },
};
