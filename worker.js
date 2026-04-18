// worker.js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const allowedOrigins = [
      "https://mhfreehome.com",
      "https://www.mhfreehome.com",
      "https://freehome-site.mhfreehome.workers.dev"
    ];
    const origin = request.headers.get("Origin") || "";
    const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
    const corsHeaders = {
      "Access-Control-Allow-Origin": corsOrigin,
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SÉCURITÉ — Session helpers (cookie HttpOnly + D1)
    // ─────────────────────────────────────────────────────────────────────────
    const getSession = async () => {
      const cookie = request.headers.get('Cookie') || '';
      const m = cookie.match(/fh_session=([a-f0-9-]{36})/);
      if (!m) return null;
      try {
        return await env.DB.prepare(
          "SELECT s.id, s.user_id, u.email, u.role, u.nom FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.id=? AND s.expires_at > datetime('now')"
        ).bind(m[1]).first() || null;
      } catch(e) { return null; }
    };
    const unauth = () => new Response(JSON.stringify({ error: 'Non autorisé' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    const requireAuth = async () => { const s = await getSession(); return s ? null : unauth(); };
    const requireAdmin = async () => {
      const s = await getSession();
      if (!s) return unauth();
      if (s.role !== 'admin') return new Response(JSON.stringify({ error: 'Accès réservé aux administrateurs' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      return null;
    };

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/programmes
    // ─────────────────────────────────────────────────────────────────────────
    if (path === "/api/programmes" && request.method === "GET") {
      try {
        const progs = await env.DB.prepare("SELECT * FROM programmes ORDER BY id").all();
        const lots = await env.DB.prepare("SELECT * FROM lots ORDER BY programme_nom, num").all();
        const parseJ = (v, fallback=[]) => { if(Array.isArray(v)) return v; try { const r=JSON.parse(v); return Array.isArray(r)?r:fallback; } catch(e){ return fallback; } };
        const programmes = progs.results.map((p) => {
          const progLots = lots.results.filter((l) => l.programme_nom === p.nom);
          // Normaliser eligibilites : string CSV → array
          let eligibilites = p.eligibilites;
          if(typeof eligibilites === 'string') {
            // Peut être un JSON array ou un CSV
            try { eligibilites = JSON.parse(eligibilites); } catch(e) {
              eligibilites = eligibilites.split(',').map(s=>s.trim()).filter(Boolean);
            }
          }
          if(!Array.isArray(eligibilites)) eligibilites = [];
          return {
            id: p.id, nom: p.nom, commune: p.commune, cp: p.cp, adresse: p.adresse,
            statut: p.statut, reglementation: p.reglementation, livraison: p.livraison,
            livraison_detail: p.livraison_detail, debut_travaux: p.debut_travaux,
            lots_total: p.lots_total, pieces: p.pieces, surface_min: p.surface_min,
            surface_max: p.surface_max, prix_min: p.prix_min, prix_max: p.prix_max,
            eligibilites,
            plan3d: p.plan3d, youtube: p.youtube,
            img_cover: p.img_cover,
            photos:      parseJ(p.photos),
            desc:        p.desc_courte,
            desc_long:   p.desc_longue,
            atouts:      parseJ(p.atouts),
            prestations: parseJ(p.prestations),
            timeline:    parseJ(p.timeline),
            lots: progLots.map((l) => ({
              num: l.num, etage: l.etage, typo: l.typo,
              surface: l.surface, prix: l.prix, statut: l.statut,
              plan3d: l.plan3d || ''
            }))
          };
        });
        return new Response(JSON.stringify({ success: true, programmes }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUT /api/programmes/:nom  — sauvegarde immédiate d'un programme en D1
    // ─────────────────────────────────────────────────────────────────────────
    if (path.match(/^\/api\/programmes\/(.+)$/) && request.method === "PUT") {
      const authErr = await requireAuth(); if (authErr) return authErr;
      try {
        const p = await request.json();
        await env.DB.prepare(`
          INSERT INTO programmes (nom,commune,cp,adresse,statut,reglementation,livraison,livraison_detail,debut_travaux,lots_total,pieces,surface_min,surface_max,prix_min,prix_max,eligibilites,plan3d,youtube,img_cover,photos,desc_courte,desc_longue,atouts,prestations,timeline,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
          ON CONFLICT(nom) DO UPDATE SET
            commune=excluded.commune,cp=excluded.cp,adresse=excluded.adresse,
            statut=excluded.statut,reglementation=excluded.reglementation,
            livraison=excluded.livraison,livraison_detail=excluded.livraison_detail,
            debut_travaux=excluded.debut_travaux,lots_total=excluded.lots_total,
            pieces=excluded.pieces,surface_min=excluded.surface_min,surface_max=excluded.surface_max,
            prix_min=excluded.prix_min,prix_max=excluded.prix_max,
            eligibilites=excluded.eligibilites,plan3d=excluded.plan3d,
            youtube=excluded.youtube,img_cover=excluded.img_cover,
            photos=excluded.photos,desc_courte=excluded.desc_courte,
            desc_longue=excluded.desc_longue,atouts=excluded.atouts,
            prestations=excluded.prestations,timeline=excluded.timeline,
            updated_at=datetime('now')
        `).bind(
          p.nom, p.commune||"", p.cp||"", p.adresse||"", p.statut||"En commercialisation",
          p.reglementation||"RE2020", p.livraison||"", p.livraison_detail||p.livraison||"",
          p.debut_travaux||"", p.lots_total||0, p.pieces||"",
          p.surface_min||0, p.surface_max||0, p.prix_min||0, p.prix_max||0,
          p.eligibilites||"", p.plan3d||"", p.youtube||"", p.img_cover||"",
          typeof p.photos==="string"?p.photos:JSON.stringify(p.photos||[]),
          p.desc_courte||p.desc||"", p.desc_longue||p.desc_long||"",
          typeof p.atouts==="string"?p.atouts:JSON.stringify(p.atouts||[]),
          typeof p.prestations==="string"?p.prestations:JSON.stringify(p.prestations||[]),
          typeof p.timeline==="string"?p.timeline:JSON.stringify(p.timeline||[])
        ).run();
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DELETE /api/programmes/:nom  — supprime un programme et ses lots en D1
    // ─────────────────────────────────────────────────────────────────────────
    if (path.match(/^\/api\/programmes\/(.+)$/) && request.method === "DELETE") {
      const authErr = await requireAdmin(); if (authErr) return authErr;
      try {
        const nom = decodeURIComponent(path.split('/api/programmes/')[1]);
        await env.DB.prepare("DELETE FROM lots WHERE programme_nom=?").bind(nom).run();
        await env.DB.prepare("DELETE FROM acquereurs WHERE programme_nom=?").bind(nom).run();
        await env.DB.prepare("DELETE FROM pdf_documents WHERE programme_nom=?").bind(nom).run();
        await env.DB.prepare("DELETE FROM programmes WHERE nom=?").bind(nom).run();
        return new Response(JSON.stringify({ success: true, message: `Programme "${nom}" supprimé` }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DELETE /api/lots/:num  — supprime un lot en D1
    // ─────────────────────────────────────────────────────────────────────────
    if (path.match(/^\/api\/lots\/(.+)$/) && request.method === "DELETE") {
      const authErr = await requireAuth(); if (authErr) return authErr;
      try {
        const num = decodeURIComponent(path.split('/api/lots/')[1]);
        const progNom = url.searchParams.get('programme') || '';
        await env.DB.prepare(
          "DELETE FROM lots WHERE num=? AND (programme_nom=? OR ?='')"
        ).bind(num, progNom, progNom).run();
        return new Response(JSON.stringify({ success: true, message: `Lot "${num}" supprimé` }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/sync
    // ─────────────────────────────────────────────────────────────────────────
    if (path === "/api/sync" && request.method === "POST") {
      const authErr = await requireAuth(); if (authErr) return authErr;
      try {
        const data = await request.json();
        let progCount = 0, lotCount = 0;
        if (data.programmes) {
          for (const p of data.programmes) {
            await env.DB.prepare(`
              INSERT INTO programmes (nom,commune,cp,adresse,statut,reglementation,livraison,livraison_detail,debut_travaux,lots_total,pieces,surface_min,surface_max,prix_min,prix_max,eligibilites,plan3d,youtube,img_cover,photos,desc_courte,desc_longue,atouts,prestations,timeline,updated_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
              ON CONFLICT(nom) DO UPDATE SET
                commune=excluded.commune,cp=excluded.cp,adresse=excluded.adresse,
                statut=excluded.statut,reglementation=excluded.reglementation,
                livraison=excluded.livraison,livraison_detail=excluded.livraison_detail,
                debut_travaux=excluded.debut_travaux,lots_total=excluded.lots_total,
                pieces=excluded.pieces,surface_min=excluded.surface_min,surface_max=excluded.surface_max,
                prix_min=excluded.prix_min,prix_max=excluded.prix_max,
                eligibilites=excluded.eligibilites,plan3d=excluded.plan3d,
                youtube=excluded.youtube,img_cover=excluded.img_cover,
                photos=excluded.photos,desc_courte=excluded.desc_courte,
                desc_longue=excluded.desc_longue,atouts=excluded.atouts,
                prestations=excluded.prestations,timeline=excluded.timeline,
                updated_at=datetime('now')
            `).bind(
              p.nom, p.commune, p.cp, p.adresse||"", p.statut,
              p.reglementation||"RE2020", p.livraison||"", p.livraison_detail||"",
              p.debut_travaux||"", p.lots_total||0, p.pieces||"",
              p.surface_min||0, p.surface_max||0, p.prix_min||0, p.prix_max||0,
              p.eligibilites||"", p.plan3d||"", p.youtube||"", p.img_cover||"",
              typeof p.photos==="string"?p.photos:JSON.stringify(p.photos||[]),
              p.desc_courte||"", p.desc_longue||"",
              typeof p.atouts==="string"?p.atouts:JSON.stringify(p.atouts||[]),
              typeof p.prestations==="string"?p.prestations:JSON.stringify(p.prestations||[]),
              typeof p.timeline==="string"?p.timeline:JSON.stringify(p.timeline||[])
            ).run();
            progCount++;
            // Récupérer les acquéreurs existants AVANT de supprimer (protection données)
            const existingAcq = await env.DB.prepare(
              "SELECT num, acquereur FROM lots WHERE programme_nom=? AND acquereur != ''"
            ).bind(p.nom).all();
            const acqMap = {};
            (existingAcq.results||[]).forEach(r => { acqMap[r.num] = r.acquereur; });

            await env.DB.prepare("DELETE FROM lots WHERE programme_nom=?").bind(p.nom).run();
            if (p.lots && p.lots.length) {
              for (const l of p.lots) {
                // Préserver l'acquéreur existant si le payload envoie une valeur vide
                const acquereur = l.acquereur || acqMap[l.num] || "";
                await env.DB.prepare(`
                  INSERT INTO lots (programme_nom,num,etage,typo,surface,prix,statut,acquereur,plan3d,updated_at)
                  VALUES (?,?,?,?,?,?,?,?,?,datetime('now'))
                `).bind(
                  p.nom, l.num, l.etage||"", l.typo||"",
                  l.surface||0, l.prix||0, l.statut||"Disponible",
                  acquereur, l.plan3d||0
                ).run();
                lotCount++;
              }
            }
          }
        }
        if (data.leads && data.leads.length) {
          // UPSERT leads — ne jamais écraser un lead avec source 'Site web' créé depuis le site
          // On utilise INSERT OR IGNORE pour préserver les leads entrants entre deux syncs admin
          for (const l of data.leads) {
            // Si le lead a un ID, on tente un UPDATE ; sinon INSERT OR IGNORE
            if (l.id) {
              await env.DB.prepare(`
                UPDATE leads SET prenom=?,nom=?,email=?,telephone=?,programme=?,typo=?,budget=?,statut=?,source=?,priorite=?,notes=?,updated_at=datetime('now')
                WHERE id=?
              `).bind(
                l.prenom||"", l.nom||"", l.email||"", l.telephone||"",
                l.programme||"", l.typo||"", l.budget||"", l.statut||"", l.source||"", l.priorite||"l",
                l.notes||"", l.id
              ).run();
            } else {
              await env.DB.prepare(`
                INSERT OR IGNORE INTO leads (prenom,nom,email,telephone,programme,typo,budget,statut,source,priorite,notes,updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
              `).bind(
                l.prenom||"", l.nom||"", l.email||"", l.telephone||"",
                l.programme||"", l.typo||"", l.budget||"", l.statut||"", l.source||"", l.priorite||"l",
                l.notes||""
              ).run();
            }
          }
        }
        return new Response(JSON.stringify({
          success: true, programmes: progCount, lots: lotCount,
          message: `${progCount} programmes et ${lotCount} lots synchronisés`
        }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/chatbot-token  — token court-terme pour authentifier les appels proxy IA
    // Fenêtre glissante 15 min — empêche les appels directs au proxy sans passer par le site
    // ─────────────────────────────────────────────────────────────────────────
    if (path === "/api/chatbot-token" && request.method === "GET") {
      try {
        const secret = env.PROXY_SHARED_SECRET || 'fh-proxy-default-2026';
        // Fenêtre de 15 min : floor(timestamp / 900000)
        const window15 = Math.floor(Date.now() / 900000);
        const raw = `${window15}:${secret}`;
        // HMAC-SHA256 via Web Crypto
        const key = await crypto.subtle.importKey(
          'raw', new TextEncoder().encode(secret),
          { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
        );
        const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw));
        const token = btoa(String.fromCharCode(...new Uint8Array(sig)))
          .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
        const expiresMs = (window15 + 1) * 900000;
        return new Response(JSON.stringify({ token, expires: expiresMs }), {
          headers: { "Content-Type": "application/json", ...corsHeaders,
            "Cache-Control": "no-store" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/leads/:id/statut  — mettre à jour le statut d'un lead
    // ─────────────────────────────────────────────────────────────────────────
    if (path.match(/^\/api\/leads\/(\d+)\/statut$/) && request.method === "POST") {
      const authErr = await requireAuth(); if (authErr) return authErr;
      try {
        const id = parseInt(path.split('/')[3]);
        const body = await request.json();
        const statut = body.statut || '';
        const notes  = body.notes !== undefined ? body.notes : null;
        await env.DB.prepare(
          "UPDATE leads SET statut=?, notes=COALESCE(?,notes), updated_at=datetime('now') WHERE id=?"
        ).bind(statut, notes, id).run();
        return new Response(JSON.stringify({ success: true }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/leads
    // ─────────────────────────────────────────────────────────────────────────
    if (path === "/api/leads" && request.method === "GET") {
      const authErr = await requireAuth(); if (authErr) return authErr;
      try {
        const leads = await env.DB.prepare("SELECT * FROM leads ORDER BY id DESC").all();
        return new Response(JSON.stringify({ success: true, leads: leads.results }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/leads  — créer un lead depuis le formulaire de contact public
    // ─────────────────────────────────────────────────────────────────────────
    if (path === "/api/leads" && request.method === "POST") {
      try {
        const d = await request.json();
        if (!d.nom || !d.email) {
          return new Response(JSON.stringify({ success: false, error: 'Nom et email requis' }), {
            status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }
        await env.DB.prepare(`
          INSERT INTO leads (prenom, nom, email, telephone, programme, typo, budget, statut, source, priorite, notes, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'Nouveau', 'Site web', 'h', ?, datetime('now'))
        `).bind(
          d.prenom||'', d.nom, d.email||'', d.telephone||'',
          d.programme||'', d.typo||'', d.budget||'', d.notes||''
        ).run();

        // ── Envoi emails via Resend ──────────────────────────────────────
        if (env.RESEND_API_KEY) {
          const escHtml = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
          const ePrenom = escHtml(d.prenom); const eNom = escHtml(d.nom);
          const eEmail  = escHtml(d.email);  const eTel  = escHtml(d.telephone);
          const eProg   = escHtml(d.programme); const eNotes = escHtml(d.notes);

          const FROM_EMAIL = 'FREEHOME <noreply@mhfreehome.fr>';
          const NOTIF_TO   = 'contact@mhfreehome.com';
          const dateStr    = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });

          const rows = [
            eTel   ? `<strong>Téléphone :</strong> ${eTel}<br>`   : '',
            eProg  ? `<strong>Programme :</strong> ${eProg}<br>`   : '',
            eNotes ? `<strong>Message :</strong> ${eNotes}<br>`    : '',
          ].join('');

          const notifHtml = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#EDE8DF;font-family:'Helvetica Neue',Arial,sans-serif">
<div style="max-width:600px;margin:28px auto;background:#FAF8F4;border-radius:8px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,.08)">

  <!-- BANDE OR FINE en haut -->
  <div style="height:4px;background:linear-gradient(90deg,#C9A84C,#E2C06A,#C9A84C)"></div>

  <!-- HEADER sobre -->
  <div style="padding:22px 32px 18px;border-bottom:1px solid #E4DFD5;display:flex;align-items:center;justify-content:space-between">
    <div>
      <span style="font-size:1.1rem;font-weight:700;color:#1A1008;letter-spacing:.1em">FREE HOME</span>
      <span style="font-size:.68rem;color:#9A8A6A;letter-spacing:.15em;text-transform:uppercase;margin-left:10px">Maison et Habitat</span>
    </div>
    <span style="font-size:.65rem;color:#C9A84C;font-weight:700;letter-spacing:.08em;text-transform:uppercase;border:1px solid #C9A84C;border-radius:4px;padding:3px 10px">Nouvelle demande</span>
  </div>

  <!-- CORPS -->
  <div style="padding:24px 32px">
    <p style="margin:0 0 4px;font-size:.78rem;color:#9A8A6A;text-transform:uppercase;letter-spacing:.08em;font-weight:600">Demande reçue le</p>
    <p style="margin:0 0 20px;font-size:1rem;color:#1A1008;font-weight:700">${dateStr}</p>

    <!-- Fiche contact -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;border:1px solid #E4DFD5;border-radius:6px;overflow:hidden">
      <tr style="background:#F2EDE4">
        <td style="padding:10px 16px;font-size:.72rem;color:#9A8A6A;font-weight:700;text-transform:uppercase;letter-spacing:.08em;width:120px;border-bottom:1px solid #E4DFD5">Contact</td>
        <td style="padding:10px 16px;font-size:.92rem;color:#1A1008;font-weight:700;border-bottom:1px solid #E4DFD5">${ePrenom} ${eNom}</td>
      </tr>
      <tr>
        <td style="padding:10px 16px;font-size:.72rem;color:#9A8A6A;font-weight:700;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #E4DFD5">Email</td>
        <td style="padding:10px 16px;font-size:.88rem;border-bottom:1px solid #E4DFD5"><a href="mailto:${eEmail}" style="color:#8A6A10;text-decoration:none;font-weight:500">${eEmail}</a></td>
      </tr>
      ${eTel ? `<tr style="background:#F2EDE4">
        <td style="padding:10px 16px;font-size:.72rem;color:#9A8A6A;font-weight:700;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #E4DFD5">Téléphone</td>
        <td style="padding:10px 16px;font-size:.88rem;border-bottom:1px solid #E4DFD5"><a href="tel:${eTel}" style="color:#8A6A10;text-decoration:none">${eTel}</a></td>
      </tr>` : ''}
      ${eProg ? `<tr ${eTel?'':'style="background:#F2EDE4"'}>
        <td style="padding:10px 16px;font-size:.72rem;color:#9A8A6A;font-weight:700;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #E4DFD5">Programme</td>
        <td style="padding:10px 16px;font-size:.88rem;color:#1A1008;font-weight:600;border-bottom:1px solid #E4DFD5">${eProg}</td>
      </tr>` : ''}
      ${eNotes ? `<tr style="background:#F2EDE4">
        <td style="padding:10px 16px;font-size:.72rem;color:#9A8A6A;font-weight:700;text-transform:uppercase;letter-spacing:.08em;vertical-align:top">Message</td>
        <td style="padding:10px 16px;font-size:.85rem;color:#4A4030;line-height:1.6;font-style:italic">"${eNotes}"</td>
      </tr>` : ''}
    </table>

    <!-- CTA -->
    <div style="text-align:center;margin:4px 0 8px">
      <a href="https://freehome-site.mhfreehome.workers.dev/admin.html"
         style="display:inline-block;background:#C9A84C;color:#1A1008;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:.85rem;font-weight:700;letter-spacing:.06em">
        Ouvrir dans l'administration →
      </a>
    </div>
  </div>

  <!-- FOOTER -->
  <div style="border-top:1px solid #E4DFD5;padding:14px 32px;text-align:center">
    <p style="margin:0;font-size:.7rem;color:#B0A090">FREE HOME · <a href="https://www.mhfreehome.com" style="color:#9A8A6A;text-decoration:none">mhfreehome.com</a> · contact@mhfreehome.com</p>
  </div>

</div>
</body></html>`;

          const confirmHtml = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#EDE8DF;font-family:'Helvetica Neue',Arial,sans-serif">
<div style="max-width:600px;margin:28px auto;background:#FAF8F4;border-radius:8px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,.08)">

  <!-- BANDE OR FINE en haut -->
  <div style="height:4px;background:linear-gradient(90deg,#C9A84C,#E2C06A,#C9A84C)"></div>

  <!-- HEADER sobre -->
  <div style="padding:22px 32px 18px;border-bottom:1px solid #E4DFD5">
    <div style="font-size:1.1rem;font-weight:700;color:#1A1008;letter-spacing:.1em">FREE HOME</div>
    <div style="font-size:.65rem;color:#9A8A6A;letter-spacing:.18em;text-transform:uppercase;margin-top:3px">Maison et Habitat · Grand Est</div>
  </div>

  <!-- MESSAGE PRINCIPAL -->
  <div style="padding:28px 32px 20px">
    <h1 style="margin:0 0 10px;font-size:1.2rem;color:#1A1008;font-weight:700">Bonjour ${ePrenom||eNom},</h1>
    <p style="margin:0 0 20px;font-size:.93rem;color:#4A4030;line-height:1.75">
      Nous avons bien reçu votre demande et nous vous en remercions.<br>
      Un conseiller FREE HOME vous contactera dans les <strong>meilleurs délais</strong> pour répondre à vos questions.
    </p>

    <!-- Récap demande -->
    ${eProg || eNotes ? `
    <div style="background:#F2EDE4;border-left:3px solid #C9A84C;border-radius:0 5px 5px 0;padding:14px 18px;margin-bottom:22px">
      <p style="margin:0 0 8px;font-size:.7rem;font-weight:700;color:#9A8A6A;text-transform:uppercase;letter-spacing:.1em">Récapitulatif de votre demande</p>
      ${eProg  ? `<p style="margin:0 0 5px;font-size:.88rem;color:#1A1008">Programme : <strong>${eProg}</strong></p>` : ''}
      ${eNotes ? `<p style="margin:0;font-size:.85rem;color:#4A4030;line-height:1.6;font-style:italic">"${eNotes}"</p>` : ''}
    </div>` : ''}

    <!-- Étapes suivantes -->
    <div style="margin-bottom:26px">
      <p style="margin:0 0 14px;font-size:.7rem;font-weight:700;color:#9A8A6A;text-transform:uppercase;letter-spacing:.1em">Et maintenant ?</p>
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="width:36px;vertical-align:top;padding-bottom:14px">
            <div style="width:26px;height:26px;background:#C9A84C;border-radius:50%;text-align:center;line-height:26px;font-size:.72rem;font-weight:700;color:#1A1008">1</div>
          </td>
          <td style="padding-bottom:14px;padding-left:10px;font-size:.85rem;color:#4A4030;line-height:1.5;vertical-align:top;padding-top:4px">Notre équipe prend connaissance de votre demande</td>
        </tr>
        <tr>
          <td style="width:36px;vertical-align:top;padding-bottom:14px">
            <div style="width:26px;height:26px;background:#C9A84C;border-radius:50%;text-align:center;line-height:26px;font-size:.72rem;font-weight:700;color:#1A1008">2</div>
          </td>
          <td style="padding-bottom:14px;padding-left:10px;font-size:.85rem;color:#4A4030;line-height:1.5;vertical-align:top;padding-top:4px">Un conseiller vous rappelle sous <strong>24h</strong> aux horaires qui vous conviennent</td>
        </tr>
        <tr>
          <td style="width:36px;vertical-align:top">
            <div style="width:26px;height:26px;background:#C9A84C;border-radius:50%;text-align:center;line-height:26px;font-size:.72rem;font-weight:700;color:#1A1008">3</div>
          </td>
          <td style="padding-left:10px;font-size:.85rem;color:#4A4030;line-height:1.5;vertical-align:top;padding-top:4px">Nous étudions ensemble votre projet immobilier et les solutions adaptées</td>
        </tr>
      </table>
    </div>

    <!-- CTA site -->
    <div style="text-align:center;margin-bottom:4px">
      <a href="https://www.mhfreehome.com"
         style="display:inline-block;background:#C9A84C;color:#1A1008;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:.85rem;font-weight:700;letter-spacing:.06em">
        Découvrir nos programmes →
      </a>
    </div>
  </div>

  <!-- CONTACT -->
  <div style="background:#F2EDE4;padding:16px 32px;border-top:1px solid #E4DFD5">
    <p style="margin:0;font-size:.82rem;color:#4A4030">Une question ? Contactez-nous : <a href="mailto:contact@mhfreehome.com" style="color:#8A6A10;text-decoration:none;font-weight:600">contact@mhfreehome.com</a></p>
  </div>

  <!-- FOOTER -->
  <div style="border-top:1px solid #E4DFD5;padding:13px 32px;text-align:center">
    <p style="margin:0;font-size:.7rem;color:#B0A090">© FREE HOME · <a href="https://www.mhfreehome.com" style="color:#9A8A6A;text-decoration:none">mhfreehome.com</a> · Cet email fait suite à votre demande de contact.</p>
  </div>

</div>
</body></html>`;

          const [r1, r2] = await Promise.allSettled([
            fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ from: FROM_EMAIL, reply_to: [NOTIF_TO], to: [NOTIF_TO], subject: `Demande de contact : ${ePrenom} ${eNom}`, html: notifHtml })
            }),
            fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ from: FROM_EMAIL, reply_to: [NOTIF_TO], to: [d.email||''], subject: 'Confirmation de votre demande — FREEHOME', html: confirmHtml })
            })
          ]);
          // Log Resend responses for debugging
          try {
            const t1 = r1.status === 'fulfilled' ? await r1.value.text() : r1.reason?.toString();
            const t2 = r2.status === 'fulfilled' ? await r2.value.text() : r2.reason?.toString();
            console.log('[Resend notif]', r1.status, t1);
            console.log('[Resend confirm]', r2.status, t2);
          } catch(le) { console.log('[Resend log error]', le); }
        }
        // ── Fin envoi emails ─────────────────────────────────────────────

        return new Response(JSON.stringify({ success: true }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/acquereurs  — liste tous les acquéreurs
    // ─────────────────────────────────────────────────────────────────────────
    if (path === "/api/acquereurs" && request.method === "GET") {
      const authErr = await requireAuth(); if (authErr) return authErr;
      try {
        const rows = await env.DB.prepare(
          "SELECT * FROM acquereurs ORDER BY programme_nom, lot_num"
        ).all();
        return new Response(JSON.stringify({ success: true, acquereurs: rows.results }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/acquereurs  — créer ou modifier un acquéreur (upsert)
    // ─────────────────────────────────────────────────────────────────────────
    if (path === "/api/acquereurs" && request.method === "POST") {
      const authErr = await requireAuth(); if (authErr) return authErr;
      try {
        const d = await request.json();
        await env.DB.prepare(`
          INSERT INTO acquereurs (programme_nom, lot_num, nom, email, telephone, date_reservation, notes, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(programme_nom, lot_num) DO UPDATE SET
            nom=excluded.nom, email=excluded.email, telephone=excluded.telephone,
            date_reservation=excluded.date_reservation, notes=excluded.notes,
            updated_at=datetime('now')
        `).bind(
          d.programme_nom, d.lot_num,
          d.nom||'', d.email||'', d.telephone||'',
          d.date_reservation||'', d.notes||''
        ).run();
        // Synchroniser le nom dans lots.acquereur (affichage rapide)
        await env.DB.prepare(
          "UPDATE lots SET acquereur=?, updated_at=datetime('now') WHERE programme_nom=? AND num=?"
        ).bind(d.nom||'', d.programme_nom, d.lot_num).run();
        return new Response(JSON.stringify({ success: true }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUT /api/acquereurs/:id  — mettre à jour une fiche acquéreur par ID
    // ─────────────────────────────────────────────────────────────────────────
    if (path.match(/^\/api\/acquereurs\/\d+$/) && request.method === "PUT") {
      const authErr = await requireAuth(); if (authErr) return authErr;
      try {
        const id = parseInt(path.split('/').pop());
        const d  = await request.json();
        await env.DB.prepare(`
          UPDATE acquereurs SET
            nom=?, prenom=?, email=?, telephone=?,
            statut=?, date_reservation=?, date_acte=?, date_livraison=?, notes=?,
            updated_at=datetime('now')
          WHERE id=?
        `).bind(
          d.nom||'', d.prenom||'', d.email||'', d.telephone||'',
          d.statut||'Réservé', d.date_reservation||'', d.date_acte||'', d.date_livraison||'',
          d.notes||'', id
        ).run();
        return new Response(JSON.stringify({ success: true }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/settings
    // ─────────────────────────────────────────────────────────────────────────
    if (path === "/api/settings" && request.method === "GET") {
      // NOTE : route publique volontaire — index.html l'appelle pour afficher tel/email/tagline
      try {
        const rows = await env.DB.prepare("SELECT key, value FROM settings").all();
        const settings = {};
        rows.results.forEach(r => { settings[r.key] = r.value; });
        return new Response(JSON.stringify({ success: true, settings }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/settings
    // ─────────────────────────────────────────────────────────────────────────
    if (path === "/api/settings" && request.method === "POST") {
      const authErr = await requireAdmin(); if (authErr) return authErr;
      try {
        const data = await request.json();
        for (const [key, value] of Object.entries(data)) {
          await env.DB.prepare(
            "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))"
          ).bind(key, String(value)).run();
        }
        return new Response(JSON.stringify({ success: true, updated: Object.keys(data).length }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/knowledge
    // ─────────────────────────────────────────────────────────────────────────
    if (path === "/api/knowledge" && request.method === "GET") {
      // Autoriser le proxy IA interne ou les utilisateurs authentifiés
      const referer = request.headers.get('Referer') || '';
      const xInternalKey = request.headers.get('X-Internal-Key') || '';
      const internalKeyValid = xInternalKey === (env.INTERNAL_KEY || 'fh-internal-2026');
      const session = await getSession();
      if (!session && !internalKeyValid && !referer.includes('mhfreehome')) {
        return new Response(JSON.stringify({ error: 'Non autorisé' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      try {
        const rows = await env.DB.prepare("SELECT categorie, titre, contenu FROM knowledge_base ORDER BY categorie, titre").all();
        return new Response(JSON.stringify({ success: true, knowledge: rows.results }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/knowledge
    // ─────────────────────────────────────────────────────────────────────────
    if (path === "/api/knowledge" && request.method === "POST") {
      const authErr = await requireAuth(); if (authErr) return authErr;
      try {
        const data = await request.json();
        await env.DB.prepare(
          "INSERT OR REPLACE INTO knowledge_base (categorie, titre, contenu, updated_at) VALUES (?, ?, ?, datetime('now'))"
        ).bind(data.categorie, data.titre, data.contenu).run();
        return new Response(JSON.stringify({ success: true }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DELETE /api/knowledge/:id
    // ─────────────────────────────────────────────────────────────────────────
    if (path.startsWith("/api/knowledge/") && request.method === "DELETE") {
      const authErr = await requireAuth(); if (authErr) return authErr;
      try {
        const id = path.split("/").pop();
        await env.DB.prepare("DELETE FROM knowledge_base WHERE id=?").bind(id).run();
        return new Response(JSON.stringify({ success: true }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/pdf-documents  — liste les PDFs ingérés
    // ─────────────────────────────────────────────────────────────────────────
    if (path === "/api/pdf-documents" && request.method === "GET") {
      const authErr = await requireAuth(); if (authErr) return authErr;
      try {
        const rows = await env.DB.prepare(
          "SELECT * FROM pdf_documents ORDER BY ingested_at DESC"
        ).all();
        return new Response(JSON.stringify({ success: true, documents: rows.results }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DELETE /api/pdf-documents/:id  — supprime un PDF et ses chunks
    // ─────────────────────────────────────────────────────────────────────────
    if (path.startsWith("/api/pdf-documents/") && request.method === "DELETE") {
      const authErr = await requireAuth(); if (authErr) return authErr;
      try {
        const docId = parseInt(path.split("/").pop());
        // Récupérer les vectorize_ids avant suppression
        const chunks = await env.DB.prepare(
          "SELECT vectorize_id FROM pdf_chunks WHERE document_id=?"
        ).bind(docId).all();
        const vectorIds = chunks.results.map(c => c.vectorize_id).filter(Boolean);
        // TODO: binding Vectorize non configuré dans wrangler.toml — suppression vecteurs désactivée
        if (vectorIds.length > 0 && env.VECTORIZE) {
          await env.VECTORIZE.deleteByIds(vectorIds);
        }
        // Supprimer de D1
        await env.DB.prepare("DELETE FROM pdf_chunks WHERE document_id=?").bind(docId).run();
        await env.DB.prepare("DELETE FROM pdf_structured WHERE document_id=?").bind(docId).run();
        await env.DB.prepare("DELETE FROM pdf_documents WHERE id=?").bind(docId).run();
        return new Response(JSON.stringify({ success: true, deleted_vectors: vectorIds.length }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/ingest-pdf  — stockage PDF dans R2 + enregistrement D1
    // ─────────────────────────────────────────────────────────────────────────
    if (path === "/api/ingest-pdf" && request.method === "POST") {
      const authErr = await requireAuth(); if (authErr) return authErr;
      try {
        const data = await request.json();
        const { pdf_base64, filename, doc_type, programme_id, programme_nom } = data;

        if (!pdf_base64 || !filename || !doc_type || !programme_nom) {
          return new Response(JSON.stringify({ success: false, error: "Paramètres manquants" }), {
            status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        // Clé R2 : programme/type/filename
        const r2Key = `${programme_nom}/${doc_type}/${filename}`;
        const fileSizeKb = Math.round((pdf_base64.length * 3 / 4) / 1024);

        // 1. Upload dans R2
        const pdfBytes = Uint8Array.from(atob(pdf_base64), c => c.charCodeAt(0));
        await env.PDF_BUCKET.put(r2Key, pdfBytes, {
          httpMetadata: { contentType: 'application/pdf' },
          customMetadata: { programme_nom, doc_type, filename }
        });

        // 2. Enregistrement dans D1 (upsert par r2_key)
        await env.DB.prepare(`
          INSERT INTO pdf_documents (programme_id, programme_nom, doc_type, filename, file_size_kb, status, r2_key)
          VALUES (?, ?, ?, ?, ?, 'done', ?)
          ON CONFLICT(r2_key) DO UPDATE SET
            programme_id=excluded.programme_id,
            programme_nom=excluded.programme_nom,
            doc_type=excluded.doc_type,
            filename=excluded.filename,
            file_size_kb=excluded.file_size_kb,
            status='done',
            updated_at=datetime('now')
        `).bind(programme_id || null, programme_nom, doc_type, filename, fileSizeKb, r2Key).run();

        return new Response(JSON.stringify({
          success: true,
          r2_key: r2Key,
          message: `PDF stocké avec succès (${fileSizeKb} Ko)`
        }), { headers: { "Content-Type": "application/json", ...corsHeaders } });

      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Pages légales
    // ─────────────────────────────────────────────────────────────────────────
    if (path === "/mentions-legales" || path === "/mentions-legales/") {
      const r = new Request(new URL("/mentions-legales.html", request.url), request);
      return env.ASSETS.fetch(r);
    }
    if (path === "/politique-confidentialite" || path === "/politique-confidentialite/") {
      const r = new Request(new URL("/politique-confidentialite.html", request.url), request);
      return env.ASSETS.fetch(r);
    }
    if (path === "/cgv" || path === "/cgv/") {
      const r = new Request(new URL("/cgv.html", request.url), request);
      return env.ASSETS.fetch(r);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /sitemap.xml
    // ─────────────────────────────────────────────────────────────────────────
    if (path === "/sitemap.xml") {
      const BASE = "https://www.mhfreehome.com";
      const now = new Date().toISOString().split('T')[0];
      let progUrls = '';
      try {
        const progs = await env.DB.prepare("SELECT nom, slug FROM programmes WHERE slug != '' ORDER BY id").all();
        progUrls = progs.results.map(p => {
          return `  <url><loc>${BASE}/programme/${p.slug}</loc><lastmod>${now}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`;
        }).join('\n');
      } catch(e) {}
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${BASE}/</loc><lastmod>${now}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>${BASE}/mentions-legales</loc><lastmod>${now}</lastmod><changefreq>yearly</changefreq><priority>0.3</priority></url>
  <url><loc>${BASE}/politique-confidentialite</loc><lastmod>${now}</lastmod><changefreq>yearly</changefreq><priority>0.3</priority></url>
  <url><loc>${BASE}/cgv</loc><lastmod>${now}</lastmod><changefreq>yearly</changefreq><priority>0.3</priority></url>
${progUrls}
</urlset>`;
      return new Response(xml, {
        headers: { "Content-Type": "application/xml; charset=UTF-8", ...corsHeaders }
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /robots.txt
    // ─────────────────────────────────────────────────────────────────────────
    if (path === "/robots.txt") {
      const robots = `User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: https://www.mhfreehome.com/sitemap.xml\n`;
      return new Response(robots, {
        headers: { "Content-Type": "text/plain; charset=UTF-8", ...corsHeaders }
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/auth/login  — authentification utilisateur
    // ─────────────────────────────────────────────────────────────────────────
    if (path === "/api/auth/login" && request.method === "POST") {
      try {
        const { email, password } = await request.json();
        if (!email || !password) return new Response(JSON.stringify({ success: false, error: "Email et mot de passe requis" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
        const emailKey = email.trim().toLowerCase();
        // Rate limiting : max 5 tentatives / 15 min
        const attempt = await env.DB.prepare("SELECT attempts, locked_until FROM login_attempts WHERE email=?").bind(emailKey).first().catch(() => null);
        if (attempt && attempt.locked_until && attempt.locked_until > new Date().toISOString()) {
          return new Response(JSON.stringify({ success: false, error: "Trop de tentatives. Réessayez dans 15 minutes." }), { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } });
        }
        const user = await env.DB.prepare("SELECT * FROM users WHERE email=? AND actif=1").bind(emailKey).first();
        // Vérification mot de passe (PBKDF2 ou ancien SHA-256)
        const pwOk = user && await verifyPassword(password, user.password_hash);
        if (!pwOk) {
          // Incrémenter compteur tentatives
          const newAttempts = (attempt?.attempts || 0) + 1;
          const lockUntil = newAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
          await env.DB.prepare("INSERT OR REPLACE INTO login_attempts (email, attempts, locked_until) VALUES (?,?,?)").bind(emailKey, newAttempts, lockUntil).run().catch(() => {});
          return new Response(JSON.stringify({ success: false, error: "Identifiants incorrects" }), { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } });
        }
        // Réinitialiser compteur tentatives
        await env.DB.prepare("DELETE FROM login_attempts WHERE email=?").bind(emailKey).run().catch(() => {});
        await env.DB.prepare("UPDATE users SET last_login=datetime('now') WHERE id=?").bind(user.id).run();
        // Upgrade automatique SHA-256 → PBKDF2 au premier login réussi
        if (!user.password_hash.includes(':')) {
          const newHash = await hashPassword(password);
          await env.DB.prepare("UPDATE users SET password_hash=? WHERE id=?").bind(newHash, user.id).run().catch(() => {});
        }
        // Nettoyage sessions expirées
        await env.DB.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run().catch(() => {});
        // Créer session en D1
        const sessionId = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().replace('T', ' ').split('.')[0];
        await env.DB.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?,?,?)").bind(sessionId, user.id, expiresAt).run();
        // Cookie HttpOnly sécurisé (8h)
        const cookie = `fh_session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=28800`;
        // Token btoa conservé pour compatibilité admin.html (sessionStorage affichage nom)
        const token = btoa(`${user.id}:${user.email}:${Date.now()}:${user.role}`);
        return new Response(JSON.stringify({ success: true, token, user: { id: user.id, nom: user.nom, email: user.email, role: user.role } }), {
          headers: { "Content-Type": "application/json", ...corsHeaders, "Set-Cookie": cookie }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/auth/logout  — déconnexion (supprime session D1 + efface cookie)
    // ─────────────────────────────────────────────────────────────────────────
    if (path === "/api/auth/logout" && request.method === "POST") {
      const session = await getSession();
      if (session) {
        await env.DB.prepare("DELETE FROM sessions WHERE id=?").bind(session.id).run().catch(() => {});
      }
      const clearCookie = "fh_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0";
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json", ...corsHeaders, "Set-Cookie": clearCookie }
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/users  — liste des utilisateurs (admin only)
    // ─────────────────────────────────────────────────────────────────────────
    if (path === "/api/users" && request.method === "GET") {
      const authErr = await requireAdmin(); if (authErr) return authErr;
      try {
        const rows = await env.DB.prepare("SELECT id, nom, email, role, actif, last_login, created_at FROM users ORDER BY id").all();
        return new Response(JSON.stringify({ success: true, users: rows.results }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/users  — créer un utilisateur
    // ─────────────────────────────────────────────────────────────────────────
    if (path === "/api/users" && request.method === "POST") {
      const authErr = await requireAdmin(); if (authErr) return authErr;
      try {
        const { nom, email, password, role } = await request.json();
        if (!nom || !email || !password) return new Response(JSON.stringify({ success: false, error: "Nom, email et mot de passe requis" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
        const hashHex = await hashPassword(password);
        await env.DB.prepare("INSERT INTO users (nom, email, password_hash, role, actif) VALUES (?,?,?,?,1)").bind(nom.trim(), email.trim().toLowerCase(), hashHex, role || "editeur").run();
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
      } catch (e) {
        const msg = e.message.includes("UNIQUE") ? "Cet email est déjà utilisé" : e.message;
        return new Response(JSON.stringify({ success: false, error: msg }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUT /api/users/:id  — modifier un utilisateur (nom, email, rôle, actif, password optionnel)
    // ─────────────────────────────────────────────────────────────────────────
    if (path.match(/^\/api\/users\/\d+$/) && request.method === "PUT") {
      const authErr = await requireAdmin(); if (authErr) return authErr;
      try {
        const id = parseInt(path.split("/").pop());
        const { nom, email, role, actif, password } = await request.json();
        if (password) {
          const hashHex = await hashPassword(password);
          await env.DB.prepare("UPDATE users SET nom=?,email=?,role=?,actif=?,password_hash=?,updated_at=datetime('now') WHERE id=?").bind(nom, email.toLowerCase(), role, actif ? 1 : 0, hashHex, id).run();
        } else {
          await env.DB.prepare("UPDATE users SET nom=?,email=?,role=?,actif=?,updated_at=datetime('now') WHERE id=?").bind(nom, email.toLowerCase(), role, actif ? 1 : 0, id).run();
        }
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DELETE /api/users/:id  — supprimer un utilisateur
    // ─────────────────────────────────────────────────────────────────────────
    if (path.match(/^\/api\/users\/\d+$/) && request.method === "DELETE") {
      const authErr = await requireAdmin(); if (authErr) return authErr;
      try {
        const id = parseInt(path.split("/").pop());
        await env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(id).run().catch(() => {});
        await env.DB.prepare("DELETE FROM users WHERE id=?").bind(id).run();
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /programme/:slug — Page SSR programme (data-driven, auto à chaque ajout)
    // ─────────────────────────────────────────────────────────────────────────
    const progSlugMatch = path.match(/^\/programme\/([a-z0-9-]+)$/);
    if (progSlugMatch && request.method === 'GET') {
      const slug = progSlugMatch[1];
      try {
        const prog = await env.DB.prepare(
          'SELECT * FROM programmes WHERE slug=?'
        ).bind(slug).first();
        if (!prog) {
          return new Response(
            '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Programme introuvable | FREEHOME</title><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
            '<body style="font-family:\'DM Sans\',sans-serif;padding:60px 20px;text-align:center;background:#fff;">' +
            '<p style="font-size:14px;color:#555;letter-spacing:.1em;text-transform:uppercase;margin-bottom:16px;">FREEHOME</p>' +
            '<h1 style="font-size:2rem;margin-bottom:12px;">Programme introuvable</h1>' +
            '<p style="color:#666;margin-bottom:32px;">Ce programme n\'existe pas ou n\'est plus disponible.</p>' +
            '<a href="/" style="background:#16a34a;color:#fff;padding:12px 28px;text-decoration:none;font-weight:600;">Voir tous les programmes</a>' +
            '</body></html>',
            { status: 404, headers: { 'Content-Type': 'text/html; charset=UTF-8' } }
          );
        }
        const lotsResult = await env.DB.prepare(
          'SELECT * FROM lots WHERE programme_nom=? ORDER BY num'
        ).bind(prog.nom).all();
        const html = renderProgrammePage(prog, lotsResult.results || []);
        return new Response(html, {
          headers: {
            'Content-Type': 'text/html; charset=UTF-8',
            'Cache-Control': 'public, max-age=300, s-maxage=3600'
          }
        });
      } catch(e) {
        return new Response('Erreur: ' + e.message, { status: 500, headers: { 'Content-Type': 'text/plain' } });
      }
    }

    // Fallback assets statiques
    try {
      return env.ASSETS.fetch(request);
    } catch (e) {
      return new Response("Not found", { status: 404 });
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS : Hachage PBKDF2 avec sel (remplacement SHA-256 sans sel)
// Format stocké : "saltHex:hashHex" (PBKDF2) ou "64hexchars" (ancien SHA-256)
// ─────────────────────────────────────────────────────────────────────────────
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256);
  const hashHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${saltHex}:${hashHex}`;
}

async function verifyPassword(password, stored) {
  if (!stored) return false;
  if (!stored.includes(':')) {
    // Ancien format : SHA-256 sans sel (64 chars hex)
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
    const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    return hex === stored;
  }
  // Nouveau format PBKDF2 : saltHex:hashHex
  const [saltHex, storedHash] = stored.split(':');
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map(b => parseInt(b, 16)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256);
  const hex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
  return hex === storedHash;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER : découpage du texte en chunks sémantiques
// ~400 mots par chunk, 50 mots de chevauchement, préfixe contextuel
// ─────────────────────────────────────────────────────────────────────────────
function chunkText(text, programmeName, docType, maxWords = 400, overlapWords = 50) {
  if (!text || text.trim().length === 0) return [];
  const prefix = `[Programme: ${programmeName}] [Type: ${docType}]\n`;
  // Séparer en paragraphes
  const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 0);
  const chunks = [];
  let current = [];
  let currentWordCount = 0;

  for (const para of paragraphs) {
    const paraWords = para.split(/\s+/).length;
    if (currentWordCount + paraWords > maxWords && current.length > 0) {
      // Finaliser le chunk courant
      chunks.push(prefix + current.join('\n\n'));
      // Chevauchement : garder les derniers paragraphes pour ~overlapWords mots
      let overlapText = [];
      let overlapCount = 0;
      for (let i = current.length - 1; i >= 0; i--) {
        const wc = current[i].split(/\s+/).length;
        if (overlapCount + wc <= overlapWords) {
          overlapText.unshift(current[i]);
          overlapCount += wc;
        } else break;
      }
      current = overlapText;
      currentWordCount = overlapCount;
    }
    current.push(para);
    currentWordCount += paraWords;
  }
  // Dernier chunk
  if (current.length > 0) {
    chunks.push(prefix + current.join('\n\n'));
  }
  return chunks;
}

// ─────────────────────────────────────────────────────────────────────────────
// SSR : Rendu HTML d'une page programme (data-driven)
// Mode résidentiel (simulateur_actif=0) → vert #16a34a
// Mode activité/DNK (simulateur_actif=1) → orange #FF4614
// ─────────────────────────────────────────────────────────────────────────────
function renderProgrammePage(prog, lots) {
  const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const parseJ = (v, fallback=[]) => {
    if (Array.isArray(v)) return v;
    try { const r = JSON.parse(v); return Array.isArray(r) ? r : fallback; }
    catch(e) { return fallback; }
  };
  const parseElig = v => {
    if (Array.isArray(v)) return v;
    if (!v) return [];
    try { const r = JSON.parse(v); return Array.isArray(r) ? r : []; }
    catch(e) { return String(v).split(',').map(s=>s.trim()).filter(Boolean); }
  };
  const fmtEur = n => {
    if (!n || Number(n) === 0) return '';
    const m = Math.round(Number(n));
    let s = m.toString();
    let result = '';
    for (let i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 === 0) result += '\u00A0';
      result += s[i];
    }
    return result + '\u00A0\u20AC';
  };

  const dnkMode = Number(prog.simulateur_actif) === 1;
  const accent  = dnkMode ? '#FF4614' : '#16a34a';
  const accentH = dnkMode ? '#E63E10' : '#15803d';
  const photos       = parseJ(prog.photos);
  const atouts       = parseJ(prog.atouts);
  const prestations  = parseJ(prog.prestations);
  const eligibilites = parseElig(prog.eligibilites);
  const seoTitle = esc(prog.seo_title || prog.nom + ' \u2014 R\u00E9sidence neuve \u00E0 ' + prog.commune + ' | FREEHOME');
  const seoDesc  = esc(prog.seo_description || 'Programme immobilier neuf ' + prog.nom + ' \u00E0 ' + prog.commune + '. D\u00E9couvrez les lots disponibles.');
  const canonical = 'https://www.mhfreehome.com/programme/' + prog.slug;
  const coverImg  = prog.img_cover || '';
  const prixMin   = Number(prog.prix_min) || 0;
  const prixMax   = Number(prog.prix_max) || 0;
  const prixLabel = prixMin && prixMax && prixMin !== prixMax
    ? fmtEur(prixMin) + ' \u00E0 ' + fmtEur(prixMax)
    : prixMin ? '\u00C0 partir de ' + fmtEur(prixMin) : '';

  const lotsDisponibles = lots.filter(l => l.statut === 'Disponible');
  const lotsReserves    = lots.filter(l => l.statut === 'R\u00E9serv\u00E9');

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    "name": prog.nom,
    "description": prog.desc_courte || prog.desc_longue || '',
    "url": canonical,
    "image": coverImg,
    "address": {
      "@type": "PostalAddress",
      "addressLocality": prog.commune,
      "postalCode": prog.cp,
      "streetAddress": prog.adresse || '',
      "addressCountry": "FR"
    }
  });

  // ── Lots table ──────────────────────────────────────────────────────────────
  const lotStatusColor = s => {
    if (s === 'Disponible') return '#16a34a';
    if (s === 'R\u00E9serv\u00E9') return '#d97706';
    if (s === 'Livr\u00E9') return '#2563eb';
    if (s === 'Bloqu\u00E9') return '#6b7280';
    return '#374151';
  };
  const lotsHtml = lots.length > 0 ? lots.map(l =>
    '<tr>' +
    '<td style="font-weight:600;">' + esc(l.num) + '</td>' +
    '<td>' + esc(l.typo || '') + '</td>' +
    '<td>' + (l.etage !== undefined && l.etage !== '' ? esc(String(l.etage)) : '\u2014') + '</td>' +
    '<td>' + (l.surface ? l.surface + '\u00A0m\u00B2' : '\u2014') + '</td>' +
    '<td style="font-weight:600;">' + (l.prix ? fmtEur(l.prix) : '\u2014') + '</td>' +
    '<td><span style="display:inline-block;padding:3px 10px;background:' + lotStatusColor(l.statut) + ';color:#fff;border-radius:' + (dnkMode ? '0' : '4px') + ';font-size:12px;font-weight:600;">' + esc(l.statut || '') + '</span></td>' +
    '</tr>'
  ).join('') : '<tr><td colspan="6" style="text-align:center;color:#666;padding:20px;">Aucun lot renseigné</td></tr>';

  // ── Atouts ──────────────────────────────────────────────────────────────────
  const atoutsHtml = atouts.length > 0
    ? atouts.map(a => '<li style="padding:8px 0 8px 24px;position:relative;border-bottom:1px solid #f3f4f6;font-size:15px;"><span style="position:absolute;left:0;color:' + accent + ';font-weight:700;">&#8212;</span>' + esc(typeof a === 'string' ? a : a.titre || a.texte || JSON.stringify(a)) + '</li>').join('')
    : '';

  // ── Prestations ────────────────────────────────────────────────────────────
  const prestHtml = prestations.length > 0
    ? prestations.map(p => '<li style="padding:8px 0 8px 24px;position:relative;border-bottom:1px solid #f3f4f6;font-size:15px;"><span style="position:absolute;left:0;color:' + accent + ';font-weight:700;">&#10003;</span>' + esc(typeof p === 'string' ? p : p.titre || p.texte || JSON.stringify(p)) + '</li>').join('')
    : '';

  // ── Éligibilités chips ─────────────────────────────────────────────────────
  const eligHtml = eligibilites.map(e =>
    '<span style="display:inline-block;padding:4px 12px;border:1px solid ' + accent + ';color:' + accent + ';font-size:13px;font-weight:600;border-radius:' + (dnkMode ? '0' : '4px') + ';margin:3px;">' + esc(e) + '</span>'
  ).join('');

  // ── Photos galerie ─────────────────────────────────────────────────────────
  const photosHtml = photos.length > 0
    ? photos.map(url => '<img src="' + esc(typeof url === 'string' ? url : url.url || '') + '" alt="' + esc(prog.nom) + '" loading="lazy" style="width:100%;height:220px;object-fit:cover;display:block;">')
      .join('')
    : '';

  // ── Simulateur HTML (DNK uniquement) ──────────────────────────────────────
  const simulateurHtml = dnkMode ? `
<section id="simulateur" style="background:#fff;padding:3rem 0;">
  <div style="max-width:1280px;margin:0 auto;padding:0 20px;">
    <h2 style="font-size:clamp(1.5rem,3vw,1.75rem);font-weight:700;border-bottom:3px solid #FF4614;padding-bottom:8px;margin-bottom:20px;">SIMULATEUR INVESTISSEUR &mdash; CHOISISSEZ UNE CONFIGURATION</h2>

    <div style="margin-bottom:16px;">
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;" class="preset-grid">
        <div class="preset-card active" data-surface="177" data-price="209500" data-rent="96" onclick="applyPreset(this)" tabindex="0" role="button">
          <div class="pc-name">1 cellule inter.</div>
          <div class="pc-detail">177 m&sup2; &mdash; 209&nbsp;500&nbsp;&euro;</div>
        </div>
        <div class="preset-card" data-surface="183" data-price="219600" data-rent="110" onclick="applyPreset(this)" tabindex="0" role="button">
          <div class="pc-name">1 cellule commerce</div>
          <div class="pc-detail">183 m&sup2; &mdash; 219&nbsp;600&nbsp;&euro;</div>
        </div>
        <div class="preset-card" data-surface="354" data-price="419000" data-rent="96" onclick="applyPreset(this)" tabindex="0" role="button">
          <div class="pc-name">2 cellules inter.</div>
          <div class="pc-detail">354 m&sup2; &mdash; 419&nbsp;000&nbsp;&euro;</div>
        </div>
        <div class="preset-card" data-surface="708" data-price="838000" data-rent="96" onclick="applyPreset(this)" tabindex="0" role="button">
          <div class="pc-name">4 cellules inter.</div>
          <div class="pc-detail">708 m&sup2; &mdash; 838&nbsp;000&nbsp;&euro;</div>
        </div>
        <div class="preset-card" data-surface="366" data-price="439200" data-rent="110" onclick="applyPreset(this)" tabindex="0" role="button">
          <div class="pc-name">Lot vitrine</div>
          <div class="pc-detail">366 m&sup2; &mdash; 439&nbsp;200&nbsp;&euro;</div>
        </div>
        <div class="preset-card" data-surface="2275" data-price="2600000" data-rent="88" onclick="applyPreset(this)" tabindex="0" role="button">
          <div class="pc-name">Activit&eacute; sportive</div>
          <div class="pc-detail">2&nbsp;275 m&sup2; &mdash; &Agrave; n&eacute;gocier</div>
        </div>
        <div class="preset-card" data-surface="3350" data-price="4000000" data-rent="96" onclick="applyPreset(this)" tabindex="0" role="button">
          <div class="pc-name">B&acirc;timent complet</div>
          <div class="pc-detail">3&nbsp;350 m&sup2; &mdash; 4&nbsp;000&nbsp;000&nbsp;&euro;</div>
        </div>
      </div>
    </div>

    <div class="sim-main">
      <!-- PARAMETRES -->
      <div class="params">
        <div class="panel">
          <h3>Acquisition</h3>
          <div class="form-row">
            <label>Surface totale <span class="val" id="v-surface">177 m&sup2;</span></label>
            <input type="range" id="s-surface" min="100" max="3500" step="1" value="177" oninput="calc()">
          </div>
          <div class="form-row">
            <label>Prix d&rsquo;acquisition HT</label>
            <input type="number" id="n-price" value="209500" step="500" oninput="calc()">
          </div>
          <div class="form-row">
            <label>Frais de notaire <span class="val" id="v-notaire">3%</span></label>
            <input type="range" id="s-notaire" min="0" max="8" step="0.5" value="3" oninput="calc()">
          </div>
        </div>
        <div class="panel">
          <h3>Location</h3>
          <div class="form-row">
            <label>Loyer HT /m&sup2;/an <span class="val" id="v-rent">96&nbsp;&euro;</span></label>
            <input type="range" id="s-rent" min="60" max="140" step="1" value="96" oninput="calc()">
          </div>
          <div class="form-row">
            <label>Taux d&rsquo;occupation <span class="val" id="v-occup">90%</span></label>
            <input type="range" id="s-occup" min="50" max="100" step="1" value="90" oninput="calc()">
          </div>
          <div class="form-row">
            <label>Indexation ILAT/ILC <span class="val" id="v-index">2,0%</span></label>
            <input type="range" id="s-index" min="0" max="5" step="0.1" value="2.0" oninput="calc()">
            <div style="display:flex;gap:6px;margin-top:6px;align-items:center;">
              <span style="font-size:12px;color:#8A8A8D;">R&eacute;vision :</span>
              <button class="proj-btn active" data-rev="1" onclick="setRevision(1)">Annuelle</button>
              <button class="proj-btn" data-rev="3" onclick="setRevision(3)">Triennale</button>
            </div>
          </div>
        </div>
        <div class="panel">
          <h3>Financement</h3>
          <div class="form-row">
            <label>Apport personnel <span class="val" id="v-apport">20%</span></label>
            <input type="range" id="s-apport" min="0" max="100" step="5" value="20" oninput="calc()">
          </div>
          <div class="form-row">
            <label>Taux de cr&eacute;dit <span class="val" id="v-taux">3,5%</span></label>
            <input type="range" id="s-taux" min="1" max="7" step="0.1" value="3.5" oninput="calc()">
          </div>
          <div class="form-row">
            <label>Dur&eacute;e cr&eacute;dit <span class="val" id="v-duree">20 ans</span></label>
            <input type="range" id="s-duree" min="7" max="25" step="1" value="20" oninput="calc()">
          </div>
        </div>
        <div class="panel">
          <h3>Hypoth&egrave;se de revente</h3>
          <div class="form-row">
            <label>Appr&eacute;ciation annuelle du bien <span class="val" id="v-appre">1,5%</span></label>
            <input type="range" id="s-appre" min="0" max="5" step="0.1" value="1.5" oninput="calc()">
            <div id="appre-gauge" style="margin-top:8px;font-size:12px;line-height:1.5;color:#8A8A8D;"></div>
          </div>
        </div>
        <div class="panel">
          <h3>Charges annuelles /m&sup2; &mdash; Qui paie ?</h3>
          <p style="font-size:12px;color:#8A8A8D;margin-bottom:12px;">Bail commercial&nbsp;: la plupart des charges sont report&eacute;es sur le locataire. Cliquez pour basculer.</p>
          <div class="form-row">
            <label>Taxe fonci&egrave;re <span class="val" id="v-tf">15&nbsp;&euro;/m&sup2;</span></label>
            <input type="range" id="s-tf" min="5" max="40" step="1" value="15" oninput="calc()">
            <div class="toggle-row">
              <span class="toggle-who locataire" id="tw-tf">Locataire</span>
              <div class="toggle-switch locataire" id="t-tf" onclick="toggleCharge('tf')" role="switch" aria-checked="false" tabindex="0"></div>
            </div>
          </div>
          <div class="form-row">
            <label>Assurance PNO <span class="val" id="v-pno">3&nbsp;&euro;/m&sup2;</span></label>
            <input type="range" id="s-pno" min="1" max="10" step="0.5" value="3" oninput="calc()">
            <div class="toggle-row">
              <span class="toggle-who bailleur" id="tw-pno">Bailleur</span>
              <div class="toggle-switch" id="t-pno" onclick="toggleCharge('pno')" role="switch" aria-checked="true" tabindex="0"></div>
            </div>
          </div>
          <div class="form-row">
            <label>Charges copropri&eacute;t&eacute; <span class="val" id="v-copro">8&nbsp;&euro;/m&sup2;</span></label>
            <input type="range" id="s-copro" min="0" max="20" step="1" value="8" oninput="calc()">
            <div class="toggle-row">
              <span class="toggle-who locataire" id="tw-copro">Locataire</span>
              <div class="toggle-switch locataire" id="t-copro" onclick="toggleCharge('copro')" role="switch" aria-checked="false" tabindex="0"></div>
            </div>
          </div>
          <div class="form-row">
            <label>Gestion locative <span class="val" id="v-gestion">8%</span></label>
            <input type="range" id="s-gestion" min="0" max="15" step="1" value="8" oninput="calc()">
            <div class="toggle-row">
              <span class="toggle-who bailleur" id="tw-gestion">Bailleur</span>
              <div class="toggle-switch" id="t-gestion" onclick="toggleCharge('gestion')" role="switch" aria-checked="true" tabindex="0"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- RESULTATS -->
      <div class="results">
        <div class="big-stat" id="bs-rdt" style="background:#FF4614;">
          <div class="bs-val" id="r-rdt-brut" style="font-size:2.5rem;font-weight:700;color:#fff;text-align:center;">—</div>
          <div style="text-align:center;font-size:14px;color:#fff;font-weight:600;margin-top:4px;">Rendement brut</div>
        </div>
        <div class="result-card">
          <h4>Revenus locatifs</h4>
          <div class="result-row"><span class="result-label">Loyer brut annuel</span><span class="result-value" id="r-loyer-brut">&mdash;</span></div>
          <div class="result-row"><span class="result-label">Loyer net (apr&egrave;s vacance)</span><span class="result-value" id="r-loyer-net">&mdash;</span></div>
          <div class="result-row"><span class="result-label">Loyer mensuel net</span><span class="result-value highlight" id="r-loyer-mens">&mdash;</span></div>
        </div>
        <div class="result-card">
          <h4>Rentabilit&eacute;</h4>
          <div class="result-row"><span class="result-label">Rendement brut</span><span class="result-value highlight" id="r-rdt-brut2">&mdash;</span></div>
          <div class="result-row"><span class="result-label">Rendement net (apr&egrave;s charges bailleur)</span><span class="result-value" id="r-rdt-net">&mdash;</span></div>
          <div class="result-row"><span class="result-label">Charges bailleur annuelles</span><span class="result-value" id="r-charges">&mdash;</span></div>
        </div>
        <div class="result-card">
          <h4>Financement</h4>
          <div class="result-row"><span class="result-label">Investissement total (prix + notaire)</span><span class="result-value" id="r-invest">&mdash;</span></div>
          <div class="result-row"><span class="result-label">Apport personnel</span><span class="result-value" id="r-apport">&mdash;</span></div>
          <div class="result-row"><span class="result-label">Montant emprunt&eacute;</span><span class="result-value" id="r-emprunt">&mdash;</span></div>
          <div class="result-row"><span class="result-label">Mensualit&eacute; cr&eacute;dit</span><span class="result-value highlight" id="r-mensualite">&mdash;</span></div>
          <div class="result-row"><span class="result-label">Co&ucirc;t total du cr&eacute;dit</span><span class="result-value" id="r-cout-credit">&mdash;</span></div>
        </div>
        <div class="result-card">
          <h4>Cash-flow mensuel &mdash; D&eacute;tail</h4>
          <div class="cf-detail" id="cf-detail"></div>
          <div style="margin-top:10px;">
            <div class="result-row"><span class="result-label">Cash-flow annuel</span><span class="result-value" id="r-cashflow-an">&mdash;</span></div>
            <div class="result-row"><span class="result-label">Couverture des sorties</span><span class="result-value" id="r-couverture">&mdash;</span></div>
            <div style="height:6px;background:#333;border-radius:3px;margin-top:6px;overflow:hidden;"><div id="cov-fill" style="height:100%;width:0%;background:#FF4614;transition:width .3s;"></div></div>
          </div>
        </div>
        <div class="result-card">
          <h4>Flux de tr&eacute;sorerie pr&eacute;visionnel</h4>
          <div style="display:flex;gap:8px;margin-bottom:12px;align-items:center;flex-wrap:wrap;">
            <span style="font-size:13px;color:#d4d4d4;">Projection&nbsp;:</span>
            <button class="proj-btn" data-y="10" onclick="setProjDuree(10)">10 ans</button>
            <button class="proj-btn" data-y="15" onclick="setProjDuree(15)">15 ans</button>
            <button class="proj-btn active" data-y="20" onclick="setProjDuree(20)">20 ans</button>
            <button class="proj-btn" data-y="25" onclick="setProjDuree(25)">25 ans</button>
          </div>
          <div style="cursor:pointer;display:flex;align-items:center;gap:6px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.1);margin-bottom:8px;" onclick="toggleFlux()">
            <span id="flux-arrow" style="font-size:18px;color:#FF4614;transition:transform 0.2s;">&#9654;</span>
            <span style="font-size:14px;font-weight:600;color:#d4d4d4;">D&eacute;tail ann&eacute;e par ann&eacute;e</span>
          </div>
          <div id="flux-wrap" style="max-height:400px;overflow-y:auto;display:none;">
            <div style="overflow-x:auto;">
              <table style="font-size:12px;width:100%;border-collapse:collapse;">
                <thead><tr>
                  <th style="width:36px;background:#000;color:#fff;padding:6px 4px;text-align:left;font-size:11px;">An.</th>
                  <th style="background:#000;color:#fff;padding:6px 4px;text-align:left;font-size:11px;">Loyer net</th>
                  <th style="background:#000;color:#fff;padding:6px 4px;text-align:left;font-size:11px;">Cr&eacute;dit</th>
                  <th style="background:#000;color:#fff;padding:6px 4px;text-align:left;font-size:11px;">Charges</th>
                  <th style="background:#000;color:#fff;padding:6px 4px;text-align:left;font-size:11px;">CF net</th>
                  <th style="background:#000;color:#fff;padding:6px 4px;text-align:left;font-size:11px;">Cumul&eacute;</th>
                </tr></thead>
                <tbody id="flux-body"></tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="result-card">
          <h4>Bilan &agrave; la revente &mdash; <span id="r-proj-label">20 ans</span></h4>
          <div class="result-row"><span class="result-label">Capital investi (apport + effort)</span><span class="result-value" id="r-capital-total">&mdash;</span></div>
          <div class="result-row"><span class="result-label" id="r-vp-label">Valeur patrimoniale (+1,5%/an)</span><span class="result-value" id="r-valeur-pat">&mdash;</span></div>
          <div class="result-row"><span class="result-label">CRD (capital restant d&ucirc;)</span><span class="result-value" id="r-crd-restant">&mdash;</span></div>
          <div class="result-row"><span class="result-label">Valeur nette &agrave; la revente</span><span class="result-value" id="r-valeur-nette">&mdash;</span></div>
          <div class="result-row"><span class="result-label">CF cumul&eacute; net</span><span class="result-value" id="r-cumul-cf">&mdash;</span></div>
          <div style="border-top:1px solid rgba(255,255,255,0.15);margin:8px 0;"></div>
          <div class="result-row"><span class="result-label">Gain total net</span><span class="result-value highlight" id="r-gain-total">&mdash;</span></div>
          <div class="result-row"><span class="result-label">TRI (taux de rendement interne)</span><span class="result-value highlight" id="r-rci">&mdash;</span></div>
          <div class="result-row"><span class="result-label">Multiplicateur</span><span class="result-value" id="r-multi">&mdash;</span></div>
        </div>
      </div><!-- /results -->
    </div><!-- /sim-main -->

    <div style="display:flex;gap:12px;flex-wrap:wrap;padding:0 0 3rem;">
      <button style="min-height:44px;padding:12px 24px;background:#000;color:#fff;border:none;cursor:pointer;font-weight:600;font-size:14px;" onclick="resetAll()">R&eacute;initialiser</button>
      <button style="min-height:44px;padding:12px 24px;background:#FF4614;color:#fff;border:none;cursor:pointer;font-weight:600;font-size:14px;" onclick="generateStudyPDF()">G&eacute;n&eacute;rer mon &eacute;tude PDF</button>
    </div>
  </div>
</section>` : '';

  // ── CSS partagé + mode-spécifique ─────────────────────────────────────────
  const simCss = dnkMode ? `
    :root {
      --sim-or: #FF4614; --sim-ok: #16a34a; --sim-warn: #d97706; --sim-err: #dc2626;
      --sim-bk: #000; --sim-wh: #fff; --sim-gd: #2C2C2B; --sim-gm: #8A8A8D; --sim-gl: #F0F0F0;
    }
    .preset-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; }
    @media(min-width:640px){ .preset-grid { grid-template-columns:repeat(4,1fr); } }
    @media(min-width:1024px){ .preset-grid { grid-template-columns:repeat(7,1fr); } }
    .preset-card { background:#000;color:#fff;padding:12px 10px;text-align:center;cursor:pointer;border:2px solid transparent;transition:border-color .15s;min-height:44px;display:flex;flex-direction:column;justify-content:center; }
    .preset-card:hover,.preset-card:focus-visible { border-color:#FF4614;outline:none; }
    .preset-card.active { background:#FF4614;border-color:#FF4614; }
    .preset-card .pc-name { font-size:13px;font-weight:700;line-height:1.2; }
    .preset-card .pc-detail { font-size:12px;color:#ccc;font-weight:500;margin-top:4px; }
    .preset-card.active .pc-detail { color:rgba(255,255,255,.8); }
    .sim-main { display:grid;grid-template-columns:1fr;gap:20px;padding:20px 0 0; }
    @media(min-width:768px){ .sim-main { grid-template-columns:1fr 1fr; } }
    .panel { background:#F0F0F0;padding:20px;margin-bottom:16px; }
    .panel h3 { font-size:15px;font-weight:700;color:#000;margin-bottom:14px;border-bottom:2px solid #FF4614;padding-bottom:6px; }
    .form-row { margin-bottom:14px; }
    .form-row label { display:flex;justify-content:space-between;align-items:baseline;font-size:13px;font-weight:500;color:#2C2C2B;margin-bottom:4px; }
    .form-row label .val { font-weight:700;color:#FF4614;font-size:15px; }
    input[type=range] { -webkit-appearance:none;appearance:none;width:100%;height:6px;background:#ddd;outline:none;border-radius:3px;cursor:pointer; }
    input[type=range]::-webkit-slider-thumb { -webkit-appearance:none;appearance:none;width:22px;height:22px;background:#FF4614;border-radius:50%;cursor:pointer;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3); }
    input[type=range]::-moz-range-thumb { width:22px;height:22px;background:#FF4614;border-radius:50%;cursor:pointer;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3); }
    input[type=number] { width:100%;padding:10px;font-size:16px;font-family:inherit;border:1px solid #ccc;background:#fff;font-weight:600;color:#2C2C2B; }
    input[type=number]:focus { outline:2px solid #FF4614;border-color:#FF4614; }
    .results { position:sticky;top:72px; }
    @media(max-width:767px){ .results { position:static; } }
    .result-card { background:#000;color:#fff;padding:16px;margin-bottom:10px; }
    .result-card h4 { font-size:13px;color:#fff;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px; }
    .result-row { display:flex;justify-content:space-between;align-items:baseline;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.08); }
    .result-row:last-child { border-bottom:none; }
    .result-label { font-size:13px;color:#d4d4d4;font-weight:500; }
    .result-value { font-size:16px;font-weight:700;color:#fff; }
    .result-value.highlight { color:#FF4614;font-size:20px; }
    .result-value.ok { color:#16a34a; }
    .result-value.warn { color:#d97706; }
    .result-value.err { color:#dc2626; }
    .big-stat { padding:20px;text-align:center;margin-bottom:10px; }
    .cf-detail { background:rgba(255,255,255,.05);padding:10px;margin-bottom:4px; }
    .cf-line { display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.08); }
    .cf-op { font-size:18px;font-weight:700;width:20px;text-align:center; }
    .cf-lab { flex:1;font-size:13px;color:#d4d4d4; }
    .cf-val { font-size:14px;font-weight:700; }
    .cf-total { border-top:2px solid rgba(255,255,255,.2);margin-top:4px;padding-top:8px; }
    .yr-positive td { color:#16a34a; }
    .yr-negative td { color:#dc2626; }
    .yr-pivot { border-top:2px solid #FF4614; }
    .toggle-row { display:flex;align-items:center;gap:8px;margin-top:6px; }
    .toggle-who { font-size:12px;font-weight:600;min-width:64px; }
    .toggle-who.locataire { color:#16a34a; }
    .toggle-who.bailleur { color:#dc2626; }
    .toggle-switch { width:44px;height:24px;background:#dc2626;border-radius:12px;position:relative;cursor:pointer;transition:background .2s; }
    .toggle-switch::after { content:'';position:absolute;top:2px;left:2px;width:20px;height:20px;background:#fff;border-radius:50%;transition:left .2s; }
    .toggle-switch.locataire { background:#16a34a; }
    .toggle-switch.locataire::after { left:22px; }
    .proj-btn { background:#333;color:#fff;border:none;padding:6px 12px;font-size:12px;cursor:pointer;font-weight:600;transition:background .15s;min-height:32px; }
    .proj-btn.active { background:#FF4614; }
    .proj-btn:hover { background:#FF4614; }
    .cov-bar { height:6px;background:#333;border-radius:3px;margin-top:6px;overflow:hidden; }
    .cov-fill { height:100%;transition:width .3s; }
  ` : '';

  // ── HTML complet ──────────────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${seoTitle}</title>
  <meta name="description" content="${seoDesc}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonical}">
  <meta property="og:title" content="${seoTitle}">
  <meta property="og:description" content="${seoDesc}">
  ${coverImg ? `<meta property="og:image" content="${esc(coverImg)}">` : ''}
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">${jsonLd}</script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'DM Sans',sans-serif;background:#fff;color:#111827;font-size:16px;line-height:1.6;}
    a{color:${accent};text-decoration:none;}
    img{max-width:100%;display:block;}
    .container{width:100%;max-width:1280px;margin:0 auto;padding:0 20px;}
    @media(min-width:640px){.container{padding:0 24px;}}
    @media(min-width:1024px){.container{padding:0 32px;}}
    /* Navbar */
    .nav{position:sticky;top:0;z-index:100;background:#000;display:flex;justify-content:space-between;align-items:center;padding:0 20px;height:56px;}
    @media(min-width:640px){.nav{padding:0 32px;}}
    .nav-logo{font-size:18px;font-weight:700;color:#fff;letter-spacing:.05em;}
    .nav-logo span{color:${accent};}
    .nav-links{display:flex;gap:4px;align-items:center;}
    .nav-links a{color:#fff;font-size:13px;font-weight:600;padding:8px 14px;min-height:44px;display:flex;align-items:center;transition:background .15s;}
    .nav-links a:hover{background:${accent};}
    .nav-links .cta{background:${accent};}
    /* Hero */
    .hero{position:relative;overflow:hidden;}
    .hero-img{width:100%;height:280px;object-fit:cover;object-position:center 55%;}
    @media(min-width:640px){.hero-img{height:400px;}}
    @media(min-width:1024px){.hero-img{height:500px;}}
    .hero-placeholder{width:100%;height:280px;background:linear-gradient(135deg,#111 0%,#222 100%);display:flex;align-items:center;justify-content:center;}
    @media(min-width:640px){.hero-placeholder{height:400px;}}
    .hero-ov{position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent 0%,rgba(0,0,0,.85) 100%);padding:24px 20px 16px;}
    @media(min-width:640px){.hero-ov{padding:32px 32px 20px;}}
    .hero-ov h1{font-size:clamp(1.5rem,4vw,2.5rem);font-weight:700;color:#fff;line-height:1.15;letter-spacing:-.02em;}
    .hero-ov .subline{font-size:16px;color:rgba(255,255,255,.85);margin-top:8px;}
    .hero-ov .badge{display:inline-block;padding:4px 12px;background:${accent};color:#fff;font-size:12px;font-weight:700;border-radius:${dnkMode ? '0' : '4px'};margin-top:10px;}
    /* Breadcrumb */
    .breadcrumb{padding:12px 0;font-size:13px;color:#6b7280;display:flex;gap:6px;align-items:center;flex-wrap:wrap;}
    .breadcrumb a{color:#6b7280;}
    .breadcrumb a:hover{color:${accent};}
    /* Info grid */
    .info-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;padding:24px 0;}
    @media(min-width:640px){.info-grid{grid-template-columns:repeat(4,1fr);}}
    .info-card{background:#f9fafb;border:1px solid #e5e7eb;padding:14px 16px;border-radius:${dnkMode ? '0' : '8px'};}
    .info-card .ic-label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;margin-bottom:4px;}
    .info-card .ic-val{font-size:15px;font-weight:700;color:#111827;line-height:1.3;}
    .info-card .ic-val.accent{color:${accent};}
    /* Sections */
    section{padding:3rem 0;}
    .section-title{font-size:clamp(1.5rem,3vw,1.75rem);font-weight:700;color:#000;border-bottom:3px solid ${accent};padding-bottom:8px;margin-bottom:20px;}
    /* Photos */
    .photos-grid{display:grid;grid-template-columns:1fr;gap:8px;}
    @media(min-width:640px){.photos-grid{grid-template-columns:repeat(2,1fr);}}
    @media(min-width:1024px){.photos-grid{grid-template-columns:repeat(3,1fr);}}
    /* Lots table */
    .table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;}
    table.lots{width:100%;border-collapse:collapse;font-size:14px;}
    table.lots th{background:#000;color:#fff;padding:10px 8px;text-align:left;font-size:13px;font-weight:600;}
    table.lots td{padding:8px;border-bottom:1px solid #e5e7eb;}
    table.lots tr:nth-child(even) td{background:#f9fafb;}
    /* Contact form */
    .form-contact input,.form-contact select,.form-contact textarea{width:100%;padding:12px 14px;font-size:16px;font-family:inherit;border:1px solid #d1d5db;border-radius:${dnkMode ? '0' : '6px'};background:#fff;margin-bottom:12px;color:#111827;}
    .form-contact input:focus,.form-contact select:focus,.form-contact textarea:focus{outline:2px solid ${accent};border-color:${accent};}
    .btn-cta{display:inline-flex;align-items:center;justify-content:center;padding:14px 28px;background:${accent};color:#fff;border:none;border-radius:${dnkMode ? '0' : '6px'};font-size:16px;font-weight:600;cursor:pointer;width:100%;min-height:44px;transition:background .15s;}
    .btn-cta:hover{background:${accentH};}
    .btn-cta:focus-visible{outline:2px solid ${accent};outline-offset:2px;}
    /* CTA band */
    .cta-band{background:${accent};color:#fff;padding:2rem 20px;text-align:center;}
    .cta-band h2{font-size:clamp(1.25rem,3vw,1.75rem);font-weight:700;margin-bottom:8px;}
    .cta-band p{font-size:15px;opacity:.9;margin-bottom:20px;}
    /* Footer */
    .ftr{background:#000;color:#fff;padding:2rem 20px;}
    .ftr a{color:rgba(255,255,255,.7);}
    .ftr a:hover{color:#fff;}
    ${simCss}
  </style>
</head>
<body>
  <!-- NAVBAR -->
  <nav class="nav" role="navigation" aria-label="Navigation principale">
    <a href="/" class="nav-logo">FREE<span>HOME</span></a>
    <div class="nav-links">
      <a href="/#programmes">Programmes</a>
      <a href="/#contact" class="cta">Contact</a>
    </div>
  </nav>

  <!-- HERO -->
  <header class="hero">
    ${coverImg
      ? `<img class="hero-img" src="${esc(coverImg)}" alt="${esc(prog.nom)} — ${esc(prog.commune)}" width="1280" height="500">`
      : `<div class="hero-placeholder"><span style="font-size:3rem;opacity:.3;">🏗</span></div>`
    }
    <div class="hero-ov">
      <div class="container">
        <h1>${esc(prog.nom)}</h1>
        <p class="subline">${esc(prog.commune)}${prog.cp ? ' (' + esc(prog.cp) + ')' : ''}${prog.adresse ? ' &mdash; ' + esc(prog.adresse) : ''}</p>
        ${prog.statut ? `<span class="badge">${esc(prog.statut)}</span>` : ''}
      </div>
    </div>
  </header>

  <main>
    <div class="container">
      <!-- BREADCRUMB -->
      <nav class="breadcrumb" aria-label="Fil d'Ariane">
        <a href="/">Accueil</a>
        <span aria-hidden="true">›</span>
        <a href="/#programmes">Programmes</a>
        <span aria-hidden="true">›</span>
        <span>${esc(prog.nom)}</span>
      </nav>

      <!-- INFO GRID -->
      <div class="info-grid">
        ${prog.statut ? `<div class="info-card"><div class="ic-label">Statut</div><div class="ic-val accent">${esc(prog.statut)}</div></div>` : ''}
        ${prog.livraison ? `<div class="info-card"><div class="ic-label">Livraison</div><div class="ic-val">${esc(prog.livraison_detail || prog.livraison)}</div></div>` : ''}
        ${(prog.surface_min || prog.surface_max) ? `<div class="info-card"><div class="ic-label">Surfaces</div><div class="ic-val">${prog.surface_min ? prog.surface_min + '\u00A0m\u00B2' : ''}${prog.surface_min && prog.surface_max ? ' &mdash; ' : ''}${prog.surface_max && prog.surface_max !== prog.surface_min ? prog.surface_max + '\u00A0m\u00B2' : ''}</div></div>` : ''}
        ${prixLabel ? `<div class="info-card"><div class="ic-label">Prix</div><div class="ic-val accent">${prixLabel}</div></div>` : ''}
        ${prog.reglementation ? `<div class="info-card"><div class="ic-label">R&eacute;glementation</div><div class="ic-val">${esc(prog.reglementation)}</div></div>` : ''}
        ${prog.pieces ? `<div class="info-card"><div class="ic-label">Typologies</div><div class="ic-val">${esc(prog.pieces)}</div></div>` : ''}
        ${prog.lots_total ? `<div class="info-card"><div class="ic-label">Nombre de lots</div><div class="ic-val">${prog.lots_total}</div></div>` : ''}
        ${lotsDisponibles.length > 0 ? `<div class="info-card"><div class="ic-label">Disponibles</div><div class="ic-val accent">${lotsDisponibles.length} lot${lotsDisponibles.length > 1 ? 's' : ''}</div></div>` : ''}
      </div>

      ${eligHtml ? `<div style="padding:0 0 24px;">${eligHtml}</div>` : ''}

      <!-- DESCRIPTION -->
      ${prog.desc_longue || prog.desc_courte ? `
      <section aria-labelledby="desc-title">
        <h2 class="section-title" id="desc-title">Le programme</h2>
        <div style="max-width:800px;line-height:1.75;font-size:15px;color:#374151;">
          ${esc(prog.desc_longue || prog.desc_courte).replace(/\n/g,'<br>')}
        </div>
      </section>` : ''}

      <!-- ATOUTS -->
      ${atoutsHtml ? `
      <section aria-labelledby="atouts-title">
        <h2 class="section-title" id="atouts-title">Points forts</h2>
        <ul style="list-style:none;max-width:800px;">${atoutsHtml}</ul>
      </section>` : ''}

      <!-- PHOTOS -->
      ${photosHtml ? `
      <section aria-labelledby="photos-title">
        <h2 class="section-title" id="photos-title">Photos</h2>
        <div class="photos-grid">${photosHtml}</div>
      </section>` : ''}

      <!-- GRILLE LOTS -->
      ${lots.length > 0 ? `
      <section aria-labelledby="lots-title">
        <h2 class="section-title" id="lots-title">${dnkMode ? 'Grille tarifaire' : 'Lots disponibles'}</h2>
        <div class="table-wrap">
          <table class="lots">
            <thead><tr>
              <th>Lot</th>
              <th>Type</th>
              <th>${dnkMode ? 'Catégorie' : 'Étage'}</th>
              <th>Surface</th>
              <th>Prix HT</th>
              <th>Statut</th>
            </tr></thead>
            <tbody>${lotsHtml}</tbody>
          </table>
        </div>
        ${lotsDisponibles.length > 0 ? `<p style="margin-top:12px;font-size:13px;color:#6b7280;">${lotsDisponibles.length} lot${lotsDisponibles.length > 1 ? 's' : ''} disponible${lotsDisponibles.length > 1 ? 's' : ''}${lotsReserves.length > 0 ? ' &mdash; ' + lotsReserves.length + ' r&eacute;serv&eacute;' + (lotsReserves.length > 1 ? 's' : '') : ''}</p>` : ''}
      </section>` : ''}

      <!-- PRESTATIONS -->
      ${prestHtml ? `
      <section aria-labelledby="presta-title">
        <h2 class="section-title" id="presta-title">Prestations</h2>
        <ul style="list-style:none;max-width:800px;">${prestHtml}</ul>
      </section>` : ''}

    </div><!-- /container -->

    <!-- SIMULATEUR DNK -->
    ${simulateurHtml}

    <!-- CTA CONTACT -->
    <div class="cta-band">
      <div class="container">
        <h2>Int&eacute;ress&eacute; par ce programme&nbsp;?</h2>
        <p>Notre &eacute;quipe vous rappelle sous 24h</p>
        <div style="max-width:560px;margin:0 auto;" class="form-contact">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <input type="text" id="f-prenom" placeholder="Pr&eacute;nom" autocomplete="given-name">
            <input type="text" id="f-nom" placeholder="Nom *" required autocomplete="family-name">
          </div>
          <input type="email" id="f-email" placeholder="Email *" required autocomplete="email">
          <input type="tel" id="f-tel" placeholder="T&eacute;l&eacute;phone" autocomplete="tel">
          <input type="hidden" id="f-prog" value="${esc(prog.nom)}">
          <button class="btn-cta" onclick="submitContact()">Demander &agrave; &ecirc;tre rappel&eacute;</button>
          <p id="f-msg" style="margin-top:8px;font-size:13px;min-height:20px;text-align:center;"></p>
        </div>
      </div>
    </div>

  </main>

  <!-- FOOTER -->
  <footer class="ftr">
    <div class="container">
      <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:20px;">
        <div>
          <p style="font-size:18px;font-weight:700;margin-bottom:8px;">FREEHOME</p>
          <p style="font-size:13px;color:rgba(255,255,255,.6);">Maison &amp; Habitat &mdash; Groupe G2O Participation</p>
          <p style="font-size:13px;color:rgba(255,255,255,.6);margin-top:4px;">7 rue A.M. Amp&egrave;re, 57070 Metz</p>
          <p style="font-size:13px;color:rgba(255,255,255,.6);">06 30 10 51 78 &mdash; contact@mhfreehome.com</p>
        </div>
        <div style="font-size:13px;">
          <a href="/" style="display:block;margin-bottom:6px;">Accueil</a>
          <a href="/#programmes" style="display:block;margin-bottom:6px;">Programmes</a>
          <a href="/mentions-legales" style="display:block;margin-bottom:6px;">Mentions l&eacute;gales</a>
          <a href="/politique-confidentialite" style="display:block;">Confidentialit&eacute;</a>
        </div>
      </div>
      <p style="margin-top:24px;padding-top:16px;border-top:1px solid rgba(255,255,255,.1);font-size:11px;color:rgba(255,255,255,.4);">
        &copy; ${new Date().getFullYear()} FREEHOME &mdash; Tous droits r&eacute;serv&eacute;s &mdash; Promoteur immobilier en Moselle &amp; Meurthe-et-Moselle
      </p>
    </div>
  </footer>

  <script>
  async function submitContact() {
    const prenom = document.getElementById('f-prenom').value.trim();
    const nom    = document.getElementById('f-nom').value.trim();
    const email  = document.getElementById('f-email').value.trim();
    const tel    = document.getElementById('f-tel').value.trim();
    const prog   = document.getElementById('f-prog').value;
    const msg    = document.getElementById('f-msg');
    if (!nom || !email) { msg.style.color='#dc2626'; msg.textContent='Nom et email requis.'; return; }
    msg.style.color='#6b7280'; msg.textContent='Envoi en cours\u2026';
    try {
      const r = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prenom, nom, email, telephone: tel, programme: prog, source: 'Site web' })
      });
      const d = await r.json();
      if (d.success) {
        msg.style.color='#16a34a';
        msg.textContent = 'Message envoy\u00E9 ! Nous vous rappelons sous 24h.';
        document.getElementById('f-prenom').value='';
        document.getElementById('f-nom').value='';
        document.getElementById('f-email').value='';
        document.getElementById('f-tel').value='';
      } else {
        msg.style.color='#dc2626'; msg.textContent='Erreur\u00A0: ' + (d.error||'r\u00E9essayez.');
      }
    } catch(e) {
      msg.style.color='#dc2626'; msg.textContent='Erreur r\u00E9seau, r\u00E9essayez.';
    }
  }
  </script>
  ${dnkMode ? `
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js" crossorigin="anonymous"></script>
  <script src="/js/simulateur-dnk.js"></script>` : ''}
</body>
</html>`;
}
