# Auth Flow & Subscription Management Implementation

## Overview
This implementation adds comprehensive OTP-based phone authentication, admin settings management, and enhanced subscription features with free trial support.

## Features Implemented

### 1. OTP-Based Phone Authentication
- Phone number-only authentication (primary method)
- SMS OTP sent via two providers:
  - **Egyptian numbers** (+20): WhySMS API
  - **International numbers**: Noti-Fire API
- OTP verification before user creation
- Rate limiting on OTP endpoints (5 requests per 15 minutes)
- OTP expiry (10 minutes)
- Maximum 5 verification attempts per OTP

### 2. New Auth Endpoints

#### Send OTP for Authentication
```http
POST /api/v1/auth/otp/send
Content-Type: application/json

{
  "phone": "+201234567890"
}
```

#### Login with OTP
```http
POST /api/v1/auth/otp/login
Content-Type: application/json

{
  "phone": "+201234567890",
  "otp": "123456"
}
```

#### Register with OTP
```http
POST /api/v1/auth/otp/register
Content-Type: application/json

{
  "phone": "+201234567890",
  "otp": "123456",
  "name": "John Doe",
  "height": 180,
  "weight": 75,
  "age": 25,
  "gender": "male"
}
```

#### Forgot Password (Send OTP)
```http
POST /api/v1/auth/forgot-password
Content-Type: application/json

{
  "phone": "+201234567890"
}
```

#### Reset Password with OTP
```http
POST /api/v1/auth/reset-password
Content-Type: application/json

{
  "phone": "+201234567890",
  "otp": "123456",
  "newPassword": "NewSecure@123"
}
```

### 3. Admin Settings Management

#### Set Default Free Days
```http
POST /api/v1/admin/settings/free-days/default
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "days": 7
}
```

#### Create and Set Default Training Plan
```http
POST /api/v1/admin/settings/training-plan/default
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "startDate": "2026-02-10",  // optional
  "days": [
    {
      "dayNumber": 1,  // optional, 1-7
      "items": [
        {
          "trainingVideoId": "video-uuid-1",
          "sets": 3,
          "repeats": 12,
          "itemType": "REGULAR"  // REGULAR, SUPERSET, DROPSET, CIRCUIT
        },
        {
          "trainingVideoId": "video-uuid-2",
          "sets": 3,
          "repeats": 10,
          "itemType": "SUPERSET",
          "supersetItems": [
            {
              "trainingVideoId": "video-uuid-3",
              "sets": 3,
              "repeats": 10
            }
          ],
          "extraVideos": [
            { "trainingVideoId": "video-uuid-4" }
          ]
        }
      ]
    }
    // ... 6 more days (total 7 days required)
  ]
}
```

#### Create and Set Default Diet Plan
```http
POST /api/v1/admin/settings/diet-plan/default
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "startDate": "2026-02-10",  // optional
  "recommendedWaterIntakeMl": 2000,  // optional
  "meals": [
    {
      "mealName": "Meal 1 (Light Iftar – Pre Workout)",
      "order": 1,
      "text": "160g cooked white rice\n1 medium banana\n1 scoop whey protein\n2 medium dates\n\nCalories: 600 kcal"
    },
    {
      "mealName": "Meal 2 (Post Workout)",
      "order": 2,
      "text": "200g grilled chicken breast\n250g cooked potatoes\nBig green salad\n1 tbsp olive oil\n\nCalories: 680 kcal"
    }
  ]
}
```

**Note**: These endpoints now create a new default plan from the provided template and automatically set it as the default. The plan is created with `userId: null` to indicate it's a default plan. The template includes 7 days which are repeated for 4 weeks (28 days total).

**Response**:
```json
{
  "status": "success",
  "message": "Default training plan created and set successfully",
  "data": {
    "planId": "newly-created-plan-uuid"
  }
}
```

#### Training Plan Item Types

- **REGULAR**: Standard exercise with sets and reps
- **SUPERSET**: Two or more exercises performed back-to-back
  - Requires `supersetItems` array
  - Optional `extraVideos` for reference
- **DROPSET**: Exercise with decreasing weight
  - Requires `dropsetConfig` with `dropPercents` array and optional `restSeconds`
- **CIRCUIT**: Exercise part of a circuit group
  - Requires `circuitGroup` string identifier

#### Set User Free Days
```http
POST /api/v1/admin/settings/user/free-days
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "userId": "user-uuid",
  "freeDays": 14
}
```

#### Get All Settings
```http
GET /api/v1/admin/settings
Authorization: Bearer <admin_token>
```

### 4. Enhanced Subscription Features

#### Free Subscription on Registration
- New users automatically get free subscription days (default: 7 days)
- Configurable via admin settings or environment variable
- Free customers receive default training/diet plans

#### GET /me Response Updates
```json
{
  "status": "success",
  "data": {
    "user": { ... },
    "isSubscribed": true,
    "subscriptionType": "free",  // or "paid"
    "subscriptionWarning": false, // true if < 3 days remaining
    "subscriptionStatus": {
      "isSubscribed": true,
      "profileUpdateRequired": false,
      "subscription": {
        "id": "...",
        "isFree": true,
        "freeDays": 7,
        "startDate": "2026-02-09",
        "endDate": "2026-02-16"
      }
    },
    "profile": { ... }
  }
}
```

### 5. Database Schema Updates

#### User Entity
- Added `freeDays` field (integer, default: 0)

#### Subscription Entity
- Added `isFree` field (boolean, default: false)
- Added `freeDays` field (integer, default: 0)

#### Training Plan & Diet Plan Entities
- Modified `userId` field to be nullable (allows default plans with `userId: null`)
- Removed unique constraint on `userId` (multiple plans can have `userId: null`)

#### New OTP Entity
```sql
CREATE TABLE otps (
  id UUID PRIMARY KEY,
  phone VARCHAR(15) NOT NULL,
  otp VARCHAR(6) NOT NULL,
  expiresAt TIMESTAMP NOT NULL,
  isUsed BOOLEAN DEFAULT FALSE,
  attempts INTEGER DEFAULT 0,
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
);
```

#### New AdminSettings Entity
```sql
CREATE TABLE admin_settings (
  id UUID PRIMARY KEY,
  settingKey VARCHAR(255) UNIQUE NOT NULL,
  settingValue TEXT NOT NULL,
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
);
```

### 6. Environment Variables

Add to your `.env` file:

```env
# SMS Provider - WhySMS (Egyptian numbers)
WHYSMS_API_KEY=49|LNFe8WJ7CPtvl2mzowAB4ll4enbFR0XGgnQh2qWY
WHYSMS_SENDER_ID=AlienFit

# SMS Provider - Noti-Fire (International numbers)
NOTIFIRE_DEVICE_ID=test-123-456-789

# Default free subscription days for new users
DEFAULT_FREE_SUBSCRIPTION_DAYS=7
```

## Security Features

### Rate Limiting
- OTP send endpoints: 5 requests per 15 minutes
- OTP verification endpoints: 10 requests per 15 minutes
- Auth endpoints: 10 requests per 15 minutes

### OTP Security
- 6-digit numeric OTP
- 10-minute expiry
- Maximum 5 verification attempts
- One-time use (invalidated after successful verification)
- Previous OTPs invalidated when new one is requested

### Authorization
- Admin-only endpoints require `Roles.ADMIN`
- Protected routes use JWT authentication
- Phone number validation on all endpoints

## Free Subscription Flow

1. **User Registration**:
   - User requests OTP → OTP sent to phone
   - User verifies OTP with registration data
   - System creates user account
   - System automatically creates free subscription (7 days default)

2. **Plan Access for Free Users**:
   - When free user fetches training/diet plan:
     - If default plan is configured → Returns default plan
     - If no default plan → Returns 404 (user needs custom plan)

3. **Subscription Warning**:
   - `subscriptionWarning: true` when < 3 days remaining
   - Frontend can show upgrade prompts

4. **Subscription Type**:
   - `free`: User has free subscription
   - `paid`: User has paid subscription

## Migration Notes

### Running Migrations
After pulling these changes, you'll need to:

1. Add new environment variables to `.env`
2. Run database migrations (or manually add columns):
   ```sql
   -- User table
   ALTER TABLE users ADD COLUMN freeDays INTEGER DEFAULT 0;
   
   -- Subscription table
   ALTER TABLE subscriptions ADD COLUMN isFree BOOLEAN DEFAULT FALSE;
   ALTER TABLE subscriptions ADD COLUMN freeDays INTEGER DEFAULT 0;
   
   -- Training Plan table
   ALTER TABLE training_plans ALTER COLUMN userId DROP NOT NULL;
   ALTER TABLE training_plans DROP CONSTRAINT IF EXISTS training_plans_userId_key;
   
   -- Diet Plan table
   ALTER TABLE diet_plans ALTER COLUMN userId DROP NOT NULL;
   ALTER TABLE diet_plans DROP CONSTRAINT IF EXISTS diet_plans_userId_key;
   ```

3. Create new tables:
   - `otps` table (see schema above)
   - `admin_settings` table (see schema above)

## Testing

### Test OTP Flow
1. Send OTP to test phone number
2. Check logs for OTP code (in development)
3. Verify OTP and complete registration
4. Check that free subscription is created

### Test Admin Settings
1. Login as admin
2. Create and set default training plan with full DTO
3. Create and set default diet plan with full DTO
4. Set default free days
5. Verify new users get correct free days
6. Verify free users get the newly created default plans
7. Test that default plans have `userId: null`

## Backward Compatibility

- Legacy email/password authentication still works
- Existing users are not affected
- Google OAuth remains functional
- All existing endpoints remain unchanged

## Future Enhancements

- SMS provider failover/fallback
- OTP via email as alternative
- Custom free day periods per user type
- Subscription upgrade flows
- Payment integration for paid subscriptions

## Files Created/Modified

### New Files
- `src/services/sms/sms.service.ts` - SMS provider integration
- `src/modules/otp/v1/` - OTP module (entity, service, controller, routes, validation)
- `src/modules/admin-settings/v1/` - Admin settings module
- Auth flow updates in `src/modules/auth/v1/`
- Subscription enhancements in `src/modules/subscription/v1/`
- Plan service updates in `src/modules/plans/*/v1/`

### Modified Files
- `src/config/env.ts` - Added SMS and subscription configs
- `src/app.ts` - Added new routes
- User entity - Added freeDays field
- Subscription entity - Added isFree and freeDays fields
- Training/Diet plan entities - Changed userId to nullable for default plans
- Training/Diet plan repositories - Added createDefaultPlan methods
- Admin settings service - Added createAndSetDefaultTrainingPlan and createAndSetDefaultDietPlan methods
- Admin settings validation - Added comprehensive plan DTO validation schemas

## Support

For issues or questions, please contact the development team.
