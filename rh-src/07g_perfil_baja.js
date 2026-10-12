/* ====================================================================== PERFIL DEL PROMOTOR AL CAUSAR BAJA ======================================================================
   Al registrar una baja se muestra un resumen del promotor (categoría de Avance GB de las últimas semanas, checks, errores, ventas, tiendas donde checó) y RH marca si es
   recontratable (Sí / Con reservas / No) con una nota. Queda guardado como foto del momento (baja_perfil) para consultarlo después, por ejemplo si pide reingresar.
   Los datos salen de los reportes publicados (últimas ~13 semanas de checks). La categoría y el desempeño ayudan a justificar bajas por productividad. */
const PF = { cache: new Map(), lista: new Map() };
Real.checksDe = async function (u) { return todo(() => sb.from('rep_checks').select('fecha,idpdv,estatus_check,estatus_final,registros').eq('usuario', u)); };
Real.perfilesBaja = async function () { return todo(() => sb.from('baja_perfil').select('*')); };
Real.guardarPerfilBaja = async function (a) { return Real.finRpc('guardar_perfil_baja', a); };
Demo.checksDe = async () => []; Demo.perfilesBaja = async () => []; Demo.guardarPerfilBaja = async () => { };
const PF_REC = { 'Sí': ['g', '🟢'], 'Con reservas': ['a', '🟠'], 'No': ['r', '🔴'] };

async function perfilCalc(u) {
  if (PF.cache.has(u)) return PF.cache.get(u);
  await cargarCatPromotores();
  const cats = (CATP.por.get(u) || []).slice(0, 6).map(x => ({ semana: x.semana, categoria: x.categoria, alcance_t: x.alcance_t, alcance_m: x.alcance_m, portas: x.portas }));
  let chk = []; try { chk = (await API.checksDe(u)).filter(x => x.estatus_final !== 'Otro Check'); } catch (e) { }
  const dias = new Map(); chk.forEach(c => dias.set(c.fecha, (dias.get(c.fecha) || 0) + (c.registros || 0)));
  const err = chk.filter(esErr), tipos = {}; err.forEach(x => tipos[x.estatus_check] = (tipos[x.estatus_check] || 0) + 1);
  const ok = chk.filter(x => OKF.includes(x.estatus_final)).length, tiendas = new Set(chk.map(x => x.idpdv)).size, ventas = chk.reduce((a, x) => a + (x.registros || 0), 0), sinVenta = [...dias.values()].filter(v => v === 0).length;
  const real = cats.filter(c => c.categoria !== 'Adaptación').slice(0, 4), bueno = real.filter(c => c.categoria === 'Dorado' || c.categoria === 'Verde').length, malo = real.filter(c => c.categoria === 'Rojo').length;
  const veredicto = !real.length ? (cats.length ? 'En adaptación (sin evidencia suficiente)' : 'Sin datos de productividad') : bueno * 2 >= real.length ? 'Productivo' : malo * 2 >= real.length ? 'Bajo desempeño' : 'Desempeño regular';
  const temas = []; if (dias.size && err.length / dias.size >= .2) temas.push('Errores de check frecuentes (' + err.length + ' en ' + dias.size + ' días)'); if (tiendas >= 3) temas.push('Checó en ' + tiendas + ' tiendas distintas'); if (dias.size && sinVenta / dias.size > .5) temas.push('Más de la mitad de sus días con check sin venta');
  const o = { categorias: cats, dias_check: dias.size, checks: chk.length, pct_cumple: chk.length ? Math.round(ok / chk.length * 1000) / 10 : null, errores: err.length, tipos_error: tipos, tiendas, ventas, dias_sin_venta: sinVenta, veredicto, temas };
  PF.cache.set(u, o); return o;
}
function perfilHTML(p) {
  const cats = p.categorias.slice(0, 4).map(c => `<span title="${esc(c.semana)}">${catPill(c.categoria)}</span>`).join(' ') || '<span class="muted">sin categoría publicada</span>';
  return `<div class="pf-box"><div><b>${esc(p.veredicto)}</b></div><div class="pf-row"><span>Categoría (últimas semanas, de la más reciente):</span> ${cats}</div>
    <div class="pf-row"><span>${fmt(p.dias_check)} días con check · ${fmt(p.checks)} checks · ${p.pct_cumple == null ? '—' : p.pct_cumple + ' %'} cumplen · ${fmt(p.errores)} con error · ${fmt(p.ventas)} ventas · ${fmt(p.dias_sin_venta)} días sin venta · ${fmt(p.tiendas)} tienda${p.tiendas === 1 ? '' : 's'}</span></div>
    ${Object.keys(p.tipos_error || {}).length ? `<div class="pf-row">${Object.entries(p.tipos_error).sort((a, b) => b[1] - a[1]).map(([k, v]) => pillx((ERRI[k] || '') + ' ' + v + ' ' + esc((ERRN[k] || k).toLowerCase()), NOJUST.includes(k) ? 'r' : 'a')).join(' ')}</div>` : ''}
    ${p.temas && p.temas.length ? `<div class="pf-row">${p.temas.map(t => `<span class="pill a">⚠️ ${esc(t)}</span>`).join(' ')}</div>` : ''}</div>`;
}
const perfilCampos = (rec, nota) => `<div class="row2"><div class="fld"><label>¿Es recontratable?</label><select id="pf-rec"><option value="">— sin evaluar todavía —</option>${['Sí', 'Con reservas', 'No'].map(v => `<option ${rec === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div><div class="fld"><label>Por qué (obligatorio si no es «Sí»)</label><input id="pf-nota" value="${esc(nota || '')}" placeholder="Desempeño, conducta, adeudos…"></div></div>`;

/* dentro de "Registrar baja" */
async function bajaPerfilPanel(c) {
  const box = $('bj-perfil'); if (!box) return; box.innerHTML = '<div class="loading">Armando el perfil del promotor…</div>';
  try { const p = await perfilCalc(c.usuario_fieldwy); if (BJ.sel !== c) return; box.innerHTML = sect('Perfil del promotor', '🧑‍💼') + perfilHTML(p) + perfilCampos('', ''); } catch (e) { box.innerHTML = ''; }
}
async function perfilGuardarDeModal(c, fecha) {   // se llama después de registrar la baja; si no eligió recontratable, queda pendiente en la lista de bajas
  const rec = $('pf-rec') && $('pf-rec').value; if (!rec) return;
  try { await API.guardarPerfilBaja({ p_usuario: c.usuario_fieldwy, p_fecha: fecha, p_resumen: await perfilCalc(c.usuario_fieldwy), p_recontratable: rec, p_nota: limpia($('pf-nota').value) || null }); }
  catch (e) { toast('La baja se guardó, pero el perfil no: ' + (e.message || e) + ' (complétalo desde Bajas y encuesta → Perfil)'); }
}

/* desde la lista de bajas o desde Finiquitos */
function perfilAbrir(id) { const b = BJ.lista && BJ.lista.find(x => x.id === id); if (b) perfilAbrirDe(b); }
async function perfilAbrirDe(b) {   // b = { usuario, fecha, nombre, motivo }
  PF.cur = b; const prev = PF.lista.get(b.usuario + '|' + b.fecha); let p = prev ? prev.resumen : null;
  $('modal').innerHTML = `<div class="mbox" style="width:min(680px,96vw)" role="dialog" aria-modal="true"><h3>🧑‍💼 Perfil del promotor</h3><div class="who">${esc(b.nombre)} · ${esc(b.usuario)} · baja ${fdate(b.fecha)} · ${esc(b.motivo)}</div><div id="pf-cuerpo"><div class="loading">Armando el perfil…</div></div></div>`; $('modal').hidden = false;
  try { if (!p || !p.veredicto) p = await perfilCalc(b.usuario); } catch (e) { }
  const edita = can('bajas', 'editar') || can('bajas', 'crear');
  $('pf-cuerpo').innerHTML = (p ? perfilHTML(p) : '<div class="warn">No se pudo armar el resumen.</div>') + (prev ? `<p class="note">Evaluación guardada el ${fdate(String(prev.en).slice(0, 10))}. El resumen es la foto de ese momento.</p>` : '') +
    (edita ? perfilCampos(prev && prev.recontratable, prev && prev.nota) : '') + `<div class="mfoot"><button class="btn" onclick="cerrarM()">Cerrar</button>${edita ? '<button class="btn primary" onclick="perfilGuardar()">Guardar</button>' : ''}</div>`;
}
async function perfilGuardar() {
  const b = PF.cur; const rec = $('pf-rec').value; if (!rec) { toast('Elige si es recontratable'); return; }
  try { const res = (PF.lista.get(b.usuario + '|' + b.fecha) || {}).resumen; await API.guardarPerfilBaja({ p_usuario: b.usuario, p_fecha: b.fecha, p_resumen: (res && res.veredicto) ? res : await perfilCalc(b.usuario), p_recontratable: rec, p_nota: limpia($('pf-nota').value) || null }); toast('Perfil guardado'); cerrarM(); if (S.view === 'finiquitos') vFiniquitos(); else vBajas(); }
  catch (e) { toast(e.message || e); }
}
