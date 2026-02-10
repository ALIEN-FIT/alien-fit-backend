/**
 * Migration: Allow NULL userId in diet_plans and training_plans tables
 * 
 * This migration allows userId to be NULL in both diet_plans and training_plans tables
 * to support default plans that are not associated with any specific user.
 * 
 * Changes:
 * - Remove NOT NULL constraint from userId in diet_plans
 * - Remove UNIQUE constraint from userId in diet_plans
 * - Remove NOT NULL constraint from userId in training_plans
 * - Remove UNIQUE constraint from userId in training_plans
 */

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Update diet_plans table
        await queryInterface.changeColumn('diet_plans', 'userId', {
            type: Sequelize.UUID,
            allowNull: true,
            unique: false,
        });

        // Remove unique constraint if it exists
        try {
            await queryInterface.removeConstraint('diet_plans', 'diet_plans_userId_key');
        } catch (error) {
            // Constraint might not exist, ignore error
            console.log('diet_plans_userId_key constraint not found or already removed');
        }

        // Update training_plans table
        await queryInterface.changeColumn('training_plans', 'userId', {
            type: Sequelize.UUID,
            allowNull: true,
            unique: false,
        });

        // Remove unique constraint if it exists
        try {
            await queryInterface.removeConstraint('training_plans', 'training_plans_userId_key');
        } catch (error) {
            // Constraint might not exist, ignore error
            console.log('training_plans_userId_key constraint not found or already removed');
        }

        console.log('✓ Successfully allowed NULL userId in diet_plans and training_plans');
    },

    async down(queryInterface, Sequelize) {
        // Revert training_plans table
        await queryInterface.changeColumn('training_plans', 'userId', {
            type: Sequelize.UUID,
            allowNull: false,
            unique: true,
        });

        // Revert diet_plans table
        await queryInterface.changeColumn('diet_plans', 'userId', {
            type: Sequelize.UUID,
            allowNull: false,
            unique: true,
        });

        console.log('✓ Reverted diet_plans and training_plans to require unique userId');
    }
};
