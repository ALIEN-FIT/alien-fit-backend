'use strict';

module.exports = {
  async up(queryInterface) {
    const existingTablesRaw = await queryInterface.showAllTables();
    const existingTables = existingTablesRaw.map((table) => typeof table === 'string' ? table : table.tableName);
    if (existingTables.includes("ad_views")) {
      return;
    }


    await queryInterface.sequelize.query("CREATE TABLE IF NOT EXISTS \"ad_views\" (\"id\" UUID , \"adId\" UUID NOT NULL REFERENCES \"ads\" (\"id\") ON DELETE CASCADE ON UPDATE CASCADE, \"userId\" UUID NOT NULL REFERENCES \"users\" (\"id\") ON DELETE NO ACTION ON UPDATE CASCADE, \"firstSeenAt\" TIMESTAMP WITH TIME ZONE NOT NULL, \"createdAt\" TIMESTAMP WITH TIME ZONE NOT NULL, \"updatedAt\" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY (\"id\"));");
    await queryInterface.sequelize.query("CREATE UNIQUE INDEX \"ad_views_ad_id_user_id\" ON \"ad_views\" (\"adId\", \"userId\")");
    await queryInterface.sequelize.query("CREATE INDEX \"ad_views_ad_id\" ON \"ad_views\" (\"adId\")");
    await queryInterface.sequelize.query("CREATE INDEX \"ad_views_user_id\" ON \"ad_views\" (\"userId\")");
  },

  async down(queryInterface) {
    await queryInterface.dropTable("ad_views");
  },
};
