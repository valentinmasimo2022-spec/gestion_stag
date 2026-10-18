'use strict';

require('dotenv').config();
const sql = require('mssql');

const config = {
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'GestionStagiairesWeb',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    // Valeurs adaptées au développement local.
    // En déploiement réel : encrypt à true et certificat valide.
    encrypt: false,
    trustServerCertificate: true,
    instanceName: process.env.DB_INSTANCE || undefined
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }
};

// Avec une instance nommée, le port ne doit pas être fixé (SQL Browser le résout).
if (!process.env.DB_INSTANCE && process.env.DB_PORT) {
  config.port = parseInt(process.env.DB_PORT, 10);
}

let poolPromise = null;

/** Retourne toujours le même pool de connexions (créé à la première demande). */
function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config)
      .connect()
      .catch((err) => {
        poolPromise = null; // permet une nouvelle tentative à la requête suivante
        throw err;
      });
  }
  return poolPromise;
}

module.exports = { sql, getPool };
