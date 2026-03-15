'use strict';
/**
 * Seeds the database with a demo user.
 * Run once after first `docker compose up`:
 *   docker compose exec app node db/seed.js
 */
require('dotenv').config();
const bcrypt = require('bcrypt');
const pool   = require('./connection');

(async () => {
  const hash = await bcrypt.hash('demo1234', 10);
  await pool.query(
    `INSERT INTO users (username, email, password_hash)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE id = id`,
    ['demo', 'demo@example.com', hash]
  );
  console.log('Demo user inserted: username=demo  password=demo1234');
  await pool.end();
})().catch(err => { console.error(err); process.exit(1); });
