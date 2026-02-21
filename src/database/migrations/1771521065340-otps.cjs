'use strict';

module.exports = {
  async up(queryInterface) {
    const existingTablesRaw = await queryInterface.showAllTables();
    const existingTables = existingTablesRaw.map((table) => typeof table === 'string' ? table : table.tableName);
    if (existingTables.includes("otps")) {
      return;
    }


    await queryInterface.sequelize.query("CREATE TABLE IF NOT EXISTS \"otps\" (\"id\" UUID , \"phone\" VARCHAR(255) NOT NULL, \"otp\" VARCHAR(6) NOT NULL, \"expiresAt\" TIMESTAMP WITH TIME ZONE NOT NULL, \"isUsed\" BOOLEAN DEFAULT false, \"attempts\" INTEGER DEFAULT 0, \"createdAt\" TIMESTAMP WITH TIME ZONE NOT NULL, \"updatedAt\" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY (\"id\"));");
    await queryInterface.sequelize.query("CREATE INDEX \"otps_phone\" ON \"otps\" (\"phone\")");
    await queryInterface.sequelize.query("CREATE INDEX \"otps_expires_at\" ON \"otps\" (\"expiresAt\")");
  },

  async down(queryInterface) {
    await queryInterface.dropTable("otps");
  },
};
