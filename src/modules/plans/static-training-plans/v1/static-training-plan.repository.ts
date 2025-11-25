import { Transaction } from 'sequelize';
import { sequelize } from '../../../../database/db-config.js';
import {
    StaticTrainingPlanEntity,
    StaticTrainingPlanDayEntity,
    StaticTrainingPlanItemEntity,
} from './entity/static-training-plan.entity.js';
import { TrainingTagEntity, TrainingVideoEntity } from '../../../training-video/v1/entity/training-video.entity.js';

export interface StaticTrainingPlanItemPayload {
    order: number;
    title: string;
    videoLink: string | null;
    description: string | null;
    duration: number | null;
    repeats: number | null;
    sets: number;
    trainingVideoId: string;
    isSuperset: boolean;
    supersetItems: Array<{ trainingVideoId: string; sets: number; repeats: number }> | null;
}

export interface StaticTrainingPlanDayPayload {
    dayIndex: number;
    weekNumber: number;
    items: StaticTrainingPlanItemPayload[];
}

export class StaticTrainingPlanRepository {
    static findById(planId: string) {
        return StaticTrainingPlanEntity.findByPk(planId, {
            include: [
                {
                    model: StaticTrainingPlanDayEntity,
                    as: 'days',
                    include: [
                        {
                            model: StaticTrainingPlanItemEntity,
                            as: 'items',
                            include: [
                                {
                                    model: TrainingVideoEntity,
                                    as: 'trainingVideo',
                                    include: [
                                        {
                                            model: TrainingTagEntity,
                                            as: 'tags',
                                            through: { attributes: [] },
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
            order: [
                [{ model: StaticTrainingPlanDayEntity, as: 'days' }, 'dayIndex', 'ASC'],
                [
                    { model: StaticTrainingPlanDayEntity, as: 'days' },
                    { model: StaticTrainingPlanItemEntity, as: 'items' },
                    'order',
                    'ASC',
                ],
            ],
        });
    }

    static listPlans() {
        return StaticTrainingPlanEntity.findAll({
            attributes: ['id', 'name', 'description', 'imageId', 'createdAt', 'updatedAt'],
            order: [['createdAt', 'desc']],
        });
    }

    static async createPlan(
        name: string,
        description: string | null,
        imageId: string,
        days: StaticTrainingPlanDayPayload[],
    ) {
        return sequelize.transaction(async (transaction) => {
            const plan = await StaticTrainingPlanEntity.create(
                { name, description, imageId },
                { transaction },
            );

            await this.upsertDays(plan.id, days, transaction);
            return plan;
        });
    }

    static async updatePlan(
        planId: string,
        meta: { name?: string; description?: string | null; imageId?: string },
        days?: StaticTrainingPlanDayPayload[],
    ) {
        return sequelize.transaction(async (transaction) => {
            const plan = await StaticTrainingPlanEntity.findByPk(planId, { transaction });
            if (!plan) {
                return null;
            }

            if (Object.keys(meta).length) {
                await plan.update(meta, { transaction });
            }

            if (days) {
                await StaticTrainingPlanDayEntity.destroy({ where: { planId }, transaction });
                await this.upsertDays(planId, days, transaction);
            }

            return plan;
        });
    }

    static async deletePlan(planId: string) {
        const deleted = await StaticTrainingPlanEntity.destroy({ where: { id: planId } });
        return deleted > 0;
    }

    private static async upsertDays(
        planId: string,
        days: StaticTrainingPlanDayPayload[],
        transaction: Transaction,
    ) {
        for (const day of days) {
            const planDay = await StaticTrainingPlanDayEntity.create(
                {
                    planId,
                    dayIndex: day.dayIndex,
                    weekNumber: day.weekNumber,
                },
                { transaction },
            );

            if (!day.items.length) {
                continue;
            }

            const itemsPayload = day.items.map((item) => ({
                ...item,
                dayId: planDay.id,
            }));

            await StaticTrainingPlanItemEntity.bulkCreate(itemsPayload, { transaction });
        }
    }
}
