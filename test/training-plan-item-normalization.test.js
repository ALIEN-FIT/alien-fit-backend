import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildTrainingPlanItemUpdateInput } from '../src/modules/plans/training/v1/training-plan-item-normalization.js';

const videoOne = '11111111-1111-1111-1111-111111111111';
const videoTwo = '22222222-2222-2222-2222-222222222222';
const videoThree = '33333333-3333-3333-3333-333333333333';

describe('buildTrainingPlanItemUpdateInput', () => {
    it('patches an existing SUPERSET item to REGULAR without carrying supersetItems', () => {
        const existing = existingItem({
            itemType: 'SUPERSET',
            isSuperset: true,
            supersetItems: [{ trainingVideoId: videoTwo, sets: 3, repeats: 10 }],
        });

        const result = buildTrainingPlanItemUpdateInput(existing, {
            itemType: 'REGULAR',
            trainingVideoId: videoOne,
            sets: 4,
            repeats: 12,
        });

        assert.equal(result.itemType, 'REGULAR');
        assert.equal(result.trainingVideoId, videoOne);
        assert.equal(result.sets, 4);
        assert.equal(result.repeats, 12);
        assert.equal(result.isSuperset, false);
        assert.deepEqual(result.supersetItems, []);
        assert.deepEqual(result.extraVideos, []);
    });

    it('patches a legacy REGULAR item with extraVideos as REGULAR without carrying extraVideos', () => {
        const existing = existingItem({
            itemType: 'REGULAR',
            extraVideos: [{ trainingVideoId: videoTwo }],
        });

        const result = buildTrainingPlanItemUpdateInput(existing, {
            itemType: 'REGULAR',
            trainingVideoId: videoOne,
            sets: 4,
            repeats: 12,
        });

        assert.equal(result.itemType, 'REGULAR');
        assert.deepEqual(result.supersetItems, []);
        assert.deepEqual(result.extraVideos, []);
    });

    it('clears all type-specific fields that are incompatible with REGULAR', () => {
        const existing = existingItem({
            itemType: 'CIRCUIT',
            supersetItems: [{ trainingVideoId: videoTwo, sets: 3, repeats: 10 }],
            extraVideos: [{ trainingVideoId: videoThree }],
            dropsetConfig: { dropPercents: [20], restSeconds: 10 },
            circuitItems: [{ trainingVideoId: videoThree, sets: 2, repeats: 20 }],
            circuitGroup: 'A',
        });

        const result = buildTrainingPlanItemUpdateInput(existing, {
            itemType: 'REGULAR',
            trainingVideoId: videoOne,
            sets: 4,
            repeats: 12,
        });

        assert.equal(result.itemType, 'REGULAR');
        assert.deepEqual(result.supersetItems, []);
        assert.deepEqual(result.extraVideos, []);
        assert.deepEqual(result.circuitItems, []);
        assert.equal(result.dropsetConfig, undefined);
        assert.equal(result.circuitGroup, undefined);
    });

    it('normalizes explicitly sent REGULAR-only incompatible arrays by clearing them', () => {
        const result = buildTrainingPlanItemUpdateInput(existingItem(), {
            itemType: 'REGULAR',
            trainingVideoId: videoOne,
            sets: 4,
            repeats: 12,
            supersetItems: [{ trainingVideoId: videoTwo, sets: 3, repeats: 10 }],
            extraVideos: [{ trainingVideoId: videoThree }],
            circuitItems: [{ trainingVideoId: videoThree, sets: 2, repeats: 20 }],
        });

        assert.equal(result.itemType, 'REGULAR');
        assert.deepEqual(result.supersetItems, []);
        assert.deepEqual(result.extraVideos, []);
        assert.deepEqual(result.circuitItems, []);
    });
});

function existingItem(overrides = {}) {
    return {
        trainingVideoId: videoOne,
        sets: 3,
        repeats: 10,
        itemType: 'REGULAR',
        isSuperset: false,
        supersetItems: null,
        extraVideos: null,
        dropsetConfig: null,
        circuitItems: null,
        circuitGroup: null,
        ...overrides,
    };
}
