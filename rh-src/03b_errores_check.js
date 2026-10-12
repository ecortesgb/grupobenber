/* ====================================================================== DETALLE DE CHECKS · ERRORES DE CHECK ======================================================================
   Subsección de Detalle de checks. Por día: tarjetas por promotor con el tipo de error, su tienda y supervisor y la forma sugerida de corregirlo, para mandar como imagen por WhatsApp
   mientras todavía se puede corregir. Por periodo: acumulado de errores por promotor, tipo de error y supervisor. La venta justifica los errores de tiempo/horario/comida,
   no los de rango, equipo duplicado ni salida sin check (misma regla de la sección de checks). */
const ERRFIX = {
  'Check In Fuera Ventana': 'Hacer el check de entrada dentro de la ventana de horario de la tienda. Si ya pasó, avisar al supervisor para dejar nota.',
  'Check Out Fuera Ventana': 'Hacer el check de salida dentro de la ventana de horario de la tienda. Si ya pasó, avisar al supervisor para dejar nota.',
  'Error Comida': 'Registrar la salida y el regreso de comida dentro del horario permitido. Pedir al supervisor revisar el registro del día.',
  'Tiempo Incompleto': 'Completar el tiempo mínimo en tienda (420 min; 300 los domingos con horario diferenciado). Si hubo venta, queda justificado.',
  'Check In Fuera Rango': 'Hacer el check de entrada estando en la tienda (dentro del rango de ubicación). Si estuvo en otra tienda, reasignar o enviarlo a la correcta.',
  'Check Out Fuera Rango': 'Hacer el check de salida estando en la tienda (dentro del rango). Si salió de otra tienda, reasignar o enviarlo a la correcta.',
  'No Check Salida': 'Cerrar siempre la jornada con su check de salida. Pedir al promotor que lo registre y avisar al supervisor.',
  'Equipo Duplicado': 'Cada promotor debe checar con su propio equipo. Revisar con el supervisor quién usó el mismo celular.'
};
const ERR_TIPOS = Object.keys(ERRFIX);
const ERR_JUST = [['', 'Todos los errores'], ['sin', '🔴 Sin justificación'], ['con', '🟢 Con justificación (venta)']];
const errFiltra = (xs, just) => xs.filter(x => !just || (just === 'con' ? justTxt(x) === 'Con venta' : justTxt(x) !== 'Con venta'));
const errNom = k => ERRN[k] || k;

function erroresCheckHTML(r, rows, prim, errores) {
  const subTabs = `<div class="tools" data-nocap>${[['errores', '🛠️ Errores de check'], ['abiertos', '🟦 Sin cerrar check']].map(([k, n]) => `<button class="chip ${(CKS.sub || 'errores') === k ? 'on' : ''}" onclick="CKS.sub='${k}';vChecks()">${n}</button>`).join('')}</div>`;
  if ((CKS.sub || 'errores') === 'abiertos') return subTabs + abiertosHTML(r, prim);
  const just = CKS.just, errF = errFiltra(errores, just), sup = x => (tienda(x.idpdv) || {}).supervisor || 'Sin supervisor';
  const unDia = r.desde === r.hasta, hoy = unDia && r.hasta === HOY, MAXC = 200;
  let h = subTabs + `<div class="tools" data-nocap>${ERR_JUST.map(([k, n]) => `<button class="chip ${just === k ? 'on' : ''}" onclick="CKS.just='${k}';vChecks()">${n}</button>`).join('')}<span class="muted">Fuera de rango, equipo duplicado y sin check de salida no se justifican con venta. El periodo es el de la barra de arriba.</span></div>`;
  h += `<div class="kpis">${kp('Errores', fmt(errF.length), `${fdate(r.desde)}${unDia ? '' : ' – ' + fdate(r.hasta)} · ${fmt(prim.length)} checks evaluados`, errF.length ? C.rd : C.gr, null, '🛠️')}${kp('Promotores con error', fmt(new Set(errF.map(x => x.usuario)).size), `de ${fmt(new Set(prim.map(x => x.usuario)).size)} que checaron`, null, null, '🧍')}${kp('% de checks con error', pc1(errF.length, prim.length), 'sobre los checks evaluados', null, null, '📉')}${kp('Sin justificar con venta', fmt(errF.filter(x => justTxt(x) !== 'Con venta').length), 'siguen pendientes de corregir', C.am, null, '🔴')}</div>`;

  /* ---- tarjetas para WhatsApp (todo el periodo elegido arriba, agrupadas por supervisor) ---- */
  const vis = errF.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, MAXC), titulo = 'Errores de check · ' + fdate(r.desde) + (unDia ? '' : ' al ' + fdate(r.hasta));
  h += sect('Errores por supervisor', '📲') + `<div class="tools" data-nocap><button class="btn sm" onclick="capturaDescargar($('err-dia'),'${titulo}',subFiltros(),'errores_check')">📸 Imagen para WhatsApp</button><button class="btn sm" onclick="capturaCopiar($('err-dia'),'${titulo}',subFiltros())">📋 Copiar imagen</button><button class="btn sm" onclick="erroresCsv('periodo')">⬇ CSV</button>
    <span class="muted">${hoy ? 'Es el día de hoy: todavía se pueden corregir.' : unDia ? 'Día anterior: sirve de seguimiento.' : 'Varios días: cada tarjeta trae su fecha.'}${errF.length > MAXC ? ` Mostrando los ${MAXC} más recientes de ${fmt(errF.length)}; el CSV trae todos.` : ''}</span></div>`;
  const porSup = new Map(); vis.forEach(x => { const k = sup(x); if (!porSup.has(k)) porSup.set(k, []); porSup.get(k).push(x); });
  h += `<div id="err-dia" class="err-dia">${vis.length ? [...porSup].sort((a, b) => a[0].localeCompare(b[0], 'es')).map(([s, xs]) => `<div class="err-sup"><h4>🧭 ${esc(s)} <small>${xs.length} error${xs.length === 1 ? '' : 'es'}</small></h4>${xs.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es') || b.fecha.localeCompare(a.fecha)).map(x => {
    const t = tienda(x.idpdv) || {}, jt = justTxt(x), p = JUSTP[jt];
    return `<div class="err-card"><div class="err-h"><b>${esc(x.nombre)}</b><small>${esc(x.usuario)} · ${esc(t.nombre || 'IDPDV ' + x.idpdv)}${unDia ? '' : ' · ' + fdate(x.fecha)}</small></div><div>${pillx((ERRI[x.estatus_check] || '') + ' ' + errNom(x.estatus_check), NOJUST.includes(x.estatus_check) ? 'r' : 'a')} ${pillx(p[1], p[0])}${x.registros ? ` <small class="muted">${x.registros} venta${x.registros === 1 ? '' : 's'}</small>` : ''}</div><div class="err-fix">💡 ${esc(ERRFIX[x.estatus_check] || 'Revisar el check con el supervisor.')}</div>${justBtn(x)}</div>`;
  }).join('')}</div>`).join('') : '<div class="card empty"><img src="' + img('triunfo') + '" alt="">Sin errores de check en este periodo con este filtro.</div>'}</div>`;

  /* ---- del periodo: acumulado ---- */
  h += sect('Acumulado del periodo', '📊') + `<p class="note">${fdate(r.desde)} – ${fdate(r.hasta)}. Cambia el periodo arriba para ver otra semana o mes.</p>`;
  const tipos = {}; errF.forEach(x => tipos[x.estatus_check] = (tipos[x.estatus_check] || 0) + 1);
  h += `<div class="grid g2"><div class="card"><h3>🧩 Tipos de error</h3>${hbars(Object.entries(tipos).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ n: (ERRI[k] || '') + ' ' + errNom(k), v, c: NOJUST.includes(k) ? C.rd : C.am, s: pc1(v, errF.length) })), C.am)}</div>`;
  const gs = new Map(); errF.forEach(x => { const k = sup(x); if (!gs.has(k)) gs.set(k, { s: k, e: 0, u: new Set() }); const g = gs.get(k); g.e++; g.u.add(x.usuario); });
  h += `<div class="card"><h3>🧭 Supervisores con más errores</h3>${hbars([...gs.values()].sort((a, b) => b.e - a.e).slice(0, 10).map(g => ({ n: g.s, v: g.e, c: C.am, s: g.u.size + ' promotores' })), C.am)}</div></div>`;
  const checksPor = new Map(); prim.forEach(x => checksPor.set(x.usuario, (checksPor.get(x.usuario) || 0) + 1));
  const gp = new Map(); errF.forEach(x => { if (!gp.has(x.usuario)) gp.set(x.usuario, { u: x.usuario, n: x.nombre, id: x.idpdv, tipos: {}, e: 0, j: 0 }); const g = gp.get(x.usuario); g.e++; g.tipos[x.estatus_check] = (g.tipos[x.estatus_check] || 0) + 1; if (justTxt(x) === 'Con venta') g.j++; g.id = x.idpdv; });
  const lista = [...gp.values()].map(g => ({ ...g, d: checksPor.get(g.u) || g.e, top: Object.entries(g.tipos).sort((a, b) => b[1] - a[1])[0][0] }));
  TB = {};
  const cols = [{ h: 'Usuario', t: 1, v: q => q.u, w: 112 }, { h: 'Promotor', t: 1, v: q => q.n, w: 230, r: q => `<b>${esc(q.n)}</b>` }, { h: 'Tienda (último error)', t: 1, v: q => (tienda(q.id) || {}).nombre || '' }, { h: 'Supervisor', t: 1, v: q => (tienda(q.id) || {}).supervisor },
    { h: 'Checks', v: q => q.d }, { h: 'Errores', v: q => q.e, r: q => `<b>${q.e}</b>` }, { h: '% con error', v: q => q.e / q.d * 100, r: q => f1(q.e / q.d * 100) + '%' }, { h: 'Con venta', v: q => q.j }, { h: 'Sin venta', v: q => q.e - q.j },
    { h: 'Error más frecuente', t: 1, v: q => errNom(q.top), r: q => pillx((ERRI[q.top] || '') + ' ' + errNom(q.top), NOJUST.includes(q.top) ? 'r' : 'a') },
    ...ERR_TIPOS.map(k => ({ h: (ERRI[k] || '') + ' ' + errNom(k), v: q => q.tipos[k] || 0, r: q => q.tipos[k] ? `<b>${q.tipos[k]}</b>` : '' })), { h: 'Cómo corregirlo (error más frecuente)', t: 1, v: q => ERRFIX[q.top] || '', w: 360 }];
  h += sect('Errores por promotor', '🧍') + tbl('t-err-per', cols, lista, { fix: 2, search: 1, csv: 1, png: 1, file: 'errores_check_periodo', titulo: 'Errores de check por promotor · ' + fdate(r.desde) + ' al ' + fdate(r.hasta), sort: 5, dir: -1, maxh: '60vh', lim: 500 });
  ERR_CTX = { errF, r };
  return h;
}
let ERR_CTX = null;
function erroresCsv() {
  if (!ERR_CTX) return; const xs = ERR_CTX.errF, r = ERR_CTX.r;
  finBajar('errores_check_' + r.desde + (r.desde === r.hasta ? '' : '_a_' + r.hasta) + '.csv', [['fecha', 'usuario', 'promotor', 'idpdv', 'tienda', 'supervisor', 'gerente', 'error', 'ventas', 'justifica', 'como_corregirlo'],
    ...xs.map(x => { const t = tienda(x.idpdv) || {}; return [x.fecha, x.usuario, x.nombre, x.idpdv, t.nombre, t.supervisor, t.gerente, errNom(x.estatus_check), x.registros, justTxt(x), ERRFIX[x.estatus_check] || '']; })]);
}

/* justificación: RH la solicita y nómina la aprueba (Nómina > Justificaciones) */
function justBtn(x) {
  const js = NM.justMap && NM.justMap.get(x.usuario + '|' + x.fecha);
  if (js) return `<div data-nocap>${pillx('📝 Justificación ' + js.toLowerCase(), js === 'Aprobada' ? 'g' : 'a')}</div>`;
  return can('justificaciones', 'crear') ? `<div data-nocap><button class="btn sm" onclick="justSolicitar('${x.usuario}','${x.fecha}','${x.estatus_check}','${String(x.nombre).replace(/[^\p{L} .-]/gu, '')}')">📝 Solicitar justificación</button></div>` : '';
}

/* ---- promotores que no cerraron su check ---- */
function abiertosHTML(r, prim) {
  const ab = prim.filter(x => x.estatus_check === 'Abierto'), unDia = r.desde === r.hasta, hoy = unDia && r.hasta === HOY, MAXC = 200, sup = x => (tienda(x.idpdv) || {}).supervisor || 'Sin supervisor';
  const titulo = 'Checks sin cerrar · ' + fdate(r.desde) + (unDia ? '' : ' al ' + fdate(r.hasta));
  let h = `<div class="kpis">${kp('Checks sin cerrar', fmt(ab.length), `${fdate(r.desde)}${unDia ? '' : ' – ' + fdate(r.hasta)}`, ab.length ? C.am : C.gr, null, '🟦')}${kp('Promotores', fmt(new Set(ab.map(x => x.usuario)).size), 'con al menos un check abierto', null, null, '🧍')}${kp('Con venta', fmt(ab.filter(x => x.registros > 0).length), 'trabajaron pero no cerraron', null, null, '💸')}${kp('% de los checks', pc1(ab.length, prim.length), 'abiertos sobre los evaluados', null, null, '📉')}</div>`;
  const vis = ab.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, MAXC);
  h += sect('Recordatorio: cerrar el check al terminar', '🟦') + `<div class="tools" data-nocap><button class="btn sm" onclick="capturaDescargar($('ab-dia'),'${titulo}',subFiltros(),'checks_sin_cerrar')">📸 Imagen para WhatsApp</button><button class="btn sm" onclick="capturaCopiar($('ab-dia'),'${titulo}',subFiltros())">📋 Copiar imagen</button><button class="btn sm" onclick="abiertosCsv()">⬇ CSV</button>
    <span class="muted">${hoy ? 'Hoy todavía puede estar laborando: úsalo al cierre del día.' : unDia ? 'Día anterior: ya debieron cerrarlo.' : 'Varios días: cada tarjeta trae su fecha.'}${ab.length > MAXC ? ` Mostrando los ${MAXC} más recientes de ${fmt(ab.length)}; el CSV trae todos.` : ''}</span></div>`;
  const por = new Map(); vis.forEach(x => { const k = sup(x); if (!por.has(k)) por.set(k, []); por.get(k).push(x); });
  h += `<div id="ab-dia" class="err-dia">${vis.length ? [...por].sort((a, b) => a[0].localeCompare(b[0], 'es')).map(([s, xs]) => `<div class="err-sup"><h4>🧭 ${esc(s)} <small>${xs.length} sin cerrar</small></h4>${xs.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es') || b.fecha.localeCompare(a.fecha)).map(x => {
    const t = tienda(x.idpdv) || {};
    return `<div class="err-card"><div class="err-h"><b>${esc(x.nombre)}</b><small>${esc(x.usuario)} · ${esc(t.nombre || 'IDPDV ' + x.idpdv)}${unDia ? '' : ' · ' + fdate(x.fecha)}</small></div><div>${pillx('🟦 Check abierto', 'b')} <small class="muted">entrada ${hh(x.hora_in)}${x.registros ? ' · ' + x.registros + ' venta' + (x.registros === 1 ? '' : 's') : ''}</small></div><div class="err-fix">💡 Recordarle cerrar su check de salida al terminar la jornada. Si ya salió y no lo cerró, pedirle el cierre al supervisor para no perder el día.</div></div>`;
  }).join('')}</div>`).join('') : '<div class="card empty"><img src="' + img('triunfo') + '" alt="">Nadie dejó checks sin cerrar en este periodo.</div>'}</div>`;
  const pu = new Map(); ab.forEach(x => { const g = pu.get(x.usuario) || { u: x.usuario, n: x.nombre, id: x.idpdv, d: 0 }; g.d++; g.id = x.idpdv; pu.set(x.usuario, g); });
  TB = {};
  h += sect('Promotores con más checks sin cerrar', '🧍') + tbl('t-ab-per', [{ h: 'Usuario', t: 1, v: q => q.u, w: 112 }, { h: 'Promotor', t: 1, v: q => q.n, w: 230, r: q => `<b>${esc(q.n)}</b>` }, { h: 'Tienda (último)', t: 1, v: q => (tienda(q.id) || {}).nombre || '' }, { h: 'Supervisor', t: 1, v: q => (tienda(q.id) || {}).supervisor }, { h: 'Días sin cerrar', v: q => q.d, r: q => `<b>${q.d}</b>` }],
    [...pu.values()], { fix: 2, search: 1, csv: 1, png: 1, file: 'checks_sin_cerrar_por_promotor', titulo: 'Checks sin cerrar por promotor · ' + fdate(r.desde) + ' al ' + fdate(r.hasta), sort: 4, dir: -1, maxh: '50vh', lim: 500 });
  ERR_AB = { ab, r };
  return h;
}
let ERR_AB = null;
function abiertosCsv() {
  if (!ERR_AB) return; const r = ERR_AB.r;
  finBajar('checks_sin_cerrar_' + r.desde + (r.desde === r.hasta ? '' : '_a_' + r.hasta) + '.csv', [['fecha', 'usuario', 'promotor', 'idpdv', 'tienda', 'supervisor', 'gerente', 'entrada', 'ventas'],
    ...ERR_AB.ab.map(x => { const t = tienda(x.idpdv) || {}; return [x.fecha, x.usuario, x.nombre, x.idpdv, t.nombre, t.supervisor, t.gerente, hh(x.hora_in), x.registros]; })]);
}
