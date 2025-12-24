import { FindAndCountOptions, Op, Transaction, WhereOptions } from 'sequelize';
import { sequelize } from '../../../../database/db-config.js';
import {
    StaticTrainingPlanEntity,
    StaticTrainingPlanTrainingEntity,
} from './entity/static-training-plan.entity.js';
import { TrainingTagEntity, TrainingVideoEntity } from '../../../training-video/v1/entity/training-video.entity.js';

const SEARCH_OPERATOR = sequelize.getDialect() === 'postgres' ? Op.iLike : Op.like;

export type StaticTrainingPlanTrainingType = 'REGULAR' | 'SUPERSET' | 'DROPSET' | 'CIRCUIT';

export interface StaticTrainingPlanTrainingPayload {
    order: number;
    type: StaticTrainingPlanTrainingType;
    title: string | null;
    description: string | null;
    sets: number | null;
    repeats: number | null;
    duration: number | null;
    trainingVideoId: string | null;
    items: Array<Record<string, unknown>> | null;
    config: Record<string, unknown> | null;
}

export class StaticTrainingPlanRepository {
    static findById(planId: string) {
        return StaticTrainingPlanEntity.findByPk(planId, {
            include: [
                {
                    model: StaticTrainingPlanTrainingEntity,
                    as: 'trainings',
                    include: [
                        {
                            model: TrainingVideoEntity,
                            as: 'trainingVideo',
                            required: false,
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
            order: [
                [{ model: StaticTrainingPlanTrainingEntity, as: 'trainings' }, 'order', 'ASC'],
            ],
        });
    }

    static async listPlans(
        filters: { search?: string },
        pagination: { page?: number; limit?: number },
    ) {
        const where: WhereOptions = {};
        if (filters.search) {
            (where as any).name = { [SEARCH_OPERATOR]: `%${filters.search}%` };
        }

        const limit = Number.isFinite(pagination.limit) && (pagination.limit as number) > 0 ? Number(pagination.limit) : 20;
        const page = Number.isFinite(pagination.page) && (pagination.page as number) > 0 ? Number(pagination.page) : 1;
        const offset = (page - 1) * limit;

        const { rows, count } = await StaticTrainingPlanEntity.findAndCountAll({
            where,
            attributes: ['id', 'name', 'subTitle', 'description', 'imageId', 'durationInMinutes', 'level', 'createdAt', 'updatedAt'],
            limit,
            offset,
            order: [['createdAt', 'desc']],
        } as FindAndCountOptions);

        return {
            plans: rows,
            pagination: {
                page,
                limit,
                totalItems: count,
                totalPages: Math.ceil(count / limit) || 1,
            },
        };
    }

    static async createPlan(
        name: string,
        subTitle: string | null,
        description: string | null,
        imageId: string,
        durationInMinutes: number | null,
        level: string | null,
        trainings: StaticTrainingPlanTrainingPayload[],
    ) {
        return sequelize.transaction(async (transaction) => {
            const plan = await StaticTrainingPlanEntity.create(
                { name, subTitle, description, imageId, durationInMinutes, level },
                { transaction },
            );

            await this.upsertTrainings(plan.id, trainings, transaction);
            return plan;
        });
    }

    static async updatePlan(
        planId: string,
        meta: { name?: string; subTitle?: string | null; description?: string | null; imageId?: string; durationInMinutes?: number | null; level?: string | null },
        trainings?: StaticTrainingPlanTrainingPayload[],
    ) {
        return sequelize.transaction(async (transaction) => {
            const plan = await StaticTrainingPlanEntity.findByPk(planId, { transaction });
            if (!plan) {
                return null;
            }

            if (Object.keys(meta).length) {
                await plan.update(meta, { transaction });
            }

            if (trainings) {
                await StaticTrainingPlanTrainingEntity.destroy({ where: { planId }, transaction });
                await this.upsertTrainings(planId, trainings, transaction);
            }

            return plan;
        });
    }

    static async deletePlan(planId: string) {
        const deleted = await StaticTrainingPlanEntity.destroy({ where: { id: planId } });
        return deleted > 0;
    }

    private static async upsertTrainings(
        planId: string,
        trainings: StaticTrainingPlanTrainingPayload[],
        transaction: Transaction,
    ) {
        if (!trainings.length) {
            return;
        }

        await StaticTrainingPlanTrainingEntity.bulkCreate(
            trainings.map((training) => ({
                ...training,
                planId,
            })),
            { transaction },
        );
    }
}
