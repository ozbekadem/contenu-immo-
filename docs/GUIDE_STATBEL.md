# Marché local (Statbel) — d'où viennent les chiffres et comment les mettre à jour

## Les sources

| Fichier Statbel (open data) | Ce qu'il apporte | Utilisé |
|---|---|---|
| `vastgoed_2010_9999.xlsx` — prix de l'immobilier **par commune** | Prix médian, fourchette (25 %–75 %) et nombre de ventes, par année et par trimestre, 2010 → aujourd'hui | Oui |
| `CPI_All_base_years.xlsx` — indice des prix à la consommation | Prix « en euros d'aujourd'hui » (inflation déduite) | Oui |
| `TF_IMMO_SECTOR.xlsx` — ventes **par secteur statistique** (quartier) | Détail par quartier 2013–2024 | Pas encore : le fichier ne contient que des codes de secteurs, sans leur nom |

Zone gardée dans l'application : arrondissements de Charleroi, Thuin, La Louvière, Mons, Soignies,
Namur et Philippeville, plus Wallonie, Belgique et provinces de Hainaut et de Namur (pour comparer).

## Limites (à connaître avant d'en parler à un client)

- Ce sont des **ventes signées chez le notaire**, pas des prix d'annonces, publiées avec quelques mois de décalage.
- Un prix n'est publié qu'à partir de **16 ventes** : petites communes et types rares ont des trous.
- Le chiffre vaut pour **toute la commune** (à Charleroi : Marcinelle, Gosselies, Jumet… confondus).
- Pas de **surface** : pas de prix au m².

## Mettre à jour (chaque trimestre ou une fois par an)

1. Sur <https://statbel.fgov.be/fr/open-data>, téléchargez la dernière version des deux fichiers
   (prix de l'immobilier par commune, indice des prix à la consommation).
2. Envoyez-les-moi : je lance `python3 scripts/statbel.py <prix_par_commune.xlsx> <indice.xlsx>`,
   qui met à jour `src/data/marche/statbel.json`, puis je publie la mise à jour.

Pour ajouter le détail **par quartier**, il faudra en plus le fichier Statbel des **secteurs statistiques**
(avec leurs noms).
