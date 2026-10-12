/* ====================================================================== FINIQUITOS ======================================================================
   RH confirma la baja. El ANALISTA calcula, valida, pide los documentos, revisa el firmado, autoriza y envía a pago. RH sube el PDF firmado. Nómina/analista marcan Pagado.
   Todo cálculo y toda regla viven en la base (calcular_finiquito, finiquito_*): aquí solo se captura y se muestra. Los documentos (Word -> PDF) los genera la tarea de la PC
   (procesar_finiquitos.py) y los firmados aprobados se archivan en OneDrive\RRHH\FINIQUITOS\AAAA\AAAA-MM\USUARIO. */
const FQB = 'finiquitos-temp', FQ_MAX = 15 * 1024 * 1024;
const FQ = { lista: [], tab: 'calcular', q: '', emp: [], fin: null, arch: [] };
const FQ_TABS = [['calcular', 'Por calcular'], ['proceso', 'En proceso'], ['pagar', 'Por pagar'], ['pagados', 'Pagados']];
const FQ_EN_PROCESO = ['Calculado', 'Validado', 'Documento solicitado', 'Documento generado', 'Firmado'];
const money = n => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

Real.finLista = async function () { const { data, error } = await sb.from('v_finiquitos_lista').select('*').order('fecha_baja', { ascending: false }); if (error) throw error; return data || []; };
Real.finEmpresas = async function () { const { data, error } = await sb.from('empresas_legales').select('*').eq('activa', true).order('clave'); if (error) throw error; return data || []; };
Real.finDetalle = async function (id) {
  const [f, a] = await Promise.all([sb.from('finiquitos').select('*').eq('id', id).single(), sb.from('finiquito_archivos').select('*').eq('finiquito_id', id).order('id', { ascending: false })]);
  if (f.error) throw f.error; if (a.error) throw a.error; return { f: f.data, a: a.data || [] };
};
Real.finParametros = async function () { const { data, error } = await sb.from('parametros_finiquito').select('*').order('clave').order('vigente_desde', { ascending: false }); if (error) throw error; return data || []; };
Real.finRpc = async function (fn, args) { const { data, error } = await sb.rpc(fn, args || {}); if (error) throw new Error(error.message); return data; };
Real.finColab = async function (u) { const { data } = await sb.from('colaboradores').select('empresa').eq('usuario_fieldwy', u).maybeSingle(); return data || {}; };
Real.finBancarios = async function (us) { const { data, error } = await sb.from('datos_bancarios').select('usuario_fieldwy,banco,titular,clabe,cuenta,tarjeta').in('usuario_fieldwy', us); if (error) throw error; return data || []; };
Real.finSubirFirmado = async function (id, file) {
  if (file.type !== 'application/pdf') throw new Error('El firmado debe ser un PDF'); if (file.size > FQ_MAX) throw new Error('El PDF pesa más de 15 MB: comprímelo antes de subirlo');
  const buf = await file.arrayBuffer(), h = await crypto.subtle.digest('SHA-256', buf), sha = [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
  const prep = await Real.finRpc('finiquito_preparar_firmado', { p_id: id });
  const { error } = await sb.storage.from(FQB).upload(prep.ruta, new Blob([buf], { type: 'application/pdf' }), { contentType: 'application/pdf', upsert: false }); if (error) throw new Error('No se pudo subir el archivo: ' + error.message);
  await Real.finRpc('finiquito_registrar_firmado', { p_id: id, p_version: prep.version, p_ruta: prep.ruta, p_nombre: file.name, p_bytes: file.size, p_sha: sha });
};
Real.finUrl = async function (ruta) { const { data, error } = await sb.storage.from(FQB).createSignedUrl(ruta, 60); if (error) throw new Error(error.message); return data.signedUrl; };

Demo.finLista = async () => [
  { baja_id: 1, usuario_fieldwy: 'demo.uno', nombre: 'MARÍA LÓPEZ DEMO', fecha_baja: '2026-10-02', motivo_baja: 'Renuncia', tienda: 'Coppel Centro', estado_tienda: 'Jalisco', dias_desde_baja: 7, finiquito_id: null, estatus: null, total: null, ingreso_historial: '2024-01-16', ingreso_calidad: 'ok' },
  { baja_id: 2, usuario_fieldwy: 'demo.dos', nombre: 'JUAN PÉREZ DEMO', fecha_baja: '2026-09-28', motivo_baja: 'Abandono', tienda: 'Elektra Sur', estado_tienda: 'Puebla', dias_desde_baja: 11, finiquito_id: 5, estatus: 'Documento generado', total: 4826.88, ingreso_historial: null }];
Demo.finEmpresas = async () => [{ clave: 'BENBER', nombre_abreviado: 'GRUPO BENBER VITAL, S.A. DE C.V.' }, { clave: 'SERSOIN', nombre_abreviado: 'SERSOIN, S.A. DE C.V.' }];
Demo.finDetalle = async () => ({ f: null, a: [] }); Demo.finParametros = async () => [{ clave: 'salario_minimo', vigente_desde: '2026-01-01', valor: 315.04, nota: 'por confirmar' }];
Demo.finRpc = async () => null; Demo.finColab = async () => ({}); Demo.finBancarios = async () => []; Demo.finSubirFirmado = async () => { }; Demo.finUrl = async () => '#';

function finPill(st) { return pillx(esc(st || 'Sin calcular'), st === 'Pagado' ? 'g' : st === 'Autorizado' ? 'g' : st === 'Firmado' ? 'g' : !st ? 'x' : 'a'); }
function finBajar(nombre, filas) {
  const csv = filas.map(r => r.map(v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(',')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })); a.download = nombre; a.click(); toast('CSV descargado');
}

async function vFiniquitos() {
  $('content').innerHTML = cab('Finiquitos', 'Solo promotores con baja reciente (máximo 120 días). Salario base: salario mínimo vigente a la fecha de baja. Flujo: calcular → validar → documentos → firmado (RH) → autorizar → pago.', 'mochila') + '<div class="loading">Cargando…</div>';
  try { [FQ.lista, FQ.emp] = await Promise.all([API.finLista(), API.finEmpresas()]); } catch (e) { $('content').innerHTML += `<div class="warn">No se pudo cargar: ${esc(e.message || e)}</div>`; return; }
  finPintar();
}
function finEnTab(r, t) {
  const st = r.estatus; if (t === 'calcular') return !r.finiquito_id; if (t === 'proceso') return FQ_EN_PROCESO.includes(st); if (t === 'pagar') return st === 'Autorizado'; return st === 'Pagado';
}
function finPintar() {
  const q = norm(FQ.q), cuenta = t => FQ.lista.filter(r => finEnTab(r, t)).length;
  const filas = FQ.lista.filter(r => finEnTab(r, FQ.tab)).filter(r => okT(tienda(r.idpdv) || null) || (!tienda(r.idpdv) && !Object.values(FL).some(Boolean))).filter(r => !q || norm(`${r.nombre} ${r.usuario_fieldwy} ${r.tienda || ''}`).includes(q));
  const accion = r => r.finiquito_id ? `<button class="btn sm" onclick="finAbrir(${r.finiquito_id})">Abrir</button>` : (r.exige_perfil && !r.perfil_evaluado) ? `<button class="btn sm primary" onclick="perfilAbrirDe({usuario:'${r.usuario_fieldwy}',fecha:'${r.fecha_baja}',nombre:'${esc(r.nombre).replace(/'/g, '')}',motivo:'${esc(r.motivo_baja || '').replace(/'/g, '')}'})">Evaluar recontratación</button>` : can('finiquitos', 'crear') ? `<button class="btn sm primary" onclick="finCalcular(${r.baja_id})">Calcular</button>` : '';
  const fila = r => `<tr>${FQ.tab === 'pagar' && can('finiquitos', 'editar') && !r.lote_id ? `<td><input type="checkbox" class="fq-sel" value="${r.finiquito_id}"></td>` : FQ.tab === 'pagar' && can('finiquitos', 'editar') ? '<td></td>' : ''}
    <td class="t"><b>${esc(r.nombre)}</b><br><small class="muted">${esc(r.usuario_fieldwy)}</small></td><td class="t">${esc(r.tienda || '—')}<br><small class="muted">${esc(r.estado_tienda || '')}</small></td><td>${fdate(r.fecha_baja)}</td>
    <td>${r.dias_desde_baja}${r.dias_desde_baja > 120 && !r.finiquito_id ? ' ' + pillx('fuera de plazo', 'r') : ''}</td><td class="t">${(r.exige_perfil && !r.perfil_evaluado && !r.finiquito_id) ? pillx('Falta evaluar recontratación', 'a') : finPill(r.estatus)}${r.lote_id ? `<br><small class="muted">lote ${r.lote_id}</small>` : ''}</td><td>${r.total != null ? money(r.total) : '—'}</td><td>${accion(r)}</td></tr>`;
  const pagar = FQ.tab === 'pagar' && can('finiquitos', 'editar');
  $('content').innerHTML = cab('Finiquitos', 'Solo promotores con baja reciente (máximo 120 días). Salario base: salario mínimo vigente a la fecha de baja. Flujo: calcular → validar → documentos → firmado (RH) → autorizar → pago.', 'mochila') +
    `<div class="tools">${FQ_TABS.map(([k, n]) => `<button class="btn ${FQ.tab === k ? 'primary' : ''}" onclick="FQ.tab='${k}';finPintar()">${n} (${cuenta(k)})</button>`).join('')}
      <input id="fq-q" placeholder="Buscar nombre, usuario o tienda" value="${esc(FQ.q)}" oninput="FQ.q=this.value;finPintar();$('fq-q').focus()" style="min-width:220px">
      ${can('finiquitos', 'editar') ? '<button class="btn" onclick="finParametros()">⚙️ Parámetros</button>' : ''}${FQ.tab === 'pagar' ? '<button class="btn" onclick="finLayoutPago()">⬇ Layout de pago (CSV)</button>' : ''}
      ${pagar ? '<button class="btn primary" onclick="finCrearLote()">📦 Enviar a pago los marcados</button>' : ''}</div>
    <div class="tw"><table class="dt"><thead><tr>${pagar ? '<th></th>' : ''}<th class="t">Promotor</th><th class="t">Tienda</th><th>Baja</th><th>Días</th><th class="t">Estatus</th><th>Total</th><th></th></tr></thead>
    <tbody>${filas.map(fila).join('') || '<tr><td colspan="8" class="muted">Sin registros</td></tr>'}</tbody></table></div>`;
}

async function finCalcular(bajaId) {
  const r = FQ.lista.find(x => x.baja_id === bajaId); if (!r) return;
  let colab = {}; try { colab = await API.finColab(r.usuario_fieldwy); } catch (e) { }
  const emp = norm(colab.empresa || ''), pre = (FQ.emp.find(e => emp && (emp.includes(norm(e.clave)) || norm(e.nombre_abreviado).includes(emp))) || {}).clave || '';
  const hist = r.ingreso_historial && r.ingreso_calidad !== 'revisar';
  $('modal').innerHTML = `<div class="mbox" style="width:min(560px,96vw);max-height:92vh;overflow:auto" role="dialog" aria-modal="true"><h3>🧮 Calcular finiquito</h3><div class="who">${esc(r.nombre)} · baja ${fdate(r.fecha_baja)}</div>
    <div class="fld"><label>Razón social</label><select id="fq-emp"><option value="">— elige —</option>${FQ.emp.map(e => `<option value="${esc(e.clave)}" ${e.clave === pre ? 'selected' : ''}>${esc(e.nombre_abreviado)}</option>`).join('')}</select></div>
    <div class="fld"><label>Estado de emisión del documento</label><input id="fq-edo" value="${esc(r.estado_tienda || '')}"></div>
    <div class="fld"><label>Fecha de ingreso ${hist ? `(historial: ${fdate(r.ingreso_historial)}; déjala vacía para usarla)` : '(no hay una confiable en el historial: captúrala)'}</label><input id="fq-ing" type="date"></div>
    <div class="fld"><label>Fuente de la fecha de ingreso (solo si la capturas)</label><input id="fq-nota" placeholder="Ej. contrato firmado, alta IMSS"></div>
    <div class="row2"><div class="fld"><label>Días de vacaciones pendientes</label><input id="fq-vac" type="number" min="0" step="0.5" value="0"></div><div class="fld"><label>Días de gratificación</label><input id="fq-grat" type="number" min="0" step="0.5" value="0"></div></div>
    <div class="fld"><label>Descuentos ($)</label><input id="fq-desc" type="number" min="0" step="0.01" value="0"></div>
    <div class="mfoot"><button class="btn" onclick="cerrarM()">Cancelar</button><button class="btn primary" onclick="finCalcularOk(${bajaId})">Calcular</button></div></div>`;
  $('modal').hidden = false;
}
async function finCalcularOk(bajaId) {
  const v = id => $(id).value, ing = v('fq-ing');
  try {
    const id = await API.finRpc('calcular_finiquito', { p_baja: bajaId, p_fecha_ingreso: ing || null, p_ingreso_nota: ing ? limpia(v('fq-nota')) : null, p_empresa: v('fq-emp') || null, p_edo: limpia(v('fq-edo')) || null,
      p_dias_vac_pend: +v('fq-vac') || 0, p_dias_grat: +v('fq-grat') || 0, p_descuentos: +v('fq-desc') || 0 });
    toast('Finiquito calculado'); cerrarM(); FQ.lista = await API.finLista(); finAbrir(id);
  } catch (e) { toast(e.message || e); }
}

async function finAbrir(id) {
  let d; try { d = await API.finDetalle(id); } catch (e) { toast('No se pudo abrir: ' + (e.message || e)); return; }
  const f = d.f; FQ.fin = f; FQ.arch = d.a; if (!f) { toast('Sin datos (modo demo)'); return; }
  const nom = (FQ.lista.find(x => x.usuario_fieldwy === f.usuario_fieldwy) || {}).nombre || f.usuario_fieldwy, st = f.estatus, edita = can('finiquitos', 'editar');
  const fila = (k, v) => `<tr><td class="t">${k}</td><td style="text-align:right">${v}</td></tr>`;
  const fir = d.a.filter(a => a.tipo === 'Firmado' && a.estado !== 'Reemplazado')[0], docs = d.a.filter(a => a.tipo === 'Documentos' && a.estado !== 'Reemplazado')[0];
  const ver = a => a && a.ubicacion === 'Temporal' ? `<button class="btn sm" onclick="finVer(${a.id})">👁 Abrir</button>` : a && a.ubicacion === 'Archivado' ? `<small class="muted">Archivado: ${esc(a.ruta_final || '')}</small>` : '';
  const b = [];
  if (edita && st === 'Calculado') b.push(`<button class="btn" onclick="finCalcular(${f.baja_id})">Recalcular</button><button class="btn primary" onclick="finAccion('finiquito_validar',${f.id},'Validado')">✔ Validar</button>`);
  if (edita && st === 'Validado') b.push(`<button class="btn primary" onclick="finAccion('finiquito_solicitar_documentos',${f.id},'Documentos solicitados: la tarea de la PC los genera en la siguiente corrida')">📄 Solicitar documentos</button>`);
  if (st === 'Documento generado' && can('finiquito_archivos', 'crear')) b.push(`<input type="file" id="fq-pdf" accept="application/pdf" hidden onchange="finSubir(${f.id})"><button class="btn primary" onclick="$('fq-pdf').click()">⬆ Subir PDF firmado</button>`);
  if (st === 'Firmado' && edita) b.push(`<button class="btn primary" onclick="finAccion('finiquito_autorizar',${f.id},'Autorizado')">✔ Autorizar</button>`);
  if (st === 'Autorizado' && f.lote_id && can('finiquitos_pago', 'editar')) b.push(`<button class="btn primary" onclick="finPagar(${f.id})">💵 Marcar pagado</button>`);
  if (edita && ['Validado', 'Documento solicitado', 'Documento generado', 'Firmado', 'Autorizado'].includes(st) && !f.lote_id) b.push(`<button class="btn" onclick="finMotivo('finiquito_reabrir',${f.id},'Reabrir para recalcular')">↩ Reabrir</button>`);
  if (edita && st !== 'Pagado' && st !== 'Cancelado') b.push(`<button class="btn" onclick="finMotivo('finiquito_cancelar',${f.id},'Cancelar finiquito')">✖ Cancelar</button>`);
  const revisar = edita && fir && fir.estado === 'Pendiente de revisión' && st === 'Documento generado';
  $('modal').innerHTML = `<div class="mbox" style="width:min(720px,96vw);max-height:92vh;overflow:auto" role="dialog" aria-modal="true"><h3>🧾 Finiquito</h3>
    <div class="who">${esc(nom)} · ${esc(f.usuario_fieldwy)}<br>${finPill(st)} · revisión ${f.revision}${f.lote_id ? ' · lote ' + f.lote_id : ''}</div>
    <div class="tw"><table class="dt"><tbody>
      ${fila('Fecha de ingreso', fdate(f.fecha_ingreso) + ` <small class="muted">(${f.ingreso_fuente}${f.ingreso_nota ? ': ' + esc(f.ingreso_nota) : ''})</small>`)}${fila('Fecha de baja', fdate(f.fecha_baja))}${fila('Razón social', esc(f.empresa_clave || '—'))}${fila('Estado de emisión', esc(f.edo_emision || '—'))}
      ${fila('Salario base (mínimo vigente)', money(f.salario_base))}${fila('Años de antigüedad / días de vacaciones', f.anios_antiguedad + ' / ' + f.dias_vac_corresponden)}
      ${fila('Aguinaldo (' + f.dias_aguinaldo + ' días)', money(f.aguinaldo))}${fila('Vacaciones pendientes (' + f.dias_vac_pendientes + ' d)', money(f.vacaciones))}${fila('Prima vacacional s/ pendientes', money(f.prima_vacacional))}
      ${fila('Vacaciones proporcionales (' + Number(f.dias_vac_prop).toFixed(2) + ' d)', money(f.vac_prop))}${fila('Prima vacacional proporcional', money(f.prima_prop))}${fila('Gratificación (' + f.dias_gratificacion + ' d)', money(f.gratificacion))}
      ${fila('Descuentos', '− ' + money(f.descuentos))}${fila('<b>TOTAL</b>', '<b>' + money(f.total) + '</b>')}
      ${f.fecha_pago ? fila('Pagado', fdate(f.fecha_pago) + ' · ref. ' + esc(f.referencia_pago || '')) : ''}</tbody></table></div>
    ${docs ? `<div class="note">Documentos generados (v${docs.version}): ${ver(docs)}</div>` : st === 'Documento solicitado' ? '<div class="note">Documentos solicitados. Se generan en la siguiente corrida de la tarea (o con «Generar finiquitos ahora» en la PC).</div>' : ''}
    ${fir ? `<div class="note">PDF firmado v${fir.version}: ${finPill(fir.estado)} ${ver(fir)}${fir.motivo ? `<br><small>${esc(fir.motivo)}</small>` : ''}</div>` : ''}
    ${revisar ? `<div class="warn"><b>Revisión del firmado</b> (confirma cada punto para aprobar)<br>${[['nombre', 'Nombre correcto'], ['importes', 'Importes iguales al cálculo'], ['firma', 'Firma'], ['huellas', 'Huellas'], ['ine', 'INE legible (frente y vuelta)'], ['bancarios', 'Datos bancarios']].map(([k, n]) => `<label style="display:block"><input type="checkbox" class="fq-chk" data-k="${k}"> ${n}</label>`).join('')}
      <div class="tools"><button class="btn primary" onclick="finRevisar(${fir.id},true)">✔ Aprobar firmado</button><button class="btn" onclick="finRevisar(${fir.id},false)">✖ Pedir corrección</button></div></div>` : ''}
    <div class="mfoot">${b.join('')}<button class="btn" onclick="cerrarM();vFiniquitos()">Cerrar</button></div></div>`;
  $('modal').hidden = false; $('modal').onclick = e => { if (e.target.id === 'modal') { cerrarM(); vFiniquitos(); } };
}
async function finAccion(fn, id, msg) { try { await API.finRpc(fn, { p_id: id }); toast(msg); finAbrir(id); } catch (e) { toast(e.message || e); } }
async function finMotivo(fn, id, titulo) {
  const m = prompt(titulo + ': escribe el motivo (mínimo 5 caracteres)', ''); if (m === null) return; if (limpia(m).length < 5) { toast('Escribe el motivo (mínimo 5 caracteres)'); return; }
  try { await API.finRpc(fn, { p_id: id, p_motivo: limpia(m) }); toast('Hecho'); FQ.lista = await API.finLista(); if (fn === 'finiquito_cancelar') { cerrarM(); finPintar(); } else finAbrir(id); } catch (e) { toast(e.message || e); }
}
async function finSubir(id) {
  const f = $('fq-pdf').files[0]; if (!f) return; toast('Subiendo PDF…');
  try { await API.finSubirFirmado(id, f); toast('PDF subido · queda pendiente de revisión por el analista'); } catch (e) { toast('No se pudo subir: ' + (e.message || e)); }
  finAbrir(id);
}
async function finVer(archId) {
  const a = FQ.arch.find(x => x.id === archId); if (!a || !a.ruta_temp) return;
  try { window.open(await API.finUrl(a.ruta_temp), '_blank', 'noopener'); } catch (e) { toast('No se pudo abrir: ' + (e.message || e)); }
}
async function finRevisar(archId, aprobar) {
  const chk = {}; document.querySelectorAll('.fq-chk').forEach(c => chk[c.dataset.k] = c.checked);
  let motivo = null; if (!aprobar) { motivo = prompt('¿Qué debe corregirse? (mínimo 5 caracteres)', ''); if (motivo === null) return; motivo = limpia(motivo); if (motivo.length < 5) { toast('Escribe el motivo'); return; } }
  try { await API.finRpc('finiquito_revisar_firmado', { p_archivo: archId, p_aprobar: aprobar, p_motivo: motivo, p_checklist: chk }); toast(aprobar ? 'Firmado aprobado' : 'Devuelto para corrección'); finAbrir(FQ.fin.id); } catch (e) { toast(e.message || e); }
}
async function finCrearLote() {
  const ids = [...document.querySelectorAll('.fq-sel:checked')].map(c => +c.value); if (!ids.length) { toast('Marca al menos un finiquito'); return; }
  const nota = prompt('Nota del lote (opcional)', ''); if (nota === null) return;
  try { const lote = await API.finRpc('finiquito_crear_lote', { p_ids: ids, p_nota: limpia(nota) }); toast('Lote ' + lote + ' creado con ' + ids.length + ' finiquitos'); FQ.lista = await API.finLista(); finPintar(); } catch (e) { toast(e.message || e); }
}
function finPagar(id) {
  const hoy = new Date().toISOString().slice(0, 10);
  $('modal').innerHTML = `<div class="mbox" style="width:min(460px,96vw)" role="dialog" aria-modal="true"><h3>💵 Marcar pagado</h3><div class="note">Se marca una sola vez y no se puede deshacer.</div>
    <div class="fld"><label>Fecha de pago</label><input id="fq-fp" type="date" max="${hoy}" value="${hoy}"></div><div class="fld"><label>Referencia del pago</label><input id="fq-ref" placeholder="Folio, SPEI, recibo…"></div>
    <div class="mfoot"><button class="btn" onclick="finAbrir(${id})">Cancelar</button><button class="btn primary" onclick="finPagarOk(${id})">Confirmar pago</button></div></div>`;
}
async function finPagarOk(id) {
  try { await API.finRpc('finiquito_marcar_pagado', { p_id: id, p_fecha: $('fq-fp').value, p_referencia: limpia($('fq-ref').value) }); toast('Pago registrado'); FQ.lista = await API.finLista(); finAbrir(id); } catch (e) { toast(e.message || e); }
}
async function finLayoutPago() {
  const rows = FQ.lista.filter(r => r.estatus === 'Autorizado' && r.lote_id); if (!rows.length) { toast('No hay finiquitos enviados a pago'); return; }
  let ban = {}; if (can('datos_bancarios', 'ver')) { try { (await API.finBancarios(rows.map(r => r.usuario_fieldwy))).forEach(b => ban[b.usuario_fieldwy] = b); } catch (e) { toast('No se pudieron leer los datos bancarios: ' + (e.message || e)); return; } }
  const conB = can('datos_bancarios', 'ver');
  finBajar('layout_pago_finiquitos_' + new Date().toISOString().slice(0, 10) + '.csv', [['lote', 'usuario', 'nombre', 'fecha_baja', 'total', ...(conB ? ['banco', 'titular', 'clabe', 'cuenta', 'tarjeta'] : [])],
    ...rows.map(r => { const b = ban[r.usuario_fieldwy] || {}; return [r.lote_id, r.usuario_fieldwy, r.nombre, r.fecha_baja, r.total, ...(conB ? [b.banco, b.titular, b.clabe, b.cuenta, b.tarjeta] : [])]; })]);
}
async function finParametros() {
  let ps; try { ps = await API.finParametros(); } catch (e) { toast(e.message || e); return; }
  const noms = { salario_minimo: 'Salario mínimo diario ($)', dias_aguinaldo: 'Días de aguinaldo', prima_vacacional: 'Prima vacacional (0.25 = 25 %)', max_dias_desde_baja: 'Máx. días desde la baja' };
  $('modal').innerHTML = `<div class="mbox" style="width:min(640px,96vw);max-height:92vh;overflow:auto" role="dialog" aria-modal="true"><h3>⚙️ Parámetros de finiquitos</h3>
    <div class="note">Cada valor aplica desde su fecha. El salario mínimo se toma el vigente a la fecha de baja. Revisa que el de 2026 sea el correcto.</div>
    <div class="tw"><table class="dt"><thead><tr><th class="t">Parámetro</th><th>Desde</th><th>Valor</th><th class="t">Nota</th></tr></thead><tbody>${ps.map(p => `<tr><td class="t">${noms[p.clave] || esc(p.clave)}</td><td>${fdate(p.vigente_desde)}</td><td>${p.valor}</td><td class="t">${esc(p.nota || '')}</td></tr>`).join('')}</tbody></table></div>
    ${sect('Agregar o corregir un valor')}<div class="fld"><label>Parámetro</label><select id="fq-pc">${Object.entries(noms).map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></div>
    <div class="row2"><div class="fld"><label>Aplica desde</label><input id="fq-pd" type="date"></div><div class="fld"><label>Valor</label><input id="fq-pv" type="number" step="0.0001" min="0"></div></div>
    <div class="fld"><label>Nota / fuente</label><input id="fq-pn" placeholder="Ej. DOF 2026"></div>
    <div class="mfoot"><button class="btn" onclick="cerrarM()">Cerrar</button><button class="btn primary" onclick="finParametroOk()">Guardar</button></div></div>`;
  $('modal').hidden = false;
}
async function finParametroOk() {
  try { await API.finRpc('guardar_parametro_finiquito', { p_clave: $('fq-pc').value, p_desde: $('fq-pd').value, p_valor: +$('fq-pv').value, p_nota: limpia($('fq-pn').value) }); toast('Parámetro guardado'); finParametros(); } catch (e) { toast(e.message || e); }
}
