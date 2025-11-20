import { StatusCodes } from 'http-status-codes';
import { HttpResponseError } from '../../../utils/appError.js';
import { UserEntity } from '../../user/v1/entity/user.entity.js';
import { TrackingRepository } from './tracking.repository.js';
import { DailyTrackingEntity, ExtraFoodEntry, ExtraTrainingEntry } from './entity/daily-tracking.entity.js';
import { TrainingPlanItemEntity, TrainingPlanDayEntity, TrainingPlanEntity } from '../../plans/training/v1/entity/training-plan.entity.js';
import { DietMealItemEntity, DietPlanDayEntity, DietPlanEntity } from '../../plans/diet/v1/entity/diet-plan.entity.js';

interface MarkTrainingDonePayload {
    planItemId: string;
    date?: string;
}

interface MarkDietDonePayload {
    mealItemId: string;
    date?: string;
}

interface ExtraTrainingPayload {
    date: string;
    description: string;
    durationMinutes?: number;
}

interface ExtraFoodPayload {
    date: string;
    description: string;
    calories?: number;
}

interface WaterPayload {
    date: string;
    amountMl: number;
}

function toDateOnly(dateInput: string | Date): Date {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (Number.isNaN(date.getTime())) {
        throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Invalid date value');
    }
    return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

async function resolveTrainingPlanItemForUser(userId: string, planItemId: string) {
    const item: any = await TrainingPlanItemEntity.findByPk(planItemId, {
        include: [
            {
                model: TrainingPlanDayEntity,
                as: 'day',
                include: [
                    {
                        model: TrainingPlanEntity,
                        as: 'plan',
                    },
                    {
                        model: TrainingPlanItemEntity,
                        as: 'items',
                    },
                ],
            },
        ],
    });

    if (!item || !item.day?.plan || item.day.plan.userId !== userId) {
        throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Training item not found for user');
    }

    return item;
}

async function resolveDietMealItemForUser(userId: string, mealItemId: string) {
    const meal:any = await DietMealItemEntity.findByPk(mealItemId, {
        include: [
            {
                model: DietPlanDayEntity,
                as: 'day',
                include: [
                    {
                        model: DietPlanEntity,
                        as: 'plan',
                    },
                    {
                        model: DietMealItemEntity,
                        as: 'meals',
                    },
                ],
            },
        ],
    });

    if (!meal || !meal.day?.plan || meal.day.plan.userId !== userId) {
        throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Diet meal item not found for user');
    }

    return meal;
}

export class TrackingService {
    static async markTrainingDone(user: UserEntity, payload: MarkTrainingDonePayload): Promise<DailyTrackingEntity> {
        const item = await resolveTrainingPlanItemForUser(user.id, payload.planItemId);
        const expectedDate = toDateOnly(item.day!.date as Date);
        const providedDate = payload.date ? toDateOnly(payload.date) : expectedDate;

        if (expectedDate.getTime() !== providedDate.getTime()) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Training item does not match provided date');
        }

        const tracking = await TrackingRepository.findOrCreate(user.id, expectedDate);
        const completed = new Set<string>(tracking.trainingCompletedItemIds ?? []);
        completed.add(item.id);

        const totalItems = item.day!.items?.length ?? 0;
        const trainingDone = totalItems > 0 && completed.size >= totalItems;

        await tracking.update({
            trainingCompletedItemIds: Array.from(completed),
            trainingDone,
        });

        return tracking;
    }

    static async markDietDone(user: UserEntity, payload: MarkDietDonePayload): Promise<DailyTrackingEntity> {
        const meal = await resolveDietMealItemForUser(user.id, payload.mealItemId);
        const expectedDate = toDateOnly(meal.day!.date as Date);
        const providedDate = payload.date ? toDateOnly(payload.date) : expectedDate;

        if (expectedDate.getTime() !== providedDate.getTime()) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Diet item does not match provided date');
        }

        const tracking = await TrackingRepository.findOrCreate(user.id, expectedDate);
        const completed = new Set<string>(tracking.dietCompletedItemIds ?? []);
        completed.add(meal.id);

        const totalMeals = meal.day!.meals?.length ?? 0;
        const dietDone = totalMeals > 0 && completed.size >= totalMeals;

        await tracking.update({
            dietCompletedItemIds: Array.from(completed),
            dietDone,
        });

        return tracking;
    }

    static async logExtraTraining(user: UserEntity, payload: ExtraTrainingPayload): Promise<DailyTrackingEntity> {
        const date = toDateOnly(payload.date);
        const tracking = await TrackingRepository.findOrCreate(user.id, date);
        const entries = tracking.extraTrainingEntries ?? [];
        const entry: ExtraTrainingEntry = {
            description: payload.description,
        };
        if (payload.durationMinutes) {
            entry.durationMinutes = payload.durationMinutes;
        }
        entries.push(entry);
        await tracking.update({ extraTrainingEntries: entries });
        return tracking;
    }

    static async logExtraFood(user: UserEntity, payload: ExtraFoodPayload): Promise<DailyTrackingEntity> {
        const date = toDateOnly(payload.date);
        const tracking = await TrackingRepository.findOrCreate(user.id, date);
        const entries = tracking.extraFoodEntries ?? [];
        const entry: ExtraFoodEntry = {
            description: payload.description,
        };
        if (payload.calories) {
            entry.calories = payload.calories;
        }
        entries.push(entry);
        await tracking.update({ extraFoodEntries: entries });
        return tracking;
    }

    static async logWaterIntake(user: UserEntity, payload: WaterPayload): Promise<DailyTrackingEntity> {
        if (payload.amountMl <= 0) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Water amount must be positive');
        }
        const date = toDateOnly(payload.date);
        const tracking = await TrackingRepository.findOrCreate(user.id, date);
        const waterIntakeMl = (tracking.waterIntakeMl ?? 0) + payload.amountMl;
        await tracking.update({ waterIntakeMl });
        return tracking;
    }

    static async getDailyStatus(user: UserEntity, date: string): Promise<DailyTrackingEntity> {
        const parsedDate = toDateOnly(date);
        const tracking = await TrackingRepository.findByUserAndDate(user.id, parsedDate);
        if (!tracking) {
            return DailyTrackingEntity.build({
                userId: user.id,
                date: parsedDate.toISOString().split('T')[0],
                trainingDone: false,
                dietDone: false,
                waterIntakeMl: 0,
                trainingCompletedItemIds: [],
                dietCompletedItemIds: [],
                extraTrainingEntries: [],
                extraFoodEntries: [],
            });
        }
        return tracking;
    }
}
