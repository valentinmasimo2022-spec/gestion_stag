'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');
const stagiaires = require('./routes/stagiaires');
const { query } = require('./config/db');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;

// ========================================
// 1. CONFIGURATION GENERALE
// ========================================

app.disable('x-powered-by');
app.use(express.json({ limit: '50kb' }));

// ========================================
// 2. PAGES DE L'APPLICATION
// ========================================

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'accueil.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

// ========================================
// 3. CONNEXION DES UTILISATEURS
// ========================================

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    !email.trim() ||
    !password
  ) {
    return res.status(400).json({ message: 'Email et mot de passe requis.' });
  }

  try {
    const resultat = await query(
      `SELECT id, email, mot_de_passe, nom, role, actif
       FROM utilisateurs
       WHERE email = $1
       LIMIT 1`,
      [email.trim()]
    );

    const user = resultat.rows[0];

    if (!user || !user.actif) {
      return res.status(401).json({
        message: 'Identifiants incorrects ou compte désactivé.'
      });
    }

    if (user.mot_de_passe !== password) {
      return res.status(401).json({ message: 'Identifiants incorrects.' });
    }

    return res.json({
      message: 'Connexion réussie.',
      user: {
        id: user.id,
        email: user.email,
        nom: user.nom,
        role: user.role
      }
    });
  } catch (err) {
    console.error('[ERREUR] Login SQL :', err.message);
    return res.status(500).json({ message: 'Erreur de vérification de la base.' });
  }
});

// ========================================
// 4. GESTION DES STAGIAIRES
// ========================================

app.use('/api/stagiaires', stagiaires);

// ========================================
// 5. VERIFICATION DE LA CONNEXION A LA BASE
// ========================================

app.get('/api/sante', async (req, res) => {
  try {
    await query('SELECT 1 AS ok');
    return res.json({ serveur: 'ok', base: 'ok' });
  } catch (err) {
    console.error('[ERREUR] Connexion base :', err.message);
    return res.status(503).json({ serveur: 'ok', base: 'indisponible' });
  }
});

// ========================================
// 6. ROUTES API INTROUVABLES
// ========================================

app.use('/api', (req, res) => {
  return res.status(404).json({ message: 'Route introuvable.' });
});

// ========================================
// 7. GESTION DES ERREURS
// ========================================

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Requête mal formée.' });
  }
  console.error('[ERREUR]', err.message);
  return res.status(500).json({ message: 'Erreur interne du serveur.' });
});

// ========================================
// 8. DEMARRAGE DU SERVEUR
// ========================================

app.listen(PORT, () => {
  console.log(`Application disponible sur http://localhost:${PORT}`);

  query('SELECT 1')
    .then(() => console.log('Connexion à PostgreSQL : OK'))
    .catch((err) => console.error('Connexion à PostgreSQL : ÉCHEC -', err.message));
});