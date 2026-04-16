# WORKFLOW — freehome-site

## Déploiement

```bash
cd "/Volumes/Crucial X9 Pro For Mac/SynologyDrive/03 - ETUDES DEVELLOPEMENT EN COURS/CLAUDE DT/freehome-site"
./deploy.sh
```

Ce script fait les deux en une commande :
1. **Cloudflare** → `wrangler deploy` (mise en ligne immédiate)
2. **GitHub** → `git push` (backup du code)

## Structure
- `worker.js` — Worker Cloudflare (logique serveur + API)
- `public/` — Assets statiques (index.html, admin.html, sw.js, manifest.json, version.js)
- `wrangler.toml` — Config Cloudflare (D1 + assets binding)

## Composants associés
- **freehome-ai-proxy** — Worker séparé pour le chatbot IA (proxy Anthropic + injection PDFs R2)
  - Dossier : `../freehome-ai-proxy/`
  - Déploiement indépendant : `cd ../freehome-ai-proxy && npx wrangler deploy`

## Ressources Cloudflare
- Worker principal : `freehome-site` → freehome-site.mhfreehome.workers.dev
- Worker IA proxy : `freehome-ai-proxy` → freehome-ai-proxy.mhfreehome.workers.dev
- D1 : `mhfreehome-db` (c8db2491-df07-4e48-af35-ffb0dfb979d7)
- R2 : `freehome-pdfs` (PDFs programmes — documents techniques)
- GitHub : github.com/G2OP/freehome-site

## Versionning
- Fichier source de vérité : `public/version.js`
- Incrémenter avant chaque deploy + mettre à jour `CHANGELOG.md`
- Format semver : X.Y.Z (patch=bugfix, minor=feature, major=refonte)

## ⚠️ Règles
- Ne jamais modifier directement sur le dashboard Cloudflare sans sauvegarder le code en local + git
- Toujours commiter AVANT de déployer (voir CLAUDE.md règle N°1)
- Déployer le proxy IA en même temps que le worker principal si des changements impactent l'API knowledge
