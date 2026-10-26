// لوحة تحكم تاون كلينك (تطبيق PWA): تسجيل دخول برقم الموبايل، حجوزات لحظية، مصاريف، فواتير، تقارير، إشعارات
import { app, db, configured, CFG, phoneToEmail } from "./firebase.js";
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, onSnapshot, query, orderBy, limit, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getMessaging, getToken, isSupported } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";
import { $, $$, esc, uid, code, today, dp, dlong, dshort, money, fmtTime, normPhone, validPhone, waLink, place, IC, BASE, ST, EXP_CATS, SVC_EXP_CATS, geoOptions, centerOptions, bindGeo, photoHTML, toast, copyText, modal, closeModal, onModalClose, isModalOpen, compressImage, confirmInline, tsMillis, tsDay, tsText } from "./util.js";
import { SEED_CATALOG, SEED_PRIVATE } from "./seed.js";

const auth = app ? getAuth(app) : null;
const S = {
  user: null, me: null, cat: null, priv: null, photos: {}, bookings: [], expenses: [], svcExpenses: [], waitlist: [], invoices: [], admins: [],
  tab: lsGet("tc-tab") || "bookings", bFilter: { visit: "all", st: "open", q: "" }, rep: { mode: "month", val: today().slice(0, 7) },
  unsub: [], online: navigator.onLine, pending: false, loginMode: "login", setupDone: true, fresh: {}
};
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} }

/* ---------- helpers ---------- */
const CAT = () => S.cat || { settings: {}, doctors: [], visits: [], services: [] };
const PRIV = () => S.priv || SEED_PRIVATE;
const docById = (id) => (CAT().doctors || []).find((d) => d.id === id) || { name: "—", specialty: "" };
const visitById = (id) => (CAT().visits || []).find((v) => v.id === id);
const photo = (d, cls) => photoHTML(d, cls, S.photos);
const isOwner = () => S.me && S.me.role === "owner";
function upcoming() { const t = today(); return (CAT().visits || []).filter((v) => v.date >= t && v.status !== "hidden").sort((a, b) => a.date.localeCompare(b.date)); }
const bTotal = (b) => Number(b.fee || 0) + (b.services || []).reduce((a, s) => a + Number(s.price || 0), 0);
function shareOf(docId) { const s = (PRIV().shares || {})[docId]; return s === undefined || s === null || s === "" ? Number(PRIV().defaultShare ?? 50) : Number(s); }
const costOf = (svcId) => Number((PRIV().costs || {})[svcId] || 0);
function visitLabel(v) { if (!v) return "زيارة محذوفة"; return `${docById(v.doctorId).name} – ${v.center || v.gov} – ${dshort(v.date)}`; }
function visitStats(v) {
  const live = S.bookings.filter((b) => b.visitId === v.id && b.status !== "cancelled");
  const done = live.filter((b) => b.status === "done");
  const fees = done.reduce((a, b) => a + Number(b.fee || 0), 0);
  const svc = done.reduce((a, b) => a + bTotal(b) - Number(b.fee || 0), 0);
  const exp = S.expenses.filter((e) => e.visitId === v.id).reduce((a, e) => a + Number(e.amount || 0), 0);
  const pct = shareOf(v.doctorId), share = Math.round((fees * pct) / 100);
  return { all: live.length, count: done.length, fees, svc, exp, pct, share, profit: fees - share - exp };
}
const ref = (k, id) => doc(db, k, id);
const fail = (e) => toast("ما اتحفظش: " + ((e && e.code) || "مشكلة في الاتصال"));
async function saveCat(msg) { try { await setDoc(ref("catalog", "main"), S.cat); toast(msg || "اتحفظ ✓ وظهر للمرضى"); } catch (e) { fail(e); } }
async function savePriv(msg) { try { await setDoc(ref("private", "main"), S.priv); if (msg) toast(msg); } catch (e) { fail(e); } }

/* ---------- notifications ---------- */
let audioCtx = null;
document.addEventListener("pointerdown", () => { try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }, { once: true });
function chime() { try { if (!audioCtx) return; const t = audioCtx.currentTime; [880, 1320].forEach((f, i) => { const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.frequency.value = f; o.connect(g); g.connect(audioCtx.destination); g.gain.setValueAtTime(0.0001, t + i * 0.18); g.gain.exponentialRampToValueAtTime(0.25, t + i * 0.18 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.18 + 0.35); o.start(t + i * 0.18); o.stop(t + i * 0.18 + 0.4); }); } catch (e) {} }
async function alertNew(title, body, tag) {
  toast(title + " – " + body); chime();
  if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
    try { const reg = await navigator.serviceWorker.getRegistration(); if (reg) reg.showNotification(title, { body, tag, icon: "icons/icon-192.png", badge: "icons/badge-72.png", lang: "ar", dir: "rtl" }); } catch (e) {}
  }
}
async function enablePush(btn) {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return toast("المتصفح ده مش بيدعم الإشعارات. على الآيفون لازم تثبّت التطبيق على الشاشة الرئيسية الأول.");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return toast("الإشعارات متقفلة. افتحها من إعدادات المتصفح للموقع ده.");
  const vapid = CFG.vapidKey && !String(CFG.vapidKey).startsWith("PASTE") ? CFG.vapidKey : "";
  if (!vapid || !(await isSupported().catch(() => false))) { lsSet("tc-push", "local"); toast("الجهاز ده هيستقبل التنبيهات طول ما التطبيق مفتوح بس"); render(); return; }
  try {
    if (btn) btn.disabled = true;
    const reg = await navigator.serviceWorker.ready;
    const token = await getToken(getMessaging(app), { vapidKey: vapid, serviceWorkerRegistration: reg });
    await setDoc(ref("tokens", token), { uid: S.user.uid, name: S.me.name || "", device: navigator.userAgent.slice(0, 160), createdAt: serverTimestamp() });
    lsSet("tc-push", token); toast("تم تفعيل الإشعارات على الجهاز ده ✓"); render();
  } catch (e) { if (btn) btn.disabled = false; toast("ما قدرناش نفعّل الإشعارات: " + ((e && e.code) || e.message || "")); }
}
async function disablePush() { const t = lsGet("tc-push"); if (t && t !== "local") { try { await deleteDoc(ref("tokens", t)); } catch (e) {} } lsSet("tc-push", null); toast("الإشعارات اتقفلت على الجهاز ده"); render(); }

/* ---------- auth ---------- */
function shell(inner, withNav) {
  const hdr = `<header class="top"><div class="wrap"><div class="mark"><img src="${BASE}assets/logo-mark.png" alt=""></div><div class="brandtxt"><b>Town<span>Clinic</span></b><small>${withNav ? `<span class="statusdot${S.online ? "" : " off"}"></span> ${S.online ? "متصل – الحجوزات بتوصل لحظيًا" : "مفيش إنترنت"}` : "لوحة التحكم"}</small></div>${withNav ? `<a class="topbtn" href="../" target="_blank" rel="noopener">صفحة المرضى ↗</a>` : ""}</div></header>`;
  return hdr + inner;
}
function renderLogin(err) {
  const setup = S.loginMode === "setup";
  $("#app").innerHTML = shell(`<main class="wrap login"><form class="form" id="lf" novalidate><img class="logo" src="${BASE}assets/logo-full.jpg" alt="Town Clinic">
  <h1>${setup ? "أول تشغيل: حساب المالك" : "تسجيل الدخول"}</h1>
  ${setup ? `<p class="muted" style="font-size:14px">الحساب ده هيبقى المالك، وتقدر بعدها تضيف حسابات للموظفين من الإعدادات.</p><div class="f"><label for="lf-name">اسمك</label><input class="in" id="lf-name" autocomplete="name"></div>` : ""}
  <div class="f"><label for="lf-phone">رقم الموبايل</label><input class="in num" style="text-align:right;width:100%" id="lf-phone" inputmode="tel" autocomplete="username" value="${setup ? esc(CFG.ownerPhone || "") : esc(lsGet("tc-last-phone") || "")}" ${setup ? "readonly" : ""}></div>
  <div class="f"><label for="lf-pw">كلمة السر</label><div class="pw"><input class="in" type="password" id="lf-pw" autocomplete="${setup ? "new-password" : "current-password"}"><button type="button" id="lf-eye">إظهار</button></div></div>
  ${setup ? '<div class="f"><label for="lf-pw2">أكّد كلمة السر</label><input class="in" type="password" id="lf-pw2" autocomplete="new-password"></div>' : ""}
  <p class="err" id="lf-err" role="alert">${esc(err || "")}</p>
  <button class="btn" type="submit" style="justify-content:center">${setup ? "إنشاء الحساب والدخول" : "دخول"}</button>
  ${!S.setupDone ? `<button class="btn ghost" type="button" id="lf-mode" style="justify-content:center">${setup ? "رجوع لتسجيل الدخول" : "أول تشغيل؟ إنشاء حساب المالك"}</button>` : ""}
  </form></main>`, false);
  $("#lf-eye").onclick = () => { const i = $("#lf-pw"); i.type = i.type === "password" ? "text" : "password"; $("#lf-eye").textContent = i.type === "password" ? "إظهار" : "إخفاء"; };
  const mb = $("#lf-mode"); if (mb) mb.onclick = () => { S.loginMode = setup ? "login" : "setup"; renderLogin(); };
  $("#lf").onsubmit = async (e) => {
    e.preventDefault(); const er = $("#lf-err"), btn = $("#lf button[type=submit]");
    const phone = normPhone($("#lf-phone").value), pw = $("#lf-pw").value;
    if (!validPhone(phone)) return (er.textContent = "اكتب رقم موبايل صحيح (11 رقم)");
    if (pw.length < 6) return (er.textContent = "كلمة السر لازم تكون 6 حروف أو أرقام على الأقل");
    btn.disabled = true; er.textContent = "";
    try {
      if (setup) {
        if (pw !== $("#lf-pw2").value) { btn.disabled = false; return (er.textContent = "كلمتين السر مش زي بعض"); }
        S.pendingName = $("#lf-name").value.trim() || "المالك";
        await createUserWithEmailAndPassword(auth, phoneToEmail(phone), pw);
      } else {
        await signInWithEmailAndPassword(auth, phoneToEmail(phone), pw);
      }
      lsSet("tc-last-phone", phone);
    } catch (err) {
      btn.disabled = false;
      const c = err && err.code || "";
      er.textContent = c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found") ? "الرقم أو كلمة السر غلط"
        : c.includes("email-already-in-use") ? "الحساب ده موجود قبل كده، سجّل دخول عادي"
        : c.includes("too-many-requests") ? "محاولات كتير. استنى شوية وجرّب تاني"
        : c.includes("operation-not-allowed") ? "لازم تفعّل Email/Password في Firebase Authentication" : "حصلت مشكلة: " + c;
    }
  };
}
async function bootstrap(u) {
  const phone = u.email.split("@")[0];
  const b = writeBatch(db);
  b.set(ref("admins", u.uid), { name: S.pendingName || "المالك", phone, role: "owner", createdAt: serverTimestamp() });
  b.set(ref("meta", "setup"), { by: u.uid, at: serverTimestamp() });
  await b.commit();
  const c = await getDoc(ref("catalog", "main")); if (!c.exists()) await setDoc(ref("catalog", "main"), SEED_CATALOG);
  const p = await getDoc(ref("private", "main")); if (!p.exists()) await setDoc(ref("private", "main"), SEED_PRIVATE);
}
function teardown() { S.unsub.forEach((f) => { try { f(); } catch (e) {} }); S.unsub = []; S.me = null; S.cat = null; S.priv = null; S.bookings = []; S.expenses = []; S.svcExpenses = []; S.waitlist = []; S.invoices = []; S.admins = []; }

function listen() {
  const sub = (f) => S.unsub.push(f);
  sub(onSnapshot(ref("catalog", "main"), (s) => { S.cat = s.exists() ? Object.assign({ settings: {}, doctors: [], visits: [], services: [] }, s.data()) : null; rr(); }, () => {}));
  sub(onSnapshot(ref("private", "main"), (s) => { S.priv = s.exists() ? Object.assign({ shares: {}, costs: {}, defaultShare: 50 }, s.data()) : null; rr(); }, () => {}));
  sub(onSnapshot(collection(db, "photos"), (q) => { q.forEach((d) => { S.photos[d.id] = d.data().img; }); rr(); }, () => {}));
  let firstB = true;
  sub(onSnapshot(query(collection(db, "bookings"), orderBy("createdAt", "desc"), limit(5000)), (q) => {
    S.bookings = q.docs.map((d) => Object.assign({ id: d.id }, d.data()));
    if (!firstB) q.docChanges().forEach((ch) => {
      if (ch.type === "added" && !ch.doc.metadata.hasPendingWrites) { const b = ch.doc.data(); if (b.source === "manual") return; const v = visitById(b.visitId); S.fresh[ch.doc.id] = 1; alertNew("حجز جديد", `${b.name} – ${docById(b.doctorId).name} – ${v ? (v.center || v.gov) + " " + dshort(v.date) : ""}`, "b_" + ch.doc.id); }
    });
    firstB = false; rr();
  }, (e) => toast("مشكلة في تحميل الحجوزات: " + (e.code || ""))));
  let firstW = true;
  sub(onSnapshot(collection(db, "waitlist"), (q) => {
    S.waitlist = q.docs.map((d) => Object.assign({ id: d.id }, d.data()));
    if (!firstW) q.docChanges().forEach((ch) => { if (ch.type === "added" && !ch.doc.metadata.hasPendingWrites) { const w = ch.doc.data(); alertNew("طلب انتظار زيارة", `${w.name} – ${docById(w.doctorId).name} – ${w.center || w.gov}`, "w_" + ch.doc.id); } });
    firstW = false; rr();
  }, () => {}));
  ["expenses", "svcExpenses", "invoices", "admins"].forEach((k) => sub(onSnapshot(collection(db, k), (q) => { S[k] = q.docs.map((d) => Object.assign({ id: d.id }, d.data())); rr(); }, () => {})));
}
let rrT;
const typing = () => { const a = document.activeElement; return a && a.id !== "bq" && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.closest("#app"); };
function rr() { clearTimeout(rrT); rrT = setTimeout(() => { if (isModalOpen() || typing()) S.pending = true; else render(); }, 50); }
document.addEventListener("focusout", () => setTimeout(() => { if (S.pending && !isModalOpen() && !typing()) { S.pending = false; render(); } }, 150));
onModalClose(() => { if (S.pending) { S.pending = false; render(); } });
addEventListener("online", () => { S.online = true; rr(); });
addEventListener("offline", () => { S.online = false; rr(); });

/* ---------- main render ---------- */
const TABS = [["bookings", "الحجوزات"], ["visits", "الزيارات"], ["doctors", "الأطباء"], ["waitlist", "انتظار زيارة"], ["expenses", "مصاريف الزيارات"], ["services", "الخدمات والتحاليل"], ["svcexp", "مصاريف الخدمات"], ["invoices", "فواتير الأطباء"], ["reports", "التقارير"], ["settings", "الإعدادات"]];
function render() {
  if (!S.me) return;
  const nb = S.bookings.filter((b) => b.status === "new").length, nw = S.waitlist.filter((w) => w.status === "waiting").length;
  let h = '<main><div class="wrap">';
  if (!S.cat) h += `<div class="banner" style="margin-top:12px"><span>مفيش بيانات أطباء وزيارات لسه.</span>${isOwner() ? '<button class="btn sm" id="seed">تحميل البيانات الأولية</button>' : ""}</div>`;
  const push = lsGet("tc-push");
  if (!push && "Notification" in window && Notification.permission !== "denied") h += `<div class="banner" style="margin-top:12px"><span>${IC.bell} فعّل الإشعارات علشان يوصلك كل حجز جديد على الجهاز ده.</span><button class="btn sm" id="pushnow">تفعيل الإشعارات</button></div>`;
  h += `<nav class="tabs" role="tablist">${TABS.map(([k, t]) => { const c = k === "bookings" ? nb : k === "waitlist" ? nw : 0; return `<button class="tab" role="tab" data-tab="${k}" aria-selected="${S.tab === k}">${t}${c ? `<span class="badge num">${c}</span>` : ""}</button>`; }).join("")}</nav><section class="panel">`;
  h += ({ bookings: tBookings, visits: tVisits, doctors: tDoctors, waitlist: tWait, expenses: tExp, services: tSvc, svcexp: tSvcExp, invoices: tInv, reports: tRep, settings: tSet }[S.tab] || tBookings)();
  $("#app").innerHTML = shell(h + "</section></div></main>", true);
  bind();
  S.fresh = {};
}
function visitSelect(id, sel, withAll) {
  const vs = (CAT().visits || []).slice().sort((a, b) => b.date.localeCompare(a.date));
  return `<select class="in" id="${id}">${withAll ? '<option value="all">كل الزيارات</option>' : ""}${vs.map((v) => `<option value="${esc(v.id)}"${v.id === sel ? " selected" : ""}>${esc(visitLabel(v))}</option>`).join("")}</select>`;
}

/* ---------- tabs ---------- */
function tBookings() {
  const f = S.bFilter, q = f.q.trim();
  const list = S.bookings.filter((b) => (f.visit === "all" || b.visitId === f.visit) && (f.st === "all" || (f.st === "open" ? b.status === "new" || b.status === "confirmed" : b.status === f.st)) && (!q || (b.name || "").includes(q) || (b.phone || "").includes(q) || (b.code || "").includes(q.toUpperCase())));
  let h = `<div class="bar"><button class="btn" id="manual">+ حجز يدوي</button><input class="in" id="bq" placeholder="بحث بالاسم أو الرقم أو رقم الحجز" value="${esc(f.q)}"></div>`;
  h += `<div class="bar">${visitSelect("bf-v", f.visit, true)}</div><div class="filters" style="padding-block:0">${[["open", "المفتوحة"], ["new", "جديد"], ["confirmed", "مؤكد"], ["done", "تم"], ["cancelled", "ملغي"], ["all", "الكل"]].map(([k, t]) => `<button class="chip" data-st="${k}" aria-pressed="${f.st === k}">${t}</button>`).join("")}</div>`;
  if (!list.length) h += '<div class="empty">مفيش حجوزات هنا. أي حجز المريض يعمله من الموقع بيظهر هنا لحظيًا.</div>';
  h += '<div class="list">' + list.map((b) => {
    const v = visitById(b.visitId);
    return `<div class="item${S.fresh[b.id] ? " newflash" : ""}" data-bid="${esc(b.id)}"><div class="item-h"><div><b>${esc(b.name)}</b> <span class="pill st-${esc(b.status)}">${ST[b.status] || ""}</span><div class="kv"><span class="num">${esc(b.phone)}</span><span class="num">${esc(b.code || "")}</span><span>${esc(tsText(b.createdAt))}</span>${b.source === "manual" ? "<span>يدوي</span>" : ""}</div></div>
    <div class="bar"><a class="btn wa sm" target="_blank" rel="noopener" href="${waLink(b.phone)}" aria-label="واتساب">${IC.wa}</a><button class="btn ghost sm" data-cp="${esc(b.phone)}" aria-label="نسخ الرقم">${IC.copy}</button></div></div>
    <div class="kv"><span>الزيارة: <b>${esc(visitLabel(v))}</b></span><span>الدفع: <b>${b.pay === "vf" ? "فودافون كاش" : "في العيادة"}</b></span>${(b.services || []).length ? `<span>خدمات: <b>${esc(b.services.map((s) => s.name).join("، "))}</b></span>` : ""}<span>الإجمالي: <b class="num">${money(bTotal(b))}</b></span></div>
    ${b.note ? `<div class="pnote"><b>ملاحظة المريض:</b> ${esc(b.note)}</div>` : ""}
    <div class="bar"><label class="muted" style="font-size:13px" for="fee-${esc(b.id)}">سعر الكشف</label><input class="in num" style="max-width:110px;flex:0 1 110px" type="number" min="0" id="fee-${esc(b.id)}" data-fee="${esc(b.id)}" value="${esc(b.fee || 0)}">
    ${b.pay === "vf" ? (b.hasReceipt ? `<button class="btn ghost sm" data-rcv="${esc(b.id)}">صورة التحويل</button>` : `<label class="btn ghost sm" style="cursor:pointer">إرفاق صورة التحويل<input type="file" accept="image/*" class="sr" data-rc="${esc(b.id)}"></label>`) : ""}</div>
    <div class="stbtns">${Object.keys(ST).map((k) => `<button class="stbtn pill st-${k}" data-set="${k}" aria-pressed="${b.status === k}">${ST[k]}</button>`).join("")}<button class="stbtn" data-del="1" style="color:var(--bad)">حذف</button></div></div>`;
  }).join("") + "</div>";
  return h;
}
function tVisits() {
  const vs = (CAT().visits || []).slice().sort((a, b) => b.date.localeCompare(a.date)), t = today();
  return '<p class="muted" style="font-size:14px">أي زيارة تضيفها أو تعدّلها بتظهر للمرضى على الموقع فورًا.</p><div class="bar"><button class="btn" id="addv">+ زيارة جديدة</button></div><div class="list">' + vs.map((v) => {
    const st = visitStats(v), d = docById(v.doctorId);
    const tag = v.status === "hidden" ? ["st-cancelled", "مخفية"] : v.date >= t ? ["st-new", "قادمة"] : ["st-done", "انتهت"];
    return `<div class="item"><div class="item-h"><div class="doc">${photo(d)}<div><b>${esc(d.name)}</b><div class="kv"><span>${esc(dlong(v.date))}</span><span>${esc(place(v))}</span>${v.time ? `<span>${esc(fmtTime(v.time))}</span>` : ""}</div></div></div><span class="pill ${tag[0]}">${tag[1]}</span></div>
    <div class="kv"><span>الحجوزات: <b class="num">${st.all}</b></span><span>تم الكشف: <b class="num">${st.count}</b></span><span>سعر الكشف: <b>${v.fee ? money(v.fee) : "غير محدد"}</b></span><span>ربح الزيارة: <b class="num">${money(st.profit)}</b></span></div>
    <div class="bar"><button class="btn ghost sm" data-ev="${esc(v.id)}">تعديل</button><button class="btn danger sm" data-dv="${esc(v.id)}">حذف</button></div></div>`;
  }).join("") + "</div>";
}
function tDoctors() {
  return '<div class="bar"><button class="btn" id="addd">+ دكتور جديد</button></div><div class="list">' + (CAT().doctors || []).map((d) => {
    const n = (CAT().visits || []).filter((v) => v.doctorId === d.id).length;
    return `<div class="item"><div class="item-h"><div class="doc">${photo(d)}<div><b>${esc(d.name)}</b><p class="spec">${esc(d.specialty)}</p></div></div><span class="pill st-new">نسبته ${shareOf(d.id)}٪</span></div><div class="kv"><span>عدد الزيارات: <b class="num">${n}</b></span>${d.video ? "<span>فيديو ✓</span>" : ""}${(d.gallery || []).length ? `<span>صور: <b class="num">${d.gallery.length}</b></span>` : ""}</div><div class="bar"><button class="btn ghost sm" data-ed="${esc(d.id)}">تعديل</button><button class="btn danger sm" data-dd="${esc(d.id)}">حذف</button></div></div>`;
  }).join("") + "</div>";
}
function tWait() {
  const ws = S.waitlist.slice().sort((a, b) => tsMillis(b.createdAt) - tsMillis(a.createdAt));
  let h = '<p class="muted" style="font-size:14px">مرضى طلبوا يعرفوا ميعاد زيارة دكتور في بلدهم. أول ما ترفع زيارة في نفس المحافظة، زرار «إبلاغ» يفتح واتساب برسالة جاهزة.</p>';
  if (!ws.length) h += '<div class="empty">مفيش طلبات انتظار.</div>';
  return h + '<div class="list">' + ws.map((w) => {
    const d = docById(w.doctorId), nx = upcoming().find((v) => v.doctorId === w.doctorId && v.gov === w.gov);
    const txt = nx ? `أهلاً ${w.name}، ${d.name} هيكون في ${place(nx)} يوم ${dlong(nx.date)}${nx.time ? " الساعة " + fmtTime(nx.time) : ""}. تحب نحجزلك؟ – تاون كلينك` : "";
    return `<div class="item"><div class="item-h"><div><b>${esc(w.name)}</b> <span class="pill ${w.status === "waiting" ? "st-confirmed" : "st-done"}">${w.status === "waiting" ? "منتظر" : "اتبلغ"}</span><div class="kv"><span class="num">${esc(w.phone)}</span><span>${esc(d.name)}</span><span>${esc((w.center ? w.center + "، " : "") + w.gov)}</span><span>${esc(tsText(w.createdAt))}</span></div></div></div>
    ${nx ? `<p class="ok-box" style="padding:8px 10px;font-size:14px">فيه زيارة متاحة: ${esc(visitLabel(nx))}</p>` : ""}
    <div class="bar">${nx ? `<a class="btn wa sm" target="_blank" rel="noopener" data-notified="${esc(w.id)}" href="${waLink(w.phone, txt)}">${IC.wa} إبلاغ</a>` : `<a class="btn ghost sm" target="_blank" rel="noopener" href="${waLink(w.phone)}">${IC.wa} مراسلة</a>`}<button class="btn ghost sm" data-wst="${esc(w.id)}">${w.status === "waiting" ? "تعليم كمُبلَّغ" : "رجوع لمنتظر"}</button><button class="btn danger sm" data-wdel="${esc(w.id)}">حذف</button></div></div>`;
  }).join("") + "</div>";
}
function tExp() {
  let h = `<p class="muted" style="font-size:14px">مصاريف الزيارة نفسها (إيجار، مواصلات، إعلانات…). مصاريف التحاليل والخدمات ليها تبويب لوحدها.</p><form class="form" id="ef"><div class="row2"><div class="f"><label for="ef-v">الزيارة</label>${visitSelect("ef-v", "", false)}</div><div class="f"><label for="ef-c">البند</label><select class="in" id="ef-c">${EXP_CATS.map((c) => `<option>${c}</option>`).join("")}</select></div></div><div class="row2"><div class="f"><label for="ef-a">المبلغ</label><input class="in num" id="ef-a" type="number" min="0" inputmode="decimal"></div><div class="f"><label for="ef-n">ملاحظة</label><input class="in" id="ef-n"></div></div><button class="btn" type="submit" style="justify-self:start">إضافة مصروف</button></form>`;
  const by = {}; S.expenses.forEach((e) => (by[e.visitId] = by[e.visitId] || []).push(e));
  const keys = Object.keys(by).sort((a, b) => ((visitById(b) || {}).date || "").localeCompare((visitById(a) || {}).date || ""));
  if (!keys.length) h += '<div class="empty">مفيش مصاريف زيارات متسجلة لسه.</div>';
  keys.forEach((k) => { const arr = by[k], sum = arr.reduce((a, e) => a + Number(e.amount || 0), 0);
    h += `<div class="item"><div class="item-h"><b>${esc(visitLabel(visitById(k)))}</b><b class="num">${money(sum)}</b></div>${arr.map((e) => `<div class="item-h" style="font-size:14px"><span>${esc(e.cat)}${e.note ? ` – <span class="muted">${esc(e.note)}</span>` : ""}</span><span class="bar"><span class="num">${money(e.amount)}</span><button class="stbtn" data-xdel="${esc(e.id)}" style="color:var(--bad)">حذف</button></span></div>`).join("")}</div>`; });
  return h;
}
function tSvc() {
  const sv = CAT().services || [];
  let h = `<p class="muted" style="font-size:14px">التحاليل والخدمات اللي المريض يقدر يضيفها على الحجز. «سعر المريض» بيظهر في الموقع، و«التكلفة على العيادة» داخلية بتتخصم أوتوماتيك من ربح الخدمات مع كل كشف حالته «تم».</p>
  <form class="form" id="sf"><div class="f"><label for="sf-n">اسم الخدمة / التحليل</label><input class="in" id="sf-n"></div><div class="row2"><div class="f"><label for="sf-p">سعر المريض</label><input class="in num" id="sf-p" type="number" min="0"></div><div class="f"><label for="sf-c">التكلفة على العيادة (اختياري)</label><input class="in num" id="sf-c" type="number" min="0"></div></div><button class="btn" type="submit" style="justify-self:start">إضافة</button></form>`;
  if (!sv.length) h += '<div class="empty">مفيش خدمات مضافة. أضف أول تحليل من الفورم اللي فوق.</div>';
  return h + '<div class="list">' + sv.map((s) => `<div class="item"><div class="item-h"><b>${esc(s.name)}</b><button class="btn danger sm" data-sdel="${esc(s.id)}">حذف</button></div><div class="bar"><label class="muted" style="font-size:13px">سعر المريض</label><input class="in num" style="max-width:110px;flex:0 1 110px" type="number" min="0" data-sp="${esc(s.id)}" value="${esc(s.price)}"><label class="muted" style="font-size:13px">التكلفة</label><input class="in num" style="max-width:110px;flex:0 1 110px" type="number" min="0" data-sc="${esc(s.id)}" value="${esc(costOf(s.id) || "")}"></div></div>`).join("") + "</div>";
}
function svcName(id) { if (!id) return "عام (كل الخدمات)"; const s = (CAT().services || []).find((x) => x.id === id); return s ? s.name : "خدمة محذوفة"; }
function tSvcExp() {
  const sv = CAT().services || [];
  let h = `<p class="muted" style="font-size:14px">مصاريف الخدمات الإضافية منفصلة عن مصاريف الزيارات: حساب المعمل، مستلزمات، نقل عينات… وبتتحسب في «ربح الخدمات» في التقارير.</p>
  <form class="form" id="xf"><div class="row2"><div class="f"><label for="xf-s">الخدمة</label><select class="in" id="xf-s"><option value="">عام (كل الخدمات)</option>${sv.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("")}</select></div><div class="f"><label for="xf-c">البند</label><select class="in" id="xf-c">${SVC_EXP_CATS.map((c) => `<option>${c}</option>`).join("")}</select></div></div>
  <div class="row2"><div class="f"><label for="xf-a">المبلغ</label><input class="in num" id="xf-a" type="number" min="0" inputmode="decimal"></div><div class="f"><label for="xf-d">التاريخ</label><input class="in num" id="xf-d" type="date" value="${today()}"></div></div><div class="f"><label for="xf-n">ملاحظة</label><input class="in" id="xf-n"></div><button class="btn" type="submit" style="justify-self:start">إضافة مصروف خدمات</button></form>`;
  const list = S.svcExpenses.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  if (!list.length) return h + '<div class="empty">مفيش مصاريف خدمات متسجلة لسه.</div>';
  const sum = list.reduce((a, e) => a + Number(e.amount || 0), 0);
  return h + `<div class="item"><div class="item-h"><b>كل مصاريف الخدمات</b><b class="num">${money(sum)}</b></div>${list.map((e) => `<div class="item-h" style="font-size:14px"><span>${esc(dshort(e.date))} – ${esc(svcName(e.serviceId))} – ${esc(e.cat)}${e.note ? ` <span class="muted">(${esc(e.note)})</span>` : ""}</span><span class="bar"><span class="num">${money(e.amount)}</span><button class="stbtn" data-ydel="${esc(e.id)}" style="color:var(--bad)">حذف</button></span></div>`).join("")}</div>`;
}
function invoicedVisitIds() { const ids = {}; S.invoices.forEach((i) => (i.items || []).forEach((it) => { ids[it.visitId] = 1; })); return ids; }
function tInv() {
  const inv = invoicedVisitIds(), t = today();
  let h = '<p class="muted" style="font-size:14px">نسبة الدكتور بتتحسب من إيراد الكشوفات اللي حالتها «تم» (التحاليل مش داخلة). اعمل فاتورة بعد كل زيارة أو وقت ما تحب، ولما تعلّمها «اتدفعت» الحساب بيبدأ من جديد.</p>';
  (CAT().doctors || []).forEach((d) => {
    const vs = (CAT().visits || []).filter((v) => v.doctorId === d.id && !inv[v.id] && v.date <= t).map((v) => ({ v, s: visitStats(v) })).filter((x) => x.s.count > 0);
    const acc = vs.reduce((a, x) => a + x.s.share, 0), unpaid = S.invoices.filter((i) => i.doctorId === d.id && !i.paid).reduce((a, i) => a + Number(i.total || 0), 0);
    h += `<div class="item"><div class="item-h"><div class="doc">${photo(d)}<div><b>${esc(d.name)}</b><div class="kv"><span>نسبته: <b>${shareOf(d.id)}٪</b></span><span>مستحق مش متفوتر: <b class="num">${money(acc)}</b></span><span>فواتير مش مدفوعة: <b class="num">${money(unpaid)}</b></span></div></div></div><button class="btn sm" data-mkinv="${esc(d.id)}"${vs.length ? "" : " disabled"}>إصدار فاتورة</button></div>${vs.length ? `<div class="kv">${vs.map((x) => `<span>${esc((x.v.center || x.v.gov) + " " + dshort(x.v.date))}: <b class="num">${money(x.s.share)}</b></span>`).join("")}</div>` : ""}</div>`;
  });
  const invs = S.invoices.slice().sort((a, b) => tsMillis(b.createdAt) - tsMillis(a.createdAt));
  h += '<h2 class="h">الفواتير</h2>'; if (!invs.length) h += '<div class="empty">مفيش فواتير لسه.</div>';
  return h + '<div class="list">' + invs.map((i) => `<div class="item"><div class="item-h"><div><b>${esc(docById(i.doctorId).name)}</b> <span class="pill ${i.paid ? "st-done" : "st-confirmed"}">${i.paid ? "اتدفعت" : "مستحقة"}</span><div class="kv"><span>اتعملت ${esc(tsDay(i.createdAt))}</span>${i.paid ? `<span>اتدفعت ${esc(tsDay(i.paidAt))}</span>` : ""}</div></div><b class="num" style="font-size:18px">${money(i.total)}</b></div>
  <div class="tbl-w"><table><thead><tr><th>الزيارة</th><th class="n">كشوفات تمت</th><th class="n">إيراد الكشوفات</th><th class="n">النسبة</th><th class="n">المستحق</th></tr></thead><tbody>${(i.items || []).map((it) => `<tr><td>${esc(it.label)}</td><td class="n">${it.count}</td><td class="n">${money(it.fees)}</td><td class="n">${it.pct}٪</td><td class="n">${money(it.amount)}</td></tr>`).join("")}</tbody></table></div>
  <div class="bar">${i.paid ? `<button class="btn ghost sm" data-unpay="${esc(i.id)}">إلغاء علامة الدفع</button>` : `<button class="btn sm" data-pay="${esc(i.id)}">اتدفعت</button>`}<button class="btn danger sm" data-idel="${esc(i.id)}">حذف الفاتورة</button></div></div>`).join("") + "</div>";
}
function inPeriod(date) { const r = S.rep; if (!date) return false; if (r.mode === "day") return date === r.val; if (r.mode === "month") return date.slice(0, 7) === r.val; return date.slice(0, 4) === r.val; }
function tRep() {
  const r = S.rep;
  const vs = (CAT().visits || []).filter((v) => inPeriod(v.date)).sort((a, b) => a.date.localeCompare(b.date));
  const rows = vs.map((v) => ({ v, s: visitStats(v) }));
  const V = { count: 0, fees: 0, share: 0, exp: 0, profit: 0 }; rows.forEach((x) => { for (const k in V) V[k] += x.s[k]; });
  // الخدمات: من الكشوفات اللي تمت في زيارات الفترة
  const inV = {}; vs.forEach((v) => (inV[v.id] = 1));
  const svc = {}; const addS = (id, name) => (svc[id] = svc[id] || { name, n: 0, rev: 0, cost: 0, exp: 0 });
  S.bookings.filter((b) => b.status === "done" && inV[b.visitId]).forEach((b) => (b.services || []).forEach((s) => { const o = addS(s.id, s.name); o.n++; o.rev += Number(s.price || 0); o.cost += costOf(s.id); }));
  S.svcExpenses.filter((e) => inPeriod(e.date)).forEach((e) => { addS(e.serviceId || "", svcName(e.serviceId)).exp += Number(e.amount || 0); });
  const SV = { n: 0, rev: 0, cost: 0, exp: 0 }; Object.values(svc).forEach((o) => { for (const k in SV) SV[k] += o[k]; });
  const svcProfit = SV.rev - SV.cost - SV.exp, net = V.profit + svcProfit;
  const input = r.mode === "day" ? `<input class="in num" type="date" id="rv" value="${esc(r.val)}">` : r.mode === "month" ? `<input class="in num" type="month" id="rv" value="${esc(r.val)}">` : `<input class="in num" type="number" id="rv" min="2020" max="2100" value="${esc(r.val)}">`;
  let h = `<div class="bar"><div class="filters" style="padding:0">${[["day", "يومي"], ["month", "شهري"], ["year", "سنوي"]].map(([k, t]) => `<button class="chip" data-rm="${k}" aria-pressed="${r.mode === k}">${t}</button>`).join("")}</div>${input}</div>
  <div class="kpis"><div class="kpi main"><small>صافي الربح</small><b class="num">${money(net)}</b><div class="sub">زيارات ${money(V.profit)} + خدمات ${money(svcProfit)}</div></div>
  <div class="kpi"><small>إجمالي الإيراد</small><b class="num">${money(V.fees + SV.rev)}</b><div class="sub">كشوفات ${money(V.fees)} · خدمات ${money(SV.rev)}</div></div>
  <div class="kpi"><small>إجمالي المصاريف</small><b class="num">${money(V.exp + SV.cost + SV.exp)}</b><div class="sub">زيارات ${money(V.exp)} · خدمات ${money(SV.cost + SV.exp)}</div></div>
  <div class="kpi"><small>نسب الأطباء</small><b class="num">${money(V.share)}</b></div>
  <div class="kpi"><small>كشوفات تمت</small><b class="num">${V.count}</b><div class="sub">${SV.n} خدمة/تحليل</div></div></div>`;
  if (!rows.length && !Object.keys(svc).length) return h + '<div class="empty">مفيش بيانات في الفترة دي.</div>';
  if (rows.length) {
    h += `<h2 class="h">الزيارات (الكشوفات فقط)</h2><div class="tbl-w"><table><thead><tr><th>الزيارة</th><th class="n">كشوفات</th><th class="n">إيراد الكشوفات</th><th class="n">نسبة الدكتور</th><th class="n">مصاريف الزيارة</th><th class="n">ربح الزيارة</th></tr></thead><tbody>${rows.map((x) => `<tr><td>${esc(visitLabel(x.v))}</td><td class="n">${x.s.count}</td><td class="n">${money(x.s.fees)}</td><td class="n">${money(x.s.share)}</td><td class="n">${money(x.s.exp)}</td><td class="n ${x.s.profit >= 0 ? "pos" : "neg"}">${money(x.s.profit)}</td></tr>`).join("")}</tbody><tfoot><tr><td>الإجمالي</td><td class="n">${V.count}</td><td class="n">${money(V.fees)}</td><td class="n">${money(V.share)}</td><td class="n">${money(V.exp)}</td><td class="n">${money(V.profit)}</td></tr></tfoot></table></div>`;
  }
  const sk = Object.keys(svc);
  if (sk.length) {
    h += `<h2 class="h">الخدمات والتحاليل</h2><div class="tbl-w"><table><thead><tr><th>الخدمة</th><th class="n">العدد</th><th class="n">الإيراد</th><th class="n">التكلفة</th><th class="n">مصاريف</th><th class="n">الربح</th></tr></thead><tbody>${sk.map((k) => { const o = svc[k], p = o.rev - o.cost - o.exp; return `<tr><td>${esc(o.name)}</td><td class="n">${o.n}</td><td class="n">${money(o.rev)}</td><td class="n">${money(o.cost)}</td><td class="n">${money(o.exp)}</td><td class="n ${p >= 0 ? "pos" : "neg"}">${money(p)}</td></tr>`; }).join("")}</tbody><tfoot><tr><td>الإجمالي</td><td class="n">${SV.n}</td><td class="n">${money(SV.rev)}</td><td class="n">${money(SV.cost)}</td><td class="n">${money(SV.exp)}</td><td class="n">${money(svcProfit)}</td></tr></tfoot></table></div>`;
  }
  if (rows.length) {
    const byC = {}; rows.forEach((x) => { const k = place(x.v); byC[k] = byC[k] || { c: 0, p: 0 }; byC[k].c += x.s.count; byC[k].p += x.s.profit; });
    const ks = Object.keys(byC), mx = Math.max(1, ...ks.map((k) => byC[k].c));
    h += `<h2 class="h">الكشوفات لكل عيادة</h2><div class="item chart">${ks.map((k) => `<div class="r"><span>${esc(k)} <b class="num">${byC[k].c}</b> <span class="muted num" style="font-size:12px">(${money(byC[k].p)} ربح)</span></span><div class="track"><div class="fill" style="width:${(byC[k].c / mx) * 100}%"></div></div></div>`).join("")}</div>`;
  }
  return h;
}
function tSet() {
  const s = CAT().settings || {}, push = lsGet("tc-push");
  let h = `<form class="form" id="setf"><h2 class="h">بيانات التواصل في الموقع</h2><div class="row2"><div class="f"><label for="s-wa">رقم واتساب الحجوزات</label><input class="in num" id="s-wa" value="${esc(s.whatsapp || "")}"></div><div class="f"><label for="s-vf">رقم فودافون كاش</label><input class="in num" id="s-vf" value="${esc(s.vfcash || "")}"></div></div><div class="f"><label for="s-ph">أرقام التواصل (افصل بفاصلة)</label><input class="in num" id="s-ph" value="${esc((s.phones || []).join(", "))}"></div><div class="f"><label for="s-sh">نسبة الدكتور الافتراضية ٪</label><input class="in num" style="max-width:120px" id="s-sh" type="number" min="0" max="100" value="${esc(PRIV().defaultShare ?? 50)}"></div><button class="btn" type="submit" style="justify-self:start">حفظ</button></form>`;
  h += `<div class="form"><h2 class="h">الإشعارات على الجهاز ده</h2><p class="muted" style="font-size:14px">${push ? (push === "local" ? "شغالة طول ما التطبيق مفتوح." : "شغالة: هيوصلك إشعار مع كل حجز حتى لو التطبيق مقفول.") : "مقفولة."} على الآيفون لازم تثبّت التطبيق الأول: من Safari دوس مشاركة ← «إضافة إلى الشاشة الرئيسية».</p><div class="bar">${push ? '<button class="btn ghost" id="pushoff">إيقاف الإشعارات</button><button class="btn ghost" id="pushtest">تجربة صوت التنبيه</button>' : '<button class="btn" id="pushon">تفعيل الإشعارات</button>'}</div></div>`;
  if (isOwner()) {
    h += `<div class="form"><h2 class="h">حسابات الموظفين</h2><div class="list">${S.admins.map((a) => `<div class="item-h"><span><b>${esc(a.name)}</b> <span class="num muted">${esc(a.phone)}</span> <span class="pill ${a.role === "owner" ? "st-done" : "st-new"}">${a.role === "owner" ? "مالك" : "موظف"}</span></span>${a.role !== "owner" ? `<button class="stbtn" data-adel="${esc(a.id)}" style="color:var(--bad)">إيقاف الحساب</button>` : ""}</div>`).join("")}</div>
    <form id="stf" class="opts"><div class="row2"><div class="f"><label for="st-n">اسم الموظف</label><input class="in" id="st-n"></div><div class="f"><label for="st-p">رقم موبايله</label><input class="in num" id="st-p" inputmode="tel"></div></div><div class="f"><label for="st-pw">كلمة سر مبدئية (6 على الأقل)</label><input class="in" id="st-pw" type="text" autocomplete="off"></div><p class="err" id="st-e"></p><button class="btn" type="submit" style="justify-self:start">إضافة موظف</button></form></div>`;
  }
  h += `<form class="form" id="pwf"><h2 class="h">تغيير كلمة السر</h2><div class="row2"><div class="f"><label for="pw-o">كلمة السر الحالية</label><input class="in" type="password" id="pw-o" autocomplete="current-password"></div><div class="f"><label for="pw-n">كلمة السر الجديدة</label><input class="in" type="password" id="pw-n" autocomplete="new-password"></div></div><p class="err" id="pw-e"></p><button class="btn ghost" type="submit" style="justify-self:start">تغيير</button></form>
  <div class="bar"><span class="muted">داخل باسم ${esc(S.me.name || "")} (<span class="num">${esc(S.me.phone || "")}</span>)</span><button class="btn danger" id="logout">تسجيل خروج</button></div>`;
  return h;
}

/* ---------- events ---------- */
function bind() {
  const on = (sel, fn) => { const el = $(sel); if (el) fn(el); };
  $$("[data-tab]").forEach((b) => (b.onclick = () => { S.tab = b.dataset.tab; lsSet("tc-tab", S.tab); render(); scrollTo(0, 0); }));
  on("#seed", (b) => (b.onclick = async () => { await setDoc(ref("catalog", "main"), SEED_CATALOG); if (!S.priv) await setDoc(ref("private", "main"), SEED_PRIVATE); toast("اتحملت ✓"); }));
  on("#pushnow", (b) => (b.onclick = () => enablePush(b)));
  on("#pushon", (b) => (b.onclick = () => enablePush(b)));
  on("#pushoff", (b) => (b.onclick = disablePush));
  on("#pushtest", (b) => (b.onclick = () => alertNew("تجربة", "كده الإشعارات شغالة", "test")));
  // الحجوزات
  on("#bf-v", (el) => (el.onchange = () => { S.bFilter.visit = el.value; render(); }));
  on("#bq", (el) => { el.oninput = () => { S.bFilter.q = el.value; clearTimeout(el._t); el._t = setTimeout(() => { render(); const n = $("#bq"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 300); }; });
  $$("[data-st]").forEach((b) => (b.onclick = () => { S.bFilter.st = b.dataset.st; render(); }));
  $$("[data-cp]").forEach((b) => (b.onclick = () => copyText(b.dataset.cp, b)));
  $$("[data-bid]").forEach((it) => {
    const id = it.dataset.bid;
    $$("[data-set]", it).forEach((b) => (b.onclick = () => updateDoc(ref("bookings", id), { status: b.dataset.set, updatedAt: serverTimestamp() }).catch(fail)));
    const del = $("[data-del]", it); del.onclick = () => confirmInline(del, async () => { try { await deleteDoc(ref("bookings", id)); await deleteDoc(ref("receipts", id)).catch(() => {}); } catch (e) { fail(e); } });
  });
  $$("[data-fee]").forEach((i) => (i.onchange = () => updateDoc(ref("bookings", i.dataset.fee), { fee: Number(i.value || 0) }).then(() => toast("اتحفظ ✓"), fail)));
  $$("[data-rcv]").forEach((b) => (b.onclick = () => showReceipt(b.dataset.rcv)));
  $$("[data-rc]").forEach((i) => (i.onchange = async () => { const f = i.files[0]; if (!f) return; try { toast("جاري الرفع…"); const img = await compressImage(f); await setDoc(ref("receipts", i.dataset.rc), { img, createdAt: serverTimestamp() }); await updateDoc(ref("bookings", i.dataset.rc), { hasReceipt: true }); toast("اترفعت ✓"); } catch (e) { fail(e); } }));
  on("#manual", (b) => (b.onclick = manualBooking));
  // الزيارات والأطباء
  on("#addv", (b) => (b.onclick = () => editVisit(null)));
  $$("[data-ev]").forEach((b) => (b.onclick = () => editVisit(b.dataset.ev)));
  $$("[data-dv]").forEach((b) => (b.onclick = () => { if (S.bookings.some((x) => x.visitId === b.dataset.dv)) return toast("الزيارة دي عليها حجوزات. خليها «مخفية» بدل الحذف"); confirmInline(b, () => { S.cat.visits = S.cat.visits.filter((v) => v.id !== b.dataset.dv); saveCat("اتحذفت"); }); }));
  on("#addd", (b) => (b.onclick = () => editDoctor(null)));
  $$("[data-ed]").forEach((b) => (b.onclick = () => editDoctor(b.dataset.ed)));
  $$("[data-dd]").forEach((b) => (b.onclick = () => { const id = b.dataset.dd; if (S.cat.visits.some((v) => v.doctorId === id)) return toast("احذف زياراته الأول"); confirmInline(b, () => { S.cat.doctors = S.cat.doctors.filter((d) => d.id !== id); saveCat("اتحذف"); }); }));
  // الانتظار
  $$("[data-wst]").forEach((b) => (b.onclick = () => { const w = S.waitlist.find((x) => x.id === b.dataset.wst); updateDoc(ref("waitlist", w.id), { status: w.status === "waiting" ? "notified" : "waiting" }).catch(fail); }));
  $$("[data-notified]").forEach((a) => a.addEventListener("click", () => updateDoc(ref("waitlist", a.dataset.notified), { status: "notified" }).catch(() => {})));
  $$("[data-wdel]").forEach((b) => (b.onclick = () => confirmInline(b, () => deleteDoc(ref("waitlist", b.dataset.wdel)).catch(fail))));
  // مصاريف الزيارات
  on("#ef", (f) => (f.onsubmit = (e) => { e.preventDefault(); const vid = $("#ef-v").value, a = Number($("#ef-a").value); if (!vid) return toast("ضيف زيارة الأول"); if (!(a > 0)) return toast("اكتب المبلغ"); const v = visitById(vid), id = uid("x_"); setDoc(ref("expenses", id), { visitId: vid, cat: $("#ef-c").value, amount: a, note: $("#ef-n").value.trim(), date: v ? v.date : today(), by: S.user.uid, createdAt: serverTimestamp() }).then(() => toast("اتضاف ✓"), fail); }));
  $$("[data-xdel]").forEach((b) => (b.onclick = () => confirmInline(b, () => deleteDoc(ref("expenses", b.dataset.xdel)).catch(fail))));
  // الخدمات
  on("#sf", (f) => (f.onsubmit = async (e) => { e.preventDefault(); const n = $("#sf-n").value.trim(), p = Number($("#sf-p").value), c = Number($("#sf-c").value); if (!n) return toast("اكتب اسم الخدمة"); const id = uid("s_"); S.cat.services = (S.cat.services || []).concat([{ id, name: n, price: p || 0 }]); if (c > 0) { S.priv = S.priv || JSON.parse(JSON.stringify(SEED_PRIVATE)); S.priv.costs = Object.assign({}, S.priv.costs, { [id]: c }); await savePriv(); } saveCat("اتضافت ✓"); }));
  $$("[data-sp]").forEach((i) => (i.onchange = () => { S.cat.services.forEach((s) => { if (s.id === i.dataset.sp) s.price = Number(i.value || 0); }); saveCat(); }));
  $$("[data-sc]").forEach((i) => (i.onchange = () => { S.priv = S.priv || JSON.parse(JSON.stringify(SEED_PRIVATE)); S.priv.costs = Object.assign({}, S.priv.costs, { [i.dataset.sc]: Number(i.value || 0) }); savePriv("اتحفظت التكلفة ✓"); }));
  $$("[data-sdel]").forEach((b) => (b.onclick = () => confirmInline(b, () => { S.cat.services = S.cat.services.filter((s) => s.id !== b.dataset.sdel); saveCat("اتحذفت"); })));
  // مصاريف الخدمات
  on("#xf", (f) => (f.onsubmit = (e) => { e.preventDefault(); const a = Number($("#xf-a").value), d = $("#xf-d").value; if (!(a > 0)) return toast("اكتب المبلغ"); if (!d) return toast("اختار التاريخ"); setDoc(ref("svcExpenses", uid("y_")), { serviceId: $("#xf-s").value, cat: $("#xf-c").value, amount: a, date: d, note: $("#xf-n").value.trim(), by: S.user.uid, createdAt: serverTimestamp() }).then(() => toast("اتضاف ✓"), fail); }));
  $$("[data-ydel]").forEach((b) => (b.onclick = () => confirmInline(b, () => deleteDoc(ref("svcExpenses", b.dataset.ydel)).catch(fail))));
  // الفواتير
  $$("[data-mkinv]").forEach((b) => (b.onclick = () => makeInvoice(b.dataset.mkinv)));
  $$("[data-pay]").forEach((b) => (b.onclick = () => updateDoc(ref("invoices", b.dataset.pay), { paid: true, paidAt: serverTimestamp() }).catch(fail)));
  $$("[data-unpay]").forEach((b) => (b.onclick = () => updateDoc(ref("invoices", b.dataset.unpay), { paid: false, paidAt: null }).catch(fail)));
  $$("[data-idel]").forEach((b) => (b.onclick = () => confirmInline(b, () => deleteDoc(ref("invoices", b.dataset.idel)).catch(fail))));
  // التقارير
  $$("[data-rm]").forEach((b) => (b.onclick = () => { const m = b.dataset.rm, t = today(); S.rep = { mode: m, val: m === "day" ? t : m === "month" ? t.slice(0, 7) : t.slice(0, 4) }; render(); }));
  on("#rv", (el) => (el.onchange = () => { if (el.value) { S.rep.val = String(el.value); render(); } }));
  // الإعدادات
  on("#setf", (f) => (f.onsubmit = async (e) => { e.preventDefault(); S.cat.settings = { whatsapp: normPhone($("#s-wa").value), vfcash: normPhone($("#s-vf").value), phones: $("#s-ph").value.split(/[,،]/).map(normPhone).filter(Boolean) }; S.priv = S.priv || JSON.parse(JSON.stringify(SEED_PRIVATE)); S.priv.defaultShare = Number($("#s-sh").value || 50); await savePriv(); saveCat(); }));
  on("#stf", (f) => (f.onsubmit = addStaff));
  $$("[data-adel]").forEach((b) => (b.onclick = () => confirmInline(b, () => deleteDoc(ref("admins", b.dataset.adel)).then(() => toast("الحساب اتوقف"), fail))));
  on("#pwf", (f) => (f.onsubmit = async (e) => { e.preventDefault(); const er = $("#pw-e"), o = $("#pw-o").value, n = $("#pw-n").value; if (n.length < 6) return (er.textContent = "كلمة السر الجديدة 6 على الأقل"); try { await reauthenticateWithCredential(S.user, EmailAuthProvider.credential(S.user.email, o)); await updatePassword(S.user, n); er.textContent = ""; toast("كلمة السر اتغيرت ✓"); f.reset(); } catch (err) { er.textContent = (err.code || "").includes("credential") ? "كلمة السر الحالية غلط" : "ما اتغيرتش: " + (err.code || ""); } }));
  on("#logout", (b) => (b.onclick = () => signOut(auth)));
}
async function showReceipt(id) {
  modal('<div class="sh-h"><h2>صورة التحويل</h2><button class="x" aria-label="إغلاق">×</button></div><div class="receipt loading">جاري التحميل…</div>', async (ov) => {
    try { const s = await getDoc(ref("receipts", id)); $(".receipt", ov).classList.remove("loading"); $(".receipt", ov).innerHTML = s.exists() ? `<img src="${esc(s.data().img)}" alt="صورة التحويل">` : "مفيش صورة."; } catch (e) { $(".receipt", ov).textContent = "ما قدرناش نحمّل الصورة."; }
  });
}
async function addStaff(e) {
  e.preventDefault(); const er = $("#st-e"), name = $("#st-n").value.trim(), phone = normPhone($("#st-p").value), pw = $("#st-pw").value;
  if (!name) return (er.textContent = "اكتب اسم الموظف"); if (!validPhone(phone)) return (er.textContent = "رقم الموبايل مش صحيح"); if (pw.length < 6) return (er.textContent = "كلمة السر 6 على الأقل");
  const btn = $("#stf button[type=submit]"); btn.disabled = true; er.textContent = "";
  let sec;
  try {
    sec = initializeApp(CFG.firebase, "staff-" + Date.now());
    const cred = await createUserWithEmailAndPassword(getAuth(sec), phoneToEmail(phone), pw);
    await setDoc(ref("admins", cred.user.uid), { name, phone, role: "staff", createdAt: serverTimestamp() });
    toast("الموظف اتضاف ✓ يقدر يدخل برقمه وكلمة السر");
  } catch (err) { btn.disabled = false; er.textContent = (err.code || "").includes("email-already-in-use") ? "الرقم ده عليه حساب قبل كده. لو اتوقف قبل كده، كلّمنا نرجّعه من Firebase Console." : "ما اتضافش: " + (err.code || ""); }
  finally { if (sec) deleteApp(sec).catch(() => {}); }
}
function manualBooking() {
  if (!(CAT().visits || []).length) return toast("ضيف زيارة الأول");
  const sv = CAT().services || [];
  modal(`<div class="sh-h"><h2>حجز يدوي</h2><button class="x" aria-label="إغلاق">×</button></div><form id="mf" class="opts"><div class="f"><label for="mf-v">الزيارة</label>${visitSelect("mf-v", (upcoming()[0] || {}).id, false)}</div><div class="row2"><div class="f"><label for="mf-n">الاسم</label><input class="in" id="mf-n"></div><div class="f"><label for="mf-p">الموبايل</label><input class="in num" id="mf-p" inputmode="tel"></div></div><div class="row2"><div class="f"><label for="mf-pay">الدفع</label><select class="in" id="mf-pay"><option value="clinic">في العيادة</option><option value="vf">فودافون كاش</option></select></div><div class="f"><label for="mf-st">الحالة</label><select class="in" id="mf-st">${Object.keys(ST).map((k) => `<option value="${k}"${k === "confirmed" ? " selected" : ""}>${ST[k]}</option>`).join("")}</select></div></div>${sv.length ? `<div class="svcs">${sv.map((s) => `<label class="svc"><span><input type="checkbox" class="mf-s" value="${esc(s.id)}"> ${esc(s.name)}</span><span class="num">${money(s.price)}</span></label>`).join("")}</div>` : ""}<div class="f"><label for="mf-note">ملاحظة</label><textarea class="in" id="mf-note" maxlength="500"></textarea></div><p class="err" id="mf-e"></p><button class="btn" type="submit">حفظ الحجز</button></form>`, (ov) => {
    $("#mf", ov).onsubmit = async (e) => {
      e.preventDefault(); const n = $("#mf-n", ov).value.trim(), p = normPhone($("#mf-p", ov).value);
      if (n.length < 2) return ($("#mf-e", ov).textContent = "اكتب الاسم"); if (p && !validPhone(p)) return ($("#mf-e", ov).textContent = "رقم الموبايل مش صحيح");
      const v = visitById($("#mf-v", ov).value);
      const services = $$(".mf-s:checked", ov).map((c) => sv.find((s) => s.id === c.value)).filter(Boolean).map((s) => ({ id: s.id, name: s.name, price: Number(s.price || 0) }));
      try { await setDoc(doc(collection(db, "bookings")), { code: code("TC"), visitId: v.id, doctorId: v.doctorId, name: n, phone: p, pay: $("#mf-pay", ov).value, note: $("#mf-note", ov).value.trim(), services, fee: Number(v.fee || 0), status: $("#mf-st", ov).value, source: "manual", hasReceipt: false, by: S.user.uid, createdAt: serverTimestamp() }); closeModal(); toast("اتضاف ✓"); } catch (err) { fail(err); }
    };
  });
}
function editVisit(id) {
  if (!S.cat) return toast("حمّل البيانات الأولية الأول");
  const v = id ? JSON.parse(JSON.stringify(visitById(id))) : { id: uid("v_"), doctorId: (S.cat.doctors[0] || {}).id, gov: "", center: "", date: today(), time: "", fee: 0, note: "", status: "open" };
  modal(`<div class="sh-h"><h2>${id ? "تعديل زيارة" : "زيارة جديدة"}</h2><button class="x" aria-label="إغلاق">×</button></div><form id="vf" class="opts"><div class="f"><label for="vf-d">الدكتور</label><select class="in" id="vf-d">${S.cat.doctors.map((d) => `<option value="${esc(d.id)}"${d.id === v.doctorId ? " selected" : ""}>${esc(d.name)}</option>`).join("")}</select></div>
  <div class="row2"><div class="f"><label for="vf-g">المحافظة</label><select class="in" id="vf-g">${geoOptions(v.gov)}</select></div><div class="f"><label for="vf-c">المركز / البلد</label><select class="in" id="vf-c">${v.gov ? centerOptions(v.gov, v.center, S.cat.visits) : '<option value="">اختار المحافظة</option>'}</select><input class="in" id="vf-c2" placeholder="اكتب اسم المركز" hidden></div></div>
  <div class="row2"><div class="f"><label for="vf-dt">التاريخ</label><input class="in num" type="date" id="vf-dt" value="${esc(v.date)}"></div><div class="f"><label for="vf-t">الساعة (اختياري)</label><input class="in num" type="time" id="vf-t" value="${esc(v.time || "")}"></div></div>
  <div class="row2"><div class="f"><label for="vf-fee">سعر الكشف</label><input class="in num" type="number" min="0" id="vf-fee" value="${esc(v.fee || "")}"></div><div class="f"><label for="vf-st">الظهور</label><select class="in" id="vf-st"><option value="open">ظاهرة للمرضى</option><option value="hidden"${v.status === "hidden" ? " selected" : ""}>مخفية</option></select></div></div>
  <div class="f"><label for="vf-n">ملاحظة للمرضى (اختياري)</label><input class="in" id="vf-n" value="${esc(v.note || "")}" placeholder="مثلاً: العنوان أو الأوراق المطلوبة"></div><button class="btn" type="submit">حفظ</button></form>`, (ov) => {
    bindGeo(ov, "vf-g", "vf-c", "vf-c2", S.cat.visits);
    $("#vf", ov).onsubmit = (e) => {
      e.preventDefault(); let c = $("#vf-c", ov).value; if (c === "__other") c = $("#vf-c2", ov).value.trim(); const g = $("#vf-g", ov).value, dt = $("#vf-dt", ov).value;
      if (!g || !dt) return toast("اختار المحافظة والتاريخ");
      const nv = { id: v.id, doctorId: $("#vf-d", ov).value, gov: g, center: c || g, date: dt, time: $("#vf-t", ov).value, fee: Number($("#vf-fee", ov).value || 0), note: $("#vf-n", ov).value.trim(), status: $("#vf-st", ov).value };
      S.cat.visits = S.cat.visits.filter((x) => x.id !== v.id).concat([nv]); closeModal(); saveCat("اتحفظت ✓ وظهرت للمرضى");
    };
  });
}
function editDoctor(id) {
  if (!S.cat) return toast("حمّل البيانات الأولية الأول");
  const d = id ? JSON.parse(JSON.stringify(docById(id))) : { id: uid("d_"), name: "د. ", title: "", specialty: "", bio: "", photo: "", video: "", gallery: [] };
  const sh = (PRIV().shares || {})[d.id];
  const galSrc = (g) => (g.startsWith("photo:") ? S.photos[g.slice(6)] || "" : BASE + g);
  modal(`<div class="sh-h"><h2>${id ? "تعديل بيانات الدكتور" : "دكتور جديد"}</h2><button class="x" aria-label="إغلاق">×</button></div><form id="df" class="opts"><div class="doc"><span id="df-ph">${photo(d, "ph lg")}</span><label class="btn ghost sm" style="cursor:pointer">تغيير الصورة<input type="file" accept="image/*" class="sr" id="df-file"></label></div>
  <div class="f"><label for="df-n">الاسم</label><input class="in" id="df-n" value="${esc(d.name)}"></div><div class="f"><label for="df-s">التخصص (مختصر)</label><input class="in" id="df-s" value="${esc(d.specialty)}"></div><div class="f"><label for="df-t">المسمى الوظيفي</label><input class="in" id="df-t" value="${esc(d.title)}"></div><div class="f"><label for="df-b">السيرة الذاتية</label><textarea class="in" id="df-b">${esc(d.bio)}</textarea></div>
  <div class="row2"><div class="f"><label for="df-v">رابط فيديو (يوتيوب/فيسبوك)</label><input class="in num" id="df-v" value="${esc(d.video)}" placeholder="https://"></div><div class="f"><label for="df-sh">نسبة الدكتور ٪</label><input class="in num" type="number" min="0" max="100" id="df-sh" value="${esc(sh ?? "")}" placeholder="الافتراضي ${esc(PRIV().defaultShare ?? 50)}"></div></div>
  <div class="f"><span class="lbl">صور إضافية <span class="muted" style="font-weight:400">(دوس على صورة لحذفها)</span></span><div class="thumbs" id="df-gal">${(d.gallery || []).map((g, i) => `<img src="${esc(galSrc(g))}" alt="" data-gi="${i}">`).join("")}</div><label class="btn ghost sm" style="cursor:pointer;justify-self:start">+ إضافة صورة<input type="file" accept="image/*" class="sr" id="df-g"></label></div><button class="btn" type="submit">حفظ</button></form>`, (ov) => {
    const up = async (f) => { toast("جاري الرفع…"); const img = await compressImage(f, 700, 350000); const pid = uid("p_"); await setDoc(ref("photos", pid), { img }); S.photos[pid] = img; toast("اترفعت ✓"); return "photo:" + pid; };
    $("#df-file", ov).onchange = async function () { const f = this.files[0]; if (!f) return; try { d.photo = await up(f); $("#df-ph", ov).innerHTML = photo(d, "ph lg"); } catch (e) { fail(e); } };
    $("#df-g", ov).onchange = async function () { const f = this.files[0]; if (!f) return; try { const p = await up(f); d.gallery = (d.gallery || []).concat([p]); const im = document.createElement("img"); im.src = galSrc(p); $("#df-gal", ov).appendChild(im); } catch (e) { fail(e); } };
    $$("[data-gi]", ov).forEach((im) => (im.onclick = () => { d.gallery.splice(Number(im.dataset.gi), 1); im.remove(); }));
    $("#df", ov).onsubmit = async (e) => {
      e.preventDefault(); d.name = $("#df-n", ov).value.trim(); d.specialty = $("#df-s", ov).value.trim(); d.title = $("#df-t", ov).value.trim(); d.bio = $("#df-b", ov).value.trim(); d.video = $("#df-v", ov).value.trim();
      if (!d.name) return toast("اكتب الاسم");
      const shv = $("#df-sh", ov).value; S.priv = S.priv || JSON.parse(JSON.stringify(SEED_PRIVATE)); const shares = Object.assign({}, S.priv.shares); if (shv === "") delete shares[d.id]; else shares[d.id] = Number(shv); S.priv.shares = shares;
      let found = false; S.cat.doctors = S.cat.doctors.map((x) => { if (x.id === d.id) { found = true; return d; } return x; }); if (!found) S.cat.doctors.push(d);
      closeModal(); await savePriv(); saveCat("اتحفظ ✓");
    };
  });
}
function makeInvoice(docId) {
  const inv = invoicedVisitIds(), t = today(), d = docById(docId);
  const items = (CAT().visits || []).filter((v) => v.doctorId === docId && !inv[v.id] && v.date <= t).map((v) => { const s = visitStats(v); return { visitId: v.id, label: (v.center || v.gov) + " – " + dlong(v.date), count: s.count, fees: s.fees, pct: s.pct, amount: s.share }; }).filter((x) => x.count > 0);
  if (!items.length) return toast("مفيش زيارات مستحقة");
  setDoc(ref("invoices", uid("i_")), { doctorId: docId, doctorName: d.name, items, total: items.reduce((a, x) => a + x.amount, 0), paid: false, paidAt: null, createdAt: serverTimestamp() }).then(() => toast("الفاتورة اتعملت ✓"), fail);
}

/* ---------- boot ---------- */
if (!configured) {
  $("#app").innerHTML = shell('<div class="wrap"><div class="cfgwarn">لوحة التحكم لسه محتاجة ربط بمشروع Firebase. عدّل ملف js/config.js زي ما مكتوب في README.</div></div>', false);
} else {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js", { scope: "./" }).catch(() => {});
  getDoc(ref("meta", "setup")).then((s) => { S.setupDone = s.exists(); if (!S.user) renderLogin(); }).catch(() => {});
  onAuthStateChanged(auth, async (u) => {
    teardown(); S.user = u;
    if (!u) { renderLogin(); return; }
    $("#app").innerHTML = shell('<div class="loading">جاري التحميل…</div>', false);
    try {
      let a = await getDoc(ref("admins", u.uid));
      if (!a.exists()) {
        const setup = await getDoc(ref("meta", "setup"));
        if (!setup.exists() && u.email === phoneToEmail(CFG.ownerPhone)) { await bootstrap(u); a = await getDoc(ref("admins", u.uid)); S.setupDone = true; }
      }
      if (!a.exists()) { await signOut(auth); renderLogin("الرقم ده مالوش صلاحية دخول لوحة التحكم. كلّم المالك يضيفك."); return; }
      S.me = a.data(); S.loginMode = "login"; listen(); render();
    } catch (e) { await signOut(auth).catch(() => {}); renderLogin("حصلت مشكلة في الدخول: " + (e.code || e.message)); }
  });
}
