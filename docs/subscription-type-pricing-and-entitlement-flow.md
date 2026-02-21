# Subscription Type Pricing and Entitlement Flow

This document describes the new subscription model where each package can include one or more plan types (`diet`, `training`, `both`) and each selected type has its own prices per active currency.

It also documents:
- updated request/response contracts,
- entitlement enforcement for plan assignment,
- cleaned subscription payload shape in `getMe` and profile endpoints,
- end-to-end user flow.

---

## 1) What Changed

### A) Package pricing model

Before:
- `prices` was a flat currency map (example: `{ "USD": 10, "EGP": 400 }`).

Now:
- package has `planTypes` (1 to 3 values from `diet | training | both`),
- `prices` is nested by type then currency.

Example:

```json
{
  "planTypes": ["diet", "both"],
  "prices": {
    "diet": {
      "USD": 9.99,
      "EGP": 450
    },
    "both": {
      "USD": 14.99,
      "EGP": 700
    }
  }
}
```

Validation rules:
- `planTypes` must contain at least 1 and at most 3 unique values,
- each selected type must have a price block,
- each selected type price block must include all active currencies,
- prices for unselected types are rejected.

### B) Checkout model

Before:
- checkout required `packageId` + `currency`.

Now:
- checkout requires `packageId` + `planType` + `currency`.
- the selected `planType` is stored on payment and used as entitlement when payment succeeds.

### C) Subscription entitlement model

- `planType` is now persisted on subscription.
- `SubscriptionService.getStatus` now returns normalized entitlement fields:
  - `isSubscribed`
  - `isFreeTier`
  - `planType`
  - `capabilities` (`canAccessDiet`, `canAccessTraining`)
  - `profileUpdateRequired`

Free tier behavior:
- free tier is treated as full access entitlement (`planType: both`) and can use both default diet and training plans.

### D) Plan assignment restrictions

Admin assignment now enforces entitlement:
- user with diet-only entitlement: admin can set/retrieve diet plan only,
- user with training-only entitlement: admin can set/retrieve training plan only,
- user with both entitlement: admin can set/retrieve both,
- free tier: both are accessible via default configured plans.

### E) Response cleanup

`getMe`, `user profile`, and admin user details now return a single normalized `subscription` object and remove duplicated/redundant subscription fields.

---

## 2) Endpoints and Example Bodies

## 2.1 Admin: Create package

**POST** `/api/v1/subscription-packages`

Example body:

```json
{
  "name": "Monthly Pro",
  "description": "Custom plans based on selected type",
  "planTypes": ["diet", "training", "both"],
  "prices": {
    "diet": {
      "USD": 8.99,
      "EGP": 400
    },
    "training": {
      "USD": 8.99,
      "EGP": 400
    },
    "both": {
      "USD": 14.99,
      "EGP": 700
    }
  },
  "features": ["4-week plan", "profile-based tuning"],
  "cycles": 1,
  "isActive": true
}
```

Success shape (important fields):

```json
{
  "status": "success",
  "data": {
    "package": {
      "id": "...",
      "name": "Monthly Pro",
      "planTypes": ["diet", "training", "both"],
      "prices": {
        "diet": { "USD": 8.99, "EGP": 400 },
        "training": { "USD": 8.99, "EGP": 400 },
        "both": { "USD": 14.99, "EGP": 700 }
      },
      "cycles": 1,
      "isActive": true
    }
  }
}
```

## 2.2 Admin: Update package

**PATCH** `/api/v1/subscription-packages/:packageId`

Example body (only diet + both package):

```json
{
  "planTypes": ["diet", "both"],
  "prices": {
    "diet": {
      "USD": 9.99,
      "EGP": 450
    },
    "both": {
      "USD": 16.99,
      "EGP": 800
    }
  }
}
```

## 2.3 User: Create checkout session

**POST** `/api/v1/subscription/checkout`

Example body:

```json
{
  "packageId": "a1f1d510-9e7c-4f34-9f1c-ca4fcb7dcd2c",
  "planType": "training",
  "currency": "USD",
  "redirectionUrls": {
    "successUrl": "https://app.example.com/payment/success",
    "failUrl": "https://app.example.com/payment/fail",
    "pendingUrl": "https://app.example.com/payment/pending"
  }
}
```

Success shape (important fields):

```json
{
  "status": "success",
  "data": {
    "payment": {
      "id": "...",
      "status": "pending",
      "planType": "training",
      "currency": "USD",
      "amount": 8.99,
      "invoiceId": 123456,
      "invoiceKey": "...",
      "paymentUrl": "https://..."
    }
  }
}
```

## 2.4 User/Admin: Get subscription status

**GET** `/api/v1/subscription/status`

Response shape:

```json
{
  "status": "success",
  "data": {
    "isSubscribed": true,
    "isFreeTier": false,
    "planType": "training",
    "capabilities": {
      "canAccessDiet": false,
      "canAccessTraining": true
    },
    "profileUpdateRequired": false,
    "subscription": {
      "id": "...",
      "startDate": "2026-02-18T00:00:00.000Z",
      "endDate": "2026-03-20T00:00:00.000Z"
    }
  }
}
```

## 2.5 Admin: Assign plans (enforced by entitlement)

### Diet plan assignment
**POST** `/api/v1/plans/diet/week/:userId`

Example body:

```json
{
  "startDate": "2026-02-18T00:00:00.000Z",
  "recommendedWaterIntakeMl": 3000,
  "days": [
    { "dayNumber": 1, "meals": [] },
    { "dayNumber": 2, "meals": [] },
    { "dayNumber": 3, "meals": [] },
    { "dayNumber": 4, "meals": [] },
    { "dayNumber": 5, "meals": [] },
    { "dayNumber": 6, "meals": [] },
    { "dayNumber": 7, "meals": [] }
  ]
}
```

### Training plan assignment
**POST** `/api/v1/plans/training/week/:userId`

Example body:

```json
{
  "startDate": "2026-02-18T00:00:00.000Z",
  "days": [
    { "dayNumber": 1, "items": [] },
    { "dayNumber": 2, "items": [] },
    { "dayNumber": 3, "items": [] },
    { "dayNumber": 4, "items": [] },
    { "dayNumber": 5, "items": [] },
    { "dayNumber": 6, "items": [] },
    { "dayNumber": 7, "items": [] }
  ]
}
```

If entitlement does not allow the requested plan domain, API returns `403`.

## 2.6 Cleaned `getMe` response

**GET** `/api/v1/auth/me`

Response shape:

```json
{
  "status": "success",
  "data": {
    "user": { "id": "..." },
    "subscription": {
      "isSubscribed": true,
      "isFreeTier": false,
      "planType": "both",
      "capabilities": {
        "canAccessDiet": true,
        "canAccessTraining": true
      },
      "profileUpdateRequired": false,
      "warning": false,
      "warningThresholdDays": 3,
      "startDate": "2026-02-18T00:00:00.000Z",
      "endDate": "2026-03-20T00:00:00.000Z"
    },
    "profile": {}
  }
}
```

## 2.7 Cleaned profile responses

### User profile endpoint
**GET** `/api/v1/user-profile/me`

Returns:
- `profile`
- normalized `subscription` object (same shape fields as above, except warning fields are not required there).

### Admin user details endpoint
**GET** `/api/v1/users/:id`

Returns:
- `user`
- normalized `subscription`
- `dietPlan`, `trainingPlan`, `profile`, `trackingLast7`

---

## 3) End-to-End User Flow

1. Admin configures active currencies.
2. Admin creates package with selected `planTypes` (1..3) and nested prices per selected type/currency.
3. User selects package + specific `planType` + currency in app checkout.
4. Payment is created and invoice URL is returned.
5. Webhook confirms paid status.
6. System activates/renews subscription with purchased `planType` entitlement.
7. Admin can assign only the plan domains allowed by entitlement:
   - diet → diet only,
   - training → training only,
   - both → both.
8. Free-tier users continue to access both default diet and training plans.
9. App reads normalized subscription from `getMe` / profile endpoints.

---

## 4) Migration Note for Existing Data

Existing packages that still have flat `prices` format must be backfilled to nested format before checkout can work with type-based pricing.

Recommended backfill strategy:
- set `planTypes` to `["both"]` for legacy packages,
- move old flat `prices` under `prices.both`.

Example transformed legacy package:

```json
{
  "planTypes": ["both"],
  "prices": {
    "both": {
      "USD": 9.99,
      "EGP": 450
    }
  }
}
```
