# WORKFLOW — freehome-site

## Déploiement

```bash
cd /Users/imac/freehome-site
./deploy.sh
```

Ce script fait les deux en une commande :
1. **Cloudflare** → `wrangler deploy` (mise en ligne immédiate)
2. **GitHub** → `git push` (backup du code)

## Structure
- `worker.js` — Worker Cloudflare (logique serveur)
- `public/` — Assets statiques (index.html, admin.html, CSS, JS)
- `wrangler.toml` — Config Cloudflare (D1 + assets binding)

## Ressources Cloudflare
- Worker : `freehome-site`
- D1 : `mhfreehome-db` (c8db2491-df07-4e48-af35-ffb0dfb979d7)
- GitHub : github.com/mhfreehome-ctrl/freehome-site

## ⚠️ Règle
Ne jamais modifier directement sur le dashboard Cloudflare sans sauvegarder le code en local + git.
