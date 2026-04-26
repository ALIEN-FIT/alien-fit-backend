export type TrainingPlanItemType = 'REGULAR' | 'SUPERSET' | 'DROPSET' | 'CIRCUIT';

export interface SupersetItemInput {
    trainingVideoId: string;
    sets: number;
    repeats: number;
}

export interface CircuitItemInput {
    trainingVideoId: string;
    sets: number;
    repeats: number;
}

export interface UpdateTrainingPlanItemPayload {
    sets?: number;
    repeats?: number;
    itemType?: TrainingPlanItemType;
    isSuperset?: boolean;
    trainingVideoId?: string;
    supersetItems?: SupersetItemInput[];
    extraVideos?: Array<{ trainingVideoId: string }>;
    dropsetConfig?: { dropPercents: number[]; restSeconds?: number };
    circuitItems?: CircuitItemInput[];
    circuitGroup?: string;
}

export interface ExistingTrainingPlanItem {
    trainingVideoId: string;
    sets?: number | null;
    repeats?: number | null;
    itemType?: TrainingPlanItemType | null;
    isSuperset?: boolean | null;
    supersetItems?: unknown;
    extraVideos?: unknown;
    dropsetConfig?: unknown;
    circuitItems?: unknown;
    circuitGroup?: string | null;
}

export interface TrainingPlanItemInput extends UpdateTrainingPlanItemPayload {
    trainingVideoId?: string;
}

export function buildTrainingPlanItemUpdateInput(
    item: ExistingTrainingPlanItem,
    payload: UpdateTrainingPlanItemPayload,
): TrainingPlanItemInput {
    const itemType = payload.itemType ?? item.itemType ?? (item.isSuperset ? 'SUPERSET' : 'REGULAR');
    const base: TrainingPlanItemInput = {
        trainingVideoId: payload.trainingVideoId ?? item.trainingVideoId,
        sets: payload.sets ?? Number(item.sets ?? 0),
        repeats: payload.repeats ?? Number(item.repeats ?? 0),
        itemType,
    };

    if (itemType === 'REGULAR') {
        return {
            ...base,
            isSuperset: false,
            supersetItems: [],
            extraVideos: [],
            circuitItems: [],
            dropsetConfig: undefined,
            circuitGroup: undefined,
        };
    }

    if (itemType === 'SUPERSET') {
        return {
            ...base,
            isSuperset: payload.isSuperset ?? item.isSuperset ?? true,
            supersetItems: payload.supersetItems ?? toArray<SupersetItemInput>(item.supersetItems),
            extraVideos: payload.extraVideos ?? toArray<{ trainingVideoId: string }>(item.extraVideos),
            dropsetConfig: undefined,
            circuitItems: [],
            circuitGroup: undefined,
        };
    }

    if (itemType === 'DROPSET') {
        return {
            ...base,
            isSuperset: false,
            supersetItems: [],
            extraVideos: [],
            dropsetConfig: payload.dropsetConfig ?? toObject<{ dropPercents: number[]; restSeconds?: number }>(item.dropsetConfig),
            circuitItems: [],
            circuitGroup: undefined,
        };
    }

    return {
        ...base,
        isSuperset: false,
        supersetItems: [],
        extraVideos: [],
        dropsetConfig: undefined,
        circuitItems: payload.circuitItems ?? toArray<CircuitItemInput>(item.circuitItems),
        circuitGroup: payload.circuitGroup ?? item.circuitGroup ?? undefined,
    };
}

function toArray<T>(value: unknown): T[] | undefined {
    return Array.isArray(value) ? value as T[] : undefined;
}

function toObject<T>(value: unknown): T | undefined {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as T : undefined;
}
