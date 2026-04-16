# FREEHOME Site — Documentation technique

Version actuelle : **2.2.1** — Dernière mise à jour : 2026-04-16

---

## Vue d'ensemble

Site vitrine PWA pour **Maison & Habitat FREEHOME**, promoteur immobilier en région Grand Est. Le site présente les programmes immobiliers neufs, permet aux visiteurs de soumettre une demande de contact, et intègre un chatbot IA conseiller.

| URL | Rôle |
|---|---|
| https://www.mhfreehome.fr | Production (domaine custom) |
| https://mhfreehome.com | Alias production |
| https://freehome-site.mhfreehome.workers.dev | Worker direct (Cloudflare) |

---

## Architecture

```
Navigateur
    │
    ├── GET / (index.html)           ← Page publique programmes
    ├── GET /admin.html              ← Back-office (auth requise)
    │
    └── /api/*
          │
          ├── Worker principal (freehome-site)
          │       └── D1 : mhfreehome-db
          │
          └── Worker IA proxy (freehome-ai-proxy)
                  ├── D1 : mhfreehome-db (base de connaissances)
                  └── R2 : freehome-pdfs (PDFs techniques)
```

Le Worker principal sert à la fois les assets statiques (`env.ASSETS`) et l'API. La configuration `run_worker_first = true` dans `wrangler.toml` garantit que le Worker intercepte toutes les requêtes avant la distribution des assets.

---

## Stack technique

| Composant | Technologie | Rôle |
|---|---|---|
| Worker principal | Cloudflare Workers (JS) | API REST + routage des assets |
| Worker IA proxy | Cloudflare Workers (JS) | Proxy Anthropic + injection PDFs + base de connaissances |
| Base de données | Cloudflare D1 (SQLite) | Programmes, lots, leads, utilisateurs, settings |
| Stockage fichiers | Cloudflare R2 | PDFs techniques des programmes |
| Service Worker | sw.js (Vanilla JS) | PWA : cache offline, background sync |
| Frontend public | HTML/CSS/JS (Vanilla) | index.html — site vitrine |
| Frontend admin | HTML/CSS/JS (Vanilla) | admin.html — back-office CMS |
| Emails transactionnels | Resend API | Notification admin + confirmation lead |
| Police | DM Sans (Google Fonts) | Charte FREEHOME |
| Versioning | version.js | Source unique de vérité |

---

## Ressources Cloudflare

| Type | Nom | ID | Rôle |
|---|---|---|---|
| Worker | freehome-site | — | Worker principal + assets |
| Worker | freehome-ai-proxy | — | Proxy chatbot IA |
| D1 Database | mhfreehome-db | c8db2491-df07-4e48-af35-ffb0dfb979d7 | Base de données principale |
| R2 Bucket | freehome-pdfs | — | PDFs techniques (notices, grilles de vente) |

GitHub : github.com/G2OP/freehome-site

---

## Structure des fichiers

```
freehome-site/
├── worker.js              ← Worker Cloudflare : toute la logique API + auth
├── wrangler.toml          ← Config : bindings D1, assets, nom du worker
├── deploy.sh              ← Script de déploiement (wrangler deploy + git push)
├── WORKFLOW.md            ← Procédures déploiement
├── CHANGELOG.md           ← Historique des versions
├── README.md              ← Ce fichier
├── AUDIT.md               ← Rapport d'audit technique
└── public/                ← Assets statiques servis par Cloudflare
    ├── index.html         ← Page vitrine publique
    ├── admin.html         ← Interface d'administration (CMS)
    ├── sw.js              ← Service Worker PWA
    ├── manifest.json      ← Manifeste PWA
    ├── version.js         ← Version + date de build (SOURCE DE VERITE)
    └── icons/             ← Icônes PWA (icon-192.png, icon-512.png, icon-maskable-512.png)

freehome-ai-proxy/         ← Worker séparé (dossier frère)
├── worker.js              ← Proxy Anthropic + injection PDFs R2 + knowledge base
└── wrangler.toml          ← Config : bindings D1, R2, nom du worker
```

---

## Base de données D1 — Tables

Toutes les tables sont dans la base `mhfreehome-db` (partagée avec le proxy IA).

### `programmes`
Catalogue des programmes immobiliers neufs.

| Colonne | Type | Description |
|---|---|---|
| id | INTEGER PK | Identifiant auto |
| nom | TEXT UNIQUE | Nom du programme (clé métier — utilisée comme clé étrangère) |
| commune | TEXT | Ville |
| cp | TEXT | Code postal |
| adresse | TEXT | Adresse complète |
| statut | TEXT | Ex: "En commercialisation" |
| reglementation | TEXT | Ex: "RE2020" |
| livraison | TEXT | Date de livraison |
| livraison_detail | TEXT | Détail texte livraison |
| debut_travaux | TEXT | Date début travaux |
| lots_total | INTEGER | Nombre total de lots |
| pieces | TEXT | Types de pièces disponibles |
| surface_min | REAL | Surface minimale (m²) |
| surface_max | REAL | Surface maximale (m²) |
| prix_min | REAL | Prix minimal (€) |
| prix_max | REAL | Prix maximal (€) |
| eligibilites | TEXT | JSON array ou CSV des dispositifs (PTZ, Pinel…) |
| plan3d | TEXT | URL plan 3D |
| youtube | TEXT | ID ou URL vidéo YouTube |
| img_cover | TEXT | URL image de couverture (R2 ou externe) |
| photos | TEXT | JSON array d'URLs photos |
| desc_courte | TEXT | Description courte (listing) |
| desc_longue | TEXT | Description longue (fiche programme) |
| atouts | TEXT | JSON array des points forts |
| prestations | TEXT | JSON array des prestations |
| timeline | TEXT | JSON array du calendrier |
| updated_at | TEXT | Horodatage dernière modification |

### `lots`
Lots individuels de chaque programme.

| Colonne | Type | Description |
|---|---|---|
| id | INTEGER PK | Identifiant auto |
| programme_nom | TEXT | Clé étrangère → programmes.nom |
| num | TEXT | Numéro du lot |
| etage | TEXT | Étage |
| typo | TEXT | Typologie (T2, T3…) |
| surface | REAL | Surface (m²) |
| prix | REAL | Prix (€) |
| statut | TEXT | "Disponible" / "Réservé" / "Vendu" / "livré" |
| acquereur | TEXT | Nom acquéreur (dénormalisé depuis acquereurs pour accès rapide) |
| plan3d | TEXT | URL ou flag plan 3D |
| updated_at | TEXT | Horodatage |

### `leads`
Demandes de contact issues du formulaire public ou de l'admin.

| Colonne | Type | Description |
|---|---|---|
| id | INTEGER PK | Identifiant auto |
| prenom | TEXT | Prénom |
| nom | TEXT | Nom (requis) |
| email | TEXT | Email (requis) |
| telephone | TEXT | Téléphone |
| programme | TEXT | Programme d'intérêt |
| typo | TEXT | Typologie souhaitée |
| budget | TEXT | Budget |
| statut | TEXT | "Nouveau", "En cours", "Converti"… |
| source | TEXT | "Site web" (formulaire public) ou "Admin" |
| priorite | TEXT | "h" (haute) / "l" (basse) |
| notes | TEXT | Notes conseiller |
| updated_at | TEXT | Horodatage |

### `acquereurs`
Fiche détaillée des acquéreurs par lot (protégée — non exposée au site public ni au chatbot IA).

| Colonne | Type | Description |
|---|---|---|
| id | INTEGER PK | Identifiant auto |
| programme_nom | TEXT | Clé étrangère |
| lot_num | TEXT | Numéro du lot (UNIQUE avec programme_nom) |
| nom | TEXT | Nom acquéreur |
| prenom | TEXT | Prénom |
| email | TEXT | Email |
| telephone | TEXT | Téléphone |
| statut | TEXT | "Réservé", "Acte signé"… |
| date_reservation | TEXT | Date de réservation |
| date_acte | TEXT | Date de signature acte |
| date_livraison | TEXT | Date de livraison prévue |
| notes | TEXT | Notes libres |
| updated_at | TEXT | Horodatage |

### `users`
Comptes administrateurs.

| Colonne | Type | Description |
|---|---|---|
| id | INTEGER PK | Identifiant auto |
| nom | TEXT | Nom affiché |
| email | TEXT UNIQUE | Email de connexion |
| password_hash | TEXT | PBKDF2 "saltHex:hashHex" (100k itérations) ou SHA-256 legacy |
| role | TEXT | "admin" ou "editeur" |
| actif | INTEGER | 0 ou 1 |
| last_login | TEXT | Dernière connexion |
| created_at | TEXT | Date création |
| updated_at | TEXT | Dernière modification |

### `sessions`
Sessions authentifiées stockées côté serveur.

| Colonne | Type | Description |
|---|---|---|
| id | TEXT PK | UUID v4 (valeur du cookie fh_session) |
| user_id | INTEGER | FK → users.id |
| expires_at | TEXT | Expiration (8h après création) |

### `settings`
Paramètres éditoriaux du site (modifiables depuis l'admin sans redéploiement).

| Colonne | Type | Description |
|---|---|---|
| key | TEXT PK | Ex: "hero_titre", "tel", "email", "tagline" |
| value | TEXT | Valeur correspondante |
| updated_at | TEXT | Horodatage |

### `knowledge_base`
Base de connaissances injectée dans le system prompt du chatbot IA.

| Colonne | Type | Description |
|---|---|---|
| id | INTEGER PK | Identifiant auto |
| categorie | TEXT | "programme", "vefa", ou catégorie libre |
| titre | TEXT | Titre de l'entrée (UNIQUE avec categorie) |
| contenu | TEXT | Texte libre (markdown) |
| updated_at | TEXT | Horodatage |

### `pdf_documents`
Référentiel des PDFs stockés dans R2 (notices descriptives, grilles de vente…).

| Colonne | Type | Description |
|---|---|---|
| id | INTEGER PK | Identifiant auto |
| programme_id | INTEGER | FK optionnelle → programmes.id |
| programme_nom | TEXT | Nom du programme |
| doc_type | TEXT | "notice_descriptive", "notice_synthetique", "referentiel_equipements", "grille_vente" |
| filename | TEXT | Nom du fichier |
| file_size_kb | INTEGER | Taille en Ko |
| status | TEXT | "done" ou "error" |
| r2_key | TEXT UNIQUE | Clé R2 : `{programme_nom}/{doc_type}/{filename}` |
| ingested_at | TEXT | Date d'ingestion (auto) |
| updated_at | TEXT | Dernière modification |

### `pdf_chunks`
Chunks de texte découpés des PDFs (préparation Vectorize — non activé).

| Colonne | Type | Description |
|---|---|---|
| id | INTEGER PK | Identifiant auto |
| document_id | INTEGER | FK → pdf_documents.id |
| chunk_index | INTEGER | Ordre du chunk dans le document |
| content | TEXT | Contenu textuel (~400 mots, 50 mots de chevauchement) |
| vectorize_id | TEXT | ID vecteur Vectorize (non utilisé — binding non configuré) |

### `pdf_structured`
Données structurées extraites des PDFs.

| Colonne | Type | Description |
|---|---|---|
| id | INTEGER PK | Identifiant auto |
| document_id | INTEGER | FK → pdf_documents.id |
| data_type | TEXT | Type de données extraites |
| content | TEXT | JSON structuré |

### `login_attempts`
Anti-brute force : compteur de tentatives de connexion par email.

| Colonne | Type | Description |
|---|---|---|
| email | TEXT PK | Email testé |
| attempts | INTEGER | Nombre de tentatives consécutives |
| locked_until | TEXT | Timestamp de fin de verrouillage (null si non verrouillé) |

---

## API — Routes disponibles

### Routes publiques (sans authentification)

| Méthode | Chemin | Description |
|---|---|---|
| GET | `/api/programmes` | Liste tous les programmes avec leurs lots (sans données acquéreurs) |
| GET | `/api/settings` | Paramètres éditoriaux du site (tel, email, tagline…) — public voulu |
| GET | `/api/chatbot-token` | Token HMAC court-terme (15 min) pour le chatbot IA |
| POST | `/api/leads` | Créer un lead depuis le formulaire de contact public |
| POST | `/api/auth/login` | Authentification — retourne cookie HttpOnly + token legacy base64 |
| POST | `/api/auth/logout` | Déconnexion — efface cookie + supprime session D1 |
| GET | `/sitemap.xml` | Sitemap XML généré dynamiquement depuis les programmes D1 |
| GET | `/robots.txt` | Robots.txt (interdit /admin) |
| GET | `/mentions-legales` | Redirect → mentions-legales.html |
| GET | `/politique-confidentialite` | Redirect → politique-confidentialite.html |
| GET | `/cgv` | Redirect → cgv.html |

### Routes authentifiées (session valide requise)

| Méthode | Chemin | Description |
|---|---|---|
| PUT | `/api/programmes/:nom` | Sauvegarder un programme en D1 (upsert par nom) |
| POST | `/api/sync` | Sync complète programmes + lots + leads depuis admin |
| GET | `/api/leads` | Liste tous les leads |
| POST | `/api/leads/:id/statut` | Mettre à jour le statut et les notes d'un lead |
| GET | `/api/acquereurs` | Liste tous les acquéreurs |
| POST | `/api/acquereurs` | Créer/modifier un acquéreur (upsert par programme+lot) |
| PUT | `/api/acquereurs/:id` | Mettre à jour une fiche acquéreur par ID |
| GET | `/api/knowledge` | Base de connaissances (aussi accessible via X-Internal-Key ou referer mhfreehome) |
| POST | `/api/knowledge` | Ajouter/remplacer une entrée knowledge base |
| DELETE | `/api/knowledge/:id` | Supprimer une entrée knowledge base |
| GET | `/api/pdf-documents` | Liste des PDFs ingérés dans R2 |
| DELETE | `/api/pdf-documents/:id` | Supprimer un PDF de D1 (et vecteurs si Vectorize actif) |
| POST | `/api/ingest-pdf` | Uploader un PDF (base64) → R2 + enregistrement D1 |

### Routes admin uniquement (rôle "admin" requis)

| Méthode | Chemin | Description |
|---|---|---|
| POST | `/api/settings` | Mettre à jour les paramètres éditoriaux |
| GET | `/api/users` | Liste des utilisateurs |
| POST | `/api/users` | Créer un utilisateur |
| PUT | `/api/users/:id` | Modifier un utilisateur (nom, email, rôle, mot de passe optionnel) |
| DELETE | `/api/users/:id` | Supprimer un utilisateur (et ses sessions) |

---

## Composant IA — freehome-ai-proxy

### Description

Worker séparé hébergé à `freehome-ai-proxy.mhfreehome.workers.dev`. Il sert de proxy sécurisé entre le chatbot intégré dans `index.html` et l'API Anthropic. Le navigateur ne connaît jamais la clé Anthropic.

### Fonctionnement

1. Le navigateur demande un token court-terme via `GET /api/chatbot-token` sur le worker principal
2. Le worker principal génère un HMAC-SHA256 signé avec `PROXY_SHARED_SECRET` (fenêtre glissante 15 min)
3. Le navigateur envoie ce token en header `X-Chat-Token` au proxy IA
4. Le proxy vérifie le token (fenêtre courante ET précédente — tolérance de chevauchement ~15 min)
5. Si valide, le proxy enrichit le contexte (PDFs R2 + knowledge base) et relaie à Anthropic

### Injection de contexte (pipeline proxy)

1. **PDFs R2** : si `programme_filter` est fourni dans le body, le proxy charge jusqu'à 3 PDFs depuis R2 (ordre de priorité : notice_descriptive > notice_synthetique > referentiel_equipements > grille_vente) et les joint au dernier message utilisateur en tant que blocs `document` Claude. Le modèle bascule automatiquement sur `claude-sonnet-4-5` quand des PDFs sont injectés.
2. **Knowledge base** : le proxy appelle `GET /api/knowledge` du worker principal (via `X-Internal-Key`) et injecte les articles groupés par catégorie dans le system prompt.

### Sécurité

- CORS strict : 5 origines autorisées — rejet 403 pour toute origine inconnue
- Token HMAC court-terme obligatoire (`PROXY_SHARED_SECRET` partagé entre les deux workers)
- Plafond `max_tokens = 2000` pour éviter les abus de quota Anthropic
- `ANTHROPIC_API_KEY` jamais exposé au navigateur

---

## PWA

### Manifeste (`public/manifest.json`)

| Champ | Valeur |
|---|---|
| name | FREEHOME — Programmes Immobiliers Neufs |
| short_name | FREEHOME |
| theme_color | #16a34a |
| display | standalone |
| start_url | / |
| Icônes | 192×192, 512×512, 512×512 maskable |

### Service Worker (`public/sw.js`)

Caches actifs : `freehome-v2.1.2` (assets) + `freehome-api-v1` (API)

| Stratégie | Ressources ciblées |
|---|---|
| Cache First | Google Fonts (fonts.googleapis.com, fonts.gstatic.com) |
| Network First avec fallback cache | Routes API `/api/*` |
| Stale While Revalidate | App shell et tous les autres assets |

Le Service Worker écoute le message `{ type: 'SKIP_WAITING' }` pour appliquer les mises à jour sans fermer l'onglet (toast de mise à jour non bloquant dans l'UI). `skipWaiting()` n'est délibérément PAS appelé à l'installation.

---

## Déploiement

### Worker principal (production)

```bash
cd "/Volumes/Crucial X9 Pro For Mac/SynologyDrive/03 - ETUDES DEVELLOPEMENT EN COURS/CLAUDE DT/freehome-site"

# ORDRE OBLIGATOIRE
git status                          # vérifier aucun fichier non commité
git add public/version.js CHANGELOG.md worker.js public/...
git commit -m "feat: ..."
npx wrangler deploy
git push origin main
# ou simplement :
./deploy.sh                         # script qui fait wrangler deploy + git push
```

### Proxy IA (déployer séparément si worker.js modifié)

```bash
cd "/Volumes/Crucial X9 Pro For Mac/SynologyDrive/03 - ETUDES DEVELLOPEMENT EN COURS/CLAUDE DT/freehome-ai-proxy"
npx wrangler deploy
```

---

## Développement local

```bash
# Worker principal
cd "/Volumes/.../freehome-site"
npx wrangler dev           # http://localhost:8787

# Proxy IA
cd "/Volumes/.../freehome-ai-proxy"
npx wrangler dev --port 8788
```

Variables locales nécessaires (fichier `.dev.vars` non commité) :

```
RESEND_API_KEY=re_xxxxx
PROXY_SHARED_SECRET=mon-secret-local
INTERNAL_KEY=fh-internal-local
```

---

## Secrets Cloudflare

### Worker `freehome-site`

```bash
npx wrangler secret put RESEND_API_KEY        # Envoi emails (Resend)
npx wrangler secret put PROXY_SHARED_SECRET   # HMAC partagé avec proxy IA
npx wrangler secret put INTERNAL_KEY          # Accès /api/knowledge sans session
```

### Worker `freehome-ai-proxy`

```bash
cd ../freehome-ai-proxy
npx wrangler secret put ANTHROPIC_API_KEY     # Clé API Anthropic
npx wrangler secret put PROXY_SHARED_SECRET   # Même valeur que worker principal
```

---

## Emails transactionnels

Expéditeur : `FREEHOME <noreply@mhfreehome.fr>` via Resend API.

Déclenchés automatiquement par `POST /api/leads` :
1. **Email interne** → `contact@mhfreehome.com` : fiche lead complète avec CTA vers l'admin
2. **Email de confirmation** → adresse du lead : récapitulatif de la demande + étapes suivantes

---

## Versionning

- **Source de vérité** : `public/version.js` — modifier uniquement ce fichier avant chaque deploy
- **Schéma semver** :
  - `Z` patch : bugfix, correction mineure, ajustement CSS
  - `Y` minor : nouvelle fonctionnalité, amélioration UX notable
  - `X` major : refonte, changement d'architecture
- **Workflow** : incrémenter `version.js` + mettre à jour `CHANGELOG.md` dans le même commit avant `wrangler deploy`

---

## Sécurité

| Mécanisme | Description |
|---|---|
| Cookie HttpOnly | Session admin `fh_session` (HttpOnly, Secure, SameSite=Lax, 8h) |
| PBKDF2 + sel | Mots de passe hashés PBKDF2 (100 000 itérations, sel 16 octets) — migration auto SHA-256 → PBKDF2 au premier login |
| Rate limiting login | Max 5 tentatives / 15 min par email — verrouillage en D1 (`login_attempts`) |
| CORS strict | Liste blanche de 5 origines sur les deux workers — rejet 403 sinon |
| Token HMAC chatbot | Token court-terme 15 min signé HMAC-SHA256 — protège le proxy IA des appels directs |
| RGPD acquéreurs | `acquereur` absent de `GET /api/programmes` et du contexte IA — double protection |
| Admin non indexé | `robots.txt` interdit `/admin` aux crawlers |
| Secrets côté serveur | `ANTHROPIC_API_KEY` et `RESEND_API_KEY` uniquement dans wrangler secrets |
