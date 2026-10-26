# تاون كلينك – نظام حجز زيارات الأطباء

- **صفحة المرضى**: `https://<USER>.github.io/<REPO>/`
- **لوحة التحكم** (رابط منفصل، مش ظاهر في صفحة المرضى، وبتتثبت كتطبيق): `https://<USER>.github.io/<REPO>/admin/`

## المكونات
| الجزء | المكان |
|---|---|
| صفحة المرضى | `public/index.html` + `public/js/public.js` |
| لوحة التحكم (PWA) | `public/admin/` + `public/js/admin.js` |
| الإعدادات (Firebase) | `public/js/config.js` ← الملف الوحيد اللي بيتعدل |
| قواعد الأمان | `firestore.rules` |
| إشعارات الحجوزات | `functions/index.js` (Cloud Function) |
| النشر التلقائي | `.github/workflows/` |

## خطوات التشغيل لأول مرة

### 1) Firebase
1. ادخل [console.firebase.google.com](https://console.firebase.google.com) ← **Add project** (مثلاً `townclinic`).
2. **Build ← Firestore Database ← Create database** ← Production mode ← المكان **eur3 (europe-west)**.
3. **Build ← Authentication ← Get started ← Sign-in method ← Email/Password ← Enable**.
   (تسجيل الدخول في اللوحة برقم الموبايل وكلمة السر؛ الرقم بيتحول داخليًا لـ `رقم@townclinic.app`.)
4. **Project settings ← General ← Your apps ← Web (</>)** ← سجّل التطبيق وانسخ `firebaseConfig`.
5. **Project settings ← Cloud Messaging ← Web Push certificates ← Generate key pair** ← انسخ المفتاح (VAPID).
6. حط القيم في `public/js/config.js`.
7. **Firestore ← Rules**: الصق محتوى `firestore.rules` ودوس Publish (أو سيبه للـ workflow تحت).

### 2) GitHub Pages
- **Settings ← Pages ← Source: GitHub Actions**. أي push على `main` بينشر الموقع أوتوماتيك.

### 3) أول دخول للوحة التحكم
افتح `/admin/` ← **أول تشغيل؟ إنشاء حساب المالك** ← اكتب كلمة سر.
الرقم ثابت `01062540279` (لتغييره: عدّل `ownerPhone` في config.js و`OWNER_EMAIL` في firestore.rules).
البيانات الأولية (الأطباء والزيارات) بتتحمل أوتوماتيك. بعدها من **الإعدادات** ضيف حسابات الموظفين.

### 4) تثبيت اللوحة كتطبيق على الموبايل
- **أندرويد (Chrome)**: افتح رابط `/admin/` ← القائمة ⋮ ← **تثبيت التطبيق**.
- **آيفون (Safari)**: زرار المشاركة ← **إضافة إلى الشاشة الرئيسية**، وبعدين افتح التطبيق من الأيقونة وفعّل الإشعارات من جواه.

### 5) الإشعارات
- **من غير أي إعداد إضافي**: تنبيه بصوت وإشعار مع كل حجز طول ما التطبيق مفتوح أو في الخلفية.
- **إشعار حتى والتطبيق مقفول**: محتاج Cloud Function، ودي محتاجة ترقية المشروع لخطة **Blaze** (بالدفع حسب الاستخدام، وعيادة بحجمكم غالبًا هتفضل في الحد المجاني، بس لازم كارت).
  بعد الترقية ضيف في GitHub ← Settings ← Secrets and variables ← Actions:
  - Secret `FIREBASE_SERVICE_ACCOUNT`: من Firebase ← Project settings ← Service accounts ← Generate new private key (الصق محتوى الملف كله)
  - Variable `FIREBASE_PROJECT_ID`
  - Variable `ADMIN_URL` = `https://<USER>.github.io/<REPO>/admin/`
  - Variable `ENABLE_FUNCTIONS` = `true`
  وبعدين Actions ← **Deploy Firebase** ← Run workflow.

## ملاحظات
- صور التحويلات وصور الأطباء بتتضغط وتتحفظ جوه Firestore (مش Storage) علشان تشتغل على الخطة المجانية.
- المرضى ما يقدروش يقروا أي حجز؛ يقدروا بس يضيفوا حجز جديد بحالة «جديد». القواعد بتتأكد من صحة رقم الموبايل وطول البيانات.
- نسب الأطباء وتكلفة التحاليل محفوظة في `private/main` ومش بتظهر للمرضى.
