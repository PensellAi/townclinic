/* Service worker للوحة التحكم: تثبيت كتطبيق + استقبال إشعارات الحجوزات (FCM) */
importScripts("../js/config.js");
const CFG = self.TC_CONFIG || {};
const READY = CFG.firebase && CFG.firebase.apiKey && !String(CFG.firebase.apiKey).startsWith("PASTE");

if (READY) {
  importScripts(
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js"
  );
  firebase.initializeApp(CFG.firebase);
  // الإشعار نفسه بيتعرض أوتوماتيك من payload الـ webpush.notification اللي بتبعته الـ Cloud Function
  firebase.messaging();
}

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {}); // الشبكة مباشرة؛ مفيش كاش علشان البيانات تفضل حية

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL("./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
    for (const c of cs) if (c.url.startsWith(url) && "focus" in c) return c.focus();
    return self.clients.openWindow(url);
  }));
});
