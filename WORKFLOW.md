# WORKFLOW — FREEHOME-SITE

## ⚠️ RÈGLE ABSOLUE
**Ne jamais utiliser `wrangler deploy` directement.**
**Tout déploiement passe par `git push`.**

## Déployer une modification
```bash
git add -A
git commit -m "description"
git push
```
→ GitHub Actions déploie automatiquement sur Cloudflare Workers en 1-2 min.

## Vérifier le déploiement
https://github.com/mhfreehome-ctrl/freehome-site/actions

## Repo GitHub
https://github.com/mhfreehome-ctrl/freehome-site
