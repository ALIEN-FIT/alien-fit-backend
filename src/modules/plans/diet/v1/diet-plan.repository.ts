import { Transaction } from 'sequelize';
import { sequelize } from '../../../../database/db-config.js';
import { DietPlanEntity, DietPlanDayEntity, DietMealItemEntity } from './entity/diet-plan.entity.js';

export class DietPlanRepository {
    static findByUserId(userId: string) {
        return DietPlanEntity.findOne({
            where: { userId },
            include: [
                {
                    model: DietPlanDayEntity,
                    as: 'days',
                    include: [
                        {
                            model: DietMealItemEntity,
                            as: 'meals',
                        },
                    ],
                },
            ],
            order: [
                [{ model: DietPlanDayEntity, as: 'days' }, 'dayIndex', 'ASC'],
                [
                    { model: DietPlanDayEntity, as: 'days' },
                    { model: DietMealItemEntity, as: 'meals' },
                    'mealType',
                    'ASC',
                ],
                [
                    { model: DietPlanDayEntity, as: 'days' },
                    { model: DietMealItemEntity, as: 'meals' },
                    'order',
                    'ASC',
                ],
            ],
        });
    }

    static async deleteExistingPlan(userId: string, transaction?: Transaction) {
        await DietPlanEntity.destroy({ where: { userId }, transaction });
    }

    static async createPlan(
        userId: string,
        startDate: Date,
        endDate: Date,
        days: Array<{
            dayIndex: number;
            date: Date;
            weekNumber: number;
            meals: Array<{
                mealType: 'breakfast' | 'lunch' | 'snacks' | 'dinner';
                order: number;
                foodName: string;
                amount: string;
            }>;
        }>,
    ) {
        return sequelize.transaction(async (transaction) => {
            await this.deleteExistingPlan(userId, transaction);

            const plan = await DietPlanEntity.create({ userId, startDate, endDate }, { transaction });

            for (const day of days) {
                const planDay = await DietPlanDayEntity.create({
                    planId: plan.id,
                    dayIndex: day.dayIndex,
                    date: day.date,
                    weekNumber: day.weekNumber,
                }, { transaction });

                if (!day.meals.length) {
                    continue;
                }

                const mealsPayload = day.meals.map((meal) => ({
                    ...meal,
                    dayId: planDay.id,
                }));

                await DietMealItemEntity.bulkCreate(mealsPayload, { transaction });
            }

            return plan;
        });
    }
}
