'use strict';

module.exports = {
  async up(queryInterface) {
    const existingTablesRaw = await queryInterface.showAllTables();
    const existingTables = existingTablesRaw.map((table) => typeof table === 'string' ? table : table.tableName);
    if (existingTables.includes("users")) {
      return;
    }

    await queryInterface.sequelize.query("DO 'BEGIN CREATE TYPE \"public\".\"enum_users_role\" AS ENUM(''admin'', ''trainer'', ''user''); EXCEPTION WHEN duplicate_object THEN null; END';");
    await queryInterface.sequelize.query("CREATE TABLE IF NOT EXISTS \"users\" (\"id\" UUID , \"provider\" VARCHAR(255) NOT NULL UNIQUE, \"password\" VARCHAR(255), \"name\" VARCHAR(255) NOT NULL, \"role\" \"public\".\"enum_users_role\" DEFAULT 'user', \"height\" INTEGER DEFAULT 0, \"weight\" INTEGER DEFAULT 0, \"age\" INTEGER, \"gender\" VARCHAR(255), \"googleId\" VARCHAR(255) UNIQUE, \"isVerified\" BOOLEAN DEFAULT false, \"isBlocked\" BOOLEAN DEFAULT false, \"isProfileComplete\" BOOLEAN DEFAULT false, \"imageId\" UUID REFERENCES \"media\" (\"id\") ON DELETE SET NULL ON UPDATE CASCADE, \"profileBackgroundImageId\" UUID REFERENCES \"media\" (\"id\") ON DELETE SET NULL ON UPDATE CASCADE, \"isOnline\" BOOLEAN NOT NULL DEFAULT false, \"lastSeen\" TIMESTAMP WITH TIME ZONE DEFAULT NULL, \"freeDays\" INTEGER NOT NULL DEFAULT 0, \"createdAt\" TIMESTAMP WITH TIME ZONE NOT NULL, \"updatedAt\" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY (\"id\"));");

  },

  async down(queryInterface) {
    await queryInterface.dropTable("users");
  },
};
