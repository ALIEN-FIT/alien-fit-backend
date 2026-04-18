'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "user_profiles"
      DROP CONSTRAINT IF EXISTS "user_profiles_userId_key";
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS "user_profiles_user_id_created_at_idx"
      ON "user_profiles" ("userId", "createdAt");
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS "diet_plans_user_id_created_at_idx"
      ON "diet_plans" ("userId", "createdAt");
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS "training_plans_user_id_created_at_idx"
      ON "training_plans" ("userId", "createdAt");
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS "training_plans_user_id_created_at_idx";
    `);

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS "diet_plans_user_id_created_at_idx";
    `);

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS "user_profiles_user_id_created_at_idx";
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE "user_profiles"
      ADD CONSTRAINT "user_profiles_userId_key" UNIQUE ("userId");
    `);
  },
};
