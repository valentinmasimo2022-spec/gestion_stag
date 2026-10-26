'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const stagiaires = require('./routes/stagiaires');
const { query } = require('./config/db');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("JWT_SECRET manquant dans les variables d'environnement.");
  process.exit(1);
}

/** Vérifie le jeton. Seul le rôle admin peut ajouter, modifier ou supprimer. */
function authentifier(req, res, next) {
  const entete = req.headers.authorization || '';
  const jeton = entete.startsWith('Bearer ') ? entete.slice(7) : null;
  if (!jeton) return res.status(401).json({ message: 'Connexion requise.' });
  try {
    req.user = jwt.verify(jeton, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ message: 'Session expirée, reconnectez-vous.' });
  }
  if (req.method !== 'GET' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Droits insuffisants.' });
  }
  next();
}

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;

// ========================================
// 1. CONFIGURATION GENERALE
// ========================================

app.set('trust proxy', 1); // Render : bon protocole https dans le QR code
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

// ========================================
// 2 bis. VERIFICATION PUBLIQUE D'UNE ATTESTATION
// (n'affiche que le nom, la formation et les dates)
// ========================================

function echapper(t) {
  return String(t == null ? '' : t).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function pageVerification(titre, couleur, lignes) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Vérification d'attestation</title>
<style>
body{font-family:"Segoe UI",Arial,sans-serif;background:#f4f6f8;margin:0;padding:1.5rem;color:#1b2a3a}
.carte{max-width:520px;margin:2rem auto;background:#fff;border:1px solid #dde3ea;border-top:4px solid ${couleur};border-radius:10px;padding:1.6rem}
h1{font-size:1.3rem;margin:0 0 1rem;color:${couleur}}
p{margin:.4rem 0;line-height:1.5}
</style></head>
<body><div class="carte"><h1>${titre}</h1>${lignes}</div></body></html>`;
}

app.get('/verifier/:code', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const code = String(req.params.code || '').toUpperCase();
  const introuvable = pageVerification(
    'Attestation introuvable', '#b93b3b',
    '<p>Ce code ne correspond à aucune attestation valide.</p>'
  );

  if (!/^[A-F0-9]{5}-[A-F0-9]{5}$/.test(code)) return res.status(404).send(introuvable);

  try {
    const r = await query(
      `SELECT nom, postnom, prenom, formation,
              to_char(date_debut, 'DD/MM/YYYY') AS debut,
              to_char(date_fin, 'DD/MM/YYYY') AS fin,
              to_char(date_attestation, 'DD/MM/YYYY') AS emise
       FROM stagiaires
       WHERE code_verification = $1 AND attestation_annulee = FALSE`,
      [code]
    );
    if (!r.rows.length) return res.status(404).send(introuvable);

    const s = r.rows[0];
    const nom = [s.nom, s.postnom, s.prenom].filter(Boolean).join(' ');
    return res.send(pageVerification(
      'Attestation authentique', '#1f6b3a',
      `<p><strong>${echapper(nom)}</strong></p>
       <p>Formation : ${echapper(s.formation || 'non précisée')}</p>
       <p>Période : du ${echapper(s.debut)} au ${echapper(s.fin)}</p>
       <p>Émise le ${echapper(s.emise)}</p>`
    ));
  } catch (err) {
    console.error('[ERREUR] Vérification :', err.message);
    return res.status(500).send(pageVerification(
      'Erreur', '#b93b3b', '<p>Vérification impossible pour le moment.</p>'
    ));
  }
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

    const motDePasseOk = await bcrypt.compare(password, user.mot_de_passe);
    if (!motDePasseOk) {
      return res.status(401).json({ message: 'Identifiants incorrects.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({
      message: 'Connexion réussie.',
      token,
      user: { id: user.id, email: user.email, nom: user.nom, role: user.role }
    });
  } catch (err) {
    console.error('[ERREUR] Login SQL :', err.message);
    return res.status(500).json({ message: 'Erreur de vérification de la base.' });
  }
});

// ========================================
// 4. GESTION DES STAGIAIRES (protégée)
// ========================================

app.use('/api/stagiaires', authentifier, stagiaires);

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