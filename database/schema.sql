/* ============================================================
   GestionStagiairesWeb - Schéma de la base (SQL Server)
   À exécuter dans SQL Server Management Studio (SSMS).
   Script ré-exécutable : il ne détruit aucune donnée existante.
   ============================================================ */

IF DB_ID(N'GestionStagiairesWeb') IS NULL
    CREATE DATABASE GestionStagiairesWeb;
GO

USE GestionStagiairesWeb;
GO

IF OBJECT_ID(N'dbo.Stagiaires', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Stagiaires (
        id          INT IDENTITY(1,1) NOT NULL,
        nom         NVARCHAR(100) NOT NULL,
        postnom     NVARCHAR(100) NULL,
        prenom      NVARCHAR(100) NOT NULL,
        sexe        NVARCHAR(10)  NULL,
        telephone   NVARCHAR(20)  NULL,
        email       NVARCHAR(150) NULL,
        formation   NVARCHAR(100) NULL,
        date_debut  DATE NULL,
        date_fin    DATE NULL,

        /* Statut calculé à partir des dates : il ne peut jamais être incohérent.
           Colonne non persistée car elle dépend de la date du jour. */
        statut AS (
            CASE
                WHEN date_debut IS NULL OR date_debut > CAST(GETDATE() AS DATE)
                    THEN N'À venir'
                WHEN date_fin IS NOT NULL AND date_fin < CAST(GETDATE() AS DATE)
                    THEN N'Terminé'
                ELSE N'En cours'
            END
        ),

        CONSTRAINT PK_Stagiaires PRIMARY KEY (id),
        CONSTRAINT CK_Stagiaires_Sexe   CHECK (sexe IS NULL OR sexe IN (N'M', N'F')),
        CONSTRAINT CK_Stagiaires_Dates  CHECK (date_fin IS NULL OR date_debut IS NULL OR date_fin >= date_debut),
        CONSTRAINT CK_Stagiaires_Nom    CHECK (LEN(LTRIM(RTRIM(nom))) > 0),
        CONSTRAINT CK_Stagiaires_Prenom CHECK (LEN(LTRIM(RTRIM(prenom))) > 0)
    );

    CREATE INDEX IX_Stagiaires_Nom_Prenom ON dbo.Stagiaires (nom, prenom);
END
GO

IF OBJECT_ID(N'dbo.Utilisateurs', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Utilisateurs (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Email NVARCHAR(150) NOT NULL UNIQUE,
        MotDePasse NVARCHAR(255) NOT NULL,
        Nom NVARCHAR(100) NULL,
        Role NVARCHAR(30) NOT NULL DEFAULT N'viewer',
        Actif BIT NOT NULL DEFAULT 1,
        DateCreation DATETIME NOT NULL DEFAULT GETDATE()
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Utilisateurs WHERE Email = N'admin@formation.local')
BEGIN
    INSERT INTO dbo.Utilisateurs (Email, MotDePasse, Nom, Role)
    VALUES (N'admin@formation.local', N'admin123', N'Administrateur', N'admin');
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Utilisateurs WHERE Email = N'gestion@formation.local')
BEGIN
    INSERT INTO dbo.Utilisateurs (Email, MotDePasse, Nom, Role)
    VALUES (N'gestion@formation.local', N'gestion123', N'Gestionnaire', N'viewer');
END
GO
