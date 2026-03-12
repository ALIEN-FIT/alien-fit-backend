# Endpoints Update README (March 2026)

This file documents newly added or updated endpoints and request bodies based on the latest backend changes.

## 0) Subscription Freeze Request Lifecycle

Create freeze request (user):

```http
POST /api/v1/subscription/freeze
Authorization: Bearer <user-token>
```

Request body:

```json
{
  "requestedDays": 7,
  "note": "Optional user note"
}
```

List pending requests (admin):

```http
GET /api/v1/subscription/freeze/requests/pending
Authorization: Bearer <admin-token>
```

Approve request (admin; optional override days):

```http
POST /api/v1/subscription/freeze/requests/:requestId/approve
Authorization: Bearer <admin-token>
```

Request body:

```json
{
  "freezeDays": null,
  "note": "Optional admin note"
}
```

Decline request (admin):

```http
POST /api/v1/subscription/freeze/requests/:requestId/decline
Authorization: Bearer <admin-token>
```

Request body:

```json
{
  "note": "Optional decline reason"
}
```

Defrost options:

```http
POST /api/v1/subscription/defrost
POST /api/v1/subscription/defrost/:userId
```

Rules:
- One pending freeze request per user.
- Admin can approve/decline.
- If approval `freezeDays` is `null`, user requested days are used.
- Auto-defrost is applied once freeze duration ends.

## 1) Training Video Admin: Replace Video Everywhere

Endpoint:

```http
POST /api/v1/training-videos/:videoId/replace
Authorization: Bearer <admin-token>
```

Request body:

```json
{
  "replacementVideoId": "8b3e5c17-3ec0-4f77-9668-d7e7f71a9c1f",
  "deleteOld": false,
  "deactivateOld": true
}
```

Notes:
- `replacementVideoId` is required.
- Old and replacement IDs must be different.
- Replaces references in user training plans, default plans, and static plans.

## 2) Training Plan Admin Adjustments

Update one day in a training plan:

```http
PATCH /api/v1/plans/training/admin/:planId/day/:dayIndex
Authorization: Bearer <admin-token>
```

Request body example:

```json
{
  "name": "Push Day",
  "items": [
    {
      "trainingVideoId": "d4f37b93-126f-4f1f-a10a-9d5275fc9f55",
      "sets": 4,
      "repeats": 12,
      "itemType": "REGULAR"
    },
    {
      "trainingVideoId": "9cf3d78f-58c6-4abf-9622-cd8f5d84fdf1",
      "sets": 3,
      "repeats": 10,
      "itemType": "SUPERSET",
      "supersetItems": [
        {
          "trainingVideoId": "7eab69c8-9f3d-4f96-a004-5fed34f8f2b8",
          "sets": 3,
          "repeats": 10
        }
      ],
      "extraVideos": [
        {
          "trainingVideoId": "f68ea17a-8a54-4f9a-9517-57f29c86e404"
        }
      ]
    }
  ]
}
```

Clear all items in a day:

```http
DELETE /api/v1/plans/training/admin/:planId/day/:dayIndex
Authorization: Bearer <admin-token>
```

Update one item:

```http
PATCH /api/v1/plans/training/admin/item/:itemId
Authorization: Bearer <admin-token>
```

Alias endpoint (same behavior):

```http
PATCH /api/v1/plans/training/item/:itemId
Authorization: Bearer <admin-token>
```

Request body example:

```json
{
  "sets": 5,
  "repeats": 8,
  "itemType": "DROPSET",
  "dropsetConfig": {
    "dropPercents": [20, 20, 20],
    "restSeconds": 20
  }
}
```

Delete one item:

```http
DELETE /api/v1/plans/training/admin/item/:itemId
Authorization: Bearer <admin-token>
```

## 3) Diet Plan Admin Adjustments

Update one day in a diet plan:

```http
PATCH /api/v1/plans/diet/admin/:planId/day/:dayIndex
Authorization: Bearer <admin-token>
```

Request body example:

```json
{
  "meals": [
    { "mealName": "Breakfast", "order": 1, "text": "Eggs + oats" },
    { "mealName": "Lunch", "order": 2, "text": "Chicken + rice + salad" }
  ],
  "snacks": [
    { "mealName": "Snack 1", "order": 3, "text": "Greek yogurt + berries" }
  ]
}
```

Clear all day entries:

```http
DELETE /api/v1/plans/diet/admin/:planId/day/:dayIndex
Authorization: Bearer <admin-token>
```

Update one meal/snack item:

```http
PATCH /api/v1/plans/diet/admin/meal/:mealItemId
Authorization: Bearer <admin-token>
```

Request body example:

```json
{
  "mealName": "Snack 2",
  "order": 4,
  "text": "Protein shake + banana",
  "itemType": "SNACK"
}
```

Delete one meal/snack item:

```http
DELETE /api/v1/plans/diet/admin/meal/:mealItemId
Authorization: Bearer <admin-token>
```

## 3.1) Static Training Plan: Update One Training By Training ID

Update one item inside `staticTrainingPlan.trainings[]` using its own training id.

```http
PATCH /api/v1/plans/static-training-plans/:planId/training/:trainingId
Authorization: Bearer <admin-token>
```

Request body example (regular training):

```json
{
  "type": "REGULAR",
  "trainingVideoId": "cd13a84d-f547-4f76-80b9-620026f6cece",
  "title": "Leg Press (Updated)",
  "description": "Controlled tempo + full range",
  "sets": 5,
  "repeats": 10,
  "duration": null,
  "order": 1
}
```

Delete one training block by `trainingId`:

```http
DELETE /api/v1/plans/static-training-plans/:planId/training/:trainingId
Authorization: Bearer <admin-token>
```

Returns the updated `staticTrainingPlan` payload after deletion.

Request body example (superset/circuit/dropset style):

```json
{
  "type": "SUPERSET",
  "title": "Superset A (Updated)",
  "sets": 3,
  "items": [
    {
      "trainingVideoId": "cd13a84d-f547-4f76-80b9-620026f6cece",
      "title": "Back (High Bar)",
      "repeats": 12
    },
    {
      "trainingVideoId": "cd13a84d-f547-4f76-80b9-620026f6cece",
      "title": "Back (High Bar) 2",
      "repeats": 12
    }
  ],
  "config": null
}
```

## 4) Tracking Update: Training Done Details

Existing endpoint now accepts done details:

```http
POST /api/v1/tracking/training/mark-done
Authorization: Bearer <token>
```

Request body:

```json
{
  "planItemId": "5f392f9b-60df-4066-97b7-b19a9d2b8268",
  "date": "2026-03-09",
  "doneSets": 4,
  "doneRepeats": 12,
  "note": "Last set to failure"
}
```

Tracking response now includes:
- `trainingCompletionRecords`: array of `{ planItemId, doneSets, doneRepeats, completedAt, note? }`.

## 5) User Profile Update: InBody Image

Existing endpoints now support `inbodyImage`:

```http
POST /api/v1/user-profile/me
POST /api/v1/user-profile/:userId
Authorization: Bearer <token>
```

Request body example:

```json
{
  "bodyImages": ["0f31ad57-9d53-4f20-a855-534a1f6ea9df"],
  "inbodyImage": "2c7f2b4c-733e-42fe-bb63-2a8f3fef58a6"
}
```

## 6) Reminder Behavior Update (No New Public Endpoint)

Worker behavior updates:
- Workout reminder message fixed and sent when user has training scheduled today and `trainingDone=false`.
- Weekly body image reminder added.
- Biweekly InBody reminder added.

## 7) Migration Required

Run:

```bash
npm run migration:up
```

New migration:
- `src/database/migrations/20260309120000-add-profile-and-tracking-reminder-fields.cjs`
