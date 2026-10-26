/**
 * تاون كلينك – إشعارات الحجوزات من غير خطة Blaze
 * بيشتغل على Google Apps Script (مجاني) بحساب جوجل صاحب مشروع Firebase:
 *  - doPost: صفحة المرضى بتنادي عليه لحظة الحجز → إشعار فوري
 *  - sweep: كل دقيقة بيراجع آخر الحجوزات علشان لو نداء فات
 * مفيش أي مفاتيح سرية: بيستخدم صلاحية حسابك (OAuth).
 */
var PROJECT_ID = 'townclinic';                       // معرّف مشروع Firebase
var ADMIN_URL = 'https://pensellai.github.io/townclinic/admin/'; // رابط لوحة التحكم

var FS = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents';
var MO = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

/** شغّلها مرة واحدة من المحرر: بتطلب الصلاحيات وتعمل المراجعة كل دقيقة */
function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('sweep').timeBased().everyMinutes(1).create();
  var n = listTokens().length;
  Logger.log('تمام ✓ المراجعة كل دقيقة اشتغلت. الأجهزة المسجلة للإشعارات: ' + n);
  if (n) sendAll('تاون كلينك', 'الإشعارات شغالة ✓', 'setup');
}

function doPost(e) {
  var body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (x) {}
  if (body.id && /^[A-Za-z0-9_-]{5,60}$/.test(body.id)) {
    var lock = LockService.getScriptLock();
    if (lock.tryLock(20000)) { try { handle(body.k === 'w' ? 'waitlist' : 'bookings', body.id); } finally { lock.releaseLock(); } }
  }
  return ContentService.createTextOutput('ok');
}
function doGet() { return ContentService.createTextOutput('Town Clinic notifier is running'); }

/** كل دقيقة: أي حجز أو طلب انتظار من آخر ساعة لسه ما اتبعتش إشعاره */
function sweep() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    ['bookings', 'waitlist'].forEach(function (col) {
      recent(col).forEach(function (d) { if (!d.fields.notifiedAt) notify(col, d); });
    });
  } finally { lock.releaseLock(); }
}

function handle(col, id) {
  var r = api('get', FS + '/' + col + '/' + id);
  if (r.code !== 200) return;
  var d = JSON.parse(r.text);
  if (!d.fields || d.fields.notifiedAt) return;
  // الحجز لازم يكون جديد (آخر 30 دقيقة) علشان محدش يكرر الإشعار لحجز قديم
  if (Date.now() - Date.parse(d.createTime) > 30 * 60 * 1000) return;
  notify(col, d);
}

function notify(col, d) {
  var f = plain(d.fields), id = d.name.split('/').pop();
  if (col === 'bookings' && f.source === 'manual') { mark(col, id); return; }
  var cat = catalog(), doc = (cat.doctors || []).filter(function (x) { return x.id === f.doctorId; })[0] || {};
  var title, body;
  if (col === 'bookings') {
    var v = (cat.visits || []).filter(function (x) { return x.id === f.visitId; })[0];
    title = 'حجز جديد';
    body = f.name + ' – ' + (doc.name || '') + (v ? ' – ' + (v.center || v.gov) + ' ' + shortDate(v.date) : '') + (f.pay === 'vf' ? ' – فودافون كاش' : '');
  } else {
    title = 'طلب انتظار زيارة';
    body = f.name + ' – ' + (doc.name || '') + ' – ' + (f.center || f.gov || '');
  }
  sendAll(title, body, (col === 'bookings' ? 'b_' : 'w_') + id);
  mark(col, id);
}

function sendAll(title, body, tag) {
  listTokens().forEach(function (t) {
    var r = api('post', 'https://fcm.googleapis.com/v1/projects/' + PROJECT_ID + '/messages:send', {
      message: {
        token: t,
        webpush: {
          headers: { Urgency: 'high', TTL: '86400' },
          notification: { title: title, body: body, tag: tag, renotify: true, lang: 'ar', dir: 'rtl', icon: ADMIN_URL + 'icons/icon-192.png', badge: ADMIN_URL + 'icons/badge-72.png' },
          fcm_options: { link: ADMIN_URL }
        }
      }
    });
    if (r.code === 404 || (r.code === 400 && /registration token|UNREGISTERED|INVALID_ARGUMENT/.test(r.text))) {
      api('delete', FS + '/tokens/' + encodeURIComponent(t));
    } else if (r.code !== 200) {
      console.warn('FCM ' + r.code + ': ' + r.text);
    }
  });
}

function mark(col, id) {
  api('patch', FS + '/' + col + '/' + id + '?updateMask.fieldPaths=notifiedAt&currentDocument.exists=true', { fields: { notifiedAt: { timestampValue: new Date().toISOString() } } });
}
function listTokens() {
  var out = [], page = '';
  do {
    var r = api('get', FS + '/tokens?pageSize=300&mask.fieldPaths=uid' + (page ? '&pageToken=' + page : ''));
    if (r.code !== 200) break;
    var j = JSON.parse(r.text);
    (j.documents || []).forEach(function (d) { out.push(decodeURIComponent(d.name.split('/tokens/')[1])); });
    page = j.nextPageToken || '';
  } while (page);
  return out;
}
function recent(col) {
  var since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  var r = api('post', FS + ':runQuery', { structuredQuery: {
    from: [{ collectionId: col }],
    where: { fieldFilter: { field: { fieldPath: 'createdAt' }, op: 'GREATER_THAN_OR_EQUAL', value: { timestampValue: since } } },
    limit: 100
  } });
  if (r.code !== 200) { console.warn('query ' + r.code + ': ' + r.text); return []; }
  return JSON.parse(r.text).filter(function (x) { return x.document; }).map(function (x) { return x.document; });
}
var _cat = null;
function catalog() {
  if (_cat) return _cat;
  var r = api('get', FS + '/catalog/main');
  _cat = r.code === 200 ? plain(JSON.parse(r.text).fields || {}) : {};
  return _cat;
}
function shortDate(iso) { var a = String(iso || '').split('-').map(Number); return a[2] ? a[2] + ' ' + MO[a[1] - 1] : ''; }

/* ---- Firestore REST helpers ---- */
function api(method, url, payload) {
  var opt = {
    method: method, muteHttpExceptions: true, contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'x-goog-user-project': PROJECT_ID }
  };
  if (payload) opt.payload = JSON.stringify(payload);
  var res = UrlFetchApp.fetch(url, opt);
  return { code: res.getResponseCode(), text: res.getContentText() };
}
function val(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(val);
  if ('mapValue' in v) return plain(v.mapValue.fields || {});
  return null;
}
function plain(fields) { var o = {}; Object.keys(fields || {}).forEach(function (k) { o[k] = val(fields[k]); }); return o; }

/** فحص الاتصال بقاعدة البيانات */
function check() { var r = api('get', FS + '/tokens?pageSize=1'); Logger.log('Firestore: ' + r.code + ' ' + r.text.slice(0, 300)); }
