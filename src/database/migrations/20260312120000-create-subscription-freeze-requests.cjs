'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_type t
                    JOIN pg_namespace n ON n.oid = t.typnamespace
                    WHERE t.typname = 'enum_subscription_freeze_requests_status'
                        AND n.nspname = 'public'
                ) THEN
                    CREATE TYPE "public"."enum_subscription_freeze_requests_status" AS ENUM ('pending', 'approved', 'declined');
                END IF;
            END
            $$;
        `);

        await queryInterface.createTable('subscription_freeze_requests', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true,
            },
            userId: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
            },
            status: {
                type: Sequelize.ENUM('pending', 'approved', 'declined'),
                allowNull: false,
                defaultValue: 'pending',
            },
            requestedDays: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            requestedNote: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            approvedDays: {
                type: Sequelize.INTEGER,
                allowNull: true,
            },
            decisionNote: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            resolvedBy: {
                type: Sequelize.UUID,
                allowNull: true,
            },
            resolvedAt: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            createdAt: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            updatedAt: {
                type: Sequelize.DATE,
                allowNull: false,
            },
        });

        await queryInterface.addIndex('subscription_freeze_requests', ['userId'], {
            name: 'subscription_freeze_requests_user_id',
        });
        await queryInterface.addIndex('subscription_freeze_requests', ['status'], {
            name: 'subscription_freeze_requests_status',
        });
        await queryInterface.addIndex('subscription_freeze_requests', ['createdAt'], {
            name: 'subscription_freeze_requests_created_at',
        });

        await queryInterface.sequelize.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS subscription_freeze_requests_one_pending_per_user
            ON "subscription_freeze_requests" ("userId")
            WHERE "status" = 'pending';
        `);
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('subscription_freeze_requests', 'subscription_freeze_requests_user_id');
        await queryInterface.removeIndex('subscription_freeze_requests', 'subscription_freeze_requests_status');
        await queryInterface.removeIndex('subscription_freeze_requests', 'subscription_freeze_requests_created_at');
        await queryInterface.sequelize.query('DROP INDEX IF EXISTS subscription_freeze_requests_one_pending_per_user;');
        await queryInterface.dropTable('subscription_freeze_requests');
        await queryInterface.sequelize.query('DROP TYPE IF EXISTS "public"."enum_subscription_freeze_requests_status";');
    },
};
