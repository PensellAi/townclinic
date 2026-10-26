/* إعدادات تاون كلينك — الملف الوحيد اللي محتاج يتعدل بعد إنشاء مشروع Firebase.
   بيتحمل في صفحة المرضى ولوحة التحكم وفي الـ service worker. */
self.TC_CONFIG = {
  firebase: {
    apiKey: "PASTE_API_KEY",
    authDomain: "PASTE_PROJECT_ID.firebaseapp.com",
    projectId: "PASTE_PROJECT_ID",
    storageBucket: "PASTE_PROJECT_ID.appspot.com",
    messagingSenderId: "PASTE_SENDER_ID",
    appId: "PASTE_APP_ID"
  },
  // Firebase Console > Project settings > Cloud Messaging > Web Push certificates > Key pair
  vapidKey: "PASTE_VAPID_KEY",
  // رقم موبايل المالك: الرقم الوحيد اللي يقدر ينشئ أول حساب في لوحة التحكم (لازم يطابق firestore.rules)
  ownerPhone: "01062540279",
  // دومين وهمي بيتحول له رقم الموبايل علشان تسجيل الدخول برقم + باسورد
  loginDomain: "townclinic.app"
};
