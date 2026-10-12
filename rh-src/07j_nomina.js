/* ====================================================================== NÓMINA SEMANAL ======================================================================
   Se paga SEMANA VENCIDA lo que se trabajó (también a quien ya causó baja). Por promotor y día cuenta como pagable un día con check Correcto, justificado por venta/Telefónica
   o con una justificación aprobada por nómina. Pago = sueldo semanal ÷ 7 × días pagables; con 6 o más días pagables se paga el sueldo semanal completo (igual el bono fijo).
   Al cerrar la semana se guarda una foto (lote) que no se puede duplicar: si después se aprueba una justificación, sale un lote de AJUSTE con la diferencia.
   El layout de pago sale del lote. RH solicita justificaciones desde Errores de check; nómina las aprueba aquí. Las reglas las valida también la base de datos. */
const NM = { tab: 'semana', ini: null, emp: '', alertas: false, sueldos: new Map(), just: [], lotes: [], calc: null };
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
Real.nomSueldos = async function () { const r = await todo(() => sb.from('sueldos_historial').select('usuario_fieldwy,sueldo_semanal,bono_fijo,vigente_desde,vigente_hasta')); return r; };
Real.nomJust = async function () { return todo(() => sb.from('nomina_justificaciones').select('*,colaboradores(nombre,idpdv)').order('solicitada_en', { ascending: false })); };
Real.nomLotes = async function () { const { data, error } = await sb.from('nomina_lotes').select('*').order('id', { ascending: false }).limit(60); if (error) throw error; return data || []; };
Real.nomPagos = async function (lote) { const { data, error } = await sb.from('nomina_pagos').select('*').eq('lote_id', lote).order('empresa').order('nombre'); if (error) throw error; return data || []; };
Real.nomColab = async function (us) { let o = []; for (const c of chunk(us, 150)) { const { data } = await sb.from('colaboradores').select('usuario_fieldwy,nombre,empresa,estatus,idpdv').in('usuario_fieldwy', c); o = o.concat(data || []); } return o; };
Real.nomBanc = async function (us) { let o = []; for (const c of chunk(us, 150)) { const { data } = await sb.from('datos_bancarios').select('usuario_fieldwy,banco,titular,clabe,cuenta,tarjeta').in('usuario_fieldwy', c); o = o.concat(data || []); } return o; };
Real.solJust = async function (a) { return Real.finRpc('solicitar_justificacion', a); };
Real.resJust = async function (id, ap, nota) { return Real.finRpc('resolver_justificacion', { p_id: id, p_aprobar: ap, p_nota: nota || null }); };
Real.nomCerrar = async function (sem, ini, filas, nota) { return Real.finRpc('nomina_cerrar_semana', { p_semana: sem, p_ini: ini, p_filas: filas, p_nota: nota || null }); };
Real.nomPagado = async function (id, f, ref) { return Real.finRpc('nomina_marcar_pagado', { p_lote: id, p_fecha: f, p_referencia: ref }); };
Demo.nomSueldos = async () => []; Demo.nomJust = async () => []; Demo.nomLotes = async () => []; Demo.nomPagos = async () => []; Demo.nomColab = async us => us.map(u => ({ usuario_fieldwy: u, nombre: u, empresa: 'Benber SS', estatus: 'Activo' })); Demo.nomBanc = async () => [];
Demo.solJust = async () => 1; Demo.resJust = async () => { }; Demo.nomCerrar = async () => 1; Demo.nomPagado = async () => { };

const NM_DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'], NM_VALIDO = ['Cumple', 'Cumple Productividad', 'Cumple Telefonica'];
const mon = n => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pagoSemana = (s, n) => Math.round((n >= 6 ? s : s * n / 7) * 100) / 100;
function sueldoVig(u, ini) { const fin = addD(ini, 6); const l = (NM.sueldos.get(u) || []).filter(x => x.vigente_desde <= fin && (!x.vigente_hasta || x.vigente_hasta >= ini)).sort((a, b) => b.vigente_desde.localeCompare(a.vigente_desde)); return l[0] || null; }

async function nominaCargar() {
  const [su, ju, lo] = await Promise.all([API.nomSueldos(), API.nomJust(), API.nomLotes()]);
  NM.sueldos = new Map(); su.forEach(x => { if (!NM.sueldos.has(x.usuario_fieldwy)) NM.sueldos.set(x.usuario_fieldwy, []); NM.sueldos.get(x.usuario_fieldwy).push(x); }); NM.just = ju; NM.lotes = lo;
}
async function nominaCalcular(ini) {
  const fin = addD(ini, 6), rows = (await checksRango(ini, fin)).filter(x => x.estatus_final !== 'Otro Check'), por = new Map();
  rows.forEach(r => { if (!por.has(r.usuario)) por.set(r.usuario, { usuario: r.usuario, nombre: r.nombre, rows: [] }); por.get(r.usuario).rows.push(r); });
  const jsem = NM.just.filter(j => j.fecha >= ini && j.fecha <= fin && j.estado !== 'Rechazada');
  jsem.filter(j => j.estado === 'Aprobada').forEach(j => { if (!por.has(j.usuario_fieldwy)) por.set(j.usuario_fieldwy, { usuario: j.usuario_fieldwy, nombre: (j.colaboradores || {}).nombre || j.usuario_fieldwy, rows: [] }); });
  const us = [...por.keys()], colab = new Map((await API.nomColab(us)).map(c => [c.usuario_fieldwy, c]));
  const out = [...por.values()].map(p => {
    const dias = [], det = []; let ok = 0, jv = 0, jn = 0, er = 0, ab = 0;
    for (let d = 0; d < 7; d++) {
      const f = addD(ini, d), rs = p.rows.filter(r => r.fecha === f), apr = jsem.some(j => j.usuario_fieldwy === p.usuario && j.fecha === f && j.estado === 'Aprobada');
      let c = '';
      if (rs.some(r => r.estatus_final === 'Cumple')) { c = 'ok'; ok++; } else if (rs.some(r => r.estatus_final === 'Cumple Productividad' || r.estatus_final === 'Cumple Telefonica')) { c = 'jv'; jv++; } else if (apr) { c = 'jn'; jn++; }
      else if (rs.some(r => esErr(r) || r.estatus_final === 'No Cumple')) { c = 'er'; er++; } else if (rs.length) { c = 'ab'; ab++; }
      dias.push(c === 'ok' || c === 'jv' || c === 'jn' ? 1 : 0); det.push(c);
    }
    const n = dias.reduce((a, b) => a + b, 0), sv = sueldoVig(p.usuario, ini), co = colab.get(p.usuario) || {};
    const s = sv ? +sv.sueldo_semanal : null, b = sv ? +(sv.bono_fijo || 0) : 0, importe = s == null ? 0 : pagoSemana(s, n), bono = pagoSemana(b, n);
    const pend = NM.just.some(j => j.usuario_fieldwy === p.usuario && j.estado === 'Solicitada' && j.fecha >= ini && j.fecha <= fin);
    return { usuario: p.usuario, nombre: co.nombre || p.nombre, empresa: co.empresa || '', estatus: co.estatus || '', idpdv: co.idpdv, dias, det, n, ok, jv, jn, er, ab, conCheck: new Set(p.rows.map(r => r.fecha)).size, s, b, importe, bono, total: importe + bono, pend };
  }).filter(r => r.conCheck || r.n);
  const bn = new Map((await API.nomBanc(out.filter(r => r.n).map(r => r.usuario))).map(x => [x.usuario_fieldwy, x]));
  out.forEach(r => { r.banc = bn.get(r.usuario) || {}; });
  return out.sort((a, b) => a.empresa.localeCompare(b.empresa, 'es') || a.nombre.localeCompare(b.nombre, 'es'));
}
const nmAlertas = r => [r.s == null && r.n > 0 && 'Sin sueldo', r.n > 0 && !r.banc.clabe && 'Sin CLABE', r.estatus === 'Baja' && 'Baja', r.pend && 'Justificación pendiente'].filter(Boolean);

async function vNomina() {
  await conReporte('Nómina', 'pulgares', async () => {
    await nominaCargar();
    const W = ventana().slice(-12).reverse(); if (!NM.ini || !W.some(w => w.ini === NM.ini)) NM.ini = (W.find(w => addD(w.ini, 6) < HOY) || W[0]).ini;
    const ini = NM.ini, venc = addD(ini, 6) < HOY, w = W.find(x => x.ini === ini) || {};
    let h = cab('Nómina', 'Pago por check válido de la semana vencida: sueldo semanal ÷ 7 por cada día pagable (con 6 o más se paga el sueldo semanal completo), incluso a quien ya causó baja. Cierra la semana para generar el lote y el layout de pago.', 'pulgares');
    const pendJ = NM.just.filter(j => j.estado === 'Solicitada').length;
    h += `<div class="tools" data-nocap>${[['semana', '🧮 Semana'], ['just', '📝 Justificaciones (' + pendJ + ')'], ['lotes', '📦 Lotes y layout (' + NM.lotes.length + ')']].map(([k, n]) => `<button class="chip ${NM.tab === k ? 'on' : ''}" onclick="NM.tab='${k}';vNomina()">${n}</button>`).join('')}${can('sueldos', 'ver') ? '<button class="btn sm" onclick="ir(\'sueldos\')">💳 Sueldos y bancarios ›</button>' : ''}</div>`;
    TB = {};
    if (NM.tab === 'just') h += nomJustHTML();
    else if (NM.tab === 'lotes') h += nomLotesHTML();
    else {
      const calc = await nominaCalcular(ini); NM.calc = calc;
      const emps = [...new Set(calc.map(r => r.empresa).filter(Boolean))].sort(), vis = calc.filter(r => (!NM.emp || r.empresa === NM.emp) && (!NM.alertas || nmAlertas(r).length));
      const tot = vis.reduce((a, r) => a + r.total, 0), sinS = calc.filter(r => r.s == null && r.n).length, sinC = calc.filter(r => r.n && !r.banc.clabe).length;
      h += `<div class="tools" data-nocap><span>Semana:</span><select onchange="NM.ini=this.value;vNomina()">${W.map(x => `<option value="${x.ini}" ${x.ini === ini ? 'selected' : ''}>${esc(x.w)} · ${fdate(x.ini)} al ${fdate(addD(x.ini, 6))}${addD(x.ini, 6) >= HOY ? ' (en curso)' : ''}</option>`).join('')}</select>
        <span>Razón social:</span><select onchange="NM.emp=this.value;vNomina()"><option value="">Todas</option>${emps.map(e => `<option ${NM.emp === e ? 'selected' : ''}>${esc(e)}</option>`).join('')}</select><button class="chip ${NM.alertas ? 'on' : ''}" onclick="NM.alertas=!NM.alertas;vNomina()">⚠️ Solo con alertas</button>
        <button class="btn sm" onclick="nomPrevia()">⬇ Layout de vista previa</button>${can('nomina', 'editar') ? `<button class="btn primary" ${venc ? '' : 'disabled title="La semana todavía no termina"'} onclick="nomCerrar()">📦 Cerrar semana y generar lote</button>` : ''}</div>`;
      h += `<div class="kpis">${kp('Promotores con pago', fmt(vis.filter(r => r.n).length), esc(w.w || ''), null, null, '🧍')}${kp('Total a pagar', mon(tot), 'con los filtros elegidos', C.gr, null, '💵')}${kp('Sin sueldo cargado', fmt(sinS), 'no se pueden pagar', sinS ? C.rd : C.gr, null, '❗')}${kp('Sin CLABE', fmt(sinC), 'el layout sale sin cuenta', sinC ? C.am : C.gr, null, '🏦')}${kp('Justificaciones pendientes', fmt(pendJ), 'las aprueba nómina', pendJ ? C.am : C.gr, "NM.tab='just';vNomina()", '📝')}</div>`;
      const dc = { ok: '✅', jv: '💸', jn: '🛡️', er: '🔴', ab: '🔵', '': '·' };
      h += `<p class="note">Cada día: ✅ correcto · 💸 justificado por venta o Telefónica · 🛡️ justificado por nómina · 🔴 error sin justificar · 🔵 abierto · · sin check. Solo cuentan los tres primeros.</p>` +
        tbl('t-nom', [{ h: 'Razón social', t: 1, v: r => r.empresa }, { h: 'Usuario', t: 1, v: r => r.usuario, w: 112 }, { h: 'Promotor', t: 1, v: r => r.nombre, w: 220, r: r => `<b>${esc(r.nombre)}</b>` },
          ...NM_DIAS.map((d, i) => ({ h: d, v: r => r.dias[i], r: r => dc[r.det[i]] })), { h: 'Días con check', v: r => r.conCheck }, { h: 'Correctos', v: r => r.ok }, { h: 'Just. venta', v: r => r.jv }, { h: 'Just. nómina', v: r => r.jn }, { h: 'Errores', v: r => r.er, r: r => r.er ? `<span class="cell-red">${r.er}</span>` : '0' }, { h: 'Días a pagar', v: r => r.n, r: r => `<b>${r.n}</b>` },
          { h: 'Sueldo semanal', v: r => r.s || 0, r: r => r.s == null ? '—' : mon(r.s) }, { h: 'Importe', v: r => r.importe, r: r => mon(r.importe) }, { h: 'Bono', v: r => r.bono, r: r => r.bono ? mon(r.bono) : '—' }, { h: 'Total', v: r => r.total, r: r => `<b>${mon(r.total)}</b>` },
          { h: 'Banco', t: 1, v: r => r.banc.banco || '' }, { h: 'CLABE', t: 1, v: r => r.banc.clabe || '' }, { h: 'Alertas', t: 1, v: r => nmAlertas(r).length, r: r => nmAlertas(r).map(a => pillx(a, a === 'Baja' ? 'x' : 'a')).join(' ') }],
          vis, { fix: 3, search: 1, csv: 1, png: 1, file: 'nomina_' + (w.w || ini), titulo: 'Nómina · ' + (w.w || '') + ' · ' + fdate(ini) + ' al ' + fdate(addD(ini, 6)), sort: 2, dir: 1, maxh: '65vh', lim: 800 });
    }
    $('content').innerHTML = h; drawAll();
  });
}

/* ---- layout estándar de pago (CSV) ---- */
const LAYOUT_COLS = ['semana', 'razon_social', 'usuario', 'nombre', 'banco', 'titular', 'clabe', 'cuenta', 'tarjeta', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom', 'dias_pagados', 'sueldo_semanal', 'importe_sueldo', 'bono', 'total_a_pagar', 'concepto', 'lote'];
const layoutFila = (sem, r, lote) => [sem, r.empresa, r.usuario, r.nombre, r.banc.banco, r.banc.titular, r.banc.clabe, r.banc.cuenta, r.banc.tarjeta, ...r.dias, r.n, r.s, r.importe, r.bono, r.total, r.concepto || 'Semana', lote || ''];
function nomPrevia() { const w = ventana().find(x => x.ini === NM.ini) || {}, xs = (NM.calc || []).filter(r => r.n && (!NM.emp || r.empresa === NM.emp)); if (!xs.length) { toast('No hay pagos que exportar'); return; } finBajar('layout_nomina_VISTA_PREVIA_' + (w.w || NM.ini) + '.csv', [LAYOUT_COLS, ...xs.map(r => layoutFila(w.w, r, ''))]); }
async function nomCerrar() {
  const w = ventana().find(x => x.ini === NM.ini) || {}, xs = (NM.calc || []).filter(r => r.n > 0);
  const sinS = xs.filter(r => r.s == null); if (sinS.length && !confirm(`${sinS.length} promotor(es) no tienen sueldo semanal cargado y NO entrarán al lote (${sinS.slice(0, 5).map(r => r.nombre).join(', ')}…). ¿Continuar?`)) return;
  const filas = xs.filter(r => r.s != null).map(r => ({ usuario: r.usuario, dias: r.dias })); if (!filas.length) { toast('No hay nada que pagar en esta semana'); return; }
  const nota = prompt('Nota del lote (opcional)', ''); if (nota === null) return;
  try { const id = await API.nomCerrar(w.w, NM.ini, filas, limpia(nota)); toast('Lote ' + id + ' generado: ya puedes descargar el layout'); NM.tab = 'lotes'; vNomina(); } catch (e) { toast(e.message || e); }
}

/* ---- lotes ---- */
function nomLotesHTML() {
  const edita = can('nomina', 'editar');
  return `<p class="note">Cada lote es la foto de lo pagado de una semana; una persona no se paga dos veces la misma semana. Si luego se aprueba una justificación, al cerrar de nuevo esa semana sale un lote de AJUSTE con la diferencia.</p>` +
    tbl('t-lot', [{ h: 'Lote', v: l => l.id, w: 60 }, { h: 'Semana', t: 1, v: l => l.semana, r: l => `<b>${esc(l.semana)}</b><br><small class="muted">${fdate(l.semana_ini)} al ${fdate(addD(l.semana_ini, 6))}</small>` }, { h: 'Generado', v: l => l.creado_en, r: l => fdate(String(l.creado_en).slice(0, 10)) }, { h: 'Pagos', v: l => l.n }, { h: 'Total', v: l => +l.total, r: l => `<b>${mon(l.total)}</b>` },
      { h: 'Estatus', t: 1, v: l => l.estatus, r: l => l.estatus === 'Pagado' ? pillx('✔ Pagado ' + fdate(l.fecha_pago) + ' · ' + esc(l.referencia || ''), 'g') : pillx('Generado', 'a') }, { h: 'Nota', t: 1, v: l => l.nota || '', w: 200 },
      { h: '', v: () => '', r: l => `<button class="rsv" onclick="nomLayout(${l.id})">⬇ Layout</button>${edita && l.estatus !== 'Pagado' ? ` <button class="rsv" onclick="nomPagar(${l.id})">💵 Marcar pagado</button>` : ''}` }], NM.lotes, { fix: 1, csv: 1, file: 'lotes_nomina', titulo: 'Lotes de nómina', sort: 0, dir: -1, maxh: '65vh' });
}
async function nomLayout(id) {
  const l = NM.lotes.find(x => x.id === id); let ps; try { ps = await API.nomPagos(id); } catch (e) { toast(e.message || e); return; }
  finBajar(`layout_nomina_${l.semana}_lote${id}.csv`, [LAYOUT_COLS, ...ps.map(p => [p.semana, p.empresa, p.usuario_fieldwy, p.nombre, p.banco, p.titular, p.clabe, p.cuenta, p.tarjeta, ...p.dias, p.dias_pagados, p.sueldo_semanal, p.importe, p.bono, p.total, p.concepto, id])]);
}
function nomPagar(id) {
  $('modal').innerHTML = `<div class="mbox" style="width:min(460px,96vw)" role="dialog" aria-modal="true"><h3>💵 Marcar lote pagado</h3><div class="note">Se marca una sola vez y no se puede deshacer.</div><div class="fld"><label>Fecha de pago</label><input id="np-f" type="date" max="${HOY}" value="${HOY}"></div><div class="fld"><label>Referencia del pago</label><input id="np-r" placeholder="Folio de dispersión, SPEI…"></div>
    <div class="mfoot"><button class="btn" onclick="cerrarM()">Cancelar</button><button class="btn primary" onclick="nomPagarOk(${id})">Confirmar pago</button></div></div>`; $('modal').hidden = false;
}
async function nomPagarOk(id) { try { await API.nomPagado(id, $('np-f').value, limpia($('np-r').value)); toast('Lote marcado como pagado'); cerrarM(); vNomina(); } catch (e) { toast(e.message || e); } }

/* ---- justificaciones ---- */
function nomJustHTML() {
  const edita = can('nomina', 'editar'), est = NM.jest || 'Solicitada', xs = NM.just.filter(j => !est || j.estado === est);
  return `<div class="tools" data-nocap>${can('justificaciones', 'crear') ? '<button class="btn primary" onclick="justNueva()">➕ Nueva justificación</button>' : ''}${['Solicitada', 'Aprobada', 'Rechazada', ''].map(e => `<button class="chip ${est === e ? 'on' : ''}" onclick="NM.jest='${e}';vNomina()">${e || 'Todas'} (${e ? NM.just.filter(j => j.estado === e).length : NM.just.length})</button>`).join('')}<span class="muted">RH las solicita desde Detalle de checks › Errores de check; aquí se aprueban para que el día cuente como pagable.</span></div>` +
    tbl('t-jus', [{ h: 'Día', v: j => j.fecha, r: j => fdate(j.fecha) }, { h: 'Usuario', t: 1, v: j => j.usuario_fieldwy }, { h: 'Promotor', t: 1, v: j => (j.colaboradores || {}).nombre || '', w: 210, r: j => `<b>${esc((j.colaboradores || {}).nombre || j.usuario_fieldwy)}</b>` }, { h: 'Error', t: 1, v: j => ERRN[j.error] || j.error || '' , r: j => esc(ERRN[j.error] || j.error || '—') },
      { h: 'Motivo de RH', t: 1, v: j => j.motivo, w: 300 }, { h: 'Estatus', t: 1, v: j => j.estado, r: j => pillx(j.estado, j.estado === 'Aprobada' ? 'g' : j.estado === 'Rechazada' ? 'r' : 'a') }, { h: 'Resolución', t: 1, v: j => j.nota_resolucion || '', w: 200 },
      { h: '', v: () => '', r: j => edita && j.estado === 'Solicitada' ? `<button class="rsv" onclick="nomResolver(${j.id},true)">✔ Aprobar</button> <button class="rsv" onclick="nomResolver(${j.id},false)">✖ Rechazar</button>` : '' }], xs, { fix: 3, search: 1, csv: 1, png: 1, file: 'justificaciones', titulo: 'Justificaciones', sort: 0, dir: -1, maxh: '65vh' });
}
async function nomResolver(id, ap) {
  let nota = null; if (!ap) { nota = prompt('¿Por qué se rechaza? (mínimo 5 caracteres)', ''); if (nota === null) return; if (limpia(nota).length < 5) { toast('Escribe el motivo'); return; } } else nota = prompt('Nota de aprobación (opcional)', '') || null;
  try { await API.resJust(id, ap, nota && limpia(nota)); toast(ap ? 'Justificación aprobada' : 'Justificación rechazada'); vNomina(); } catch (e) { toast(e.message || e); }
}
/* solicitud desde Errores de check */
async function cargarJustSolicitadas() { try { const j = await API.nomJust(); NM.justMap = new Map(j.filter(x => x.estado !== 'Rechazada').map(x => [x.usuario_fieldwy + '|' + x.fecha, x.estado])); } catch (e) { NM.justMap = new Map(); } }
function justSolicitar(usuario, fecha, error, nombre) {
  $('modal').innerHTML = `<div class="mbox" style="width:min(520px,96vw)" role="dialog" aria-modal="true"><h3>📝 Solicitar justificación</h3><div class="who">${esc(nombre)} · ${esc(usuario)} · ${fdate(fecha)}<br>${esc(ERRN[error] || error || '')}</div>
    <div class="note">Nómina revisa la solicitud: si la aprueba, ese día cuenta como pagable aunque el check tenga error o no tenga venta.</div><div class="fld"><label>Motivo (mínimo 10 caracteres)</label><textarea id="js-m" placeholder="Qué pasó, evidencia, quién lo confirma…"></textarea></div>
    <div class="warn" id="js-w" hidden></div><div class="mfoot"><button class="btn" onclick="cerrarM()">Cancelar</button><button class="btn primary" id="js-ok">Enviar a nómina</button></div></div>`; $('modal').hidden = false;
  $('js-ok').onclick = async () => { try { await API.solJust({ p_usuario: usuario, p_fecha: fecha, p_error: error, p_motivo: limpia($('js-m').value) }); cerrarM(); toast('Justificación solicitada: nómina la revisará'); await cargarJustSolicitadas(); if (S.view === 'checks') vChecks(); } catch (e) { $('js-w').hidden = false; $('js-w').textContent = e.message || e; } };
}

/* ---- capturar una justificación de cualquier persona del HC ---- */
const JN = { res: [], sel: null, tm: null };
function justNueva() {
  JN.sel = null;
  $('modal').innerHTML = `<div class="mbox" style="width:min(560px,96vw)" role="dialog" aria-modal="true"><h3>📝 Nueva justificación</h3>
    <div class="fld"><label>Colaborador (usuario Fieldway o nombre)</label><input id="jn-q" autocomplete="off" placeholder="Escribe al menos 3 letras…" oninput="justBuscar(this.value)"></div><div id="jn-res"></div><div id="jn-sel"></div>
    <div id="jn-resto" hidden><div class="row2"><div class="fld"><label>Día a justificar</label><input type="date" id="jn-f" value="${HOY}" max="${HOY}" min="${addD(HOY, -60)}"></div><div class="fld"><label>Qué pasó</label><select id="jn-e"><option value="">Sin check / otro</option>${Object.keys(ERRN).filter(k => k !== 'Cumple').map(k => `<option value="${esc(k)}">${esc((ERRI[k] || '') + ' ' + ERRN[k])}</option>`).join('')}</select></div></div>
      <div class="fld"><label>Motivo (mínimo 10 caracteres)</label><textarea id="jn-m" placeholder="Qué pasó, evidencia, quién lo confirma…"></textarea></div></div>
    <div class="warn" id="jn-w" hidden></div><div class="mfoot"><button class="btn" onclick="cerrarM()">Cancelar</button><button class="btn primary" id="jn-ok" disabled>Enviar a nómina</button></div></div>`;
  $('modal').hidden = false; $('modal').onclick = e => { if (e.target.id === 'modal') cerrarM(); }; setTimeout(() => $('jn-q').focus(), 50);
  $('jn-ok').onclick = async () => { const c = JN.sel; if (!c) return; try { await API.solJust({ p_usuario: c.usuario_fieldwy, p_fecha: $('jn-f').value, p_error: $('jn-e').value || null, p_motivo: limpia($('jn-m').value) }); cerrarM(); toast('Justificación enviada a nómina'); vNomina(); } catch (e) { $('jn-w').hidden = false; $('jn-w').textContent = e.message || e; } };
}
function justBuscar(q) {
  clearTimeout(JN.tm); const r = $('jn-res'); if (limpiaQ(q).length < 3) { r.innerHTML = ''; return; }
  JN.tm = setTimeout(async () => {
    try { JN.res = await API.buscarColab(q); } catch (e) { r.innerHTML = `<div class="warn">${esc(e.message || e)}</div>`; return; }
    r.innerHTML = JN.res.length ? `<div class="bj-list">${JN.res.map((c, i) => { const t = tienda(c.idpdv) || {}; return `<div class="bj-it" onclick="justElegir(JN.res[${i}])"><b>${esc(c.nombre)}</b><span>${esc(c.usuario_fieldwy)}</span><span>${esc(t.nombre || 'Sin tienda')}</span><span>${c.estatus === 'Baja' ? 'Baja' : ''}</span></div>`; }).join('')}</div>` : '<p class="muted">Sin coincidencias.</p>';
  }, 280);
}
function justElegir(c) { JN.sel = c; const t = tienda(c.idpdv) || {}; $('jn-res').innerHTML = ''; $('jn-q').value = ''; $('jn-sel').innerHTML = `<div class="bj-card"><div><b>${esc(c.nombre)}</b><br><small>${esc(c.usuario_fieldwy)}</small></div><div><b>${esc(t.nombre || 'Sin tienda')}</b><br><small>${esc([t.cadena, t.estado, t.supervisor].filter(Boolean).join(' · '))}</small></div><div></div></div>`; $('jn-resto').hidden = false; $('jn-ok').disabled = false; }
