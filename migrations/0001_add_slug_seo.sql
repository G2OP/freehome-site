-- Migration 0001 — Ajout colonnes slug + SEO sur la table programmes
-- Date : 2026-04-18
-- Contexte : passage à l'architecture pages /programme/:slug (data-driven)
--            Chaque programme aura une URL adressable générée automatiquement.

ALTER TABLE programmes ADD COLUMN slug             TEXT DEFAULT '';
ALTER TABLE programmes ADD COLUMN seo_title        TEXT DEFAULT '';
ALTER TABLE programmes ADD COLUMN seo_description  TEXT DEFAULT '';
ALTER TABLE programmes ADD COLUMN simulateur_actif INTEGER DEFAULT 0;

-- Index unique sur slug (après avoir seedé les valeurs — voir 0002_seed_slugs.sql)
-- À appliquer APRÈS le seed :
-- CREATE UNIQUE INDEX idx_programmes_slug ON programmes(slug);
