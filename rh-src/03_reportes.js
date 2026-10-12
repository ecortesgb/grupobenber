/* ====================================================================== REPORTES: RESUMEN · PENALIZACIÓN · DETALLE DE CHECKS · HC ====================================================================== */
const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const EST_COB = ['Cubierta', 'Descubierta', 'Vacante'], COBC = [C.gr, C.am, C.rd];
const EST_PEN = ['Cubierto', 'Riesgo Penalización', 'Penalizado'];
const LOGO = { Coppel: 'logo_coppel_clean', Elektra: 'logo_elektra_clean', Suburbia: 'logo_suburbia_clean', Cimaco: 'logo_cimaco_clean' };
const logoCad = c => LOGO[c] ? `<img class="cadena-logo" src="${img(LOGO[c])}" alt="${esc(c)}">` : `<b style="min-width:70px;font-size:12px">${esc(c)}</b>`;

/* ----- carga ----- */
const R = { loaded: false, T: [], hc: [], uc: {}, bajasLive: new Map(), solo: true, rach: 'todas', est: '', estA: '', estC: '', cadenaPen: true };
Real.reporte = async function () {
  const [m, t, h, u, bj] = await Promise.all([sb.from('rep_meta').select('valor').eq('clave', 'ventana').maybeSingle(), todo(() => sb.from('rep_tienda').select('*')), todo(() => sb.from('rep_hc').select('*')), todo(() => sb.from('rep_ultimo_check').select('*')),
    todo(() => sb.from('bajas').select('usuario_fieldwy,fecha_baja').is('anulada_en', null).gte('fecha_baja', addD(HOY, -200)))]);
  if (!m.data) throw new Error('Todavía no hay reportes publicados. Corre publicar_reporte.py.');
  return { meta: m.data.valor, tiendas: t, hc: h, uc: u, bajas: bj };
};
const CHK_COLS = '*';
Real.checks = function (desde, hasta) { return todo(() => sb.from('rep_checks').select(CHK_COLS).gte('fecha', desde).lte('fecha', hasta).order('fecha').order('hora_in')); };
async function cargarReporte() {
  if (R.loaded) return;
  const d = await API.reporte();
  R.meta = d.meta; R.hc = d.hc; R.uc = Object.fromEntries(d.uc.map(x => [x.usuario, x])); R.bajasLive = new Map(d.bajas.map(b => [b.usuario_fieldwy, b.fecha_baja]));
  R.T = d.tiendas.map(r => ({ id: r.idpdv, t: tienda(r.idpdv) || { nombre: 'IDPDV ' + r.idpdv, cadena: '', estado: '', region: '', gerente: '', supervisor: '', rrhh: '', zona_rrhh: '', posiciones: 0 }, sem: r.semanas || [], chk: (r.chk && r.chk.s) || [], cd: (r.chk && r.chk.cd) || '', dias: r.dias || '', hc: r.hc_sem || [], pen: r.pen || [] }));
  R.loaded = true; if (typeof fbPintar === 'function') fbPintar();
}
const cargando = (t, m) => { $('content').innerHTML = cab(t, 'Cargando…', m); };
async function conReporte(titulo, mascota, fn) {
  try { cargando(titulo, mascota); await cargarReporte(); await fn(); } catch (e) { console.error(e); $('content').innerHTML = cab(titulo, '', mascota) + `<div class="card empty"><img src="${img('guino')}" alt="">${esc(e.message || e)}</div>`; }
}
const xsF = () => R.T.filter(x => okT(x.t));

/* ----- movimientos (ingresos reales por candidatos + bajas) para rotación ----- */
const MV = { loaded: false, ing: [], baj: [], reing: [], vinc: {}, revisar: 0 };
Real.movs = async function () {
  const desde = addD(HOY, -125);
  const [i, b] = await Promise.all([todo(() => sb.from('candidatos').select('id,fecha_programada,idpdv,reclutador_id,fuente_id,usuario_fieldwy').eq('estatus', 'Ingresó').gte('fecha_programada', desde)), todo(() => sb.from('bajas').select('usuario_fieldwy,fecha_baja,idpdv,motivo').is('anulada_en', null).gte('fecha_baja', desde))]);
  // del historial laboral (opcional: si falla, el reporte sigue igual): reingresos, usuarios vinculados como una misma persona y cuántos periodos están por revisar
  let reing = [], vinc = {}, revisar = 0;
  try { reing = (await todo(() => sb.from('v_eventos_laborales').select('fecha,idpdv,usuario_fieldwy,persona').eq('evento', 'Reingreso').gte('fecha', desde))).map(x => ({ f: x.fecha, idpdv: x.idpdv, u: x.usuario_fieldwy })); } catch (e) { }
  try { (await todo(() => sb.from('vinculos_usuario').select('usuario_a,usuario_b'))).forEach(x => { vinc[x.usuario_b] = x.usuario_a; }); } catch (e) { }
  try { const r = await sb.from('relaciones_laborales').select('id', { count: 'exact', head: true }).eq('calidad', 'revisar'); revisar = r.count || 0; } catch (e) { }
  return { ing: i.map(x => ({ f: x.fecha_programada, idpdv: x.idpdv, rec: x.reclutador_id, fu: x.fuente_id, u: x.usuario_fieldwy })), baj: b.map(x => ({ f: x.fecha_baja, idpdv: x.idpdv, mot: x.motivo, u: x.usuario_fieldwy })), reing, vinc, revisar };
};
async function cargarMovs(force) { if (MV.loaded && !force) return; const d = await API.movs(); MV.ing = d.ing; MV.baj = d.baj; MV.reing = d.reing || []; MV.vinc = d.vinc || {}; MV.revisar = d.revisar || 0; MV.loaded = true; }
function hcProm(r) { // promedio de promotores con check por semana dentro del periodo (estructura filtrada)
  const sa = R.meta.semanas_anio, xs = xsF(); let tot = [], n = 0;
  sa.forEach((s, i) => { const fin = addD(s.ini, 6); if (fin < r.desde || s.ini > r.hasta) return; tot.push(xs.reduce((a, x) => a + (x.hc[i] || 0), 0)); });
  return tot.length ? tot.reduce((a, b) => a + b, 0) / tot.length : 0;
}
function hcPromX(r, pred) {
  const sa = R.meta.semanas_anio, xs = R.T.filter(x => okT(x.t) && pred(x.t)), tot = [];
  sa.forEach((s, i) => { const fin = addD(s.ini, 6); if (fin < r.desde || s.ini > r.hasta) return; tot.push(xs.reduce((a, x) => a + (x.hc[i] || 0), 0)); });
  return tot.length ? tot.reduce((a, b) => a + b, 0) / tot.length : 0;
}
function rotPeriodo(r) {
  const ing = MV.ing.filter(x => x.f >= r.desde && x.f <= r.hasta && okI(x.idpdv)).length, baj = MV.baj.filter(x => x.f >= r.desde && x.f <= r.hasta && okI(x.idpdv)).length, hc = hcProm(r);
  return { ing, baj, hc, rot: hc ? baj / hc * 100 : null };
}

/* ----- medidas de cobertura (misma lógica de Avance GB / medidas DAX) ----- */
const posc = t => t.posiciones || 1;
const dimPdv = ts => ts.reduce((a, t) => a + (posc(t) === 1 ? 6 / 7 : 1), 0);
const dimProm = ts => ts.reduce((a, t) => a + posc(t) * 6 / 7, 0);
const cdv = (x, d) => { const k = diffD(d, R.meta.cd_desde); const ch = x.cd[k]; return ch == null ? 0 : parseInt(ch, 36); };
function medidas(xs, dias) {
  const ts = xs.filter(x => (x.t.posiciones || 0) > 0), T = ts.map(z => z.t), nD = Math.max(1, dias.length);
  let cubSum = 0, chk = 0; ts.forEach(x => dias.forEach(d => { const c = cdv(x, d); if (c > 0) cubSum++; chk += c; }));
  const dP = dimPdv(T), dM = dimProm(T), pP = cubSum / nD, pM = chk / nD, cuota = T.reduce((a, t) => a + 6 * posc(t), 0) * nD / 7;
  return { n: ts.length, posc: T.reduce((a, t) => a + posc(t), 0), dP, pP, pctP: dP ? Math.min(pP / dP * 100, 100) : null, difP: pP - dP, dM, pM, pctM: dM ? Math.min(pM / dM * 100, 100) : null, difM: pM - dM, chk, nD, cuota, pctC: cuota ? Math.min(chk / cuota * 100, 100) : null, exc: Math.max(0, chk - cuota) };
}
function medTienda(x, dias, last) {
  const ps = posc(x.t), nD = Math.max(1, dias.length); let dc = 0, chk = 0; dias.forEach(d => { const c = cdv(x, d); if (c > 0) dc++; chk += c; });
  const cuota = 6 * ps * nD / 7, dimC = ps === 1 ? 6 / 7 : 1, dimA = ps * 6 / 7, promC = dc / nD, promA = chk / nD;
  let ult = null; const fin = diffD(dias[dias.length - 1], R.meta.cd_desde); for (let k = Math.min(fin, x.cd.length - 1); k >= 0; k--) if (x.cd[k] !== '0') { ult = addD(R.meta.cd_desde, k); break; }
  return { ps, chk, cuota, pctCh: Math.min(chk / cuota * 100, 100), falt: Math.max(0, cuota - chk), adic: Math.max(0, chk - cuota), dimA, promA, pctA: Math.min(promA / dimA * 100, 100), difA: promA - dimA, dimC, promC, pctC: Math.min(promC / dimC * 100, 100), difC: promC - dimC, ult };
}
function estatusTienda(x, dias) {
  if (dias.length === 1) {   // un solo día: solo cubierta o descubierta (cualquier check válido o abierto cubre; un check con error no cubre)
    const ps = posc(x.t), c = cdv(x, dias[0]), cob = c > 0 ? 'Cubierta' : 'Descubierta';
    return { cob, asi: ps <= 1 ? cob : c > ps ? 'Posc Adic' : c >= ps ? 'Cubierta' : c > 0 ? 'Posc Desc' : 'Descubierta' };
  }
  const last2 = dias.slice(-2).reverse(), ps = posc(x.t), r = last2.length ? cdv(x, last2[0]) : 0, a = last2.length > 1 ? cdv(x, last2[1]) : null; let cob;
  if (a == null) cob = r > 0 ? 'Cubierta' : 'Descubierta'; else cob = r > 0 && a > 0 ? 'Cubierta' : r === 0 && a === 0 ? 'Vacante' : 'Descubierta';
  const A = a || 0; let asi;
  if (ps <= 1) asi = cob; else if (a == null) asi = r >= ps ? 'Cubierta' : r > 0 ? 'Posc Desc' : 'Descubierta';
  else if (r > ps && A > ps) asi = 'Posc Adic'; else if (r >= ps && A >= ps) asi = 'Cubierta'; else if (r === 0 && A === 0) asi = 'Vacante';
  else if (r < ps && r > 0 && A < ps && A > 0) asi = 'Posc Faltante'; else if ((r < ps && r > 0) || (A < ps && A > 0)) asi = 'Posc Desc'; else if (r === 0 || A === 0) asi = 'Descubierta'; else asi = 'Sin Definir';
  return { cob, asi };
}
const ASIC = { 'Cubierta': 'g', 'Posc Adic': 'g', 'Posc Desc': 'a', 'Descubierta': 'a', 'Posc Faltante': 'r', 'Vacante': 'r', 'Sin Definir': 'x' };
const ASIE = { 'Cubierta': '🟢', 'Posc Adic': '🔵', 'Posc Desc': '🟠', 'Descubierta': '🟠', 'Posc Faltante': '🔴', 'Vacante': '🔴', 'Sin Definir': '⚪' };
const colPct = p => p == null ? '' : p >= 90 ? 'ok' : p >= 75 ? 'wa' : 'ko';

/* riesgo de sobredimensionar: checks de la semana contra el tope pagado por Telefónica (6 fijos + 3 adicionales por posición). sem = [estatus, checks, cuota, tope, faltantes, no válidos, proyección, exceso, último] */
function sobredim(x, wi) {
  const sd = wi == null ? null : x.sem[wi]; if (!sd) return { tope: null, chk: null, proy: null, exc: 0, nivel: 0 };
  const tope = sd[3], chk = sd[1], proy = sd[6], exc = Math.max(0, proy - tope);
  return { tope, chk, proy, exc, nivel: chk > tope ? 2 : exc > 0.05 ? 1 : 0 };   // 2 = ya se pasó del tope, 1 = a este ritmo se pasa
}
/* ====================================================================== 1 · RESUMEN ====================================================================== */
async function vResumen() {
  await conReporte('Resumen', 'pulgares', async () => {
    await cargarMovs();
    const r = perRango(), dias = r.dias, xs = xsF(), cur = medidas(xs, dias), sems = semanasUlt4(r), S4 = sems.map(w => medidas(xs, w.dias)), prev = S4.length > 1 ? S4[S4.length - 2] : null;
    const rot = rotPeriodo(r);
    const wi = sems.length ? sems[sems.length - 1].i : null, sdm = new Map(xs.map(x => [x.id, sobredim(x, wi)])), nSobre = [...sdm.values()].filter(z => z.nivel > 0).length;
    let h = cab('Resumen', 'Cobertura de PDV, asistencia de promotores y checks contra cuota (misma lógica de Avance GB), más rotación del periodo. Todo responde a los filtros de estructura y al periodo elegido.', 'pulgares') + barraFiltros('vResumen') + barraPeriodo('vResumen');
    h += `<div class="kpis kp-hero">${kp('% Cobertura PDV', cur.pctP == null ? '—' : f1(cur.pctP) + '%', `${fmt1(cur.pP)} tiendas/día vs ${fmt1(cur.dP)} dimensionadas<br>${dl(cur.pctP, prev && prev.pctP)}`, colorPct(cur.pctP), null, '🏬')}
      ${kp('% Asistencia Promotor', cur.pctM == null ? '—' : f1(cur.pctM) + '%', `${fmt1(cur.pM)} promotores/día vs ${fmt1(cur.dM)} dimensionados<br>${dl(cur.pctM, prev && prev.pctM)}`, colorPct(cur.pctM), null, '🧍')}
      ${kp('% Checks vs cuota', cur.pctC == null ? '—' : f1(cur.pctC) + '%', `${fmt(cur.chk)} checks vs cuota ${fmt(cur.cuota)} (6 por posición por semana)<br>${dl(cur.pctC, prev && prev.pctC)}`, colorPct(cur.pctC), null, '✅')}
      ${kp('Rotación del periodo', rot.rot == null ? '—' : f1(rot.rot) + '%', `${rot.baj} bajas ÷ ${fmt(rot.hc)} HC promedio<br>${rot.ing} ingresos · neto ${rot.ing - rot.baj >= 0 ? '+' : ''}${rot.ing - rot.baj}`, C.am, null, '🔄')}</div>`;
    h += `<div class="grid g3">${embudo('🏬 Cobertura PDV', [{ n: "Total PDV's", v: cur.n, c: C.bl }, { n: 'Dimensionamiento', v: cur.dP, c: '#3D6FB6' }, { n: 'Cubiertos (prom. diario)', v: cur.pP, c: C.gr }, { n: 'Descubiertos', v: Math.max(0, -cur.difP), c: C.rd }])}
      ${embudo('🧍 Asistencia Promotor', [{ n: 'Posiciones autorizadas', v: cur.posc, c: C.bl }, { n: 'Dimensionamiento', v: cur.dM, c: '#3D6FB6' }, { n: 'Asistieron (prom. diario)', v: cur.pM, c: C.gr }, { n: 'Sin asistir', v: Math.max(0, -cur.difM), c: C.rd }])}
      ${embudo('✅ Checks vs cuota', [{ n: 'Cuota de checks (periodo)', v: cur.cuota, c: C.bl }, { n: 'Checks válidos', v: cur.chk, c: C.gr }, { n: 'Faltantes', v: Math.max(0, cur.cuota - cur.chk), c: C.rd }, { n: 'Adicionales', v: cur.exc, c: C.am }])}</div>`;
    h += await coberturaDonas(xs, dias);
    const cads = [...new Set(xs.map(x => x.t.cadena).filter(Boolean))];
    const cadRows = cads.map(c => { const m = medidas(xs.filter(y => y.t.cadena === c), dias); return { c, n: m.n, p: m.pctP, a: m.pctM }; }).filter(q => q.n).sort((a, b) => b.n - a.n);
    const st = xs.filter(x => (x.t.posiciones || 0) > 0).map(x => ({ x, s: estatusTienda(x, dias) })), ce = { Cubierta: 0, Descubierta: 0, Vacante: 0 }; st.forEach(z => ce[z.s.cob]++);
    h += `<div class="grid g2"><div class="card"><h3>🏪 Cobertura por cadena</h3><p class="note">% Cobertura PDV (barra) y % Asistencia Promotor.</p>${cadRows.map(q => `<div class="cadena-row">${logoCad(q.c)}<div class="cadena-track"><i style="width:${q.p || 0}%;background:${colorPct(q.p)}"></i></div><b class="cadena-val" style="color:${colorPct(q.p)}">${f1(q.p)}%</b><span class="muted" style="min-width:96px;text-align:right">asist. ${f1(q.a)}%</span></div>`).join('')}</div>
      <div class="card"><h3>🚦 Estatus de tiendas (${dias.length === 1 ? fdate(dias[0]) : 'últimos 2 días'})</h3><p class="note">${dias.length === 1 ? 'Un solo día: Cubierta si tuvo check (aunque esté abierto) · Descubierta si no tuvo o solo tuvo errores.' : 'Cubierta: check los 2 días · Descubierta: falta 1 día · Vacante: 2 días sin check.'}</p>${donut(['Cubierta', 'Descubierta', 'Vacante'].map((n, k) => ({ n, v: ce[n], c: COBC[k] })), { sub: 'tiendas' })}</div></div>`;
    const labs = sems.map(w => w.w.slice(3));
    const est4 = sems.map(w => { const e = { Cubierta: 0, Descubierta: 0, Vacante: 0 }; xs.filter(x => (x.t.posiciones || 0) > 0).forEach(x => e[estatusTienda(x, w.dias).cob]++); return e; });
    const rotS = sems.map(w => { const hcS = hcPromX({ desde: w.desde, hasta: w.hasta }, () => true); const b = MV.baj.filter(x => x.f >= w.desde && x.f <= w.hasta && okI(x.idpdv)).length; return hcS ? b / hcS * 100 : null; });
    h += `<div class="grid g2"><div class="card"><h3>📈 Tiendas cubiertas, descubiertas y vacantes · últimas 4 semanas</h3><p class="note">Estatus de cada tienda al cierre de la semana (últimos 2 días con datos). La línea es el % de tiendas cubiertas.</p>${legend([['Cubiertas', C.gr], ['Descubiertas', C.am], ['Vacantes', C.rd], ['% cubiertas', C.dk]])}${chart(labs, [{ n: 'Cubiertas', c: C.gr, v: est4.map(e => e.Cubierta) }, { n: 'Descubiertas', c: C.am, v: est4.map(e => e.Descubierta) }, { n: 'Vacantes', c: C.rd, v: est4.map(e => e.Vacante) }], { bars: 1, stack: 1, vals: 1, h: 320, band: 1, lines2: [{ n: '% cubiertas', c: C.dk, v: est4.map(e => pn(e.Cubierta, e.Cubierta + e.Descubierta + e.Vacante)) }], y2: { pct: 1 } })}</div>
      <div class="card"><h3>🔄 Ingresos, bajas y rotación · últimas 4 semanas</h3><p class="note">Rotación del periodo: <b>${rot.rot == null ? '—' : f1(rot.rot) + '%'}</b> (${rot.baj} bajas ÷ ${fmt(rot.hc)} HC promedio). Línea: rotación semanal con su tendencia.</p>${legend([['Ingresos', C.gr], ['Bajas', C.rd], ['Rotación %', C.od], ['Tendencia', C.dk]])}${chart(labs, [{ n: 'Ingresos', c: C.gr, v: sems.map(w => MV.ing.filter(x => x.f >= w.desde && x.f <= w.hasta && okI(x.idpdv)).length) }, { n: 'Bajas', c: C.rd, v: sems.map(w => MV.baj.filter(x => x.f >= w.desde && x.f <= w.hasta && okI(x.idpdv)).length) }], { bars: 1, vals: 1, h: 320, band: 1, lines2: [{ n: 'Rotación %', c: C.od, v: rotS, trend: 1 }], y2: { pct: 1 } })}</div></div>`;
    h += sect('Tiendas: medición de checks, asistencia y cobertura', '🧾') + `<p class="note">Periodo ${fdate(r.desde)} – ${fdate(r.hasta)}. Mueve la tabla a los lados o hacia abajo: encabezados e IDPDV/tienda se quedan fijos.</p>`;
    h += `<div class="tools" data-nocap><span>Estatus cobertura:</span><select onchange="R.estC=this.value;vResumen()"><option value="">Todos</option>${['Cubierta', 'Descubierta', 'Vacante'].map(e => `<option ${R.estC === e ? 'selected' : ''}>${e} (${ce[e]})</option>`).join('')}</select><span>Estatus asistencia:</span><select onchange="R.estA=this.value;vResumen()"><option value="">Todos</option>${['Cubierta', 'Posc Adic', 'Posc Desc', 'Descubierta', 'Posc Faltante', 'Vacante'].map(e => `<option ${R.estA === e ? 'selected' : ''}>${e}</option>`).join('')}</select><span>Dimensionamiento:</span><select onchange="R.dimz=this.value;vResumen()"><option value="">Todas</option><option value="1" ${R.dimz ? 'selected' : ''}>⚖️ Riesgo de sobredimensionar (${nSobre})</option></select></div>`;
    const rows = st.filter(z => (!R.estC || R.estC.startsWith(z.s.cob + ' (') || R.estC === z.s.cob) && (!R.estA || R.estA === z.s.asi) && (!R.dimz || sdm.get(z.x.id).nivel > 0)).map(({ x, s }) => ({ ...x, s, m: medTienda(x, dias), pe: penActual(x), sb: sdm.get(x.id) }));
    TB = {};
    const cs = [{ h: 'IDPDV', v: q => q.id, w: 86 }, { h: 'Nombre PDV', t: 1, v: q => q.t.nombre, w: 230, r: q => `<b>${esc(q.t.nombre)}</b>` },
      { h: 'Cadena', t: 1, v: q => q.t.cadena, r: q => `${esc(q.t.cadena)}` }, { h: 'Estado', t: 1, v: q => q.t.estado }, { h: 'Supervisor', t: 1, v: q => q.t.supervisor }, { h: 'Gerente / Líder', t: 1, v: q => q.t.gerente }, { h: 'Posc.', v: q => q.m.ps },
      { h: 'Checks válidos', v: q => q.m.chk, hc: 'hy' }, { h: 'Cuota checks', v: q => q.m.cuota, r: q => fmt1(q.m.cuota), hc: 'hy' }, { h: '% Cobertura checks', v: q => q.m.pctCh, r: q => `<span class="bar-pct ${colPct(q.m.pctCh)}">${f1(q.m.pctCh)}%</span>`, hc: 'hy' }, { h: 'Checks faltantes', v: q => q.m.falt, r: q => q.m.falt ? `<span class="cell-red">${fmt1(q.m.falt)}</span>` : '0', hc: 'hy' }, { h: 'Checks adicionales', v: q => q.m.adic, r: q => q.m.adic ? `<span class="cell-green">+${fmt1(q.m.adic)}</span>` : '0', hc: 'hy' },
      { h: 'Dimens. promotor', v: q => q.m.dimA, r: q => f1(q.m.dimA), hc: 'hg' }, { h: 'Prom. promotor/día', v: q => q.m.promA, r: q => f1(q.m.promA), hc: 'hg' }, { h: '% Asistencia', v: q => q.m.pctA, r: q => `<span class="bar-pct ${colPct(q.m.pctA)}">${f1(q.m.pctA)}%</span>`, hc: 'hg' }, { h: 'Dif. asistencia', v: q => q.m.difA, r: q => `<span class="${q.m.difA < -0.05 ? 'cell-red' : 'cell-green'}">${q.m.difA > 0 ? '+' : ''}${f1(q.m.difA)}</span>`, hc: 'hg' },
      { h: 'Dimens. PDV', v: q => q.m.dimC, r: q => f1(q.m.dimC), hc: 'hd' }, { h: 'Prom. cobertura/día', v: q => q.m.promC, r: q => f1(q.m.promC), hc: 'hd' }, { h: '% Cobertura real', v: q => q.m.pctC, r: q => `<span class="bar-pct ${colPct(q.m.pctC)}">${f1(q.m.pctC)}%</span>`, hc: 'hd' }, { h: 'Dif. cobertura', v: q => q.m.difC, r: q => `<span class="${q.m.difC < -0.05 ? 'cell-red' : 'cell-green'}">${q.m.difC > 0 ? '+' : ''}${f1(q.m.difC)}</span>`, hc: 'hd' },
      { h: 'Tope checks semana', v: q => q.sb.tope, hc: 'hy' }, { h: 'Checks semana', v: q => q.sb.chk, hc: 'hy' }, { h: 'Proyección semana', v: q => q.sb.proy, r: q => q.sb.proy == null ? '—' : f1(q.sb.proy), hc: 'hy' }, { h: 'Exceso proyectado', v: q => q.sb.exc, r: q => q.sb.exc > 0.05 ? `<span class="cell-red">+${f1(q.sb.exc)}</span>` : '0', hc: 'hy' },
      { h: 'Riesgo sobredimensionar', t: 1, v: q => q.sb.nivel, r: q => q.sb.nivel === 2 ? pillx('🔴 Ya rebasó el tope', 'r') : q.sb.nivel === 1 ? pillx('🟠 En riesgo', 'a') : pillx('🟢 Sin riesgo', 'g'), hc: 'hy' },
      { h: 'Último check', v: q => q.m.ult, r: q => q.m.ult ? `${fdate(q.m.ult)}${diffD(r.hasta, q.m.ult) >= 2 ? ' <span title="2 o más días sin check">⚠️</span>' : ''}` : '—', hc: 'ho' },
      { h: 'Estatus cobertura', t: 1, v: q => q.s.cob, r: q => pillx((q.s.cob === 'Cubierta' ? '🟢 ' : q.s.cob === 'Vacante' ? '🔴 ' : '🟠 ') + q.s.cob, q.s.cob === 'Cubierta' ? 'g' : q.s.cob === 'Vacante' ? 'r' : 'a'), hc: 'hp' },
      { h: 'Estatus asistencia', t: 1, v: q => q.s.asi, r: q => pillx((ASIE[q.s.asi] || '') + ' ' + q.s.asi, ASIC[q.s.asi] || 'x'), hc: 'hp' }, { h: 'Región', t: 1, v: q => q.t.region }, { h: 'Gerencia RR.HH.', t: 1, v: q => q.t.zona_rrhh }, { h: 'RR.HH.', t: 1, v: q => q.t.rrhh }];
    const grp = [{ t: '🏪 Tienda', span: 2, cls: 'gt' }, { t: 'Estructura', span: 5, cls: 'gt' }, { t: '✅ Medición de checks', span: 5, cls: 'gy' }, { t: '🧍 Medición de asistencia promotoría', span: 4, cls: 'gg' }, { t: '🏬 Medición de cobertura', span: 4, cls: 'gd' }, { t: '⚖️ Tope pagado por Telefónica', span: 5, cls: 'gy' }, { t: '📅 Último día check', span: 1, cls: 'go' }, { t: '🚦 Estatus', span: 2, cls: 'gp' }, { t: 'Estructura', span: 3, cls: 'gt' }];
    h += tbl('t-tiendas', cs, rows, { fix: 2, groups: grp, search: 1, csv: 1, png: 1, file: 'resumen_tiendas', titulo: 'Resumen de tiendas · cobertura, asistencia y checks', sort: 18, dir: 1, maxh: '72vh', lim: 600 });
    $('content').innerHTML = h; drawAll();
  });
}
const colorPct = p => p == null ? C.gy : p >= 90 ? C.gr : p >= 75 ? C.am : C.rd;

/* ====================================================================== 2 · PENALIZACIÓN ====================================================================== */
const penActual = x => (x.pen || []).find(p => p.act) || (x.pen || []).slice(-1)[0] || null;
/* Racha = días seguidos sin cobertura DENTRO del mes. Hoy todavía se puede salvar: el día en juego (hoy) no cuenta como perdido hasta que pasa.
   Día 3 / 4 / 5 = el día de la racha en el que estamos hoy (racha confirmada hasta ayer + hoy). Penalizada = 5 o más días ya perdidos (sin contar hoy). */
const HOYE = { 'C': '✅ Check cumple', 'A': '🔵 Check abierto', 'E': '🟠 Check con error', '0': '🔴 Sin check' };
const periodoIni = (ini, fin) => `${fdate(ini)} al ${fdate(fin)}`;
function rachasConfirmadas(p, act) { // rachas del mes con sus días ya perdidos (sin contar hoy)
  return (p.rs || []).map(q => { const enCurso = act && q[2] >= HOY; const conf = q[0] - (enCurso ? 1 : 0); return { dias: conf, ini: q[1], fin: enCurso ? addD(HOY, -1) : q[2], enCurso }; }).filter(q => q.dias >= 1);
}
async function vPenal() {
  await conReporte('Penalización', 'puno', async () => {
    const meses = meses3(); if (!R.mes || !meses.includes(R.mes)) R.mes = meses[meses.length - 1];
    const act = R.mes === HOY.slice(0, 7), sel = R.T.filter(x => okT(x.t) && (!R.solo || x.t.cadena === 'Coppel'));
    const dePen = sel.map(x => ({ ...x, p: (x.pen || []).find(p => p.m === R.mes) })).filter(x => x.p);
    const enJuego = act ? dePen.filter(x => x.p.act && x.p.hoy !== 'C') : [];
    const c5 = enJuego.filter(x => x.p.ra === 4), c4 = enJuego.filter(x => x.p.ra === 3), c3 = enJuego.filter(x => x.p.ra === 2);
    const todasR = []; dePen.forEach(x => rachasConfirmadas(x.p, act).forEach(q => todasR.push({ ...x, ...q })));
    const rach3 = todasR.filter(q => q.dias >= 3).sort((a, b) => b.dias - a.dias), pen = [...todasR.filter(q => q.dias >= 5).sort((a, b) => a.ini.localeCompare(b.ini)).reduce((m, q) => m.has(q.id) ? m : m.set(q.id, q), new Map()).values()].sort((a, b) => b.dias - a.dias);   // una sola fila por tienda: su primera racha penalizada
    const penT = new Set(pen.map(q => q.id)).size;
    let h = cab('Penalización por falta de cobertura', 'Una tienda se penaliza con 5 días seguidos sin cobertura dentro del mes. Cuenta como cobertura un check dentro de rango con 420 minutos en tienda (300 los domingos con horario diferenciado); el check de un supervisor también rompe la racha. El día 5 todavía se puede salvar si hoy se cubre.', 'puno') + barraFiltros('vPenal');
    h += `<div class="tools"><span>Mes:</span><select onchange="R.mes=this.value;vPenal()">${meses.map(m => `<option value="${m}" ${m === R.mes ? 'selected' : ''}>${mlabel(m)}${m === HOY.slice(0, 7) ? ' (en curso)' : ''}</option>`).join('')}</select><button class="chip ${R.solo ? 'on' : ''}" onclick="R.solo=!R.solo;vPenal()">⭐ Solo Coppel (prioridad)</button><span class="muted">${fmt(dePen.length)} tiendas en el mes</span></div>`;
    h += `<div class="kpis">${act ? kp('Día 5 · último día', fmt(c5.length), 'si hoy no se cubre, se penaliza', c5.length ? C.rd : C.gr, null, '🔴') + kp('Día 4', fmt(c4.length), 'enviar a cubrir hoy', c4.length ? C.am : C.gr, null, '🟡') + kp('Día 3', fmt(c3.length), 'programar cobertura', C.gr, null, '🟢') : ''}${kp('Penalizadas ' + mlabel(R.mes), fmt(penT), 'tiendas con 5 o más días seguidos sin cobertura', penT ? C.rd : C.gr, null, '🚫')}${kp('Rachas de 3+ días', fmt(rach3.length), 'en el mes', C.am, null, '📜')}</div>`;
    h += `<div class="tools" data-nocap><button class="btn sm" onclick="capturaDescargar($('alertas-wrap'),'Alertas de cobertura · ${fdate(HOY)}',subFiltros(),'alertas_cobertura')">📸 Imagen de todas las alertas</button><button class="btn sm" onclick="capturaCopiar($('alertas-wrap'),'Alertas de cobertura · ${fdate(HOY)}',subFiltros())">📋 Copiar imagen</button><span class="muted">Cada día RH comparte esta imagen. Abre una tarjeta para ver sus tiendas; 📸 captura solo esa tarjeta.</span></div>`;
    h += `<div id="alertas-wrap" class="alertas2">`;
    if (act) h += tarjetaPen({ k: 'r', ic: '🔴', t: 'Día 5 · último día para salvar', sub: 'Hoy es el 5.º día sin cobertura: si no se cubre hoy, queda penalizada', rows: c5.map(x => ({ ...x, per: periodoIni(addD(HOY, -4), addD(HOY, -1)) })), racha: false, abrir: true }) +
      tarjetaPen({ k: 'a', ic: '🟡', t: 'Día 4', sub: 'Hoy es el 4.º día sin cobertura · enviar a cubrir hoy', rows: c4.map(x => ({ ...x, per: periodoIni(addD(HOY, -3), addD(HOY, -1)) })), racha: false }) +
      tarjetaPen({ k: 'g', ic: '🟢', t: 'Día 3', sub: 'Hoy es el 3.er día sin cobertura · todavía hay margen', rows: c3.map(x => ({ ...x, per: periodoIni(addD(HOY, -2), addD(HOY, -1)) })), racha: false });
    h += tarjetaPen({ k: 'neutro', ic: '📜', t: 'Mayores rachas del mes', sub: 'Rachas de 3 o más días consecutivos en el mes (cerradas o en curso)', rows: rach3.map(q => ({ ...q, per: periodoIni(q.ini, q.fin) + (q.enCurso ? ' · en curso' : '') })), racha: true }) +
      tarjetaPen({ k: 'r', ic: '🚫', t: 'Penalizadas', sub: 'Una fila por tienda, con su primera racha de 5 o más días sin cobertura', rows: pen.map(q => ({ ...q, per: periodoIni(q.ini, q.fin) + (q.enCurso ? ' · en curso' : '') })), racha: true }) + '</div>';
    $('content').innerHTML = h; drawAll();
  });
}
function tarjetaPen(o) {
  const lista = o.rows.slice().sort((a, b) => (b.t.cadena === 'Coppel') - (a.t.cadena === 'Coppel') || (b.dias || 0) - (a.dias || 0));
  const titulo = o.t.replace(/'/g, '');
  const body = lista.length ? `<div class="tw tw-in"><table class="dt st"><thead><tr><th class="fx" style="left:0;min-width:92px">IDPDV</th><th class="fx t" style="left:92px;min-width:250px">Tienda</th>${o.racha ? '<th>Racha</th>' : ''}<th class="t">Periodo sin checks</th>${o.racha ? '' : '<th class="t">Hoy</th>'}<th class="t">Región</th><th class="t">Gerente</th><th class="t">Supervisor</th></tr></thead><tbody>${lista.map(x => `<tr><td class="fx" style="left:0;min-width:92px"><b>${x.id}</b></td><td class="fx t" style="left:92px;min-width:250px;max-width:250px"><div class="cut" style="max-width:226px" title="${esc(x.t.nombre)}"><b>${esc(x.t.nombre)}</b></div><small class="muted">${esc(x.t.cadena)} · ${esc(x.t.estado)}</small></td>${o.racha ? `<td><span class="dchip ${x.dias >= 5 ? 'r' : x.dias >= 4 ? 'a' : 'g'}">${x.dias} d</span></td>` : ''}<td class="t">${x.per}</td>${o.racha ? '' : `<td class="t">${HOYE[x.p.hoy] || '—'}</td>`}<td class="t">${esc(x.t.region)}</td><td class="t">${esc(x.t.gerente)}</td><td class="t">${esc(x.t.supervisor)}</td></tr>`).join('')}</tbody></table></div>` : `<div class="empty-in">Sin tiendas en esta categoría 🎉</div>`;
  return `<details class="alc ${o.k}" ${o.abrir && lista.length ? 'open' : ''}><summary><span class="alc-n">${lista.length}</span><div><b>${o.ic} ${esc(o.t)}</b><small>${esc(o.sub)}</small></div><button class="btn sm cam" data-nocap onclick="event.preventDefault();event.stopPropagation();capturaDescargar(this.closest('details'),'${o.ic} ${titulo} · ${fdate(HOY)}',subFiltros(),'alerta_${o.k}')">📸</button><i>▾</i></summary><div class="alc-body">${body}</div></details>`;
}

/* ====================================================================== 3 · DETALLE DE CHECKS ====================================================================== */
const CKS = { cache: {}, vista: null, just: '', est: '', fin: '', jus: '', tab: 'checks', dia: '' };
const ERRN = { 'Cumple': 'Cumple', 'Check In Fuera Ventana': 'Entrada fuera de horario', 'Check Out Fuera Ventana': 'Salida fuera de horario', 'Error Comida': 'Error de comida', 'Tiempo Incompleto': 'Tiempo incompleto', 'Check In Fuera Rango': 'Entrada fuera de rango', 'Check Out Fuera Rango': 'Salida fuera de rango', 'No Check Salida': 'Sin check de salida', 'Equipo Duplicado': 'Equipo duplicado', 'Abierto': 'Abierto (hoy)' };
const ERRI = { 'Cumple': '✅', 'Check In Fuera Ventana': '🕘', 'Check Out Fuera Ventana': '🕕', 'Error Comida': '🍽️', 'Tiempo Incompleto': '⏱️', 'Check In Fuera Rango': '📍', 'Check Out Fuera Rango': '📍', 'No Check Salida': '🚪', 'Equipo Duplicado': '📱', 'Abierto': '🟦' };
const OKF = ['Cumple', 'Cumple Productividad', 'Cumple Telefonica'];
const VALC = { 'Cumple': 'g', 'Cumple Productividad': 'b', 'Cumple Telefonica': 'b', 'No Cumple': 'r' };
const NOJUST = ['Check In Fuera Rango', 'Check Out Fuera Rango', 'Equipo Duplicado', 'No Check Salida'];   // la venta no los justifica (regla del modelo): hay que enviarlos a otra tienda o corregir
async function checksRango(d, h) { // se piden por semana (con reintentos) y se guardan en memoria
  const W = ventana(), blocks = W.filter(w => addD(w.ini, 6) >= d && w.ini <= h), out = [];
  await Promise.all(blocks.filter(w => !CKS.cache[w.ini]).map(async w => { CKS.cache[w.ini] = await API.checks(w.ini, addD(w.ini, 6)); }));   // las semanas que faltan se piden juntas
  blocks.forEach(w => out.push(...CKS.cache[w.ini]));
  return out.filter(r => r.fecha >= d && r.fecha <= h);
}
const esErr = r => r.estatus_check !== 'Cumple' && r.estatus_check !== 'Abierto' && r.estatus_final !== 'Otro Check';
const justif = r => r.estatus_final === 'Cumple Productividad' || r.estatus_final === 'Cumple Telefonica';
function justTxt(r) { if (r.estatus_check === 'Cumple' || r.estatus_check === 'Abierto' || NOJUST.includes(r.estatus_check)) return 'No aplica'; return justif(r) ? 'Con venta' : 'Sin venta'; }
const JUSTP = { 'No aplica': ['x', '➖ No aplica'], 'Con venta': ['b', '💸 Con venta'], 'Sin venta': ['r', '🔴 Sin venta'] };
async function vChecks() {
  await conReporte('Detalle de checks', 'sim', async () => {
    const r = perRango(); $('content').innerHTML = cab('Detalle de checks', 'Cargando checks… (los periodos largos tardan unos segundos)', 'sim');
    const vistaSem = CKS.vista ? CKS.vista === 'sem' : r.dias.length > 14, ws4 = semanasUlt4(r), desdeCarga = vistaSem && ws4.length ? (ws4[0].desde < r.desde ? ws4[0].desde : r.desde) : r.desde;
    const todos = (await checksRango(desdeCarga, r.hasta)).filter(x => okI(x.idpdv)), rows = todos.filter(x => x.fecha >= r.desde && x.fecha <= r.hasta);
    const prim = rows.filter(x => x.estatus_final !== 'Otro Check'), ok = prim.filter(x => OKF.includes(x.estatus_final));
    const prom = new Set(prim.map(x => x.usuario)).size, prod = prim.filter(x => x.estatus_final === 'Cumple Productividad').length, vtas = prim.reduce((a, x) => a + x.registros, 0);
    const errores = prim.filter(esErr), sinVta = errores.filter(x => justTxt(x) === 'Sin venta').length, conJ = errores.filter(x => justTxt(x) === 'Con venta').length, noAp = errores.filter(x => justTxt(x) === 'No aplica').length;
    const mix = {}; prim.forEach(x => mix[x.estatus_check] = (mix[x.estatus_check] || 0) + 1);
    let h = cab('Detalle de checks', 'Cada check de cada promotor con horarios, tiempos, rangos y resultado, y la venta registrada del día para confirmar la justificación por productividad.', 'sim') + barraFiltros('vChecks') + barraPeriodo('vChecks', { dia: true });
    h += `<div class="tools" data-nocap>${[['checks', '🧾 Checks'], ['errores', '🛠️ Errores de check']].map(([k, n]) => `<button class="chip ${CKS.tab === k ? 'on' : ''}" onclick="CKS.tab='${k}';vChecks()">${n}</button>`).join('')}</div>`;
    if (CKS.tab === 'errores') { if (can('justificaciones', 'ver')) await cargarJustSolicitadas(); $('content').innerHTML = h + erroresCheckHTML(r, rows, prim, errores); drawAll(); return; }
    h += `<div class="kpis">${kp('Checks evaluados', fmt(prim.length), 'todos los del periodo, incluidos abiertos', null, null, '🧾')}${kp('Promotores con check', fmt(prom), fdate(r.desde) + ' – ' + fdate(r.hasta), null, null, '🧍')}${kp('Cumplen (regla de pago)', pc1(ok.length, prim.length), fmt(ok.length) + ' checks', colorPct(pn(ok.length, prim.length)), null, '✅')}${kp('Con error', fmt(errores.length), `${fmt(conJ)} con venta · ${fmt(sinVta)} sin venta · ${fmt(noAp)} no justificables`, errores.length ? C.rd : C.gr, null, '⚠️')}${kp('Cumple por productividad', pc1(prod, prim.length), fmt(prod) + ' checks', C.pu, null, '💸')}${kp('Ventas registradas', fmt(vtas), 'en días con check', null, null, '🛒')}</div>`;
    // gráfica: promotores que checaron bien / mal
    const cuenta = x => ({ b: new Set(x.filter(y => OKF.includes(y.estatus_final)).map(y => y.usuario)).size, m: new Set(x.filter(y => !OKF.includes(y.estatus_final)).map(y => y.usuario)).size, n: x.length, c: x.filter(y => OKF.includes(y.estatus_final)).length });
    const base = x => x.estatus_final !== 'Otro Check';
    let labs, g, tit;
    if (vistaSem) { labs = ws4.map(w => w.w.slice(3)); g = ws4.map(w => cuenta(todos.filter(y => y.fecha >= w.desde && y.fecha <= w.hasta && base(y)))); tit = 'Vista semanal · comparativo de las últimas 4 semanas'; }
    else { labs = r.dias.map(d => d.slice(8) + '/' + d.slice(5, 7)); g = r.dias.map(d => cuenta(prim.filter(y => y.fecha === d))); tit = 'Vista diaria'; }
    h += `<div class="grid g2"><div class="card"><div class="card-h"><h3>👥 Promotores que checaron bien y mal</h3><span class="seg sm" data-nocap><button class="${!vistaSem ? 'on' : ''}" onclick="CKS.vista='dia';vChecks()">Diaria</button><button class="${vistaSem ? 'on' : ''}" onclick="CKS.vista='sem';vChecks()">Semanal</button></span></div><p class="note">${tit}. Cantidad de promotores por resultado; la línea es el % de checks que cumplen, con su tendencia.</p>${legend([['Checaron bien', C.gr], ['Checaron mal', C.rd], ['% checks que cumplen', C.dk]])}${chart(labs, [{ n: 'Checaron bien', c: C.gr, v: g.map(q => q.b) }, { n: 'Checaron mal', c: C.rd, v: g.map(q => q.m) }], { bars: 1, stack: 1, vals: 1, h: 310, ticks: 16, lines2: [{ n: '% cumplen', c: C.dk, v: g.map(q => pn(q.c, q.n)), trend: 1 }], y2: { pct: 1, max: 100 } })}</div>
      <div class="card"><h3>🧩 Resultado del check</h3><p class="note">Antes de aplicar productividad o Telefónica.</p>${hbars(Object.entries(mix).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ n: (ERRI[k] || '') + ' ' + (ERRN[k] || k), v, c: k === 'Cumple' ? C.gr : NOJUST.includes(k) ? C.rd : C.am, s: pc1(v, prim.length) })), C.am)}</div></div>`;
    // detalle
    const sel = rows.slice().sort((a, b) => b.fecha.localeCompare(a.fecha) || (a.hora_in || '').localeCompare(b.hora_in || '')).filter(q => (!CKS.est || q.estatus_check === CKS.est) && (!CKS.fin || q.estatus_final === CKS.fin) && (!CKS.jus || justTxt(q) === CKS.jus));
    h += sect('Detalle de cada check', '🧾') + `<div class="tools" data-nocap><select onchange="CKS.est=this.value;vChecks()"><option value="">Todos los resultados</option>${Object.keys(ERRN).map(k => `<option value="${k}" ${CKS.est === k ? 'selected' : ''}>${ERRI[k]} ${ERRN[k]}</option>`).join('')}</select><select onchange="CKS.fin=this.value;vChecks()"><option value="">Todos los estatus finales</option>${['Cumple', 'Cumple Productividad', 'Cumple Telefonica', 'No Cumple', 'Otro Check'].map(k => `<option ${CKS.fin === k ? 'selected' : ''}>${k}</option>`).join('')}</select><select onchange="CKS.jus=this.value;vChecks()"><option value="">Toda justificación</option>${['Con venta', 'Sin venta', 'No aplica'].map(k => `<option ${CKS.jus === k ? 'selected' : ''}>${k}</option>`).join('')}</select></div>`;
    h += tbl('t-checks', [{ h: 'Fecha', v: q => q.fecha, r: q => fdate(q.fecha), w: 82 }, { h: 'Usuario', t: 1, v: q => q.usuario, w: 112 }, { h: 'Promotor', t: 1, v: q => q.nombre, w: 220, r: q => `<b>${esc(q.nombre)}</b>` }, { h: 'IDPDV', v: q => q.idpdv }, { h: 'Tienda', t: 1, v: q => (tienda(q.idpdv) || {}).nombre || '' },
      { h: 'Entrada', v: q => q.hora_in, r: q => hh(q.hora_in) }, { h: 'Comida', v: q => q.hora_com_in, r: q => hh(q.hora_com_in) + ' – ' + hh(q.hora_com_out) }, { h: 'Salida', v: q => q.hora_out, r: q => hh(q.hora_out) }, { h: 'En tienda (min)', v: q => q.tiempo_ub, r: q => `<span class="${q.tiempo_ub < 420 ? 'cell-amber' : ''}">${fmt(q.tiempo_ub)}</span>` }, { h: 'Comida (min)', v: q => q.tiempo_com, r: q => f1(q.tiempo_com) },
      { h: 'Rango entrada', t: 1, v: q => q.rango_in, r: q => /fuera/i.test(q.rango_in || '') ? `<span class="cell-red">📍 ${esc(q.rango_in)}</span>` : esc(q.rango_in || '—') }, { h: 'Rango salida', t: 1, v: q => q.rango_out, r: q => /fuera/i.test(q.rango_out || '') ? `<span class="cell-red">📍 ${esc(q.rango_out)}</span>` : esc(q.rango_out || '—') },
      { h: 'Resultado', t: 1, v: q => ERRN[q.estatus_check] || q.estatus_check, r: q => pillx((ERRI[q.estatus_check] || '') + ' ' + (ERRN[q.estatus_check] || q.estatus_check), q.estatus_check === 'Cumple' ? 'g' : q.estatus_check === 'Abierto' ? 'b' : NOJUST.includes(q.estatus_check) ? 'r' : 'a') }, { h: 'Estatus final', t: 1, v: q => q.estatus_final, r: q => pillx(q.estatus_final, VALC[q.estatus_final] || 'x') },
      { h: 'Ventas', v: q => q.registros, r: q => q.registros ? `<b>${q.registros}</b> <small class="muted">T${q.temm} P${q.porta} Pos${q.pospago} Pre${q.prepago}</small>` : '0' }, { h: 'Justifica', t: 1, v: q => justTxt(q), r: q => { const p = JUSTP[justTxt(q)]; return pillx(p[1], p[0]); } },
      { h: 'Supervisor', t: 1, v: q => (tienda(q.idpdv) || {}).supervisor }, { h: 'Gerente', t: 1, v: q => (tienda(q.idpdv) || {}).gerente }, { h: 'RR.HH.', t: 1, v: q => (tienda(q.idpdv) || {}).rrhh }], sel, { fix: 3, search: 1, csv: 1, png: 1, file: 'detalle_checks', titulo: 'Detalle de checks', sort: 0, dir: -1, maxh: '70vh', lim: 600 });
    $('content').innerHTML = h; drawAll();
  });
}
const hh = s => s ? s.slice(0, 5) : '—';

/* ====================================================================== 4 · HC ====================================================================== */
const ACTC = { 'Activo': 'g', 'Descanso / falta / error': 'a', 'Posible baja': 'r', 'Baja': 'x', 'Sin check': 'x' };
const ACTI = { 'Activo': '🟢', 'Descanso / falta / error': '🟠', 'Posible baja': '🔴', 'Baja': '⚫', 'Sin check': '⚪', 'Vacaciones': '🏖️', 'Incapacidad (IMSS)': '🏥', 'Permiso especial': '📝', 'Tema médico (particular)': '🩺', 'No localizado': '❓' };
const ANTB = [['< 2 sem', 0, 13, C.rd], ['2–4 sem', 14, 27, C.am], ['1–3 meses', 28, 89, C.ye], ['3–6 meses', 90, 179, C.te], ['6 m – 1 año', 180, 364, C.bl], ['1–2 años', 365, 729, C.pu], ['2–3 años', 730, 1094, C.gr], ['3+ años', 1095, 1e9, C.dk]];
const antLabel = d => d == null ? '—' : (ANTB.find(b => d >= b[1] && d <= b[2]) || [''])[0];
function tipoIngreso(h, ant) { if (h.tipo_ingreso === 'Reingreso') return 'Reingreso'; if (ant == null) return 'Normal'; if (ant <= 7) return 'Nuevo ingreso'; if (ant <= 14) return 'Adaptación'; return 'Normal'; }
const TIPC = { 'Nuevo ingreso': ['r', '🆕'], 'Reingreso': ['b', '🔁'], 'Adaptación': ['a', '🌱'], 'Normal': ['x', ''] };
function estadoVivo(h) {
  const baja = R.bajasLive.get(h.usuario); if (baja && (!h.fecha_alta || baja >= h.fecha_alta)) return { e: 'Baja', det: 'Baja ' + fdate(baja) };
  const au = S.vigentes.find(v => v.usuario === h.usuario); if (au) return { e: au.motivo, det: `${au.dias} d · regresa ${fdate(au.regreso)}`, aus: au };
  if (h.ausencia_motivo && h.ausencia_regreso && h.ausencia_regreso > HOY) return { e: h.ausencia_motivo, det: `${h.ausencia_dias} d · regresa ${fdate(h.ausencia_regreso)}`, aus: { motivo: h.ausencia_motivo, inicio: addD(h.ausencia_regreso, -h.ausencia_dias), regreso: h.ausencia_regreso } };
  const d = h.ultimo_check ? diffD(HOY, h.ultimo_check) : null;
  if (d == null) return { e: 'Sin check', det: '' }; if (d <= 0) return { e: 'Activo', det: '' }; if (d === 1) return { e: 'Descanso / falta / error', det: '1 día sin check' }; if (d > 21) return { e: 'Baja', det: d + ' días sin check · sin baja registrada' }; return { e: 'Posible baja', det: d + ' días sin check' };
}
const HCF = { est: '', tipo: '', ant: '', emp: '', cat: '', grupo: 'activos' };
const HC_GRUPOS = [['activos', '🟢 Activos contratados'], ['completos', '✅ Alta completa'], ['posible', '🔴 Posible baja'], ['alta', '🟠 En alta (datos)'], ['exp', '🔵 Expediente'], ['banc', '💳 Faltan datos bancarios'], ['baja', '⚫ Bajas'], ['reing', '🔁 Reingresos'], ['todos', 'Todos']];
async function vHC() {
  await conReporte('HC', 'mochila', async () => {
    if (!R.vivo) { try { S.vigentes = await API.vigentes(); } catch (e) { } R.vivo = true; }
    await cargarCatPromotores();
    const rp = perRango(), tpor = new Map();   // tiendas donde checó cada promotor en el periodo filtrado
    try { (await checksRango(rp.desde, rp.hasta)).filter(c => c.estatus_final !== 'Otro Check').forEach(c => { if (!tpor.has(c.usuario)) tpor.set(c.usuario, new Map()); const m = tpor.get(c.usuario); m.set(c.idpdv, (m.get(c.idpdv) || 0) + 1); }); } catch (e) { console.warn('tiendas por promotor:', e); }
    let fases = new Map(); try { fases = new Map((await API.altasFases()).map(f => [f.usuario, f])); } catch (e) { }
    const enHC = new Set(R.hc.map(h => h.usuario)), extra = [...fases.values()].filter(f => !enHC.has(f.usuario)).map(f => ({ usuario: f.usuario, nombre: f.nombre, fecha_alta: f.fecha_ingreso, ultimo_check: null, ultimo_idpdv: f.idpdv, rol: 'Promotor', empresa: f.empresa, tipo_ingreso: f.tipo_ingreso }));
    const rows = R.hc.concat(extra).filter(h => okI(h.ultimo_idpdv)).map(h => { const v = estadoVivo(h), u = R.uc[h.usuario] || {}, t = tienda(h.ultimo_idpdv), ant = h.fecha_alta ? diffD(HOY, h.fecha_alta) : null; return { ...h, v, u, t: t || {}, ant, tipo: tipoIngreso(h, ant), antL: antLabel(ant), alerta: S.alertas.find(a => a.usuario === h.usuario), tdas: tpor.get(h.usuario) || new Map(), cat: catActual(h.usuario), fs: fases.get(h.usuario) || null }; });
    const enGrupo = (q, g) => g === 'todos' ? true : g === 'baja' ? q.v.e === 'Baja' : g === 'activos' ? q.v.e !== 'Baja' : g === 'completos' ? !q.fs && q.v.e !== 'Baja' : g === 'posible' ? q.v.e === 'Posible baja' : g === 'alta' ? !!q.fs && (q.fs.fase === 'Datos personales' || q.fs.fase === 'Datos bancarios') : g === 'exp' ? !!q.fs && q.fs.fase === 'Expediente' : g === 'banc' ? !!q.fs && !q.fs.banc_ok : g === 'reing' ? q.tipo === 'Reingreso' : true;
    const vis = rows.filter(q => enGrupo(q, HCF.grupo)), cnt = {}; vis.forEach(q => cnt[q.v.e] = (cnt[q.v.e] || 0) + 1);
    const ausN = vis.filter(q => !['Activo', 'Descanso / falta / error', 'Posible baja', 'Baja', 'Sin check'].includes(q.v.e)), nuevos = vis.filter(q => q.tipo === 'Nuevo ingreso').length, adap = vis.filter(q => q.tipo === 'Adaptación').length;
    const ests = [...new Set(vis.map(q => q.v.e))].sort(), emps = [...new Set(vis.map(q => q.empresa).filter(Boolean))].sort();
    const tabla = vis.filter(q => (!HCF.est || q.v.e === HCF.est) && (!HCF.tipo || q.tipo === HCF.tipo) && (!HCF.ant || q.antL === HCF.ant) && (!HCF.emp || q.empresa === HCF.emp) && (!HCF.cat || (q.cat ? q.cat.categoria : 'Sin categoría') === HCF.cat));
    let h = cab('HC · plantilla de promotoría', 'Promotores y cubre-descansos con su último check y estatus. El estatus se actualiza en vivo con las ausencias y bajas que RH captura en Posibles bajas.', 'mochila') + barraFiltros('vHC');
    h += `<div class="tools" data-nocap>${HC_GRUPOS.map(([k, n]) => `<button class="chip ${HCF.grupo === k ? 'on' : ''}" onclick="HCF.grupo='${k}';vHC()">${n} (${rows.filter(q => enGrupo(q, k)).length})</button>`).join('')}</div><div class="tools"><span class="muted">${fmt(vis.length)} promotores · publicado ${esc(R.meta.generado)} · las columnas de tiendas usan el periodo de arriba</span></div>`;
    h += `<div class="kpis">${kp('Plantilla', fmt(vis.filter(q => q.v.e !== 'Baja').length), 'sin bajas', null, null, '👥')}${kp('Activos hoy', fmt(cnt['Activo'] || 0), pc1(cnt['Activo'] || 0, vis.length), C.gr, null, '🟢')}${kp('Descanso / falta', fmt(cnt['Descanso / falta / error'] || 0), 'último check ayer', C.am, null, '🟠')}${kp('Posible baja', fmt(cnt['Posible baja'] || 0), '2 o más días sin check', C.rd, "ir('bandeja')", '🔴')}${kp('Con ausencia', fmt(ausN.length), 'vacaciones, incapacidad…', C.bl, "ir('vigentes')", '🏖️')}${kp('Nuevo ingreso', fmt(nuevos), 'primera semana · arranque rápido', C.rd, null, '🆕')}${kp('Adaptación', fmt(adap), 'segunda semana (la adaptación dura 2 semanas)', C.am, null, '🌱')}</div>`;
    h += `<div class="grid g2"><div class="card"><h3>🚦 Estatus de la plantilla</h3>${donut(Object.entries(cnt).map(([k, v]) => ({ n: (ACTI[k] || '') + ' ' + k, v, c: k === 'Activo' ? C.gr : k === 'Posible baja' ? C.rd : k === 'Descanso / falta / error' ? C.am : k === 'Baja' ? C.gy : C.bl })), { sub: 'promotores' })}</div>
      <div class="card"><h3>⏳ Antigüedad</h3><p class="note">La adaptación dura 2 semanas: primera semana = nuevo ingreso (arranque rápido: visita del supervisor, básicos y capacitación práctica); segunda semana = adaptación.</p>${hbars(ANTB.map(b => ({ n: b[0], v: vis.filter(q => q.ant != null && q.ant >= b[1] && q.ant <= b[2]).length, c: b[3] })), C.pu)}</div></div>`;
    TB = {};
    h += sect('Promotores', '👥') + `<div class="tools" data-nocap><button class="btn sm" onclick="hcCsvPersonal()">⬇ CSV con datos personales</button><select onchange="HCF.est=this.value;vHC()"><option value="">Todos los estatus</option>${ests.map(e => `<option ${HCF.est === e ? 'selected' : ''}>${esc(e)}</option>`).join('')}</select><select onchange="HCF.tipo=this.value;vHC()"><option value="">Todo tipo de ingreso</option>${['Nuevo ingreso', 'Adaptación', 'Reingreso', 'Normal'].map(e => `<option ${HCF.tipo === e ? 'selected' : ''}>${e}</option>`).join('')}</select><select onchange="HCF.ant=this.value;vHC()"><option value="">Toda antigüedad</option>${ANTB.map(b => `<option ${HCF.ant === b[0] ? 'selected' : ''}>${b[0]}</option>`).join('')}</select><select onchange="HCF.cat=this.value;vHC()"><option value="">Toda categoría (Avance)</option>${[...CATS, 'Sin categoría'].map(e => `<option ${HCF.cat === e ? 'selected' : ''}>${e}</option>`).join('')}</select><select onchange="HCF.emp=this.value;vHC()"><option value="">Toda razón social</option>${emps.map(e => `<option ${HCF.emp === e ? 'selected' : ''}>${esc(e)}</option>`).join('')}</select></div>`;
    h += tbl('t-hc', [{ h: 'Usuario', t: 1, v: q => q.usuario, w: 120 }, { h: 'Nombre', t: 1, v: q => q.nombre, w: 230, r: q => `<b>${esc(q.nombre)}</b>` },
      { h: 'Estatus', t: 1, v: q => q.v.e, w: 250, r: q => { return `<div class="est-c"><div class="est-r">${pillx((ACTI[q.v.e] || '🔵') + ' ' + esc(q.v.e), ACTC[q.v.e] || 'b')}</div>${q.v.det ? `<small class="muted">${esc(q.v.det)}</small>` : ''}</div>`; } },
      { h: 'Categoría Avance GB', t: 1, w: 150, v: q => q.cat ? CATS.indexOf(q.cat.categoria) : 99, r: q => q.cat ? `${catPill(q.cat.categoria)}<br><small class="muted">${esc(q.cat.semana)} · ${catHist(q.usuario)}</small>` : '<span class="muted">Sin dato</span>' },
      { h: 'Fase del alta', t: 1, v: q => q.fs ? q.fs.fase : 'Completo', r: q => q.fs ? `${pillx(FASEC[q.fs.fase][1], FASEC[q.fs.fase][0])}${q.fs.banc_ok ? '' : '<br><small class="muted">sin datos bancarios</small>'}` : '<span class="muted">Completo</span>' }, { h: 'Tipo de ingreso', t: 1, v: q => q.tipo, r: q => pillx((TIPC[q.tipo][1] + ' ' + q.tipo).trim(), TIPC[q.tipo][0]) }, { h: 'Antigüedad', t: 1, v: q => q.ant, r: q => q.ant == null ? '—' : `<b>${esc(q.antL)}</b><br><small class="muted">${Math.floor(q.ant / 7)} sem · ${q.ant} d</small>` },
      { h: 'Fecha de ingreso', v: q => q.fecha_alta, r: q => fdate(q.fecha_alta) }, { h: 'Baja anterior', v: q => q.tipo_ingreso === 'Reingreso' ? q.baja_final : null, r: q => q.tipo_ingreso === 'Reingreso' ? fdate(q.baja_final) : '—' },
      { h: 'Último check', v: q => q.ultimo_check, r: q => fdate(q.ultimo_check) + (q.u.hora_in ? `<br><small class="muted">${hh(q.u.hora_in)} – ${hh(q.u.hora_out)}</small>` : '') }, { h: 'Tipo de check', t: 1, v: q => q.rol, r: q => esc(q.rol || '—') + (q.u.estatus_check ? `<br><small class="muted">${esc((ERRI[q.u.estatus_check] || '') + ' ' + (ERRN[q.u.estatus_check] || q.u.estatus_check))}</small>` : '') },
      { h: 'Tiendas en el periodo', v: q => q.tdas.size, r: q => q.tdas.size > 1 ? `<span class="cell-amber"><b>${q.tdas.size}</b> 🔀</span>` : String(q.tdas.size || 0) }, { h: 'Dónde checó (periodo)', t: 1, w: 320, v: q => [...q.tdas.keys()].map(i => (tienda(i) || {}).nombre || i).join(' · '), r: q => [...q.tdas].sort((a, b) => b[1] - a[1]).map(([i, n]) => `${esc((tienda(i) || {}).nombre || 'IDPDV ' + i)} <small class="muted">(${n})</small>`).join('<br>') || '—' },
      { h: 'Tienda (último check)', t: 1, v: q => q.t.nombre || '', r: q => esc(q.t.nombre || '—') }, { h: 'Cadena', t: 1, v: q => q.t.cadena }, { h: 'Estado', t: 1, v: q => q.t.estado }, { h: 'Región', t: 1, v: q => q.t.region }, { h: 'Gerente', t: 1, v: q => q.t.gerente }, { h: 'Supervisor', t: 1, v: q => q.t.supervisor }, { h: 'RR.HH.', t: 1, v: q => q.t.rrhh }, { h: 'Razón social', t: 1, v: q => q.empresa }],
      (HC_ACT = tabla), { fix: 3, search: 1, csv: 1, png: 1, file: 'hc_promotores', titulo: 'HC · promotores', sort: 2, dir: 1, maxh: '72vh', lim: 600 });
    $('content').innerHTML = h; drawAll();
  });
}
function resolverDesdeHC(id) { S.view = 'bandeja'; nav(); render(); setTimeout(() => abrir('aus', id), 80); }

/* CSV del HC con datos personales (sin bancarios). CURP, RFC y NSS salen censurados salvo para administración y analista. */
let HC_ACT = [];
Real.sensiblesLote = async function (us) {
  let o = []; for (let i = 0; i < us.length; i += 150) { const { data, error } = await sb.from('datos_sensibles').select('usuario_fieldwy,fecha_nacimiento,genero,estado_civil,telefono,correo,curp,rfc,nss,talla,infonavit,contacto_emergencia').in('usuario_fieldwy', us.slice(i, i + 150)); if (error) throw error; o = o.concat(data || []); }
  return o;
};
Demo.sensiblesLote = async () => [];
async function hcCsvPersonal() {
  const xs = HC_ACT || []; if (!xs.length) { toast('No hay promotores con estos filtros'); return; }
  toast('Armando el archivo…'); let ds = []; try { ds = await API.sensiblesLote(xs.map(q => q.usuario)); } catch (e) { toast('No se pudieron leer los datos personales: ' + (e.message || e)); return; }
  const por = new Map(ds.map(d => [d.usuario_fieldwy, d])), total = ['admin', 'analista'].includes(S.me.rol), m = v => !v ? '' : total ? v : String(v).slice(0, 4) + '*'.repeat(Math.max(0, String(v).length - 6)) + String(v).slice(-2);
  finBajar('hc_con_datos_personales_' + HOY + '.csv', [['usuario', 'nombre', 'estatus', 'categoria_avance', 'fase_alta', 'tipo_ingreso', 'fecha_ingreso', 'antiguedad_dias', 'razon_social', 'tienda', 'cadena', 'estado', 'region', 'gerente', 'supervisor', 'rrhh', 'fecha_nacimiento', 'genero', 'estado_civil', 'telefono', 'correo', 'curp', 'rfc', 'nss', 'talla', 'infonavit', 'contacto_emergencia'],
    ...xs.map(q => { const d = por.get(q.usuario) || {}; return [q.usuario, q.nombre, q.v.e, q.cat ? q.cat.categoria : '', q.fs ? q.fs.fase : 'Completo', q.tipo, q.fecha_alta, q.ant, q.empresa, q.t.nombre, q.t.cadena, q.t.estado, q.t.region, q.t.gerente, q.t.supervisor, q.t.rrhh,
      d.fecha_nacimiento, d.genero, d.estado_civil, d.telefono, d.correo, m(d.curp), m(d.rfc), m(d.nss), d.talla, d.infonavit == null ? '' : d.infonavit ? 'Sí' : 'No', d.contacto_emergencia]; })]);
}

/* ---- cobertura real: posiciones y tiendas del último día del periodo (para mostrar cómo estamos de verdad) ---- */
async function coberturaDonas(xs, dias) {
  const d = dias[dias.length - 1], ts = xs.filter(x => (x.t.posiciones || 0) > 0); let aut = 0, cub = 0, tC = 0, tP = 0, tD = 0;
  ts.forEach(x => { const ps = posc(x.t), c = cdv(x, d); aut += ps; cub += Math.min(c, ps); if (c >= ps) tC++; else if (c > 0) tP++; else tD++; });
  let aus = []; try { await asegurarAus(d, d); aus = AU.lista.filter(a => a.inicio <= d && a.regreso > d && okI(a.idpdv)); } catch (e) { }
  const falta = Math.max(0, aut - cub), mot = {}; aus.forEach(a => { mot[a.motivo] = (mot[a.motivo] || 0) + 1; });
  const COLM = { 'Vacaciones': C.bl, 'Incapacidad (IMSS)': C.pu, 'Permiso especial': C.te, 'Tema médico (particular)': C.ye, 'No localizado': C.dk }, items = [{ n: 'Cubiertas', v: cub, c: C.gr }]; let usado = 0;
  Object.entries(mot).sort((a, b) => b[1] - a[1]).forEach(([m, n]) => { const v = Math.min(n, falta - usado); if (v > 0) { items.push({ n: (AU_MI[m] || '') + ' ' + m, v, c: COLM[m] || C.gy }); usado += v; } });
  items.push({ n: 'Descanso / descubiertas', v: Math.max(0, falta - usado), c: C.rd });
  const pct = aut ? Math.round(cub / aut * 1000) / 10 : 0, pctT = ts.length ? Math.round(tC / ts.length * 1000) / 10 : 0;
  return `<div class="grid g2" id="dona-cob"><div class="card"><h3>🧍 Posiciones autorizadas · ${fdate(d)}</h3><p class="note"><b>${fmt(aut)}</b> posiciones autorizadas: <b>${fmt(cub)}</b> cubiertas (${pct}%). Lo que falta se reparte entre ausencias registradas y descanso o posición descubierta.</p>${donut(items, { sub: 'posiciones' })}</div>
    <div class="card"><h3>🏬 Tiendas · ${fdate(d)}</h3><p class="note"><b>${fmt(ts.length)}</b> tiendas autorizadas: <b>${fmt(tC)}</b> con todas sus posiciones cubiertas (${pctT}%).</p>${donut([{ n: 'Cubiertas', v: tC, c: C.gr }, { n: 'Parcialmente cubiertas', v: tP, c: C.am }, { n: 'Descubiertas', v: tD, c: C.rd }], { sub: 'tiendas' })}</div></div>
    <div class="tools" data-nocap><button class="btn sm" onclick="capturaDescargar($('dona-cob'),'Cobertura real · ${fdate(d)}',subFiltros(),'cobertura_real')">📸 Imagen de la cobertura</button><button class="btn sm" onclick="capturaCopiar($('dona-cob'),'Cobertura real · ${fdate(d)}',subFiltros())">📋 Copiar imagen</button></div>`;
}
