import { Transaction } from 'sequelize';
import { sequelize } from '../../../../database/db-config.js';
import { TrainingPlanEntity, TrainingPlanDayEntity, TrainingPlanItemEntity } from './entity/training-plan.entity.js';

export class TrainingPlanRepository {
    static findByUserId(userId: string) {
        return TrainingPlanEntity.findOne({
            where: { userId },
            include: [
                {
                    model: TrainingPlanDayEntity,
                    as: 'days',
                    include: [
                        {
                            model: TrainingPlanItemEntity,
                            as: 'items',
                        },
                    ],
                },
            ],
            order: [
                [{ model: TrainingPlanDayEntity, as: 'days' }, 'dayIndex', 'ASC'],
                [
                    { model: TrainingPlanDayEntity, as: 'days' },
                    { model: TrainingPlanItemEntity, as: 'items' },
                    'order',
                    'ASC',
                ],
            ],
        });
    }

    static async deleteExistingPlan(userId: string, transaction?: Transaction) {
        await TrainingPlanEntity.destroy({ where: { userId }, transaction });
    }

    static async createPlan(
        userId: string,
        startDate: Date,
        endDate: Date,
        days: Array<{
            dayIndex: number;
            date: Date;
            weekNumber: number;
            items: Array<{
                order: number;
                title: string;
                videoLink: string | null;
                description: string | null;
                duration: number | null;
                repeats: number | null;
                isSuperset: boolean;
                supersetExercises: Array<Record<string, unknown>> | null;
            }>;
        }>,
    ) {
        return sequelize.transaction(async (transaction) => {
            await this.deleteExistingPlan(userId, transaction);

            const plan = await TrainingPlanEntity.create({ userId, startDate, endDate }, { transaction });

            for (const day of days) {
                const planDay = await TrainingPlanDayEntity.create({
                    planId: plan.id,
                    dayIndex: day.dayIndex,
                    date: day.date,
                    weekNumber: day.weekNumber,
                }, { transaction });

                if (day.items.length === 0) {
                    continue;
                }

                const itemsPayload = day.items.map((item) => ({
                    ...item,
                    dayId: planDay.id,
                }));
                await TrainingPlanItemEntity.bulkCreate(itemsPayload, { transaction });
            }

            return plan;
        });
    }
}
