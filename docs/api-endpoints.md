# API Endpoints Summary - Auth Flow Update

## Latest Endpoints Update (March 2026)

All endpoints below are already mounted in the current backend.

### Subscription Freeze Request Flow

User creates freeze request (one pending request allowed at a time):

```
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

Admin lists pending freeze requests:

```
GET /api/v1/subscription/freeze/requests/pending
Authorization: Bearer <admin-token>
```

Admin approves request (optional override days; `null` = use user requested days):

```
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

Admin declines request:

```
POST /api/v1/subscription/freeze/requests/:requestId/decline
Authorization: Bearer <admin-token>
```

Request body:

```json
{
  "note": "Optional decline reason"
}
```

### Subscription Defrost Request Flow

User creates defrost request (subscription must already be frozen):

```
POST /api/v1/subscription/defrost
Authorization: Bearer <user-token>
```

Request body:

```json
{
  "note": "Optional user note"
}
```

Admin lists pending defrost requests:

```
GET /api/v1/subscription/defrost/requests/pending
Authorization: Bearer <admin-token>
```

Admin approves request:

```
POST /api/v1/subscription/defrost/requests/:requestId/approve
Authorization: Bearer <admin-token>
```

Request body:

```json
{
  "note": "Optional admin note"
}
```

Admin declines request:

```
POST /api/v1/subscription/defrost/requests/:requestId/decline
Authorization: Bearer <admin-token>
```

Request body:

```json
{
  "note": "Optional decline reason"
}
```

Admin override defrost (optional):

```
POST /api/v1/subscription/defrost/:userId
Authorization: Bearer <admin-token>
```

Behavior:
- User cannot defrost directly; admin approval is required.
- Auto-defrost still runs once the freeze period ends.

### Training Video Admin: Replace Video Everywhere

Replace a video reference across training plans and static plans, then optionally delete old video.

```
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
- `videoId` and `replacementVideoId` must be different.
- If `deleteOld=true`, old video is deleted after replacing references.

### Training Plan Admin: Adjust Day/Item

Update one full day in a training plan (user plan or default plan by `planId`).

```
PATCH /api/v1/plans/training/admin/:planId/day/:dayIndex
Authorization: Bearer <admin-token>
```

Request body (name only):

```json
{
  "name": "Upper Body - Heavy"
}
```

Request body (replace full day items):

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

Clear (delete all items from) a training day:

```
DELETE /api/v1/plans/training/admin/:planId/day/:dayIndex
Authorization: Bearer <admin-token>
```

Update one training item only:

```
PATCH /api/v1/plans/training/admin/item/:itemId
Authorization: Bearer <admin-token>
```

Request body:

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

Delete one training item:

```
DELETE /api/v1/plans/training/admin/item/:itemId
Authorization: Bearer <admin-token>
```

### Diet Plan Admin: Adjust Day/Meal

Update one full day in a diet plan (user plan or default plan by `planId`).

```
PATCH /api/v1/plans/diet/admin/:planId/day/:dayIndex
Authorization: Bearer <admin-token>
```

Request body:

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

Clear (delete all meals/snacks from) a diet day:

```
DELETE /api/v1/plans/diet/admin/:planId/day/:dayIndex
Authorization: Bearer <admin-token>
```

Update one meal/snack item:

```
PATCH /api/v1/plans/diet/admin/meal/:mealItemId
Authorization: Bearer <admin-token>
```

Request body:

```json
{
  "mealName": "Snack 2",
  "order": 4,
  "text": "Protein shake + banana",
  "itemType": "SNACK"
}
```

Delete one meal/snack item:

```
DELETE /api/v1/plans/diet/admin/meal/:mealItemId
Authorization: Bearer <admin-token>
```

### Tracking Update: Record Actual Sets with Weights

The `/tracking/training/mark-done` endpoint now requires you to report each completed set with its repeats and weight so the ingestion model can render the same detail on training-plan endpoints.

```
POST /api/v1/tracking/training/mark-done
Authorization: Bearer <token>
```

Request body:

```json
{
  "planItemId": "5f392f9b-60df-4066-97b7-b19a9d2b8268",
  "date": "2026-03-09",
  "note": "Back day feel",
  "stes": [
    { "repeats": 12, "weight": 20 },
    { "repeats": 12, "weight": 20 },
    { "repeats": 12, "weight": 20 }
  ]
}
```

Response now includes the same structured completion model: `trainingCompletionRecords` returns objects shaped as
`{ planItemId, date, note?, stes: [{ repeats, weight }] }`.

### User Profile Update: InBody Image Support

Existing profile update endpoints now support `inbodyImage`:

```
POST /api/v1/user-profile/me
POST /api/v1/user-profile/:userId   (admin)
Authorization: Bearer <token>
```

Request body example:

```json
{
  "bodyImages": ["0f31ad57-9d53-4f20-a855-534a1f6ea9df"],
  "inbodyImage": "2c7f2b4c-733e-42fe-bb63-2a8f3fef58a6"
}
```

### Notification Behavior Update (No New Public Endpoint)

Reminder worker now sends:
- `TRAINING_REMINDER`: `You haven't trained today. Let's get your workout done!`
- `BODY_IMAGE_REMINDER`: weekly progress update reminder.
- `INBODY_REMINDER`: every 2 weeks reminder.

### Migration Required

Before testing these updates, run migrations:

```bash
npm run migration:up
```

New migration file:
- `src/database/migrations/20260309120000-add-profile-and-tracking-reminder-fields.cjs`
- `src/database/migrations/20260312123000-create-subscription-defrost-requests.cjs`

## Authentication Endpoints

### OTP-Based Authentication (New - Primary Method)

#### Send OTP for Authentication
```
POST /api/v1/auth/otp/send
Rate Limit: 5 requests per 15 minutes
```
**Request Body:**
```json
{
  "phone": "+201234567890"  // Required: 10-15 digits
}
```
**Response:**
```json
{
  "status": "success",
  "message": "OTP sent successfully"
}
```

#### Login with OTP
```
POST /api/v1/auth/otp/login
Rate Limit: 10 requests per 15 minutes
```
**Request Body:**
```json
{
  "phone": "+201234567890",  // Required: 10-15 digits
  "otp": "123456"            // Required: 6 digits
}
```
**Response:**
```json
{
  "status": "success",
  "data": {
    "user": { /* user object */ },
    "accessToken": {
      "token": "jwt-token",
      "expiresAt": "2026-02-09T15:00:00.000Z"
    },
    "refreshToken": "refresh-token"
  }
}
```

#### Register with OTP
```
POST /api/v1/auth/otp/register
Rate Limit: 10 requests per 15 minutes
```
**Request Body:**
```json
{
  "phone": "+201234567890",  // Required: 10-15 digits
  "otp": "123456",           // Required: 6 digits
  "name": "John Doe",        // Required: 5-30 characters
  "height": 180,             // Optional: 50-300 cm
  "weight": 75,              // Optional: 20-500 kg
  "age": 25,                 // Optional: integer
  "gender": "male"           // Optional: male/female
}
```
**Response:**
```json
{
  "status": "success",
  "data": {
    "user": { /* user object with free subscription */ },
    "accessToken": {
      "token": "jwt-token",
      "expiresAt": "2026-02-09T15:00:00.000Z"
    },
    "refreshToken": "refresh-token"
  }
}
```

### Password Reset Flow (New)

#### Forgot Password - Send OTP
```
POST /api/v1/auth/forgot-password
Rate Limit: 5 requests per 15 minutes
```
**Request Body:**
```json
{
  "phone": "+201234567890"
}
```
**Response:**
```json
{
  "status": "success",
  "message": "OTP sent to your phone"
}
```

#### Reset Password with OTP
```
POST /api/v1/auth/reset-password
Rate Limit: 10 requests per 15 minutes
```
**Request Body:**
```json
{
  "phone": "+201234567890",
  "otp": "123456",
  "newPassword": "NewSecure@123"  // Min 8 chars, must include upper, lower, number, special
}
```
**Response:**
```json
{
  "status": "success",
  "message": "Password reset successfully"
}
```

### Legacy Authentication (Backward Compatible)

#### Login (Email/Phone + Password)
```
POST /api/v1/auth/login
```
**Request Body:**
```json
{
  "provider": "user@example.com",  // Email or phone
  "password": "password123"
}
```

#### Register (Email/Phone + Password)
```
POST /api/v1/auth/register
```
**Request Body:**
```json
{
  "provider": "user@example.com",
  "password": "password123",
  "name": "John Doe",
  "height": 180,
  "weight": 75,
  "age": 25,
  "gender": "male"
}
```

### Other Auth Endpoints

#### Get Current User (Updated)
```
GET /api/v1/auth/me
Authorization: Bearer <token>
```
**Response:**
```json
{
  "status": "success",
  "data": {
    "user": { /* user object */ },
    "isSubscribed": true,
    "subscriptionType": "free",        // or "paid"
    "subscriptionWarning": false,      // true if < 3 days remaining
    "profileUpdateRequired": false,
    "subscriptionStatus": {
      "isSubscribed": true,
      "subscription": {
        "id": "uuid",
        "isFree": true,
        "freeDays": 7,
        "startDate": "2026-02-09",
        "endDate": "2026-02-16",
        "isActive": true
      }
    },
    "profile": { /* profile object or null */ }
  }
}
```

#### Refresh Token
```
POST /api/v1/auth/refresh-token
```
**Request Body:**
```json
{
  "refreshToken": "refresh-token-string"
}
```

#### Logout
```
POST /api/v1/auth/logout
```
**Request Body:**
```json
{
  "refreshToken": "refresh-token-string"
}
```

#### Change Password
```
PATCH /api/v1/auth/password
Authorization: Bearer <token>
```
**Request Body:**
```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword123"
}
```

---

## Admin Settings Endpoints (New)

All admin endpoints require authentication and `ADMIN` role.

### Set Default Free Days
```
POST /api/v1/admin/settings/free-days/default
Authorization: Bearer <admin-token>
```
**Request Body:**
```json
{
  "days": 7  // Integer: 0-365
}
```
**Response:**
```json
{
  "status": "success",
  "message": "Default free days updated successfully"
}
```

### Set Default Training Plan
```
POST /api/v1/admin/settings/training-plan/default
Authorization: Bearer <admin-token>
```
**Request Body:**
```json
{
  "planId": "uuid-of-training-plan"
}
```
**Response:**
```json
{
  "status": "success",
  "message": "Default training plan updated successfully"
}
```

### Set Default Diet Plan
```
POST /api/v1/admin/settings/diet-plan/default
Authorization: Bearer <admin-token>
```
**Request Body:**
```json
{
  "planId": "uuid-of-diet-plan"
}
```
**Response:**
```json
{
  "status": "success",
  "message": "Default diet plan updated successfully"
}
```

### Set User Free Days
```
POST /api/v1/admin/settings/user/free-days
Authorization: Bearer <admin-token>
```
**Request Body:**
```json
{
  "userId": "user-uuid",
  "freeDays": 14  // Integer: 0-365
}
```
**Response:**
```json
{
  "status": "success",
  "message": "User free days updated successfully"
}
```

### Get All Settings
```
GET /api/v1/admin/settings
Authorization: Bearer <admin-token>
```
**Response:**
```json
{
  "status": "success",
  "data": {
    "settings": {
      "DEFAULT_FREE_DAYS": "7",
      "DEFAULT_TRAINING_PLAN_ID": "uuid",
      "DEFAULT_DIET_PLAN_ID": "uuid"
    }
  }
}
```

---

## OTP Utility Endpoints (New)

These are separate from auth endpoints for flexibility.

### Send OTP
```
POST /api/v1/otp/send
Rate Limit: 5 requests per 15 minutes
```
**Request Body:**
```json
{
  "phone": "+201234567890"
}
```

### Verify OTP
```
POST /api/v1/otp/verify
Rate Limit: 10 requests per 15 minutes
```
**Request Body:**
```json
{
  "phone": "+201234567890",
  "otp": "123456"
}
```
**Response:**
```json
{
  "status": "success",
  "data": {
    "isValid": true
  }
}
```

---

## Plan Endpoints (Updated Behavior)

### Get Training Plan
```
GET /api/v1/plans/training/{userId}
Authorization: Bearer <token>
```
**Behavior:**
- If user has free subscription → Returns default training plan (if configured)
- If user has paid subscription → Returns custom training plan
- Admin can view any user's plan
- `GET /plans/training/me` behaves the same way for the requesting user.
- Each returned exercise item now includes `excerciceMetadata` when completed. The metadata mirrors `trainingCompletionRecords` and exposes `{ planItemId, date, note?, stes: [{ repeats, weight }] }` so clients can render the exact sets saved via `/tracking/training/mark-done`.

### Get Diet Plan
```
GET /api/v1/plans/diet/{userId}
Authorization: Bearer <token>
```
**Behavior:**
- If user has free subscription → Returns default diet plan (if configured)
- If user has paid subscription → Returns custom diet plan
- Admin can view any user's plan

---

## Error Responses

All endpoints follow consistent error format:

```json
{
  "status": "error",
  "message": "Error description",
  "statusCode": 400
}
```

### Common Error Codes:
- `400` - Bad Request (invalid data)
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (user already exists)
- `422` - Unprocessable Entity (validation errors)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

### Specific Error Messages:

**OTP Errors:**
- "Invalid phone number format"
- "Please wait before requesting a new OTP"
- "Invalid OTP"
- "OTP has expired"
- "Maximum OTP attempts exceeded"

**Auth Errors:**
- "Invalid credentials"
- "Account is blocked"
- "User not found. Please complete registration with name and other details."
- "User with this phone number already exists"

**Admin Errors:**
- "Only admins can set default free days"
- "You do not have permission to perform this action"

---

## Rate Limiting Summary

| Endpoint Pattern | Limit | Window |
|-----------------|-------|--------|
| `/api/v1/auth/otp/send` | 5 requests | 15 minutes |
| `/api/v1/auth/forgot-password` | 5 requests | 15 minutes |
| `/api/v1/otp/send` | 5 requests | 15 minutes |
| `/api/v1/auth/otp/login` | 10 requests | 15 minutes |
| `/api/v1/auth/otp/register` | 10 requests | 15 minutes |
| `/api/v1/auth/reset-password` | 10 requests | 15 minutes |
| `/api/v1/otp/verify` | 10 requests | 15 minutes |

---

## Authentication Flow Examples

### New User Registration Flow
1. User enters phone number
2. Frontend calls `POST /api/v1/auth/otp/send`
3. User receives OTP via SMS
4. User enters OTP + profile details
5. Frontend calls `POST /api/v1/auth/otp/register`
6. User is created with free subscription
7. User receives access token and refresh token

### Existing User Login Flow
1. User enters phone number
2. Frontend calls `POST /api/v1/auth/otp/send`
3. User receives OTP via SMS
4. User enters OTP
5. Frontend calls `POST /api/v1/auth/otp/login`
6. User receives access token and refresh token

### Password Reset Flow
1. User enters phone number
2. Frontend calls `POST /api/v1/auth/forgot-password`
3. User receives OTP via SMS
4. User enters OTP + new password
5. Frontend calls `POST /api/v1/auth/reset-password`
6. Password is updated

---

## Testing with Postman/cURL

### Example: Complete Registration
```bash
# Step 1: Send OTP
curl -X POST http://localhost:3000/api/v1/auth/otp/send \
  -H "Content-Type: application/json" \
  -d '{"phone": "+201234567890"}'

# Step 2: Register (use OTP from logs or SMS)
curl -X POST http://localhost:3000/api/v1/auth/otp/register \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+201234567890",
    "otp": "123456",
    "name": "Test User",
    "height": 180,
    "weight": 75,
    "age": 25,
    "gender": "male"
  }'

# Step 3: Get User Info
curl -X GET http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer <token-from-step-2>"
```

### Example: Admin Set Defaults
```bash
# Set default free days
curl -X POST http://localhost:3000/api/v1/admin/settings/free-days/default \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"days": 14}'

# Get all settings
curl -X GET http://localhost:3000/api/v1/admin/settings \
  -H "Authorization: Bearer <admin-token>"
```
