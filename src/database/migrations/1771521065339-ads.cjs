'use strict';

module.exports = {
  async up(queryInterface) {
    const existingTablesRaw = await queryInterface.showAllTables();
    const existingTables = existingTablesRaw.map((table) => typeof table === 'string' ? table : table.tableName);
    if (existingTables.includes("ads")) {
      return;
    }

    await queryInterface.sequelize.query("DO 'BEGIN CREATE TYPE \"public\".\"enum_ads_discountType\" AS ENUM(''percentage'', ''fixed''); EXCEPTION WHEN duplicate_object THEN null; END';");
    await queryInterface.sequelize.query("CREATE TABLE IF NOT EXISTS \"ads\" (\"id\" UUID , \"imageId\" UUID NOT NULL REFERENCES \"media\" (\"id\") ON DELETE NO ACTION ON UPDATE CASCADE, \"appName\" VARCHAR(255) NOT NULL, \"link\" VARCHAR(2048) DEFAULT NULL, \"promoCode\" VARCHAR(100) DEFAULT NULL, \"discountAmount\" DECIMAL(10,2) NOT NULL DEFAULT 0, \"discountType\" \"public\".\"enum_ads_discountType\" NOT NULL DEFAULT 'percentage', \"startDate\" TIMESTAMP WITH TIME ZONE NOT NULL, \"endDate\" TIMESTAMP WITH TIME ZONE NOT NULL, \"priority\" INTEGER NOT NULL DEFAULT 0, \"isActive\" BOOLEAN NOT NULL DEFAULT true, \"viewCount\" INTEGER NOT NULL DEFAULT 0, \"clickCount\" INTEGER NOT NULL DEFAULT 0, \"promoCopyCount\" INTEGER NOT NULL DEFAULT 0, \"uniqueViewersCount\" INTEGER NOT NULL DEFAULT 0, \"createdAt\" TIMESTAMP WITH TIME ZONE NOT NULL, \"updatedAt\" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY (\"id\"));");
    await queryInterface.sequelize.query("CREATE INDEX \"ads_is_active\" ON \"ads\" (\"isActive\")");
    await queryInterface.sequelize.query("CREATE INDEX \"ads_priority\" ON \"ads\" (\"priority\")");
    await queryInterface.sequelize.query("CREATE INDEX \"ads_start_date\" ON \"ads\" (\"startDate\")");
    await queryInterface.sequelize.query("CREATE INDEX \"ads_end_date\" ON \"ads\" (\"endDate\")");
  },

  async down(queryInterface) {
    await queryInterface.dropTable("ads");
  },
};
