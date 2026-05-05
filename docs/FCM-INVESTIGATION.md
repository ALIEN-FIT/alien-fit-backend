# Backend FCM (Firebase Cloud Messaging) — Technical Investigation

Scope: how the backend currently stores FCM tokens, sends messages, and handles
FCM responses. Filed in support of debugging "notifications lost after 5+ days
of inactivity" reported by the mobile team.

---

## 1. FCM Token Storage

**There is no dedicated `fcm_tokens` table.** The token is stored as a single
nullable column on the `user_sessions` table.

File: [src/modules/user-session/v1/entity/user-session.entity.ts](src/modules/user-session/v1/entity/user-session.entity.ts)

```ts
// src/modules/user-session/v1/entity/user-session.entity.ts:7-16
export class UserSessionEntity extends Model {
    declare id: string;
    declare userId: string;
    declare refreshToken?: string;
    declare fcmToken?: string;
    declare expiresAt?: Date;

    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}
```

```ts
// src/modules/user-session/v1/entity/user-session.entity.ts:19-55
UserSessionEntity.init(
    {
        id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        userId:       { type: DataTypes.UUID, allowNull: false,
                        references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
        refreshToken: { type: DataTypes.TEXT,   allowNull: true, unique: true },
        fcmToken:     { type: DataTypes.STRING, allowNull: true },
        expiresAt:    { type: DataTypes.DATE,   allowNull: true },
    },
    { sequelize, modelName: 'UserSession', tableName: 'user_sessions', timestamps: true }
);
```

Association ([src/modules/user-session/v1/entity/associate-models.ts:5-6](src/modules/user-session/v1/entity/associate-models.ts#L5-L6)):

```ts
UserEntity.hasMany(UserSessionEntity, { foreignKey: 'userId', as: 'sessions', onDelete: 'CASCADE', hooks: true });
UserSessionEntity.belongsTo(UserEntity, { foreignKey: 'userId', as: 'user', onDelete: 'CASCADE' });
```

| Question | Answer |
|---|---|
| Table | `user_sessions` (not a dedicated FCM table) |
| User ⇄ token relationship | **One-to-many** (one session row per device, each row may carry one `fcmToken`) |
| Old tokens overwritten? | Yes for the *same* token value across users (see §2). For the same session, the `fcmToken` column is overwritten on each PATCH. |
| `last_updated_at`? | Only the generic Sequelize `updatedAt` column on the row. There is **no token-specific timestamp** (no `fcmTokenUpdatedAt`, no `lastActiveAt`). |
| `device_id`? | **No.** |
| `platform` (iOS/Android)? | **No.** |
| `app_version`? | **No.** |
| Token length cap | `DataTypes.STRING` → **VARCHAR(255)** in Postgres. FCM tokens are usually ~163 chars today, but can grow. This is a latent risk. |

---

## 2. Token Registration Endpoint

Mounted at [src/app.ts:70](src/app.ts#L70):

```ts
app.use('/api/v1/user-session', userSessionRouterV1);
```

Route ([src/modules/user-session/v1/user.routes.ts:10-15](src/modules/user-session/v1/user.routes.ts#L10-L15)):

```ts
userSessionRouterV1.patch(
    '/fcm-token',
    auth,
    validateRequest(updateFCMTokenSchema),
    updateFCMTokenController
);
```

**Endpoint:** `PATCH /api/v1/user-session/fcm-token`
**Auth:** required (Bearer access token; `auth` middleware loads `req.userSession`)

**Request body** ([src/modules/user-session/v1/user-session.validation.ts](src/modules/user-session/v1/user-session.validation.ts)):

```ts
export const updateFCMTokenSchema = Joi.object({
    fcmToken: Joi.string().required().messages({
        'string.base':  'FCM token must be a string',
        'string.empty': 'FCM token is required',
        'any.required': 'FCM token is required'
    })
});
```

So the body is just `{ "fcmToken": "<string>" }`. **No format check** beyond
"non-empty string" — no length limit, no regex, no platform field.

**Response:** `204 No Content` ([src/modules/user-session/v1/user-session.controller.ts:6-11](src/modules/user-session/v1/user-session.controller.ts#L6-L11)):

```ts
export async function updateFCMTokenController(req: Request, res: Response): Promise<void> {
    const { fcmToken } = req.body;
    const sessionId = req.userSession.id.toString();
    await UserSessionService.updateFCMToken(sessionId, fcmToken);
    res.status(StatusCodes.NO_CONTENT).send();
}
```

**Service logic** ([src/modules/user-session/v1/user-session.service.ts:9-32](src/modules/user-session/v1/user-session.service.ts#L9-L32)):

```ts
static async updateFCMToken(sessionId: string, fcmToken: string): Promise<void> {
    const normalizedToken = fcmToken.trim();
    if (!normalizedToken) {
        throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'FCM token is required');
    }

    await sequelize.transaction(async (transaction) => {
        const session = await UserSessionEntity.findByPk(sessionId, { transaction });
        if (!session) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'User session not found');
        }

        // 1) Wipe this token from ANY OTHER session row that holds it
        await UserSessionEntity.update(
            { fcmToken: null },
            { where: { fcmToken: normalizedToken }, transaction }
        );

        // 2) Attach the token to the current session
        session.fcmToken = normalizedToken;
        await session.save({ transaction });
    });
}
```

Behaviour summary:

- **Validation:** trim + non-empty string only.
- **Deduplication:** yes — before assigning, every other `user_sessions` row
  whose `fcmToken` equals the incoming value is set to `NULL`. This guarantees a
  given physical token lives on at most **one** session row globally.
- **Same token sent twice from same device:** the global wipe above sets it to
  `NULL` on its own row, then the `session.save()` re-sets it. Net effect: same
  end state. Safe.
- **New device login:** a new `user_sessions` row is created (see §7); the old
  device's session row is **kept**, and so is its `fcmToken` — until that token
  is reused on the new device (then dedup wipes the old row) or the user
  explicitly logs out (see §7).

---

## 3. Sending Notifications

### SDK

`firebase-admin` (Node) via the modern `messaging().sendEachForMulticast` API
(this is HTTP v1 under the hood — not the deprecated legacy server-key API).

Initialization ([src/firebase/firebase.ts:1-10](src/firebase/firebase.ts#L1-L10)):

```ts
import admin from 'firebase-admin';
import { ServiceAccount } from 'firebase-admin';
import serviceAccountJson from './admin-sdk.json' with { type: 'json' };

const serviceAccount = serviceAccountJson as ServiceAccount;

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});
```

The rest of `firebase.ts` (lines 12-55) is **commented-out** earlier code that
included token cleanup and proper logging. The real send path lives in
`src/utils/fcm.utils.ts`.

### Payload

File: [src/utils/fcm.utils.ts:35-81](src/utils/fcm.utils.ts#L35-L81)

```ts
export async function sendFcmToTokens(tokens: string[], payload: FcmPayload) {
    const uniqueTokens = Array.from(new Set(tokens.map((token) => token.trim()).filter((token) => token.length > 0)));
    if (uniqueTokens.length === 0) return;

    const tokenChunks = chunk(uniqueTokens, FCM_MULTICAST_LIMIT); // 500

    for (const group of tokenChunks) {
        try {
            const response = await admin.messaging().sendEachForMulticast({
                tokens: group,
                notification: {
                    title: payload.title,
                    body: payload.body,
                },
                data: payload.data,
            });
            // ... error handling, see §4
        } catch (err) {
            errorLogger.error('FCM multicast failed', err);
        }
    }
}
```

`FcmPayload` ([src/utils/fcm.utils.ts:8-12](src/utils/fcm.utils.ts#L8-L12)):

```ts
export interface FcmPayload {
    title: string;
    body: string;
    data?: Record<string, string>;
}
```

The worker fills `data` with `{ type, notificationId }` only ([src/workers/notification/notification.worker.ts:25-32](src/workers/notification/notification.worker.ts#L25-L32)):

```ts
await sendFcmToUser(payload.userId, {
    title: payload.title,
    body: payload.body,
    data: {
        type: payload.type,
        notificationId: notification.id,
    },
});
```

| Field | Value being sent |
|---|---|
| `priority` | **NOT SET** (FCM defaults: `normal` for data-only, `high` when `notification` block is present — but this is *FCM's* default; we do not set `android.priority` ourselves) |
| `content_available` | **NOT SET** (no `apns` block) |
| `notification` block | Yes — `{ title, body }` |
| `data` block | Yes — `{ type, notificationId }` |
| `android` config | **Absent** (no `priority`, no `ttl`, no `channelId`) |
| `apns` config | **Absent** (no `headers`, no `aps`, no `content-available`, no `mutable-content`) |
| `time_to_live` / `ttl` | **Not set** → FCM applies its default of **4 weeks** |

This is the bare minimum payload `firebase-admin` accepts. **No
platform-specific tuning is performed.**

---

## 4. FCM Response Handling (CRITICAL)

File: [src/utils/fcm.utils.ts:55-80](src/utils/fcm.utils.ts#L55-L80)

```ts
if (response.failureCount > 0) {
    const invalidTokens: string[] = [];
    response.responses.forEach((r, idx) => {
        if (!r.success) {
            const maybeError = r.error as { code?: string } | undefined;
            const code = maybeError?.code;
            if (code === 'messaging/registration-token-not-registered' ||
                code === 'messaging/invalid-registration-token') {
                invalidTokens.push(group[idx]);
            } else {
                errorLogger.error('FCM send error', r.error);
            }
        }
    });

    if (invalidTokens.length) {
        await UserSessionEntity.update(
            { fcmToken: null },
            { where: { fcmToken: { [Op.in]: invalidTokens } } }
        );
        infoLogger.info(`Removed ${invalidTokens.length} invalid FCM tokens`);
    }
}
```

| FCM error code | Backend behaviour |
|---|---|
| `messaging/registration-token-not-registered` (`UNREGISTERED` / `NotRegistered`) | **Token nulled** on the matching `user_sessions` row(s). Row is *not* deleted, only `fcmToken` is set to `NULL`. |
| `messaging/invalid-registration-token` (`INVALID_ARGUMENT` / `InvalidRegistration`) | **Token nulled**, same path. |
| `SENDER_ID_MISMATCH` (`messaging/mismatched-credential`) | Falls into the `else` branch → only `errorLogger.error('FCM send error', r.error)`. **Token kept.** |
| `QUOTA_EXCEEDED` (`messaging/message-rate-exceeded`) | Logged only. **Token kept**, no retry, no backoff at the FCM-call level. |
| `UNAVAILABLE` (`messaging/server-unavailable`) | Logged only. **Token kept.** No FCM-level retry. |
| Throws on `sendEachForMulticast` (network etc.) | The `catch (err)` at [line 77](src/utils/fcm.utils.ts#L77) logs and swallows — **the entire batch's tokens are not retried at the FCM layer.** |

So invalid/expired tokens **are** cleaned up — but the cleanup is **purely
reactive**. It only happens when the backend actually attempts a send and FCM
returns `UNREGISTERED` / `INVALID_ARGUMENT`. There is no proactive validation
(see §5).

### Retry logic

There is **no FCM-call-level retry/backoff**. The only retry is at the BullMQ
**queue** layer ([src/utils/notification.utils.ts:23-30](src/utils/notification.utils.ts#L23-L30) and [src/workers/notification/notification.queue.ts](src/workers/notification/notification.queue.ts)):

```ts
// notification.utils.ts (per-user 'send' job)
attempts: 5, backoff: { type: 'exponential', delay: 1000 },
removeOnComplete: true, removeOnFail: false,

// notification.queue.ts (default for the queue)
attempts: 3, backoff: { type: 'exponential', delay: 1000 },
```

But because `sendFcmToTokens` swallows non-invalid errors in its `try/catch`,
**`handleSend` does not throw** when FCM returns `UNAVAILABLE`/`QUOTA_EXCEEDED`,
so BullMQ marks the job *successful* and the retry never runs. The retry only
helps for DB-level failures inside `handleSend` (e.g. `NotificationRepository.create` throwing).

### Logging

- `errorLogger` → `logs/error.log` + console ([src/config/logger.config.ts:4-14](src/config/logger.config.ts#L4-L14))
- `infoLogger`  → `logs/info.log` (file only) ([src/config/logger.config.ts:16-25](src/config/logger.config.ts#L16-L25))

Logged events: per-token error (non-invalid), batch-level exception, and the
"Removed N invalid FCM tokens" info line. **No structured per-token success
record is written anywhere.**

---

## 5. Token Lifecycle / Cleanup

| Question | Answer |
|---|---|
| Scheduled stale-token cleanup? | **No.** [src/workers/notification/notification.cron.ts](src/workers/notification/notification.cron.ts) only enqueues *content* (daily reminders, subscription-end alerts, plan-update cycle). It never inspects token freshness, never validates against FCM, never removes/refreshes tokens. |
| OTP cleanup worker? | Yes ([src/workers/otp-cleanup.worker.ts](src/workers/otp-cleanup.worker.ts)) but it's unrelated. |
| Dry-run / `validateOnly` step? | **No.** No call site uses `admin.messaging().send({ ... }, /* dryRun */ true)` anywhere. |
| Failure-tracking / circuit-breaker per token? | **No.** A token that fails with `UNAVAILABLE` 100 times in a row will be retried on every send, with no record kept. |
| Token rotation policy? | None. Tokens are written when the client PATCHes `/fcm-token` and only ever cleared on (a) `UNREGISTERED`/`INVALID_ARGUMENT` from FCM, (b) being claimed by another session via the dedup wipe (§2), or (c) session deletion (§7). |

---

## 6. Notification Triggers

`sendFcmToUser` is the only path that actually calls FCM, and it is invoked
**only** from `handleSend` in the worker ([src/workers/notification/notification.worker.ts:14-33](src/workers/notification/notification.worker.ts#L14-L33)). Everything else
goes through `enqueueUserNotification` / `enqueueBroadcastNotification` →
BullMQ → `handleSend`. Every push therefore carries the **same payload shape**:

```ts
notification: { title, body }
data:         { type, notificationId }
```

i.e. **both `notification` and `data` are sent** for every trigger. There is
no pure-data ("silent") push path anywhere in the codebase.

Trigger sites (each enqueues one job → one push attempt):

| # | Trigger | File | NotificationType |
|---|---|---|---|
| 1 | User → admin/trainer chat message (HTTP) | [src/modules/chat/v1/chat.controller.ts:61-63](src/modules/chat/v1/chat.controller.ts#L61-L63) | (admin chat) |
| 2 | Admin → user chat message (HTTP) | [src/modules/chat/v1/chat.controller.ts:176-178](src/modules/chat/v1/chat.controller.ts#L176-L178) | `ADMIN_MESSAGE` |
| 3 | User → admin/trainer chat (Socket.IO) | [src/socket/socket-server.ts:183-185](src/socket/socket-server.ts#L183-L185) | (admin chat) |
| 4 | Admin → user chat (Socket.IO) | [src/socket/socket-server.ts:192-194](src/socket/socket-server.ts#L192-L194) | `ADMIN_MESSAGE` |
| 5 | New user signup → notify admins/trainers | [src/modules/user/v1/user.service.ts:59](src/modules/user/v1/user.service.ts#L59) | — |
| 6 | Subscription payment events → notify admins/trainers | [src/modules/subscription/v1/subscription-payment.service.ts:194](src/modules/subscription/v1/subscription-payment.service.ts#L194) | — |
| 7 | Plan-update request created / cycle complete | [src/modules/requests/v1/plan-update-request.service.ts:19,101](src/modules/requests/v1/plan-update-request.service.ts) | — |
| 8 | Profile update events | [src/modules/user-profile/v1/user-profile.service.ts:160](src/modules/user-profile/v1/user-profile.service.ts#L160) | — |
| 9 | Tracking events | [src/modules/tracking/v1/tracking.service.ts:180,215](src/modules/tracking/v1/tracking.service.ts) | — |
| 10 | Daily training/diet/body-image/inbody reminders (cron 09:00 & 21:00) | [src/workers/notification/notification.cron.ts:115-180](src/workers/notification/notification.cron.ts#L115-L180) | `TRAINING_REMINDER`, `NUTRITION`, `BODY_IMAGE_REMINDER`, `INBODY_REMINDER` |
| 11 | Subscriptions ending today (admins/trainers) | [src/workers/notification/notification.cron.ts:195-285](src/workers/notification/notification.cron.ts#L195-L285) | `SUBSCRIPTION_ENDS_TODAY` |
| 12 | Generic admin broadcasts | [src/modules/notification/v1/notification.service.ts:176-193](src/modules/notification/v1/notification.service.ts#L176-L193) | (admin-supplied) |

**Send-to-all-tokens vs latest-only:** the worker calls `sendFcmToUser`, which
calls `getUserFcmTokens` ([src/utils/fcm.utils.ts:14-25](src/utils/fcm.utils.ts#L14-L25)):

```ts
const sessions = await UserSessionEntity.findAll({
    where: { userId },
    attributes: ['id', 'fcmToken'],
});
const tokens = sessions
    .map((s) => s.fcmToken)
    .filter((token): token is string => typeof token === 'string' && token.trim().length > 0);
return Array.from(new Set(tokens));
```

→ **All sessions for the user that still have a non-null `fcmToken` are
targeted.** Multi-device delivery is in principle supported.

---

## 7. Multi-Device Support

**Can a user be logged in on multiple devices?** Yes. Every login creates a new
`UserSessionEntity` row — [src/modules/auth/v1/auth.service.ts:44, 85, 114](src/modules/auth/v1/auth.service.ts):

```ts
const userSession = await UserSessionEntity.create({ userId: user.id });
```

(Three call-sites: phone-OTP login, phone-OTP register, legacy email/password
login. Auth controller has two more for Google OAuth flows at [auth.controller.ts:124, 173](src/modules/auth/v1/auth.controller.ts#L124).)

**How does the backend send to all of them?** As shown in §6, by querying every
session row for that `userId` whose `fcmToken IS NOT NULL`.

**Logout:** [src/modules/auth/v1/auth.service.ts:197-203](src/modules/auth/v1/auth.service.ts#L197-L203):

```ts
static async logout(refreshToken: string): Promise<void> {
    const session = await UserSessionEntity.findOne({ where: { refreshToken } });
    if (!session) throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Session not found');
    await session.destroy();
}
```

→ The whole row is deleted, which removes the `fcmToken` along with it. **But
this requires the client to call `POST /api/v1/auth/logout` with its
`refreshToken`.** A user who simply uninstalls the app or drops `refreshToken`
locally leaves their session row (and `fcmToken`) in the DB.

User-blocking also wipes sessions ([src/modules/user/v1/user.service.ts:100-102](src/modules/user/v1/user.service.ts#L100-L102)).

There is **no logic that keeps only the most-recent session per device**, and
**no `expiresAt` enforcement** anywhere we could find — the column exists but is
never written or read in queries.

---

## 8. Logs & Observability

| Question | Answer |
|---|---|
| Where are FCM send attempts logged? | Only winston files (`logs/error.log`, `logs/info.log`) — no DB row, no APM, no per-attempt audit table. |
| Per-user history of FCM attempts? | **No persistent record** of the FCM call exists. The `notifications` table ([src/modules/notification/v1/entity/notification.entity.ts](src/modules/notification/v1/entity/notification.entity.ts)) records that an in-app notification was *created*, with `id, userId, type, title, body, isSeen, isRead, createdAt`. It does **not** record the FCM `messageId`, success/failure, error code, target token, or response. |
| Can we look up a given user's last 10 FCM attempts? | **Not from the DB.** Only from grepping the log files (and only for failures, since successes aren't logged). With a `userId` we can list the last 10 in-app notifications via `notifications.userId=?` — but that doesn't tell us whether each push was delivered, nor what FCM said. |
| BullMQ job history? | `removeOnComplete: true` for both queues → completed jobs are deleted from Redis. Failed jobs are kept (`removeOnFail: false`) but only contain `userId/title/body`, no FCM response. |

---

## Summary of Findings

### ✅ What the backend does correctly

1. **Multi-device fan-out** is implemented. `sendFcmToUser` collects every
   non-null `fcmToken` across the user's sessions and sends to all of them.
2. **Token deduplication on registration.** Re-using the same token on a new
   session correctly nulls it on any other row, so one physical token lives
   on at most one session row globally.
3. **Reactive cleanup of unregistered/invalid tokens.** When FCM returns
   `messaging/registration-token-not-registered` or
   `messaging/invalid-registration-token`, the offending token is set to
   `NULL` in `user_sessions`.
4. **Uses `firebase-admin` HTTP v1 via `sendEachForMulticast`** (not the
   deprecated legacy server-key API), which is the right primitive.
5. **Logout deletes the whole session row**, taking the FCM token with it —
   so a properly-logged-out device won't keep receiving pushes.

### ❌ What is missing or broken

1. **No platform-specific payload tuning at all.** The send call has no
   `android: { priority: 'high', ttl, channelId }` and no
   `apns: { headers, payload: { aps: { 'content-available': 1, ... } } }`.
   Consequences:
   - On Android, FCM may demote messages to *normal* priority and never wake
     a Doze-mode device. After 5+ days of inactivity, Android aggressively
     applies App Standby Buckets / Doze; without `priority: high` and a
     correct `channelId`, our pushes are exactly the kind that get dropped.
   - On iOS, with no `apns` block, APNs treats this as a regular alert. There
     is no `apns-priority`, no `apns-push-type`, no `mutable-content`, no
     `content-available`. After a few days of no app launches iOS will
     down-prioritise and may discard delayed messages.
2. **No `ttl` is set.** FCM defaults to 4 weeks, so for *single* messages this
   is fine — but combined with no priority hint, low-priority messages get
   discarded by the device long before TTL anyway.
3. **No proactive token cleanup / no scheduled validation job.** Tokens only
   get nulled when an actual send to them fails with `UNREGISTERED`. A user
   who reinstalled the app, switched device, or whose token rotated, will have
   their old token sit in the DB indefinitely until the *next* send attempt.
   Nothing scrubs sessions whose `updatedAt` is older than N days.
4. **No `lastActiveAt` / `fcmTokenUpdatedAt` column.** Combined with point 3,
   we cannot tell stale sessions from active ones. The `expiresAt` column is
   declared but never written or queried.
5. **No `platform` column.** Even if we wanted to add APNs/Android-specific
   payloads, the backend can't tell which token is which platform.
6. **Errors other than UNREGISTERED/INVALID_ARGUMENT are silently swallowed.**
   `SENDER_ID_MISMATCH`, `QUOTA_EXCEEDED`, `UNAVAILABLE`, network errors —
   logged then dropped. Crucially this also defeats the BullMQ retry: the job
   completes "successfully" because `sendFcmToTokens` doesn't rethrow.
7. **No persistence of FCM responses.** Operationally we can't answer "did
   user X get push Y?". Only winston files, only failures, only with the FCM
   error code.
8. **`fcmToken` column is `VARCHAR(255)`.** A latent risk — newer FCM tokens
   can exceed this. If FCM ever returns a longer token, the PATCH endpoint
   will silently truncate (or, depending on Postgres mode, error).
9. **Client `notification` block + `data` block on every send.** When the app
   is in the background, FCM hands the system the `notification` block and the
   OS displays it; the JS handler fires only when the user taps it. This is
   fine for visible alerts but means we have **no silent/data-only push
   strategy** to wake the app after long idle periods.

### Specific recommendations for the mobile team

These are things the *client* can do without backend changes (the requested
framing). Where a backend change would help materially, it's flagged.

1. **Re-register the FCM token on every app launch and on token-refresh
   callbacks.** The endpoint is `PATCH /api/v1/user-session/fcm-token` with
   `{ "fcmToken": "<token>" }` and a Bearer access token. Don't rely on FCM
   token rotation to be silent — push the new token eagerly. Because the
   backend has no proactive validation and no `lastActiveAt`, the app
   re-registering on every cold-start is the single biggest mitigation.
2. **Verify the Android notification channel exists *before* a push is
   expected.** The backend sends no `channelId`, so on Android 8+ FCM uses the
   app's *default* channel. If that channel is missing or has been
   user-disabled, the OS drops the notification silently. Make sure the
   default channel is created in `Application.onCreate` with `IMPORTANCE_HIGH`.
3. **Listen for token-invalidation events (e.g. `onNewToken`) and PATCH
   immediately.** Don't wait for the next login.
4. **On iOS, request and verify provisional/authorized notification
   permission and the APNs registration on every cold start.** Because the
   backend sends no `apns` block, the alert is treated as a default-priority
   alert; if APNs registration is stale on the device, iOS may not deliver.
5. **Add a "heartbeat" call** — even a no-op authenticated GET on app launch
   refreshes the session row's `updatedAt` if you also bump it server-side
   (this would be a small backend change, see below). Today, sessions never
   "look fresh" again after creation, so when we *do* add server-side cleanup
   it can't tell active from abandoned devices without a client signal.
6. **Tap-handling:** since every push has both a `notification` and a `data`
   block with `{ type, notificationId }`, the client must read `data` from
   both the foreground handler and the cold-start tap handler. After 5+ days,
   if the OS coalesced/dropped the visible notification, sometimes only the
   data payload arrives — make sure the client doesn't assume `notification`
   is always present.

**Recommended backend follow-ups** (not requested, but the root cause sits on
the backend side):

- Add `android: { priority: 'high', ttl: 86400, notification: { channelId: '...' } }`
  and `apns: { headers: { 'apns-priority': '10', 'apns-push-type': 'alert' },
  payload: { aps: { 'mutable-content': 1 } } }` to the
  `sendEachForMulticast` call in [src/utils/fcm.utils.ts:46-53](src/utils/fcm.utils.ts#L46-L53). This alone is likely to
  fix the "missed pushes after 5 days" symptom on most devices.
- Add `platform`, `deviceId`, `appVersion`, and `fcmTokenUpdatedAt` columns
  to `user_sessions`, and have the client send them with PATCH.
- Stop swallowing non-invalid FCM errors in `sendFcmToTokens` — rethrow so
  BullMQ retries kick in for `UNAVAILABLE`/`QUOTA_EXCEEDED`.
- Add a scheduled job that nulls `fcmToken` on sessions with `updatedAt`
  older than ~30 days, and have the client refresh on launch (item 1 above).
