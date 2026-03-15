'use strict';
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:     process.env.DB_HOST || 'localhost',
  user:     process.env.DB_USER || 'wassersport',
  password: process.env.DB_PASS || 'secret',
  database: process.env.DB_NAME || 'wassersport',
  waitForConnections: true,
  connectionLimit: 10,
});

module.exports = pool;
