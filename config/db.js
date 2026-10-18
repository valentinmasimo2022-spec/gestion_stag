'use strict';

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000
});

/** Exécute une requête SQL. Exemple : query('SELECT * FROM stagiaires WHERE id = $1', [id]) */
function query(text, params) {
  return pool.query(text, params);
}

module.exports = { pool, query };