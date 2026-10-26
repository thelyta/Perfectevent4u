'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const seed = require('./seed');

// ---------------------------------------------------------------------------
// Config (reads .env if present, no extra dependency needed)
// ---------------------------------------------------------------------------
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(PUBLIC_DIR, 'uploads');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SESSION_HOURS = 12;
const CATEGORIES = ['Weddings', 'Receptions', 'Corporate', 'Celebrations'];
const ICONS = ['planning', 'floral', 'management', 'venue', 'decor', 'catering', 'photo', 'music'];

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Tiny JSON file store
// ---------------------------------------------------------------------------
const files = {
  portfolio: path.join(DATA_DIR, 'portfolio.json'),
  services: path.join(DATA_DIR, 'services.json')
};

const newId = () => crypto.randomBytes(6).toString('hex');

function load(name) {
  try {
    return JSON.parse(fs.readFileSync(files[name], 'utf8'));
  } catch (e) {
    const items = seed[name].map(i => ({ id: newId(), ...i, created: new Date().toISOString() }));
    save(name, items);
    return items;
  }
}

function save(name, items) {
  const tmp = files[name] + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(items, null, 2));
  fs.renameSync(tmp, files[name]);
}

load('portfolio');
load('services');

// ---------------------------------------------------------------------------
// Auth: signed, expiring, HttpOnly cookie
// ---------------------------------------------------------------------------
const secretFile = path.join(DATA_DIR, '.session-secret');
let SECRET = process.env.SESSION_SECRET;
if (!SECRET) {
  if (!fs.existsSync(secretFile)) fs.writeFileSync(secretFile, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  SECRET = fs.readFileSync(secretFile, 'utf8');
}

const COOKIE = 'pe4u_admin';
const hmac = data => crypto.createHmac('sha256', SECRET).update(data).digest('base64url');

function makeToken() {
  const body = Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_HOURS * 3600 * 1000 })).toString('base64url');
  return `${body}.${hmac(body)}`;
}

function validToken(token) {
  if (!token || !token.includes('.')) return false;
  const [body, sig] = token.split('.');
  const expected = hmac(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString()).exp > Date.now();
  } catch (e) {
    return false;
  }
}

function getCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

function isAuthed(req) {
  return validToken(getCookie(req, COOKIE));
}

function requireAuth(req, res, next) {
  if (!isAuthed(req)) return res.status(401).json({ error: 'Please log in again.' });
  // Extra CSRF guard: browsers will not add this header on cross-site form posts.
  if (req.method !== 'GET' && req.get('x-requested-with') !== 'pe4u') {
    return res.status(403).json({ error: 'Blocked request.' });
  }
  next();
}

const sameString = (a, b) => {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
};

// Basic brute-force protection: 5 failed logins per 15 minutes per IP
const attempts = new Map();
function tooManyAttempts(ip) {
  const rec = attempts.get(ip);
  if (!rec) return false;
  if (Date.now() - rec.first > 15 * 60 * 1000) { attempts.delete(ip); return false; }
  return rec.count >= 5;
}
function recordFailure(ip) {
  const rec = attempts.get(ip);
  if (!rec || Date.now() - rec.first > 15 * 60 * 1000) attempts.set(ip, { count: 1, first: Date.now() });
  else rec.count++;
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
const app = express();
if (process.env.TRUST_PROXY) app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(express.json({ limit: '100kb' }));

// Uploaded photos (may live on a persistent disk outside /public)
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d', immutable: true }));

// Admin page should never be indexed
app.get(['/admin', '/admin/'], (req, res) => {
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
});

// ---- Public API -----------------------------------------------------------
app.get('/api/portfolio', (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.json(load('portfolio'));
});

app.get('/api/services', (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.json(load('services'));
});

// ---- Admin auth -----------------------------------------------------------
app.get('/api/admin/session', (req, res) => {
  res.json({ authenticated: isAuthed(req), configured: Boolean(ADMIN_PASSWORD) });
});

app.post('/api/admin/login', (req, res) => {
  if (!ADMIN_PASSWORD) {
    return res.status(503).json({ error: 'Admin password is not set on the server yet. Set ADMIN_PASSWORD and restart.' });
  }
  if (tooManyAttempts(req.ip)) {
    return res.status(429).json({ error: 'Too many attempts. Please try again in 15 minutes.' });
  }
  const password = (req.body && req.body.password) || '';
  if (!sameString(password, ADMIN_PASSWORD)) {
    recordFailure(req.ip);
    return res.status(401).json({ error: 'Incorrect password.' });
  }
  attempts.delete(req.ip);
  const flags = ['Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${SESSION_HOURS * 3600}`];
  if (req.secure) flags.push('Secure');
  res.set('Set-Cookie', `${COOKIE}=${encodeURIComponent(makeToken())}; ${flags.join('; ')}`);
  res.json({ ok: true });
});

app.post('/api/admin/logout', (req, res) => {
  res.set('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
  res.json({ ok: true });
});

// ---- Helpers --------------------------------------------------------------
const clean = (v, max) => String(v === undefined || v === null ? '' : v).trim().slice(0, max);
const asBool = v => v === true || v === 'true' || v === '1' || v === 'on';
const category = v => (CATEGORIES.includes(v) ? v : CATEGORIES[0]);

const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };

// Check the real file signature, not just the browser-reported type
function looksLikeImage(file) {
  const fd = fs.openSync(file, 'r');
  const buf = Buffer.alloc(12);
  fs.readSync(fd, buf, 0, 12, 0);
  fs.closeSync(fd);
  const hex = buf.toString('hex');
  return (
    hex.startsWith('ffd8ff') ||
    hex.startsWith('89504e47') ||
    hex.startsWith('47494638') ||
    (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP')
  );
}

function removeUpload(imagePath) {
  if (typeof imagePath !== 'string' || !imagePath.startsWith('/uploads/')) return;
  const file = path.join(UPLOAD_DIR, path.basename(imagePath));
  fs.promises.unlink(file).catch(() => {});
}

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      cb(null, `${Date.now().toString(36)}-${crypto.randomBytes(5).toString('hex')}${EXT[file.mimetype]}`);
    }
  }),
  limits: { fileSize: 12 * 1024 * 1024, files: 20 },
  fileFilter: (req, file, cb) =>
    EXT[file.mimetype] ? cb(null, true) : cb(new Error('Only JPG, PNG, WebP or GIF images are allowed.'))
});

function move(list, id, dir) {
  const i = list.findIndex(x => x.id === id);
  const j = dir === 'up' ? i - 1 : i + 1;
  if (i === -1 || j < 0 || j >= list.length) return false;
  [list[i], list[j]] = [list[j], list[i]];
  return true;
}

// ---- Admin: portfolio -----------------------------------------------------
app.post('/api/admin/portfolio', requireAuth, upload.array('images', 20), (req, res) => {
  const uploaded = req.files || [];
  if (!uploaded.length) return res.status(400).json({ error: 'Please choose at least one photo.' });

  const bad = uploaded.filter(f => !looksLikeImage(f.path));
  if (bad.length) {
    uploaded.forEach(f => fs.promises.unlink(f.path).catch(() => {}));
    return res.status(400).json({ error: 'One of the files is not a valid image.' });
  }

  const titles = [].concat(req.body.titles || []);
  const items = load('portfolio');
  const added = uploaded.map((f, i) => ({
    id: newId(),
    title: clean(titles[i], 80) || 'Untitled event',
    location: clean(req.body.location, 60),
    category: category(req.body.category),
    image: `/uploads/${f.filename}`,
    featured: asBool(req.body.featured),
    created: new Date().toISOString()
  }));
  save('portfolio', [...added, ...items]);
  res.json({ ok: true, added });
});

app.put('/api/admin/portfolio/:id', requireAuth, (req, res) => {
  const items = load('portfolio');
  const item = items.find(x => x.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Photo not found.' });
  const b = req.body || {};
  if (b.title !== undefined) item.title = clean(b.title, 80) || item.title;
  if (b.location !== undefined) item.location = clean(b.location, 60);
  if (b.category !== undefined) item.category = category(b.category);
  if (b.featured !== undefined) item.featured = asBool(b.featured);
  save('portfolio', items);
  res.json(item);
});

app.delete('/api/admin/portfolio/:id', requireAuth, (req, res) => {
  const items = load('portfolio');
  const item = items.find(x => x.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Photo not found.' });
  save('portfolio', items.filter(x => x.id !== item.id));
  removeUpload(item.image);
  res.json({ ok: true });
});

app.post('/api/admin/portfolio/:id/move', requireAuth, (req, res) => {
  const items = load('portfolio');
  if (!move(items, req.params.id, req.body && req.body.dir)) return res.json({ ok: true });
  save('portfolio', items);
  res.json({ ok: true });
});

// ---- Admin: services ------------------------------------------------------
function serviceFields(b) {
  return {
    title: clean(b.title, 80),
    description: clean(b.description, 500),
    icon: ICONS.includes(b.icon) ? b.icon : ICONS[0]
  };
}

app.post('/api/admin/services', requireAuth, (req, res) => {
  const f = serviceFields(req.body || {});
  if (!f.title || !f.description) return res.status(400).json({ error: 'Please add a title and a description.' });
  const items = load('services');
  const item = { id: newId(), ...f, created: new Date().toISOString() };
  items.push(item);
  save('services', items);
  res.json(item);
});

app.put('/api/admin/services/:id', requireAuth, (req, res) => {
  const items = load('services');
  const item = items.find(x => x.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Service not found.' });
  const f = serviceFields(req.body || {});
  if (!f.title || !f.description) return res.status(400).json({ error: 'Please add a title and a description.' });
  Object.assign(item, f);
  save('services', items);
  res.json(item);
});

app.delete('/api/admin/services/:id', requireAuth, (req, res) => {
  const items = load('services');
  if (!items.some(x => x.id === req.params.id)) return res.status(404).json({ error: 'Service not found.' });
  save('services', items.filter(x => x.id !== req.params.id));
  res.json({ ok: true });
});

app.post('/api/admin/services/:id/move', requireAuth, (req, res) => {
  const items = load('services');
  if (!move(items, req.params.id, req.body && req.body.dir)) return res.json({ ok: true });
  save('services', items);
  res.json({ ok: true });
});

// ---- Static site ----------------------------------------------------------
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

// ---- Errors ---------------------------------------------------------------
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'That photo is too large (12 MB max).' : err.message;
    return res.status(400).json({ error: msg });
  }
  if (err && err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Bad request.' });
  if (req.path.startsWith('/api/')) return res.status(400).json({ error: err.message || 'Something went wrong.' });
  next(err);
});

app.listen(PORT, () => {
  console.log(`Perfectevent4u running on http://localhost:${PORT}`);
  console.log(`Admin panel:           http://localhost:${PORT}/admin`);
  if (!ADMIN_PASSWORD) console.warn('\n  ! ADMIN_PASSWORD is not set. Set it (see README) before using the admin panel.\n');
});
