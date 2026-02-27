# Static Training Plans User Flow

This document outlines the user flow for the Static Training Plans module, including the available endpoints, their purposes, and example request/response bodies.

---

## Endpoints

### 1. **List Static Training Plans**
**GET** `/api/v1/plans/static-training-plans`

#### Description:
Retrieve a list of all static training plans. This endpoint is public and does not require authentication.

#### Example Request:
```http
GET /api/v1/plans/static-training-plans HTTP/1.1
Host: example.com
```

#### Example Response:
```json
{
    "status": "success",
    "data": {
        "plans": [
            {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "name": "Beginner Plan",
                "subTitle": "Perfect for getting started",
                "description": "A 7-day beginner-friendly training plan.",
                "imageId": "456e7890-e12b-34d5-c678-526614174111",
                "durationInMinutes": 45,
                "level": "Beginner",
                "createdAt": "2025-11-25T12:00:00.000Z",
                "updatedAt": "2025-11-25T12:00:00.000Z"
            }
        ]
    }
}
```

---

### 2. **Get Static Training Plan by ID**
**GET** `/api/v1/plans/static-training-plans/:planId`

#### Description:
Retrieve the details of a specific static training plan by its ID. This endpoint is public and does not require authentication.

#### Example Request:
```http
GET /api/v1/plans/static-training-plans/123e4567-e89b-12d3-a456-426614174000 HTTP/1.1
Host: example.com
```

#### Example Response:
```json
{
    "status": "success",
    "data": {
        "staticTrainingPlan": {
            "id": "123e4567-e89b-12d3-a456-426614174000",
            "name": "Beginner Plan",
            "subTitle": "Perfect for getting started",
            "description": "A curated training block list (not a 7-day template).",
            "imageId": "456e7890-e12b-34d5-c678-526614174111",
            "durationInMinutes": 45,
            "level": "Beginner",
            "trainings": [
                {
                    "id": "training1",
                    "order": 1,
                    "type": "REGULAR",
                    "title": "Push-ups",
                    "description": "A basic push-up exercise.",
                    "sets": 3,
                    "repeats": 12,
                    "duration": null,
                    "config": null,
                    "trainingVideo": {
                        "id": "video1",
                        "title": "Push-ups",
                        "description": "A basic push-up exercise.",
                        "videoUrl": "https://example.com/videos/push-ups",
                        "tags": []
                    },
                    "items": []
                }
            ]
        }
    }
}
```

---

### 3. **Create Static Training Plan**
**POST** `/api/v1/plans/static-training-plans`

#### Description:
Create a new static training plan. This endpoint requires admin authentication.

#### Example Request:
```http
POST /api/v1/plans/static-training-plans HTTP/1.1
Host: example.com
Content-Type: application/json
Authorization: Bearer <admin-token>

{
    "name": "Advanced Plan",
    "subTitle": "For experienced athletes",
    "description": "A challenging curated training list for advanced users.",
    "imageId": "789e1234-e56b-78d9-f012-626614174222",
    "durationInMinutes": 60,
    "level": "Advanced",
    "trainings": [
        {
            "type": "REGULAR",
            "trainingVideoId": "video1",
            "sets": 4,
            "repeats": 10
        },
        {
            "type": "SUPERSET",
            "title": "Chest + Back",
            "sets": 3,
            "items": [
                { "trainingVideoId": "video2", "repeats": 10 },
                { "trainingVideoId": "video3", "repeats": 10 }
            ]
        },
        {
            "type": "DROPSET",
            "title": "Lateral Raise Dropset",
            "items": [
                { "trainingVideoId": "video4", "repeats": 12 },
                { "trainingVideoId": "video4", "repeats": 8 }
            ]
        },
        {
            "type": "CIRCUIT",
            "title": "Full body circuit",
            "config": { "rounds": 3 },
            "items": [
                { "trainingVideoId": "video5", "repeats": 15 },
                { "trainingVideoId": "video6", "repeats": 20 },
                { "trainingVideoId": "video7", "duration": 45 }
            ]
        }
    ]
}
```

#### Example Response:
```json
{
    "status": "success",
    "data": {
        "staticTrainingPlan": {
            "id": "789e1234-e56b-78d9-f012-626614174333",
            "name": "Advanced Plan",
            "subTitle": "For experienced athletes",
            "description": "A challenging 7-day training plan for advanced users.",
            "imageId": "789e1234-e56b-78d9-f012-626614174222",
            "durationInMinutes": 60,
            "level": "Advanced",
            "weeks": []
        }
    }
}
```

---

### 4. **Update Static Training Plan**
**PATCH** `/api/v1/plans/static-training-plans/:planId`

#### Description:
Update an existing static training plan. This endpoint requires admin authentication.

#### Example Request:
```http
PATCH /api/v1/plans/static-training-plans/789e1234-e56b-78d9-f012-626614174333 HTTP/1.1
Host: example.com
Content-Type: application/json
Authorization: Bearer <admin-token>

{
    "name": "Updated Advanced Plan",
    "subTitle": "Now with more intensity",
    "description": "An updated description for the advanced plan.",
    "durationInMinutes": 75,
    "level": "Expert"
}
```

#### Example Response:
```json
{
    "status": "success",
    "data": {
        "staticTrainingPlan": {
            "id": "789e1234-e56b-78d9-f012-626614174333",
            "name": "Updated Advanced Plan",
            "subTitle": "Now with more intensity",
            "description": "An updated description for the advanced plan.",
            "imageId": "789e1234-e56b-78d9-f012-626614174222",
            "durationInMinutes": 75,
            "level": "Expert",
            "weeks": []
        }
    }
}
```

---

### 5. **Delete Static Training Plan**
**DELETE** `/api/v1/plans/static-training-plans/:planId`

#### Description:
Delete a static training plan by its ID. This endpoint requires admin authentication.

#### Example Request:
```http
DELETE /api/v1/plans/static-training-plans/789e1234-e56b-78d9-f012-626614174333 HTTP/1.1
Host: example.com
Authorization: Bearer <admin-token>
```

#### Example Response:
```http
HTTP/1.1 204 No Content
```

---

## Notes
- **Authentication:** Admin-only endpoints require a valid Bearer token.
- **Validation:** All request bodies are validated against the schemas defined in `static-training-plan.validation.ts`.
- **Error Handling:** Errors are returned in the standard format with appropriate HTTP status codes.