/* ====================================================================== VACANTES ======================================================================
   Vacante = la medición de cobertura de Avance GB: 2 o más días sin check = Vacante (1 día = Descubierta); en tiendas de más de una posición, Posc Faltante.
   Regla de RH: una tienda sigue CUBIERTA mientras tenga un promotor cuyo último check fue en esa tienda y todavía no es baja ni tiene una ausencia registrada
   (Activo, Descanso/falta/error o Posible baja). Cuando se confirma la baja o se registra la ausencia, ese promotor deja de cubrir y la tienda aparece como vacante.
   RH confirma la vacante (fecha compromiso + motivo) o la marca Cubierta aunque todavía no haya checks. Todo cálculo se hace con los filtros y el periodo de arriba.
   Prioridad (0-100): cuota TEMM 35 % · venta TEMM (promedio 4 semanas) 25 % · inventario 15 % · posiciones faltantes 10 % · cadena Coppel 10 % · días sin cubrir 5 %. */
const VC = { tab: 'gestion', est: '', pri: '', tipo: '', ges: new Map(), motivos: [], extra: new Map(), items: [], cargado: false };
const VC_PESO = { cuota: .35, venta: .25, inv: .15, pos: .10, cad: .10, dias: .05 };
const VC_INV = { 'Normal': 1, 'Alto': 1, 'Bajo': .7, 'Crítico': .4, 'Sin stock': .1 };
const VC_ASIG_OK = ['Activo', 'Descanso / falta / error', 'Posible baja'];

Real.vacGestion = async function () { const { data, error } = await sb.from('vacantes_gestion').select('*'); if (error) throw error; return data || []; };
Real.vacMotivos = async function () { const { data, error } = await sb.from('catalogo_motivos_vacante').select('motivo').eq('activo', true).order('orden'); if (error) throw error; return (data || []).map(x => x.motivo); };
Real.tiendaExtra = async function () { return todo(() => sb.from('rep_tienda_extra').select('*')); };
Real.vacHist = async function (idpdv) { const { data, error } = await sb.from('vacantes_historial').select('*').eq('idpdv', idpdv).order('en', { ascending: false }).limit(15); if (error) throw error; return data || []; };
Real.vacGuardar = async function (a) { return Real.finRpc('guardar_vacante', a); };
Real.vacQuitar = async function (id, motivo) { return Real.finRpc('quitar_vacante', { p_idpdv: id, p_motivo: motivo }); };
const DEMO_VAC = [];
Demo.vacGestion = async () => DEMO_VAC.slice(); Demo.vacMotivos = async () => ['Mal ambiente laboral', 'Falta de inventario', 'Tienda cerrada o en remodelación', 'Problema de acceso a la tienda', 'Sin candidatos', 'Decisión de la cadena', 'Otro'];
Demo.tiendaExtra = async () => Object.values(S.cat.tiendas).map((t, i) => ({ idpdv: t.idpdv, semana: '26-S41', cuota_temm: 2 + (i * 7) % 15, venta_temm: (i * 3) % 6, alcance_temm: .2 + (i % 8) / 10, prom4_temm: 1 + (i * 5) % 7, inv_estatus: ['Normal', 'Bajo', 'Crítico', 'Alto', 'Sin stock'][i % 5], inv_piezas: 20 + i, inv_semanas: 3 + i % 6 }));
Demo.vacHist = async () => [];
Demo.vacGuardar = async a => { const i = DEMO_VAC.findIndex(x => x.idpdv === a.p_idpdv); const f = { idpdv: a.p_idpdv, estado: a.p_estado, posiciones: a.p_posiciones, fecha_compromiso: a.p_fecha_compromiso, motivo: a.p_motivo, nota: a.p_nota, cubierta_desde: HOY, cubierta_por: a.p_cubierta_por }; if (i >= 0) DEMO_VAC[i] = f; else DEMO_VAC.push(f); };
Demo.vacQuitar = async id => { const i = DEMO_VAC.findIndex(x => x.idpdv === id); if (i >= 0) DEMO_VAC.splice(i, 1); };

async function vacCargar(force) {
  if (VC.cargado && !force) return;
  const [g, m, e] = await Promise.all([API.vacGestion(), API.vacMotivos(), API.tiendaExtra().catch(() => [])]);
  VC.ges = new Map(g.map(x => [x.idpdv, x])); VC.motivos = m; VC.extra = new Map(e.map(x => [x.idpdv, x])); VC.cargado = true;
}
function diasSinCheck(x, hasta) { let n = 0; for (let d = hasta; d >= R.meta.cd_desde && n < 120; d = addD(d, -1)) { if (cdv(x, d) > 0) return n; n++; } return n; }

function vacCalcular(r) {
  const dias = r.dias, xs = xsF().filter(x => (x.t.posiciones || 0) > 0), asig = new Map();
  R.hc.forEach(h => { if (h.rol !== 'Promotor' || h.ultimo_idpdv == null) return; if (VC_ASIG_OK.includes(estadoVivo(h).e)) asig.set(h.ultimo_idpdv, (asig.get(h.ultimo_idpdv) || 0) + 1); });
  const ex = id => VC.extra.get(id) || {}, q90 = k => { const v = [...VC.extra.values()].map(e => +e[k] || 0).sort((a, b) => a - b); return v.length ? Math.max(1, v[Math.floor(v.length * .9)]) : 1; };
  const Q = q90('cuota_temm'), V = q90('prom4_temm'), items = [];
  xs.forEach(x => {
    const g = VC.ges.get(x.id), s = estatusTienda(x, dias), ps = posc(x.t), a = asig.get(x.id) || 0, dsc = diasSinCheck(x, r.hasta), e = ex(x.id);
    let tipo = null, falt = 0;
    if (s.cob === 'Vacante' && a === 0) { tipo = 'Tienda vacante'; falt = ps; }
    else if (ps > 1 && s.asi === 'Posc Faltante' && a < ps) { tipo = 'Posiciones faltantes'; falt = ps - a; }
    else if (s.cob === 'Vacante' || (ps > 1 && s.asi === 'Posc Faltante')) tipo = 'En seguimiento';           // sin checks pero con promotor asignado que todavía no es baja
    if (!tipo && !g) return;
    const real = tipo === 'Tienda vacante' || tipo === 'Posiciones faltantes';
    let estado = g ? (g.estado === 'Cubierta' ? 'Cubierta (RH)' : real ? 'Confirmada' : tipo === 'En seguimiento' ? 'En seguimiento' : 'Resuelta') : (real ? 'Por confirmar' : 'En seguimiento');
    if (!tipo) tipo = 'Ya cubierta por checks';
    const vac = real && estado !== 'Cubierta (RH)', faltC = g && g.posiciones != null && estado === 'Confirmada' ? g.posiciones : falt;
    const sc = (VC_PESO.cuota * Math.min(1, (+e.cuota_temm || 0) / Q) + VC_PESO.venta * Math.min(1, (+e.prom4_temm || 0) / V) + VC_PESO.inv * (VC_INV[e.inv_estatus] != null ? VC_INV[e.inv_estatus] : .5)
      + VC_PESO.pos * Math.min(1, falt / Math.max(1, ps)) + VC_PESO.cad * (x.t.cadena === 'Coppel' ? 1 : .6) + VC_PESO.dias * Math.min(1, dsc / 10)) * 100;
    items.push({ x, id: x.id, t: x.t, tipo, estado, vac, ps, asig: a, falt: faltC, dsc, ult: dsc < 120 ? addD(r.hasta, -dsc) : null, g, e, score: sc, pri: sc >= 65 ? 'Alta' : sc >= 45 ? 'Media' : 'Baja', cob: s.cob, asi: s.asi });
  });
  return items;
}
const VPC = { 'Alta': 'r', 'Media': 'a', 'Baja': 'g' }, VPE = { 'Alta': '🔴', 'Media': '🟠', 'Baja': '🟢' };
const VEC = { 'Por confirmar': 'a', 'Confirmada': 'r', 'Cubierta (RH)': 'g', 'En seguimiento': 'b', 'Resuelta': 'g' };
const vencida = i => i.estado === 'Confirmada' && i.g && i.g.fecha_compromiso && i.g.fecha_compromiso < HOY;
const proxima = i => i.estado === 'Confirmada' && i.g && i.g.fecha_compromiso && i.g.fecha_compromiso >= HOY && diffD(i.g.fecha_compromiso, HOY) <= 3;

async function vVacantes() {
  await conReporte('Vacantes', 'mochila', async () => {
    await vacCargar(); if (!R.vivo) { try { S.vigentes = await API.vigentes(); } catch (e) { } R.vivo = true; }
    const r = perRango(), items = vacCalcular(r); VC.items = items;
    const vac = items.filter(i => i.vac), puede = can('vacantes', 'editar');
    const cnt = k => items.filter(i => i.estado === k).length;
    let h = cab('Vacantes', 'Tiendas y posiciones sin cobertura real. Una tienda sigue cubierta mientras su promotor no sea baja ni tenga ausencia registrada. Confirma la vacante con fecha compromiso y motivo, o márcala cubierta.', 'mochila');
    h += `<div class="tools" data-nocap>${[['gestion', '📋 Gestión de vacantes'], ['resumen', '🗺️ Resumen'], ['graficas', '📊 Gráficas']].map(([k, n]) => `<button class="chip ${VC.tab === k ? 'on' : ''}" onclick="VC.tab='${k}';vVacantes()">${n}</button>`).join('')}</div>`;
    h += `<div class="kpis">${kp('Tiendas con vacante', fmt(vac.length), `${fmt(vac.filter(i => i.tipo === 'Tienda vacante').length)} completas · ${fmt(vac.filter(i => i.tipo === 'Posiciones faltantes').length)} con posiciones faltantes`, vac.length ? C.rd : C.gr, null, '🏬')}${kp('Posiciones faltantes', fmt(vac.reduce((a, i) => a + i.falt, 0)), 'suma de posiciones sin cubrir', C.am, null, '🧍')}${kp('Por confirmar', fmt(cnt('Por confirmar')), 'falta fecha compromiso y motivo', C.am, "VC.est='Por confirmar';VC.tab='gestion';vVacantes()", '❓')}${kp('Compromisos vencidos', fmt(items.filter(vencida).length), `${fmt(items.filter(proxima).length)} vencen en 3 días o menos`, items.filter(vencida).length ? C.rd : C.gr, "VC.est='vencidas';VC.tab='gestion';vVacantes()", '⏰')}${kp('En seguimiento', fmt(cnt('En seguimiento')), 'sin checks, pero su promotor aún no es baja', C.bl, "ir('bandeja')", '🔎')}</div>`;
    h += VC.tab === 'graficas' ? vacResumenHTML(items, r) : VC.tab === 'resumen' ? vacTablaHTML(items, r) : vacGestionHTML(items, r, puede);
    $('content').innerHTML = h; drawAll();
  });
}

function vacGestionHTML(items, r, puede) {
  const cuenta = f => items.filter(f).length;
  const tabs = [['', 'Todas', items.length], ['Por confirmar', 'Por confirmar', cuenta(i => i.estado === 'Por confirmar')], ['Confirmada', 'Confirmadas', cuenta(i => i.estado === 'Confirmada')], ['vencidas', 'Compromisos vencidos', cuenta(vencida)],
    ['Cubierta (RH)', 'Cubiertas por RH', cuenta(i => i.estado === 'Cubierta (RH)')], ['En seguimiento', 'En seguimiento', cuenta(i => i.estado === 'En seguimiento')], ['Resuelta', 'Resueltas', cuenta(i => i.estado === 'Resuelta')]];
  let h = alertasVac(items);
  h += `<div class="tools" data-nocap>${tabs.map(([k, n, c]) => `<button class="chip ${VC.est === k ? 'on' : ''}" onclick="VC.est='${k}';vVacantes()">${n} (${c})</button>`).join('')}</div>`;
  h += `<div class="tools" data-nocap><span>Prioridad:</span><select onchange="VC.pri=this.value;vVacantes()"><option value="">Todas</option>${['Alta', 'Media', 'Baja'].map(p => `<option ${VC.pri === p ? 'selected' : ''}>${p}</option>`).join('')}</select><span>Tipo:</span><select onchange="VC.tipo=this.value;vVacantes()"><option value="">Todos</option>${['Tienda vacante', 'Posiciones faltantes'].map(p => `<option ${VC.tipo === p ? 'selected' : ''}>${p}</option>`).join('')}</select>
    <button class="btn sm" onclick="vacCsvReal()">⬇ CSV de vacantes reales</button><span class="muted">Corte al ${fdate(r.hasta)} · la prioridad se explica al pasar el mouse sobre su etiqueta</span></div>`;
  const rows = items.filter(i => (!VC.est || (VC.est === 'vencidas' ? vencida(i) : i.estado === VC.est)) && (!VC.pri || i.pri === VC.pri) && (!VC.tipo || i.tipo === VC.tipo)).sort((a, b) => b.score - a.score);
  TB = {};
  h += tbl('t-vac', [{ h: 'Prioridad', t: 1, v: q => q.score, w: 96, r: q => `<span title="Puntaje ${q.score.toFixed(0)} de 100">${pillx(VPE[q.pri] + ' ' + q.pri, VPC[q.pri])}</span>` }, { h: 'IDPDV', v: q => q.id, w: 86 }, { h: 'Tienda', t: 1, v: q => q.t.nombre, w: 230, r: q => `<b>${esc(q.t.nombre)}</b>` },
    { h: 'Cadena', t: 1, v: q => q.t.cadena }, { h: 'Class', t: 1, v: q => q.t.clase }, { h: 'Posc.', v: q => q.ps }, { h: 'Tipo', t: 1, v: q => q.tipo, r: q => pillx(q.tipo, q.vac ? 'r' : q.tipo === 'En seguimiento' ? 'b' : 'x') },
    { h: 'Posiciones faltantes', v: q => q.falt, r: q => q.vac ? `<b>${q.falt}</b>` : '—' }, { h: 'Promotores asignados', v: q => q.asig }, { h: 'Días sin check', v: q => q.dsc, r: q => q.dsc >= 5 ? `<span class="cell-red">${q.dsc}</span>` : q.dsc >= 2 ? `<span class="cell-amber">${q.dsc}</span>` : String(q.dsc) },
    { h: 'Último check', v: q => q.ult, r: q => q.ult ? fdate(q.ult) : '120+ días' }, { h: 'Cuota TEMM sem.', v: q => +q.e.cuota_temm || 0, r: q => q.e.cuota_temm != null ? fmt1(+q.e.cuota_temm) : '—' }, { h: 'Venta TEMM (prom. 4 sem.)', v: q => +q.e.prom4_temm || 0, r: q => q.e.prom4_temm != null ? fmt1(+q.e.prom4_temm) : '—' },
    { h: 'Inventario', t: 1, v: q => q.e.inv_estatus || '', r: q => q.e.inv_estatus ? pillx(esc(q.e.inv_estatus), q.e.inv_estatus === 'Normal' || q.e.inv_estatus === 'Alto' ? 'g' : q.e.inv_estatus === 'Bajo' ? 'a' : 'r') : '—' },
    { h: 'Estatus', t: 1, v: q => q.estado, r: q => pillx(q.estado, VEC[q.estado] || 'x') }, { h: 'Fecha compromiso', v: q => q.g && q.g.fecha_compromiso, r: q => q.g && q.g.fecha_compromiso ? (vencida(q) ? `<span class="cell-red">${fdate(q.g.fecha_compromiso)} ⏰</span>` : fdate(q.g.fecha_compromiso)) : '—' },
    { h: 'Motivo / nota', t: 1, w: 220, v: q => q.g ? (q.g.motivo || '') + ' ' + (q.g.nota || '') : '', r: q => q.g ? `${esc(q.g.motivo || (q.g.estado === 'Cubierta' ? 'Cubierta' + (q.g.cubierta_por ? ' por ' + q.g.cubierta_por : '') : ''))}${q.g.nota ? `<br><small class="muted">${esc(q.g.nota)}</small>` : ''}` : '—' },
    { h: 'Supervisor', t: 1, v: q => q.t.supervisor }, { h: 'Gerente', t: 1, v: q => q.t.gerente }, { h: 'RR.HH.', t: 1, v: q => q.t.rrhh },
    { h: '', t: 1, v: q => 0, r: q => puede ? `<button class="btn sm ${q.estado === 'Por confirmar' ? 'primary' : ''}" data-nocap onclick="vacGestionar(${q.id})">Gestionar</button>` : '' }],
    rows, { fix: 3, search: 1, csv: 1, png: 1, file: 'vacantes', titulo: 'Vacantes · corte al ' + fdate(r.hasta), sort: 0, dir: -1, maxh: '70vh', lim: 600 });
  return h;
}
function alertasVac(items) {
  const venc = items.filter(vencida), prox = items.filter(proxima), altas = items.filter(i => i.estado === 'Por confirmar' && i.pri === 'Alta');
  if (!venc.length && !prox.length && !altas.length) return '';
  const tarj = (k, ic, t, sub, xs, extra) => xs.length ? `<details class="alc ${k}" ${k === 'r' ? 'open' : ''}><summary><span class="alc-n">${xs.length}</span><div><b>${ic} ${t}</b><small>${sub}</small></div><i>▾</i></summary><div class="tw tw-in"><table class="dt st"><thead><tr><th class="t">Tienda</th><th class="t">Estado</th><th>Compromiso</th><th>Días sin check</th><th class="t">Supervisor</th><th class="t">RR.HH.</th></tr></thead><tbody>${xs.slice(0, 40).map(i => `<tr><td class="t"><b>${esc(i.t.nombre)}</b> <small class="muted">${i.id}</small></td><td class="t">${esc(i.t.estado || '')}</td><td>${i.g && i.g.fecha_compromiso ? fdate(i.g.fecha_compromiso) : '—'}</td><td>${i.dsc}</td><td class="t">${esc(i.t.supervisor || '')}</td><td class="t">${esc(i.t.rrhh || '')}</td></tr>`).join('')}</tbody></table></div></details>` : '';
  return `<div class="alertas2" id="vac-alertas">${tarj('r', '⏰', 'Compromisos de cobertura vencidos', 'La fecha compromiso ya pasó y la vacante sigue sin cubrirse', venc)}${tarj('a', '🟡', 'Compromisos que vencen en 3 días o menos', 'Dar seguimiento para cumplir la fecha', prox)}${tarj('a', '🔴', 'Prioridad alta sin confirmar', 'Vacantes importantes todavía sin fecha compromiso ni motivo', altas)}</div>
    <div class="tools" data-nocap><button class="btn sm" onclick="capturaDescargar($('vac-alertas'),'Alertas de vacantes · ${fdate(HOY)}',subFiltros(),'alertas_vacantes')">📸 Imagen de las alertas</button></div>`;
}

function vacCsvReal() {
  const xs = VC.items.filter(i => i.vac); if (!xs.length) { toast('No hay vacantes reales con estos filtros'); return; }
  finBajar('vacantes_reales_' + HOY + '.csv', [['idpdv', 'tienda', 'cadena', 'class', 'estado', 'region', 'gerente', 'supervisor', 'rrhh', 'tipo', 'posiciones_tienda', 'posiciones_faltantes', 'dias_sin_check', 'ultimo_check', 'cuota_temm_semana', 'venta_temm_prom4', 'inventario', 'prioridad', 'estatus', 'fecha_compromiso', 'motivo', 'nota'],
    ...xs.sort((a, b) => b.score - a.score).map(i => [i.id, i.t.nombre, i.t.cadena, i.t.clase, i.t.estado, i.t.region, i.t.gerente, i.t.supervisor, i.t.rrhh, i.tipo, i.ps, i.falt, i.dsc, i.ult, i.e.cuota_temm, i.e.prom4_temm, i.e.inv_estatus, i.pri, i.estado, i.g && i.g.fecha_compromiso, i.g && i.g.motivo, i.g && i.g.nota])]);
}

/* ---- gestionar una vacante ---- */
async function vacGestionar(id) {
  const i = VC.items.find(x => x.id === id); if (!i) return; let hist = []; try { hist = await API.vacHist(id); } catch (e) { }
  const g = i.g || {}, esC = g.estado === 'Cubierta';
  $('modal').innerHTML = `<div class="mbox" style="width:min(600px,96vw);max-height:92vh;overflow:auto" role="dialog" aria-modal="true"><h3>📌 Gestionar vacante</h3><div class="who">${esc(i.t.nombre)} · IDPDV ${id}<br><small>${esc(i.t.cadena || '')} · ${esc(i.t.estado || '')} · ${esc(i.tipo)} · ${i.dsc} días sin check · ${i.asig} de ${i.ps} posición${i.ps === 1 ? "" : "es"} con promotor asignado</small></div>
    <div class="fld"><label>¿Qué pasa con esta tienda?</label><select id="vc-est" onchange="vacToggle()"><option value="Confirmada" ${!esC ? 'selected' : ''}>Confirmo la vacante (con fecha compromiso)</option><option value="Cubierta" ${esC ? 'selected' : ''}>Ya está cubierta (aunque todavía no tenga checks)</option></select></div>
    <div id="vc-conf"><div class="row2"><div class="fld"><label>Posiciones vacantes</label><input id="vc-pos" type="number" min="0" max="20" value="${g.posiciones != null ? g.posiciones : i.falt || i.ps}"></div><div class="fld"><label>Fecha compromiso de cobertura</label><input id="vc-fec" type="date" value="${g.fecha_compromiso || ''}"></div></div>
      <div class="fld"><label>Motivo de la vacante</label><select id="vc-mot"><option value="">— elige —</option>${VC.motivos.map(m => `<option ${g.motivo === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></div></div>
    <div id="vc-cub" hidden><div class="fld"><label>Promotor que la cubre (usuario Fieldway, opcional)</label><input id="vc-por" value="${esc(g.cubierta_por || '')}" placeholder="Ej. ABCD123456"></div></div>
    <div class="fld"><label>Nota <small class="muted">(obligatoria si el motivo es «Otro»)</small></label><input id="vc-nota" value="${esc(g.nota || '')}" placeholder="Qué se está haciendo, con quién, bloqueos…"></div>
    ${hist.length ? `<details class="enc-d"><summary>Historial (${hist.length})</summary>${hist.map(h => `<div class="muted" style="font-size:12px;padding:3px 0">${fdate(String(h.en).slice(0, 10))} · <b>${esc(h.estado)}</b>${h.fecha_compromiso ? ' · compromiso ' + fdate(h.fecha_compromiso) : ''}${h.motivo ? ' · ' + esc(h.motivo) : ''}${h.nota ? ' · ' + esc(h.nota) : ''}</div>`).join('')}</details>` : ''}
    <div class="mfoot">${i.g ? `<button class="btn danger" onclick="vacQuitar(${id})">Quitar gestión</button>` : ''}<button class="btn" onclick="cerrarM()">Cancelar</button><button class="btn primary" onclick="vacGuardar(${id})">Guardar</button></div></div>`;
  $('modal').hidden = false; vacToggle();
}
function vacToggle() { const c = $('vc-est').value === 'Cubierta'; $('vc-conf').hidden = c; $('vc-cub').hidden = !c; }
async function vacGuardar(id) {
  const est = $('vc-est').value;
  try {
    await API.vacGuardar({ p_idpdv: id, p_estado: est, p_posiciones: est === 'Confirmada' && $('vc-pos').value !== '' ? +$('vc-pos').value : null, p_fecha_compromiso: est === 'Confirmada' ? ($('vc-fec').value || null) : null, p_motivo: est === 'Confirmada' ? ($('vc-mot').value || null) : null, p_nota: limpia($('vc-nota').value) || null, p_cubierta_por: est === 'Cubierta' ? limpia($('vc-por').value) : null });
    toast(est === 'Cubierta' ? 'Marcada como cubierta' : 'Vacante confirmada'); cerrarM(); await vacCargar(true); vacInsignia(); vVacantes();
  } catch (e) { toast(e.message || e); }
}
async function vacQuitar(id) {
  const m = prompt('¿Por qué se quita la gestión? (mínimo 5 caracteres). La tienda vuelve a evaluarse solo por la cobertura medida.', ''); if (m === null) return; if (limpia(m).length < 5) { toast('Escribe el motivo'); return; }
  try { await API.vacQuitar(id, limpia(m)); toast('Gestión quitada'); cerrarM(); await vacCargar(true); vVacantes(); } catch (e) { toast(e.message || e); }
}

/* ---- resumen gráfico ---- */
function vacResumenHTML(items, r) {
  const vac = items.filter(i => i.vac), W = ventana(), L = limites(), ult = W.slice(-12), xs = xsF().filter(x => (x.t.posiciones || 0) > 0);
  const sem = ult.map(w => { const fin = addD(w.ini, 6) > L.max ? L.max : addD(w.ini, 6), ds = []; for (let d = w.ini; d <= fin; d = addD(d, 1)) if (d >= R.meta.cd_desde) ds.push(d); let tv = 0, pf = 0; if (ds.length) xs.forEach(x => { const s = estatusTienda(x, ds); if (s.cob === 'Vacante') tv++; else if (s.asi === 'Posc Faltante') pf++; }); return { w: w.w.slice(3), tv, pf }; });
  const crec = sem.length > 1 ? sem[sem.length - 1].tv + sem[sem.length - 1].pf - (sem[sem.length - 2].tv + sem[sem.length - 2].pf) : 0;
  let h = sect('Tendencia semanal', '📈') + `<div class="grid g2"><div class="card"><h3>Tiendas vacantes y con posiciones faltantes · últimas ${sem.length} semanas</h3><p class="note">Según la cobertura medida al cierre de cada semana (2 o más días sin check = vacante). ${crec ? `La última semana ${crec > 0 ? 'subió' : 'bajó'} <b>${Math.abs(crec)}</b> contra la anterior.` : ''} El detalle de arriba (con promotor asignado) solo aplica al día de hoy.</p>${legend([['Tiendas vacantes', C.rd], ['Con posiciones faltantes', C.am]])}${chart(sem.map(s => s.w), [{ n: 'Tiendas vacantes', c: C.rd, v: sem.map(s => s.tv) }, { n: 'Con posiciones faltantes', c: C.am, v: sem.map(s => s.pf) }], { bars: 1, vals: 1, h: 300, ticks: 16 })}</div>`;
  const top = vac.slice().sort((a, b) => b.dsc - a.dsc).slice(0, 12);
  h += `<div class="card"><h3>⏳ Tiendas con más días sin cubrirse</h3>${hbars(top.map(i => ({ n: i.t.nombre + ' · ' + i.id, v: i.dsc, c: i.dsc >= 10 ? C.rd : C.am, s: (i.g && i.g.motivo) || i.estado })), C.am)}</div></div>`;
  const mot = {}; items.filter(i => i.g && i.g.motivo && i.estado === 'Confirmada').forEach(i => mot[i.g.motivo] = (mot[i.g.motivo] || 0) + 1);
  const est = {}; items.forEach(i => est[i.estado] = (est[i.estado] || 0) + 1);
  h += `<div class="grid g2"><div class="card"><h3>🧩 Motivos de las vacantes confirmadas</h3>${Object.keys(mot).length ? hbars(Object.entries(mot).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ n: k, v, c: k === 'Mal ambiente laboral' || k === 'Sin candidatos' ? C.rd : C.am, s: pc1(v, Object.values(mot).reduce((a, b) => a + b, 0)) })), C.am) : '<p class="note">Todavía no hay vacantes confirmadas con motivo.</p>'}</div>
    <div class="card"><h3>🚦 Estatus de gestión</h3>${donut(Object.entries(est).map(([k, v]) => ({ n: k, v, c: k === 'Confirmada' ? C.rd : k === 'Por confirmar' ? C.am : k === 'Cubierta (RH)' || k === 'Resuelta' ? C.gr : C.bl })), { sub: 'tiendas' })}</div></div>`;
  const por = (campo, vacio) => { const m = new Map(); vac.forEach(i => { const k = i.t[campo] || vacio; m.set(k, (m.get(k) || 0) + Math.max(1, i.falt)); }); return [...m].sort((a, b) => b[1] - a[1]).slice(0, 10); };
  h += `<div class="grid g2"><div class="card"><h3>🧑‍💼 Posiciones faltantes por gerente</h3>${hbars(por('gerente', 'Sin gerente').map(([k, v]) => ({ n: k, v, c: C.rd })), C.rd)}</div><div class="card"><h3>🔗 Posiciones faltantes por cadena</h3>${hbars(por('cadena', 'Sin cadena').map(([k, v]) => ({ n: k, v, c: C.am })), C.am)}</div></div>`;
  return h;
}

/* insignia del menú: compromisos vencidos o que vencen en 3 días (consulta ligera, sin cargar los reportes) */
async function vacInsignia() {
  if (!can('vacantes', 'ver')) return;
  try { const g = await API.vacGestion(); S.vacBadge = g.filter(x => x.estado === 'Confirmada' && x.fecha_compromiso && diffD(x.fecha_compromiso, HOY) <= 3).length; nav(); } catch (e) { }
}

/* ---- Resumen: tabla agrupada (región > gerente > supervisor > tienda) con una columna por cadena y total; solo el número de vacantes ---- */
const VC_MET = [['total', 'Total (tiendas vacantes + posiciones faltantes)'], ['pdv', 'Vacantes PDV (tiendas completas)'], ['pos', 'Posiciones faltantes']];
function vacTablaHTML(items, r) {
  VC.met = VC.met || 'total';
  const val = i => (VC.met !== 'pos' && i.tipo === 'Tienda vacante' ? 1 : 0) + (VC.met !== 'pdv' && i.tipo === 'Posiciones faltantes' ? i.falt : 0);
  const filas = items.filter(i => i.vac).map(i => ({ idpdv: i.id, v: val(i) })).filter(x => x.v > 0), cad = x => (tienda(x.idpdv) || {}).cadena;
  const cads = [...new Set(filas.map(cad).filter(Boolean))].sort((a, b) => (b === 'Coppel') - (a === 'Coppel') || a.localeCompare(b, 'es')), total = filas.reduce((a, x) => a + x.v, 0);
  const titulo = 'Vacantes · ' + VC_MET.find(m => m[0] === VC.met)[1] + ' · corte al ' + fdate(r.hasta);
  return sect('Resumen de vacantes por región, gerente y cadena', '🗺️') + `<div class="tools" data-nocap><span>Contar:</span>${VC_MET.map(([k, n]) => `<button class="chip ${VC.met === k ? 'on' : ''}" onclick="VC.met='${k}';vVacantes()">${n}</button>`).join('')}
    <button class="btn sm" onclick="capturaDescargar($('vac-esq'),'${titulo}',subFiltros(),'resumen_vacantes')">📸 Imagen</button><button class="btn sm" onclick="capturaCopiar($('vac-esq'),'${titulo}',subFiltros())">📋 Copiar imagen</button></div>
    <p class="note">${fmt(total)} en total · corte al ${fdate(r.hasta)}. Abre cada nivel con ⊞. Las tiendas cubiertas por RH o con promotor asignado no cuentan como vacante.</p>
    <div id="vac-esq" class="cap-pad">${filas.length ? arbol(filas, [...cads.map(c => ({ h: c, f: a => a.filter(x => cad(x) === c).reduce((s, x) => s + x.v, 0) })), { h: 'Total general', f: a => a.reduce((s, x) => s + x.v, 0), cero: true }], { titulo: 'REGIÓN / GERENTE / SUPERVISOR / TIENDA', abrir: 2 }) : '<div class="card empty"><img src="' + img('triunfo') + '" alt="">Sin vacantes con estos filtros.</div>'}</div>`;
}
