# فتح الشات عند الضغط على النوتيفيكيشن (Flutter)

دليل لربط جانب الموبايل مع تعديلات الباك إند الخاصة بالـ deep-link — للأبلكيشنين:
**أبلكيشن المستخدم (User app)** و **أبلكيشن الأدمن/الترينر (Admin app)**.

---

## الـ payload اللي الباك إند بيبعته

كل إشعار شات بيبعت داخل الـ FCM `data` المفاتيح دي:

### للمستخدم (لما الكوتش يبعتله) — `type: admin_message`
```json
{
  "type": "admin_message",
  "notificationId": "<uuid>",
  "route": "chat",
  "chatId": "<uuid>"
}
```

### للأدمن/الترينر (لما اليوزر يبعت) — `type: message`
```jsonc
{
  "type": "message",
  "notificationId": "<uuid>",
  "route": "chat",
  "chatId": "<uuid>",
  "userId": "<uuid>",        // ⭐ الأهم = senderId (اليوزر صاحب الرسالة) — الـ peer اللي بتفتح شاته
  "senderName": "اسم اليوزر", // عشان اسم الشات يظهر فورًا (من غيره يظهر "User" لثانية)
  "gender": "male",          // موجود لو متسجّل عند اليوزر
  "imageId": "<uuid>",       // موجود لو لليوزر صورة
  "avatarUrl": "https://..." // موجود لو لليوزر صورة (URL جاهز)
}
```

> الباك إند بيملأ `userId`/`senderName`/`gender`/`imageId`/`avatarUrl` **تلقائيًا** من بيانات اليوزر
> الباعت (عن طريق `byUserId`). الحقول الاختيارية (gender/imageId/avatarUrl) بتظهر بس لو متوفرة عند اليوزر.

**الحد الأدنى المضمون دايمًا:** `notification.title` + `notification.body` + `data.type="message"` + `data.userId` (= senderId).

> كل قيم الـ `data` بتيجي من FCM كـ **String** دايمًا حتى لو رقم — اعمل parse لو احتجت.

الفرق الجوهري بين الأبلكيشنين:
- **User app**: عنده شات واحد مع الكوتش → يفتح `chatView` على طول (الـ `chatId` اختياري للتأكيد).
- **Admin app**: عنده شاتات كتير → لازم يستخدم `userId` (و/أو `chatId`) عشان يفتح شات اليوزر الصح.

---

## نظرة عامة على الحالات الثلاثة (نفس الكلام للأبلكيشنين)

| حالة التطبيق | الـ handler المسؤول |
|---|---|
| مقفول خالص (terminated) واتفتح من النوتيفيكيشن | `FirebaseMessaging.instance.getInitialMessage()` |
| شغّال في الخلفية (background) والمستخدم ضغط | `FirebaseMessaging.onMessageOpenedApp` |
| فاتح قدامك (foreground) | `FirebaseMessaging.onMessage` — لازم تعرض النوتيفيكيشن بنفسك |

---

## 1) مفتاح Navigator عام (في الأبلكيشنين)

```dart
// lib/main.dart
final navigatorKey = GlobalKey<NavigatorState>();

MaterialApp(
  navigatorKey: navigatorKey,
  // ... routes / onGenerateRoute
);
```

---

## 2) دالة التوجيه — أبلكيشن المستخدم (User app)

بتستخدم `ScreenNames` الموجودة عندك:

```dart
void handleNotificationTap(RemoteMessage message) {
  final data = message.data;

  switch (data['route']) {
    case 'chat':
      // المستخدم عنده شات واحد مع الكوتش
      navigatorKey.currentState?.pushNamed(
        ScreenNames.chatView,            // "/chatView"
        arguments: data['chatId'],       // اختياري — للتأكيد فقط
      );
      break;

    default:
      // أي إشعار من غير route محدد → افتح شاشة الإشعارات
      navigatorKey.currentState?.pushNamed(ScreenNames.notificationsView);
      break;
  }
}
```

> ملاحظة: لو `chatView` بياخد arguments بشكل معيّن (مثلاً object) عدّل الـ `arguments` حسب
> الـ `onGenerateRoute` بتاعك. لو مش محتاج أي argument، سيبه فاضي وافتح الشاشة على طول.

---

## 3) دالة التوجيه — أبلكيشن الأدمن/الترينر (Admin app)

أبلكيشن الأدمن غالبًا عنده أسماء routes مختلفة، فده **template** عدّل أسماء الـ routes حسب مشروعك.
المهم إنك تستخدم `userId` (و/أو `chatId`) عشان تفتح شات اليوزر الصح:

```dart
void handleNotificationTap(RemoteMessage message) {
  final data = message.data;

  switch (data['route']) {
    case 'chat':
      final userId = data['userId'];     // ⭐ الـ peer = senderId
      if (userId == null || userId.isEmpty) break;

      navigatorKey.currentState?.pushNamed(
        AdminRoutes.userChatView,         // ← اسم الـ route عند الأدمن (عدّله)
        arguments: {
          'userId': userId,
          'chatId': data['chatId'],
          // الحقول دي جاهزة من الباك إند عشان الشات يبان مكتمل فورًا:
          'senderName': data['senderName'],
          'avatarUrl': data['avatarUrl'],   // ممكن يكون null
          'imageId': data['imageId'],       // بديل لو مفيش avatarUrl
          'gender': data['gender'],
        },
      );
      break;

    default:
      navigatorKey.currentState?.pushNamed(AdminRoutes.notificationsView);
      break;
  }
}
```

> استخدم `senderName` و `avatarUrl` كـ placeholder لحد ما تيجي بيانات الشات من الـ API،
> عشان تتجنب وميض "User" أو صورة فاضية أول ما الشاشة تفتح.

---

## 4) تسجيل الـ handlers (مشترك بين الأبلكيشنين)

نادي الدالة دي **مرة واحدة** بعد ما Firebase يـ initialize وبعد ما الـ navigator يبقى جاهز
(عادةً في `initState` بتاع الـ root/home widget، أو بعد الـ login):

```dart
Future<void> setupNotificationTaps() async {
  // (أ) التطبيق كان مقفول خالص واتفتح من ضغطة النوتيفيكيشن
  final initialMessage = await FirebaseMessaging.instance.getInitialMessage();
  if (initialMessage != null) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      handleNotificationTap(initialMessage);   // استنى أول إطار يترسم
    });
  }

  // (ب) التطبيق في الخلفية والمستخدم ضغط النوتيفيكيشن
  FirebaseMessaging.onMessageOpenedApp.listen(handleNotificationTap);

  // (ج) التطبيق فاتح قدام المستخدم — اعرض النوتيفيكيشن بنفسك
  FirebaseMessaging.onMessage.listen(showForegroundNotification);
}
```

---

## 5) عرض النوتيفيكيشن وهو فاتح (Foreground) — مشترك

في الـ foreground الـ OS مش بيعرض بانر تلقائيًا، فبتستخدم `flutter_local_notifications`،
وبتمرّر `message.data` كـ payload عشان ترجّعه في الضغطة:

```dart
import 'dart:convert';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

final _localNotifications = FlutterLocalNotificationsPlugin();

const _androidChannel = AndroidNotificationChannel(
  'chat_messages',
  'Chat messages',
  importance: Importance.high,
);

Future<void> initLocalNotifications() async {
  await _localNotifications
      .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>()
      ?.createNotificationChannel(_androidChannel);

  const initSettings = InitializationSettings(
    android: AndroidInitializationSettings('@mipmap/ic_launcher'),
    iOS: DarwinInitializationSettings(),
  );

  await _localNotifications.initialize(
    initSettings,
    onDidReceiveNotificationResponse: (response) {
      final payload = response.payload;
      if (payload == null) return;
      final data = Map<String, dynamic>.from(jsonDecode(payload));
      handleNotificationTap(RemoteMessage(data: data.cast<String, String>()));
    },
  );
}

void showForegroundNotification(RemoteMessage message) {
  final notification = message.notification;
  if (notification == null) return;

  _localNotifications.show(
    notification.hashCode,
    notification.title,
    notification.body,
    NotificationDetails(
      android: AndroidNotificationDetails(
        _androidChannel.id,
        _androidChannel.name,
        importance: Importance.high,
        priority: Priority.high,
      ),
      iOS: const DarwinNotificationDetails(),
    ),
    payload: jsonEncode(message.data),  // نمرّر الـ data كاملة
  );
}
```

استدعِ `initLocalNotifications()` مرة واحدة عند بداية التطبيق، قبل `setupNotificationTaps()`.

---

## 6) ترتيب الاستدعاء الكامل (في الأبلكيشنين)

```dart
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();

  await initLocalNotifications();          // 1) جهّز local notifications
  await FirebaseMessaging.instance.requestPermission(
    alert: true, badge: true, sound: true, // 2) اطلب الإذن (iOS و Android 13+)
  );

  runApp(MyApp());                          // 3) شغّل التطبيق (فيه navigatorKey)
}

// وبعد ما الـ navigator يبقى جاهز / بعد الـ login:
//   await setupNotificationTaps();
```

---

## نقاط مهمة وأخطاء شائعة

- **لازم يكون فيه `notification` block في الـ payload** (موجود فعلاً في الباك إند). ده اللي بيخلي ضغطة النوتيفيكيشن في حالة الـ background/terminated تسلّم الـ `data` للـ handlers.
- **كل قيم `data` نصوص (String)** — اعمل parse لو احتجت أرقام.
- **نادي `getInitialMessage()` مرة واحدة بس** عند الفتح ومن غير ما تتجاهل النتيجة.
- **الفرق بين الأبلكيشنين**: User app يفتح `ScreenNames.chatView` مباشرة؛ Admin app يستخدم `userId` عشان يفتح شات اليوزر الصح.
- **الـ FCM token**: راجع `MOBILE-FCM-AUDIT.md` في جذر المشروع — لازم كل أبلكيشن يبعت الـ token على `onTokenRefresh` مش بس عند الـ login، وإلا المستخدم الخامل بيبطّل يستقبل إشعارات أصلًا (شرط عشان النوتيفيكيشن توصل قبل ما نتكلم عن الـ deep-link).

---

## ملخص تعديلات الباك إند المرتبطة

| الملف | التعديل |
|---|---|
| `src/utils/notification.utils.ts` | إضافة `data?: Record<string,string>` لـ `SendNotificationJobData` |
| `src/workers/notification/notification.worker.ts` | دمج `...payload.data` داخل الـ FCM data |
| `src/modules/notification/v1/notification.service.ts` | `notifyUserAboutAdminMessage` بياخد `chatId`؛ `notifyAdminsAndTrainers` بياخد `data` **وبيثري** الـ payload بـ `userId/senderName/gender/imageId/avatarUrl` من بيانات الباعت |
| `src/socket/socket-server.ts` | تمرير `{ route:'chat', chatId }` في الاتجاهين (الإثراء بيحصل في الـ service) |
| `src/modules/chat/v1/chat.controller.ts` | تمرير `{ route:'chat', chatId }` لإشعار الأدمن/الترينر |

### جدول الوجهات (route → شاشة)

| route | User app | Admin app |
|---|---|---|
| `chat` | `ScreenNames.chatView` (`/chatView`) | شاشة شات اليوزر (بالـ `userId`) |
| _(غير محدد)_ | `ScreenNames.notificationsView` | شاشة الإشعارات |
