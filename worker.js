// FREEHOME Worker — Static files + D1 API
// Binding: DB = mhfreehome-db (D1)

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // ═══════════════════════════════════
    // API ROUTES
    // ═══════════════════════════════════

    // GET /api/programmes — retourne tous les programmes avec leurs lots
    if (path === '/api/programmes' && request.method === 'GET') {
      try {
        const progs = await env.DB.prepare('SELECT * FROM programmes ORDER BY id').all();
        const lots = await env.DB.prepare('SELECT * FROM lots ORDER BY programme_nom, num').all();

        const programmes = progs.results.map(p => {
          const progLots = lots.results.filter(l => l.programme_nom === p.nom);
          return {
            id: p.id,
            nom: p.nom,
            commune: p.commune,
            cp: p.cp,
            adresse: p.adresse,
            statut: p.statut,
            reglementation: p.reglementation,
            livraison: p.livraison,
            livraison_detail: p.livraison_detail,
            debut_travaux: p.debut_travaux,
            lots_total: p.lots_total,
            pieces: p.pieces,
            surface_min: p.surface_min,
            surface_max: p.surface_max,
            prix_min: p.prix_min,
            prix_max: p.prix_max,
            eligibilites: p.eligibilites,
            plan3d: p.plan3d,
            youtube: p.youtube,
            img_cover: p.img_cover,
            photos: p.photos,
            desc: p.desc_courte,
            desc_long: p.desc_longue,
            atouts: p.atouts,
            prestations: p.prestations,
            timeline: p.timeline,
            lots: progLots.map(l => ({
              num: l.num,
              etage: l.etage,
              typo: l.typo,
              surface: l.surface,
              prix: l.prix,
              statut: l.statut
            }))
          };
        });

        return new Response(JSON.stringify({ success: true, programmes }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // POST /api/sync — synchronise toutes les données depuis le CMS
    if (path === '/api/sync' && request.method === 'POST') {
      try {
        const data = await request.json();
        let progCount = 0, lotCount = 0;

        if (data.programmes) {
          for (const p of data.programmes) {
            // Upsert programme
            await env.DB.prepare(`
              INSERT INTO programmes (nom, commune, cp, adresse, statut, reglementation, livraison, livraison_detail, debut_travaux, lots_total, pieces, surface_min, surface_max, prix_min, prix_max, eligibilites, plan3d, youtube, img_cover, photos, desc_courte, desc_longue, atouts, prestations, timeline, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
              ON CONFLICT(nom) DO UPDATE SET
                commune=excluded.commune, cp=excluded.cp, adresse=excluded.adresse,
                statut=excluded.statut, reglementation=excluded.reglementation,
                livraison=excluded.livraison, livraison_detail=excluded.livraison_detail,
                debut_travaux=excluded.debut_travaux, lots_total=excluded.lots_total,
                pieces=excluded.pieces, surface_min=excluded.surface_min, surface_max=excluded.surface_max,
                prix_min=excluded.prix_min, prix_max=excluded.prix_max,
                eligibilites=excluded.eligibilites, plan3d=excluded.plan3d,
                youtube=excluded.youtube, img_cover=excluded.img_cover,
                photos=excluded.photos, desc_courte=excluded.desc_courte,
                desc_longue=excluded.desc_longue, atouts=excluded.atouts,
                prestations=excluded.prestations, timeline=excluded.timeline,
                updated_at=datetime('now')
            `).bind(
              p.nom, p.commune, p.cp, p.adresse||'', p.statut,
              p.reglementation||'RE2020', p.livraison||'', p.livraison_detail||'',
              p.debut_travaux||'', p.lots_total||0, p.pieces||'',
              p.surface_min||0, p.surface_max||0, p.prix_min||0, p.prix_max||0,
              p.eligibilites||'', p.plan3d||'', p.youtube||'',
              p.img_cover||'',
              typeof p.photos === 'string' ? p.photos : JSON.stringify(p.photos||[]),
              p.desc_courte||'',
              p.desc_longue||'',
              typeof p.atouts === 'string' ? p.atouts : JSON.stringify(p.atouts||[]),
              typeof p.prestations === 'string' ? p.prestations : JSON.stringify(p.prestations||[]),
              typeof p.timeline === 'string' ? p.timeline : JSON.stringify(p.timeline||[])
            ).run();
            progCount++;

            // Delete old lots for this programme first, then re-insert
            await env.DB.prepare('DELETE FROM lots WHERE programme_nom = ?').bind(p.nom).run();
            if (p.lots && p.lots.length) {
              for (const l of p.lots) {
                await env.DB.prepare(`
                  INSERT INTO lots (programme_nom, num, etage, typo, surface, prix, statut, acquereur, plan3d, updated_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                `).bind(
                  p.nom, l.num, l.etage||'', l.typo||'', l.surface||0,
                  l.prix||0, l.statut||'Disponible', l.acquereur||'', l.plan3d||0
                ).run();
                lotCount++;
              }
            }
          }
        }

        // Sync leads if provided
        if (data.leads && data.leads.length) {
          await env.DB.prepare('DELETE FROM leads').run();
          for (const l of data.leads) {
            await env.DB.prepare(`
              INSERT INTO leads (prenom, nom, programme, typo, budget, statut, source, priorite, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `).bind(
              l.prenom||'', l.nom, l.programme||'', l.typo||'',
              l.budget||'', l.statut||'', l.source||'', l.priorite||'l'
            ).run();
          }
        }

        return new Response(JSON.stringify({
          success: true,
          programmes: progCount,
          lots: lotCount,
          message: `${progCount} programmes et ${lotCount} lots synchronisés`
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // GET /api/leads
    if (path === '/api/leads' && request.method === 'GET') {
      try {
        const leads = await env.DB.prepare('SELECT * FROM leads ORDER BY id DESC').all();
        return new Response(JSON.stringify({ success: true, leads: leads.results }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // ═══════════════════════════════════
    // STATIC FILES (fallback to asset binding)
    // ═══════════════════════════════════
    try {
      return env.ASSETS.fetch(request);
    } catch (e) {
      return new Response('Not found', { status: 404 });
    }
  }
};
