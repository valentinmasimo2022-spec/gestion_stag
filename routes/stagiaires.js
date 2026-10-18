'use strict';

const express = require('express');
const { query } = require('../config/db');

const router = express.Router();

// Le statut est calculé automatiquement à partir des dates.
const STATUT_SQL =
  "CASE " +
  "WHEN date_debut IS NOT NULL AND date_debut > CURRENT_DATE THEN 'À venir' " +
  "WHEN date_fin IS NOT NULL AND date_fin < CURRENT_DATE THEN 'Terminé' " +
  "ELSE 'En cours' END";

const COLONNES =
  'id, nom, postnom, prenom, sexe, telephone, email, formation, ' +
  "to_char(date_debut, 'YYYY-MM-DD') AS date_debut, " +
  "to_char(date_fin, 'YYYY-MM-DD') AS date_fin, " +
  STATUT_SQL + ' AS statut';

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

/** Valeurs dans l'ordre des paramètres $1..$9 (aucune concaténation SQL). */
function valeurs(data) {
  return [
    data.nom, data.postnom, data.prenom, data.sexe, data.telephone,
    data.email, data.formation, data.date_debut, data.date_fin
  ];
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
    const r = await query(
      `SELECT statut, COUNT(*)::int AS total
       FROM (SELECT ${STATUT_SQL} AS statut FROM stagiaires) t
       GROUP BY statut`
    );
    const stats = { total: 0, 'À venir': 0, 'En cours': 0, 'Terminé': 0 };
    for (const ligne of r.rows) {
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

    let filtre = '';
    const params = [];
    if (q) {
      // Neutralise les jokers LIKE saisis par l'utilisateur
      const protege = q.replace(/[\\%_]/g, (c) => '\\' + c);
      params.push(`%${protege}%`, q.slice(0, 10));
      filtre = 'WHERE nom ILIKE $1 OR postnom ILIKE $1 OR prenom ILIKE $1 OR id::text = $2';
    }

    const rTotal = await query(`SELECT COUNT(*)::int AS total FROM stagiaires ${filtre}`, params);
    const total = rTotal.rows[0].total;

    const n = params.length;
    const rDonnees = await query(
      `SELECT ${COLONNES} FROM stagiaires ${filtre}
       ORDER BY id DESC LIMIT $${n + 1} OFFSET $${n + 2}`,
      [...params, limite, offset]
    );

    res.json({
      donnees: rDonnees.rows,
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
    const r = await query(`SELECT ${COLONNES} FROM stagiaires WHERE id = $1`, [id]);
    if (r.rows.length === 0) return res.status(404).json({ message: 'Dossier introuvable.' });
    res.json(r.rows[0]);
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
    const r = await query(
      `INSERT INTO stagiaires (nom, postnom, prenom, sexe, telephone, email, formation, date_debut, date_fin)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      valeurs(data)
    );
    res.status(201).json({ message: 'Dossier enregistré.', id: r.rows[0].id });
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
    const r = await query(
      `UPDATE stagiaires SET
         nom = $1, postnom = $2, prenom = $3, sexe = $4,
         telephone = $5, email = $6, formation = $7,
         date_debut = $8, date_fin = $9
       WHERE id = $10`,
      [...valeurs(data), id]
    );
    if (r.rowCount === 0) return res.status(404).json({ message: 'Dossier introuvable.' });
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
    const r = await query('DELETE FROM stagiaires WHERE id = $1', [id]);
    if (r.rowCount === 0) return res.status(404).json({ message: 'Dossier introuvable.' });
    res.json({ message: 'Dossier supprimé.' });
  } catch (err) {
    erreurServeur(res, err, 'Erreur lors de la suppression du dossier.');
  }
});

module.exports = router;