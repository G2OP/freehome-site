#!/bin/bash
set -e

echo "🚀 Déploiement freehome-site sur Cloudflare..."
npx wrangler deploy

echo ""
echo "📦 Push Git (backup)..."
git add -A
git commit -m "deploy: $(date '+%Y-%m-%d %H:%M')" 2>/dev/null || echo "Rien à commiter"
git push origin main

echo ""
echo "✅ Terminé — Cloudflare + GitHub mis à jour"
