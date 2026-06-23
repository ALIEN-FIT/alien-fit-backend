# Mobile Integration — Diet Plan & Meal Completion

دليل فريق الموبايل (Flutter) لعرض خطة الدايت وتعليم الوجبات إنها خلصت بشكل صح لكل يوم. كل اللي هنا **موجود في الباك إند بالفعل**.

---

## 1. الموديل (مهم تفهمه الأول)

خطة الدايت = **تمبليت 30 يوم**. الهيكل:

```
DietPlan
  └─ weeks[]            // الأسابيع (1..5 تقريبًا)
       └─ days[]        // أيام الأسبوع (dayIndex, date, isDone)
            ├─ meals[]  // الوجبات (id, mealName, order, text, isDone)
            └─ snacks[] // السناكس (نفس الشكل)
```

نقطة جوهرية: **كل يوم له وجبات بـ `id` مختلف** حتى لو نفس النص. يعني "Breakfast" في يوم 1 له `id` غير "Breakfast" في يوم 2. ده اللي بيخلّي الإكمال يتسجّل **لكل يوم لوحده**.

---

## 2. جلب خطة المستخدم

```
GET /api/v1/plans/diet/me
Authorization: Bearer <user access token>
```

### شكل الرد

```jsonc
{
  "status": "success",
  "data": {
    "dietPlan": {
      "id": "f12eb756-dd83-4ec5-90d8-26e6b3932b25",
      "userId": "c891bf52-fafa-4700-b2b8-dd0d943abf60",
      "startDate": "2026-04-04T00:00:00.000Z",
      "endDate": "2026-05-04T00:00:00.000Z",
      "recommendedWaterIntakeMl": 2500,
      "weeks": [
        {
          "weekNumber": 1,
          "days": [
            {
              "dayIndex": 1,
              "date": "2026-04-04T00:00:00.000Z",
              "isDone": false,                       // اليوم كله خلص؟
              "meals": [
                { "id": "ebce04f4-...", "mealName": "ggg",         "order": 3, "text": "ggggg",                         "isDone": true  },
                { "id": "60fb3d49-...", "mealName": "Daily Total", "order": 4, "text": "👉🏻 Calories: 1700 kcal ...",   "isDone": false },
                { "id": "4bf261cb-...", "mealName": "💡Tips",       "order": 5, "text": "Incline Walk 30 mins ...",      "isDone": false }
              ],
              "snacks": []
            }
            // ... يوم 2 .. 7
          ]
        }
        // ... أسبوع 2 .. 5 (إجمالي 30 يوم)
      ]
    }
  }
}
```

اعرض الوجبات مرتّبة بـ `order`، وخُد حالة كل وجبة من `isDone` كما هي من السيرفر (مش محتاج تحسبها).

---

## 3. تعليم وجبة إنها خلصت

```
POST /api/v1/tracking/diet/mark-done
Authorization: Bearer <user access token>
Content-Type: application/json

{
  "mealItemId": "ebce04f4-...",   // id الوجبة من اليوم المطلوب (مش رقم الترتيب)
  "date": "2026-04-04"             // اختياري — لو بعتّه لازم يطابق تاريخ يوم الوجبة
}
```

> بما إن كل يوم له `id` وجبات خاص بيه، ابعت `id` بتاع اليوم اللي المستخدم واقف عليه. مش لازم تبعت `date`؛ الباك إند بيحدّد التاريخ من الوجبة نفسها.

### رد النجاح — `200 OK`

```jsonc
{
  "status": "success",
  "data": {
    "tracking": {
      "date": "2026-04-04T00:00:00.000Z",
      "dietDone": false,                         // true لما كل وجبات اليوم تخلص
      "dietCompletedItemIds": ["ebce04f4-..."],  // الوجبات المعلّمة في اليوم ده
      "trainingDone": false,
      "waterIntakeMl": 0,
      "updatedAt": "2026-04-04T10:12:00.000Z"
    }
  }
}
```

استخدم `dietCompletedItemIds` لتحديث الـ checkboxes فورًا، و`dietDone` لمعرفة إذا اليوم اكتمل.

### الأخطاء

| الكود | المعنى |
|---|---|
| `400` | الـ `date` المبعوت مش مطابق لتاريخ يوم الوجبة |
| `401` | توكن غير صالح |
| `404` | الوجبة (`mealItemId`) مش موجودة أو مش بتاعة المستخدم |
| `422` | `mealItemId` بصيغة غير صحيحة |

---

## 4. متى اليوم يتحسب مكتمل

`day.isDone = true` لما عدد الوجبات المعلّمة = **إجمالي عناصر اليوم (الوجبات + السناكس)**. يعني لازم المستخدم يعلّم كل العناصر علشان اليوم يكمل، وساعتها الأدمن/المدرب بياخدوا إشعار "Meals completed" تلقائيًا.

---

## 5. مثال Flutter كامل (dio)

```dart
class DietTrackingApi {
  final Dio dio;
  DietTrackingApi(this.dio);

  /// خطة الدايت الحالية: weeks -> days -> meals/snacks (مع isDone)
  Future<Map<String, dynamic>> getMyDietPlan() async {
    final res = await dio.get('/api/v1/plans/diet/me');
    return res.data['data']['dietPlan'] as Map<String, dynamic>;
  }

  /// تعليم وجبة خلصت — يرجّع تتبّع اليوم المحدّث
  Future<Map<String, dynamic>> markMealDone(String mealItemId, {DateTime? date}) async {
    final res = await dio.post('/api/v1/tracking/diet/mark-done', data: {
      'mealItemId': mealItemId,
      if (date != null) 'date': date.toIso8601String().split('T').first, // YYYY-MM-DD
    });
    return res.data['data']['tracking'] as Map<String, dynamic>;
  }
}
```

التعامل مع الضغط على وجبة:

```dart
Future<void> onMealChecked(String mealItemId, DateTime dayDate) async {
  final tracking = await api.markMealDone(mealItemId, date: dayDate);

  final completed = Set<String>.from(tracking['dietCompletedItemIds'] ?? const []);
  final dayDone   = tracking['dietDone'] == true;

  setState(() {
    // 1) علّم كل وجبة الـ id بتاعها موجود في completed كـ isDone
    // 2) لو dayDone == true اعرض اليوم إنه مكتمل
  });
}
```

---

## 6. إرشادات الـ UI

- اعرض تنقّل بالأسابيع والأيام (Week 1 → Day 1..7) باستخدام `weekNumber` و`dayIndex`.
- لكل يوم اعرض `meals` و`snacks` بـ checkbox، الحالة من `isDone`.
- علّم اليوم نفسه "مكتمل" لما `day.isDone == true`.
- بعد كل `mark-done` حدّث من `dietCompletedItemIds` بدل ما تعيد تحميل الخطة كلها.

---

## 7. ملاحظات / حدود حالية

- بتعلّم **وجبة وجبة** بالـ `id` بتاعها، مش اليوم كله مرة واحدة.
- اكتمال اليوم بيتطلب **كل** العناصر بما فيها السناكس.
- مفيش حاليًا endpoint **لإلغاء** تعليم وجبة (uncheck) — التعليم بيضيف بس. لو الميزة مطلوبة، الباك إند يقدر يضيفها.
- endpoints مساعدة: `GET /api/v1/tracking/daily-status/:date` لملخّص اليوم، و`POST /api/v1/tracking/water` لتتبّع المياه.
