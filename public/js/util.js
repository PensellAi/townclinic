// أدوات مشتركة بين صفحة المرضى ولوحة التحكم
export const BASE = new URL("../", import.meta.url).href; // جذر الموقع
export const $ = (s, r) => (r || document).querySelector(s);
export const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
export const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const uid = (p = "") => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const code = (p) => p + "-" + Math.random().toString(36).slice(2, 7).toUpperCase();
export function today() { try { return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" }); } catch (e) { return new Date().toISOString().slice(0, 10); } }
export const WD = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
export const MO = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
export function dp(iso) { const a = String(iso || "").split("-").map(Number); if (a.length < 3 || !a[0]) return { wd: "", d: "", mo: "", y: "" }; const dt = new Date(Date.UTC(a[0], a[1] - 1, a[2])); return { wd: WD[dt.getUTCDay()], d: a[2], mo: MO[a[1] - 1], y: a[0] }; }
export function dlong(iso) { const p = dp(iso); return `${p.wd} ${p.d} ${p.mo} ${p.y}`; }
export function dshort(iso) { const p = dp(iso); return `${p.d} ${p.mo}`; }
export const money = (n) => Number(n || 0).toLocaleString("en-US") + " ج.م";
export function fmtTime(t) { if (!t) return ""; const [h, m = 0] = t.split(":").map(Number); return `${h % 12 || 12}${m ? ":" + String(m).padStart(2, "0") : ""} ${h < 12 ? "ص" : "م"}`; }
export function normPhone(p) { p = String(p || "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/\D/g, ""); if (p.startsWith("20") && p.length === 12) p = "0" + p.slice(2); return p; }
export const validPhone = (p) => /^01[0125]\d{8}$/.test(p);
export const waLink = (p, text) => "https://wa.me/2" + normPhone(p) + (text ? "?text=" + encodeURIComponent(text) : "");
export const place = (v) => (v ? (v.center && v.center !== v.gov ? `${v.center}، ${v.gov}` : v.gov) : "");
export function tsMillis(t) { if (!t) return 0; if (typeof t.toMillis === "function") return t.toMillis(); if (t.seconds) return t.seconds * 1000; const n = Date.parse(t); return isNaN(n) ? 0 : n; }
export function tsDay(t) { const m = tsMillis(t); return m ? new Date(m).toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" }) : ""; }
export function tsText(t) { const m = tsMillis(t); return m ? new Date(m).toLocaleString("ar-EG", { timeZone: "Africa/Cairo", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : ""; }

export const ST = { new: "جديد", confirmed: "مؤكد", done: "تم", cancelled: "ملغي" };
export const EXP_CATS = ["إيجار عيادة", "مواصلات", "مصاريف دكتور", "إعلانات", "أخرى"];
export const SVC_EXP_CATS = ["تكلفة معمل / تحاليل", "مستلزمات", "مواصلات عينات", "أخرى"];
export const GEO = {
  "قنا": ["قنا", "قفط", "قوص", "نقادة", "دشنا", "نجع حمادي", "فرشوط", "أبو تشت", "الوقف"],
  "سوهاج": ["سوهاج", "جرجا", "أخميم", "ساقلتة", "المراغة", "طهطا", "طما", "جهينة", "المنشاة", "البلينا", "دار السلام", "العسيرات"],
  "الأقصر": ["الأقصر", "أرمنت", "إسنا", "الطود", "البياضية", "القرنة", "الزينية"],
  "أسيوط": ["أسيوط", "ديروط", "القوصية", "منفلوط", "أبنوب", "الفتح", "ساحل سليم", "البداري", "صدفا", "الغنايم", "أبو تيج"],
  "أسوان": ["أسوان", "كوم أمبو", "إدفو", "دراو", "نصر النوبة"],
  "المنيا": ["المنيا", "ملوي", "سمالوط", "مغاغة", "بني مزار", "مطاي", "أبو قرقاص", "العدوة", "دير مواس"],
  "بني سويف": ["بني سويف", "الواسطى", "ناصر", "إهناسيا", "ببا", "الفشن", "سمسطا"],
  "الفيوم": ["الفيوم", "سنورس", "إطسا", "طامية", "أبشواي", "يوسف الصديق"],
  "البحر الأحمر": ["الغردقة", "سفاجا", "القصير", "مرسى علم", "رأس غارب"],
  "الوادي الجديد": ["الخارجة", "الداخلة", "الفرافرة", "باريس", "بلاط"],
  "القاهرة": [], "الجيزة": [], "الإسكندرية": [], "القليوبية": [], "الشرقية": [], "الدقهلية": [], "الغربية": [], "المنوفية": [], "البحيرة": [], "كفر الشيخ": [], "دمياط": [], "بورسعيد": [], "الإسماعيلية": [], "السويس": [], "مطروح": [], "شمال سيناء": [], "جنوب سيناء": []
};
export function geoOptions(sel) { return '<option value="">اختار المحافظة</option>' + Object.keys(GEO).map((g) => `<option${g === sel ? " selected" : ""}>${esc(g)}</option>`).join(""); }
export function centerOptions(g, sel, visits = []) { const list = (GEO[g] || []).slice(); visits.forEach((v) => { if (v.gov === g && v.center && !list.includes(v.center)) list.push(v.center); }); return '<option value="">اختار المركز</option>' + list.map((c) => `<option${c === sel ? " selected" : ""}>${esc(c)}</option>`).join("") + '<option value="__other">مركز تاني…</option>'; }
export function bindGeo(root, gid, cid, oid, visits) { const g = $("#" + gid, root), c = $("#" + cid, root), o = $("#" + oid, root); g.onchange = () => { c.innerHTML = centerOptions(g.value, "", visits); o.hidden = true; }; c.onchange = () => { o.hidden = c.value !== "__other"; }; }

export const IC = {
  pin: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  clock: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  copy: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
  wa: '<svg class="i" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 20zm4.4-6c-.2-.1-1.4-.7-1.7-.8s-.4-.1-.5.1-.6.8-.8.9-.3.2-.5 0a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c1.6.7 2.2.7 3 .6a2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .2-1.2c-.1-.1-.3-.2-.5-.3z"/></svg>',
  cal: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  bell: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>'
};

// صور الأطباء: مسار ملف في الموقع، أو "photo:<id>" محفوظة في Firestore
export function photoSrc(p, photos = {}) { if (!p) return ""; if (p.startsWith("photo:")) return photos[p.slice(6)] || ""; if (/^(data:|https?:)/.test(p)) return p; return BASE + p; }
export function photoHTML(d, cls = "ph", photos = {}) {
  const ini = esc((d && d.name || "").replace(/^د\.?\s*/, "").charAt(0));
  const src = d && photoSrc(d.photo, photos);
  return src ? `<img class="${cls}" src="${esc(src)}" alt="${esc(d.name)}" loading="lazy" data-ini="${ini}">` : `<span class="${cls} phx">${ini}</span>`;
}
document.addEventListener("error", (e) => { const t = e.target; if (t && t.tagName === "IMG" && t.hasAttribute("data-ini")) { const sp = document.createElement("span"); sp.className = t.className + " phx"; sp.textContent = t.getAttribute("data-ini"); t.replaceWith(sp); } }, true);

export function toast(t) { const el = document.createElement("div"); el.className = "toast"; el.setAttribute("role", "status"); el.textContent = t; document.body.appendChild(el); setTimeout(() => el.remove(), 2800); }
export function copyText(t, btn) {
  const fb = () => { const el = btn && btn.parentNode && btn.parentNode.querySelector(".num,.msg"); if (el) { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast("النص متحدد، انسخه"); } };
  try { navigator.clipboard.writeText(t).then(() => toast("اتنسخ ✓"), fb); } catch (e) { fb(); }
}
let afterClose = null;
export function onModalClose(fn) { afterClose = fn; }
export function modal(html, bind) {
  closeModal(true);
  const ov = document.createElement("div"); ov.className = "ov"; ov.id = "ov";
  ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(ov);
  ov.addEventListener("click", (e) => { if (e.target === ov) closeModal(); });
  $$(".x", ov).forEach((x) => (x.onclick = () => closeModal()));
  document.body.style.overflow = "hidden";
  if (bind) bind(ov);
  return ov;
}
export function closeModal(silent) { const o = $("#ov"); if (o) o.remove(); document.body.style.overflow = ""; if (!silent && afterClose) afterClose(); }
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
export const isModalOpen = () => !!$("#ov");

// ضغط الصور قبل الحفظ في Firestore (حد المستند 1 ميجا)
export function compressImage(file, max = 1100, maxBytes = 650000) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth, h = img.naturalHeight; const s = Math.min(1, max / Math.max(w, h)); w = Math.round(w * s); h = Math.round(h * s);
      const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0, w, h);
      let q = 0.72, out = c.toDataURL("image/jpeg", q);
      while (out.length > maxBytes && q > 0.3) { q -= 0.1; out = c.toDataURL("image/jpeg", q); }
      URL.revokeObjectURL(url); out.length > maxBytes ? rej(new Error("too_big")) : res(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("bad_image")); };
    img.src = url;
  });
}
export function confirmInline(btn, fn) {
  if (btn.dataset.armed) { fn(); return; }
  const old = btn.textContent; btn.dataset.armed = "1"; btn.textContent = "متأكد؟ دوس تاني";
  setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.textContent = old; } }, 3000);
}
