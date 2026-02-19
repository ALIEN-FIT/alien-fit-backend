'use strict';

module.exports = {
  async up(queryInterface) {
    const existingTablesRaw = await queryInterface.showAllTables();
    const existingTables = existingTablesRaw.map((table) => typeof table === 'string' ? table : table.tableName);
    if (existingTables.includes("training_tags")) {
      return;
    }


    await queryInterface.sequelize.query("CREATE TABLE IF NOT EXISTS \"training_tags\" (\"id\" UUID , \"title\" VARCHAR(255) NOT NULL UNIQUE, \"description\" TEXT, \"imageId\" UUID NOT NULL REFERENCES \"media\" (\"id\") ON DELETE NO ACTION ON UPDATE CASCADE, \"createdAt\" TIMESTAMP WITH TIME ZONE NOT NULL, \"updatedAt\" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY (\"id\"));");

  },

  async down(queryInterface) {
    await queryInterface.dropTable("training_tags");
  },
};
