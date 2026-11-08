const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const DB_FILE = path.join(ROOT, 'data', 'students.json');
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '127.0.0.1';

function readDb() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { return { profiles: {} }; }
}
function writeDb(db) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}
function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
  res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
}
function bodyJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 1_000_000) reject(new Error('Kërkesa është shumë e madhe.')); });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('JSON i pavlefshëm.')); } });
    req.on('error', reject);
  });
}
function safeState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return {};
  const copy = { ...state };
  delete copy.profile;
  return copy;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (req.method === 'POST' && url.pathname === '/api/profile') {
      const input = await bodyJson(req);
      const first = String(input.first || '').trim().slice(0, 50);
      const last = String(input.last || '').trim().slice(0, 50);
      const nickname = String(input.nickname || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24);
      if (!first || !last || nickname.length < 2) return send(res, 400, { error: 'Emri, mbiemri dhe pseudonimi (2+ shenja) kërkohen.' });
      const db = readDb();
      const existing = db.profiles[nickname];
      if (existing) return send(res, 200, { profile: existing, returning: true });
      const profile = { nickname, fullName: `${first} ${last}`, createdAt: new Date().toISOString(), state: { c: {}, d: {}, t: {}, u: {}, q: {}, pxp: 0 } };
      db.profiles[nickname] = profile;
      writeDb(db);
      return send(res, 201, { profile, returning: false });
    }
    if (req.method === 'PUT' && url.pathname.startsWith('/api/progress/')) {
      const nickname = decodeURIComponent(url.pathname.slice('/api/progress/'.length)).toLowerCase();
      const db = readDb();
      if (!db.profiles[nickname]) return send(res, 404, { error: 'Profili nuk u gjet.' });
      const input = await bodyJson(req);
      db.profiles[nickname].state = safeState(input.state);
      db.profiles[nickname].updatedAt = new Date().toISOString();
      writeDb(db);
      return send(res, 200, { ok: true });
    }
    if (req.method === 'GET' && url.pathname === '/api/export') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="students.json"', 'X-Content-Type-Options': 'nosniff' });
      return res.end(JSON.stringify(readDb(), null, 2));
    }
    if (req.method === 'GET' && url.pathname.startsWith('/api/profile/')) {
      const nickname = decodeURIComponent(url.pathname.slice('/api/profile/'.length)).toLowerCase();
      const profile = readDb().profiles[nickname];
      return profile ? send(res, 200, { profile }) : send(res, 404, { error: 'Profili nuk u gjet.' });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Metodë e pambështetur.' });
    const requested = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    const file = path.resolve(ROOT, requested);
    if (!file.startsWith(ROOT + path.sep)) return send(res, 403, { error: 'Nuk lejohet.' });
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, { error: 'Nuk u gjet.' });
    const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' };
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  } catch (error) {
    send(res, 500, { error: error.message || 'Gabim i serverit.' });
  }
});

server.listen(PORT, HOST, () => console.log(`Laboratorët gati: http://${HOST}:${PORT}`));
