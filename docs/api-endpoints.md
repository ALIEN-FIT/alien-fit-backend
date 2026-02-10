# API Endpoints Summary - Auth Flow Update

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
