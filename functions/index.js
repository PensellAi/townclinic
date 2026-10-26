// إشعارات فورية للوحة التحكم مع كل حجز أو طلب انتظار جديد (Firebase Cloud Messaging)
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const { defineString } = require("firebase-functions/params");
const admin = require("firebase-admin");

admin.initializeApp();
// لازم المنطقة تكون نفس مكان قاعدة البيانات (eur3 => europe-west1)
setGlobalOptions({ region: "europe-west1", maxInstances: 5 });
const ADMIN_URL = defineString("ADMIN_URL", { default: "" });

const db = admin.firestore();
const MO = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const short = (iso) => { const a = String(iso || "").split("-").map(Number); return a[2] ? `${a[2]} ${MO[a[1] - 1]}` : ""; };

async function lookup(visitId, doctorId) {
  const cat = (await db.doc("catalog/main").get()).data() || {};
  const v = (cat.visits || []).find((x) => x.id === visitId);
  const d = (cat.doctors || []).find((x) => x.id === (doctorId || (v && v.doctorId)));
  return { v, d };
}

async function notifyAll(title, body, tag) {
  const snap = await db.collection("tokens").get();
  const tokens = snap.docs.map((d) => d.id);
  if (!tokens.length) return;
  const link = ADMIN_URL.value();
  const res = await admin.messaging().sendEachForMulticast({
    tokens,
    webpush: {
      headers: { Urgency: "high", TTL: "86400" },
      notification: { title, body, tag, lang: "ar", dir: "rtl", icon: link ? link + "icons/icon-192.png" : undefined, badge: link ? link + "icons/badge-72.png" : undefined, renotify: true },
      fcmOptions: link ? { link } : undefined
    }
  });
  // تنظيف الأجهزة اللي اتشالت أو الإشعارات اتقفلت عليها
  const dead = [];
  res.responses.forEach((r, i) => {
    const c = r.error && r.error.code;
    if (c === "messaging/registration-token-not-registered" || c === "messaging/invalid-registration-token" || c === "messaging/invalid-argument") dead.push(tokens[i]);
  });
  await Promise.all(dead.map((t) => db.doc("tokens/" + t).delete().catch(() => {})));
}

exports.onNewBooking = onDocumentCreated("bookings/{id}", async (event) => {
  const b = event.data && event.data.data();
  if (!b || b.source === "manual") return;
  const { v, d } = await lookup(b.visitId, b.doctorId);
  const where = v ? `${v.center || v.gov} ${short(v.date)}` : "";
  await notifyAll("حجز جديد", `${b.name} – ${d ? d.name : ""} – ${where}${b.pay === "vf" ? " – فودافون كاش" : ""}`, "b_" + event.params.id);
});

exports.onNewWaitlist = onDocumentCreated("waitlist/{id}", async (event) => {
  const w = event.data && event.data.data();
  if (!w) return;
  const { d } = await lookup(null, w.doctorId);
  await notifyAll("طلب انتظار زيارة", `${w.name} – ${d ? d.name : ""} – ${w.center || w.gov}`, "w_" + event.params.id);
});
