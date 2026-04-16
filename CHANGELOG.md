# Changelog — FREEHOME Site

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
