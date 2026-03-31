// worker.js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const allowedOrigins = [
      "https://mhfreehome.com",
      "https://www.mhfreehome.com",
      "https://mhfreehome.fr",
      "https://www.mhfreehome.fr",
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
              surface: l.surface, prix: l.prix, statut: l.statut
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
            await env.DB.prepare("DELETE FROM lots WHERE programme_nom=?").bind(p.nom).run();
            if (p.lots && p.lots.length) {
              for (const l of p.lots) {
                await env.DB.prepare(`
                  INSERT INTO lots (programme_nom,num,etage,typo,surface,prix,statut,acquereur,plan3d,updated_at)
                  VALUES (?,?,?,?,?,?,?,?,?,datetime('now'))
                `).bind(
                  p.nom, l.num, l.etage||"", l.typo||"",
                  l.surface||0, l.prix||0, l.statut||"Disponible",
                  l.acquereur||"", l.plan3d||0
                ).run();
                lotCount++;
              }
            }
          }
        }
        if (data.leads && data.leads.length) {
          await env.DB.prepare("DELETE FROM leads").run();
          for (const l of data.leads) {
            await env.DB.prepare(`
              INSERT INTO leads (prenom,nom,programme,typo,budget,statut,source,priorite,updated_at)
              VALUES (?,?,?,?,?,?,?,?,datetime('now'))
            `).bind(
              l.prenom||"", l.nom, l.programme||"", l.typo||"",
              l.budget||"", l.statut||"", l.source||"", l.priorite||"l"
            ).run();
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
    <p style="margin:0;font-size:.7rem;color:#B0A090">FREE HOME · <a href="https://www.mhfreehome.fr" style="color:#9A8A6A;text-decoration:none">mhfreehome.fr</a> · contact@mhfreehome.fr</p>
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
      <a href="https://www.mhfreehome.fr"
         style="display:inline-block;background:#C9A84C;color:#1A1008;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:.85rem;font-weight:700;letter-spacing:.06em">
        Découvrir nos programmes →
      </a>
    </div>
  </div>

  <!-- CONTACT -->
  <div style="background:#F2EDE4;padding:16px 32px;border-top:1px solid #E4DFD5">
    <p style="margin:0;font-size:.82rem;color:#4A4030">Une question ? Contactez-nous : <a href="mailto:contact@mhfreehome.fr" style="color:#8A6A10;text-decoration:none;font-weight:600">contact@mhfreehome.fr</a></p>
  </div>

  <!-- FOOTER -->
  <div style="border-top:1px solid #E4DFD5;padding:13px 32px;text-align:center">
    <p style="margin:0;font-size:.7rem;color:#B0A090">© FREE HOME · <a href="https://www.mhfreehome.fr" style="color:#9A8A6A;text-decoration:none">mhfreehome.fr</a> · Cet email fait suite à votre demande de contact.</p>
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
        // Supprimer de Vectorize
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
      const BASE = "https://www.mhfreehome.fr";
      const now = new Date().toISOString().split('T')[0];
      let progUrls = '';
      try {
        const progs = await env.DB.prepare("SELECT nom, commune, cp FROM programmes ORDER BY id").all();
        progUrls = progs.results.map(p => {
          const slug = `/${p.commune.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'')}-${p.nom.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'')}`;
          return `  <url><loc>${BASE}${slug}</loc><lastmod>${now}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`;
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
      const robots = `User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: https://www.mhfreehome.fr/sitemap.xml\n`;
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
