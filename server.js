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
const { requireAuth, requireAdmin, optionalAuth } = require('./middleware/auth');
const authRouter        = require('./routes/auth');
const membersRouter     = require('./routes/members');
const adminRouter       = require('./routes/admin');
const { router: pagesRouter, renderPageBySlug } = require('./routes/pages');

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
      fontSrc:     ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc:      ["'self'", 'data:', 'blob:'],
      connectSrc:  ["'self'"],
      frameSrc:    ["'self'", 'https://www.youtube-nocookie.com', 'https://www.youtube.com'],
    },
  },
}));
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));

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
app.use('/api/admin',   requireAdmin, adminRouter);

// Admin draft preview — must be defined BEFORE the static /admin handler,
// so that /admin/preview/:slug is handled by our renderer, not as a file.
app.get('/admin/preview/:slug', requireAdmin, (req, res) => {
  return renderPageBySlug(req, res, req.params.slug, { preview: true });
});

// Admin UI (static files, but gated by auth middleware)
app.use('/admin', requireAdmin, express.static(path.join(__dirname, 'data', 'admin')));

// Legacy static /mitglieder route is replaced by dynamic page rendering (slug=mitglieder)
// Keep a redirect in case old links point to /mitglieder

// ── Calendar: list & parse ICS files ─────────────────────────────────────────
app.get('/api/events', (req, res) => {
  const icsDir = path.join(__dirname, 'data', 'ics');
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

  // Sort by start date ascending
  events.sort((a, b) => a.dtstart.localeCompare(b.dtstart));
  res.json(events);
});

// Static assets (CSS, JS, images, uploads, vendor libs) — excludes HTML at root
// so that GET / falls through to the dynamic page renderer below.
app.use(express.static(path.join(__dirname, 'data'), {
  index: false,            // don't auto-serve index.html for /
  extensions: ['html'],    // allow /login → login.html
}));

// Dynamic CMS pages — MUST come after static and after all /api routes.
// Uses optionalAuth so the renderer can show login/logout state in the nav.
app.use(optionalAuth, pagesRouter);

// ── Startup: verify DB then listen ───────────────────────────────────────────
(async () => {
  try {
    await connect();
  } catch (err) {
    logger.warn({ err }, 'db: connection failed at startup — continuing without DB (calendar still works)');
  }
  const server = app.listen(PORT, () => {
    logger.info({ port: PORT, logLevel: logger.level }, 'server started');
  });

  // Track open connections so we can close them on shutdown (otherwise
  // keep-alive sockets keep server.close() pending until client disconnects).
  const connections = new Set();
  server.on('connection', (conn) => {
    connections.add(conn);
    conn.on('close', () => connections.delete(conn));
  });

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutdown: received signal, closing server');

    // Stop accepting new connections
    server.close((err) => {
      if (err) {
        logger.error({ err }, 'shutdown: server.close error');
        process.exit(1);
      }
      logger.info('shutdown: server closed, exiting');
      process.exit(0);
    });

    // Actively close idle keep-alive connections so server.close() can resolve
    for (const conn of connections) conn.end();
    setTimeout(() => {
      for (const conn of connections) conn.destroy();
    }, 5000).unref();

    // Hard fallback in case something hangs
    setTimeout(() => {
      logger.error('shutdown: forced exit after 10s');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
})();
