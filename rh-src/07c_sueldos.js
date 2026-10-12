/* ====================================================================== SUELDOS Y DATOS BANCARIOS · AUDITORÍA ======================================================================
   Sueldos: historial por colaborador; solo administrador, analista y nómina los cambian (función cambiar_sueldo en la base).
   Datos bancarios: administrador, analista y nómina los ven completos; RH los captura una vez y los ve enmascarados (••••1234), sin poder cambiarlos.
   Los permisos reales los aplica la base de datos (RLS y funciones); aquí solo se muestra u oculta lo que corresponde.
   Auditoría: quién cambió qué y cuándo (los valores de datos bancarios y personales no se guardan, solo el nombre del campo). */
const SB = { sel: null, res: [], tm: null, su: [], ba: null };
const dinero = n => n == null || n === '' ? '—' : '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

Real.sueldosDe = async function (u) { const { data, error } = await sb.from('sueldos_historial').select('*').eq('usuario_fieldwy', u).order('vigente_desde', { ascending: false }); if (error) throw error; return data || []; };
Real.bancariosDe = async function (u) {
  if (can('datos_bancarios', 'ver')) { const { data, error } = await sb.from('datos_bancarios').select('*').eq('usuario_fieldwy', u).maybeSingle(); if (error) throw error; return { completo: true, d: data }; }
  const { data, error } = await sb.rpc('bancarios_enmascarados', { p_usuario: u }); if (error) throw new Error(error.message);
  return { completo: false, d: (data || [])[0] || null };
};
Real.guardarBancarios = async function (u, b) {
  const { error } = await sb.rpc('guardar_bancarios', { p_usuario: u, p_banco: b.banco || null, p_titular: b.titular || null, p_clabe: b.clabe || null, p_cuenta: b.cuenta || null, p_cuenta2: b.cuenta2 || null, p_tarjeta: b.tarjeta || null });
  if (error) throw new Error(error.message);
};
Real.cambiarSueldo = async function (u, d) {
  const { error } = await sb.rpc('cambiar_sueldo', { p_usuario: u, p_monto: d.monto, p_bono: d.bono, p_desde: d.desde, p_motivo: d.motivo || null });
  if (error) throw new Error(error.message);
};
Real.auditoria = async function (tipo) {
  let q = sb.from('auditoria').select('id,tabla,registro,accion,cambios,usuario,en'); q = tipo === 'lecturas' ? q.eq('accion', 'LECTURA') : q.neq('accion', 'LECTURA');
  const { data, error } = await q.order('en', { ascending: false }).limit(500); if (error) throw error;
  const { data: ps } = await sb.from('perfiles').select('id,nombre'); const nom = Object.fromEntries((ps || []).map(p => [p.id, p.nombre]));
  return (data || []).map(r => ({ ...r, quien: r.usuario ? (nom[r.usuario] || 'usuario') : 'sistema' }));
};
Real.historialDe = async function (u) { const { data, error } = await sb.from('relaciones_laborales').select('*').eq('usuario_fieldwy', u).order('numero'); if (error) throw error; return data || []; };
Real.vinculosDe = async function (u) { const { data, error } = await sb.from('vinculos_usuario').select('*').or(`usuario_a.eq.${u},usuario_b.eq.${u}`); if (error) throw error; return data || []; };
Real.vincular = async function (a, b, motivo) { const { error } = await sb.rpc('vincular_usuarios', { p_a: a, p_b: b, p_motivo: motivo || null }); if (error) throw new Error(error.message); };
Real.desvincular = async function (a, b) { const { error } = await sb.rpc('desvincular_usuarios', { p_a: a, p_b: b }); if (error) throw new Error(error.message); };
Demo.historialDe = async () => []; Demo.vinculosDe = async () => []; Demo.vincular = async () => { }; Demo.desvincular = async () => { };
Demo.sueldosDe = async () => []; Demo.bancariosDe = async () => ({ completo: false, d: null }); Demo.guardarBancarios = async () => { }; Demo.cambiarSueldo = async () => { }; Demo.auditoria = async () => [];

/* ----- pantalla ----- */
function vSueldos() {
  $('content').innerHTML = cab('Sueldos y datos bancarios', 'Busca un colaborador para consultar su sueldo y sus datos bancarios. Cada cambio queda en la auditoría.', 'mochila') +
    `<div class="tools"><input id="sb-q" type="search" placeholder="Nombre o usuario Fieldwy (mínimo 3 letras)…" oninput="sbBuscar(this.value)" style="flex:1;min-width:240px"></div><div id="sb-res"></div><div id="sb-det"></div>`;
  if (SB.sel) sbElegir(SB.sel); else setTimeout(() => { const q = $('sb-q'); if (q) q.focus(); }, 50);
}
function sbBuscar(q) {
  clearTimeout(SB.tm); const r = $('sb-res');
  if (limpiaQ(q).length < 3) { r.innerHTML = ''; return; }
  SB.tm = setTimeout(async () => {
    try { SB.res = await API.buscarColab(q); } catch (e) { r.innerHTML = `<div class="warn">${esc(e.message || e)}</div>`; return; }
    r.innerHTML = SB.res.length ? `<div class="bj-list">${SB.res.map((c, i) => { const t = tienda(c.idpdv) || {}; return `<div class="bj-it ${c.estatus === 'Baja' ? 'off' : ''}" onclick="sbElegir(SB.res[${i}])"><b>${esc(c.nombre)}</b><span>${esc(c.usuario_fieldwy)}</span><span>${esc(t.nombre || 'Sin tienda')}</span><span>${esc(c.estatus || '')}</span></div>`; }).join('')}</div>` : '<div class="note">Sin coincidencias.</div>';
  }, 280);
}
async function sbElegir(c) {
  SB.sel = c; const rs = $('sb-res'), det = $('sb-det'); if (!det) return; rs.innerHTML = ''; const q = $('sb-q'); if (q) q.value = '';
  det.innerHTML = '<div class="loading">Cargando…</div>';
  const u = c.usuario_fieldwy, t = tienda(c.idpdv) || {}, errs = [];
  SB.su = []; SB.ba = null;
  if (can('sueldos', 'ver')) { try { SB.su = await API.sueldosDe(u); } catch (e) { errs.push('Sueldos: ' + (e.message || e)); } }
  if (can('datos_bancarios', 'ver') || can('bancarios_vista', 'ver')) { try { SB.ba = await API.bancariosDe(u); } catch (e) { errs.push('Datos bancarios: ' + (e.message || e)); } }
  let hist = [], vin = [];
  if (can('colaboradores', 'ver')) { try { [hist, vin] = await Promise.all([API.historialDe(u), API.vinculosDe(u)]); } catch (e) { errs.push('Historial: ' + (e.message || e)); } }
  const vig = SB.su.find(x => !x.vigente_hasta);
  let h = `<div class="bj-card"><div><b>${esc(c.nombre)}</b><br><small>${esc(u)} · ${esc(c.empresa || 'sin razón social')} · ${esc(c.estatus || '')}</small></div><div><b>${esc(t.nombre || 'Sin tienda')}</b><br><small>${esc([t.cadena, t.estado, t.supervisor].filter(Boolean).join(' · '))}</small></div></div>`;
  h += errs.map(e => `<div class="warn">${esc(e)}</div>`).join('');
  if (hist.length) {
    h += sect('Historial laboral', '🕘') + `<div class="tw"><table class="dt"><thead><tr><th>#</th><th class="t">Tipo</th><th>Ingreso</th><th>Baja</th><th class="t">Estatus</th><th class="t">Calidad del dato</th></tr></thead><tbody>${hist.map(x => `<tr><td>${x.numero}</td><td class="t">${esc(x.tipo)}</td><td>${x.fecha_ingreso ? fdate(x.fecha_ingreso) : '—'}</td><td>${x.fecha_baja ? fdate(x.fecha_baja) : '—'}</td><td class="t">${esc(x.estatus)}</td><td class="t">${x.calidad === 'revisar' ? `<span class="pill" style="background:#fdf1de;color:#8a5a00" title="${esc(x.nota || '')}">Revisar</span> <small>${esc(x.nota || '')}</small>` : 'Correcto' + (x.nota ? ` <small>${esc(x.nota)}</small>` : '')}</td></tr>`).join('')}</tbody></table></div>`;
  }
  if (vin.length || can('usuarios', 'editar')) {
    h += `<div class="note">${vin.length ? 'Misma persona que: ' + vin.map(v => { const o = v.usuario_a === u ? v.usuario_b : v.usuario_a; return `<b>${esc(o)}</b>${can('usuarios', 'editar') ? ` <a href="#" onclick="sbDesvincular('${esc(u)}','${esc(o)}');return false" title="Quitar vínculo">✕</a>` : ''}`; }).join(', ') : 'Sin usuarios vinculados.'}${can('usuarios', 'editar') ? ' <button class="btn sm" onclick="sbVincular()">🔗 Vincular con otro usuario</button>' : ''}</div>`;
  }
  if (can('sueldos', 'ver')) {
    h += sect('Sueldo', '💵') + `<div class="kpis">${kp('Sueldo semanal vigente', vig ? dinero(vig.sueldo_semanal) : '—', vig ? 'desde ' + fdate(vig.vigente_desde) : 'sin sueldo capturado', vig ? C.gr : C.gy, null, '💵')}${kp('Bono fijo', vig ? dinero(vig.bono_fijo) : '—', 'vigente', C.gy, null, '🎯')}</div>`;
    h += `<div class="tools">${can('sueldos', 'editar') ? '<button class="btn primary" onclick="sbSueldoForm()">✏️ Cambiar sueldo</button>' : '<span class="muted">Solo administrador, analista y nómina pueden cambiar sueldos.</span>'}</div>`;
    h += SB.su.length ? `<div class="tw"><table class="dt"><thead><tr><th>Desde</th><th>Hasta</th><th>Sueldo semanal</th><th>Bono fijo</th><th class="t">Motivo</th></tr></thead><tbody>${SB.su.map(x => `<tr><td>${fdate(x.vigente_desde)}</td><td>${x.vigente_hasta ? fdate(x.vigente_hasta) : '<b>vigente</b>'}</td><td>${dinero(x.sueldo_semanal)}</td><td>${dinero(x.bono_fijo)}</td><td class="t">${esc(x.motivo || '')}</td></tr>`).join('')}</tbody></table></div>` : '';
  }
  if (SB.ba !== null || can('datos_bancarios', 'crear')) {
    h += sect('Datos bancarios', '💳'); const b = SB.ba && SB.ba.d;
    if (b) {
      h += `<div class="tw"><table class="dt"><tbody>${[['Banco', b.banco], ['Titular', b.titular], ['CLABE', b.clabe], ['Cuenta', b.cuenta], ['Cuenta 2', b.cuenta2], ['Tarjeta', b.tarjeta]].map(([k, v]) => `<tr><td class="t"><b>${k}</b></td><td class="t">${esc(v || '—')}</td></tr>`).join('')}</tbody></table></div>`;
      h += `<div class="note">${SB.ba.completo ? 'Capturado el ' + fdate((b.capturado_en || '').slice(0, 10)) + '.' : 'Datos enmascarados: sirven para confirmar que ya están capturados. No se pueden ver completos ni modificar con tu usuario.'}</div>`;
      if (can('datos_bancarios', 'editar')) h += '<div class="tools"><button class="btn" onclick="sbBancForm()">✏️ Corregir datos bancarios</button></div>';
    } else {
      h += '<div class="note">Todavía no hay datos bancarios capturados.</div>';
      if (can('datos_bancarios', 'crear')) h += '<div class="tools"><button class="btn primary" onclick="sbBancForm()">➕ Capturar datos bancarios</button></div>';
    }
  }
  if (!can('sueldos', 'ver') && SB.ba === null && !can('datos_bancarios', 'crear')) h += '<div class="warn">Tu usuario no tiene acceso a sueldos ni a datos bancarios.</div>';
  det.innerHTML = h;
}
async function sbVincular() {
  const c = SB.sel, otro = prompt(`Usuario Fieldway de la MISMA persona que ${c.usuario_fieldwy} (por ejemplo el mismo con GB al final):`, ''); if (otro === null) return;
  const o = mayus(otro); if (!o) return; const motivo = prompt('Motivo del vínculo (opcional):', 'Misma persona con otro usuario') || '';
  try { await API.vincular(c.usuario_fieldwy, o, motivo); toast('Usuarios vinculados'); sbElegir(c); } catch (e) { toast('No se pudo vincular: ' + (e.message || e)); }
}
async function sbDesvincular(a, b) { if (!confirm(`¿Quitar el vínculo entre ${a} y ${b}?`)) return; try { await API.desvincular(a, b); toast('Vínculo quitado'); sbElegir(SB.sel); } catch (e) { toast('No se pudo: ' + (e.message || e)); } }
function sbSueldoForm() {
  const c = SB.sel, vig = SB.su.find(x => !x.vigente_hasta), fld = (l, id, ex, v) => `<div class="fld"><label>${l}</label><input id="sb-${id}" ${ex || ''} value="${esc(v == null ? '' : v)}"></div>`;
  $('modal').innerHTML = `<div class="mbox" role="dialog" aria-modal="true"><h3>✏️ Cambiar sueldo</h3><div class="who">${esc(c.nombre)} · ${esc(c.usuario_fieldwy)}</div>
    <div class="row2">${fld('Sueldo semanal ($) *', 'monto', 'type="number" min="0" step="0.01"', vig ? vig.sueldo_semanal : '')}${fld('Bono fijo ($)', 'bono', 'type="number" min="0" step="0.01"', vig ? vig.bono_fijo : '')}</div>
    <div class="row2">${fld('Aplica desde *', 'desde', 'type="date"', HOY)}${fld('Motivo', 'motivo', 'placeholder="Ej. ajuste anual"', '')}</div>
    <div class="note">El sueldo anterior se cierra un día antes de la fecha elegida y queda en el historial.</div><div class="warn" id="sb-warn" hidden></div>
    <div class="mfoot"><button class="btn" onclick="cerrarM()">Cancelar</button><button class="btn primary" id="sb-ok">Guardar</button></div></div>`;
  $('modal').hidden = false; $('modal').onclick = e => { if (e.target.id === 'modal') cerrarM(); };
  $('sb-ok').onclick = async () => {
    const m = $('sb-monto').value, bn = $('sb-bono').value, d = $('sb-desde').value, w = $('sb-warn'), b = $('sb-ok');
    if (m === '' || +m < 0) { w.hidden = false; w.textContent = 'Escribe el sueldo mensual.'; return; } if (!d) { w.hidden = false; w.textContent = 'Elige desde cuándo aplica.'; return; }
    b.disabled = true; b.textContent = 'Guardando…';
    try { await API.cambiarSueldo(c.usuario_fieldwy, { monto: +m, bono: bn === '' ? null : +bn, desde: d, motivo: limpia($('sb-motivo').value) }); cerrarM(); toast('Sueldo actualizado'); sbElegir(c); }
    catch (e) { b.disabled = false; b.textContent = 'Reintentar'; w.hidden = false; w.textContent = e.message || String(e); }
  };
}
function sbBancForm() {
  const c = SB.sel, d = (SB.ba && SB.ba.completo && SB.ba.d) || {}, fld = (l, id, ex, v) => `<div class="fld"><label>${l}</label><input id="sb-${id}" ${ex || ''} value="${esc(v == null ? '' : v)}"></div>`;
  const edit = !!(SB.ba && SB.ba.d);
  $('modal').innerHTML = `<div class="mbox" role="dialog" aria-modal="true"><h3>💳 ${edit ? 'Corregir' : 'Capturar'} datos bancarios</h3><div class="who">${esc(c.nombre)} · ${esc(c.usuario_fieldwy)}</div>
    <div class="row2">${fld('Banco', 'banco', '', d.banco)}${fld('CLABE interbancaria', 'clabe', 'inputmode="numeric" maxlength="18" placeholder="18 dígitos"', d.clabe)}</div>
    <div class="row2">${fld('Cuenta', 'cuenta', 'inputmode="numeric"', d.cuenta)}${fld('Cuenta 2', 'cuenta2', 'inputmode="numeric"', d.cuenta2)}</div>
    <div class="row2">${fld('Tarjeta', 'tarjeta', 'inputmode="numeric" maxlength="16"', d.tarjeta)}${fld('Titular (si es otra persona)', 'titular', '', d.titular)}</div>
    <div class="note">${edit ? 'Los campos que dejes vacíos conservan su valor actual.' : 'Una vez capturados, RH ya no puede modificarlos; solo administración, analista o nómina.'}</div><div class="warn" id="sb-warn" hidden></div>
    <div class="mfoot"><button class="btn" onclick="cerrarM()">Cancelar</button><button class="btn primary" id="sb-ok">Guardar</button></div></div>`;
  $('modal').hidden = false; $('modal').onclick = e => { if (e.target.id === 'modal') cerrarM(); };
  $('sb-ok').onclick = async () => {
    const g = id => limpia($('sb-' + id).value), w = $('sb-warn'), b = $('sb-ok'), clabe = digs(g('clabe'));
    if (clabe && !V.clabe(clabe)) { w.hidden = false; w.textContent = 'La CLABE no es válida (18 dígitos con dígito verificador correcto).'; return; }
    if (!edit && !(g('banco') || clabe || g('cuenta') || g('tarjeta'))) { w.hidden = false; w.textContent = 'Captura al menos el banco y la CLABE o la cuenta.'; return; }
    b.disabled = true; b.textContent = 'Guardando…';
    try { await API.guardarBancarios(c.usuario_fieldwy, { banco: g('banco'), titular: g('titular'), clabe, cuenta: digs(g('cuenta')), cuenta2: digs(g('cuenta2')), tarjeta: digs(g('tarjeta')) }); cerrarM(); toast('Datos bancarios guardados'); if (SB.despues) SB.despues(); else sbElegir(c); }
    catch (e) { b.disabled = false; b.textContent = 'Reintentar'; w.hidden = false; w.textContent = e.message || String(e); }
  };
}

/* ----- auditoría ----- */
let AUD_T = 'cambios';
async function vAuditoria() {
  $('content').innerHTML = cab('Auditoría', 'Últimos 500 cambios en colaboradores, bajas, usuarios, permisos, sueldos y datos sensibles. En datos bancarios y personales solo se guarda qué campo cambió, nunca su valor.', 'mochila') + '<div class="loading">Cargando…</div>';
  let rows; try { rows = await API.auditoria(AUD_T); } catch (e) { $('content').innerHTML += `<div class="warn">No se pudo cargar: ${esc(e.message || e)}</div>`; return; }
  const resumen = c => { if (!c) return ''; const t = Object.entries(c).map(([k, v]) => v && typeof v === 'object' && 'antes' in v ? `${k}: ${String(v.antes)} → ${String(v.despues)}` : (typeof v === 'string' ? `${k} (${v})` : k)).join(' · '); return t.length > 160 ? t.slice(0, 157) + '…' : t; };
  TB = {};
  $('content').innerHTML = cab('Auditoría', AUD_T === 'lecturas' ? 'Últimas 500 veces que alguien abrió datos personales, bancarios o sueldos (cuántos registros y de quién).' : 'Últimos 500 cambios. En datos bancarios y personales solo se guarda qué campo cambió, nunca su valor.', 'mochila') + `<div class="tools" data-nocap>${[['cambios', '✏️ Cambios'], ['lecturas', '👁️ Lecturas de datos sensibles']].map(([k, n]) => `<button class="chip ${AUD_T === k ? 'on' : ''}" onclick="AUD_T='${k}';vAuditoria()">${n}</button>`).join('')}</div>` + tbl('t-aud', [
    { h: 'Fecha y hora', v: r => r.en, r: r => fdate(String(r.en).slice(0, 10)) + ' ' + String(r.en).slice(11, 16), w: 130 }, { h: 'Quién', t: 1, v: r => r.quien }, { h: 'Tabla', t: 1, v: r => r.tabla }, { h: 'Registro', t: 1, v: r => r.registro || '' },
    { h: 'Acción', t: 1, v: r => r.accion }, { h: 'Cambios', t: 1, v: r => resumen(r.cambios), r: r => `<small>${esc(resumen(r.cambios))}</small>` }
  ], rows, { fix: 0, search: 1, csv: 1, file: 'auditoria', titulo: 'Auditoría', sort: 0, dir: -1, maxh: '72vh' });
  drawAll();
}
