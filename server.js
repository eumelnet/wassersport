'use strict';
require('dotenv').config();
const path         = require('path');
const express      = require('express');
const helmet       = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit    = require('express-rate-limit');

const { requireAuth } = require('./middleware/auth');
const authRouter    = require('./routes/auth');
const membersRouter = require('./routes/members');

const app  = express();
const PORT = process.env.PORT || 3000;

// Security & parsing
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

// Rate-limit login endpoint
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,
  message: { ok: false, error: 'Zu viele Versuche. Bitte später erneut versuchen.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/login', loginLimiter);

// API routes
app.use('/api', authRouter);
app.use('/api/members', requireAuth, membersRouter);

// Protected page: /mitglieder
app.get('/mitglieder', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'data', 'members.html'));
});

// Static files
app.use(express.static(path.join(__dirname, 'data')));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
