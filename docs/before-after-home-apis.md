# Before After Home APIs

This document covers the new `before-after-home` module, including admin CRUD APIs, the public active list API, request body examples, and the expected user flow.

## Overview

- Base route: `/api/v1/before-after-home`
- Public users get only active records.
- Public and admin lists are sorted by `priority DESC`, then `createdAt DESC`.
- Admin creates and updates records by referencing uploaded media IDs for the before and after images.

## Required Media Upload Step

Before creating or updating a before/after item, upload the images first:

```http
POST /api/v1/media/upload
Content-Type: multipart/form-data
```

Form field:

- `media`: one or more image files

Example response:

```json
[
  {
    "id": "7d30fdde-65d3-4403-bc4c-111111111111",
    "url": "https://cdn.example.com/media/before-image.webp",
    "mediaType": "image"
  },
  {
    "id": "9baf50a7-e56d-4948-aaf1-222222222222",
    "url": "https://cdn.example.com/media/after-image.webp",
    "mediaType": "image"
  }
]
```

Use those returned IDs as `beforeImageId` and `afterImageId`.

## Public API

### Get Active Before/After Items

```http
GET /api/v1/before-after-home
```

Description:
- Public endpoint.
- Returns only records where `isActive = true`.
- Sorted by priority descending, then newest first.

Example response:

```json
{
  "status": "success",
  "data": {
    "beforeAfterHomes": [
      {
        "id": "8657d3f5-5428-4af0-9e83-333333333333",
        "beforeImageId": "7d30fdde-65d3-4403-bc4c-111111111111",
        "beforeImage": {
          "id": "7d30fdde-65d3-4403-bc4c-111111111111",
          "url": "https://cdn.example.com/media/before-image.webp",
          "originalName": "before.jpg",
          "contentType": "image/webp",
          "mediaType": "image",
          "size": 135000,
          "thumbnails": null,
          "metadata": null,
          "createdAt": "2026-04-15T09:30:00.000Z",
          "updatedAt": "2026-04-15T09:30:00.000Z"
        },
        "afterImageId": "9baf50a7-e56d-4948-aaf1-222222222222",
        "afterImage": {
          "id": "9baf50a7-e56d-4948-aaf1-222222222222",
          "url": "https://cdn.example.com/media/after-image.webp",
          "originalName": "after.jpg",
          "contentType": "image/webp",
          "mediaType": "image",
          "size": 146000,
          "thumbnails": null,
          "metadata": null,
          "createdAt": "2026-04-15T09:31:00.000Z",
          "updatedAt": "2026-04-15T09:31:00.000Z"
        },
        "title": "12-week fat loss",
        "description": "Client followed nutrition and training plan consistently.",
        "priority": 10,
        "isActive": true,
        "transformationTimeInDays": 84,
        "createdAt": "2026-04-15T09:40:00.000Z",
        "updatedAt": "2026-04-15T09:40:00.000Z"
      }
    ]
  }
}
```

## Admin APIs

All admin endpoints require:

```http
Authorization: Bearer <admin-token>
```

### List All Before/After Items

```http
GET /api/v1/before-after-home/admin/all
```

Description:
- Returns active and inactive records.
- Sorted by `isActive DESC`, then `priority DESC`, then `createdAt DESC`.

### Get One Before/After Item

```http
GET /api/v1/before-after-home/admin/:beforeAfterHomeId
```

Example:

```http
GET /api/v1/before-after-home/admin/8657d3f5-5428-4af0-9e83-333333333333
Authorization: Bearer <admin-token>
```

### Create Before/After Item

```http
POST /api/v1/before-after-home/admin
Content-Type: application/json
Authorization: Bearer <admin-token>
```

Request body example:

```json
{
  "beforeImageId": "7d30fdde-65d3-4403-bc4c-111111111111",
  "afterImageId": "9baf50a7-e56d-4948-aaf1-222222222222",
  "title": "8-week transformation",
  "description": "Lost 6 kg and improved conditioning.",
  "priority": 5,
  "isActive": true,
  "transformationTimeInDays": 56
}
```

Notes:
- `title` is optional.
- `description` is optional.
- `priority` defaults to `0`.
- `isActive` defaults to `true`.
- `transformationTimeInDays` is required and must be at least `1`.
- `beforeImageId` and `afterImageId` must point to uploaded image media.

Example response:

```json
{
  "status": "success",
  "data": {
    "beforeAfterHome": {
      "id": "8657d3f5-5428-4af0-9e83-333333333333",
      "beforeImageId": "7d30fdde-65d3-4403-bc4c-111111111111",
      "beforeImage": {
        "id": "7d30fdde-65d3-4403-bc4c-111111111111",
        "url": "https://cdn.example.com/media/before-image.webp",
        "originalName": "before.jpg",
        "contentType": "image/webp",
        "mediaType": "image",
        "size": 135000,
        "thumbnails": null,
        "metadata": null,
        "createdAt": "2026-04-15T09:30:00.000Z",
        "updatedAt": "2026-04-15T09:30:00.000Z"
      },
      "afterImageId": "9baf50a7-e56d-4948-aaf1-222222222222",
      "afterImage": {
        "id": "9baf50a7-e56d-4948-aaf1-222222222222",
        "url": "https://cdn.example.com/media/after-image.webp",
        "originalName": "after.jpg",
        "contentType": "image/webp",
        "mediaType": "image",
        "size": 146000,
        "thumbnails": null,
        "metadata": null,
        "createdAt": "2026-04-15T09:31:00.000Z",
        "updatedAt": "2026-04-15T09:31:00.000Z"
      },
      "title": "8-week transformation",
      "description": "Lost 6 kg and improved conditioning.",
      "priority": 5,
      "isActive": true,
      "transformationTimeInDays": 56,
      "createdAt": "2026-04-15T09:40:00.000Z",
      "updatedAt": "2026-04-15T09:40:00.000Z"
    }
  }
}
```

### Update Before/After Item

```http
PATCH /api/v1/before-after-home/admin/:beforeAfterHomeId
Content-Type: application/json
Authorization: Bearer <admin-token>
```

Request body example:

```json
{
  "title": "Updated transformation title",
  "description": "Updated description",
  "priority": 8,
  "isActive": false,
  "transformationTimeInDays": 60
}
```

You can also replace images:

```json
{
  "beforeImageId": "aaaaaaaa-1111-2222-3333-bbbbbbbbbbbb",
  "afterImageId": "cccccccc-4444-5555-6666-dddddddddddd"
}
```

### Delete Before/After Item

```http
DELETE /api/v1/before-after-home/admin/:beforeAfterHomeId
Authorization: Bearer <admin-token>
```

Response:

```http
HTTP/1.1 204 No Content
```

## Validation Summary

- `beforeAfterHomeId`: UUID
- `beforeImageId`: UUID, required on create
- `afterImageId`: UUID, required on create
- `title`: optional string, max 255
- `description`: optional string, max 2000
- `priority`: integer, minimum 0
- `isActive`: boolean
- `transformationTimeInDays`: integer, minimum 1

## User Flow

### Admin Flow

1. Admin uploads the before and after images through `POST /api/v1/media/upload`.
2. Admin copies the returned media IDs.
3. Admin creates a new item through `POST /api/v1/before-after-home/admin`.
4. Admin can review all entries through `GET /api/v1/before-after-home/admin/all`.
5. Admin can update title, description, images, priority, active status, or transformation days through `PATCH /api/v1/before-after-home/admin/:beforeAfterHomeId`.
6. Admin can delete an item through `DELETE /api/v1/before-after-home/admin/:beforeAfterHomeId`.

### App User Flow

1. App user opens the home screen section that needs before/after transformations.
2. Frontend calls `GET /api/v1/before-after-home`.
3. Backend returns only active items, already sorted for display.
4. Frontend renders the before image, after image, title, description, and transformation duration.

## Error Cases

Common failures:

- `400`: before or after media ID does not exist, or the media is not an image.
- `401`: missing or invalid token on admin endpoints.
- `403`: authenticated user is not an admin.
- `404`: requested before/after item does not exist.
- `422`: invalid UUID or invalid request body.
