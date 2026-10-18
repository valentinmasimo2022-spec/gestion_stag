# GestionStagiairesWeb

Application web de gestion des stagiaires d'un centre de formation professionnelle.
Technologies : HTML, CSS, JavaScript, Node.js, Express, SQL Server (pilote `mssql`).

## Prérequis

- Node.js 18 ou plus récent (`node -v` pour vérifier)
- SQL Server (Express ou Developer) et SQL Server Management Studio (SSMS)
- Une connexion SQL Server par **identifiant et mot de passe** (authentification SQL)

## Installation

### 1. Créer la base de données

1. Ouvrez SSMS et connectez-vous à votre instance.
2. Ouvrez `database/schema.sql`, cliquez sur **Exécuter**.
3. (Facultatif) Exécutez `database/donnees_test.sql` pour ajouter 4 dossiers fictifs.

### 2. Préparer un compte SQL Server

Si vous n'avez pas de compte SQL, créez-en un dans SSMS (adaptez le mot de passe) :

```sql
CREATE LOGIN app_stagiaires WITH PASSWORD = 'Choisissez-un-mot-de-passe-solide-1!';
USE GestionStagiairesWeb;
CREATE USER app_stagiaires FOR LOGIN app_stagiaires;
ALTER ROLE db_datareader ADD MEMBER app_stagiaires;
ALTER ROLE db_datawriter ADD MEMBER app_stagiaires;
```

Vérifiez aussi que le serveur accepte le mode mixte (propriétés du serveur > Sécurité >
« Mode d'authentification SQL Server et Windows ») et que le protocole TCP/IP est activé
dans SQL Server Configuration Manager.

### 3. Configurer l'application

```bash
npm install
copy .env.example .env      # Windows   (Linux/macOS : cp .env.example .env)
```

Ouvrez `.env` et renseignez `DB_SERVER`, `DB_USER`, `DB_PASSWORD`.
Pour une instance nommée (par exemple `SQLEXPRESS`), renseignez `DB_INSTANCE=SQLEXPRESS`
et laissez `DB_PORT` vide.

### 4. Démarrer

```bash
npm start
```

Ouvrez http://localhost:3000. Le terminal affiche « Connexion à SQL Server : OK » si tout est correct.
Diagnostic : http://localhost:3000/api/sante doit répondre `{"serveur":"ok","base":"ok"}`.

## Problèmes fréquents

| Message | Cause probable |
| --- | --- |
| `Login failed for user` | Mauvais identifiant ou mot de passe, ou mode mixte non activé |
| `Failed to connect ... ECONNREFUSED` | TCP/IP désactivé, mauvais port, ou service SQL Server arrêté |
| `Failed to connect ... instance` | Service « SQL Server Browser » arrêté (instance nommée) |
| `Cannot open database` | `schema.sql` non exécuté, ou nom de base différent dans `.env` |

## Structure

```
GestionStagiairesWeb/
  database/   schema.sql, donnees_test.sql
  config/     db.js            (pool de connexions unique)
  routes/     stagiaires.js    (API : liste, recherche, ajout, modification, suppression)
  public/     index.html, css/style.css, js/app.js
  server.js   .env  .env.example  package.json
```

## API

| Méthode | Route | Rôle |
| --- | --- | --- |
| GET | `/api/stagiaires?q=&page=&limite=` | Liste paginée, recherche par n°, nom, postnom ou prénom |
| GET | `/api/stagiaires/stats` | Nombre de dossiers par statut |
| GET | `/api/stagiaires/:id` | Un dossier |
| POST | `/api/stagiaires` | Création |
| PUT | `/api/stagiaires/:id` | Modification |
| DELETE | `/api/stagiaires/:id` | Suppression |

## Sécurité : état de la version 1

- Requêtes SQL **paramétrées** partout, validation **côté serveur** de tous les champs.
- Erreurs techniques journalisées dans le terminal, message neutre renvoyé au navigateur.
- Données affichées avec `textContent` (pas d'injection HTML).
- `.env` exclu du dépôt via `.gitignore`.
- **Limites assumées** : pas d'authentification ni de rôles, pas de HTTPS. À utiliser sur un
  poste ou un réseau local de confiance ; à ajouter avant tout déploiement réel.

## Tests à exécuter (plan du chapitre III du mémoire)

| Test | Action | Résultat attendu |
| --- | --- | --- |
| T1 | Ajouter un dossier complet | Dossier enregistré, visible dans la liste |
| T2 | Envoyer le formulaire sans nom | Refus, message « Le nom est obligatoire. » |
| T3 | Rechercher un nom existant | Seuls les dossiers correspondants s'affichent |
| T4 | Modifier un numéro de téléphone | La nouvelle valeur est enregistrée |
| T5 | Supprimer un dossier | Confirmation demandée avant suppression |
| T6 | Date de fin antérieure à la date de début | Refus, message d'erreur sur la date de fin |
| T7 | Arrêter SQL Server puis ouvrir la liste | Message contrôlé, sans mot de passe ni détail technique |

Notez pour chaque test le résultat **réellement obtenu** et prenez une capture d'écran.
