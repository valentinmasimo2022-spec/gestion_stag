'use strict';

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

const [email, motDePasse] = process.argv.slice(2);

if (!email || !motDePasse || motDePasse.length < 8) {
  console.log('Usage : node scripts/definir-mot-de-passe.js EMAIL MOTDEPASSE');
  console.log('Le mot de passe doit contenir au moins 8 caractères.');
  process.exit(1);
}

(async () => {
  try {
    const hash = await bcrypt.hash(motDePasse, 10);
    const r = await pool.query(
      'UPDATE utilisateurs SET mot_de_passe = $1 WHERE email = $2',
      [hash, email]
    );
    console.log(r.rowCount ? 'Mot de passe chiffré et enregistré pour ' + email : 'Utilisateur introuvable : ' + email);
  } catch (err) {
    console.error('Erreur :', err.message);
  } finally {
    await pool.end();
  }
})();