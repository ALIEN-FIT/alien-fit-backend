# Subscription, Plan, and Tracking Lifecycle

This document describes how the subscription lifecycle, weekly plan management, plan-update requests, and daily tracking modules fit together. It also lists the REST endpoints that power the flow with sample request bodies and responses.

## High-Level Flow

1. **Admin activates subscription** for a user, granting access to profile updates and plans.
2. **Admin seeds weekly templates** for training and diet plans; each template expands into a four-week program.
3. **Athlete signs in** and can pull their active plans alongside subscription status.
4. **Athlete updates profile** only when subscription is active and the update window is open; otherwise, a plan-update request is queued for admins.
5. **Admin reviews requests** and approves or rejects them, and can refresh plans after approval.
6. **Athlete executes plans daily** while marking progress, logging extras, and tracking hydration.
7. **System enforces cadence**: profile updates and plan adjustments rely on active subscriptions and admin actions.

```
Admin activates subscription ──▶ Subscription active? ──▶ Four-week plans generated
         │                                 │                         │
         ▼                                 ▼                         ▼
 Admin reviews plan-update requests ◀──── Athlete submits request ─ Athlete tracks completion & extras
```

## Key Domain Rules

- Subscription activation/renewal sets a four-week window (`nextProfileUpdateDue`).
- User profile updates require an active subscription **and** an open update window; otherwise, a pending plan-update request is created automatically.
- Training and diet plans are created by admins only, repeat the provided seven-day template across four weeks (28 days total), and training blocks now reference the reusable training-video library (each item points to a curated video plus required sets/repeats and optional supersets).
- Daily tracking records completion of plan items, extra work, extra food, and water intake.

## Endpoint Reference

All routes require authentication unless noted. Admin-only routes are explicitly marked.

### Subscription Lifecycle

| Method | Route | Description | Notes |
| --- | --- | --- | --- |
| `POST` | `/api/v1/subscription/activate/:userId` | Activate a four-week subscription for a user | Admin only |
| `POST` | `/api/v1/subscription/renew/:userId` | Extend subscription four more weeks | Admin only |
| `GET` | `/api/v1/subscription/status` | Fetch current user subscription status | Returns `isSubscribed` and profile cadence flags |

Sample: Activate subscription

```http
POST /api/v1/subscription/activate/43b1a7f4-0c57-4d1f-9d41-93322d4b0f68
Authorization: Bearer <admin-token>
```

Successful response:

```json
{
  "status": "success",
  "data": {
    "subscription": {
      "id": "f6fbbf0c-81d1-4386-9dd2-86f2b31fd655",
      "userId": "43b1a7f4-0c57-4d1f-9d41-93322d4b0f68",
      "startDate": "2025-11-16T09:12:53.381Z",
      "endDate": "2025-12-14T09:12:53.381Z",
      "nextProfileUpdateDue": "2025-12-14T09:12:53.381Z",
      "isSubscribed": true,
      "isActive": true
    }
  }
}
```

### Plan Update Requests

| Method | Route | Description | Notes |
| --- | --- | --- | --- |
| `POST` | `/api/v1/plans/request-update` | End user asks for plan/profile update (payload optional) | Auto-created when profile update window closed |
| `GET` | `/api/v1/plans/request-update` | List requests, filtered by status | Admin only |
| `POST` | `/api/v1/plans/request-update/:requestId/approve` | Approve a pending request | Admin only |

Manual request sample (user):

```http
POST /api/v1/plans/request-update
Authorization: Bearer <user-token>
Content-Type: application/json

{
  "payload": {
    "reason": "Plateauing on current plan",
    "preferredFocus": "Hypertrophy"
  },
  "notes": "Would love to increase leg volume"
}
```

Approval sample:

```http
POST /api/v1/plans/request-update/6b6f3c64-8f76-4c72-b803-1dca2d6d6f16/approve
Authorization: Bearer <admin-token>
```

### Training Videos & Tags

Admins manage the reusable training library, and all plan items reference these records by ID. Tags help athletes filter content in the app.

| Method | Route | Description | Notes |
| --- | --- | --- | --- |
| `POST` | `/api/v1/training-videos` | Create a training video with metadata and tags | Admin only |
| `GET` | `/api/v1/training-videos` | Search/list videos with pagination and tag filtering | Authenticated |
| `GET` | `/api/v1/training-videos/:videoId` | Fetch a single training video + tags | Authenticated |
| `PATCH` | `/api/v1/training-videos/:videoId` | Update metadata or tag assignments | Admin only |
| `DELETE` | `/api/v1/training-videos/:videoId` | Remove a training video | Admin only |
| `POST` | `/api/v1/training-videos/tags` | Create a training tag (title, description, image) | Admin only |
| `GET` | `/api/v1/training-videos/tags` | List/search tags | Authenticated |
| `GET` | `/api/v1/training-videos/tags/:tagId` | Fetch a single tag | Authenticated |
| `PATCH` | `/api/v1/training-videos/tags/:tagId` | Update a tag | Admin only |
| `DELETE` | `/api/v1/training-videos/tags/:tagId` | Delete a tag | Admin only |

Sample create request:

```http
POST /api/v1/training-videos
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "title": "Back Squat (High Bar)",
  "description": "4 cues for staying upright",
  "videoUrl": "https://cdn.example.com/squat.mp4",
  "tagIds": ["leg-strength", "barbell"]
}
```

### Training Plans (Admin managed)

| Method | Route | Description | Notes |
| --- | --- | --- | --- |
| `POST` | `/api/v1/plans/training/week/:userId` | Create/overwrite four-week training plan from 7-day template | Admin only |
| `GET` | `/api/v1/plans/training/:userId` | Retrieve user plan | Admin or owner |

Request template example (each item references a training video and optionally defines a two-item superset block):

```http
POST /api/v1/plans/training/week/43b1a7f4-0c57-4d1f-9d41-93322d4b0f68
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "startDate": "2025-11-18T00:00:00.000Z",
  "days": [
    {
      "dayNumber": 1,
      "items": [
        {
          "trainingVideoId": "a1f1d510-9e7c-4f34-9f1c-ca4fcb7dcd2c",
          "sets": 4,
          "repeats": 6
        },
        {
          "trainingVideoId": "01c15f13-76e3-4bc3-934b-8bd9690caeb7",
          "sets": 3,
          "repeats": 12,
          "isSuperset": true,
          "supersetItems": [
            {
              "trainingVideoId": "6f7f259b-7404-4289-8ed7-59f0e0e7a7a1",
              "sets": 3,
              "repeats": 12
            },
            {
              "trainingVideoId": "1bfb0d23-8516-44fc-8d73-74fa02cbfe37",
              "sets": 3,
              "repeats": 15
            }
          ]
        }
      ]
    },
    {
      "dayNumber": 2,
      "items": [
        {
          "title": "Bench Press",
          "description": "5 x 5",
          "duration": 35
        }
      ]
    },
    { "dayNumber": 3, "items": [] },
    { "dayNumber": 4, "items": [] },
    { "dayNumber": 5, "items": [] },
    { "dayNumber": 6, "items": [] },
    { "dayNumber": 7, "items": [] }
  ]
}
```

Response snippet (28-day expansion shown abridged):

```json
{
  "status": "success",
  "data": {
    "trainingPlan": {
      "weeks": [
        {
          "weekNumber": 1,
          "days": [
            {
              "dayIndex": 1,
              "date": "2025-11-18T00:00:00.000Z",
              "items": [
                {
                  "id": "...",
                  "order": 1,
                  "sets": 4,
                  "repeats": 6,
                  "isSuperset": false,
                  "trainingVideo": {
                    "id": "a1f1d510-9e7c-4f34-9f1c-ca4fcb7dcd2c",
                    "title": "Back Squat (High Bar)",
                    "videoUrl": "https://cdn.example.com/squat.mp4",
                    "tags": [
                      { "id": "leg-strength", "title": "Leg Strength", "imageUrl": "https://cdn.example.com/leg.png" }
                    ]
                  },
                  "supersetItems": []
                },
                {
                  "id": "...",
                  "order": 2,
                  "sets": 3,
                  "repeats": 12,
                  "isSuperset": true,
                  "trainingVideo": {
                    "id": "01c15f13-76e3-4bc3-934b-8bd9690caeb7",
                    "title": "Walking Lunges",
                    "videoUrl": "https://cdn.example.com/lunge.mp4",
                    "tags": []
                  },
                  "supersetItems": [
                    {
                      "trainingVideoId": "6f7f259b-7404-4289-8ed7-59f0e0e7a7a1",
                      "sets": 3,
                      "repeats": 12,
                      "trainingVideo": {
                        "id": "6f7f259b-7404-4289-8ed7-59f0e0e7a7a1",
                        "title": "Glute Bridge",
                        "videoUrl": "https://cdn.example.com/glute_bridge.mp4",
                        "tags": []
                      }
                    },
                    {
                      "trainingVideoId": "1bfb0d23-8516-44fc-8d73-74fa02cbfe37",
                      "sets": 3,
                      "repeats": 15,
                      "trainingVideo": {
                        "id": "1bfb0d23-8516-44fc-8d73-74fa02cbfe37",
                        "title": "Reverse Hyper",
                        "videoUrl": "https://cdn.example.com/rev_hyper.mp4",
                        "tags": []
                      }
                    }
                  ]
                }
              ]
            },
            {
              "dayIndex": 2,
              "items": [
                {
                  "id": "...",
                  "order": 1,
                  "sets": 5,
                  "repeats": 5,
                  "isSuperset": false,
                  "trainingVideo": { "id": "...", "title": "Bench Press", "videoUrl": "https://cdn.example.com/bench.mp4", 
                  "supersetItems": []
                }
              ]
            }
          ]
        },
        { "weekNumber": 2, "days": [/* template repeats */] }
      ]
    }
  }
}
```

### Diet Plans (Admin managed)

| Method | Route | Description | Notes |
| --- | --- | --- | --- |
| `POST` | `/api/v1/plans/diet/week/:userId` | Create/overwrite diet plan | Admin only |
| `GET` | `/api/v1/plans/diet/:userId` | Retrieve diet plan | Admin or owner |

Request example:

```http
POST /api/v1/plans/diet/week/43b1a7f4-0c57-4d1f-9d41-93322d4b0f68
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "startDate": "2025-11-18T00:00:00.000Z",
  "days": [
    {
      "dayNumber": 1,
      "meals": {
        "breakfast": [ { "foodName": "Greek Yogurt", "amount": "200g" } ],
        "lunch": [ { "foodName": "Grilled Salmon", "amount": "180g" } ],
        "snacks": [ { "foodName": "Almonds", "amount": "30g" } ],
        "dinner": [ { "foodName": "Quinoa Bowl", "amount": "1 bowl" } ]
      }
    },
    { "dayNumber": 2, "meals": { "breakfast": [], "lunch": [], "snacks": [], "dinner": [] } },
    { "dayNumber": 3, "meals": { "breakfast": [], "lunch": [], "snacks": [], "dinner": [] } },
    { "dayNumber": 4, "meals": { "breakfast": [], "lunch": [], "snacks": [], "dinner": [] } },
    { "dayNumber": 5, "meals": { "breakfast": [], "lunch": [], "snacks": [], "dinner": [] } },
    { "dayNumber": 6, "meals": { "breakfast": [], "lunch": [], "snacks": [], "dinner": [] } },
    { "dayNumber": 7, "meals": { "breakfast": [], "lunch": [], "snacks": [], "dinner": [] } }
  ]
}
```

### Daily Tracking

| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/api/v1/tracking/training/mark-done` | Mark a training plan item completed |
| `POST` | `/api/v1/tracking/diet/mark-done` | Mark a diet meal item completed |
| `POST` | `/api/v1/tracking/extra/training` | Log additional training outside plan |
| `POST` | `/api/v1/tracking/extra/food` | Log extra food items |
| `POST` | `/api/v1/tracking/water` | Add to daily water intake |
| `GET` | `/api/v1/tracking/daily-status/:date` | View aggregated daily progress |

Mark training item done:

```http
POST /api/v1/tracking/training/mark-done
Authorization: Bearer <user-token>
Content-Type: application/json

{
  "planItemId": "0d67e4a0-3af6-4117-9840-dad7869323e3"
}
```

Log extra training session:

```http
POST /api/v1/tracking/extra/training
Authorization: Bearer <user-token>
Content-Type: application/json

{
  "date": "2025-11-20",
  "description": "Evening yoga flow",
  "durationMinutes": 30
}
```

Fetch daily status:

```http
GET /api/v1/tracking/daily-status/2025-11-20
Authorization: Bearer <user-token>
```

Response snippet:

```json
{
  "status": "success",
  "data": {
    "tracking": {
      "date": "2025-11-20",
      "trainingDone": true,
      "dietDone": false,
      "waterIntakeMl": 1800,
      "trainingCompletedItemIds": ["0d67e4a0-3af6-4117-9840-dad7869323e3"],
      "dietCompletedItemIds": ["53ff8d2c-3dcb-4db2-ae16-216d7da69b88"],
      "extraTrainingEntries": [
        { "description": "Evening yoga flow", "durationMinutes": 30 }
      ],
      "extraFoodEntries": [
        { "description": "Protein shake", "calories": 180 }
      ]
    }
  }
}
```

## Example End-to-End User Journey

1. **Admin** activates the user subscription and seeds training/diet plans.
2. **User** logs in and calls `GET /api/v1/subscription/status` and `GET /api/v1/plans/training/:userId` plus `GET /api/v1/plans/diet/:userId` to view their programs.
3. **User** starts logging daily progress via the tracking endpoints.
4. When the user attempts a profile update but the cadence window is closed, the backend automatically creates a pending plan-update request.
5. **Admin** reviews requests via `GET /api/v1/plans/request-update` and approves them; after approval they may refresh the user’s plans.
6. **Cycle repeats** as the subscription renews and the athlete progresses.

## Testing Notes

- Integration coverage exists in `tests/integration/core.integration.test.ts` to validate the subscription/profile/plan/tracking cycle.
- SQLite in-memory is used for test execution via the Jest setup.
