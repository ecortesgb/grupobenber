/* ====================================================================== INGRESOS Y BAJAS ====================================================================== */
const MVX = { ver: 'region', dia: null };
const DIMV = [['region', 'Región'], ['gerente', 'Gerente / Líder'], ['supervisor', 'Supervisor'], ['zona_rrhh', 'Gerencia RR.HH.'], ['rrhh', 'RR.HH.'], ['cadena', 'Cadena'], ['estado', 'Estado']];
const enR = (arr, d, h) => arr.filter(x => x.f >= d && x.f <= h && okI(x.idpdv));
async function vMovs() {
  await conReporte('Ingresos y bajas', 'saltando', async () => {
    await cargarMovs();
    const r = perRango(), dias = r.dias.length, ing = enR(MV.ing, r.desde, r.hasta), baj = enR(MV.baj, r.desde, r.hasta), hc = hcPromX(r, () => true);
    const pd = addD(r.desde, -dias), ph = addD(r.desde, -1), ingP = enR(MV.ing, pd, ph).length, bajP = enR(MV.baj, pd, ph).length;
    const semanas = []; if (dias <= 10) { r.dias.forEach(d => semanas.push({ l: d.slice(8) + '/' + d.slice(5, 7), d, h: d })); } else { const W = ventana(); W.forEach(w => { const s = rangoSemanaDe(W.indexOf(w)); if (s.hasta >= r.desde && s.desde <= r.hasta) semanas.push({ l: w.w.slice(3), d: s.desde < r.desde ? r.desde : s.desde, h: s.hasta > r.hasta ? r.hasta : s.hasta }); }); }
    const si = semanas.map(s => enR(MV.ing, s.d, s.h).length), sb_ = semanas.map(s => enR(MV.baj, s.d, s.h).length);
    let h = cab('Ingresos y bajas', 'Ingresos (candidatos que ingresaron) y bajas registradas, con rotación, comparativos por semana y por cadena. Sirve de base para los cierres diarios y semanales.', 'saltando') + barraFiltros('vMovs') + barraPeriodo('vMovs', { dia: true });
    h += `<div class="kpis kp-hero">${kp('Ingresos', fmt(ing.length), `${dl(ing.length, ingP, 0).replace('pts', '')}`.replace('vs ant.', 'vs periodo anterior (' + ingP + ')'), C.gr, null, '🙌')}${kp('Bajas', fmt(baj.length), `${dl(baj.length, bajP, 0).replace('pts', '').replace('vs ant.', 'vs periodo anterior (' + bajP + ')')}`, C.rd, null, '📤')}${kp('Neto', (ing.length - baj.length >= 0 ? '+' : '') + (ing.length - baj.length), 'ingresos − bajas', ing.length - baj.length >= 0 ? C.gr : C.rd, null, '⚖️')}${kp('Rotación del periodo', hc ? f1(baj.length / hc * 100) + '%' : '—', `${baj.length} bajas ÷ ${fmt(hc)} HC promedio`, C.am, null, '🔄')}</div>`;
    // del historial laboral: reingresos y personas únicas (un usuario con GB vinculado a su original cuenta como una sola persona)
    const reing = enR(MV.reing || [], r.desde, r.hasta), personaDe = u => (MV.vinc && MV.vinc[u]) || u, pers = new Set(ing.filter(x => x.u).map(x => personaDe(x.u)));
    h += `<div class="kpis">${kp('Reingresos', fmt(reing.length), 'personas que ya habían trabajado y regresaron (historial laboral)', C.pu, null, '🔁')}${kp('Personas únicas que ingresaron', fmt(pers.size), `${fmt(ing.length)} ingresos de candidatos · ${fmt(ing.length - pers.size)} repetidos o sin usuario`, C.bl, null, '🧍')}${kp('Historial por revisar', fmt(MV.revisar || 0), 'periodos laborales con datos dudosos; se corrigen con los archivos históricos', C.am, null, '🧾')}</div>`;
    const rotS = semanas.map(s => { const hcS = hcPromX({ desde: s.d, hasta: s.h }, () => true); return hcS ? enR(MV.baj, s.d, s.h).length / hcS * 100 : null; });
    h += `<div class="grid g2"><div class="card"><h3>📊 Ingresos, bajas y rotación por ${dias <= 10 ? 'día' : 'semana'}</h3><p class="note">Barras: cantidad. Línea naranja: % de rotación (eje derecho) con su tendencia punteada.</p>${legend([['Ingresos', C.gr], ['Bajas', C.rd], ['Rotación %', C.od], ['Tendencia', C.dk]])}${chart(semanas.map(s => s.l), [{ n: 'Ingresos', c: C.gr, v: si }, { n: 'Bajas', c: C.rd, v: sb_ }], { bars: 1, vals: 1, h: 320, ticks: 16, band: 1, lines2: [{ n: 'Rotación %', c: C.od, v: rotS, trend: 1 }], y2: { pct: 1 } })}</div>
      <div class="card"><h3>🔄 Rotación ${dias <= 10 ? 'diaria' : 'semanal'} y tendencia</h3><p class="note">Bajas ÷ promotores con check (HC promedio). Si la línea punteada baja, la rotación va mejorando.</p>${chart(semanas.map(s => s.l), [{ n: 'Rotación %', c: C.od, v: rotS }], { pct: 1, h: 320, vals: 1, ticks: 16 })}</div></div>`;
    const cads = [...new Set(R.T.filter(x => okT(x.t)).map(x => x.t.cadena).filter(Boolean))];
    const cr = cads.map(c => { const i = ing.filter(x => (tienda(x.idpdv) || {}).cadena === c).length, b = baj.filter(x => (tienda(x.idpdv) || {}).cadena === c).length, hcC = hcPromX(r, t => t.cadena === c); return { c, i, b, rot: hcC ? b / hcC * 100 : null }; }).sort((a, b) => b.i + b.b - a.i - a.b);
    const mot = {}; baj.forEach(x => mot[x.mot] = (mot[x.mot] || 0) + 1); const PAL = [C.or, C.bl, C.rd, C.pu, C.te, C.am, C.gr, C.gy];
    const mi = Object.entries(mot).sort((a, b) => b[1] - a[1]); const top = mi.slice(0, 6).map(([n, v], i) => ({ n, v, c: PAL[i] })); const rest = mi.slice(6).reduce((a, b) => a + b[1], 0); if (rest) top.push({ n: 'Otros', v: rest, c: C.gy });
    h += `<div class="grid g2"><div class="card"><h3>🏬 Por cadena</h3>${cr.map(q => `<div class="cadena-row">${logoCad(q.c)}<div class="dual"><div class="d-i" style="width:${Math.max(3, q.i / Math.max(1, ...cr.map(z => z.i + z.b)) * 100)}%"><span>${q.i}</span></div><div class="d-b" style="width:${Math.max(3, q.b / Math.max(1, ...cr.map(z => z.i + z.b)) * 100)}%"><span>${q.b}</span></div></div><span class="muted" style="min-width:92px;text-align:right">rot. ${f1(q.rot)}%</span></div>`).join('')}<p class="tblnote">🟩 ingresos · 🟥 bajas</p></div>
      <div class="card"><h3>📤 Motivos de baja</h3>${donut(top, { sub: 'bajas', best: 1 })}</div></div>`;
    // tabla por vista de estructura
    h += sect('Ingresos y bajas por estructura', '🧾') + `<div class="tools" data-nocap><span>Ver por:</span><select onchange="MVX.ver=this.value;vMovs()">${DIMV.map(([k, n]) => `<option value="${k}" ${MVX.ver === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`;
    const keys = [...new Set(R.T.filter(x => okT(x.t)).map(x => x.t[MVX.ver]).filter(Boolean))];
    const rows = keys.map(k => { const i = ing.filter(x => (tienda(x.idpdv) || {})[MVX.ver] === k).length, b = baj.filter(x => (tienda(x.idpdv) || {})[MVX.ver] === k).length, hcK = hcPromX(r, t => t[MVX.ver] === k); return { n: k, i, b, net: i - b, hc: hcK, rot: hcK ? b / hcK * 100 : null }; }).filter(q => q.i || q.b);
    TB = {};
    h += tbl('t-mv', [{ h: DIMV.find(x => x[0] === MVX.ver)[1], t: 1, v: q => q.n, w: 240, r: q => `<b>${esc(q.n)}</b>` }, { h: '🙌 Ingresos', v: q => q.i, r: q => `<b class="cell-green">${q.i}</b>` }, { h: '📤 Bajas', v: q => q.b, r: q => `<b class="cell-red">${q.b}</b>` }, { h: '⚖️ Neto', v: q => q.net, r: q => `<span class="${q.net < 0 ? 'cell-red' : 'cell-green'}">${q.net > 0 ? '+' : ''}${q.net}</span>` }, { h: 'HC promedio', v: q => q.hc, r: q => fmt(q.hc) }, { h: '🔄 Rotación', v: q => q.rot, r: q => q.rot == null ? '—' : `<span class="bar-pct ${q.rot > 40 ? 'ko' : q.rot > 25 ? 'wa' : 'ok'}">${f1(q.rot)}%</span>` }],
      rows, { fix: 1, csv: 1, png: 1, file: 'ingresos_bajas_estructura', titulo: 'Ingresos y bajas por ' + DIMV.find(x => x[0] === MVX.ver)[1], sort: 1, dir: -1, maxh: '60vh' });
    // cierre: una sola tabla expandible (región > gerente > supervisor > tienda) con una columna por cadena, del periodo elegido arriba
    const met = MVX.met || 'i', METN = { i: '🙌 Ingresos', b: '📤 Bajas', n: '⚖️ Neto' };
    const items = [...(met === 'b' ? [] : ing).map(x => ({ idpdv: x.idpdv, tipo: 'i' })), ...(met === 'i' ? [] : baj).map(x => ({ idpdv: x.idpdv, tipo: 'b' }))];
    const cadX = [...CADS, ...new Set(items.map(x => (tienda(x.idpdv) || {}).cadena).filter(c => c && !CADS.includes(c)))];
    const cnt = (a, c, t) => a.filter(x => x.tipo === t && (!c || (tienda(x.idpdv) || {}).cadena === c)).length;
    const fm = c => a => met === 'n' ? cnt(a, c, 'i') - cnt(a, c, 'b') : cnt(a, c, met);
    const nf = v => (v > 0 ? '+' : '') + v;
    const colsX = [...cadX.map(c => ({ h: c, f: fm(c), cero: met === 'n', fmt: met === 'n' ? nf : null })), { h: 'Total general', f: fm(null), cero: true, fmt: met === 'n' ? nf : null }];
    const perT = PER.modo === 'semana' ? 'Semana ' + ventana()[PER.sem == null ? ventana().length - 1 : PER.sem].w + ' · ' : PER.modo === 'mes' ? mlabel(PER.mes || r.hasta.slice(0, 7)) + ' · ' : '';
    const perL = perT + (r.desde === r.hasta ? fdia(r.desde) : fdate(r.desde) + ' al ' + fdate(r.hasta));
    const tt = `${METN[met].replace(/^\S+ /, '')} · ${perL}`;
    h += sect('Cierre por región, gerente, supervisor y tienda', '📸') + `<p class="note">Sigue el periodo de arriba: semana → cierre semanal, mes → mensual, día → diario, o un rango.</p><div class="tools" data-nocap><div class="seg">${Object.entries(METN).map(([k, n]) => `<button class="${met === k ? 'on' : ''}" onclick="MVX.met='${k}';vMovs()">${n}</button>`).join('')}</div><span class="tb-btns"><button class="btn sm" onclick="capturaDescargar($('cierre-x'),'Cierre · ${tt}',subFiltros(),'cierre_${met}')">📸 Imagen</button><button class="btn sm" onclick="capturaCopiar($('cierre-x'),'Cierre · ${tt}',subFiltros())">📋 Copiar</button></span></div><div id="cierre-x" class="cap-pad"><div class="cierre-t">${esc(tt)}</div>${arbol(items, colsX, { titulo: 'REGIÓN / GERENTE / SUPERVISOR / TIENDA', abrir: 2 })}</div>`;
    $('content').innerHTML = h; drawAll();
  });
}
function semanaCierre(d) { const W = ventana(); let i = W.findIndex(w => addD(w.ini, 6) >= d && w.ini <= d); if (i < 0) i = W.length - 1; const s = rangoSemanaDe(i); return { w: W[i].w, ...s }; }
