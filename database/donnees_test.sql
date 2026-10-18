/* Données FICTIVES pour les tests. À ne pas utiliser en production. */
USE GestionStagiairesWeb;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Stagiaires)
BEGIN
    INSERT INTO dbo.Stagiaires (nom, postnom, prenom, sexe, telephone, email, formation, date_debut, date_fin)
    VALUES
    (N'Test', N'Alpha', N'Marie',  N'F', N'0810000001', N'marie.test@exemple.org', N'Informatique de gestion',
        DATEADD(DAY, -60,  CAST(GETDATE() AS DATE)), DATEADD(DAY, 30,  CAST(GETDATE() AS DATE))),
    (N'Test', N'Beta',  N'Jean',   N'M', N'0810000002', N'jean.test@exemple.org',  N'Secrétariat bureautique',
        DATEADD(DAY, -120, CAST(GETDATE() AS DATE)), DATEADD(DAY, -10, CAST(GETDATE() AS DATE))),
    (N'Test', N'Gamma', N'Esther', N'F', NULL, NULL, N'Comptabilité',
        DATEADD(DAY, 15,   CAST(GETDATE() AS DATE)), DATEADD(DAY, 105, CAST(GETDATE() AS DATE))),
    (N'Test', NULL,     N'Paul',   N'M', N'0810000004', N'paul.test@exemple.org',  N'Électricité',
        DATEADD(DAY, -20,  CAST(GETDATE() AS DATE)), DATEADD(DAY, 70,  CAST(GETDATE() AS DATE)));
END
GO
