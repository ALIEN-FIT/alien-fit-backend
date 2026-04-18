import { sequelize } from '../../../../database/db-config.js';
import { DietPlanEntity, DietPlanDayEntity, DietMealItemEntity } from './entity/diet-plan.entity.js';

export class DietPlanRepository {
    private static readonly include = [
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
    ];

    private static buildOrder() {
        return [
            ['createdAt', 'DESC'],
            ['id', 'DESC'],
            [{ model: DietPlanDayEntity, as: 'days' }, 'dayIndex', 'ASC'],
            [
                { model: DietPlanDayEntity, as: 'days' },
                { model: DietMealItemEntity, as: 'meals' },
                'order',
                'ASC',
            ],
        ];
    }

    static findById(planId: string) {
        return DietPlanEntity.findByPk(planId, {
            include: this.include,
            order: this.buildOrder() as any,
        });
    }

    static findByUserId(userId: string) {
        return DietPlanEntity.findOne({
            where: { userId },
            include: this.include,
            order: this.buildOrder() as any,
        });
    }

    static listByUserId(userId: string) {
        return DietPlanEntity.findAll({
            where: { userId },
            include: this.include,
            order: this.buildOrder() as any,
        });
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
                mealName: string | null;
                order: number;
                foods: Array<Record<string, unknown>>;
            }>;
        }>,
        recommendedWaterIntakeMl: number | null,
    ) {
        return sequelize.transaction(async (transaction) => {
            const plan = await DietPlanEntity.create({ userId, startDate, endDate, recommendedWaterIntakeMl }, { transaction });

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
                    mealName: meal.mealName,
                    order: meal.order,
                    foods: meal.foods,
                    dayId: planDay.id,
                }));

                await DietMealItemEntity.bulkCreate(mealsPayload, { transaction });
            }

            return plan;
        });
    }

    static async createDefaultPlan(
        startDate: Date,
        endDate: Date,
        days: Array<{
            dayIndex: number;
            date: Date;
            weekNumber: number;
            meals: Array<{
                mealName: string | null;
                order: number;
                foods: Array<Record<string, unknown>>;
            }>;
        }>,
        recommendedWaterIntakeMl: number | null,
    ) {
        return sequelize.transaction(async (transaction) => {
            const plan = await DietPlanEntity.create({ userId: null, startDate, endDate, recommendedWaterIntakeMl }, { transaction });

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
                    mealName: meal.mealName,
                    order: meal.order,
                    foods: meal.foods,
                    dayId: planDay.id,
                }));

                await DietMealItemEntity.bulkCreate(mealsPayload, { transaction });
            }

            return plan;
        });
    }
}
