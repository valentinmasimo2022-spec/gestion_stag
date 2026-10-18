'use strict';

const express = require('express');
const { sql, getPool } = require('../config/db');

const router = express.Router();

const COLONNES =
  'id, nom, postnom, prenom, sexe, telephone, email, formation, ' +
  'CONVERT(char(10), date_debut, 23) AS date_debut, ' +
  'CONVERT(char(10), date_fin, 23) AS date_fin, statut';

/* ---------- Validation côté serveur ---------- */

const RE_DATE = /^\d{4}-\d{2}-\d{2}$/;
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_TEL = /^[0-9+()\s.-]{6,20}$/;

function texte(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function dateValide(s) {
  if (!RE_DATE.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Nettoie et valide le corps d'une requête. Retourne { erreurs, data }. */
function valider(body) {
  const b = body || {};
  const erreurs = {};
  const data = {
    nom: texte(b.nom),
    postnom: texte(b.postnom),
    prenom: texte(b.prenom),
    sexe: texte(b.sexe),
    telephone: texte(b.telephone),
    email: texte(b.email),
    formation: texte(b.formation),
    date_debut: texte(b.date_debut),
    date_fin: texte(b.date_fin)
  };

  if (!data.nom) erreurs.nom = 'Le nom est obligatoire.';
  if (!data.prenom) erreurs.prenom = 'Le prénom est obligatoire.';

  const limites = { nom: 100, postnom: 100, prenom: 100, formation: 100, email: 150, telephone: 20 };
  for (const [champ, max] of Object.entries(limites)) {
    if (data[champ] && data[champ].length > max && !erreurs[champ]) {
      erreurs[champ] = `Maximum ${max} caractères.`;
    }
  }

  if (data.sexe && !['M', 'F'].includes(data.sexe)) erreurs.sexe = 'Valeur autorisée : M ou F.';
  if (data.email && !erreurs.email && !RE_EMAIL.test(data.email)) erreurs.email = "Format d'e-mail invalide.";
  if (data.telephone && !erreurs.telephone && !RE_TEL.test(data.telephone)) erreurs.telephone = 'Numéro de téléphone invalide.';

  if (data.date_debut && !dateValide(data.date_debut)) erreurs.date_debut = 'Date invalide (AAAA-MM-JJ).';
  if (data.date_fin && !dateValide(data.date_fin)) erreurs.date_fin = 'Date invalide (AAAA-MM-JJ).';
  if (!erreurs.date_debut && !erreurs.date_fin && data.date_debut && data.date_fin && data.date_fin < data.date_debut) {
    erreurs.date_fin = 'La date de fin ne peut pas précéder la date de début.';
  }

  return { erreurs, data };
}

/** Lie les champs validés comme paramètres SQL typés (aucune concaténation SQL). */
function lierParametres(request, data) {
  return request
    .input('nom', sql.NVarChar(100), data.nom)
    .input('postnom', sql.NVarChar(100), data.postnom)
    .input('prenom', sql.NVarChar(100), data.prenom)
    .input('sexe', sql.NVarChar(10), data.sexe)
    .input('telephone', sql.NVarChar(20), data.telephone)
    .input('email', sql.NVarChar(150), data.email)
    .input('formation', sql.NVarChar(100), data.formation)
    .input('date_debut', sql.Date, data.date_debut)
    .input('date_fin', sql.Date, data.date_fin);
}

function idValide(valeur) {
  const id = Number(valeur);
  return Number.isInteger(id) && id > 0 && id <= 2147483647 ? id : null;
}

/** Journalise l'erreur technique côté serveur, renvoie un message neutre au navigateur. */
function erreurServeur(res, err, message) {
  console.error('[ERREUR]', err.message);
  res.status(500).json({ message });
}

/* ---------- Routes ---------- */

// Compteurs par statut (tableau de bord)
router.get('/stats', async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(
      'SELECT statut, COUNT(*) AS total FROM dbo.Stagiaires GROUP BY statut'
    );
    const stats = { total: 0, 'À venir': 0, 'En cours': 0, 'Terminé': 0 };
    for (const ligne of r.recordset) {
      stats[ligne.statut] = ligne.total;
      stats.total += ligne.total;
    }
    res.json(stats);
  } catch (err) {
    erreurServeur(res, err, 'Erreur lors du calcul des statistiques.');
  }
});

// Liste + recherche + pagination : GET /api/stagiaires?q=...&page=1&limite=10
router.get('/', async (req, res) => {
  try {
    const q = texte(req.query.q);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limite = Math.min(100, Math.max(1, parseInt(req.query.limite, 10) || 10));
    const offset = (page - 1) * limite;

    const filtre = q
      ? `WHERE nom LIKE @motif OR postnom LIKE @motif OR prenom LIKE @motif
            OR CAST(id AS NVARCHAR(10)) = @exact`
      : '';

    const pool = await getPool();
    const requete = pool.request();
    if (q) {
      // Neutralise les jokers LIKE saisis par l'utilisateur
      const protege = q.replace(/[\\%_[]/g, (c) => '[' + c + ']');
      requete.input('motif', sql.NVarChar(400), `%${protege}%`);
      requete.input('exact', sql.NVarChar(10), q.slice(0, 10));
    }
    requete.input('offset', sql.Int, offset).input('limite', sql.Int, limite);

    const r = await requete.query(`
      SELECT COUNT(*) AS total FROM dbo.Stagiaires ${filtre};
      SELECT ${COLONNES} FROM dbo.Stagiaires ${filtre}
      ORDER BY id DESC OFFSET @offset ROWS FETCH NEXT @limite ROWS ONLY;
    `);

    const total = r.recordsets[0][0].total;
    res.json({
      donnees: r.recordsets[1],
      total,
      page,
      limite,
      pages: Math.max(1, Math.ceil(total / limite))
    });
  } catch (err) {
    erreurServeur(res, err, 'Erreur lors de la lecture des dossiers.');
  }
});

// Un dossier
router.get('/:id', async (req, res) => {
  const id = idValide(req.params.id);
  if (!id) return res.status(400).json({ message: 'Identifiant invalide.' });
  try {
    const pool = await getPool();
    const r = await pool.request().input('id', sql.Int, id)
      .query(`SELECT ${COLONNES} FROM dbo.Stagiaires WHERE id = @id`);
    if (r.recordset.length === 0) return res.status(404).json({ message: 'Dossier introuvable.' });
    res.json(r.recordset[0]);
  } catch (err) {
    erreurServeur(res, err, 'Erreur lors de la lecture du dossier.');
  }
});

// Création
router.post('/', async (req, res) => {
  const { erreurs, data } = valider(req.body);
  if (Object.keys(erreurs).length) {
    return res.status(400).json({ message: 'Données invalides.', erreurs });
  }
  try {
    const pool = await getPool();
    const r = await lierParametres(pool.request(), data).query(`
      INSERT INTO dbo.Stagiaires (nom, postnom, prenom, sexe, telephone, email, formation, date_debut, date_fin)
      OUTPUT INSERTED.id
      VALUES (@nom, @postnom, @prenom, @sexe, @telephone, @email, @formation, @date_debut, @date_fin)
    `);
    res.status(201).json({ message: 'Dossier enregistré.', id: r.recordset[0].id });
  } catch (err) {
    erreurServeur(res, err, "Erreur lors de l'enregistrement du dossier.");
  }
});

// Modification
router.put('/:id', async (req, res) => {
  const id = idValide(req.params.id);
  if (!id) return res.status(400).json({ message: 'Identifiant invalide.' });
  const { erreurs, data } = valider(req.body);
  if (Object.keys(erreurs).length) {
    return res.status(400).json({ message: 'Données invalides.', erreurs });
  }
  try {
    const pool = await getPool();
    const r = await lierParametres(pool.request().input('id', sql.Int, id), data).query(`
      UPDATE dbo.Stagiaires SET
        nom = @nom, postnom = @postnom, prenom = @prenom, sexe = @sexe,
        telephone = @telephone, email = @email, formation = @formation,
        date_debut = @date_debut, date_fin = @date_fin
      WHERE id = @id
    `);
    if (r.rowsAffected[0] === 0) return res.status(404).json({ message: 'Dossier introuvable.' });
    res.json({ message: 'Dossier modifié.' });
  } catch (err) {
    erreurServeur(res, err, 'Erreur lors de la modification du dossier.');
  }
});

// Suppression (la confirmation est demandée par l'interface)
router.delete('/:id', async (req, res) => {
  const id = idValide(req.params.id);
  if (!id) return res.status(400).json({ message: 'Identifiant invalide.' });
  try {
    const pool = await getPool();
    const r = await pool.request().input('id', sql.Int, id)
      .query('DELETE FROM dbo.Stagiaires WHERE id = @id');
    if (r.rowsAffected[0] === 0) return res.status(404).json({ message: 'Dossier introuvable.' });
    res.json({ message: 'Dossier supprimé.' });
  } catch (err) {
    erreurServeur(res, err, 'Erreur lors de la suppression du dossier.');
  }
});

module.exports = router;
