# Changelog — FREEHOME Site

## [2.3.0] — 2026-04-18

### Nouvelles fonctionnalités
- **Pages programme SSR** : route `GET /programme/:slug` dans le Worker — génère une page HTML complète par programme depuis D1, sans déploiement requis. Chaque nouveau programme avec un slug dans l'admin génère automatiquement sa page.
- **Deux modes visuels** : `simulateur_actif=0` → design résidentiel vert (#16a34a) ; `simulateur_actif=1` → design institutionnel orange (#FF4614) + simulateur investisseur complet.
- **Simulateur investisseur DNK** extrait en fichier standalone `/js/simulateur-dnk.js` — chargé uniquement sur DYNAMIK PARK (optimisation). Inclut : TRI Newton-Raphson, projection 20 ans, toggles bailleur/locataire, export PDF jsPDF.
- **SEO pages programme** : `<title>`, `<meta description>`, `<link rel="canonical">`, Open Graph, `<script type="application/ld+json">` RealEstateListing.
- **Formulaire contact inline** : chaque page programme contient un formulaire de contact pré-rempli avec le nom du programme → POST /api/leads.
- **Sitemap dynamique mis à jour** : utilise désormais les vrais slugs D1 (`/programme/:slug`) au lieu des slugs générés à la volée.

### Infrastructure
- **`public/js/` créé** : répertoire de fichiers JS statiques dédiés aux pages SSR.
- **Migrations D1 0001 + 0002** : colonnes `slug`, `seo_title`, `seo_description`, `simulateur_actif` ajoutées à la table `programmes`; slugs et données SEO seedés pour les 5 programmes actifs.

## [2.2.3] — 2026-04-18

### Correctifs
- **Programmes fantômes** : `loadCMSData()` supprime désormais du tableau statique tout programme absent de D1 (ex : programme AUGNY supprimé depuis l'admin mais qui restait affiché sur le site car présent dans le tableau statique).
- **Domaine corrigé partout** : toutes les références `mhfreehome.fr` remplacées par `mhfreehome.com` (canonical, og:url, schema.org, emails de confirmation, sitemap.xml, robots.txt). `mhfreehome.fr` renvoie vers l'ancien site PROMOGES — le domaine production est `.com`.
- **CORS nettoyé** : `mhfreehome.fr` et `www.mhfreehome.fr` retirés de la liste des origines autorisées dans le worker principal et le proxy IA. Seuls `.com` et le worker dev restent.
- **Meta description** : "Augny" retiré de la description (programme supprimé).

## [2.2.2] — 2026-04-16

### Correctifs
- **Routes DELETE manquantes** : `DELETE /api/programmes/:nom` et `DELETE /api/lots/:num` créées dans worker.js — les boutons Supprimer de l'admin persistaient en mémoire seulement. La suppression de programme efface en cascade lots + acquéreurs + PDFs associés.

### Documentation
- **`schema.sql`** : schéma complet de la base D1 créé à la racine — 12 tables, colonnes, types, contraintes, index
- **`AUDIT.md`** mis à jour : points clôturés déplacés, version corrigée à 2.2.2

## [2.2.1] — 2026-04-16

### Sécurité — Token HMAC proxy IA
- **Token court-terme HMAC-SHA256** : le chatbot IA obtient désormais un token signé (fenêtre 15 min) via `GET /api/chatbot-token` avant chaque session. Ce token est envoyé en header `X-Chat-Token` au proxy IA.
- **Proxy IA vérifie le token** : toute requête sans token valide → 403. Rend inutile tout appel direct au proxy sans passer par le site FREEHOME.
- **Secret partagé `PROXY_SHARED_SECRET`** : stocké uniquement côté serveur (wrangler secret), jamais exposé au navigateur. Doit être configuré via `npx wrangler secret put PROXY_SHARED_SECRET` sur les deux workers.

## [2.2.0] — 2026-04-16

### Correctifs critiques
- **Route `POST /api/leads/:id/statut` manquante** : les changements de statut leads depuis l'admin étaient silencieusement perdus — route ajoutée dans worker.js avec UPDATE D1 (statut + notes)
- **Leads sync — perte email/téléphone** : `publishToSite()` n'envoyait pas `email`, `telephone`, `notes` dans le payload sync → données perdues à chaque publication. Payload complété + `DELETE FROM leads` remplacé par UPSERT (INSERT OR IGNORE / UPDATE by id) pour préserver les leads entrants
- **HTML admin tbody statique** : le tbody `#lots-tbody` contenait 55 lignes hardcodées avec IDs 1–55 conflictuels avec les IDs D1. Remplacé par un message "Chargement depuis D1…"

### Sécurité
- **Proxy IA CORS wildcard corrigé** : `freehome-ai-proxy` avait `Access-Control-Allow-Origin: *` — remplacé par liste stricte des 5 origines autorisées + rejet 403 pour toute origine non reconnue
- **Plafond max_tokens proxy IA** : limité à 2000 pour éviter les abus de quota Anthropic
- **GET /api/knowledge protégé** : accès restreint — session valide, X-Internal-Key ou referer mhfreehome requis (proxy IA utilise X-Internal-Key)

### Correctifs moyens
- **`changeLotStat()` sans persistance** : ajout de `markDirty()` pour signaler qu'une publication est nécessaire
- **`deleteProg()` / `deleteLot()`** : ajout d'appels API DELETE (silencieux si route absente) + `markDirty()`
- **`plan3d` lots absent de l'API** : champ `plan3d` ajouté dans le mapping lots de `GET /api/programmes`
- **Statut "Livré" non normalisé** : normalisation `'Livré'` → `'livre'` ajoutée dans `loadCMSData()`
- **CACHE_NAME SW désynchronisé** : mis à jour `freehome-v2.1.0` → `freehome-v2.1.2`

### Correctifs mineurs
- **Messages toast PDF incorrects** : corrigés pour ingestPdf et deletePdfDoc
- **Règle cache ibb.co obsolète** : supprimée du sw.js (migration R2 déjà faite)
- **TODO Vectorize** : commentaire ajouté sur le binding non configuré dans wrangler.toml

### Documentation & infrastructure
- **WORKFLOW.md** : chemin local mis à jour, proxy IA documenté, ressources R2 ajoutées
- **`.gitignore`** : ajout de `_media_migration/`

## [2.1.2] — 2026-04-16

### Correctifs
- **Chatbot IA — prix affichés "HT" à tort** : le `lotsStr` injecté dans le system prompt mentionnait `€ HT` pour tous les lots alors que les programmes résidentiels sont en TTC. Suppression du qualificatif HT — le prix est maintenant affiché en `€` sans mention HT/TTC (chaque programme a sa propre nature TVA).

## [2.1.1] — 2026-04-16

### Correctifs securite — RGPD CRITIQUE
- **Chatbot IA — hallucination noms acquereurs** : le Conseiller IA generait des noms d'acquéreurs fictifs pour les lots Réservés/Vendus (ex: "Mme Karine SPIRONELLI"), créant un risque RGPD grave même sans vraie fuite de données
- **Règle RGPD dans system prompt** : ajout instruction absolue — ne jamais mentionner, inventer ni deviner le nom d'un acquéreur, dire uniquement "lot réservé" ou "lot vendu"
- **Suppression `acquereur` du contexte IA** : le champ `l.acquereur` retiré du `lotsStr` injecté dans le prompt (défense en profondeur — était déjà absent de l'API publique)

## [2.1.0] — 2026-03-31

### Nouvelles fonctionnalites
- **Tabs navigation fiche programme** : barre Le programme / Prestations / Galerie / Video & 3D / Lots disponibles toujours visible (scroll interne du corps, tabs fixes au-dessus)
- **Lightbox galerie** : clic sur photo ouvre plein ecran avec navigation fleches, compteur, fermeture Echap
- **Cartes lots colorees** : remplacement tableau Excel par cartes flex avec points de couleur (vert Disponible / orange Reserve / rouge Vendu) — grille 2 colonnes desktop

### Correctifs
- **Bouton Reserver** : ferme la fiche avant de scroller vers contact (bug Windows overlay reste en avant-plan)
- **Tabs sticky** : fix architecture — prog-detail-body scroll en interne, tabs en dehors du conteneur scrollant

### Contenu & Admin
- **100% contenu parametrable** : tous les elements du site (hero, stats, sections, FAQ, footer, coordonnees) editables depuis la console admin
- **Tel et email dynamiques** : repercutes sur toutes les sections (contact, FAQ, footer)

### Performance
- **Migration images vers Cloudflare R2** : 9 images migrees de ibb.co vers R2 (pub-3105...)
- **Compression images** : reduction ~85% taille moyenne (PIL JPEG quality 80)

## [2.0.0] — 2026-03-28

### Nouvelles fonctionnalites
- **PWA complète** : manifest.json, Service Worker, icones, installation sur ecran d'accueil
- **Mode offline** : cache app shell, API avec fallback, bandeau hors-ligne
- **Background Sync formulaire** : sauvegarde locale des demandes contact si hors-ligne, envoi automatique au retour
- **Toast mise a jour PWA** : detection nouvelle version + bouton "Mettre a jour"
- **Badge version** : v2.0.0 affiche dans le footer

### Refonte majeure
- **CSS mobile first** : toutes les media queries reecrites en `min-width` (zero `max-width`)
- **Police DM Sans** : remplacement Open Sans + Cormorant Garamond + Inter
- **Variables CSS standard** : adoption du systeme CLAUDE.md (`--color-*`, `--space-*`, `--radius-*`)
- **Dark mode** : variables CSS pour `prefers-color-scheme: dark`
- **Admin responsive** : sidebar collapsible avec hamburger, layout mobile, tableaux scrollables

### Accessibilite
- **:focus-visible** sur tous les elements interactifs (21 occurrences)
- **prefers-reduced-motion** : animations desactivables
- **Touch targets 44px** minimum sur tous les boutons, liens, nav
- **Input font-size 16px** : evite le zoom iOS sur les champs de formulaire

### Infrastructure
- Branche `develop` creee pour staging
- Backups locaux securises (`_backup_avant_pwa/`, `_backup_workers/`)
- `version.js` — source unique de verite
- `sw.js` avec strategies Cache First / Network First / Stale While Revalidate

---

## [1.0.0] — 2026-03-08

### Version initiale
- **Site public** : page vitrine programmes immobiliers (index.html)
- **Admin** : interface de gestion programmes, lots, leads (admin.html)
- **API Worker** : Cloudflare Workers avec D1 (sessions, programmes, lots, leads, sync)
- **SEO** : Schema.org, Open Graph, FAQ structuree
- **CI/CD** : GitHub Actions → Cloudflare Workers deploy

### Historique pre-versionning
- `8385abb` — init: commit initial
- `82b0a23` — chore: ignore .wrangler cache
- `566a51c` — sync: mise a jour depuis production
- `1b18959` — ci: deploy automatique GitHub Actions
- `e626ac1` — docs: WORKFLOW.md
- `cc92ee0` → `d8f21d6` — ci: corrections wrangler deploy
- `95d922f` — chore: deploy.sh + WORKFLOW.md
- `581e4d9` — docs: README.md
