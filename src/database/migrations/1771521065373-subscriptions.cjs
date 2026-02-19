'use strict';

module.exports = {
  async up(queryInterface) {
    const existingTablesRaw = await queryInterface.showAllTables();
    const existingTables = existingTablesRaw.map((table) => typeof table === 'string' ? table : table.tableName);
    if (existingTables.includes("subscriptions")) {
      return;
    }


    await queryInterface.sequelize.query("CREATE TABLE IF NOT EXISTS \"subscriptions\" (\"id\" UUID , \"userId\" UUID NOT NULL UNIQUE REFERENCES \"users\" (\"id\") ON DELETE CASCADE ON UPDATE CASCADE, \"isSubscribed\" BOOLEAN DEFAULT false, \"startDate\" TIMESTAMP WITH TIME ZONE, \"endDate\" TIMESTAMP WITH TIME ZONE, \"lastProfileUpdateAt\" TIMESTAMP WITH TIME ZONE, \"nextProfileUpdateDue\" TIMESTAMP WITH TIME ZONE, \"isActive\" BOOLEAN DEFAULT false, \"isFree\" BOOLEAN DEFAULT false, \"freeDays\" INTEGER DEFAULT 0, \"planType\" VARCHAR(20) NOT NULL DEFAULT 'both', \"createdAt\" TIMESTAMP WITH TIME ZONE NOT NULL, \"updatedAt\" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY (\"id\"));");
    await queryInterface.sequelize.query("CREATE UNIQUE INDEX \"subscriptions_user_id\" ON \"subscriptions\" (\"userId\")");
    await queryInterface.sequelize.query("CREATE INDEX \"subscriptions_is_active\" ON \"subscriptions\" (\"isActive\")");
  },

  async down(queryInterface) {
    await queryInterface.dropTable("subscriptions");
  },
};
