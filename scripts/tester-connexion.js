'use strict';

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

const [email, motDePasse] = process.argv.slice(2);

(async () => {
  try {
    const r = await pool.query(
      'SELECT mot_de_passe, actif FROM utilisateurs WHERE email = $1',
      [email]
    );
    if (!r.rows.length) return console.log('RESULTAT : email introuvable dans la base');
    const u = r.rows[0];
    console.log('Hash commence par :', u.mot_de_passe.slice(0, 4), '| actif :', u.actif);
    console.log('RESULTAT :', (await bcrypt.compare(motDePasse, u.mot_de_passe)) ? 'mot de passe CORRECT' : 'mot de passe INCORRECT');
  } catch (e) {
    console.log('Erreur :', e.message);
  } finally {
    await pool.end();
  }
})();