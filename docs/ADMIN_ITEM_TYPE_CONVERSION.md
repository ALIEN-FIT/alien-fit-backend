# Admin Workout Item Type Conversion Guide

## Issue Fixed ✅

When an admin tried to update a training plan item and change its `itemType` (e.g., from `REGULAR` to `SUPERSET` or `CIRCUIT`), the backend was rejecting the request with:

```
"REGULAR cannot include supersetItems or extraVideos"
```

This happened because old type-specific fields were being carried over from the previous item type.

## Solution Implemented

The `updatePlanItemById` method now **clears type-specific fields** when the itemType changes. This ensures only relevant fields for the new type are included in the update.

### How It Works

When updating an item:

```typescript
// Old behavior - carried over all fields regardless of type
const currentData = {
  itemType: 'SUPERSET', // New type
  supersetItems: oldSupersetItems,
  dropsetConfig: oldDropsetConfig, // ❌ Wrong type field!
  circuitItems: oldCircuitItems,    // ❌ Wrong type field!
};

// New behavior - includes only fields for the target type
const currentData = {
  itemType: 'SUPERSET', // New type
  supersetItems: payload.supersetItems || item.supersetItems, // ✅ Only SUPERSET fields
  extraVideos: payload.extraVideos,                            // ✅ Only SUPERSET fields
  dropsetConfig: undefined,  // ✅ Cleared (not relevant to SUPERSET)
  circuitItems: undefined,   // ✅ Cleared (not relevant to SUPERSET)
};
```

---

## Conversion Examples Now Supported

### 1. REGULAR → SUPERSET

```json
{
  "itemType": "SUPERSET",
  "trainingVideoId": "video-123",
  "sets": 3,
  "repeats": 10,
  "supersetItems": [
    {
      "trainingVideoId": "video-456",
      "sets": 3,
      "repeats": 10
    },
    {
      "trainingVideoId": "video-789",
      "sets": 3,
      "repeats": 12
    }
  ]
}
```

### 2. REGULAR → DROPSET

```json
{
  "itemType": "DROPSET",
  "trainingVideoId": "video-123",
  "sets": 3,
  "repeats": 10,
  "dropsetConfig": {
    "dropPercents": [100, 80, 60],
    "restSeconds": 30
  }
}
```

### 3. REGULAR → CIRCUIT

```json
{
  "itemType": "CIRCUIT",
  "circuitItems": [
    {
      "trainingVideoId": "video-111",
      "sets": 3,
      "repeats": 8
    },
    {
      "trainingVideoId": "video-222",
      "sets": 3,
      "repeats": 10
    },
    {
      "trainingVideoId": "video-333",
      "sets": 3,
      "repeats": 12
    }
  ]
}
```

### 4. SUPERSET → REGULAR

```json
{
  "itemType": "REGULAR",
  "trainingVideoId": "video-123",
  "sets": 4,
  "repeats": 8
}
```

---

## API Endpoint

```
PATCH /api/v1/plans/training/admin/item/:itemId
Content-Type: application/json
Authorization: Bearer <admin-token>
```

### Request Body (Type Conversion)

Simply include:
1. `itemType` - new exercise type
2. Type-specific fields for the new type
3. Optional: `trainingVideoId`, `sets`, `repeats` to update them too

The backend will automatically:
- ✅ Clear irrelevant fields
- ✅ Validate only fields relevant to the new type
- ✅ Preserve the item in the plan

---

## Testing the Fix

### Using cURL

```bash
curl -X PATCH \
  https://api.example.com/api/v1/plans/training/admin/item/c2e2b22d-5e29-4ca4-9997-09a5cd55aaa6 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "itemType": "SUPERSET",
    "supersetItems": [
      {
        "trainingVideoId": "video-1",
        "sets": 3,
        "repeats": 10
      },
      {
        "trainingVideoId": "video-2",
        "sets": 3,
        "repeats": 12
      }
    ]
  }'
```

### Using Flutter (Dio)

```dart
await adminWorkoutService.updateTrainingItem(
  itemId: 'item-id-123',
  updates: {
    'itemType': 'SUPERSET',
    'supersetItems': [
      {
        'trainingVideoId': 'video-1',
        'sets': 3,
        'repeats': 10,
      },
      {
        'trainingVideoId': 'video-2',
        'sets': 3,
        'repeats': 12,
      },
    ],
  },
);
```

---

## Field Reference by Type

| Field | REGULAR | SUPERSET | DROPSET | CIRCUIT |
|-------|---------|----------|---------|---------|
| `trainingVideoId` | ✅ Required | ✅ Required | ✅ Required | ❌ N/A* |
| `sets` | ✅ Required | ✅ Required | ✅ Required | ❌ N/A* |
| `repeats` | ✅ Required | ✅ Required | ✅ Required | ❌ N/A* |
| `supersetItems` | ❌ Not allowed | ✅ Required | ❌ Not allowed | ❌ Not allowed |
| `extraVideos` | ❌ Not allowed | ✅ Optional | ❌ Not allowed | ❌ Not allowed |
| `dropsetConfig` | ❌ Not allowed | ❌ Not allowed | ✅ Required | ❌ Not allowed |
| `circuitItems` | ❌ Not allowed | ❌ Not allowed | ❌ Not allowed | ✅ Optional |
| `circuitGroup` | ❌ Not allowed | ❌ Not allowed | ❌ Not allowed | ✅ Optional |

*CIRCUIT items get `sets` and `repeats` from `circuitItems` array

---

## Error Handling

### Common Errors After Fix

| Error | Cause | Solution |
|-------|-------|----------|
| `SUPERSET must include at least 2 exercises` | Less than 2 items in supersetItems | Add minimum 2 items to supersetItems |
| `DROPSET must include dropsetConfig.dropPercents` | Missing dropsetConfig | Provide dropsetConfig with dropPercents array |
| `CIRCUIT cannot include circuitGroup when circuitItems are provided` | Invalid CIRCUIT config | Either use circuitItems OR circuitGroup, not both |
| `Unknown training video` | Invalid trainingVideoId | Verify video exists in the system |

---

## Summary

✅ **Fixed:** Admin can now change workout item types freely
✅ **Supported:** All type conversions (REGULAR ↔ SUPERSET ↔ DROPSET ↔ CIRCUIT)
✅ **Safe:** Type-specific fields are automatically cleared to prevent validation errors
✅ **Flexible:** Partial updates are supported (only specify fields you want to change)

The fix is live in the backend. Your Flutter app can now update exercise types without restrictions!
