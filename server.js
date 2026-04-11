'use strict';
require('dotenv').config();
const path         = require('path');
const express      = require('express');
const helmet       = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit    = require('express-rate-limit');
const pinoHttp     = require('pino-http');

const fs                = require('fs');
const logger            = require('./lib/logger');
const { connect }       = require('./db/connection');
const { normalizeTargetLanguage, translateObjectFields, translateText } = require('./lib/translator');
const { requireAuth }   = require('./middleware/auth');
const authRouter        = require('./routes/auth');
const membersRouter     = require('./routes/members');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Request logging ───────────────────────────────────────────────────────────
app.use(pinoHttp({
  logger,
  // Log static asset requests only at debug level to reduce noise
  customLogLevel(req, res, err) {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400)        return 'warn';
    if (req.url.match(/\.(css|js|png|jpg|ico|woff2?)$/)) return 'debug';
    return 'info';
  },
  // Don't log the health-check path if added later
  autoLogging: { ignore: (req) => req.url === '/health' },
}));

// ── Security & parsing ────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'", 'https://cdn.skypack.dev', 'https://fonts.googleapis.com'],
      styleSrc:    ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:     ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:      ["'self'", 'data:'],
      connectSrc:  ["'self'"],
    },
  },
}));
app.use(cookieParser());
app.use(express.json());

// ──  Operate behind reverse proxy (nginx) ─────────────────────────────────────────────────────────────
app.set('trust proxy', true);

// ── Rate limiting ─────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { ok: false, error: 'Zu viele Versuche. Bitte später erneut versuchen.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/login',           authLimiter);
app.use('/api/forgot-password', authLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api', authRouter);
app.use('/api/members', requireAuth, membersRouter);

app.get('/api/captain', async (req, res) => {
  const targetLanguage = normalizeTargetLanguage(req.query.lang);
  const captainPath = path.join(__dirname, 'data', 'captain.txt');

  try {
    const original = fs.readFileSync(captainPath, 'utf8').trim();
    const text = await translateText(original || 'Keine Ankündigungen.', targetLanguage);
    return res.json({ ok: true, text });
  } catch (err) {
    logger.warn({ err, targetLanguage }, 'captain: translation failed, using fallback text');
    try {
      const original = fs.readFileSync(captainPath, 'utf8').trim();
      return res.json({ ok: true, text: original || 'Keine Ankündigungen.' });
    } catch {
      return res.json({ ok: true, text: 'Keine Ankündigungen.' });
    }
  }
});

app.get('/mitglieder', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'data', 'members.html'));
});

// ── Calendar: list & parse ICS files ─────────────────────────────────────────
app.get('/api/events', async (req, res) => {
  const icsDir = path.join(__dirname, 'data', 'ics');
  const targetLanguage = normalizeTargetLanguage(req.query.lang);
  let files;
  try {
    files = fs.readdirSync(icsDir).filter(f => f.endsWith('.ics'));
  } catch {
    return res.json([]);
  }

  const events = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(icsDir, file), 'utf8');
    const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const ev = { file };
    for (const line of lines) {
      const [key, ...rest] = line.split(':');
      const val = rest.join(':').replace(/\\,/g, ',').replace(/\\n/g, '\n').trim();
      if (key === 'SUMMARY')      ev.summary      = val;
      if (key === 'DESCRIPTION')  ev.description  = val;
      if (key === 'LOCATION')     ev.location     = val;
      if (key === 'DTSTART')      ev.dtstart      = val;
      if (key === 'DTEND')        ev.dtend        = val;
      if (key === 'CATEGORIES')   ev.categories   = val;
    }
    if (ev.summary && ev.dtstart) events.push(ev);
  }

  events.sort((a, b) => a.dtstart.localeCompare(b.dtstart));

  try {
    const translatedEvents = [];
    for (const event of events) {
      translatedEvents.push(await translateObjectFields(event, ['summary', 'description', 'location', 'categories'], targetLanguage));
    }
    return res.json(translatedEvents);
  } catch (err) {
    logger.warn({ err, targetLanguage }, 'events: translation failed, returning source language');
    return res.json(events);
  }
});

app.use(express.static(path.join(__dirname, 'data')));

// ── Startup: verify DB then listen ───────────────────────────────────────────
(async () => {
  try {
    await connect();
  } catch (err) {
    logger.warn({ err }, 'db: connection failed at startup — continuing without DB (calendar still works)');
  }
  app.listen(PORT, () => {
    logger.info({ port: PORT, logLevel: logger.level }, 'server started');
  });
})();
