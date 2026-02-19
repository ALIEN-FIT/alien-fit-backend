'use strict';

module.exports = {
  async up(queryInterface) {
    const existingTablesRaw = await queryInterface.showAllTables();
    const existingTables = existingTablesRaw.map((table) => typeof table === 'string' ? table : table.tableName);
    if (existingTables.includes("plan_update_requests")) {
      return;
    }

    await queryInterface.sequelize.query("DO 'BEGIN CREATE TYPE \"public\".\"enum_plan_update_requests_status\" AS ENUM(''pending'', ''approved'', ''rejected''); EXCEPTION WHEN duplicate_object THEN null; END';");
    await queryInterface.sequelize.query("CREATE TABLE IF NOT EXISTS \"plan_update_requests\" (\"id\" UUID , \"userId\" UUID NOT NULL REFERENCES \"users\" (\"id\") ON DELETE CASCADE ON UPDATE CASCADE, \"status\" \"public\".\"enum_plan_update_requests_status\" DEFAULT 'pending', \"type\" VARCHAR(255) NOT NULL, \"payload\" JSONB, \"notes\" TEXT, \"approvedBy\" UUID, \"approvedAt\" TIMESTAMP WITH TIME ZONE, \"createdAt\" TIMESTAMP WITH TIME ZONE NOT NULL, \"updatedAt\" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY (\"id\"));");
    await queryInterface.sequelize.query("CREATE INDEX \"plan_update_requests_user_id\" ON \"plan_update_requests\" (\"userId\")");
    await queryInterface.sequelize.query("CREATE INDEX \"plan_update_requests_status\" ON \"plan_update_requests\" (\"status\")");
  },

  async down(queryInterface) {
    await queryInterface.dropTable("plan_update_requests");
  },
};
