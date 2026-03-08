# Freehome Site

Site web + espace admin pour les programmes immobiliers Freehome.

**Production :** https://freehome.mhfreehome.workers.dev

## Stack
- **Worker** — Cloudflare Workers (serveur + API)
- **Frontend** — HTML/CSS/JS vanilla (inclus dans `public/`)
- **DB** — Cloudflare D1 (SQLite)
- **Assets** — Cloudflare Assets binding

## Développement local

```bash
npx wrangler dev   # http://localhost:8787
```

## Déploiement

```bash
./deploy.sh        # wrangler deploy + git push
```

## Structure
```
freehome-site/
├── worker.js          — logique serveur (Worker)
├── public/
│   ├── index.html     — site public
│   └── admin.html     — interface admin
└── wrangler.toml
```

## Ressources Cloudflare
| Ressource | Nom |
|-----------|-----|
| Worker | `freehome-site` |
| D1 | `mhfreehome-db` |
