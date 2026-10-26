// صفحة المرضى: الزيارات القادمة + الأطباء + الحجز (بيتسجل مباشرة في Firestore)
import { db, configured, CFG } from "./firebase.js";
import { doc, onSnapshot, collection, writeBatch, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { $, $$, esc, today, dp, dlong, money, fmtTime, normPhone, validPhone, waLink, place, IC, BASE, photoHTML, toast, copyText, modal, closeModal, geoOptions, bindGeo, compressImage, code } from "./util.js";

// تنبيه فوري للوحة التحكم (Apps Script). لو فشل، المراجعة كل دقيقة بتلحقه.
function ping(k, id) { const u = CFG.notifyUrl; if (!u || u.startsWith("PASTE")) return; try { fetch(u, { method: "POST", mode: "no-cors", keepalive: true, body: JSON.stringify({ k, id }) }).catch(() => {}); } catch (e) {} }
const S = { cat: { settings: {}, doctors: [], visits: [], services: [] }, photos: {}, loaded: false, filter: "all", error: "" };
const setg = (k) => (S.cat.settings || {})[k];
const docById = (id) => (S.cat.doctors || []).find((d) => d.id === id) || { name: "—", specialty: "" };
const visitById = (id) => (S.cat.visits || []).find((v) => v.id === id);
const svcById = (id) => (S.cat.services || []).find((s) => s.id === id);
const photo = (d, cls) => photoHTML(d, cls, S.photos);
function upcoming() { const t = today(); return (S.cat.visits || []).filter((v) => v.date >= t && v.status !== "hidden").sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || ""))); }

function header() {
  return `<header class="top"><div class="wrap"><div class="mark"><img src="${BASE}assets/logo-mark.png" alt=""></div><div class="brandtxt"><b>Town<span>Clinic</span></b><small>عيادات تاون كلينك التخصصية</small></div></div></header>`;
}
function render() {
  const app = $("#app");
  if (!configured) { app.innerHTML = header() + '<div class="wrap"><div class="cfgwarn">الموقع لسه محتاج ربط بقاعدة البيانات (ملف js/config.js).</div></div>'; return; }
  if (!S.loaded) { app.innerHTML = header() + '<div class="loading">جاري تحميل المواعيد…</div>'; return; }
  const ups = upcoming(); const places = [];
  ups.forEach((v) => { const p = v.center || v.gov; if (!places.includes(p)) places.push(p); });
  if (S.filter !== "all" && !places.includes(S.filter)) S.filter = "all";
  const shown = ups.filter((v) => S.filter === "all" || (v.center || v.gov) === S.filter);
  let h = header() + '<main><div class="wrap"><section class="intro"><h1>زيارات الأطباء القادمة</h1><p class="muted">استشاريين وأخصائيين في تخصصات نادرة بيزوروا بلدك. اختار الزيارة واحجز كشفك في دقيقة.</p></section>';
  if (S.error) h += `<div class="cfgwarn">${esc(S.error)}</div>`;
  if (places.length > 1) {
    h += `<div class="filters" role="group" aria-label="تصفية حسب المكان"><button class="chip" data-f="all" aria-pressed="${S.filter === "all"}">كل الأماكن</button>`;
    places.forEach((p) => { h += `<button class="chip" data-f="${esc(p)}" aria-pressed="${S.filter === p}">${esc(p)}</button>`; });
    h += "</div>";
  }
  h += '<section class="sec" aria-label="الزيارات"><div class="slips">';
  if (!shown.length) h += '<div class="empty">مفيش زيارات قادمة دلوقتي. اختار دكتور من تحت ودوس «عرّفني بميعاد زيارته» وهنبلغك أول ما يتحدد.</div>';
  shown.forEach((v) => { h += slipHTML(v); });
  h += '</div></section><section class="sec"><h2>أطباؤنا <small>دوس على الدكتور تشوف سيرته ومواعيده</small></h2><div class="docs">';
  (S.cat.doctors || []).forEach((d) => {
    const nx = ups.find((v) => v.doctorId === d.id);
    h += `<button class="dcard" data-doc="${esc(d.id)}">${photo(d)}<div style="min-width:0"><h3 style="font-size:16px">${esc(d.name)}</h3><p class="spec">${esc(d.specialty)}</p>${nx ? `<p class="nx">الزيارة الجاية: ${esc(dp(nx.date).wd + " " + dp(nx.date).d + " " + dp(nx.date).mo)} – ${esc(nx.center || nx.gov)}</p>` : '<p class="muted" style="font-size:12px">مفيش زيارة محددة حاليًا</p>'}</div></button>`;
  });
  h += "</div></section>";
  const phones = setg("phones") || [];
  h += `<footer class="foot"><b style="color:var(--ink)">للحجز والاستفسار</b><div>${phones.map((p) => `<span class="num">${esc(p)}</span>`).join(" · ")}</div>${setg("whatsapp") ? `<a class="btn wa sm" style="justify-self:start" href="${waLink(setg("whatsapp"))}" target="_blank" rel="noopener">${IC.wa} واتساب ${esc(setg("whatsapp"))}</a>` : ""}</footer></div></main>`;
  app.innerHTML = h;
  $$("[data-f]").forEach((b) => (b.onclick = () => { S.filter = b.dataset.f; render(); }));
  $$("[data-book]").forEach((b) => (b.onclick = () => openBook(b.dataset.book)));
  $$("[data-doc]").forEach((b) => (b.onclick = () => openDoc(b.dataset.doc)));
}
function slipHTML(v) {
  const d = docById(v.doctorId), p = dp(v.date);
  return `<article class="slip"><div class="stub"><span class="wd">${p.wd}</span><b class="num">${p.d}</b><span class="mo">${p.mo}</span></div><div class="slip-main"><div class="doc">${photo(d)}<div><h3>${esc(d.name)}</h3><p class="spec">${esc(d.specialty)}</p></div></div>` +
    `<div class="meta"><span>${IC.pin}${esc(place(v))}</span><span>${IC.clock}${v.time ? esc(fmtTime(v.time)) : "الميعاد بيتأكد مع الحجز"}</span></div>${v.note ? `<p class="muted" style="font-size:13px">${esc(v.note)}</p>` : ""}` +
    `<div class="slip-foot"><span class="fee">${v.fee ? "الكشف " + money(v.fee) : '<span class="muted" style="font-weight:500">سعر الكشف بيتأكد مع الحجز</span>'}</span><button class="btn" data-book="${esc(v.id)}">احجز كشف</button></div></div></article>`;
}
function openDoc(id) {
  const d = docById(id); const ups = upcoming().filter((v) => v.doctorId === id);
  let h = `<div class="sh-h"><h2>${esc(d.name)}</h2><button class="x" aria-label="إغلاق">×</button></div><div class="doc">${photo(d, "ph lg")}<div><p class="spec">${esc(d.specialty)}</p><p style="font-size:14px">${esc(d.title || "")}</p></div></div>`;
  if (d.bio) h += `<p class="bio">${esc(d.bio)}</p>`;
  if (d.gallery && d.gallery.length) h += `<div class="gal">${d.gallery.map((g) => { const src = g.startsWith("photo:") ? S.photos[g.slice(6)] : g; return src ? `<img src="${esc(src)}" alt="" loading="lazy">` : ""; }).join("")}</div>`;
  if (d.video) h += `<a class="btn ghost" href="${esc(d.video)}" target="_blank" rel="noopener">شاهد فيديو للدكتور ↗</a>`;
  h += '<div class="lbl">الزيارات القادمة</div>';
  h += ups.length ? '<div class="list">' + ups.map((v) => `<div class="item"><div class="item-h"><div><b>${esc(dlong(v.date))}</b><div class="meta"><span>${IC.pin}${esc(place(v))}</span>${v.time ? `<span>${IC.clock}${esc(fmtTime(v.time))}</span>` : ""}</div></div><button class="btn sm" data-book2="${esc(v.id)}">احجز</button></div></div>`).join("") + "</div>" : '<p class="muted">مفيش زيارة متحددة حاليًا.</p>';
  h += `<button class="btn" id="notify" style="justify-self:start">${IC.cal} عرّفني بميعاد زيارته القادمة</button>`;
  modal(h, (ov) => { $$("[data-book2]", ov).forEach((b) => (b.onclick = () => openBook(b.dataset.book2))); $("#notify", ov).onclick = () => openNotify(id); });
}
const phoneErr = "رقم الموبايل لازم يكون 11 رقم ويبدأ بـ 010 أو 011 أو 012 أو 015";
function openNotify(docId) {
  const d = docById(docId);
  const h = `<div class="sh-h"><h2>عرّفني بزيارة ${esc(d.name)}</h2><button class="x" aria-label="إغلاق">×</button></div><form id="nf" class="opts" novalidate>
  <div class="f"><label for="nf-name">الاسم</label><input class="in" id="nf-name" autocomplete="name" maxlength="80"></div>
  <div class="f"><label for="nf-phone">رقم الموبايل</label><input class="in num" style="text-align:right;width:100%" id="nf-phone" inputmode="tel" placeholder="01xxxxxxxxx" autocomplete="tel"></div>
  <div class="row2"><div class="f"><label for="nf-gov">المحافظة</label><select class="in" id="nf-gov">${geoOptions("")}</select></div><div class="f"><label for="nf-cen">المركز</label><select class="in" id="nf-cen"><option value="">اختار المحافظة الأول</option></select><input class="in" id="nf-cen2" placeholder="اكتب اسم المركز" hidden maxlength="40"></div></div>
  <p class="err" id="nf-err" role="alert"></p><button class="btn" type="submit" style="justify-content:center">تم</button></form>`;
  modal(h, (ov) => {
    bindGeo(ov, "nf-gov", "nf-cen", "nf-cen2", S.cat.visits);
    $("#nf", ov).onsubmit = async (e) => {
      e.preventDefault(); const er = $("#nf-err", ov);
      const name = $("#nf-name", ov).value.trim(), phone = normPhone($("#nf-phone", ov).value), gov = $("#nf-gov", ov).value;
      let cen = $("#nf-cen", ov).value; if (cen === "__other") cen = $("#nf-cen2", ov).value.trim();
      if (name.length < 3) return (er.textContent = "اكتب الاسم بالكامل");
      if (!validPhone(phone)) return (er.textContent = phoneErr);
      if (!gov) return (er.textContent = "اختار المحافظة");
      const ups = upcoming().filter((v) => v.doctorId === docId);
      const here = ups.filter((v) => v.gov === gov && (!cen || v.center === cen || v.center === gov));
      const near = here.concat(ups.filter((v) => v.gov === gov && !here.includes(v)));
      if (near.length) {
        modal(`<div class="sh-h"><h2>فيه زيارة متاحة ✓</h2><button class="x" aria-label="إغلاق">×</button></div><p>${esc(d.name)} عنده زيارة قريبة منك:</p><div class="list">${near.map((v) => `<div class="item"><b>${esc(dlong(v.date))}</b><div class="meta"><span>${IC.pin}${esc(place(v))}</span>${v.time ? `<span>${IC.clock}${esc(fmtTime(v.time))}</span>` : ""}</div><button class="btn" data-bk="${esc(v.id)}" style="justify-self:start">تأكيد الحجز</button></div>`).join("")}</div>`,
          (o2) => $$("[data-bk]", o2).forEach((b) => (b.onclick = () => openBook(b.dataset.bk, { name, phone }))));
        return;
      }
      const btn = $("button[type=submit]", ov); btn.disabled = true; er.textContent = "";
      try {
        const c = code("W");
        const wref = doc(collection(db, "waitlist"));
        await setDoc(wref, { code: c, doctorId: docId, name, phone, gov, center: cen || "", status: "waiting", createdAt: serverTimestamp() });
        ping("w", wref.id);
        modal(`<div class="sh-h"><h2>طلبك اتسجل ✓</h2><button class="x" aria-label="إغلاق">×</button></div><div class="ok-box"><h3>هنكلمك أول ما الميعاد يتحدد</h3><p>أول ما تتحدد زيارة لـ ${esc(d.name)} في ${esc(cen || gov)} هنتواصل معاك على رقم <span class="num">${esc(phone)}</span>.</p><p class="muted">رقم الطلب: <span class="num">${esc(c)}</span></p></div><button class="btn ghost x" style="justify-self:start">تمام</button>`);
      } catch (err) { btn.disabled = false; er.textContent = "الطلب ما اتبعتش. اتأكد من الإنترنت وجرّب تاني."; }
    };
  });
}
function openBook(vid, pre = {}) {
  const v = visitById(vid); if (!v) return; const d = docById(v.doctorId);
  const svcs = S.cat.services || []; const vf = setg("vfcash") || setg("whatsapp") || "";
  const h = `<div class="sh-h"><h2>حجز كشف</h2><button class="x" aria-label="إغلاق">×</button></div>
  <div class="sum"><div class="doc">${photo(d)}<div><b>${esc(d.name)}</b><p class="spec">${esc(d.specialty)}</p></div></div><div class="meta"><span>${IC.cal}${esc(dlong(v.date))}</span><span>${IC.pin}${esc(place(v))}</span>${v.time ? `<span>${IC.clock}${esc(fmtTime(v.time))}</span>` : ""}</div></div>
  <form id="bf" class="opts" novalidate>
  <div class="f"><label for="bf-name">الاسم بالكامل</label><input class="in" id="bf-name" autocomplete="name" maxlength="80" value="${esc(pre.name || "")}"></div>
  <div class="f"><label for="bf-phone">رقم الموبايل</label><input class="in num" style="text-align:right;width:100%" id="bf-phone" inputmode="tel" placeholder="01xxxxxxxxx" autocomplete="tel" value="${esc(pre.phone || "")}"></div>
  ${svcs.length ? `<div class="f"><span class="lbl">خدمات إضافية (اختياري)</span><div class="svcs">${svcs.map((s) => `<label class="svc"><span><input type="checkbox" value="${esc(s.id)}" class="bf-svc"> ${esc(s.name)}</span><span class="num">${money(s.price)}</span></label>`).join("")}</div></div>` : ""}
  <div class="f"><label for="bf-note">ملاحظة للدكتور (اختياري)</label><textarea class="in" id="bf-note" maxlength="500" placeholder="مثلاً: سن الطفل، الأعراض، أو أي حاجة تحب الدكتور يعرفها قبل الكشف"></textarea></div>
  <div class="f"><span class="lbl">طريقة الدفع</span>
   <label class="opt"><input type="radio" name="bf-pay" value="vf" checked><span><b>فودافون كاش</b><br><span class="muted" style="font-size:13px">حوّل وارفع صورة التحويل</span></span></label>
   <div class="vf" id="vfbox"><div class="copyline"><span>حوّل على الرقم</span><span class="num">${esc(vf)}</span><button type="button" class="btn ghost sm" id="cpvf">${IC.copy} نسخ الرقم</button></div>
    <label class="drop" for="bf-file"><span id="dropt">ارفع سكرين شوت التحويل</span><img id="bf-prev" alt="" hidden><span class="muted" style="font-size:12px">صورة من الموبايل</span></label><input type="file" id="bf-file" accept="image/*" class="sr"></div>
   <label class="opt"><input type="radio" name="bf-pay" value="clinic"><span><b>الدفع في العيادة</b><br><span class="muted" style="font-size:13px">تدفع يوم الزيارة</span></span></label></div>
  <div class="total"><span>الإجمالي</span><span class="num" id="bf-total"></span></div>
  <p class="err" id="bf-err" role="alert"></p><button class="btn" type="submit" style="justify-content:center">تأكيد الحجز</button></form>`;
  modal(h, (ov) => {
    let file = null;
    const tot = () => { let t = Number(v.fee || 0); $$(".bf-svc:checked", ov).forEach((c) => { const s = svcById(c.value); t += Number((s && s.price) || 0); }); $("#bf-total", ov).textContent = t ? money(t) : "بيتأكد مع الحجز"; return t; };
    tot(); $$(".bf-svc", ov).forEach((c) => (c.onchange = tot));
    $$('[name="bf-pay"]', ov).forEach((r) => (r.onchange = () => { $("#vfbox", ov).hidden = $('[name="bf-pay"]:checked', ov).value !== "vf"; }));
    $("#cpvf", ov).onclick = function () { copyText(vf, this); };
    $("#bf-file", ov).onchange = function () { file = this.files && this.files[0]; if (!file) return; const im = $("#bf-prev", ov); im.src = URL.createObjectURL(file); im.hidden = false; $("#dropt", ov).textContent = "تم اختيار الصورة ✓ (دوس للتغيير)"; };
    $("#bf", ov).onsubmit = async (e) => {
      e.preventDefault(); const er = $("#bf-err", ov);
      const name = $("#bf-name", ov).value.trim(), phone = normPhone($("#bf-phone", ov).value), pay = $('[name="bf-pay"]:checked', ov).value, note = $("#bf-note", ov).value.trim().slice(0, 500);
      if (name.length < 3) return (er.textContent = "اكتب الاسم بالكامل");
      if (!validPhone(phone)) return (er.textContent = phoneErr);
      if (pay === "vf" && !file) return (er.textContent = "ارفع صورة تحويل فودافون كاش، أو اختار الدفع في العيادة");
      const btn = $("button[type=submit]", ov); btn.disabled = true; btn.textContent = "جاري الإرسال…"; er.textContent = "";
      try {
        let img = "";
        if (pay === "vf") img = await compressImage(file);
        const services = $$(".bf-svc:checked", ov).map((c) => svcById(c.value)).filter(Boolean).map((s) => ({ id: s.id, name: s.name, price: Number(s.price || 0) }));
        const ref = doc(collection(db, "bookings")); const c = code("TC");
        const batch = writeBatch(db);
        batch.set(ref, { code: c, visitId: v.id, doctorId: v.doctorId, name, phone, pay, note, services, fee: Number(v.fee || 0), status: "new", source: "web", hasReceipt: !!img, createdAt: serverTimestamp() });
        if (img) batch.set(doc(db, "receipts", ref.id), { img, createdAt: serverTimestamp() });
        await batch.commit();
        ping("b", ref.id);
        done(c, v, d, name, phone, pay, tot());
      } catch (err) {
        btn.disabled = false; btn.textContent = "تأكيد الحجز";
        er.textContent = err && err.message === "too_big" ? "الصورة كبيرة قوي، جرّب سكرين شوت تانية" : err && err.message === "bad_image" ? "الملف ده مش صورة، اختار صورة التحويل" : "الحجز ما اتبعتش. اتأكد من الإنترنت وجرّب تاني.";
      }
    };
  });
}
function done(c, v, d, name, phone, pay, total) {
  const wa = setg("whatsapp");
  modal(`<div class="sh-h"><h2>تم استلام حجزك ✓</h2><button class="x" aria-label="إغلاق">×</button></div>
  <div class="ok-box"><h3>شكرًا ${esc(name.split(" ")[0])}</h3><p>حجزك مع ${esc(d.name)} يوم ${esc(dlong(v.date))} في ${esc(place(v))} وصل لفريق الحجز. هنتواصل معاك على <span class="num">${esc(phone)}</span> لتأكيد الميعاد.</p>
  <p>رقم الحجز: <b class="num">${esc(c)}</b></p>${total ? `<p>الإجمالي: <b class="num">${money(total)}</b> ${pay === "vf" ? "(اتحول فودافون كاش)" : "(يدفع في العيادة)"}</p>` : ""}</div>
  ${wa ? `<a class="btn ghost" href="${waLink(wa, "استفسار عن حجز رقم " + c)}" target="_blank" rel="noopener" style="justify-self:start">${IC.wa} استفسار على واتساب</a>` : ""}
  <button class="btn x" style="justify-self:start;width:auto;height:auto;border-radius:10px">تمام</button>`);
}

if (configured) {
  onSnapshot(doc(db, "catalog", "main"), (s) => { if (s.exists()) S.cat = Object.assign({ settings: {}, doctors: [], visits: [], services: [] }, s.data()); S.loaded = true; S.error = ""; if (!$("#ov")) render(); },
    () => { S.loaded = true; S.error = "مش قادرين نحمّل المواعيد دلوقتي. اتأكد من الإنترنت وحدّث الصفحة."; render(); });
  onSnapshot(collection(db, "photos"), (q) => { q.forEach((d) => { S.photos[d.id] = d.data().img; }); if (S.loaded && !$("#ov")) render(); }, () => {});
}
render();
