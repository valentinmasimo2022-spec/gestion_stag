CREATE TABLE IF NOT EXISTS stagiaires (
    id          SERIAL PRIMARY KEY,
    nom         VARCHAR(100) NOT NULL,
    postnom     VARCHAR(100),
    prenom      VARCHAR(100) NOT NULL,
    sexe        VARCHAR(10),
    telephone   VARCHAR(20),
    email       VARCHAR(150),
    formation   VARCHAR(100),
    date_debut  DATE,
    date_fin    DATE,
    CONSTRAINT ck_stagiaires_sexe   CHECK (sexe IS NULL OR sexe IN ('M', 'F')),
    CONSTRAINT ck_stagiaires_dates  CHECK (date_fin IS NULL OR date_debut IS NULL OR date_fin >= date_debut),
    CONSTRAINT ck_stagiaires_nom    CHECK (length(trim(nom)) > 0),
    CONSTRAINT ck_stagiaires_prenom CHECK (length(trim(prenom)) > 0)
);

CREATE INDEX IF NOT EXISTS ix_stagiaires_nom_prenom ON stagiaires (nom, prenom);

CREATE TABLE IF NOT EXISTS utilisateurs (
    id            SERIAL PRIMARY KEY,
    email         VARCHAR(150) NOT NULL UNIQUE,
    mot_de_passe  VARCHAR(255) NOT NULL,
    nom           VARCHAR(100),
    role          VARCHAR(30) NOT NULL DEFAULT 'viewer',
    actif         BOOLEAN NOT NULL DEFAULT TRUE,
    date_creation TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO utilisateurs (email, mot_de_passe, nom, role)
VALUES ('admin@formation.local', 'admin123', 'Administrateur', 'admin')
ON CONFLICT (email) DO NOTHING;

INSERT INTO utilisateurs (email, mot_de_passe, nom, role)
VALUES ('gestion@formation.local', 'gestion123', 'Gestionnaire', 'viewer')
ON CONFLICT (email) DO NOTHING;