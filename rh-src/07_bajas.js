/* ====================================================================== BAJAS Y ENCUESTA DE SALIDA ======================================================================
   Formulario único de baja (reemplaza el de Google): busca al colaborador, captura fecha, motivo, adeudos y, si RH quiere, la encuesta de salida.
   Al guardar: alimenta `bajas` (reporte de ingresos y bajas y HC), `movimientos`, marca al colaborador como Baja y cierra su alerta abierta. */
const BJ = { per: '90', mot: '', tipo: '', enc: '', lista: null, sel: null, res: [], tm: null };
const FINQ = ['Sin iniciar', 'Calculado', 'Validado RH', 'Documento generado', 'Firmado', 'Autorizado', 'Pagado'];
const ENC_OPC = {
  cuando: ['Desde que ingresé', 'Menos de 1 mes', 'De 1 a 3 meses', 'Más de 3 meses', 'Fue una decisión repentina'],
  gusto: ['Sí', 'Más o menos', 'No'], derechos: ['Sí', 'Parcialmente', 'No'], acoso: ['No', 'Sí', 'Prefiero no decir'],
  visita: ['Nunca', 'Menos de una vez al mes', 'Una vez al mes', 'Cada 15 días', 'Cada semana', 'Más de una vez por semana'],
  valora: ['Excelente', 'Buena', 'Regular', 'Mala', 'Muy mala'], apoyo: ['Siempre', 'Casi siempre', 'A veces', 'Nunca'], queja: ['No', 'Sí']
};
const selX = (id, ops, ph) => `<select id="${id}"><option value="">${ph || '— elige —'}</option>${ops.map(o => `<option>${esc(o)}</option>`).join('')}</select>`;
const limpiaQ = q => String(q || '').replace(/[%,()*"\\]/g, ' ').trim();
const tipoMotivo = m => ((S.cat.motBaja || []).find(x => x.motivo === m) || {}).tipo || '';

/* ----- API real ----- */
Real.buscarColab = async function (q) {
  q = limpiaQ(q); if (q.length < 3) return [];
  const { data, error } = await sb.from('colaboradores').select('usuario_fieldwy,nombre,empresa,idpdv,estatus,fecha_ingreso').or(`nombre.ilike.%${q}%,usuario_fieldwy.ilike.%${q}%`).order('estatus').limit(15);
  if (error) throw error; return data || [];
};
Real.bajasPrevias = async function (usuario) {
  const { data } = await sb.from('bajas').select('id,fecha_baja,motivo').is('anulada_en', null).eq('usuario_fieldwy', usuario).gte('fecha_baja', addD(HOY, -45)); return data || [];
};
Real.bajasLista = async function (desde) {
  let q = () => { let x = sb.from('bajas').select('id,usuario_fieldwy,fecha_baja,ultimo_dia_laborado,motivo,marca_destino,adeudo_monto,adeudo_detalle,finiquito_estatus,idpdv,comentarios,capturado_en,colaboradores(nombre,idpdv,empresa),encuesta_salida(baja_id)').is('anulada_en', null).order('fecha_baja', { ascending: false }); if (desde) x = x.gte('fecha_baja', desde); return x; };
  const r = await todo(q);
  return r.map(b => ({ id: b.id, usuario: b.usuario_fieldwy, nombre: (b.colaboradores || {}).nombre || b.usuario_fieldwy, empresa: (b.colaboradores || {}).empresa, fecha: b.fecha_baja, ultimo: b.ultimo_dia_laborado, motivo: b.motivo, marca: b.marca_destino, adeudo: +b.adeudo_monto || 0, adeudoDet: b.adeudo_detalle, finq: b.finiquito_estatus, idpdv: b.idpdv || (b.colaboradores || {}).idpdv, com: b.comentarios, cap: b.capturado_en, enc: !!(b.encuesta_salida && (Array.isArray(b.encuesta_salida) ? b.encuesta_salida.length : b.encuesta_salida.baja_id)) }));
};
Real.registrarBaja = async function (d) {
  // Baja, movimiento, estatus del colaborador, cierre de alertas y encuesta: una sola transacción en la base.
  const { data, error } = await sb.rpc('registrar_baja', { p_usuario: d.usuario, p_fecha: d.fecha, p_ultimo: d.ultimo || null, p_motivo: d.motivo, p_marca: d.marca || null, p_adeudo: d.adeudo || 0,
    p_adeudo_detalle: d.adeudoDet || null, p_evidencia: d.evidencia || null, p_comentarios: d.comentarios || null, p_idpdv: d.idpdv || null, p_enc: d.enc || null });
  if (error) throw new Error(error.message);
  return data;
};
Real.guardarEncuesta = async function (bajaId, e) {
  const { error } = await sb.from('encuesta_salida').upsert({ baja_id: bajaId, respondida_por: 'rh', ...e }); if (error) throw error;
};
Real.ultimoCheckDe = async function (u) { const { data } = await sb.from('rep_ultimo_check').select('fecha').eq('usuario', u).maybeSingle(); return data ? data.fecha : null; };
Real.subirEvidenciaBaja = async function (u, fecha, file) {
  const p = await docPreparar(file), ext = EXP_MIME[p.mime]; if (p.bytes > 8 * 1024 * 1024) throw new Error('La evidencia pesa más de 8 MB');
  const prep = await Real.finRpc('baja_evidencia_preparar', { p_usuario: u, p_fecha: fecha, p_ext: ext });
  const { error } = await sb.storage.from('bajas-temp').upload(prep.ruta, p.blob, { contentType: p.mime, upsert: false }); if (error) throw new Error('No se pudo subir la evidencia: ' + error.message);
  await Real.finRpc('baja_evidencia_registrar', { p_usuario: u, p_fecha: fecha, p_version: prep.version, p_ruta: prep.ruta, p_nombre: file.name, p_mime: p.mime, p_bytes: p.bytes, p_sha: p.sha });
};
Demo.ultimoCheckDe = async () => addD(HOY, -2); Demo.subirEvidenciaBaja = async () => { };
Real.actualizarFiniquito = async function (id, est) { const { error } = await sb.from('bajas').update({ finiquito_estatus: est }).eq('id', id); if (error) throw error; };
Real.anularBaja = async function (b, motivo) {
  const { error } = await sb.rpc('anular_baja', { p_baja: b.id, p_motivo: motivo }); if (error) throw new Error(error.message);   // queda el rastro (quién, cuándo y por qué) en Auditoría
};

/* ----- encuesta de salida: campos reutilizables ----- */
function encuestaCampos(p) {
  const f = (l, id, ops) => `<div class="fld"><label>${l}</label>${selX(p + id, ops)}</div>`, t = (l, id, ph) => `<div class="fld"><label>${l}</label><input id="${p}${id}" placeholder="${ph || 'Opcional'}"></div>`;
  return `<div class="enc-box"><div class="note">Complemento del motivo de baja: la versión del promotor. Todo es opcional; si el promotor no la contestó, déjala vacía y se puede capturar después desde la lista.</div>
    <div class="row2">${f('¿Desde cuándo había pensado en terminar la relación laboral?', 'cuando', ENC_OPC.cuando)}${t('¿Cuál es la razón principal del término?', 'razon', 'En sus palabras')}</div>
    <div class="row2">${f('¿Le gustó formar parte de Grupo Benber?', 'gusto', ENC_OPC.gusto)}${t('¿Por qué?', 'gustop')}</div>
    <div class="row2">${f('¿Se respetaron sus derechos laborales?', 'der', ENC_OPC.derechos)}${t('¿Por qué?', 'derp')}</div>
    <div class="row2">${f('🔒 ¿Sufrió acoso, violencia de género, racismo, discriminación o violación de derechos humanos?', 'acoso', ENC_OPC.acoso)}${t('🔒 ¿Qué pasó?', 'acosop')}</div>
    <div class="row2">${f('¿Con qué frecuencia lo visitó su supervisor?', 'vis', ENC_OPC.visita)}${f('¿Cómo valora la capacitación y el soporte de su supervisor?', 'val', ENC_OPC.valora)}</div>
    <div class="row2">${f('¿Recibió apoyo de Recursos Humanos en todo momento?', 'apoyo', ENC_OPC.apoyo)}${f('🔒 ¿Quiere interponer una queja?', 'queja', ENC_OPC.queja)}</div>
    <div class="row2">${t('🔒 Colaborador o situación', 'quejas')}${t('🔒 Motivos de la queja', 'quejam')}</div>
    <p class="muted" style="font-size:11px;font-weight:600">🔒 Las respuestas marcadas son confidenciales: solo las ve RH y administración.</p></div>`;
}
function leerEncuesta(p) {
  const v = id => { const x = $(p + id); return x && x.value ? x.value.trim() : null; };
  const e = { desde_cuando_pensaba_terminar: v('cuando'), razon_principal: v('razon'), le_gusto_grupo_benber: v('gusto'), le_gusto_porque: v('gustop'), derechos_respetados: v('der'), derechos_porque: v('derp'), acoso_discriminacion: v('acoso'), acoso_porque: v('acosop'), frecuencia_visita_supervisor: v('vis'), valoracion_supervisor: v('val'), apoyo_rh: v('apoyo'), desea_queja: v('queja') == null ? null : v('queja') === 'Sí', queja_sobre: v('quejas'), queja_motivos: v('quejam') };
  return Object.values(e).some(x => x != null) ? e : null;
}

/* ----- vista ----- */
async function vBajas() {
  $('content').innerHTML = cab('Bajas y encuesta de salida', 'Registra aquí las bajas. Alimentan el reporte de Ingresos y bajas, el HC y la rotación; la encuesta de salida complementa el motivo.', 'saltando') + '<div class="loading">Cargando bajas…</div>';
  const rr = rangoLibre(), desde = rr.todo ? null : rr.desde;
  try { BJ.lista = await API.bajasLista(desde); PF.lista = new Map((await API.perfilesBaja().catch(() => [])).map(p => [p.usuario_fieldwy + '|' + p.fecha_baja, p])); } catch (e) { $('content').innerHTML += `<div class="warn">No se pudieron cargar las bajas: ${esc(e.message || e)}</div>`; return; }
  const ok = b => okT(tienda(b.idpdv) || null) || (!tienda(b.idpdv) && !Object.values(FL).some(Boolean));
  const base = BJ.lista.filter(ok).filter(b => b.fecha <= rr.hasta), tipoDe = b => tipoMotivo(b.motivo) || 'Sin clasificar';
  const rows = base.filter(b => (!BJ.mot || b.motivo === BJ.mot) && (!BJ.tipo || tipoDe(b) === BJ.tipo) && (!BJ.enc || (BJ.enc === 'si' ? b.enc : !b.enc)));
  const vol = base.filter(b => tipoDe(b) === 'Voluntaria').length, inv = base.filter(b => tipoDe(b) === 'Involuntaria').length, conEnc = base.filter(b => b.enc).length, adeudos = base.filter(b => b.adeudo > 0).length, pend = base.filter(b => b.finq !== 'Pagado').length;
  const motivos = [...new Set(base.map(b => b.motivo))].sort();
  let h = cab('Bajas y encuesta de salida', 'Registra aquí las bajas. Alimentan el reporte de Ingresos y bajas, el HC y la rotación; la encuesta de salida complementa el motivo.', 'saltando') + barraFiltros('vBajas');
  h += `<div class="tools"><span class="muted">Periodo: el de la barra de arriba</span><select onchange="BJ.mot=this.value;vBajas()"><option value="">Todos los motivos</option>${motivos.map(m => `<option ${BJ.mot === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select><select onchange="BJ.tipo=this.value;vBajas()"><option value="">Voluntaria e involuntaria</option>${['Voluntaria', 'Involuntaria'].map(m => `<option ${BJ.tipo === m ? 'selected' : ''}>${m}</option>`).join('')}</select><select onchange="BJ.enc=this.value;vBajas()"><option value="">Con y sin encuesta</option><option value="si" ${BJ.enc === 'si' ? 'selected' : ''}>Con encuesta</option><option value="no" ${BJ.enc === 'no' ? 'selected' : ''}>Sin encuesta</option></select>${can('bajas', 'crear') ? '<button class="btn primary" style="margin-left:auto" onclick="bajaNueva()">➕ Registrar baja</button>' : ''}</div>`;
  h += `<div class="kpis">${kp('Bajas', fmt(base.length), 'en el periodo y filtros', C.rd, null, '📤')}${kp('Voluntarias', fmt(vol), pc1(vol, base.length), C.am, null, '🚶')}${kp('Involuntarias', fmt(inv), pc1(inv, base.length), C.dk, null, '⛔')}${kp('Con encuesta', fmt(conEnc), pc1(conEnc, base.length), C.bl, null, '📝')}${kp('Con adeudo', fmt(adeudos), 'monto o detalle por cobrar', C.rd, null, '💸')}${kp('Finiquito pendiente', fmt(pend), 'sin marcar como pagado', C.am, null, '🧾')}</div>`;
  TB = {};
  const puedeFin = can('bajas', 'editar');
  h += sect('Bajas registradas', '🧾') + tbl('t-bj', [
    { h: 'Fecha de baja', v: b => b.fecha, r: b => fdate(b.fecha), w: 96 }, { h: 'Colaborador', t: 1, v: b => b.nombre, w: 230, r: b => `<b>${esc(b.nombre)}</b><br><small class="muted">${esc(b.usuario)}</small>` },
    { h: 'Motivo', t: 1, v: b => b.motivo, r: b => pillx(esc(b.motivo) + (b.marca ? ' → ' + esc(b.marca) : ''), tipoDe(b) === 'Involuntaria' ? 'r' : 'a') }, { h: 'Tipo', t: 1, v: b => tipoDe(b) },
    { h: 'Encuesta', v: b => b.enc ? 1 : 0, r: b => b.enc ? '<span class="pill g">✔ Capturada</span>' : (can('encuesta_salida', 'crear') ? `<button class="rsv" onclick="encuestaDeBaja(${b.id})">Capturar</button>` : '—') },
    { h: 'Finiquito', t: 1, v: b => finqTxt(b), r: b => finqPill(b) },
    { h: 'Recontratable', t: 1, v: b => (PF.lista.get(b.usuario + '|' + b.fecha) || {}).recontratable || '', r: b => { const p = PF.lista.get(b.usuario + '|' + b.fecha); return `${p ? pillx(PF_REC[p.recontratable][1] + ' ' + p.recontratable, PF_REC[p.recontratable][0]) : '<span class="muted">Sin evaluar</span>'} <button class="rsv" onclick="perfilAbrir(${b.id})">Perfil</button>`; } },
    { h: 'Adeudo', v: b => b.adeudo, r: b => b.adeudo ? `<b class="cell-red">$${fmt(b.adeudo)}</b>` : '—' }, { h: 'Tienda', t: 1, v: b => (tienda(b.idpdv) || {}).nombre || '' }, { h: 'Cadena', t: 1, v: b => (tienda(b.idpdv) || {}).cadena }, { h: 'Región', t: 1, v: b => (tienda(b.idpdv) || {}).region },
    { h: 'Gerente', t: 1, v: b => (tienda(b.idpdv) || {}).gerente }, { h: 'Supervisor', t: 1, v: b => (tienda(b.idpdv) || {}).supervisor }, { h: 'Comentarios', t: 1, v: b => b.com || '' },
    ...(can('bajas', 'borrar') ? [{ h: '', v: () => '', r: b => `<button class="rsv" onclick="anularBaja(${b.id})" title="Marca la baja como anulada (queda guardada con su motivo) y deja al colaborador activo">Anular</button>` }] : [])
  ], rows, { fix: 2, search: 1, csv: 1, png: 1, file: 'bajas', titulo: 'Bajas registradas', sort: 0, dir: -1, maxh: '70vh', lim: 500 });
  $('content').innerHTML = h; drawAll();
}
const finqTxt = b => (b.fecha >= '2026-10-10' && !PF.lista.has(b.usuario + '|' + b.fecha)) ? 'Falta evaluar recontratación' : (b.finq || 'Sin iniciar');
const finqPill = b => finqTxt(b) === 'Falta evaluar recontratación' ? `${pillx('Falta evaluar recontratación', 'a')} <button class="rsv" onclick="perfilAbrir(${b.id})">Evaluar</button>` : pillx(esc(finqTxt(b)), b.finq === 'Pagado' ? 'g' : (!b.finq || b.finq === 'Sin iniciar') ? 'x' : 'b');
async function cambiaFinq(id, est) { try { await API.actualizarFiniquito(id, est); const b = BJ.lista.find(x => x.id === id); if (b) b.finq = est; toast('Finiquito: ' + est); } catch (e) { toast('No se pudo guardar: ' + (e.message || e)); } }
async function anularBaja(id) {
  const b = BJ.lista.find(x => x.id === id); if (!b || !confirm(`¿Anular la baja de ${b.nombre} (${fdate(b.fecha)})?\nLa baja queda anulada (se conserva con su motivo) y el colaborador vuelve a quedar activo.`)) return;
  const motivo = prompt('Motivo de la anulación (obligatorio; queda en Auditoría):', ''); if (motivo === null) return; if (limpia(motivo).length < 5) { toast('Escribe el motivo de la anulación (mínimo 5 caracteres)'); return; }
  try { await API.anularBaja(b, limpia(motivo)); MV.loaded = false; R.vivo = false; toast('Baja anulada'); vBajas(); } catch (e) { toast('No se pudo anular: ' + (e.message || e)); }
}

/* ----- captura de una baja ----- */
function bajaNueva(pre) {
  BJ.sel = pre || null; BJ.res = [];
  const vol = (S.cat.motBaja || []).filter(m => m.tipo === 'Voluntaria'), inv = (S.cat.motBaja || []).filter(m => m.tipo !== 'Voluntaria');
  $('modal').innerHTML = `<div class="mbox wide" style="width:min(820px,96vw);max-height:92vh;overflow:auto" role="dialog" aria-modal="true"><h3>📤 Registrar baja</h3>
    <div class="fld"><label>Colaborador (usuario Fieldwy o nombre)</label><input id="bj-q" autocomplete="off" placeholder="Escribe al menos 3 letras…" oninput="bajaBuscar(this.value)"></div><div id="bj-res"></div><div id="bj-sel"></div>
    <div id="bj-resto" hidden>
      <div class="row2"><div class="fld"><label>Fecha de baja</label><input type="date" id="bj-f" value="${HOY}"></div><div class="fld"><label>Último día laborado</label><input type="date" id="bj-u" value="${addD(HOY, -1)}"></div></div>
      <div class="fld"><label>Motivo de baja</label><select id="bj-m"><option value="">— elige el motivo —</option><optgroup label="Voluntaria">${vol.map(m => `<option>${esc(m.motivo)}</option>`).join('')}</optgroup><optgroup label="Involuntaria">${inv.map(m => `<option>${esc(m.motivo)}</option>`).join('')}</optgroup></select></div>
      <div class="fld" id="bj-marca-w" hidden><label>Marca o cadena destino</label><input id="bj-marca" placeholder="Ej. Telcel, Walmart…"></div>
      <div class="row2"><div class="fld"><label>Adeudo con la agencia ($)</label><input type="number" id="bj-ad" min="0" step="0.01" placeholder="0"></div><div class="fld"><label>Detalle del adeudo</label><input id="bj-adt" placeholder="Equipo, uniforme, faltante…"></div></div>
      <div class="fld"><label>Evidencia (foto o PDF, opcional)</label><input type="file" id="bj-ev" accept="image/jpeg,image/png,application/pdf"><small class="muted">Se guarda en el almacén y luego pasa a OneDrive (carpeta Bajas).</small></div>
      <div class="fld"><label>Comentarios</label><textarea id="bj-c"></textarea></div>
      <details class="enc-d"><summary>📝 Capturar encuesta de salida ahora (opcional)</summary>${encuestaCampos('be-')}</details>
      <div id="bj-perfil"></div>
      <div class="warn" id="bj-warn" hidden></div>
    </div>
    <div class="mfoot"><button class="btn" onclick="cerrarM()">Cancelar</button><button class="btn danger" id="bj-ok" disabled>Registrar baja</button></div></div>`;
  $('modal').hidden = false; $('modal').onclick = e => { if (e.target.id === 'modal') cerrarM(); };
  const mm = () => { $('bj-marca-w').hidden = $('bj-m').value !== 'Cambio a marca o cadena'; }; $('bj-m').onchange = mm; mm();
  $('bj-ok').onclick = bajaGuardar;
  if (pre) bajaElegir(pre); else setTimeout(() => $('bj-q').focus(), 50);
}
function bajaBuscar(q) {
  clearTimeout(BJ.tm); const r = $('bj-res');
  if (limpiaQ(q).length < 3) { r.innerHTML = ''; return; }
  BJ.tm = setTimeout(async () => {
    try { BJ.res = await API.buscarColab(q); } catch (e) { r.innerHTML = `<div class="warn">${esc(e.message || e)}</div>`; return; }
    r.innerHTML = BJ.res.length ? `<div class="bj-list">${BJ.res.map((c, i) => { const t = tienda(c.idpdv) || {}; return `<div class="bj-it ${c.estatus === 'Baja' ? 'off' : ''}" onclick="bajaElegir(BJ.res[${i}])"><b>${esc(c.nombre)}</b><span>${esc(c.usuario_fieldwy)}</span><span>${esc(t.nombre || 'Sin tienda')}</span>${c.estatus === 'Baja' ? '<span class="pill r">Ya está de baja</span>' : '<span class="pill g">Activo</span>'}</div>`; }).join('')}</div>` : '<div class="muted" style="padding:8px">Sin resultados. Revisa el usuario o el nombre.</div>';
  }, 280);
}
async function bajaElegir(c) {
  BJ.sel = c; const t = tienda(c.idpdv) || {};
  $('bj-res').innerHTML = ''; $('bj-q').value = '';
  $('bj-sel').innerHTML = `<div class="bj-card"><div><b>${esc(c.nombre)}</b><br><small>${esc(c.usuario_fieldwy)} · ${esc(c.empresa || 'sin razón social')}</small></div><div><b>${esc(t.nombre || 'Sin tienda')}</b><br><small>${esc([t.cadena, t.estado, t.supervisor].filter(Boolean).join(' · '))}</small></div><button class="rsv" onclick="BJ.sel=null;$('bj-sel').innerHTML='';$('bj-resto').hidden=true;$('bj-ok').disabled=true">Cambiar</button></div>`;
  $('bj-resto').hidden = false; $('bj-ok').disabled = false;
  bajaPerfilPanel(c);
  (async () => { let u = c.ultimo || null; try { u = (await API.ultimoCheckDe(c.usuario_fieldwy)) || u; } catch (e) { } if (u && BJ.sel === c) { $('bj-u').value = u; const fl = $('bj-u').parentElement; let hs = fl.querySelector('small'); if (!hs) { hs = document.createElement('small'); hs.className = 'muted'; fl.appendChild(hs); } hs.textContent = 'Sugerido: su último check (' + fdate(u) + ')'; } })();
  const w = $('bj-warn'); w.hidden = true;
  try { const p = await API.bajasPrevias(c.usuario_fieldwy); if (c.estatus === 'Baja' || p.length) { w.hidden = false; w.textContent = c.estatus === 'Baja' ? 'Este colaborador ya aparece como baja.' : ''; if (p.length) w.textContent += ` Ya tiene una baja registrada el ${fdate(p[0].fecha_baja)} (${p[0].motivo}). Si es la misma, no la dupliques.`; } } catch (e) { }
}
async function bajaGuardar() {
  const c = BJ.sel, b = $('bj-ok'); if (!c) return;
  const f = $('bj-f').value, m = $('bj-m').value, w = $('bj-warn');
  const err = !f ? 'Falta la fecha de baja.' : f > addD(HOY, 7) ? 'La fecha de baja está muy adelante; revísala.' : !m ? 'Elige el motivo de baja.' : ($('bj-m').value === 'Cambio a marca o cadena' && !$('bj-marca').value.trim()) ? 'Escribe la marca o cadena destino.' : ($('bj-u').value && $('bj-u').value > f) ? 'El último día laborado no puede ser posterior a la fecha de baja.' : '';
  if (err) { w.hidden = false; w.textContent = err; return; }
  b.disabled = true; b.textContent = 'Guardando…';
  try {
    await API.registrarBaja({ usuario: c.usuario_fieldwy, idpdv: c.idpdv, fecha: f, ultimo: $('bj-u').value, motivo: m, marca: $('bj-marca').value.trim(), adeudo: +$('bj-ad').value || 0, adeudoDet: $('bj-adt').value.trim(), evidencia: null, comentarios: $('bj-c').value.trim(), enc: leerEncuesta('be-') });
    await perfilGuardarDeModal(c, f);
    const ev = $('bj-ev') && $('bj-ev').files && $('bj-ev').files[0]; if (ev) { try { await API.subirEvidenciaBaja(c.usuario_fieldwy, f, ev); } catch (x) { toast('La baja se guardó, pero la evidencia no: ' + (x.message || x)); } }
    MV.loaded = false; R.vivo = false; cerrarM(); toast('Baja registrada: ' + c.nombre);
    if (S.alertas) S.alertas = S.alertas.filter(x => x.usuario !== c.usuario_fieldwy);
    if (S.view === 'bajas') vBajas(); else if (typeof nav === 'function') { nav(); render(); }
  } catch (e) { b.disabled = false; b.textContent = 'Reintentar'; w.hidden = false; w.textContent = 'No se pudo guardar: ' + (e.message || e) + (/row-level|policy/i.test(String(e.message || e)) ? ' (este colaborador no está en tu alcance)' : ''); }
}
function encuestaDeBaja(id) {
  const b = BJ.lista.find(x => x.id === id); if (!b) return;
  $('modal').innerHTML = `<div class="mbox wide" style="width:min(820px,96vw);max-height:92vh;overflow:auto" role="dialog" aria-modal="true"><h3>📝 Encuesta de salida</h3><div class="who">${esc(b.nombre)} · ${esc(b.usuario)} · baja ${fdate(b.fecha)} · ${esc(b.motivo)}</div>${encuestaCampos('ee-')}<div class="warn" id="ee-warn" hidden></div><div class="mfoot"><button class="btn" onclick="cerrarM()">Cancelar</button><button class="btn primary" id="ee-ok">Guardar encuesta</button></div></div>`;
  $('modal').hidden = false; $('modal').onclick = e => { if (e.target.id === 'modal') cerrarM(); };
  $('ee-ok').onclick = async () => { const e = leerEncuesta('ee-'); if (!e) { $('ee-warn').hidden = false; $('ee-warn').textContent = 'Contesta al menos una pregunta.'; return; } $('ee-ok').disabled = true; try { await API.guardarEncuesta(id, e); b.enc = true; cerrarM(); toast('Encuesta guardada'); vBajas(); } catch (x) { $('ee-ok').disabled = false; $('ee-warn').hidden = false; $('ee-warn').textContent = 'No se pudo guardar: ' + (x.message || x); } };
}
