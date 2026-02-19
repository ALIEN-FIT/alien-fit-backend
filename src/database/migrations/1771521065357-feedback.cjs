'use strict';

module.exports = {
  async up(queryInterface) {
    const existingTablesRaw = await queryInterface.showAllTables();
    const existingTables = existingTablesRaw.map((table) => typeof table === 'string' ? table : table.tableName);
    if (existingTables.includes("feedback")) {
      return;
    }

    await queryInterface.sequelize.query("DO 'BEGIN CREATE TYPE \"public\".\"enum_feedback_type\" AS ENUM(''compliment'', ''suggestion'', ''complaint''); EXCEPTION WHEN duplicate_object THEN null; END';");
    await queryInterface.sequelize.query("DO 'BEGIN CREATE TYPE \"public\".\"enum_feedback_status\" AS ENUM(''open'', ''in-progress'', ''resolved''); EXCEPTION WHEN duplicate_object THEN null; END';");
    await queryInterface.sequelize.query("CREATE TABLE IF NOT EXISTS \"feedback\" (\"id\" UUID , \"userId\" UUID REFERENCES \"users\" (\"id\") ON DELETE SET NULL ON UPDATE CASCADE, \"guestName\" VARCHAR(255), \"guestPhone\" VARCHAR(50), \"type\" \"public\".\"enum_feedback_type\" NOT NULL, \"body\" TEXT NOT NULL, \"status\" \"public\".\"enum_feedback_status\" NOT NULL DEFAULT 'open', \"adminReply\" TEXT, \"repliedBy\" UUID, \"repliedAt\" TIMESTAMP WITH TIME ZONE, \"createdAt\" TIMESTAMP WITH TIME ZONE NOT NULL, \"updatedAt\" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY (\"id\"));");
    await queryInterface.sequelize.query("CREATE INDEX \"feedback_user_id\" ON \"feedback\" (\"userId\")");
    await queryInterface.sequelize.query("CREATE INDEX \"feedback_status\" ON \"feedback\" (\"status\")");
    await queryInterface.sequelize.query("CREATE INDEX \"feedback_type\" ON \"feedback\" (\"type\")");
    await queryInterface.sequelize.query("CREATE INDEX \"feedback_created_at\" ON \"feedback\" (\"createdAt\")");
  },

  async down(queryInterface) {
    await queryInterface.dropTable("feedback");
  },
};
