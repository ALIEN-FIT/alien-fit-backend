# Flutter Admin: Add/Remove Trainings While Editing a Plan

The backend now allows the admin app to add new training items and remove existing items while editing a training plan day.

## Edit Day Endpoint

```http
PATCH /api/v1/plans/training/admin/:planId/day/:dayIndex
Authorization: Bearer <admin-token>
Content-Type: application/json
```

Use this endpoint when the admin opens an existing plan day and wants to change the day contents.

## Add New Trainings

Send `addItems` with one or more new training items.

```json
{
  "addItems": [
    {
      "itemType": "REGULAR",
      "trainingVideoId": "video-id",
      "sets": 4,
      "repeats": 12
    }
  ]
}
```

The backend appends the new items to the end of the selected day.

## Remove Existing Trainings

Send `removeItemIds` with the item ids to remove.

```json
{
  "removeItemIds": [
    "training-plan-item-id"
  ]
}
```

The backend removes those items and reorders the remaining day items automatically.

## Add And Remove In One Edit

The Flutter admin app can add and remove items in the same request:

```json
{
  "addItems": [
    {
      "itemType": "REGULAR",
      "trainingVideoId": "new-video-id",
      "sets": 3,
      "repeats": 15
    }
  ],
  "removeItemIds": [
    "old-training-plan-item-id"
  ]
}
```

## Important Rule

Do not send `items` together with `addItems` or `removeItemIds`.

- `items` means replace the full day item list.
- `addItems` and `removeItemIds` mean partially edit the existing day.

Invalid:

```json
{
  "items": [],
  "addItems": [
    {
      "itemType": "REGULAR",
      "trainingVideoId": "video-id",
      "sets": 4,
      "repeats": 12
    }
  ]
}
```

## Supported Item Types

`addItems` accepts the same item models used when creating a plan:

- `REGULAR`
- `SUPERSET`
- `DROPSET`
- `CIRCUIT`

Example `SUPERSET`:

```json
{
  "addItems": [
    {
      "itemType": "SUPERSET",
      "trainingVideoId": "main-video-id",
      "sets": 3,
      "repeats": 10,
      "supersetItems": [
        {
          "trainingVideoId": "superset-video-id",
          "sets": 3,
          "repeats": 10
        }
      ],
      "extraVideos": [
        {
          "trainingVideoId": "extra-video-id"
        }
      ]
    }
  ]
}
```

## Response

The response returns the updated training plan:

```json
{
  "status": "success",
  "data": {
    "trainingPlan": {}
  }
}
```

Flutter should refresh the edited plan/day from `data.trainingPlan`.
