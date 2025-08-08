// db.js - PostgreSQL connection setup for Salsa Events Backend
const { Pool } = require('pg');
require('dotenv').config();

/**
 * Create a PostgreSQL connection pool using DATABASE_URL from .env
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = pool; 