# إصلاح تكرار إشعارات FCM — جانب الموبايل

## المشكلة

لما اليوزر يعمل أي أكشن، الأدمن بيستقبل نفس الـ Push Notification **كذا مرة على نفس الجهاز** (وصل لـ 5–6 مرات).

## السبب باختصار

الباك بيبعت لكل الـ FCM tokens المخزّنة لليوزر. بمرور الوقت بيتراكم على نفس الجهاز **أكتر من توكن** (بسبب تدوير التوكن، إعادة التثبيت، أو تكرار الـ login)، وكلهم لسه بيوصّلوا لنفس الموبايل ← فبيستقبل نسخة لكل توكن.

الحل المشترك مع الباك: **توكن واحد لكل جهاز**، ومفتاحه `deviceId` ثابت بيبعته الموبايل.

> ملاحظة: لازم تعديلات الباك إند تتنفّذ كمان (موجودة في `docs/FCM-DUPLICATE-FIX-BACKEND.md`). تعديلات الموبايل دي بتكمّلها.

---

## المطلوب من الموبايل

### 1) اعمل `deviceId` ثابت لكل جهاز

ده **مش** الـ FCM token (التوكن بيتغيّر، فمينفعش يكون مفتاح). لازم معرّف ثابت يفضل ثابت مع تدوير التوكن وإعادة تشغيل الأبليكيشن:

- **Android:** `Firebase Installations getId()` أو `Settings.Secure.ANDROID_ID`.
- **iOS:** `UIDevice.current.identifierForVendor` أو `Firebase Installations`.

خزّنه محلياً (Keychain / SharedPreferences) عشان يفضل ثابت طول عمر التثبيت.

```kotlin
// Android (مثال)
val deviceId = Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID)
```

```swift
// iOS (مثال)
let deviceId = UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString
```

---

### 2) ابعت `deviceId` مع كل تسجيل للتوكن

الـ Endpoint:

```
PATCH /api/v1/user-session/fcm-token
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "fcmToken": "<current-fcm-token>",
  "deviceId": "<stable-device-id>"
}
```

ابعت نفس `deviceId` كمان مع الـ **login** (لو الباك فعّل استبدال الجلسة بالـ deviceId).

---

### 3) سجّل التوكن في التوقيتات الصح (مهم جداً)

ده أكتر جزء بيمنع تراكم التوكنات:

- **كل cold start للأبليكيشن** — مش بس عند الـ login. هات التوكن الحالي وابعته.
- **عند تدوير التوكن** — في callback التدوير ابعت التوكن الجديد **فوراً**:
  - Android: `onNewToken(token)` في `FirebaseMessagingService`.
  - iOS: `messaging(_:didReceiveRegistrationToken:)` في `MessagingDelegate`.

```kotlin
// Android
override fun onNewToken(token: String) {
    super.onNewToken(token)
    sendTokenToBackend(token, deviceId)   // PATCH فوراً
}
```

```swift
// iOS
func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
    guard let token = fcmToken else { return }
    sendTokenToBackend(token, deviceId)   // PATCH فوراً
}
```

---

### 4) عند الـ Logout

نادِ endpoint تسجيل الخروج عشان الجلسة تتمسح والتوكن معاها (ميفضلش بيستقبل إشعارات بعد الخروج):

```
POST /api/v1/auth/logout
{ "refreshToken": "<refreshToken>" }
```

---

## تحسينات إضافية (موصى بيها — متعلّقة بمشكلة "الإشعارات بتضيع بعد كام يوم")

دي مش متعلّقة بالتكرار لكن بتحسّن وصول الإشعارات على الأجهزة الخاملة:

- **Android:** اتأكد إن الـ **Notification Channel** متعمل في `Application.onCreate` بـ `IMPORTANCE_HIGH`، لإن الباك بيبعت من غير `channelId` فبيستخدم الـ channel الافتراضي — لو ناقص أو متقفل، الإشعار بيتدفن بصمت.
- **iOS:** اطلب وتأكد من صلاحية الإشعارات وتسجيل APNs في كل cold start.
- اقرا الـ `data` payload (`{ type, notificationId }`) من **الـ foreground handler** ومن **الـ cold-start tap handler** — أحياناً بيوصل الـ data بس من غير الـ notification block.

---

## ملخص الـ Checklist

- [ ] توليد `deviceId` ثابت وتخزينه محلياً.
- [ ] إرسال `deviceId` + `fcmToken` في `PATCH /api/v1/user-session/fcm-token`.
- [ ] إرسال `deviceId` مع الـ login.
- [ ] تسجيل التوكن عند كل cold start.
- [ ] تسجيل التوكن فوراً عند `onNewToken` / `didReceiveRegistrationToken`.
- [ ] استدعاء `POST /api/v1/auth/logout` عند الخروج.
- [ ] (تحسين) Notification Channel بـ IMPORTANCE_HIGH على Android.
- [ ] (تحسين) قراءة الـ data payload في الحالتين foreground و cold-start.
