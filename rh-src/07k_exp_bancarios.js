/* ====================================================================== EXPEDIENTES · DATOS BANCARIOS ======================================================================
   Desde Expedientes se capturan o corrigen los datos bancarios de cualquier persona del HC: se busca por nombre o usuario, o se elige de la lista de quienes todavía no los tienen.
   Los permisos los aplica la base (RH captura datos nuevos; corregir un dato ya capturado es de administración, analista o nómina). */
const EB = { res: [], tm: null, faltan: null };
async function bancAbrirBuscador() {
  $('modal').innerHTML = `<div class="mbox" style="width:min(640px,96vw);max-height:92vh;overflow:auto" role="dialog" aria-modal="true"><h3>💳 Datos bancarios</h3><div class="note">Busca a la persona del HC para capturar los datos que faltan o corregir los que estén mal.</div>
    <div class="fld"><label>Colaborador (usuario Fieldway o nombre)</label><input id="eb-q" autocomplete="off" placeholder="Escribe al menos 3 letras…" oninput="bancBuscar(this.value)"></div><div id="eb-res"></div><div class="mfoot"><button class="btn" onclick="cerrarM()">Cerrar</button></div></div>`;
  $('modal').hidden = false; $('modal').onclick = e => { if (e.target.id === 'modal') cerrarM(); }; setTimeout(() => $('eb-q').focus(), 50);
}
function bancBuscar(q) {
  clearTimeout(EB.tm); const r = $('eb-res'); if (limpiaQ(q).length < 3) { r.innerHTML = ''; return; }
  EB.tm = setTimeout(async () => {
    try { EB.res = await API.buscarColab(q); } catch (e) { r.innerHTML = `<div class="warn">${esc(e.message || e)}</div>`; return; }
    r.innerHTML = EB.res.length ? `<div class="bj-list">${EB.res.map((c, i) => { const t = tienda(c.idpdv) || {}; return `<div class="bj-it" onclick="bancElegir(EB.res[${i}])"><b>${esc(c.nombre)}</b><span>${esc(c.usuario_fieldwy)}</span><span>${esc(t.nombre || 'Sin tienda')}</span><span>${c.estatus === 'Baja' ? 'Baja' : ''}</span></div>`; }).join('')}</div>` : '<p class="muted">Sin coincidencias.</p>';
  }, 280);
}
async function bancElegir(c) {
  try { SB.sel = c; SB.ba = await API.bancariosDe(c.usuario_fieldwy); } catch (e) { toast('No se pudieron leer sus datos bancarios: ' + (e.message || e)); return; }
  SB.despues = () => { SB.despues = null; if (S.view === 'expedientes') vExpedientes(); };
  sbBancForm();
}
async function bancFaltanHTML() {
  let f = []; try { f = (await API.altasFases()).filter(x => !x.banc_ok); } catch (e) { return ''; }
  const ok = x => okT(tienda(x.idpdv) || null) || (!tienda(x.idpdv) && !Object.values(FL).some(Boolean)); f = f.filter(ok);
  return sect('Faltan datos bancarios', '💳') + `<div class="tools" data-nocap><button class="btn primary" onclick="bancAbrirBuscador()">🔎 Buscar a alguien del HC (capturar o corregir)</button><span class="muted">${f.length} persona${f.length === 1 ? '' : 's'} de altas nuevas sin CLABE</span></div>` +
    (f.length ? tbl('t-bfalta', [{ h: 'Usuario', t: 1, v: x => x.usuario, w: 130 }, { h: 'Colaborador', t: 1, v: x => x.nombre, w: 220, r: x => `<b>${esc(x.nombre)}</b>` }, { h: 'Fase', t: 1, v: x => x.fase, r: x => pillx(FASEC[x.fase][1], FASEC[x.fase][0]) }, { h: 'Estado', t: 1, v: x => x.bancarios_omitidos ? 'Omitidos' : 'Sin capturar', r: x => pillx(x.bancarios_omitidos ? 'Omitidos' : 'Sin capturar', 'a') },
      { h: 'Tienda', t: 1, v: x => (tienda(x.idpdv) || {}).nombre || '' }, { h: 'Supervisor', t: 1, v: x => (tienda(x.idpdv) || {}).supervisor }, { h: '', v: () => '', r: x => `<button class="rsv" onclick="bancElegir({usuario_fieldwy:'${x.usuario}',nombre:'${String(x.nombre).replace(/['"\\]/g, '')}',idpdv:${x.idpdv || 'null'},estatus:'Activo'})">Capturar ›</button>` }], f, { fix: 2, search: 1, csv: 1, file: 'faltan_bancarios', titulo: 'Faltan datos bancarios', sort: 0, dir: 1, maxh: '40vh' }) : '<p class="muted">Nadie de las altas nuevas está sin datos bancarios.</p>');
}
