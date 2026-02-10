import { Transaction } from 'sequelize';
import { sequelize } from '../../../../database/db-config.js';
import { TrainingPlanEntity, TrainingPlanDayEntity, TrainingPlanItemEntity } from './entity/training-plan.entity.js';
import { TrainingVideoEntity, TrainingTagEntity } from '../../../training-video/v1/entity/training-video.entity.js';

export class TrainingPlanRepository {
    static findById(planId: string) {
        return TrainingPlanEntity.findByPk(planId, {
            include: [
                {
                    model: TrainingPlanDayEntity,
                    as: 'days',
                    include: [
                        {
                            model: TrainingPlanItemEntity,
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
                sets: number;
                trainingVideoId: string;
                isSuperset: boolean;
                supersetItems: Array<Record<string, unknown>> | null;
                itemType: 'REGULAR' | 'SUPERSET' | 'DROPSET' | 'CIRCUIT';
                extraVideos: Array<Record<string, unknown>> | null;
                dropsetConfig: Record<string, unknown> | null;
                circuitGroup: string | null;
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
                    order: item.order,
                    title: item.title,
                    videoLink: item.videoLink,
                    description: item.description,
                    duration: item.duration,
                    repeats: item.repeats,
                    sets: item.sets,
                    trainingVideoId: item.trainingVideoId,
                    isSuperset: item.isSuperset,
                    supersetItems: item.supersetItems,
                    itemType: item.itemType,
                    extraVideos: item.extraVideos,
                    dropsetConfig: item.dropsetConfig,
                    circuitGroup: item.circuitGroup,
                    dayId: planDay.id,
                }));
                await TrainingPlanItemEntity.bulkCreate(itemsPayload, { transaction });
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
            items: Array<{
                order: number;
                title: string;
                videoLink: string | null;
                description: string | null;
                duration: number | null;
                repeats: number | null;
                sets: number;
                trainingVideoId: string;
                isSuperset: boolean;
                supersetItems: Array<Record<string, unknown>> | null;
                itemType: 'REGULAR' | 'SUPERSET' | 'DROPSET' | 'CIRCUIT';
                extraVideos: Array<Record<string, unknown>> | null;
                dropsetConfig: Record<string, unknown> | null;
                circuitGroup: string | null;
            }>;
        }>,
    ) {
        return sequelize.transaction(async (transaction) => {
            const plan = await TrainingPlanEntity.create({ userId: null, startDate, endDate }, { transaction });

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
                    order: item.order,
                    title: item.title,
                    videoLink: item.videoLink,
                    description: item.description,
                    duration: item.duration,
                    repeats: item.repeats,
                    sets: item.sets,
                    trainingVideoId: item.trainingVideoId,
                    isSuperset: item.isSuperset,
                    supersetItems: item.supersetItems,
                    itemType: item.itemType,
                    extraVideos: item.extraVideos,
                    dropsetConfig: item.dropsetConfig,
                    circuitGroup: item.circuitGroup,
                    dayId: planDay.id,
                }));
                await TrainingPlanItemEntity.bulkCreate(itemsPayload, { transaction });
            }

            return plan;
        });
    }
}
