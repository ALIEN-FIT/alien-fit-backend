import { StatusCodes } from 'http-status-codes';
import { HttpResponseError } from '../../../../utils/appError.js';
import { Roles } from '../../../../constants/roles.js';
import { UserEntity } from '../../../user/v1/entity/user.entity.js';
import { TrainingVideoService } from '../../../training-video/v1/training-video.service.js';
import { TrainingVideoEntity } from '../../../training-video/v1/entity/training-video.entity.js';
import {
    StaticTrainingPlanRepository,
    StaticTrainingPlanTrainingPayload,
    StaticTrainingPlanTrainingType,
} from './static-training-plan.repository.js';
import { StaticTrainingPlanTrainingEntity } from './entity/static-training-plan.entity.js';

interface TrainingGroupItemInput {
    trainingVideoId: string;
    title?: string | null;
    description?: string | null;
    repeats?: number | null;
    duration?: number | null;
}

interface StaticTrainingPlanTrainingInput {
    type: StaticTrainingPlanTrainingType;
    trainingVideoId?: string;
    sets?: number | null;
    repeats?: number | null;
    duration?: number | null;
    title?: string | null;
    description?: string | null;
    items?: TrainingGroupItemInput[];
    config?: Record<string, unknown> | null;
}

interface CreateStaticTrainingPlanPayload {
    name: string;
    subTitle?: string | null;
    description?: string | null;
    imageId: string;
    durationInMinutes?: number | null;
    level?: string | null;
    priority?: number;
    trainings: StaticTrainingPlanTrainingInput[];
}

interface UpdateStaticTrainingPlanPayload {
    name?: string;
    subTitle?: string | null;
    description?: string | null;
    imageId?: string;
    durationInMinutes?: number | null;
    level?: string | null;
    priority?: number;
    trainings?: StaticTrainingPlanTrainingInput[];
}

interface UpdateStaticTrainingEntryPayload {
    type?: StaticTrainingPlanTrainingType;
    trainingVideoId?: string | null;
    sets?: number | null;
    repeats?: number | null;
    duration?: number | null;
    title?: string | null;
    description?: string | null;
    items?: TrainingGroupItemInput[];
    config?: Record<string, unknown> | null;
    order?: number;
}

export class StaticTrainingPlanService {
    static async createStaticPlan(actor: UserEntity, payload: CreateStaticTrainingPlanPayload) {
        this.ensureAdmin(actor);

        this.assertAtLeastOneTraining(payload.trainings);

        const videoIds = this.collectVideoIds(payload.trainings);
        const videoMap = await TrainingVideoService.ensureVideosExist(videoIds);
        const trainingsPayload = this.buildTrainingsPayload(payload.trainings, videoMap);

        const plan = await StaticTrainingPlanRepository.createPlan(
            payload.name,
            payload.subTitle ?? null,
            payload.description ?? null,
            payload.imageId,
            payload.durationInMinutes ?? null,
            payload.level ?? null,
            payload.priority,
            trainingsPayload,
        );

        const saved = await StaticTrainingPlanRepository.findById(plan.id);
        if (!saved) {
            throw new HttpResponseError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to load static training plan');
        }

        return saved;
    }

    static async updateStaticPlan(actor: UserEntity, planId: string, payload: UpdateStaticTrainingPlanPayload) {
        this.ensureAdmin(actor);

        const meta: {
            name?: string;
            subTitle?: string | null;
            description?: string | null;
            imageId?: string;
            durationInMinutes?: number | null;
            level?: string | null;
            priority?: number;
        } = {};
        if (payload.name !== undefined) {
            meta.name = payload.name;
        }
        if (payload.subTitle !== undefined) {
            meta.subTitle = payload.subTitle ?? null;
        }
        if (payload.description !== undefined) {
            meta.description = payload.description ?? null;
        }
        if (payload.imageId !== undefined) {
            meta.imageId = payload.imageId;
        }
        if (payload.durationInMinutes !== undefined) {
            meta.durationInMinutes = payload.durationInMinutes ?? null;
        }
        if (payload.level !== undefined) {
            meta.level = payload.level ?? null;
        }
        if (payload.priority !== undefined) {
            meta.priority = payload.priority;
        }

        let trainingsPayload: StaticTrainingPlanTrainingPayload[] | undefined;
        if (payload.trainings) {
            this.assertAtLeastOneTraining(payload.trainings);
            const videoIds = this.collectVideoIds(payload.trainings);
            const videoMap = await TrainingVideoService.ensureVideosExist(videoIds);
            trainingsPayload = this.buildTrainingsPayload(payload.trainings, videoMap);
        }

        const updated = await StaticTrainingPlanRepository.updatePlan(planId, meta, trainingsPayload);
        if (!updated) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Static training plan not found');
        }

        const saved = await StaticTrainingPlanRepository.findById(planId);
        if (!saved) {
            throw new HttpResponseError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to load static training plan');
        }

        return saved;
    }

    static async updateTrainingById(
        actor: UserEntity,
        planId: string,
        trainingId: string,
        payload: UpdateStaticTrainingEntryPayload,
    ) {
        this.ensureAdmin(actor);

        const plan = await StaticTrainingPlanRepository.findById(planId);
        if (!plan) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Static training plan not found');
        }

        const training = await StaticTrainingPlanTrainingEntity.findOne({ where: { id: trainingId, planId } });
        if (!training) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Static training entry not found');
        }

        const mergedInput: StaticTrainingPlanTrainingInput = {
            type: (payload.type ?? training.type) as StaticTrainingPlanTrainingType,
            trainingVideoId:
                payload.trainingVideoId !== undefined
                    ? payload.trainingVideoId ?? undefined
                    : (training.trainingVideoId ?? undefined),
            sets: payload.sets ?? training.sets ?? null,
            repeats: payload.repeats ?? training.repeats ?? null,
            duration: payload.duration ?? training.duration ?? null,
            title: payload.title ?? training.title ?? null,
            description: payload.description ?? training.description ?? null,
            items: payload.items ?? ((training.items as unknown as TrainingGroupItemInput[] | null) ?? undefined),
            config: payload.config ?? ((training.config as Record<string, unknown> | null) ?? null),
        };

        const videoIds = this.collectVideoIds([mergedInput]);
        const videoMap = await TrainingVideoService.ensureVideosExist(videoIds);
        const [normalized] = this.buildTrainingsPayload([mergedInput], videoMap);

        await training.update({
            type: normalized.type,
            order: payload.order ?? training.order,
            title: normalized.title,
            description: normalized.description,
            sets: normalized.sets,
            repeats: normalized.repeats,
            duration: normalized.duration,
            trainingVideoId: normalized.trainingVideoId,
            items: normalized.items,
            config: normalized.config,
        });

        const saved = await StaticTrainingPlanRepository.findById(planId);
        if (!saved) {
            throw new HttpResponseError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to load static training plan');
        }

        return saved;
    }

    static async deleteStaticPlan(actor: UserEntity, planId: string) {
        this.ensureAdmin(actor);
        const deleted = await StaticTrainingPlanRepository.deletePlan(planId);
        if (!deleted) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Static training plan not found');
        }
        return { deleted: true };
    }

    static async deleteTrainingById(actor: UserEntity, planId: string, trainingId: string) {
        this.ensureAdmin(actor);

        const plan = await StaticTrainingPlanRepository.findById(planId);
        if (!plan) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Static training plan not found');
        }

        const training = await StaticTrainingPlanTrainingEntity.findOne({ where: { id: trainingId, planId } });
        if (!training) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Static training entry not found');
        }

        await training.destroy();

        const remaining = await StaticTrainingPlanTrainingEntity.findAll({
            where: { planId },
            order: [['order', 'ASC']],
        });

        for (let index = 0; index < remaining.length; index += 1) {
            const row = remaining[index];
            const nextOrder = index + 1;
            if (row.order !== nextOrder) {
                await row.update({ order: nextOrder });
            }
        }

        const saved = await StaticTrainingPlanRepository.findById(planId);
        if (!saved) {
            throw new HttpResponseError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to load static training plan');
        }

        return saved;
    }

    static async getStaticPlan(planId: string) {
        const plan = await StaticTrainingPlanRepository.findById(planId);
        if (!plan) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Static training plan not found');
        }
        return plan;
    }

    static listStaticPlans(
        filters: { search?: string },
        pagination: { page?: number; limit?: number },
    ) {
        return StaticTrainingPlanRepository.listPlans(filters, pagination);
    }

    private static collectVideoIds(trainings: StaticTrainingPlanTrainingInput[]) {
        const ids = new Set<string>();
        for (const training of trainings ?? []) {
            if (training.trainingVideoId) {
                ids.add(training.trainingVideoId);
            }
            for (const item of training.items ?? []) {
                if (item?.trainingVideoId) {
                    ids.add(item.trainingVideoId);
                }
            }
        }
        return Array.from(ids);
    }

    private static buildTrainingsPayload(
        trainings: StaticTrainingPlanTrainingInput[],
        videoMap: Map<string, TrainingVideoEntity>,
    ): StaticTrainingPlanTrainingPayload[] {
        return (trainings ?? []).map((training, index) => {
            const type = training.type;

            if (type === 'REGULAR') {
                if (!training.trainingVideoId) {
                    throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'REGULAR training requires trainingVideoId');
                }
                const video = videoMap.get(training.trainingVideoId);
                if (!video) {
                    throw new HttpResponseError(StatusCodes.BAD_REQUEST, `Unknown training video: ${training.trainingVideoId}`);
                }

                return {
                    order: index + 1,
                    type,
                    title: training.title ?? video.title,
                    description: training.description ?? video.description ?? null,
                    sets: training.sets ?? null,
                    repeats: training.repeats ?? null,
                    duration: training.duration ?? null,
                    trainingVideoId: training.trainingVideoId,
                    items: null,
                    config: training.config ?? null,
                };
            }

            const items = training.items ?? [];
            if (!items.length) {
                throw new HttpResponseError(StatusCodes.BAD_REQUEST, `${type} training requires items`);
            }
            if ((type === 'SUPERSET' || type === 'DROPSET') && items.length < 2) {
                throw new HttpResponseError(StatusCodes.BAD_REQUEST, `${type} training requires at least 2 items`);
            }
            if (type === 'CIRCUIT') {
                const rounds = (training.config as any)?.rounds;
                if (!Number.isInteger(rounds) || rounds <= 0) {
                    throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'CIRCUIT training requires config.rounds as a positive integer');
                }
            }

            const normalizedItems = items.map((item) => {
                const id = item.trainingVideoId;
                const video = videoMap.get(id);
                if (!video) {
                    throw new HttpResponseError(StatusCodes.BAD_REQUEST, `Unknown training video: ${id}`);
                }
                return {
                    trainingVideoId: id,
                    title: item.title ?? video.title,
                    description: item.description ?? video.description ?? null,
                    repeats: item.repeats ?? null,
                    duration: item.duration ?? null,
                };
            });

            return {
                order: index + 1,
                type,
                title: training.title ?? null,
                description: training.description ?? null,
                sets: training.sets ?? null,
                repeats: training.repeats ?? null,
                duration: training.duration ?? null,
                trainingVideoId: null,
                items: normalizedItems,
                config: training.config ?? null,
            };
        });
    }

    private static assertAtLeastOneTraining(trainings: StaticTrainingPlanTrainingInput[]) {
        if (!Array.isArray(trainings) || trainings.length < 1) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Plan must include at least one training');
        }
    }

    private static ensureAdmin(actor: UserEntity) {
        if (!actor || actor.role !== Roles.ADMIN) {
            throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Only admins can manage static training plans');
        }
    }
}
