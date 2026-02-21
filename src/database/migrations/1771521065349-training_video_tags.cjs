'use strict';

module.exports = {
  async up(queryInterface) {
    const existingTablesRaw = await queryInterface.showAllTables();
    const existingTables = existingTablesRaw.map((table) => typeof table === 'string' ? table : table.tableName);
    if (existingTables.includes("training_video_tags")) {
      return;
    }


    await queryInterface.sequelize.query("CREATE TABLE IF NOT EXISTS \"training_video_tags\" (\"id\" UUID , \"trainingVideoId\" UUID NOT NULL REFERENCES \"training_videos\" (\"id\") ON DELETE CASCADE ON UPDATE CASCADE, \"trainingTagId\" UUID NOT NULL REFERENCES \"training_tags\" (\"id\") ON DELETE CASCADE ON UPDATE CASCADE, \"createdAt\" TIMESTAMP WITH TIME ZONE NOT NULL, \"updatedAt\" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY (\"id\"));");
    await queryInterface.sequelize.query("CREATE UNIQUE INDEX \"training_video_tags_training_video_id_training_tag_id\" ON \"training_video_tags\" (\"trainingVideoId\", \"trainingTagId\")");
  },

  async down(queryInterface) {
    await queryInterface.dropTable("training_video_tags");
  },
};
