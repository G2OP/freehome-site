// simulateur-dnk.js — Simulateur investisseur DYNAMIK PARK
// Extrait de DNK/site/index.html — chargé conditionnellement sur /programme/dynamik-park
// NE PAS modifier sans tester la page SSR correspondante

/* ═══ PRESETS ═══ */
function applyPreset(el) {
  document.querySelectorAll('.preset-card').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  const s = el.dataset;
  document.getElementById('s-surface').value = s.surface;
  document.getElementById('n-price').value = s.price;
  document.getElementById('s-rent').value = s.rent;
  calc();
}

function resetAll() {
  document.getElementById('s-surface').value = 177;
  document.getElementById('n-price').value = 209500;
  document.getElementById('s-notaire').value = 3;
  document.getElementById('s-rent').value = 96;
  document.getElementById('s-occup').value = 90;
  document.getElementById('s-apport').value = 20;
  document.getElementById('s-taux').value = 3.5;
  document.getElementById('s-duree').value = 20;
  document.getElementById('s-tf').value = 15;
  document.getElementById('s-pno').value = 3;
  document.getElementById('s-copro').value = 8;
  document.getElementById('s-gestion').value = 8;
  document.getElementById('s-index').value = 2.0;
  document.getElementById('s-appre').value = 1.5;
  document.querySelectorAll('.preset-card').forEach(c => c.classList.remove('active'));
  document.querySelector('.preset-card').classList.add('active');
  calc();
}

/* ═══ FORMATTERS ═══ */
function fmt(n) { return Math.round(n).toLocaleString('fr-FR'); }
function fmtPct(n) { return n.toFixed(1).replace('.', ',') + '%'; }

/* ═══ TRI — Newton-Raphson ═══ */
function calcTRI(flux) {
  var r = 0.10;
  for (var iter = 0; iter < 200; iter++) {
    var van = 0, dvan = 0;
    for (var t = 0; t < flux.length; t++) {
      var d = Math.pow(1 + r, t);
      van += flux[t] / d;
      if (t > 0) dvan -= t * flux[t] / Math.pow(1 + r, t + 1);
    }
    if (Math.abs(dvan) < 1e-12) break;
    var newR = r - van / dvan;
    if (Math.abs(newR - r) < 1e-8) { r = newR; break; }
    r = newR;
    if (r < -0.99) r = -0.99;
    if (r > 10) r = 10;
  }
  return r;
}

/* ═══ INDEXATION ═══ */
function indexCoef(annee, tauxAn, periode) {
  if (periode === 3) {
    var palier = Math.floor(annee / 3);
    return Math.pow(1 + tauxAn, palier * 3);
  }
  return Math.pow(1 + tauxAn, annee);
}

/* ═══ TOGGLES BAILLEUR / LOCATAIRE ═══ */
var chargePayeur = { tf: true, pno: false, copro: true, gestion: false };

function toggleCharge(key) {
  chargePayeur[key] = !chargePayeur[key];
  var el = document.getElementById('t-' + key);
  var tw = document.getElementById('tw-' + key);
  if (chargePayeur[key]) {
    el.classList.add('locataire');
    tw.textContent = 'Locataire';
    tw.className = 'toggle-who locataire';
  } else {
    el.classList.remove('locataire');
    tw.textContent = 'Bailleur';
    tw.className = 'toggle-who bailleur';
  }
  calc();
}

function isPayeurBailleur(key) { return !chargePayeur[key]; }

/* ═══ CALCUL PRINCIPAL ═══ */
function calc() {
  const surface = parseFloat(document.getElementById('s-surface').value);
  const price = parseFloat(document.getElementById('n-price').value) || 0;
  const notaire = parseFloat(document.getElementById('s-notaire').value);
  const rent = parseFloat(document.getElementById('s-rent').value);
  const occup = parseFloat(document.getElementById('s-occup').value) / 100;
  const apportPct = parseFloat(document.getElementById('s-apport').value) / 100;
  const tauxAn = parseFloat(document.getElementById('s-taux').value) / 100;
  const duree = parseInt(document.getElementById('s-duree').value);
  const tf = parseFloat(document.getElementById('s-tf').value);
  const pno = parseFloat(document.getElementById('s-pno').value);
  const copro = parseFloat(document.getElementById('s-copro').value);
  const gestionPct = parseFloat(document.getElementById('s-gestion').value) / 100;
  const indexAn = parseFloat(document.getElementById('s-index').value) / 100;

  document.getElementById('v-surface').textContent = fmt(surface) + ' m\u00B2';
  document.getElementById('v-notaire').textContent = fmtPct(notaire);
  document.getElementById('v-rent').textContent = fmt(rent) + ' \u20AC';
  document.getElementById('v-occup').textContent = fmt(occup * 100) + '%';
  document.getElementById('v-apport').textContent = fmt(apportPct * 100) + '%';
  document.getElementById('v-taux').textContent = fmtPct(tauxAn * 100);
  document.getElementById('v-duree').textContent = duree + ' ans';
  document.getElementById('v-tf').textContent = fmt(tf) + ' \u20AC/m\u00B2';
  document.getElementById('v-pno').textContent = pno.toFixed(1).replace('.', ',') + ' \u20AC/m\u00B2';
  document.getElementById('v-copro').textContent = fmt(copro) + ' \u20AC/m\u00B2';
  document.getElementById('v-gestion').textContent = fmt(gestionPct * 100) + '%';
  document.getElementById('v-index').textContent = fmtPct(indexAn * 100);

  var appreAn = parseFloat(document.getElementById('s-appre').value) / 100;
  document.getElementById('v-appre').textContent = fmtPct(appreAn * 100);

  // Jauge contextuelle appréciation
  var apprePct = appreAn * 100;
  var gaugeHtml = '<div style="display:flex;align-items:center;gap:4px;margin-bottom:4px;">';
  gaugeHtml += '<div style="flex:1;height:6px;background:#333;position:relative;">';
  gaugeHtml += '<div style="position:absolute;left:0;top:0;height:100%;width:' + Math.min(apprePct/5*100,100) + '%;background:' + (apprePct <= 1 ? 'var(--sim-gm)' : apprePct <= 2.5 ? 'var(--sim-or)' : 'var(--sim-ok)') + ';"></div>';
  gaugeHtml += '<div style="position:absolute;left:20%;top:-3px;width:1px;height:12px;background:var(--sim-wh);"></div>';
  gaugeHtml += '<div style="position:absolute;left:40%;top:-3px;width:1px;height:12px;background:var(--sim-wh);"></div>';
  gaugeHtml += '<div style="position:absolute;left:60%;top:-3px;width:1px;height:12px;background:var(--sim-wh);"></div>';
  gaugeHtml += '</div></div>';
  var situation = '';
  if (apprePct <= 0.5) situation = '<span style="color:var(--sim-gm);">Tr\u00E8s conservateur \u2014 inf\u00E9rieur \u00E0 l\'inflation</span>';
  else if (apprePct <= 1.5) situation = '<span style="color:var(--sim-gm);">Conservateur \u2014 sous l\'inflation (INSEE moy. ~2%/an)</span>';
  else if (apprePct <= 2.5) situation = '<span style="color:var(--sim-or);">Mod\u00E9r\u00E9 \u2014 proche inflation, coh\u00E9rent march\u00E9 activit\u00E9 Grand Est</span>';
  else if (apprePct <= 3.5) situation = '<span style="color:var(--sim-or);">R\u00E9aliste \u2014 moy. immo activit\u00E9 France 2015-2025 (CBRE : 2-4%/an)</span>';
  else situation = '<span style="color:var(--sim-ok);">Optimiste \u2014 haut de fourchette, \u00E0 justifier par la localisation</span>';
  gaugeHtml += situation;
  gaugeHtml += '<div style="margin-top:4px;font-size:11px;color:#777;">R\u00E9f. : Inflation INSEE ~2%/an | Immo activit\u00E9 France ~2-4%/an (CBRE) | Logistique premium ~3-5%/an</div>';
  document.getElementById('appre-gauge').innerHTML = gaugeHtml;

  // Revenus
  const loyerBrutAn = surface * rent;
  const loyerNetAn = loyerBrutAn * occup;
  const loyerMensNet = loyerNetAn / 12;

  // Charges
  const chargesTF = surface * tf;
  const chargesPNO = surface * pno;
  const chargesCopro = surface * copro;
  const chargesGestion = loyerNetAn * gestionPct;
  var chargesBailleurAn = 0;
  if (isPayeurBailleur('tf')) chargesBailleurAn += chargesTF;
  if (isPayeurBailleur('pno')) chargesBailleurAn += chargesPNO;
  if (isPayeurBailleur('copro')) chargesBailleurAn += chargesCopro;
  if (isPayeurBailleur('gestion')) chargesBailleurAn += chargesGestion;
  var chargesBailleurMens = chargesBailleurAn / 12;

  // Rentabilité
  const investTotal = price * (1 + notaire / 100);
  const rdtBrut = price > 0 ? (loyerBrutAn / price) * 100 : 0;
  const rdtNet = investTotal > 0 ? ((loyerNetAn - chargesBailleurAn) / investTotal) * 100 : 0;

  // Financement
  const apportEur = price * apportPct;
  const emprunt = price * (1 - apportPct);
  const tauxMens = tauxAn / 12;
  const nbMens = duree * 12;
  let mensualite = 0;
  if (emprunt > 0 && tauxMens > 0) {
    mensualite = emprunt * tauxMens / (1 - Math.pow(1 + tauxMens, -nbMens));
  } else if (emprunt > 0 && tauxMens === 0) {
    mensualite = emprunt / nbMens;
  }
  const coutCredit = mensualite * nbMens;

  // Cash-flow
  const cashflowMens = loyerMensNet - mensualite - chargesBailleurMens;
  const cashflowAn = cashflowMens * 12;
  const totalSortiesMens = mensualite + chargesBailleurMens;
  const couverture = totalSortiesMens > 0 ? (loyerMensNet / totalSortiesMens) * 100 : 999;

  // Affichage revenus
  document.getElementById('r-loyer-brut').textContent = fmt(loyerBrutAn) + ' \u20AC/an';
  document.getElementById('r-loyer-net').textContent = fmt(loyerNetAn) + ' \u20AC/an';
  document.getElementById('r-loyer-mens').textContent = fmt(loyerMensNet) + ' \u20AC/mois';
  document.getElementById('r-rdt-brut').textContent = fmtPct(rdtBrut);
  document.getElementById('r-rdt-brut2').textContent = fmtPct(rdtBrut);
  document.getElementById('r-rdt-net').textContent = fmtPct(rdtNet);
  document.getElementById('r-charges').textContent = fmt(chargesBailleurAn) + ' \u20AC/an';
  document.getElementById('r-invest').textContent = fmt(investTotal) + ' \u20AC';
  document.getElementById('r-apport').textContent = fmt(apportEur) + ' \u20AC';
  document.getElementById('r-emprunt').textContent = fmt(emprunt) + ' \u20AC';
  document.getElementById('r-mensualite').textContent = fmt(mensualite) + ' \u20AC/mois';
  document.getElementById('r-cout-credit').textContent = fmt(coutCredit) + ' \u20AC';

  // Detail CF
  var cfHtml = '';
  cfHtml += '<div class="cf-line"><span class="cf-op" style="color:var(--sim-ok);">+</span><span class="cf-lab">Loyer net mensuel</span><span class="cf-val" style="color:var(--sim-ok);">+' + fmt(loyerMensNet) + ' \u20AC</span></div>';
  if (mensualite > 0) {
    cfHtml += '<div class="cf-line"><span class="cf-op" style="color:var(--sim-err);">\u2212</span><span class="cf-lab">Mensualit\u00E9 cr\u00E9dit</span><span class="cf-val" style="color:var(--sim-err);">\u2212' + fmt(mensualite) + ' \u20AC</span></div>';
  }
  if (isPayeurBailleur('tf')) {
    cfHtml += '<div class="cf-line"><span class="cf-op" style="color:var(--sim-err);">\u2212</span><span class="cf-lab">Taxe fonci\u00E8re</span><span class="cf-val" style="color:var(--sim-err);">\u2212' + fmt(chargesTF / 12) + ' \u20AC</span></div>';
  }
  if (isPayeurBailleur('pno')) {
    cfHtml += '<div class="cf-line"><span class="cf-op" style="color:var(--sim-err);">\u2212</span><span class="cf-lab">Assurance PNO</span><span class="cf-val" style="color:var(--sim-err);">\u2212' + fmt(chargesPNO / 12) + ' \u20AC</span></div>';
  }
  if (isPayeurBailleur('copro')) {
    cfHtml += '<div class="cf-line"><span class="cf-op" style="color:var(--sim-err);">\u2212</span><span class="cf-lab">Charges copro</span><span class="cf-val" style="color:var(--sim-err);">\u2212' + fmt(chargesCopro / 12) + ' \u20AC</span></div>';
  }
  if (isPayeurBailleur('gestion')) {
    cfHtml += '<div class="cf-line"><span class="cf-op" style="color:var(--sim-err);">\u2212</span><span class="cf-lab">Gestion locative</span><span class="cf-val" style="color:var(--sim-err);">\u2212' + fmt(chargesGestion / 12) + ' \u20AC</span></div>';
  }
  var cfColor = cashflowMens >= 0 ? 'var(--sim-ok)' : 'var(--sim-err)';
  var cfSign = cashflowMens >= 0 ? '+' : '';
  cfHtml += '<div class="cf-line cf-total"><span class="cf-op" style="color:' + cfColor + ';">=</span><span class="cf-lab">CASH-FLOW NET MENSUEL</span><span class="cf-val" style="color:' + cfColor + '; font-size:18px;">' + cfSign + fmt(cashflowMens) + ' \u20AC</span></div>';
  document.getElementById('cf-detail').innerHTML = cfHtml;

  var cfAnEl = document.getElementById('r-cashflow-an');
  cfAnEl.textContent = (cashflowAn >= 0 ? '+' : '') + fmt(cashflowAn) + ' \u20AC/an';
  cfAnEl.className = 'result-value ' + (cashflowAn >= 0 ? 'ok' : 'err');
  var covEl = document.getElementById('r-couverture');
  covEl.textContent = fmtPct(couverture);
  if (couverture >= 100) { covEl.className = 'result-value ok'; }
  else if (couverture >= 80) { covEl.className = 'result-value warn'; }
  else { covEl.className = 'result-value err'; }
  var covFill = document.getElementById('cov-fill');
  covFill.style.width = Math.min(Math.min(couverture, 200), 100) + '%';
  if (couverture >= 100) { covFill.style.background = 'var(--sim-ok)'; }
  else if (couverture >= 80) { covFill.style.background = 'var(--sim-warn)'; }
  else { covFill.style.background = 'var(--sim-err)'; }
  var bsEl = document.getElementById('bs-rdt');
  if (rdtBrut >= 7) { bsEl.style.background = 'var(--sim-or)'; }
  else if (rdtBrut >= 5) { bsEl.style.background = 'var(--sim-warn)'; }
  else { bsEl.style.background = 'var(--sim-gm)'; }

  // Projection flux
  var projDuree = projDureeGlobal;
  var fluxRows = [];
  var cumulCFIdx = 0;
  var effortCumule = 0;
  for (var a = 0; a < projDuree; a++) {
    var lbA = loyerBrutAn * indexCoef(a, indexAn, revisionPeriode);
    var lnA = lbA * occup;
    var chBA = 0;
    if (isPayeurBailleur('tf')) chBA += surface * tf * indexCoef(a, indexAn, revisionPeriode);
    if (isPayeurBailleur('pno')) chBA += surface * pno * indexCoef(a, indexAn, revisionPeriode);
    if (isPayeurBailleur('copro')) chBA += surface * copro * indexCoef(a, indexAn, revisionPeriode);
    if (isPayeurBailleur('gestion')) chBA += lnA * gestionPct;
    var credA = (a < duree) ? mensualite * 12 : 0;
    var cfA = lnA - credA - chBA;
    cumulCFIdx += cfA;
    if (cfA < 0) effortCumule += Math.abs(cfA);
    fluxRows.push({ an: a+1, loyerNet: lnA, credit: credA, charges: chBA, cf: cfA, cumul: cumulCFIdx });
  }
  var capitalTotal = apportEur + effortCumule;
  var valeurPat = price * Math.pow(1 + appreAn, projDuree);
  var crdRestant = 0;
  if (emprunt > 0 && tauxMens > 0 && projDuree < duree) {
    var mp = projDuree * 12;
    crdRestant = emprunt * Math.pow(1+tauxMens,mp) - mensualite*(Math.pow(1+tauxMens,mp)-1)/tauxMens;
    if (crdRestant < 0) crdRestant = 0;
  }
  var valeurNette = valeurPat - crdRestant;
  var gainTotal = valeurNette + cumulCFIdx - capitalTotal;
  var triFlux = [-apportEur];
  for (var fi2 = 0; fi2 < fluxRows.length; fi2++) {
    var cfFlux = fluxRows[fi2].cf;
    if (fi2 === fluxRows.length - 1) cfFlux += valeurNette;
    triFlux.push(cfFlux);
  }
  var rciAn = calcTRI(triFlux) * 100;
  var multi = capitalTotal > 0 ? (valeurNette + Math.max(cumulCFIdx,0)) / capitalTotal : 0;

  var tbody = '';
  var prevSign = null;
  for (var i = 0; i < fluxRows.length; i++) {
    var r = fluxRows[i];
    var cls = r.cf >= 0 ? 'yr-positive' : 'yr-negative';
    if (prevSign !== null && prevSign < 0 && r.cf >= 0) cls += ' yr-pivot';
    prevSign = r.cf;
    tbody += '<tr class="'+cls+'"><td>'+r.an+'</td><td>'+fmt(r.loyerNet)+'</td><td>'+(r.credit>0?fmt(r.credit):'\u2014')+'</td><td>'+fmt(r.charges)+'</td><td>'+(r.cf>=0?'+':'')+fmt(r.cf)+'</td><td style="color:'+(r.cumul>=0?'var(--sim-ok)':'var(--sim-err)')+';">'+(r.cumul>=0?'+':'')+fmt(r.cumul)+'</td></tr>';
  }
  tbody += '<tr style="background:var(--sim-or);color:#fff;font-weight:700;"><td>TOTAL</td><td colspan="3"></td><td>'+(cumulCFIdx>=0?'+':'')+fmt(cumulCFIdx)+'</td><td>'+(cumulCFIdx>=0?'+':'')+fmt(cumulCFIdx)+'</td></tr>';
  document.getElementById('flux-body').innerHTML = tbody;
  document.getElementById('r-proj-label').textContent = projDuree + ' ans';
  document.getElementById('r-vp-label').textContent = 'Valeur patrimoniale (+' + fmtPct(appreAn * 100) + '/an)';
  document.getElementById('r-capital-total').textContent = fmt(capitalTotal) + ' \u20AC';
  document.getElementById('r-valeur-pat').textContent = fmt(valeurPat) + ' \u20AC';
  document.getElementById('r-crd-restant').textContent = crdRestant > 0 ? fmt(crdRestant) + ' \u20AC' : '0 \u20AC (sold\u00E9)';
  document.getElementById('r-crd-restant').className = 'result-value ' + (crdRestant > 0 ? 'warn' : 'ok');
  document.getElementById('r-valeur-nette').textContent = fmt(valeurNette) + ' \u20AC';
  document.getElementById('r-cumul-cf').textContent = (cumulCFIdx >= 0 ? '+' : '') + fmt(cumulCFIdx) + ' \u20AC';
  document.getElementById('r-cumul-cf').className = 'result-value ' + (cumulCFIdx >= 0 ? 'ok' : 'err');
  document.getElementById('r-gain-total').textContent = (gainTotal >= 0 ? '+' : '') + fmt(gainTotal) + ' \u20AC';
  document.getElementById('r-gain-total').className = 'result-value highlight ' + (gainTotal >= 0 ? 'ok' : 'err');
  document.getElementById('r-rci').textContent = fmtPct(rciAn) + ' /an';
  document.getElementById('r-rci').className = 'result-value highlight ' + (rciAn >= 5 ? 'ok' : rciAn >= 0 ? 'warn' : 'err');
  document.getElementById('r-multi').textContent = 'x' + multi.toFixed(2);
  document.getElementById('r-multi').className = 'result-value ' + (multi >= 2 ? 'ok' : multi >= 1 ? 'warn' : 'err');
}

/* ═══ DUREE PROJECTION ═══ */
var revisionPeriode = 1;
function setRevision(n) {
  revisionPeriode = n;
  document.querySelectorAll('[data-rev]').forEach(function(b) { b.classList.toggle('active', parseInt(b.dataset.rev) === n); });
  calc();
}

function toggleFlux() {
  var w = document.getElementById('flux-wrap');
  var a = document.getElementById('flux-arrow');
  if (w.style.display === 'none') { w.style.display = 'block'; a.style.transform = 'rotate(90deg)'; }
  else { w.style.display = 'none'; a.style.transform = 'rotate(0deg)'; }
}

var projDureeGlobal = 20;
function setProjDuree(y) {
  projDureeGlobal = y;
  document.querySelectorAll('.proj-btn').forEach(function(b) { b.classList.toggle('active', parseInt(b.dataset.y) === y); });
  calc();
}

/* ═══ PDF ETUDE PERSONNALISEE ═══ */
function generateStudyPDF() {
  if (!window.jspdf) { alert('Chargement en cours, r\u00E9essayez dans 2 secondes.'); return; }
  const { jsPDF } = window.jspdf;
  function pdfFmt(n) {
    var s = Math.round(n).toString();
    var result = '';
    var len = s.length;
    var neg = false;
    if (s.charAt(0) === '-') { neg = true; s = s.substring(1); len = s.length; }
    for (var i = 0; i < len; i++) {
      if (i > 0 && (len - i) % 3 === 0) result += ' ';
      result += s.charAt(i);
    }
    return neg ? '-' + result : result;
  }
  function pdfPct(n) { return n.toFixed(1).replace('.', ',') + '%'; }
  const doc = new jsPDF('p', 'mm', 'a4');
  const W = 210, H = 297;
  const ML = 18, MR = 18;
  const CW = W - ML - MR;
  let y = 0;
  const OR = [255, 70, 20];
  const BK = [0, 0, 0];
  const WH = [255, 255, 255];
  const GD = [44, 44, 43];
  const GM = [138, 138, 141];
  const GL = [240, 240, 240];
  function addPage() { doc.addPage(); y = 0; }

  // PAGE 1
  doc.setFillColor(...BK);
  doc.rect(0, 0, W, 20, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...OR);
  doc.text('DNK', ML, 13);
  doc.setTextColor(...WH);
  doc.text(' DYNAMIK PARK', ML + 16, 13);
  doc.setFontSize(8);
  doc.setTextColor(...GM);
  doc.text('Etude investisseur personnalisee', W - MR, 13, { align: 'right' });
  y = 20;
  doc.setFillColor(...OR);
  doc.rect(0, y, W, 12, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...WH);
  doc.text('SIMULATION D\'INVESTISSEMENT \u2014 DNK DYNAMIK PARK', ML, y + 8);
  y += 12;
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GM);
  const now = new Date();
  doc.text('Generee le ' + now.toLocaleDateString('fr-FR') + ' a ' + now.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'}), ML, y);
  y += 8;

  // Recap projet
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...BK);
  doc.text('LE PROJET', ML, y);
  doc.setFillColor(...OR);
  doc.rect(ML, y + 2, 40, 1, 'F');
  y += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GD);
  const projectLines = [
    'Batiment d\'activite neuf \u2014 Route de Fey (RD66) \u2014 57420 CUVRY',
    'Surface totale : 3 350 m2 | 70 places parking | Hauteur libre 8,50 m',
    '2 cellules commerce vitrine (183 m2) + 4 cellules intermediaires (177 m2)',
    '+ 1 cellule activite sportive (Padel ..) 2 275 m2 avec clubhouse',
    'Adjacent Amazon (4 000 emplois CDI) | A31 a 3 km | Gare TGV 15 min'
  ];
  projectLines.forEach(l => { doc.text(l, ML, y); y += 5; });
  y += 6;

  // Parametres
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...BK);
  doc.text('PARAMETRES DE VOTRE SIMULATION', ML, y);
  doc.setFillColor(...OR);
  doc.rect(ML, y + 2, 70, 1, 'F');
  y += 10;
  const surface = parseFloat(document.getElementById('s-surface').value);
  const price = parseFloat(document.getElementById('n-price').value) || 0;
  const notaire = parseFloat(document.getElementById('s-notaire').value);
  const rent = parseFloat(document.getElementById('s-rent').value);
  const occup = parseFloat(document.getElementById('s-occup').value);
  const apportPct2 = parseFloat(document.getElementById('s-apport').value);
  const tauxAn2 = parseFloat(document.getElementById('s-taux').value);
  const duree = parseInt(document.getElementById('s-duree').value);
  const tf = parseFloat(document.getElementById('s-tf').value);
  const pno = parseFloat(document.getElementById('s-pno').value);
  const copro = parseFloat(document.getElementById('s-copro').value);
  const gestionPct2 = parseFloat(document.getElementById('s-gestion').value);
  const indexAnPdf = parseFloat(document.getElementById('s-index').value);
  var appreAnPdf = parseFloat(document.getElementById('s-appre').value) / 100;
  const params = [
    ['Surface', pdfFmt(surface) + ' m2'],
    ['Prix acquisition HT', pdfFmt(price) + ' EUR'],
    ['Frais de notaire', notaire + '%'],
    ['Loyer HT /m2/an', pdfFmt(rent) + ' EUR'],
    ['Taux occupation', occup + '%'],
    ['Apport personnel', apportPct2 + '%'],
    ['Taux de credit', tauxAn2 + '%'],
    ['Duree credit', duree + ' ans'],
    ['Taxe fonciere', pdfFmt(tf) + ' EUR/m2'],
    ['Assurance PNO', pno.toFixed(1) + ' EUR/m2'],
    ['Charges copropriete', pdfFmt(copro) + ' EUR/m2'],
    ['Gestion locative', gestionPct2 + '%'],
    ['Indexation ILAT/ILC', indexAnPdf.toFixed(1) + '%'],
    ['Appreciation annuelle', (appreAnPdf * 100).toFixed(1) + '%'],
  ];
  doc.setFontSize(8);
  const colW = CW / 2;
  params.forEach((p, i) => {
    const row = Math.floor(i / 2);
    const col = i % 2;
    const px = ML + col * colW;
    const py = y + row * 6;
    if (row % 2 === 0) {
      doc.setFillColor(...GL);
      doc.rect(ML, py - 1, CW, 6, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GD);
    doc.text(p[0], px, py + 3);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...OR);
    doc.text(p[1], px + colW - 4, py + 3, { align: 'right' });
  });
  y += Math.ceil(params.length / 2) * 6 + 4;

  // Calculs complets
  const loyerBrutAn = surface * rent;
  const loyerNetAn = loyerBrutAn * (occup / 100);
  const loyerMensNet = loyerNetAn / 12;
  const chTF = surface * tf;
  const chPNO = surface * pno;
  const chCopro = surface * copro;
  const chGestion = loyerNetAn * (gestionPct2 / 100);
  var chargesBailleur = 0;
  if (isPayeurBailleur('tf')) chargesBailleur += chTF;
  if (isPayeurBailleur('pno')) chargesBailleur += chPNO;
  if (isPayeurBailleur('copro')) chargesBailleur += chCopro;
  if (isPayeurBailleur('gestion')) chargesBailleur += chGestion;
  const investTotal = price * (1 + notaire / 100);
  const rdtBrut = price > 0 ? (loyerBrutAn / price) * 100 : 0;
  const rdtNet = investTotal > 0 ? ((loyerNetAn - chargesBailleur) / investTotal) * 100 : 0;
  const apportEur = price * (apportPct2 / 100);
  const emprunt = price * (1 - apportPct2 / 100);
  const tauxMens2 = (tauxAn2 / 100) / 12;
  const nbMens = duree * 12;
  let mensualite2 = 0;
  if (emprunt > 0 && tauxMens2 > 0) {
    mensualite2 = emprunt * tauxMens2 / (1 - Math.pow(1 + tauxMens2, -nbMens));
  } else if (emprunt > 0) {
    mensualite2 = emprunt / nbMens;
  }
  const cashflowMens2 = loyerMensNet - mensualite2 - chargesBailleur / 12;
  const cashflowAn2 = cashflowMens2 * 12;
  const totalSortiesMens2 = mensualite2 + chargesBailleur / 12;
  const couverture2 = totalSortiesMens2 > 0 ? (loyerMensNet / totalSortiesMens2) * 100 : 999;
  const projDureePdf = projDureeGlobal;
  const indexAnPct = indexAnPdf / 100;
  const valeurPat2 = price * Math.pow(1 + appreAnPdf, projDureePdf);
  var effortPdf = 0, cfPosPdf = 0, cumulCFPdf = 0;
  for (var aa = 0; aa < projDureePdf; aa++) {
    var lbA = loyerBrutAn * indexCoef(aa, indexAnPct, revisionPeriode);
    var lnA2 = lbA * (occup / 100);
    var chBA = 0;
    if (isPayeurBailleur('tf')) chBA += surface * tf * indexCoef(aa, indexAnPct, revisionPeriode);
    if (isPayeurBailleur('pno')) chBA += surface * pno * indexCoef(aa, indexAnPct, revisionPeriode);
    if (isPayeurBailleur('copro')) chBA += surface * copro * indexCoef(aa, indexAnPct, revisionPeriode);
    if (isPayeurBailleur('gestion')) chBA += lnA2 * (gestionPct2 / 100);
    var credA = (aa < duree) ? mensualite2 * 12 : 0;
    var cfA2 = lnA2 - credA - chBA;
    cumulCFPdf += cfA2;
    if (cfA2 < 0) effortPdf += Math.abs(cfA2);
    else cfPosPdf += cfA2;
  }
  var capitalTotalPdf = apportEur + effortPdf;
  var crdRestantPdf = 0;
  if (emprunt > 0 && tauxMens2 > 0 && projDureePdf < duree) {
    var mpPdf = projDureePdf * 12;
    crdRestantPdf = emprunt * Math.pow(1 + tauxMens2, mpPdf) - mensualite2 * (Math.pow(1 + tauxMens2, mpPdf) - 1) / tauxMens2;
    if (crdRestantPdf < 0) crdRestantPdf = 0;
  }
  var valeurNettePdf = valeurPat2 - crdRestantPdf;
  var gainTotalPdf = valeurNettePdf + cfPosPdf - capitalTotalPdf;
  var triFluxPdf = [-apportEur];
  for (var ft = 0; ft < projDureePdf; ft++) {
    var lbF = loyerBrutAn * indexCoef(ft, indexAnPct, revisionPeriode);
    var lnF = lbF * (occup / 100);
    var chBF = 0;
    if (isPayeurBailleur('tf')) chBF += surface * tf * indexCoef(ft, indexAnPct, revisionPeriode);
    if (isPayeurBailleur('pno')) chBF += surface * pno * indexCoef(ft, indexAnPct, revisionPeriode);
    if (isPayeurBailleur('copro')) chBF += surface * copro * indexCoef(ft, indexAnPct, revisionPeriode);
    if (isPayeurBailleur('gestion')) chBF += lnF * (gestionPct2 / 100);
    var crF = (ft < duree) ? mensualite2 * 12 : 0;
    var cfF = lnF - crF - chBF;
    if (ft === projDureePdf - 1) cfF += valeurNettePdf;
    triFluxPdf.push(cfF);
  }
  var rciAnPdf = calcTRI(triFluxPdf) * 100;
  var multiPdf = capitalTotalPdf > 0 ? (valeurNettePdf + cfPosPdf) / capitalTotalPdf : 0;

  // Big rendement
  doc.setFillColor(...OR);
  doc.rect(ML, y, CW, 18, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(...WH);
  doc.text(pdfPct(rdtBrut), W / 2, y + 11, { align: 'center' });
  doc.setFontSize(9);
  doc.text('Rendement brut', W / 2, y + 16, { align: 'center' });
  y += 24;

  // Tableau résultats
  const results = [
    ['REVENUS LOCATIFS', ''],
    ['Loyer brut annuel', pdfFmt(loyerBrutAn) + ' EUR/an'],
    ['Loyer net (apres vacance)', pdfFmt(loyerNetAn) + ' EUR/an'],
    ['Loyer mensuel net', pdfFmt(loyerMensNet) + ' EUR/mois'],
    ['', ''],
    ['RENTABILITE', ''],
    ['Rendement brut', pdfPct(rdtBrut)],
    ['Rendement net (apres charges bailleur)', pdfPct(rdtNet)],
    ['Charges bailleur annuelles', pdfFmt(chargesBailleur) + ' EUR/an'],
    ['', ''],
    ['FINANCEMENT', ''],
    ['Investissement total', pdfFmt(investTotal) + ' EUR'],
    ['Apport personnel', pdfFmt(apportEur) + ' EUR'],
    ['Montant emprunte', pdfFmt(emprunt) + ' EUR'],
    ['Mensualite credit', pdfFmt(mensualite2) + ' EUR/mois'],
    ['', ''],
    ['CASH-FLOW MENSUEL', ''],
    ['+ Loyer net mensuel', '+' + pdfFmt(loyerMensNet) + ' EUR'],
    ['- Mensualite credit', '-' + pdfFmt(mensualite2) + ' EUR'],
  ];
  if (isPayeurBailleur('tf')) results.push(['- Taxe fonciere (bailleur)', '-' + pdfFmt(chTF / 12) + ' EUR']);
  if (isPayeurBailleur('pno')) results.push(['- Assurance PNO (bailleur)', '-' + pdfFmt(chPNO / 12) + ' EUR']);
  if (isPayeurBailleur('copro')) results.push(['- Charges copro (bailleur)', '-' + pdfFmt(chCopro / 12) + ' EUR']);
  if (isPayeurBailleur('gestion')) results.push(['- Gestion locative (bailleur)', '-' + pdfFmt(chGestion / 12) + ' EUR']);
  results.push(
    ['= CASH-FLOW NET MENSUEL', (cashflowMens2 >= 0 ? '+' : '') + pdfFmt(cashflowMens2) + ' EUR/mois'],
    ['Cash-flow annuel', (cashflowAn2 >= 0 ? '+' : '') + pdfFmt(cashflowAn2) + ' EUR/an'],
    ['Couverture des sorties par les loyers', pdfPct(couverture2)],
    ['', ''],
    ['BILAN A ' + projDureePdf + ' ANS', ''],
    ['Capital investi (apport + effort)', pdfFmt(capitalTotalPdf) + ' EUR'],
    ['Valeur patrimoniale (+' + (appreAnPdf * 100).toFixed(1) + '%/an)', pdfFmt(valeurPat2) + ' EUR'],
    ['CRD (capital restant du)', crdRestantPdf > 0 ? pdfFmt(crdRestantPdf) + ' EUR' : '0 EUR (solde)'],
    ['Valeur nette a la revente', pdfFmt(valeurNettePdf) + ' EUR'],
    ['CF cumule net', (cumulCFPdf >= 0 ? '+' : '') + pdfFmt(cumulCFPdf) + ' EUR'],
    ['', ''],
    ['GAIN TOTAL NET', (gainTotalPdf >= 0 ? '+' : '') + pdfFmt(gainTotalPdf) + ' EUR'],
    ['TRI (taux de rendement interne)', pdfPct(rciAnPdf) + ' /an'],
    ['Multiplicateur', 'x' + multiPdf.toFixed(2)],
  );
  doc.setFontSize(8);
  results.forEach(r => {
    if (y > 270) { addPage(); y = 20; }
    if (r[0] === '' && r[1] === '') { y += 3; return; }
    if (r[1] === '') {
      doc.setFillColor(...BK);
      doc.rect(ML, y, CW, 6, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...WH);
      doc.setFontSize(7);
      doc.text(r[0], ML + 3, y + 4);
      y += 8;
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...GD);
      doc.setFontSize(8);
      doc.text(r[0], ML + 2, y + 3);
      doc.setFont('helvetica', 'bold');
      var v1 = r[1].trim();
      var lab = r[0].trim();
      if (v1.indexOf('+') === 0 || v1 === 'Aucun' || v1.indexOf('solde') >= 0) {
        doc.setTextColor(22, 163, 74);
      } else if (lab.indexOf('Couverture') >= 0 && parseFloat(v1) >= 100) {
        doc.setTextColor(22, 163, 74);
      } else if (lab.indexOf('TRI') >= 0 && parseFloat(v1) > 0) {
        doc.setTextColor(22, 163, 74);
      } else if (lab.indexOf('Multiplicateur') >= 0 && parseFloat(v1.replace('x','')) > 1) {
        doc.setTextColor(22, 163, 74);
      } else if (v1.indexOf('-') === 0) {
        doc.setTextColor(220, 38, 38);
      } else if (lab.indexOf('Couverture') >= 0 && parseFloat(v1) < 100) {
        doc.setTextColor(220, 38, 38);
      } else {
        doc.setTextColor(...OR);
      }
      doc.text(r[1], W - MR - 2, y + 3, { align: 'right' });
      y += 6;
    }
  });

  // Annexe flux
  addPage();
  doc.setFillColor(...BK);
  doc.rect(0, 0, W, 16, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...OR);
  doc.text('ANNEXE \u2014 FLUX DE TRESORERIE PREVISIONNEL SUR ' + projDureePdf + ' ANS', ML, 11);
  doc.setFontSize(7);
  doc.setTextColor(...GM);
  doc.text('Loyer indexe ' + indexAnPdf.toFixed(1) + '%/an (ILAT/ILC) | Charges bailleur indexees | Credit fixe', ML, 15);
  y = 22;
  var cols = [ML, ML+12, ML+42, ML+72, ML+102, ML+132];
  var colLabels = ['An.', 'Loyer net', 'Credit', 'Charges', 'CF net', 'CF cumule'];
  doc.setFillColor(...BK);
  doc.rect(ML, y, CW, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...WH);
  for (var ci = 0; ci < colLabels.length; ci++) { doc.text(colLabels[ci], cols[ci] + 1, y + 4); }
  y += 8;
  doc.setFontSize(7);
  var fluxPdfRows = [];
  var cumPdf2 = 0;
  for (var bb = 0; bb < projDureePdf; bb++) {
    var lb2 = loyerBrutAn * indexCoef(bb, indexAnPct, revisionPeriode);
    var ln2 = lb2 * (occup / 100);
    var chB2 = 0;
    if (isPayeurBailleur('tf')) chB2 += surface * tf * indexCoef(bb, indexAnPct, revisionPeriode);
    if (isPayeurBailleur('pno')) chB2 += surface * pno * indexCoef(bb, indexAnPct, revisionPeriode);
    if (isPayeurBailleur('copro')) chB2 += surface * copro * indexCoef(bb, indexAnPct, revisionPeriode);
    if (isPayeurBailleur('gestion')) chB2 += ln2 * (gestionPct2 / 100);
    var cr2 = (bb < duree) ? mensualite2 * 12 : 0;
    var cf2 = ln2 - cr2 - chB2;
    cumPdf2 += cf2;
    fluxPdfRows.push({ an: bb+1, ln: ln2, cr: cr2, ch: chB2, cf: cf2, cum: cumPdf2 });
  }
  for (var fi = 0; fi < fluxPdfRows.length; fi++) {
    if (y > 275) { addPage(); y = 10; }
    var fr = fluxPdfRows[fi];
    if (fi % 2 === 0) { doc.setFillColor(248,248,248); doc.rect(ML, y-1, CW, 5.5, 'F'); }
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GD);
    doc.text(String(fr.an), cols[0]+1, y+3);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GD);
    doc.text(pdfFmt(fr.ln), cols[1]+1, y+3);
    doc.text(fr.cr > 0 ? pdfFmt(fr.cr) : '--', cols[2]+1, y+3);
    doc.text(pdfFmt(fr.ch), cols[3]+1, y+3);
    doc.setFont('helvetica', 'bold');
    if (fr.cf >= 0) { doc.setTextColor(22, 163, 74); } else { doc.setTextColor(220, 38, 38); }
    doc.text((fr.cf >= 0 ? '+' : '') + pdfFmt(fr.cf), cols[4]+1, y+3);
    if (fr.cum >= 0) { doc.setTextColor(22, 163, 74); } else { doc.setTextColor(220, 38, 38); }
    doc.text((fr.cum >= 0 ? '+' : '') + pdfFmt(fr.cum), cols[5]+1, y+3);
    y += 5.5;
  }
  y += 1;
  doc.setFillColor(...OR);
  doc.rect(ML, y, CW, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...WH);
  doc.text('TOTAL', cols[0]+1, y+4);
  doc.text((cumPdf2 >= 0 ? '+' : '') + pdfFmt(cumPdf2), cols[4]+1, y+4);
  doc.text((cumPdf2 >= 0 ? '+' : '') + pdfFmt(cumPdf2), cols[5]+1, y+4);

  // Footer
  y = H - 20;
  doc.setFillColor(...BK);
  doc.rect(0, y, W, 20, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...GM);
  doc.text('Groupe G2O Participation \u2014 mhfreehome, promotion immobiliere', ML, y + 6);
  doc.text('7 rue A.M. Ampere, 57070 Metz \u2014 06 30 10 51 78 \u2014 contact@mhfreehome.com', ML, y + 10);
  doc.text('Simulation indicative non contractuelle. Rendements passes ne prejugent pas des rendements futurs.', ML, y + 14);
  doc.setTextColor(...OR);
  doc.text('mhfreehome.com/programme/dynamik-park', W - MR, y + 6, { align: 'right' });

  const preset = document.querySelector('.preset-card.active .pc-name');
  const presetName = preset ? preset.textContent.replace(/[^a-zA-Z0-9]/g, '_') : 'custom';
  doc.save('DNK_Etude_' + presetName + '_' + pdfFmt(surface) + 'm2.pdf');
}

/* ═══ INIT ═══ */
document.addEventListener('DOMContentLoaded', function() {
  calc();
});
