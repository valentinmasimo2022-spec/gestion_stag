
'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');
const stagiaires = require('./routes/stagiaires');
const { getPool, sql } = require('./config/db');

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

// Page d'accueil
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'accueil.html'));
});

// Page de connexion
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Tableau de bord
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Fichiers statiques : CSS, JavaScript et images
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
    return res.status(400).json({
      message: 'Email et mot de passe requis.'
    });
  }

  try {
    const pool = await getPool();

    const resultat = await pool.request()
      .input('email', sql.NVarChar(150), email.trim())
      .query(`
        SELECT TOP 1 Id, Email, MotDePasse, Nom, Role, Actif
        FROM dbo.Utilisateurs
        WHERE Email = @email
      `);

    const user = resultat.recordset[0];

    if (!user || !user.Actif) {
      return res.status(401).json({
        message: 'Identifiants incorrects ou compte désactivé.'
      });
    }

    if (user.MotDePasse !== password) {
      return res.status(401).json({
        message: 'Identifiants incorrects.'
      });
    }

    return res.json({
      message: 'Connexion réussie.',
      user: {
        id: user.Id,
        email: user.Email,
        nom: user.Nom,
        role: user.Role
      }
    });

  } catch (err) {
    console.error('[ERREUR] Login SQL :', err.message);

    return res.status(500).json({
      message: 'Erreur de vérification SQL Server.'
    });
  }
});

// ========================================
// 4. GESTION DES STAGIAIRES
// ========================================

app.use('/api/stagiaires', stagiaires);

// ========================================
// 5. VERIFICATION DE LA CONNEXION SQL
// ========================================

app.get('/api/sante', async (req, res) => {
  try {
    const pool = await getPool();

    await pool.request().query('SELECT 1 AS ok');

    return res.json({
      serveur: 'ok',
      base: 'ok'
    });

  } catch (err) {
    console.error(
      '[ERREUR] Connexion SQL Server :',
      err.message
    );

    return res.status(503).json({
      serveur: 'ok',
      base: 'indisponible'
    });
  }
});

// ========================================
// 6. ROUTES API INTROUVABLES
// ========================================

app.use('/api', (req, res) => {
  return res.status(404).json({
    message: 'Route introuvable.'
  });
});

// ========================================
// 7. GESTION DES ERREURS
// ========================================

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      message: 'Requête mal formée.'
    });
  }

  console.error('[ERREUR]', err.message);

  return res.status(500).json({
    message: 'Erreur interne du serveur.'
  });
});

// ========================================
// 8. DEMARRAGE DU SERVEUR
// ========================================

app.listen(PORT, () => {
  console.log(
    `Application disponible sur http://localhost:${PORT}`
  );

  getPool()
    .then(() => {
      console.log('Connexion à SQL Server : OK');
    })
    .catch((err) => {
      console.error(
        'Connexion à SQL Server : ÉCHEC -',
        err.message
      );
    });
});
