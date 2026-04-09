'use strict';
/* eslint-disable no-undef */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Keep the newest session per token and clear the rest before adding unique index.
        await queryInterface.sequelize.query(`
            WITH ranked_tokens AS (
                SELECT
                    "id",
                    ROW_NUMBER() OVER (
                        PARTITION BY "fcmToken"
                        ORDER BY "updatedAt" DESC, "createdAt" DESC, "id" DESC
                    ) AS rn
                FROM "user_sessions"
                WHERE "fcmToken" IS NOT NULL
            )
                    UPDATE "user_sessions" us
                    SET "fcmToken" = NULL
            FROM ranked_tokens rt
            WHERE us."id" = rt."id"
              AND rt.rn > 1;
        `);

        await queryInterface.addIndex('user_sessions', ['fcmToken'], {
            unique: true,
            name: 'user_sessions_fcmToken_unique_not_null',
            where: {
                fcmToken: {
                    [Sequelize.Op.ne]: null,
                },
            },
        });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('user_sessions', 'user_sessions_fcmToken_unique_not_null');
    },
};
