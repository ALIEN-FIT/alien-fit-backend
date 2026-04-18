# Training Plan Item Types

This document describes the current training-plan request schema for all supported `itemType` values:

- `REGULAR`
- `SUPERSET`
- `DROPSET`
- `CIRCUIT`

## Endpoints

Create a user training plan:

```http
POST /api/v1/plans/training/week/:userId
```

Create the default training plan:

```http
POST /api/v1/admin/settings/training-plan/default
```

Both endpoints use the same `days[].items[]` item schema.

## Main Change

`CIRCUIT` no longer needs multiple separate items grouped by `circuitGroup`.

New `CIRCUIT` format:

- one training-plan item
- contains `circuitItems`
- each `circuitItems[]` entry contains:
  - `trainingVideoId`
  - `sets`
  - `repeats`

Legacy `circuitGroup` data is still readable in old records, but new requests should use `circuitItems`.

## Item Schemas

### 1. `REGULAR`

```json
{
  "itemType": "REGULAR",
  "trainingVideoId": "11111111-1111-1111-1111-111111111111",
  "sets": 4,
  "repeats": 12
}
```

Rules:

- requires `trainingVideoId`
- requires `sets`
- requires `repeats`
- must not include `supersetItems`
- must not include `extraVideos`
- must not include `dropsetConfig`
- must not include `circuitItems`

### 2. `SUPERSET`

```json
{
  "itemType": "SUPERSET",
  "trainingVideoId": "22222222-2222-2222-2222-222222222222",
  "sets": 4,
  "repeats": 10,
  "supersetItems": [
    {
      "trainingVideoId": "33333333-3333-3333-3333-333333333333",
      "sets": 4,
      "repeats": 10
    }
  ],
  "extraVideos": [
    {
      "trainingVideoId": "44444444-4444-4444-4444-444444444444"
    }
  ]
}
```

Rules:

- requires `trainingVideoId`
- requires `sets`
- requires `repeats`
- requires at least one `supersetItems[]` entry
- optional `extraVideos`
- must not include `dropsetConfig`
- must not include `circuitItems`

### 3. `DROPSET`

```json
{
  "itemType": "DROPSET",
  "trainingVideoId": "55555555-5555-5555-5555-555555555555",
  "sets": 3,
  "repeats": 8,
  "dropsetConfig": {
    "dropPercents": [20, 30],
    "restSeconds": 15
  }
}
```

Rules:

- requires `trainingVideoId`
- requires `sets`
- requires `repeats`
- requires `dropsetConfig.dropPercents`
- `dropPercents` values must be between `1` and `99`
- must not include `supersetItems`
- must not include `extraVideos`
- must not include `circuitItems`

### 4. `CIRCUIT`

```json
{
  "itemType": "CIRCUIT",
  "circuitItems": [
    {
      "trainingVideoId": "66666666-6666-6666-6666-666666666666",
      "sets": 3,
      "repeats": 15
    },
    {
      "trainingVideoId": "77777777-7777-7777-7777-777777777777",
      "sets": 3,
      "repeats": 20
    },
    {
      "trainingVideoId": "88888888-8888-8888-8888-888888888888",
      "sets": 3,
      "repeats": 12
    }
  ]
}
```

Rules:

- requires `circuitItems`
- `circuitItems` must contain at least one item
- each circuit item requires:
  - `trainingVideoId`
  - `sets`
  - `repeats`
- must not include top-level `trainingVideoId`
- must not include top-level `sets`
- must not include top-level `repeats`
- must not include `supersetItems`
- must not include `extraVideos`
- must not include `dropsetConfig`
- new requests should not include `circuitGroup`

## Full Request Example

This is a full valid request body with all 4 item types.

```json
{
  "startDate": "2026-04-18T00:00:00.000Z",
  "days": [
    {
      "name": "Upper Body Strength",
      "dayNumber": 1,
      "items": [
        {
          "itemType": "REGULAR",
          "trainingVideoId": "11111111-1111-1111-1111-111111111111",
          "sets": 4,
          "repeats": 12
        },
        {
          "itemType": "SUPERSET",
          "trainingVideoId": "22222222-2222-2222-2222-222222222222",
          "sets": 4,
          "repeats": 10,
          "supersetItems": [
            {
              "trainingVideoId": "33333333-3333-3333-3333-333333333333",
              "sets": 4,
              "repeats": 10
            }
          ],
          "extraVideos": [
            {
              "trainingVideoId": "44444444-4444-4444-4444-444444444444"
            }
          ]
        },
        {
          "itemType": "DROPSET",
          "trainingVideoId": "55555555-5555-5555-5555-555555555555",
          "sets": 3,
          "repeats": 8,
          "dropsetConfig": {
            "dropPercents": [20, 30],
            "restSeconds": 15
          }
        },
        {
          "itemType": "CIRCUIT",
          "circuitItems": [
            {
              "trainingVideoId": "66666666-6666-6666-6666-666666666666",
              "sets": 3,
              "repeats": 15
            },
            {
              "trainingVideoId": "77777777-7777-7777-7777-777777777777",
              "sets": 3,
              "repeats": 20
            },
            {
              "trainingVideoId": "88888888-8888-8888-8888-888888888888",
              "sets": 3,
              "repeats": 12
            }
          ]
        }
      ]
    },
    {
      "name": "Lower Body",
      "dayNumber": 2,
      "items": []
    },
    {
      "name": "Core",
      "dayNumber": 3,
      "items": []
    },
    {
      "name": "Conditioning",
      "dayNumber": 4,
      "items": []
    },
    {
      "name": "Mobility",
      "dayNumber": 5,
      "items": []
    },
    {
      "name": "Recovery",
      "dayNumber": 6,
      "items": []
    },
    {
      "name": "Full Body",
      "dayNumber": 7,
      "items": []
    }
  ]
}
```

## Response Shape

In plan responses, a `CIRCUIT` item now looks like this:

```json
{
  "id": "99999999-9999-9999-9999-999999999999",
  "order": 4,
  "itemType": "CIRCUIT",
  "sets": 3,
  "repeats": 15,
  "trainingVideo": null,
  "circuitItems": [
    {
      "trainingVideoId": "66666666-6666-6666-6666-666666666666",
      "sets": 3,
      "repeats": 15,
      "trainingVideo": {
        "id": "66666666-6666-6666-6666-666666666666",
        "title": "Jump Squat",
        "description": "Explosive squat variation",
        "videoUrl": "https://example.com/videos/jump-squat",
        "tags": []
      }
    },
    {
      "trainingVideoId": "77777777-7777-7777-7777-777777777777",
      "sets": 3,
      "repeats": 20,
      "trainingVideo": {
        "id": "77777777-7777-7777-7777-777777777777",
        "title": "Mountain Climbers",
        "description": "Core and cardio movement",
        "videoUrl": "https://example.com/videos/mountain-climbers",
        "tags": []
      }
    }
  ],
  "supersetItems": [],
  "extraVideos": [],
  "dropsetConfig": null,
  "circuitGroup": null,
  "isDone": false,
  "excerciceMetadata": null
}
```

## Migration Note

If this change is newly deployed, run:

```bash
npm run migration:up
```

This adds the `circuitItems` column to `training_plan_items`.
