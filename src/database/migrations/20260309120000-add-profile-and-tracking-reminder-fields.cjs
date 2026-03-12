'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('user_profiles', 'bodyImagesUpdatedAt', {
            type: Sequelize.DATE,
            allowNull: true,
        });

        await queryInterface.addColumn('user_profiles', 'inbodyImage', {
            type: Sequelize.UUID,
            allowNull: true,
        });

        await queryInterface.addColumn('user_profiles', 'inbodyImageUpdatedAt', {
            type: Sequelize.DATE,
            allowNull: true,
        });

        await queryInterface.addColumn('daily_tracking', 'trainingCompletionRecords', {
            type: Sequelize.JSONB,
            allowNull: false,
            defaultValue: [],
        });
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('daily_tracking', 'trainingCompletionRecords');
        await queryInterface.removeColumn('user_profiles', 'inbodyImageUpdatedAt');
        await queryInterface.removeColumn('user_profiles', 'inbodyImage');
        await queryInterface.removeColumn('user_profiles', 'bodyImagesUpdatedAt');
    },
};
