'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.changeColumn('diet_meal_items', 'mealName', {
            type: Sequelize.STRING,
            allowNull: true,
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.sequelize.query(
            "UPDATE \"diet_meal_items\" SET \"mealName\" = 'Unnamed' WHERE \"mealName\" IS NULL;",
        );

        await queryInterface.changeColumn('diet_meal_items', 'mealName', {
            type: Sequelize.STRING,
            allowNull: false,
        });
    },
};
