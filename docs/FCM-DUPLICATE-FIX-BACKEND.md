# إصلاح تكرار إشعارات FCM — جانب الباك إند

## المشكلة

لما اليوزر يعمل أي أكشن، الأدمن بيستقبل نفس الـ Push Notification **كذا مرة على نفس الجهاز** (في البلاغ وصل لـ 5–6 مرات).

## السبب الجذري

الكود بيبعت **إشعار واحد فقط** لكل أدمن — المشكلة مش في التكرار على مستوى الكود، لكن في **توزيع الـ Push على الـ tokens**.

`notifyAdminsAndTrainers` بيعمل job واحد لكل أدمن، بعدين الـ worker بينده `sendFcmToUser(adminId)` اللي بتعمل:

```ts
// src/utils/fcm.utils.ts
const sessions = await UserSessionEntity.findAll({ where: { userId } }); // كل جلسات اليوزر
const tokens = sessions.map(s => s.fcmToken).filter(غير فاضي);
// بيبعت لكل token
```

يعني بيبعت لـ **كل الـ fcmTokens المخزّنة لليوزر ده عبر كل جلساته**. والأدمن عنده كذا `user_sessions` row بكذا `fcmToken` كلهم لسه شغّالين وكلهم بيوصّلوا لنفس الموبايل ← الموبايل بيستقبل نسخة لكل token.

### ليه التوكنات اتراكمت؟

1. **كل login بيعمل session row جديدة** (`UserSessionEntity.create({ userId })`) من غير ما يمسح القديمة.
2. **مفيش `deviceId`** — فمفيش حاجة بتقول "ده نفس الجهاز، استبدل التوكن القديم". الـ dedup الموجود بيشتغل بس لو **نفس قيمة التوكن** اتبعتت تاني؛ لكن لما التوكن بيتغيّر (rotation / إعادة تثبيت / login جديد) التوكن القديم بيفضل في الداتابيز.
3. **مفيش تنظيف استباقي** — التوكن القديم مبيتشالش إلا لما FCM يرجّع `UNREGISTERED` فعلياً.

ده بيفسّر كمان ليه العدد بيختلف بين حدث وحدث (رسالة 5 مرات، Profile مرتين): مع كل إرسال، التوكنات الميتة بترجع `UNREGISTERED` فبتتمسح تدريجياً، فالحدث اللي بعده بيتوزّع على توكنات أقل.

## الحل: توكن واحد لكل جهاز (مفتاحه `deviceId`)

---

### خطوة 0 — تنظيف فوري على البرودكشن (علاج سريع)

شغّل ده الأول عشان يوقف التكرار حالاً قبل أي deploy. بيسيب أحدث توكن بس لكل يوزر:

```sql
UPDATE user_sessions s
SET "fcmToken" = NULL
WHERE "fcmToken" IS NOT NULL
  AND "id" <> (
    SELECT s2."id" FROM user_sessions s2
    WHERE s2."userId" = s."userId" AND s2."fcmToken" IS NOT NULL
    ORDER BY s2."updatedAt" DESC LIMIT 1
  );
```

> ⚠️ ملاحظة: ده بيسيب توكن واحد لكل **يوزر** (مش لكل جهاز). يعني لو الأدمن مسجّل على موبايل + تابلت، هيستلم على جهاز واحد بس مؤقتاً لحد ما الحل الدائم (الخطوات تحت) يشتغل ويفرّق بين الأجهزة بالـ `deviceId`.

---

### خطوة 1 — Migration

أضف `deviceId`، وسّع عمود التوكن لـ TEXT، وأضف `fcmTokenUpdatedAt`:

```sql
ALTER TABLE user_sessions ADD COLUMN "deviceId" VARCHAR(255);
ALTER TABLE user_sessions ALTER COLUMN "fcmToken" TYPE TEXT;
ALTER TABLE user_sessions ADD COLUMN "fcmTokenUpdatedAt" TIMESTAMPTZ;
CREATE INDEX idx_user_sessions_user_device ON user_sessions ("userId", "deviceId");
```

(لو بتستخدم Sequelize migrations، اعمل نفس ده في ملف migration جديد تحت `src/database/migrations`.)

---

### خطوة 2 — تحديث الـ Entity

في `src/modules/user-session/v1/entity/user-session.entity.ts`:

```ts
export class UserSessionEntity extends Model {
    declare id: string;
    declare userId: string;
    declare refreshToken?: string;
    declare fcmToken?: string;
    declare deviceId?: string;            // جديد
    declare fcmTokenUpdatedAt?: Date;     // جديد
    declare expiresAt?: Date;
    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

UserSessionEntity.init(
    {
        // ... الموجود
        fcmToken: {
            type: DataTypes.TEXT,         // كان STRING(255)
            allowNull: true,
        },
        deviceId: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        fcmTokenUpdatedAt: {
            type: DataTypes.DATE,
            allowNull: true,
        },
    },
    { /* ... */ }
);
```

---

### خطوة 3 — تحديث `updateFCMToken` (أهم خطوة)

في `src/modules/user-session/v1/user-session.service.ts` — نضمن توكن واحد لكل (يوزر + جهاز):

```ts
import { Op } from 'sequelize';

static async updateFCMToken(sessionId: string, fcmToken: string, deviceId?: string): Promise<void> {
    const token = fcmToken.trim();
    if (!token) {
        throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'FCM token is required');
    }

    await sequelize.transaction(async (transaction) => {
        const session = await UserSessionEntity.findByPk(sessionId, { transaction });
        if (!session) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'User session not found');
        }

        // (أ) امسح نفس قيمة التوكن من أي صف تاني — الموجود حالياً
        await UserSessionEntity.update(
            { fcmToken: null },
            { where: { fcmToken: token }, transaction }
        );

        // (ب) الجديد: امسح توكن أي session تانية لنفس اليوزر على نفس الجهاز
        if (deviceId) {
            await UserSessionEntity.update(
                { fcmToken: null },
                {
                    where: {
                        userId: session.userId,
                        deviceId,
                        id: { [Op.ne]: session.id },
                    },
                    transaction,
                }
            );
        }

        // (ج) اربط التوكن بالجلسة الحالية
        session.fcmToken = token;
        session.deviceId = deviceId ?? session.deviceId;
        session.fcmTokenUpdatedAt = new Date();
        await session.save({ transaction });
    });
}
```

---

### خطوة 4 — تحديث الـ Validation والـ Controller

`src/modules/user-session/v1/user-session.validation.ts`:

```ts
export const updateFCMTokenSchema = Joi.object({
    fcmToken: Joi.string().required().messages({
        'string.base':  'FCM token must be a string',
        'string.empty': 'FCM token is required',
        'any.required': 'FCM token is required',
    }),
    deviceId: Joi.string().trim().max(255).optional(),   // جديد
});
```

`src/modules/user-session/v1/user-session.controller.ts`:

```ts
export async function updateFCMTokenController(req: Request, res: Response): Promise<void> {
    const { fcmToken, deviceId } = req.body;
    const sessionId = req.userSession.id.toString();
    await UserSessionService.updateFCMToken(sessionId, fcmToken, deviceId);
    res.status(StatusCodes.NO_CONTENT).send();
}
```

**الـ Endpoint النهائي:** `PATCH /api/v1/user-session/fcm-token`
**Body:**
```json
{ "fcmToken": "<token>", "deviceId": "<stable-device-id>" }
```

---

### خطوة 5 — منع تراكم الجلسات عند الـ login (موصى به)

عند الـ login، بدل `UserSessionEntity.create({ userId })` الأعمى، لو الموبايل بعت `deviceId` امسح/استبدل أي session قديمة لنفس `(userId, deviceId)` الأول:

```ts
if (deviceId) {
    await UserSessionEntity.destroy({ where: { userId: user.id, deviceId } });
}
const userSession = await UserSessionEntity.create({ userId: user.id, deviceId });
```

> مواضع الـ create الحالية: `src/modules/auth/v1/auth.service.ts` (الأسطر 44, 85, 114) و `src/modules/auth/v1/auth.controller.ts` (124, 173).

---

### خطوة 6 — Cron لتنظيف التوكنات القديمة (موصى به)

أضف مهمة يومية بتـ null التوكنات في الجلسات اللي `updatedAt` بتاعها أقدم من ~30 يوم (تقدر تضيفها جنب الكرون الموجود في `src/workers/notification/notification.cron.ts`):

```ts
await UserSessionEntity.update(
    { fcmToken: null },
    { where: { fcmToken: { [Op.ne]: null }, updatedAt: { [Op.lt]: thirtyDaysAgo } } }
);
```

---

## مش محتاج تعديل

- `getUserFcmTokens` و `sendFcmToUser` في `src/utils/fcm.utils.ts` — بمجرد ما يبقى توكن واحد لكل جهاز، الـ fan-out هيبعت نسخة واحدة بس تلقائياً (هو أصلاً بيعمل dedup بقيمة التوكن).
- `notifyAdminsAndTrainers` — بيبعت إشعار واحد لكل أدمن وده صح.

## ترتيب التنفيذ

1. **خطوة 0** (SQL تنظيف) فوراً على البرودكشن لإيقاف التكرار.
2. خطوات 1→4 (الحل الدائم) + الموبايل بالتوازي.
3. خطوات 5 و6 كتحسين لمنع تكرار المشكلة مستقبلاً.

## ملف مرجعي

تفاصيل تقنية أعمق عن نظام FCM موجودة في `docs/FCM-INVESTIGATION.md`.
