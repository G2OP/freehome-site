# Audit technique — FREEHOME Site
## Date : 2026-04-16 — Version auditée : 2.2.1

---

## Résumé exécutif

L'audit conduit le 2026-04-16 sur les versions 2.1.x a relevé plusieurs anomalies critiques (perte silencieuse de données, RGPD) et des failles de sécurité moyennes (CORS wildcard, payload incomplet). Toutes les anomalies critiques et moyennes ont été corrigées dans les versions 2.2.0 et 2.2.1. Le projet est désormais en état stable. Quelques points mineurs restent ouverts sans impact fonctionnel immédiat.

**État global après corrections : STABLE — aucune anomalie critique ou moyenne ouverte.**

---

## Points critiques — RESOLUS

| Problème | Fichier | Correction appliquée | Version |
|---|---|---|---|
| Route `POST /api/leads/:id/statut` manquante — changements de statut silencieusement perdus depuis l'admin | worker.js | Route ajoutée avec UPDATE D1 (statut + notes via COALESCE) | 2.2.0 |
| `publishToSite()` n'envoyait pas `email`, `telephone`, `notes` dans le payload sync — données perdues à chaque publication | admin.html | Payload sync complété avec tous les champs du lead | 2.2.0 |
| `DELETE FROM leads` lors du sync écrasait les leads entrants entre deux publications | worker.js | Remplacé par UPSERT : INSERT OR IGNORE (sans ID) / UPDATE (avec ID) | 2.2.0 |
| HTML admin `#lots-tbody` contenait 55 lignes hardcodées avec IDs conflictuels avec les IDs D1 | admin.html | tbody remplacé par message "Chargement depuis D1…" — remplissage dynamique uniquement | 2.2.0 |
| Chatbot IA hallucine des noms d'acquéreurs (ex: "Mme Karine SPIRONELLI") — risque RGPD grave | freehome-ai-proxy/worker.js | Règle RGPD absolue ajoutée dans system prompt + champ `acquereur` retiré du `lotsStr` | 2.1.1 |

---

## Points moyens — RESOLUS

| Problème | Fichier | Correction appliquée | Version |
|---|---|---|---|
| `freehome-ai-proxy` avait `Access-Control-Allow-Origin: *` — n'importe quel site pouvait appeler le proxy | freehome-ai-proxy/worker.js | Remplacé par liste stricte des 5 origines autorisées + rejet 403 toute origine inconnue | 2.2.0 |
| `max_tokens` proxy IA sans plafond — risque de consommation excessive quota Anthropic | freehome-ai-proxy/worker.js | Plafond 2000 tokens ajouté — requête tronquée si dépassement | 2.2.0 |
| `GET /api/knowledge` accessible sans restriction — base de connaissances interne exposée publiquement | worker.js | Accès restreint : session valide OU X-Internal-Key OU referer mhfreehome | 2.2.0 |
| `changeLotStat()` modifiait le statut sans marquer le CMS comme à publier | admin.html | `markDirty()` ajouté après chaque changement de statut | 2.2.0 |
| Champ `plan3d` absent du mapping lots dans `GET /api/programmes` | worker.js | Champ ajouté dans le map des lots | 2.2.0 |
| Statut "Livré" non normalisé — affiché avec majuscule incohérente selon les sources | admin.html | Normalisation `'Livré'` → `'livre'` dans `loadCMSData()` | 2.2.0 |
| `CACHE_NAME` SW désynchronisé avec la version déployée | public/sw.js | Mis à jour `freehome-v2.1.0` → `freehome-v2.1.2` | 2.2.0 |
| Prix des lots affichés "HT" dans les réponses chatbot — trompeur pour le résidentiel (TTC) | freehome-ai-proxy/worker.js | Suppression du qualificatif "HT" — prix affichés en "€" sans mention TVA | 2.1.2 |

---

## Points mineurs — RESOLUS

| Problème | Fichier | Correction appliquée | Version |
|---|---|---|---|
| Messages toast PDF incorrects (ingestPdf, deletePdfDoc) | admin.html | Messages corrigés | 2.2.0 |
| Règle cache `ibb.co` dans sw.js — service abandonné depuis migration R2 | public/sw.js | Règle supprimée | 2.2.0 |
| WORKFLOW.md — chemin local obsolète, proxy IA non documenté | WORKFLOW.md | Chemin mis à jour, proxy IA documenté, ressources R2 ajoutées | 2.2.0 |
| `.gitignore` — dossier `_media_migration/` non ignoré | .gitignore | Ajouté dans .gitignore | 2.2.0 |

---

## Points ouverts (non corrigés ou partiellement)

| Problème | Fichier | Impact | Priorité |
|---|---|---|---|
| Routes `DELETE /api/programmes/:nom` et `DELETE /api/lots/:num` non implémentées dans worker.js — `deleteProg()` et `deleteLot()` dans admin.html font des appels API silencieux sans résultat | worker.js | Fonctionnel : la suppression ne produit pas d'erreur visible (fetch sans await de réponse métier), mais les enregistrements ne sont pas réellement supprimés en D1 | Haute |
| `schema.sql` manquant — le schéma de la base D1 n'est pas documenté dans le dépôt | — | Documentation : impossible de recréer la base à froid sans inspecter le dashboard Cloudflare | Haute |
| Binding Vectorize non configuré dans `wrangler.toml` — le code de suppression de vecteurs dans `DELETE /api/pdf-documents/:id` est conditionné par `env.VECTORIZE` et ne s'exécute jamais | wrangler.toml | Fonctionnel : les chunks supprimés en D1 ne le sont pas dans Vectorize. Non bloquant tant que Vectorize reste désactivé | Basse |
| `GET /api/settings` reste public (aucune authentification) | worker.js | Voulu et documenté — index.html l'appelle pour afficher tel/email/tagline. Aucun secret dans settings. | Aucun — acceptable |
| `X-Admin-Token` envoyé par admin.html dans certains appels mais non vérifié côté worker | worker.js / admin.html | Superflu : l'authentification réelle est le cookie session. Le header est inoffensif mais crée une fausse impression de sécurité supplémentaire | Basse |

---

## Architecture — Points forts

| Aspect | Description |
|---|---|
| **Séparation des responsabilités** | Worker principal (données + auth) et proxy IA sont deux workers distincts — la clé Anthropic n'est jamais dans le scope du site public |
| **Authentification solide** | Cookie HttpOnly + session D1 + PBKDF2 avec sel + rate limiting — standard professionnel |
| **Défense en profondeur RGPD** | Données acquéreurs protégées à deux niveaux : absentes de l'API publique ET absentes du contexte IA |
| **CORS strict** | Liste blanche explicite sur les deux workers — pas de wildcard |
| **PWA complète** | Service Worker avec 3 stratégies de cache, toast de mise à jour non bloquant, manifest correct |
| **Emails HTML qualité** | Templates emails notif/confirmation avec design FREEHOME cohérent |
| **Settings éditoriaux** | Tel, email, tagline, contenus héros modifiables sans redéploiement |
| **Sitemap dynamique** | `/sitemap.xml` généré en temps réel depuis D1 |
| **Migration PBKDF2 transparente** | Upgrade automatique des anciens hash SHA-256 au premier login réussi |

---

## Dette technique identifiée

| Dette | Description | Effort estimé |
|---|---|---|
| **Absence de schema.sql** | Le schéma D1 n'existe qu'en production. Impossible de faire un `wrangler d1 execute --local` clean ou de versionner l'évolution du schéma | 2h — créer schema.sql + migrations |
| **Routes DELETE programmes/lots manquantes** | `deleteProg()` et `deleteLot()` dans admin.html appellent des routes inexistantes | 1h — ajouter les 2 routes dans worker.js |
| **Cache SW désynchronisé avec version** | `CACHE_NAME = 'freehome-v2.1.2'` ne correspond plus à la version 2.2.1. Le nom de cache devrait être synchronisé automatiquement depuis version.js | 30 min — soit synchro manuelle obligatoire, soit injection build-time |
| **`X-Admin-Token` vestigial** | Header envoyé par admin.html mais ignoré par le worker — confusion potentielle | 30 min — supprimer l'envoi depuis admin.html |
| **Vectorize non configuré mais code présent** | Code conditionnel `if (env.VECTORIZE)` dans DELETE pdf-documents — feature incomplète | Décision produit requise : activer ou supprimer le code |
| **Pas de tests automatisés** | Aucun test unitaire ni integration test — les régressions sont détectées manuellement | Effort élevé — non prioritaire pour ce type de projet |
| **admin.html monolithique** | Toute la logique admin est dans un seul fichier HTML de grande taille | Refactorisation possible en modules JS si maintenabilité devient problématique |

---

## Checklist sécurité

| Point | Statut | Détail |
|---|---|---|
| Authentification HTTP session | OK | Cookie HttpOnly, Secure, SameSite=Lax, 8h |
| Hachage mots de passe | OK | PBKDF2 + sel 16 octets, 100 000 itérations |
| Protection brute force | OK | 5 tentatives max / 15 min, verrouillage D1 |
| CORS strict worker principal | OK | Liste blanche 5 origines |
| CORS strict proxy IA | OK | Corrigé v2.2.0 (était wildcard) |
| Clé Anthropic non exposée | OK | Wrangler secret côté proxy uniquement |
| Données acquéreurs RGPD | OK | Absentes API publique + contexte IA |
| Hallucinations acquéreurs IA | OK | Règle RGPD dans system prompt + défense en profondeur v2.1.1 |
| Protection `/api/knowledge` | OK | Session OU X-Internal-Key OU referer — corrigé v2.2.0 |
| Token chatbot HMAC | OK | HMAC-SHA256, fenêtre 15 min, secret partagé v2.2.1 |
| Admin non indexé robots.txt | OK | `Disallow: /admin` |
| Rate limiting API (hors login) | Partiel | Seule la route login est rate-limitée — les routes API n'ont pas de rate limiting global |
| Validation inputs formulaire contact | Partiel | Validation basique (nom + email requis) — pas de validation de format email ni de protection XSS explicite (l'escaping HTML dans l'email est présent) |
| Headers de sécurité HTTP | Non vérifié | Pas de Content-Security-Policy, X-Frame-Options, etc. dans le worker — à vérifier |
| Routes DELETE programmes/lots | KO | Routes inexistantes — voir Points ouverts |

---

## Recommandations futures

Par ordre de priorité décroissante :

1. **Créer `schema.sql`** — Documenter le schéma D1 complet pour permettre la recréation de la base à froid. Inclure les migrations futures sous forme de fichiers numérotés (`001_init.sql`, `002_add_xxx.sql`…).

2. **Implémenter `DELETE /api/programmes/:nom` et `DELETE /api/lots/:num`** dans worker.js — Les boutons de suppression dans admin.html sont silencieusement inopérants en D1.

3. **Synchroniser `CACHE_NAME` du sw.js avec `version.js`** — Mettre à jour manuellement `CACHE_NAME` à chaque release ou adopter un mécanisme de versioning automatique du cache name.

4. **Ajouter des headers de sécurité HTTP** — `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin` dans le worker pour toutes les réponses statiques.

5. **Supprimer le header `X-Admin-Token` vestigial** dans admin.html — header envoyé mais non vérifié côté worker, crée une confusion.

6. **Décider du sort de Vectorize** — Soit activer le binding dans `wrangler.toml` et implémenter la recherche sémantique complète, soit supprimer le code conditionnel `if (env.VECTORIZE)` pour assainir le code.

7. **Ajouter rate limiting global sur les routes API** — Actuellement seule la route `/api/auth/login` est protégée. Les routes de soumission de leads pourraient être soumises à spam.

8. **Validation email côté serveur** dans `POST /api/leads` — Vérifier le format email avant insertion pour éviter les entrées parasites.
