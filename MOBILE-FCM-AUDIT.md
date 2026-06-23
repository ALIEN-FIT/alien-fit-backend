# Mobile FCM Implementation Audit

> **Purpose:** Hand this file to Claude (or any reviewer) **with access to the mobile app codebase** (Android / iOS / Flutter). The goal is to verify whether the mobile app sends and refreshes its FCM token correctly. A backend bug that stopped notifications for inactive users is being fixed; this audit confirms the mobile side isn't causing the same symptom from a different angle.

## Context / Symptom

Users who stay inactive for a week or a month stop receiving **all** notifications (chat messages, daily reminders, everything) on both Android and iOS. The backend has been fixed to no longer gate delivery on session expiry. The remaining risk is the mobile side: **if the app only sends the FCM token at login, then when FCM rotates the token the backend keeps a dead token and the user silently stops receiving notifications.**

## Backend Contract (what the app must call)

The app registers/updates its token by calling:

```
PATCH /fcm-token
Authorization: Bearer <access token>     # endpoint requires auth
Content-Type: application/json

{
  "fcmToken": "<the current FCM registration token>",
  "deviceId":  "<a stable per-device id>"   // optional but strongly recommended
}
```

- `deviceId` must be **stable for the lifetime of the install** (not regenerated each launch). The backend uses it to de-duplicate notifications per device.
- The endpoint requires a valid access token.

---

## Checklist — verify each item against the mobile code

### 1. Token is sent on refresh (MOST IMPORTANT)
FCM rotates tokens on reinstall, app-data clear, restore from backup, or periodically on its own. The app **must** listen for token changes and immediately re-send to the backend.

- [ ] Android (native): `FirebaseMessagingService.onNewToken(token)` is overridden and calls `PATCH /fcm-token`.
- [ ] iOS (native): `MessagingDelegate.messaging(_:didReceiveRegistrationToken:)` is implemented and calls `PATCH /fcm-token`.
- [ ] Flutter: `FirebaseMessaging.instance.onTokenRefresh.listen(...)` is wired up and calls `PATCH /fcm-token`.
- [ ] React Native: `messaging().onTokenRefresh(...)` is wired up and calls `PATCH /fcm-token`.

**Red flag:** the token is fetched and sent only inside the login flow, with no refresh listener anywhere.

### 2. Token is also sent on every app launch / foreground
A safety net so the backend always has the freshest token even if a refresh event was missed.

- [ ] On app start (after auth is available), the app fetches the current token (`getToken()`) and sends it to `PATCH /fcm-token`.
- [ ] Ideally also re-sends when the app comes to the foreground.

### 3. Stable deviceId
- [ ] The app generates a `deviceId` **once**, persists it (e.g. secure storage / Keychain / SharedPreferences), and reuses the same value on every call.
- [ ] It is **not** regenerated on each launch (which would break de-duplication and multiply rows).

### 4. Auth handling for the token call
- [ ] The `PATCH /fcm-token` call includes a valid access token.
- [ ] If the access token is expired, the app refreshes it (refresh-token flow) and then sends the FCM token — it does not silently skip the call.

### 5. iOS prerequisites (if iOS users get nothing at all)
- [ ] **APNs Authentication Key** (`.p8`) is uploaded in Firebase Console → Project Settings → Cloud Messaging.
- [ ] **Push Notifications** capability is enabled in Xcode (and **Background Modes → Remote notifications** if data messages are used).
- [ ] The app requests notification permission (`UNUserNotificationCenter.requestAuthorization`) and handles the denied case.
- [ ] APNs token is correctly linked to FCM (`Messaging.messaging().apnsToken` is set, or `FirebaseAppDelegateProxyEnabled` is configured properly).

### 6. Android prerequisites
- [ ] On Android 13+ (API 33+), the app requests the runtime `POST_NOTIFICATIONS` permission and handles denial.
- [ ] `google-services.json` is present and matches the Firebase project the backend's service account belongs to (**same project / sender ID**).
- [ ] A notification channel is created (Android 8+); otherwise notifications are silently dropped.

### 7. Project/sender consistency
- [ ] The Firebase project used by the mobile app (`google-services.json` / `GoogleService-Info.plist`) is the **same project** as the backend's `admin-sdk.json` service account. A mismatch means tokens are valid but the backend can never deliver to them.

### 8. Foreground & background message handling
- [ ] Foreground messages are handled (FCM does not auto-display them while the app is open) so chat notifications still surface.
- [ ] A background/data message handler is registered if the app relies on data-only payloads.

---

## What to report back

For each checklist item, please report:

1. **Status:** ✅ implemented / ⚠️ partial / ❌ missing.
2. **Evidence:** the file + function where it's handled (or confirmation it's absent).
3. **The single most likely mobile-side cause** of inactive users not receiving notifications, based on what you found.
4. **Concrete fixes** with code snippets for any ❌ / ⚠️ items — especially item **#1 (onTokenRefresh)**, which is the prime suspect.

> If item #1 (sending the token on refresh) is missing, that alone explains inactive users losing notifications regardless of the backend, and is the priority fix.
