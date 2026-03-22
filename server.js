'use strict';
require('dotenv').config();
const path         = require('path');
const express      = require('express');
const helmet       = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit    = require('express-rate-limit');
const pinoHttp     = require('pino-http');

const logger            = require('./lib/logger');
const { connect }       = require('./db/connection');
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

app.get('/mitglieder', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'data', 'members.html'));
});

app.use(express.static(path.join(__dirname, 'data')));

// ── Startup: verify DB then listen ───────────────────────────────────────────
(async () => {
  await connect();
  app.listen(PORT, () => {
    logger.info({ port: PORT, logLevel: logger.level }, 'server started');
  });
})();
