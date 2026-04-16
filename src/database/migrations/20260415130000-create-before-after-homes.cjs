'use strict';

module.exports = {
  async up(queryInterface) {
    const existingTablesRaw = await queryInterface.showAllTables();
    const existingTables = existingTablesRaw.map((table) => typeof table === 'string' ? table : table.tableName);
    if (existingTables.includes('before_after_homes')) {
      return;
    }

    await queryInterface.sequelize.query(
      'CREATE TABLE IF NOT EXISTS "before_after_homes" (' +
      '"id" UUID,' +
      '"beforeImageId" UUID NOT NULL REFERENCES "media" ("id") ON DELETE NO ACTION ON UPDATE CASCADE,' +
      '"afterImageId" UUID NOT NULL REFERENCES "media" ("id") ON DELETE NO ACTION ON UPDATE CASCADE,' +
      '"title" VARCHAR(255) DEFAULT NULL,' +
      '"description" TEXT DEFAULT NULL,' +
      '"priority" INTEGER NOT NULL DEFAULT 0,' +
      '"isActive" BOOLEAN NOT NULL DEFAULT true,' +
      '"transformationTimeInDays" INTEGER NOT NULL,' +
      '"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,' +
      '"updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,' +
      'PRIMARY KEY ("id")' +
      ');'
    );
    await queryInterface.sequelize.query('CREATE INDEX "before_after_homes_is_active" ON "before_after_homes" ("isActive")');
    await queryInterface.sequelize.query('CREATE INDEX "before_after_homes_priority" ON "before_after_homes" ("priority")');
  },

  async down(queryInterface) {
    await queryInterface.dropTable('before_after_homes');
  },
};
