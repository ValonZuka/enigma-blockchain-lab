const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const ROOT = __dirname, DB = path.join(ROOT, 'data', 'students.json');
const PORT = Number(process.env.PORT || 4173), HOST = process.env.HOST || '127.0.0.1';
const ADMIN = process.env.ADMIN_TOKEN || crypto.randomBytes(4).toString('hex');
const STEPS = { 'lab-2': 6, 'lab-6': 5, 'lab-8': 6, 'lab-10': 6, 'lab-12': 6, 'lab-14': 6, 'lab-16': 7 }, MAXXP = 25;
const T = { html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8' };
const FILES = { '/': ['index.html', T.html], '/index.html': ['index.html', T.html], '/style.css': ['style.css', T.css], '/admin': ['admin/admin.html', T.html], '/admin-style.css': ['admin/admin-style.css', T.css] };
const readDb = () => { try { return JSON.parse(fs.readFileSync(DB, 'utf8')); } catch { return { profiles: {} }; } };
const writeDb = d => { fs.mkdirSync(path.dirname(DB), { recursive: true }); fs.writeFileSync(DB, JSON.stringify(d, null, 2), 'utf8'); };
const send = (res, s, b, t = 'application/json; charset=utf-8') => {
  if (res.headersSent) return;
  res.writeHead(s, { 'Content-Type': t, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
  res.end(t.startsWith('application/json') ? JSON.stringify(b) : b);
};
const bodyJson = req => new Promise((ok, no) => { let b = ''; req.on('data', c => { b += c; if (b.length > 200000) { no(new Error('Kërkesa është shumë e madhe.')); req.destroy(); } }); req.on('end', () => { try { ok(JSON.parse(b || '{}')); } catch { no(new Error('JSON i pavlefshëm.')); } }); req.on('error', no); });
const isAdmin = req => { const a = Buffer.from(String(req.headers['x-admin-token'] || '')), b = Buffer.from(ADMIN); return a.length === b.length && crypto.timingSafeEqual(a, b); };
function clean(st, qids = new Set()) {
  const o = { c: {}, k: {}, d: {}, t: {}, q: {}, a: {} }; if (!st || typeof st !== 'object') return o;
  for (const k of Object.keys(st.c || {})) { const m = /^(lab-\d+)-(\d+)$/.exec(k); if (m && STEPS[m[1]] && +m[2] < STEPS[m[1]]) o.c[k] = 1; }
  for (const k of Object.keys(st.k || {})) if (o.c[k]) o.k[k] = 1;
  for (const [id, v] of Object.entries(st.d || {})) { if (!STEPS[id] || !v) continue; let all = true; for (let i = 0; i < STEPS[id]; i++) if (!o.c[id + '-' + i]) all = false; if (all) o.d[id] = { xp: Math.max(0, Math.min(MAXXP, Math.floor(+v.xp || 0))), s: Math.max(0, Math.floor(+v.s || 0)) }; }
  for (const [id, v] of Object.entries(st.t || {})) if (STEPS[id] && Number.isFinite(+v)) o.t[id] = +v;
  for (const id of ['sim-lab-6', 'sim-lab-12', 'sim-lab-14']) if (st.q && +st.q[id] >= 0) o.q[id] = Math.min(3, Math.floor(+st.q[id]));
  if (Number.isInteger(st.av) && st.av >= 0 && st.av < 6) o.av = st.av; for (const k of Object.keys(st.a || {})) if (qids.has(k)) o.a[k] = 1;
  if (st.os === 'mac' || st.os === 'win') o.os = st.os;
  if (st.osSet) o.osSet = 1;
  return o;
}
const nick = s => decodeURIComponent(s).toLowerCase();
const SESS = new Map(), FAILS = new Map(), QF = path.join(ROOT, 'data', 'questions.json');
const readQ = () => { try { return JSON.parse(fs.readFileSync(QF, 'utf8')); } catch { return []; } }, writeQ = q => { fs.mkdirSync(path.dirname(QF), { recursive: true }); fs.writeFileSync(QF, JSON.stringify(q, null, 2)); };
const hashPin = (pin, salt) => crypto.scryptSync(String(pin), salt, 32).toString('hex');
const pub = p => { const { pin, ...r } = p; return r; };
const newTok = nk => { const t = crypto.randomBytes(16).toString('hex'); SESS.set(t, nk); return t; };
const authed = (req, nk) => SESS.get(String(req.headers['x-token'] || '')) === nk;

function serveFile(res, rel, type, method) { const f = path.join(ROOT, rel); if (!fs.existsSync(f)) return send(res, 404, { error: 'Skedari nuk u gjet.' }); res.writeHead(200, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' }); return res.end(method === 'HEAD' ? undefined : fs.readFileSync(f)); }

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost'), p = url.pathname;
  try {
    if (req.method === 'POST' && p === '/api/profile') {
      const i = await bodyJson(req), first = String(i.first || '').trim().slice(0, 50), last = String(i.last || '').trim().slice(0, 50), nk = String(i.nickname || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24);
      if (!first || !last || nk.length < 2) return send(res, 400, { error: 'Emri, mbiemri dhe pseudonimi (2+ shenja) kërkohen.' });
      const pin = String(i.pin || ''); if (!/^\d{4}$/.test(pin)) return send(res, 400, { error: 'PIN-i duhet të ketë 4 shifra.' });
      const db = readDb(); if (db.profiles[nk]) return send(res, 409, { error: 'Ky pseudonim ekziston. Hyr me PIN-in tënd.' });
      const profile = { nickname: nk, fullName: `${first} ${last}`, createdAt: new Date().toISOString(), unlocked: {}, pin: { salt: crypto.randomBytes(8).toString('hex') }, state: { ...clean({}), av: Number.isInteger(i.av) && i.av >= 0 && i.av < 6 ? i.av : 0 } };
      profile.pin.hash = hashPin(pin, profile.pin.salt);
      db.profiles[nk] = profile; writeDb(db); return send(res, 201, { profile: pub(profile), token: newTok(nk) });
    }
    if (req.method === 'POST' && p === '/api/login') {
      const i = await bodyJson(req), q = String(i.query || '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 101);
      if (q.length < 2) return send(res, 400, { error: 'Shkruaj pseudonimin ose emrin e mbiemrin.' });
      const db = readDb(); let pr = db.profiles[q.replace(/[^a-z0-9_-]/g, '')] && !q.includes(' ') ? db.profiles[q.replace(/[^a-z0-9_-]/g, '')] : null;
      if (!pr) { const ms = Object.values(db.profiles).filter(x => String(x.fullName || '').trim().toLowerCase().replace(/\s+/g, ' ') === q); if (ms.length > 1) return send(res, 409, { error: 'Ka disa profile me këtë emër. Hyr me pseudonimin.' }); pr = ms[0] || null; }
      if (!pr) return send(res, 404, { error: 'Profili nuk u gjet. Krijo një profil të ri.' });
      const f = FAILS.get(pr.nickname) || { n: 0, t: 0 }; if (f.t > Date.now()) return send(res, 429, { error: 'Shumë provime. Prit një minutë.' });
      const pin = String(i.pin || ''); if (!/^\d{4}$/.test(pin)) return send(res, 400, { error: 'Shkruaj PIN-in me 4 shifra.' });
      if (!pr.pin) { const salt = crypto.randomBytes(8).toString('hex'); pr.pin = { salt, hash: hashPin(pin, salt) }; writeDb(db); }
      else if (!crypto.timingSafeEqual(Buffer.from(hashPin(pin, pr.pin.salt)), Buffer.from(pr.pin.hash))) { f.n++; if (f.n >= 5) { f.t = Date.now() + 60000; f.n = 0; } FAILS.set(pr.nickname, f); return send(res, 401, { error: 'PIN i gabuar.' }); }
      FAILS.delete(pr.nickname); return send(res, 200, { profile: pub(pr), token: newTok(pr.nickname) });
    }
    if (req.method === 'PUT' && p.startsWith('/api/progress/')) {
      const nk = nick(p.slice(14)), db = readDb(); if (!db.profiles[nk]) return send(res, 404, { error: 'Profili nuk u gjet.' });
      if (!authed(req, nk)) return send(res, 401, { error: 'Hyr përsëri.' });
      const i = await bodyJson(req); db.profiles[nk].state = clean(i.state, new Set(readQ().map(x => x.id))); db.profiles[nk].updatedAt = new Date().toISOString(); writeDb(db);
      return send(res, 200, { ok: true, unlocked: db.profiles[nk].unlocked || {} });
    }
    if (req.method === 'GET' && p.startsWith('/api/profile/')) { const nk = nick(p.slice(13)), pr = readDb().profiles[nk]; if (!pr || !authed(req, nk)) return send(res, 401, { error: 'Hyr përsëri.' }); return send(res, 200, { unlocked: pr.unlocked || {}, questions: readQ() }); }
    if (p.startsWith('/api/admin/') || p === '/api/export') {
      if (!isAdmin(req)) return send(res, 401, { error: 'Token i gabuar.' });
      const db = readDb();
      if (req.method === 'GET' && p === '/api/admin/overview') return send(res, 200, { profiles: Object.values(db.profiles).map(pub) });
      if (req.method === 'GET' && p === '/api/export') { res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="students.json"' }); return res.end(JSON.stringify(db, null, 2)); }
      if (req.method === 'GET' && p === '/api/admin/questions') return send(res, 200, { questions: readQ() });
      if (req.method === 'POST' && p === '/api/admin/qadd') { const i = await bodyJson(req), opts = (Array.isArray(i.opts) ? i.opts : []).map(x => String(x).trim().slice(0, 120)).filter(Boolean).slice(0, 4), q = String(i.q || '').trim().slice(0, 300); if (!STEPS[i.lab] || q.length < 3 || opts.length < 2) return send(res, 400, { error: 'Plotëso pyetjen dhe të paktën 2 përgjigje.' }); const qs = readQ(); qs.push({ id: 'q' + Date.now().toString(36), lab: i.lab, q, opts, correct: 0 }); writeQ(qs); return send(res, 200, { ok: true }); }
      if (req.method === 'POST' && p === '/api/admin/qdel') { const i = await bodyJson(req); writeQ(readQ().filter(x => x.id !== i.id)); return send(res, 200, { ok: true }); }
      if (req.method === 'POST') {
        const i = await bodyJson(req), nk = String(i.nickname || '').toLowerCase(); if (!db.profiles[nk]) return send(res, 404, { error: 'Profili nuk u gjet.' });
        if (p === '/api/admin/unlock' && STEPS[i.lab]) { db.profiles[nk].unlocked = { ...(db.profiles[nk].unlocked || {}), [i.lab]: 1 }; writeDb(db); return send(res, 200, { ok: true }); }
        if (p === '/api/admin/resetpin') { delete db.profiles[nk].pin; writeDb(db); return send(res, 200, { ok: true }); }
        if (p === '/api/admin/delete') { delete db.profiles[nk]; writeDb(db); return send(res, 200, { ok: true }); }
      }
      return send(res, 404, { error: 'Nuk u gjet.' });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Metodë e pambështetur.' });

    const hit = FILES[p]; if (hit) return serveFile(res, hit[0], hit[1], req.method);
    return send(res, 404, { error: 'Nuk u gjet.' });
  } catch (e) {
    if (!res.headersSent) send(res, 500, { error: e.message || 'Gabim i serverit.' });
    else console.error(e);
  }
}).listen(PORT, HOST, () => console.log(`Laboratorët: http://${HOST}:${PORT}\nPaneli i ligjëruesit: http://${HOST}:${PORT}/admin\nToken admin: ${ADMIN}`));
