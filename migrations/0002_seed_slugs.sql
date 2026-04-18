-- Migration 0002 — Seed des slugs et SEO pour les 5 programmes actifs
-- Date : 2026-04-18
-- Noms vérifiés directement en D1 le 2026-04-18

UPDATE programmes SET
  slug            = 'rive-azure',
  seo_title       = 'Rive Azure — Résidence neuve à Malroy (57640) | FREEHOME',
  seo_description = 'Programme immobilier neuf Rive Azure à Malroy, Moselle. Appartements du T1 au T3, éligibles PTZ. Promoteur FREEHOME — Maison & Habitat.',
  simulateur_actif = 0
WHERE id = 1;

UPDATE programmes SET
  slug            = 'clos-prevert',
  seo_title       = 'Clos Prévert — Résidence neuve à Ay-sur-Moselle (57300) | FREEHOME',
  seo_description = 'Programme immobilier neuf Clos Prévert à Ay-sur-Moselle, Moselle. Appartements neufs éligibles Pinel & PTZ. Promoteur FREEHOME.',
  simulateur_actif = 0
WHERE id = 2;

UPDATE programmes SET
  slug            = 'le-socle',
  seo_title       = 'Le Socle — Résidence neuve à Mont-Saint-Martin (54350) | FREEHOME',
  seo_description = 'Programme immobilier neuf Le Socle à Mont-Saint-Martin, Meurthe-et-Moselle. Appartements neufs, éligibles PTZ. Promoteur FREEHOME.',
  simulateur_actif = 0
WHERE id = 4;

UPDATE programmes SET
  slug            = 'clos-serenite',
  seo_title       = 'Clos Sérénité — Résidence neuve à Kanfen (57330) | FREEHOME',
  seo_description = 'Programme immobilier neuf Clos Sérénité à Kanfen, Moselle. Maisons individuelles et appartements neufs. Promoteur FREEHOME.',
  simulateur_actif = 0
WHERE id = 5;

UPDATE programmes SET
  slug            = 'dynamik-park',
  seo_title       = 'DYNAMIK PARK — Parc d''activités neuf à Cuvry (57420) | FREEHOME',
  seo_description = 'DYNAMIK PARK à Cuvry, Moselle — cellules d''activité et commerces neufs, VEFA. Rendement 8%. Adjacent centre Amazon. Livraison T1 2027. Promoteur FREEHOME.',
  simulateur_actif = 1
WHERE id = 158;

-- Index unique — à appliquer après vérification que tous les slugs sont renseignés
CREATE UNIQUE INDEX IF NOT EXISTS idx_programmes_slug ON programmes(slug);
