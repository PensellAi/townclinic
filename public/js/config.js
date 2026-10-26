/* إعدادات تاون كلينك — الملف الوحيد اللي محتاج يتعدل بعد إنشاء مشروع Firebase.
   بيتحمل في صفحة المرضى ولوحة التحكم وفي الـ service worker. */
self.TC_CONFIG = {
  firebase: {
    apiKey: "AIzaSyA4bzsy5xOqJuRBkMQncRYBTnaDqENbDfc",
    authDomain: "townclinic.firebaseapp.com",
    projectId: "townclinic",
    storageBucket: "townclinic.firebasestorage.app",
    messagingSenderId: "313164094483",
    appId: "1:313164094483:web:89fde4963ceda7e2f6f3e6"
  },
  // Firebase Console > Project settings > Cloud Messaging > Web Push certificates > Key pair
  vapidKey: "BPTWzEy5kOHxVFEgpNNMZFwjoHu1ppXHy5pzD1kII0rvTfBNa9j5n12HcjftkZRAOnqGk_GA4mR9f0iChh-PLUA",
  // رابط Google Apps Script (Deploy > Web app) اللي بيبعت إشعار لحظة الحجز – ملف apps-script/Code.gs
  notifyUrl: "https://script.google.com/macros/s/AKfycbx5knt7HSjsz2CmIlWQsZCA8E_n7diRL4I-SzGHJ_xx7HPeTFvb3xS87vQQUmRruP9S/exec",
  // رقم موبايل المالك: الرقم الوحيد اللي يقدر ينشئ أول حساب في لوحة التحكم (لازم يطابق firestore.rules)
  ownerPhone: "01062540279",
  // دومين وهمي بيتحول له رقم الموبايل علشان تسجيل الدخول برقم + باسورد
  loginDomain: "townclinic.app"
};
