-- schema.sql — FREEHOME Site
-- Base de données D1 : mhfreehome-db (c8db2491-df07-4e48-af35-ffb0dfb979d7)
-- Dernière mise à jour : 2026-04-16 (v2.2.2)

-- ─────────────────────────────────────────────────────────────────────────────
-- PROGRAMMES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS programmes (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  nom              TEXT    NOT NULL UNIQUE,
  commune          TEXT,
  cp               TEXT,
  adresse          TEXT,
  statut           TEXT    DEFAULT 'En commercialisation',
  reglementation   TEXT    DEFAULT 'RE2020',
  livraison        TEXT,
  livraison_detail TEXT,
  debut_travaux    TEXT,
  lots_total       INTEGER DEFAULT 0,
  pieces           TEXT,
  surface_min      REAL    DEFAULT 0,
  surface_max      REAL    DEFAULT 0,
  prix_min         REAL    DEFAULT 0,
  prix_max         REAL    DEFAULT 0,
  eligibilites     TEXT,                    -- JSON array ou CSV : ["Pinel","PTZ"]
  plan3d           TEXT,
  youtube          TEXT,
  img_cover        TEXT,
  photos           TEXT,                    -- JSON array d'URLs
  desc_courte      TEXT,
  desc_longue      TEXT,
  atouts           TEXT,                    -- JSON array
  prestations      TEXT,                    -- JSON array de {cat, items[]}
  timeline         TEXT,                    -- JSON array
  updated_at       TEXT    DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────────────────────────────────────────
-- LOTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lots (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  programme_nom   TEXT    NOT NULL,         -- FK → programmes.nom
  num             TEXT    NOT NULL,         -- ex: "LOT 101", "A-01"
  etage           TEXT,
  typo            TEXT,                     -- T1, T2, T3, Studio…
  surface         REAL    DEFAULT 0,
  prix            REAL    DEFAULT 0,
  statut          TEXT    DEFAULT 'Disponible', -- Disponible | Réservé | Vendu | Bloqué
  acquereur       TEXT    DEFAULT '',       -- Nom court pour affichage rapide (sync depuis acquereurs)
  plan3d          TEXT    DEFAULT '',       -- URL plan ou nom fichier
  updated_at      TEXT    DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────────────────────────────────────────
-- ACQUEREURS  (données nominatives complètes — accès admin uniquement)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS acquereurs (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  programme_nom       TEXT    NOT NULL,
  lot_num             TEXT    NOT NULL,
  nom                 TEXT    NOT NULL,
  email               TEXT,
  telephone           TEXT,
  date_reservation    TEXT,
  date_acte           TEXT,
  date_livraison      TEXT,
  montant             REAL    DEFAULT 0,
  financement         TEXT,                 -- PTZ | Pinel | Cash | Crédit
  statut              TEXT    DEFAULT 'Réservé', -- Réservé | Vendu | Livré
  notes               TEXT,
  updated_at          TEXT    DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────────────────────────────────────────
-- LEADS  (demandes de contact depuis le site public)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  prenom      TEXT,
  nom         TEXT    NOT NULL,
  email       TEXT,
  telephone   TEXT,
  programme   TEXT,
  typo        TEXT,
  budget      TEXT,
  statut      TEXT    DEFAULT 'Nouveau',    -- Nouveau | Contacté | En cours | Converti | Archivé
  source      TEXT    DEFAULT 'Site web',
  priorite    TEXT    DEFAULT 'l',          -- h (haute) | m (moyenne) | l (basse)
  notes       TEXT,
  updated_at  TEXT    DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────────────────────────────────────────
-- SETTINGS  (configuration dynamique du site)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);
-- Clés utilisées : tel_societe, email_societe, hero_titre, hero_sous_titre,
--                 tagline, adresse_societe, siret, ga_id, gsc_token,
--                 linkedin, facebook, instagram, youtube

-- ─────────────────────────────────────────────────────────────────────────────
-- KNOWLEDGE BASE  (base de connaissances IA)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS knowledge_base (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  categorie  TEXT    NOT NULL,              -- programme | vefa | fiscalite | general…
  titre      TEXT    NOT NULL,
  contenu    TEXT    NOT NULL,
  updated_at TEXT    DEFAULT (datetime('now')),
  UNIQUE(categorie, titre)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- PDF DOCUMENTS  (PDFs ingérés depuis R2)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pdf_documents (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  programme_nom TEXT    NOT NULL,
  filename      TEXT    NOT NULL,
  doc_type      TEXT,                       -- notice_descriptive | notice_synthetique | referentiel_equipements | grille_vente
  r2_key        TEXT,                       -- clé dans le bucket R2 freehome-pdfs
  status        TEXT    DEFAULT 'done',
  ingested_at   TEXT    DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────────────────────────────────────────
-- PDF CHUNKS  (chunks texte pour RAG — usage futur)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pdf_chunks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL,             -- FK → pdf_documents.id
  chunk_index INTEGER NOT NULL,
  content     TEXT    NOT NULL,
  created_at  TEXT    DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────────────────────────────────────────
-- PDF STRUCTURED  (données structurées extraites des PDFs)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pdf_structured (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL,
  field_name  TEXT    NOT NULL,
  field_value TEXT,
  created_at  TEXT    DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────────────────────────────────────────
-- USERS  (comptes administrateurs)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT    NOT NULL UNIQUE,
  password   TEXT    NOT NULL,             -- PBKDF2-SHA256 avec sel (100 000 itérations)
  nom        TEXT,
  role       TEXT    DEFAULT 'user',       -- admin | user
  created_at TEXT    DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────────────────────────────────────────
-- SESSIONS  (sessions admin — HttpOnly cookie)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT    PRIMARY KEY,          -- UUID v4
  user_id    INTEGER NOT NULL,             -- FK → users.id
  created_at TEXT    DEFAULT (datetime('now')),
  expires_at TEXT    NOT NULL              -- datetime('now', '+8 hours')
);

-- ─────────────────────────────────────────────────────────────────────────────
-- LOGIN ATTEMPTS  (rate limiting — 5 essais / 15 min par email)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS login_attempts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT    NOT NULL,
  attempted_at TEXT  DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────────────────────────────────────────
-- INDEX
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_lots_programme     ON lots(programme_nom);
CREATE INDEX IF NOT EXISTS idx_acquereurs_lot     ON acquereurs(programme_nom, lot_num);
CREATE INDEX IF NOT EXISTS idx_leads_statut       ON leads(statut);
CREATE INDEX IF NOT EXISTS idx_sessions_user      ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires   ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_login_email        ON login_attempts(email, attempted_at);
CREATE INDEX IF NOT EXISTS idx_pdf_chunks_doc     ON pdf_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_pdf_docs_programme ON pdf_documents(programme_nom);
