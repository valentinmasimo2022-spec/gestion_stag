'use strict';

/* Interface de gestion des stagiaires.
   Toutes les données affichées passent par textContent : aucune injection HTML possible. */

const API = '/api/stagiaires';
const LIMITE = 10;
const TOKEN_KEY = 'gestionStagiairesToken';
const USER_KEY = 'gestionStagiairesUser';

const etat = { page: 1, pages: 1, q: '', idEdition: null, idSuppression: null };

function utilisateur() {
  try { return JSON.parse(sessionStorage.getItem(USER_KEY)) || {}; } catch { return {}; }
}
const estAdmin = utilisateur().role === 'admin';

function deconnecter() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  window.location.replace('/login');
}

if (!sessionStorage.getItem(TOKEN_KEY)) {
  window.location.replace('/login');
}

window.addEventListener('beforeunload', () => {
  if (window.location.pathname === '/dashboard') {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  }
});

window.addEventListener('pageshow', () => {
  if (!sessionStorage.getItem(TOKEN_KEY)) {
    window.location.replace('/login');
  }
});

const $ = (id) => document.getElementById(id);
const corps = $('corps-tableau');
const messageVide = $('message-vide');
const dlgFormulaire = $('dlg-formulaire');
const dlgSuppression = $('dlg-suppression');
const formulaire = $('formulaire');
const notification = $('notification');

/* ---------- Utilitaires ---------- */

async function appel(url, options = {}) {
  const entetes = Object.assign({}, options.headers, {
    Authorization: 'Bearer ' + sessionStorage.getItem(TOKEN_KEY)
  });
  let reponse;
  try {
    reponse = await fetch(url, Object.assign({}, options, { headers: entetes }));
  } catch {
    throw { message: 'Le serveur est injoignable. Vérifiez qu’il est démarré.' };
  }
  if (reponse.status === 401) {
    deconnecter();
    throw { message: 'Session expirée, reconnectez-vous.' };
  }
  let donnees = {};
  try { donnees = await reponse.json(); } catch { /* réponse vide */ }
  if (!reponse.ok) throw { message: donnees.message || 'Une erreur est survenue.', erreurs: donnees.erreurs };
  return donnees;
}

let minuteurNotif;
function notifier(texte, erreur = false) {
  notification.textContent = texte;
  notification.classList.toggle('erreur-notif', erreur);
  notification.hidden = false;
  clearTimeout(minuteurNotif);
  minuteurNotif = setTimeout(() => { notification.hidden = true; }, 4000);
}

function formaterDate(iso) {
  if (!iso) return '';
  const [a, m, j] = iso.split('-');
  return `${j}/${m}/${a}`;
}

function classeStatut(statut) {
  if (statut === 'En cours') return 'encours';
  if (statut === 'Terminé') return 'termine';
  if (statut === 'Non défini') return 'nondefini';
  return 'avenir';
}

/** Avancement du stage en pourcentage (0 à 100) selon les dates. */
function avancement(s) {
  if (s.statut === 'Non défini') return 0;
  if (s.statut === 'Terminé') return 100;
  if (s.statut === 'À venir' || !s.date_debut || !s.date_fin) return s.statut === 'En cours' ? 50 : 0;
  const debut = new Date(s.date_debut + 'T00:00:00').getTime();
  const fin = new Date(s.date_fin + 'T00:00:00').getTime();
  const maintenant = Date.now();
  if (fin <= debut) return 100;
  return Math.max(2, Math.min(100, Math.round(((maintenant - debut) / (fin - debut)) * 100)));
}

function el(nom, classe, texte) {
  const e = document.createElement(nom);
  if (classe) e.className = classe;
  if (texte !== undefined) e.textContent = texte;
  return e;
}

/* ---------- Affichage de la liste ---------- */

function ligne(s) {
  const tr = document.createElement('tr');

  tr.append(el('td', 'num', String(s.id)));

  const tdId = el('td', 'identite');
  tdId.append(el('strong', null, [s.nom, s.postnom, s.prenom].filter(Boolean).join(' ')));
  const contact = [s.telephone, s.email].filter(Boolean).join(' • ');
  if (contact) tdId.append(el('small', null, contact));
  tr.append(tdId);

  tr.append(el('td', null, s.formation || '—'));

  const tdPeriode = el('td', 'periode');
  const dates = s.date_debut || s.date_fin
    ? `${formaterDate(s.date_debut) || '?'} → ${formaterDate(s.date_fin) || '?'}`
    : 'Dates non renseignées';
  tdPeriode.append(el('div', 'periode-dates', dates));
  const frise = el('div', 'frise ' + classeStatut(s.statut));
  const barre = document.createElement('span');
  barre.style.width = avancement(s) + '%';
  frise.append(barre);
  tdPeriode.append(frise);
  tr.append(tdPeriode);

  const tdStatut = el('td');
  tdStatut.append(el('span', 'badge ' + classeStatut(s.statut), s.statut));
  tr.append(tdStatut);

  const tdActions = el('td');
  if (estAdmin) {
    const actions = el('div', 'actions-ligne');
    const nomComplet = [s.nom, s.prenom].join(' ');

    const bModifier = el('button', 'bouton bouton-lien', 'Modifier');
    bModifier.type = 'button';
    bModifier.setAttribute('aria-label', 'Modifier le dossier de ' + nomComplet);
    bModifier.addEventListener('click', () => ouvrirFormulaire(s));

    const bSupprimer = el('button', 'bouton bouton-lien', 'Supprimer');
    bSupprimer.type = 'button';
    bSupprimer.setAttribute('aria-label', 'Supprimer le dossier de ' + nomComplet);
    bSupprimer.addEventListener('click', () => demanderSuppression(s));

    actions.append(bModifier, bSupprimer);
    tdActions.append(actions);
  } else {
    tdActions.append(el('small', null, 'Lecture seule'));
  }
  tr.append(tdActions);
  return tr;
}

async function chargerListe() {
  const params = new URLSearchParams({ page: etat.page, limite: LIMITE });
  if (etat.q) params.set('q', etat.q);
  try {
    const r = await appel(`${API}?${params}`);
    etat.pages = r.pages;
    if (etat.page > r.pages) { etat.page = r.pages; return chargerListe(); }

    corps.replaceChildren(...r.donnees.map(ligne));
    messageVide.hidden = r.donnees.length > 0;
    if (r.donnees.length === 0) {
      messageVide.textContent = etat.q
        ? `Aucun stagiaire ne correspond à « ${etat.q} ».`
        : estAdmin
          ? 'Aucun dossier enregistré. Cliquez sur « Ajouter un stagiaire » pour commencer.'
          : 'Aucun dossier enregistré.';
    }
    $('info-page').textContent = `Page ${r.page} sur ${r.pages} — ${r.total} dossier${r.total > 1 ? 's' : ''}`;
    $('btn-precedent').disabled = r.page <= 1;
    $('btn-suivant').disabled = r.page >= r.pages;
  } catch (e) {
    corps.replaceChildren();
    messageVide.hidden = false;
    messageVide.textContent = e.message;
  }
}

async function chargerStats() {
  try {
    const s = await appel(API + '/stats');
    $('st-total').textContent = s.total;
    $('st-avenir').textContent = s['À venir'];
    $('st-encours').textContent = s['En cours'];
    $('st-termine').textContent = s['Terminé'];
    const nd = $('st-nondefini');
    if (nd) nd.textContent = s['Non défini'];
  } catch { /* le message d'erreur est déjà affiché par la liste */ }
}

function toutRecharger() { return Promise.all([chargerListe(), chargerStats()]); }

/* ---------- Formulaire ---------- */

const CHAMPS = ['nom', 'postnom', 'prenom', 'sexe', 'telephone', 'email', 'formation', 'date_debut', 'date_fin'];

function effacerErreurs() {
  $('erreur-globale').hidden = true;
  formulaire.querySelectorAll('[data-erreur]').forEach((p) => { p.textContent = ''; });
  formulaire.querySelectorAll('[aria-invalid]').forEach((c) => c.removeAttribute('aria-invalid'));
}

function afficherErreurs(erreurs) {
  let premier = null;
  for (const [champ, message] of Object.entries(erreurs)) {
    const p = formulaire.querySelector(`[data-erreur="${champ}"]`);
    const saisie = formulaire.elements[champ];
    if (p) p.textContent = message;
    if (saisie) {
      saisie.setAttribute('aria-invalid', 'true');
      premier = premier || saisie;
    }
  }
  if (premier) premier.focus();
}

/** Contrôle rapide avant envoi ; le serveur reste l'autorité (validation complète). */
function dateAujourdhuiIso() {
  const maintenant = new Date();
  maintenant.setHours(0, 0, 0, 0);
  return maintenant.toISOString().split('T')[0];
}

function controlerLocalement(d) {
  const e = {};
  if (!d.nom) e.nom = 'Le nom est obligatoire.';
  if (!d.prenom) e.prenom = 'Le prénom est obligatoire.';
  if (d.date_debut && d.date_debut < dateAujourdhuiIso()) {
    e.date_debut = 'La date de début ne peut pas être dans le passé.';
  }
  if (d.date_debut && d.date_fin && d.date_fin < d.date_debut) {
    e.date_fin = 'La date de fin ne peut pas précéder la date de début.';
  }
  return e;
}

function synchroniserDatesMin() {
  const aujourdHui = dateAujourdhuiIso();
  formulaire.elements.date_debut.min = aujourdHui;
  formulaire.elements.date_fin.min = aujourdHui;

  if (formulaire.elements.date_debut.value && formulaire.elements.date_debut.value < aujourdHui) {
    formulaire.elements.date_debut.value = aujourdHui;
  }
  if (formulaire.elements.date_fin.value && formulaire.elements.date_fin.value < aujourdHui) {
    formulaire.elements.date_fin.value = aujourdHui;
  }

  if (formulaire.elements.date_debut.value && formulaire.elements.date_fin.value && formulaire.elements.date_fin.value < formulaire.elements.date_debut.value) {
    formulaire.elements.date_fin.value = formulaire.elements.date_debut.value;
  }
}

function ouvrirFormulaire(stagiaire) {
  etat.idEdition = stagiaire ? stagiaire.id : null;
  $('titre-formulaire').textContent = stagiaire ? 'Modifier le dossier n° ' + stagiaire.id : 'Nouveau stagiaire';
  formulaire.reset();
  effacerErreurs();

  synchroniserDatesMin();

  if (stagiaire) {
    for (const c of CHAMPS) formulaire.elements[c].value = stagiaire[c] || '';
    synchroniserDatesMin();
  }

  dlgFormulaire.showModal();
  formulaire.elements.nom.focus();
}

formulaire.elements.date_debut.addEventListener('change', () => {
  if (formulaire.elements.date_debut.value && formulaire.elements.date_fin.value && formulaire.elements.date_fin.value < formulaire.elements.date_debut.value) {
    formulaire.elements.date_fin.value = formulaire.elements.date_debut.value;
  }
  synchroniserDatesMin();
});

formulaire.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  effacerErreurs();

  const donnees = {};
  for (const c of CHAMPS) donnees[c] = formulaire.elements[c].value.trim();

  const locales = controlerLocalement(donnees);
  if (Object.keys(locales).length) return afficherErreurs(locales);

  const bouton = $('btn-enregistrer');
  bouton.disabled = true;
  try {
    const modif = etat.idEdition !== null;
    const r = await appel(modif ? `${API}/${etat.idEdition}` : API, {
      method: modif ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(donnees)
    });
    dlgFormulaire.close();
    notifier(r.message);
    if (!modif) { etat.page = 1; etat.q = ''; $('recherche').value = ''; }
    await toutRecharger();
  } catch (e) {
    if (e.erreurs) afficherErreurs(e.erreurs);
    const g = $('erreur-globale');
    g.textContent = e.message;
    g.hidden = false;
  } finally {
    bouton.disabled = false;
  }
});

$('btn-annuler').addEventListener('click', () => dlgFormulaire.close());
if (estAdmin) {
  $('btn-ajouter').addEventListener('click', () => ouvrirFormulaire(null));
} else {
  $('btn-ajouter').hidden = true;
}
$('btn-deconnexion').addEventListener('click', deconnecter);

/* ---------- Suppression avec confirmation ---------- */

function demanderSuppression(s) {
  etat.idSuppression = s.id;
  $('texte-suppression').textContent =
    `Le dossier n° ${s.id} (${[s.nom, s.postnom, s.prenom].filter(Boolean).join(' ')}) sera supprimé.`;
  dlgSuppression.showModal();
}

$('btn-garder').addEventListener('click', () => dlgSuppression.close());

$('btn-confirmer-suppression').addEventListener('click', async () => {
  const bouton = $('btn-confirmer-suppression');
  bouton.disabled = true;
  try {
    const r = await appel(`${API}/${etat.idSuppression}`, { method: 'DELETE' });
    dlgSuppression.close();
    notifier(r.message);
    await toutRecharger();
  } catch (e) {
    dlgSuppression.close();
    notifier(e.message, true);
  } finally {
    bouton.disabled = false;
  }
});

/* ---------- Recherche et pagination ---------- */

let minuteurRecherche;
$('recherche').addEventListener('input', (ev) => {
  clearTimeout(minuteurRecherche);
  minuteurRecherche = setTimeout(() => {
    etat.q = ev.target.value.trim();
    etat.page = 1;
    chargerListe();
  }, 300);
});

$('btn-precedent').addEventListener('click', () => { if (etat.page > 1) { etat.page--; chargerListe(); } });
$('btn-suivant').addEventListener('click', () => { if (etat.page < etat.pages) { etat.page++; chargerListe(); } });

toutRecharger();