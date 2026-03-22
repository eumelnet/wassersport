'use strict';
const mysql  = require('mysql2/promise');
const logger = require('../lib/logger');

const pool = mysql.createPool({
  host:               process.env.DB_HOST || 'localhost',
  user:               process.env.DB_USER || 'wassersport',
  password:           process.env.DB_PASS || 'secret',
  database:           process.env.DB_NAME || 'wassersport',
  waitForConnections: true,
  connectionLimit:    10,
  // Enable mysql2's internal debug only at trace level
  debug:              process.env.LOG_LEVEL === 'trace',
});

// ── Pool-level event logging ──────────────────────────────────────────────────
// mysql2's PromisePool wraps the underlying Pool; events live on pool.pool
const underlying = pool.pool;

underlying.on('connection', (conn) => {
  logger.debug({ db: process.env.DB_NAME, threadId: conn.threadId }, 'db: new connection');
});

underlying.on('acquire', (conn) => {
  logger.debug({ threadId: conn.threadId }, 'db: connection acquired');
});

underlying.on('release', (conn) => {
  logger.debug({ threadId: conn.threadId }, 'db: connection released');
});

underlying.on('enqueue', () => {
  logger.warn('db: all connections in use — query enqueued');
});

underlying.on('error', (err) => {
  logger.error({ err }, 'db: pool error');
});

/**
 * Verify the pool can reach the database.
 * Call once at startup; exits the process if the DB is unreachable.
 */
async function connect() {
  logger.info(
    { host: process.env.DB_HOST || 'localhost', database: process.env.DB_NAME || 'wassersport' },
    'db: connecting…'
  );
  let conn;
  try {
    conn = await pool.getConnection();
    logger.info({ host: process.env.DB_HOST || 'localhost' }, 'db: connection pool ready');
  } catch (err) {
    logger.fatal({ err }, 'db: unable to connect — exiting');
    process.exit(1);
  } finally {
    if (conn) conn.release();
  }
}

module.exports = { pool, connect };
