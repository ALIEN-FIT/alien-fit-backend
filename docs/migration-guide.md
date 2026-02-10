# AlienFit Backend - Auth Flow Migration Guide

## Database Migration Steps

### Step 1: Backup Your Database
```bash
# PostgreSQL backup
pg_dump -U your_user alienfit > backup_$(date +%Y%m%d).sql

# Or use your database management tool
```

### Step 2: Run SQL Migrations

#### Add new columns to existing tables

```sql
-- Add freeDays to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS "freeDays" INTEGER DEFAULT 0 NOT NULL;

-- Add isFree and freeDays to subscriptions table
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS "isFree" BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS "freeDays" INTEGER DEFAULT 0;
```

#### Create new OTPs table

```sql
CREATE TABLE IF NOT EXISTS otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(15) NOT NULL,
    otp VARCHAR(6) NOT NULL,
    "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "isUsed" BOOLEAN DEFAULT FALSE,
    attempts INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_otps_phone ON otps(phone);
CREATE INDEX IF NOT EXISTS idx_otps_expiresAt ON otps("expiresAt");
```

#### Create new AdminSettings table

```sql
CREATE TABLE IF NOT EXISTS admin_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "settingKey" VARCHAR(255) UNIQUE NOT NULL,
    "settingValue" TEXT NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create unique index on settingKey
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_settings_key ON admin_settings("settingKey");
```

### Step 3: Set Default Settings

```sql
-- Set default free days (optional, defaults to 7 in code)
INSERT INTO admin_settings ("settingKey", "settingValue", "createdAt", "updatedAt")
VALUES ('DEFAULT_FREE_DAYS', '7', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("settingKey") DO NOTHING;
```

### Step 4: Update Environment Variables

Add these to your `.env` file:

```env
# SMS Providers
WHYSMS_API_KEY=your-whysms-api-key
WHYSMS_SENDER_ID=AlienFit
NOTIFIRE_DEVICE_ID=your-notifire-device-id

# Default subscription
DEFAULT_FREE_SUBSCRIPTION_DAYS=7
```

### Step 5: Install Dependencies (if needed)

```bash
npm install
# or
yarn install
```

### Step 6: Restart Your Application

```bash
npm run start:dev
# or
npm run build && npm start
```

## Verification Steps

### 1. Test OTP Sending
```bash
curl -X POST http://localhost:3000/api/v1/auth/otp/send \
  -H "Content-Type: application/json" \
  -d '{"phone": "+201234567890"}'
```

Expected response:
```json
{
  "status": "success",
  "message": "OTP sent successfully"
}
```

### 2. Check Database Tables
```sql
-- Verify OTPs table exists
SELECT * FROM otps LIMIT 1;

-- Verify admin_settings table exists
SELECT * FROM admin_settings;

-- Verify new columns in users
SELECT id, "freeDays" FROM users LIMIT 1;

-- Verify new columns in subscriptions
SELECT id, "isFree", "freeDays" FROM subscriptions LIMIT 1;
```

### 3. Test Complete Registration Flow
```bash
# 1. Send OTP
curl -X POST http://localhost:3000/api/v1/auth/otp/send \
  -H "Content-Type: application/json" \
  -d '{"phone": "+201234567890"}'

# 2. Register with OTP (use OTP from logs or SMS)
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
```

### 4. Verify Admin Endpoints (requires admin token)
```bash
# Get all settings
curl -X GET http://localhost:3000/api/v1/admin/settings \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Set default free days
curl -X POST http://localhost:3000/api/v1/admin/settings/free-days/default \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"days": 14}'
```

## Rollback Steps (if needed)

If you need to rollback:

```sql
-- Remove new columns
ALTER TABLE users DROP COLUMN IF EXISTS "freeDays";
ALTER TABLE subscriptions DROP COLUMN IF EXISTS "isFree";
ALTER TABLE subscriptions DROP COLUMN IF EXISTS "freeDays";

-- Drop new tables
DROP TABLE IF EXISTS otps;
DROP TABLE IF EXISTS admin_settings;

-- Restore from backup
psql -U your_user alienfit < backup_YYYYMMDD.sql
```

## Common Issues & Solutions

### Issue 1: OTP not sending
- **Solution**: Check SMS provider credentials in `.env`
- Verify `WHYSMS_API_KEY` and `NOTIFIRE_DEVICE_ID` are correct
- Check application logs for specific SMS errors

### Issue 2: "Column does not exist" errors
- **Solution**: Ensure all migrations ran successfully
- Check that column names match exactly (case-sensitive)
- Run migration SQL scripts again

### Issue 3: Rate limiting triggering too often
- **Solution**: Adjust rate limiter settings in `auth.routes.ts`
- Check Redis connection if rate limiter uses Redis

### Issue 4: Free subscription not created
- **Solution**: Check `DEFAULT_FREE_SUBSCRIPTION_DAYS` environment variable
- Verify subscription service is imported correctly in auth service
- Check database logs for constraint errors

## Performance Considerations

### OTP Table Cleanup
- The cron job runs daily at 3 AM to clean up old OTPs
- Removes OTPs older than 24 hours
- Monitor table size: `SELECT COUNT(*) FROM otps;`

### Indexes
All necessary indexes are created by the migration:
- `idx_otps_phone` - Fast lookup by phone number
- `idx_otps_expiresAt` - Efficient cleanup queries
- `idx_admin_settings_key` - Fast settings lookup

## Security Checklist

- [ ] SMS provider API keys are secure and not committed to git
- [ ] Rate limiting is active on all OTP endpoints
- [ ] OTP expiry is set to 10 minutes
- [ ] Maximum OTP attempts is set to 5
- [ ] Admin endpoints require admin role
- [ ] Production environment variables are different from development

## Support

For questions or issues during migration:
1. Check application logs: `tail -f logs/error.log`
2. Review this guide and the main documentation
3. Contact the development team

## Monitoring

After deployment, monitor:
- OTP send success rate
- Failed authentication attempts
- Database table sizes (especially `otps`)
- API response times for auth endpoints
- SMS provider costs and usage
