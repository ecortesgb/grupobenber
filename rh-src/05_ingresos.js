/* ====================================================================== POSIBLES INGRESOS ====================================================================== */
const ESTI = ['Programado', 'Confirmado', 'Ingresó', 'No llegó', 'Declinó', 'No contesta', 'Reagenda'];
const ESTC = { 'Programado': 'x', 'Confirmado': 'b', 'Ingresó': 'g', 'No llegó': 'r', 'Declinó': 'r', 'No contesta': 'a', 'Reagenda': 'a' };
const IG = { tab: 'captura', cat: null, grid: [], lista: [], per: '90', loaded: false };
const DIAS_SEM = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const fdia = s => { const d = new Date(s + 'T12:00:00'); return DIAS_SEM[d.getDay()] + ' ' + fdate(s); };

/* ----- datos: real y demo ----- */
Real.catIngresos = async function () {
  const [r, f, v] = await Promise.all([sb.from('catalogo_reclutadores').select('id,nombre').eq('activo', true).order('nombre'), sb.from('catalogo_fuentes').select('id,fuente').order('fuente'), sb.from('catalogo_valores').select('tipo,valor,orden').eq('activo', true).order('orden')]);
  const val = t => (v.data || []).filter(x => x.tipo === t).map(x => x.valor);
  return { recl: r.data || [], fuentes: f.data || [], generado: val('generado_por'), experiencia: val('experiencia'), acomp: val('acompanamiento') };
};
const COLS_CAND = 'id,nombre,telefono,hora_ingreso,idpdv,fecha_programada,estatus,reclutador_id,fuente_id,generado_por,experiencia,acompanamiento,acompanado_por,referido_por,comentarios,usuario_fieldwy,reagendas,origen';
Real.candidatos = function (desde, hasta) { return todo(() => sb.from('candidatos').select(COLS_CAND).gte('fecha_programada', desde).lte('fecha_programada', hasta).order('fecha_programada').order('nombre')); };
Real.insertarCandidatos = async function (rows) {
  const lote = crypto.randomUUID(); let n = 0;
  for (let i = 0; i < rows.length; i += 200) { const parte = rows.slice(i, i + 200).map(r => ({ ...r, lote, origen: 'app' })); const { error } = await sb.from('candidatos').insert(parte); if (error) throw error; n += parte.length; }
  return n;
};
Real.confirmarIngreso = async function (id, datos, hora) { return Real.finRpc('confirmar_ingreso', { p_id: id, p_datos: datos, p_hora: hora || null }); };
Real.datosCandidato = async function (id) { const { data, error } = await sb.from('candidatos_datos').select('*').eq('candidato_id', id).maybeSingle(); if (error) throw error; return data; };
Real.eliminarCandidato = async function (id) { const { error } = await sb.from('candidatos').delete().eq('id', id); if (error) throw error; };
Real.actualizarCandidato = async function (id, patch) { const { error } = await sb.from('candidatos').update(patch).eq('id', id); if (error) throw error; };

Demo.catIngresos = async function () {
  return { recl: ['Julio', 'Itzel', 'Veronica', 'Sandy', 'Blanca', 'Luis', 'Karla Martinez', 'Jessica'].map((n, i) => ({ id: i + 1, nombre: n })), fuentes: ['Redes Sociales', 'Viterbit', 'Personal', 'Campo', 'Campaña', 'Referido', 'Pauta', 'Feria Del Empleo', 'Otros'].map((f, i) => ({ id: i + 1, fuente: f })),
    generado: ['Auxiliar', 'Supervisor', 'Reclutador', 'RR.HH.', 'Gerente', 'Telefónica'], experiencia: ['Ventas y atención al cliente', 'Atención al cliente', 'Ventas', 'Telefonía', 'Ventas de telefonía', 'Sin experiencia'], acomp: ['Ninguno', 'Supervisor', 'Auxiliar', 'Reclutador'] };
};
Demo._cands = null;
Demo.candidatos = async function (desde, hasta) {
  if (!Demo._cands) {
    const ids = Object.keys((await Demo.catalogos()).tiendas).map(Number); let k = 0;
    const nom = ['Alan Torres', 'Brenda Ríos', 'César Lugo', 'Diana Paz', 'Erick Salas', 'Fabiola Cruz', 'Gael Ponce', 'Hilda Mora', 'Iván Rojas', 'Julia Vera', 'Kevin Luna', 'Laura Peña', 'Marco Díaz', 'Nadia Soto', 'Oscar Meza'];
    Demo._cands = [];
    for (let d = -45; d <= 6; d++) for (let j = 0; j < (d < 0 ? 5 : 7); j++) {
      k++; const f = addD(HOY, d); const pas = d < 0 || (d === 0 && j % 2 === 0); const r = (k * 7) % 20;
      Demo._cands.push({ id: 'C' + k, nombre: nom[k % 15] + ' ' + (k % 97), idpdv: ids[(k * 3) % ids.length], fecha_programada: f, estatus: pas ? (r < 12 ? 'Ingresó' : r < 15 ? 'Declinó' : r < 17 ? 'No llegó' : r < 19 ? 'No contesta' : 'Reagenda') : (r < 8 ? 'Confirmado' : 'Programado'), reclutador_id: (k % 8) + 1, fuente_id: (k * 5) % 9 + 1, generado_por: ['Auxiliar', 'Supervisor', 'Reclutador', 'RR.HH.'][k % 4], experiencia: 'Ventas', acompanamiento: 'Ninguno', usuario_fieldwy: null, reagendas: 0, comentarios: null });
    }
  }
  return Demo._cands.filter(c => c.fecha_programada >= desde && c.fecha_programada <= hasta);
};
Demo.insertarCandidatos = async function (rows) { await new Promise(r => setTimeout(r, 300)); rows.forEach(r => Demo._cands.push({ id: 'N' + Math.random(), reagendas: 0, estatus: 'Programado', ...r })); return rows.length; };
Demo.confirmarIngreso = async function (id, datos, hora) { const c = Demo._cands.find(x => x.id === id); Object.assign(c, { estatus: 'Ingresó', hora_ingreso: hora, telefono: datos.telefono, nombre: [datos.nombre_pila, datos.apellido_p, datos.apellido_m].filter(Boolean).join(' ').toUpperCase() }); };
Demo.datosCandidato = async function (id) { const c = (Demo._cands || []).find(x => x.id === id) || {}; return { nombre_pila: 'JUAN', apellido_p: 'PEREZ', apellido_m: 'LOPEZ', correo: 'juan@correo.com', fecha_nacimiento: '1995-03-14', genero: 'Hombre', estado_civil: 'Soltero(a)', rfc: null, telefono: c.telefono || '5512345678' }; };
Demo.eliminarCandidato = async function (id) { Demo._cands = Demo._cands.filter(x => x.id !== id); };
Demo.actualizarCandidato = async function (id, patch) { const c = Demo._cands.find(x => x.id === id); Object.assign(c, patch); };

/* ----- normalización de lo que se pega desde Excel ----- */
function parseFecha(t) {
  t = String(t || '').trim(); if (!t) return '';
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = t.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/); if (m) { let y = +m[3]; if (y < 100) y += 2000; return `${y}-${pad(+m[2])}-${pad(+m[1])}`; }
  return '';
}
function aOpcion(v, lista, mapa) { // lista de textos; devuelve el texto exacto de la lista o ''
  const k = norm(v); if (!k) return '';
  for (const o of lista) if (norm(o) === k) return o;
  for (const o of lista) if (norm(o).includes(k) || (k.length > 3 && k.includes(norm(o)))) return o;
  if (mapa) for (const [pat, dest] of mapa) if (pat.test(k)) { const o = lista.find(x => norm(x) === norm(dest)); if (o) return o; }
  return '';
}
const MAPA_FUENTE = [[/R\.?R\.?S\.?S|REDES/, 'Redes Sociales'], [/CAMPA/, 'Campaña'], [/FERIA/, 'Feria Del Empleo'], [/REFERID/, 'Referido'], [/OTRO/, 'Otros']];
const MAPA_GEN = [[/R\.?R\.?H\.?H|RHHH/, 'RR.HH.'], [/GERENTE/, 'Gerente'], [/TELEFON/, 'Telefónica']];
function aExperiencia(v) {
  const k = norm(v); if (!k) return '';
  const tel = k.includes('TELEFON'), ven = k.includes('VENT'), atc = /ATENC|ATC|CLIE|CLEIN/.test(k);
  const L = IG.cat.experiencia; const g = x => L.find(o => norm(o) === norm(x)) || '';
  if (tel && ven) return g('Ventas de telefonía'); if (tel) return g('Telefonía'); if (ven && atc) return g('Ventas y atención al cliente'); if (atc) return g('Atención al cliente'); if (ven) return g('Ventas'); if (/SIN EXP|NINGUNA/.test(k)) return g('Sin experiencia'); return '';
}
const CAMPOS = [
  { k: 'fecha', h: 'Fecha de ingreso', w: 128, tipo: 'date' }, { k: 'nombre', h: 'Nombre del candidato', w: 210 }, { k: 'tel', h: 'Teléfono de contacto', w: 128 }, { k: 'idpdv', h: 'IDPDV', w: 96 },
  { k: 'fuente', h: 'Medio', w: 140, tipo: 'sel' }, { k: 'generado', h: 'Generado por (puesto)', w: 140, tipo: 'sel' }, { k: 'recl', h: 'Reclutado por', w: 170, tipo: 'nom' },
  { k: 'experiencia', h: 'Experiencia', w: 170, tipo: 'sel' }, { k: 'acomp', h: 'Acompañamiento (puesto)', w: 150, tipo: 'sel' }, { k: 'ingresa', h: 'Ingresa', w: 160, tipo: 'ing' }, { k: 'hora', h: 'Hora de ingreso', w: 100, tipo: 'time' },
  { k: 'referido', h: 'Referido por', w: 130 }, { k: 'coment', h: 'Comentarios', w: 180 }
];
const filaVacia = () => ({ fecha: '', nombre: '', tel: '', idpdv: '', fuente: '', generado: '', recl: S.me && S.me.reclutador_id && IG.cat ? nombreReclDe(S.me.reclutador_id) : '', experiencia: '', acomp: '', ingresa: '', hora: '', referido: '', coment: '' });
/* Nombres sugeridos según el puesto y la tienda (de la estructura de Maestra). Siempre se puede escribir un nombre a mano. */
const esVacante = n => !n || /^VACANTE/i.test(String(n).trim());
function personasPuesto(puesto, idpdv) {
  const t = tienda(+idpdv), L = [];
  if (t) {
    if (puesto === 'Supervisor') L.push(t.supervisor);
    else if (puesto === 'Gerente') L.push(t.gerente);
    else if (puesto === 'RR.HH.') L.push(t.rrhh);
    else if (puesto === 'Telefónica' || puesto === 'Líder Telefónica') L.push(t.lider, t.sub_terr);
  }
  if (puesto === 'Reclutador') IG.cat.recl.filter(x => !x.puesto || norm(x.puesto) === norm('Reclutador')).forEach(x => L.push(x.nombre));
  return [...new Set(L.filter(n => !esVacante(n)).map(n => String(n).replace(/\s+/g, ' ').trim()))];
}
const nombresRecl = (generado, idpdv) => { const l = personasPuesto(generado, idpdv); return l.length ? l : IG.cat.recl.map(x => x.nombre); };   // sin puesto conocido: el catálogo completo
const nombresIngresa = (puesto, idpdv) => personasPuesto(puesto, idpdv);
const nombreReclDe = id => (IG.cat.recl.find(x => String(x.id) === String(id)) || {}).nombre || '';
async function reclId(nombre, puesto) {   // el nombre escrito o elegido se busca en el catálogo; si no existe se crea
  const n = norm(nombre), f = IG.cat.recl.find(x => norm(x.nombre) === n); if (f) return f.id;
  const id = await API.reclAsegurar(String(nombre).replace(/\s+/g, ' ').trim(), puesto || null); IG.cat = await API.catIngresos(); return id;
}
Real.reclAsegurar = async function (nombre, puesto) { return Real.finRpc('reclutador_asegurar', { p_nombre: nombre, p_puesto: puesto }); };
Demo.reclAsegurar = async function (nombre) { const id = 1000 + Math.floor(Math.random() * 9000); IG.cat.recl.push({ id, nombre }); return id; };
function opcionesCampo(k, r) {
  const c = IG.cat;
  if (k === 'fuente') return c.fuentes.map(x => [String(x.id), x.fuente]); 
  if (k === 'generado') return c.generado.map(x => [x, x]); if (k === 'experiencia') return c.experiencia.map(x => [x, x]); if (k === 'acomp') return c.acomp.map(x => [x, x]); return [];
}
function valorPegado(k, t) {
  t = String(t || '').trim();
  if (k === 'fecha') return parseFecha(t);
  if (k === 'idpdv') return t.replace(/\D/g, '');
  if (k === 'tel') return t.replace(/\D/g, '').slice(-10);
  if (k === 'hora') { const m = t.match(/(\d{1,2})[:.](\d{2})/); return m ? pad(+m[1]) + ':' + m[2] : ''; }
  if (k === 'fuente') { const o = aOpcion(t, IG.cat.fuentes.map(x => x.fuente), MAPA_FUENTE); const f = IG.cat.fuentes.find(x => x.fuente === o); return f ? String(f.id) : ''; }
  if (k === 'recl') return t.replace(/\s+/g, ' ').trim();
  if (k === 'generado') return aOpcion(t, IG.cat.generado, MAPA_GEN);
  if (k === 'experiencia') return aExperiencia(t);
  if (k === 'acomp') return aOpcion(t, IG.cat.acomp);
  return t;
}
function errorFila(r) {
  const e = {};
  if (!r.fecha) e.fecha = 'Falta la fecha'; else if (r.fecha < addD(HOY, -1)) e.fecha = 'Fecha pasada';
  if (r.nombre.trim().length < 5) e.nombre = 'Escribe nombre completo';
  if (!r.idpdv) e.idpdv = 'Falta IDPDV'; else if (!tienda(+r.idpdv)) e.idpdv = 'IDPDV no existe';
  if (!r.fuente) e.fuente = 'Elige el medio'; if (!r.recl.trim()) e.recl = 'Escribe o elige quién reclutó'; if (r.tel && r.tel.length !== 10) e.tel = 'El teléfono debe tener 10 dígitos';
  return e;
}
const vacia = r => !r.fecha && !r.nombre && !r.idpdv && !r.fuente && !(r.generado || r.experiencia || r.referido || r.coment || r.tel || r.ingresa || r.hora);

/* ----- vista principal ----- */
async function vIngresos() {
  if (!IG.loaded) { $('content').innerHTML = cab('Posibles ingresos', 'Cargando…', 'mochila'); IG.cat = await API.catIngresos(); IG.grid = Array.from({ length: 12 }, filaVacia); IG.tab = can('posibles_ingresos', 'crear') ? 'captura' : 'seguimiento'; IG.loaded = true; }
  const T = [['captura', '✍️ Captura', can('posibles_ingresos', 'crear')], ['seguimiento', '📅 Seguimiento', true], ['resumen', '🗺️ Resumen', true], ['detalle', '📊 Detalle', true]].filter(x => x[2]);
  if (!T.find(x => x[0] === IG.tab)) IG.tab = T[0][0];
  let h = cab('Posibles ingresos', 'Programa los ingresos (en bloque o uno por uno), da seguimiento por región, confirma quién ingresó y mide qué reclutadores y medios convierten. El periodo se elige arriba.', 'mochila');
  h += `<div class="tools">${T.map(([k, n]) => `<button class="chip ${IG.tab === k ? 'on' : ''}" onclick="IG.tab='${k}';vIngresos()">${n}</button>`).join('')}</div><div id="ig-body"><div class="loading">Cargando…</div></div>`;
  $('content').innerHTML = h;
  try { if (IG.tab !== 'captura') { const r = rangoLibre(); await asegurarCands(r.desde, r.hasta); } else if (!IG.lista.length) await cargarCands(); } catch (e) { $('ig-body').innerHTML = `<div class="warn">No se pudieron cargar los candidatos: ${esc(e.message || e)}</div>`; return; }
  ({ captura: tCaptura, seguimiento: tSeguimiento, resumen: tResumen, detalle: tDetalle })[IG.tab]();
}
IG.rng = null;
async function cargarCands(d, h) { d = d || (IG.rng ? IG.rng[0] : addD(HOY, -120)); h = h || (IG.rng ? IG.rng[1] : addD(HOY, 60)); IG.lista = await API.candidatos(d, h); IG.rng = [d, h]; }
async function asegurarCands(d, h) {   // carga solo lo que falta del rango pedido (el periodo de arriba puede ir a fechas viejas o futuras)
  d = d < '2020-01-01' ? '2020-01-01' : d; h = h > addD(HOY, 120) ? addD(HOY, 120) : h;
  if (IG.rng && d >= IG.rng[0] && h <= IG.rng[1]) return;
  await cargarCands(IG.rng ? (d < IG.rng[0] ? d : IG.rng[0]) : (d < addD(HOY, -120) ? d : addD(HOY, -120)), IG.rng ? (h > IG.rng[1] ? h : IG.rng[1]) : (h > addD(HOY, 60) ? h : addD(HOY, 60)));
}

/* ----- captura masiva ----- */
function tCaptura() {
  const prop = S.me.permisos.posibles_ingresos.alcance === 'propio';
  let h = `<div class="card"><div class="note">Copia las filas de tu Excel (sin encabezados) en este orden: <b>fecha · nombre · teléfono · IDPDV · medio · generado por (puesto) · reclutado por · experiencia · acompañamiento (puesto) · ingresa · hora de ingreso · referido por · comentarios</b>, haz clic en la primera celda y pega con <b>Ctrl+V</b>. También puedes escribir directo. Lo que no se reconozca queda en rojo para que lo corrijas.</div>
  <datalist id="dl-tiendas">${tiendaListaOpts()}</datalist>
  <div class="tools"><button class="btn sm primary" onclick="modalCandidato()">➕ Nuevo ingreso individual</button><button class="btn sm" onclick="IG.grid.push(...Array.from({length:10},filaVacia));tCaptura()">+ 10 filas</button><button class="btn sm" onclick="limpiarVacias()">Quitar filas vacías</button><label class="btn sm xl-btn">📂 Cargar Excel<input type="file" accept=".xlsx,.xls,.csv" hidden onchange="importarExcel(this.files[0]);this.value=''"></label><button class="btn sm" onclick="IG.grid=Array.from({length:12},filaVacia);tCaptura()">Empezar de nuevo</button><span class="muted" id="g-res"></span><button class="btn primary" id="g-ok" style="margin-left:auto" onclick="guardarGrid()">Guardar candidatos</button></div>
  <div class="tbl-wrap grid-wrap"><table class="dt gt" id="gt"><thead><tr><th>#</th>${CAMPOS.map(c => `<th style="min-width:${c.w}px">${c.h}</th>`).join('')}<th></th></tr></thead><tbody>${IG.grid.map((r, i) => filaGrid(r, i)).join('')}</tbody></table></div></div>`;
  $('ig-body').innerHTML = h; resumenGrid();
  const t = $('gt');
  t.addEventListener('change', e => { const el = e.target.closest('[data-r]'); if (el && ['generado', 'acomp', 'idpdv'].includes(CAMPOS[+el.dataset.c].k)) ingListas(+el.dataset.r); });
  t.addEventListener('paste', e => {
    const el = e.target.closest('[data-r]'); if (!el) return; const txt = (e.clipboardData || window.clipboardData).getData('text'); if (!txt || !/[\t\n]/.test(txt)) return; e.preventDefault();
    const r0 = +el.dataset.r, c0 = +el.dataset.c; const filas = txt.replace(/\r/g, '').split('\n'); if (filas[filas.length - 1] === '') filas.pop();
    filas.forEach((ln, i) => { while (IG.grid.length <= r0 + i) IG.grid.push(filaVacia()); ln.split('\t').forEach((v, j) => { const c = CAMPOS[c0 + j]; if (c) IG.grid[r0 + i][c.k] = valorPegado(c.k, v); }); });
    tCaptura(); toast(filas.length + ' fila' + (filas.length > 1 ? 's' : '') + ' pegada' + (filas.length > 1 ? 's' : ''));
  });
  t.addEventListener('input', e => {
    const el = e.target.closest('[data-r]'); if (!el) return; const r = IG.grid[+el.dataset.r], k = CAMPOS[+el.dataset.c].k;
    if (k === 'idpdv') { const m = el.value.match(/^(\d+)\s*·/); const dig = m ? m[1] : el.value.replace(/\D/g, ''); if (m) el.value = dig; r.idpdv = dig; const t2 = tienda(+r.idpdv); const s2 = $('ts' + el.dataset.r); if (s2) s2.textContent = t2 ? t2.nombre : (r.idpdv ? 'IDPDV no existe' : ''); el.title = ''; if (t2) ingListas(+el.dataset.r); }
    else r[k] = el.value;
    marcar(+el.dataset.r); resumenGrid();
  });
}
const tiendaListaOpts = () => Object.values(S.cat.tiendas).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es')).map(t => `<option value="${t.idpdv} · ${esc(t.nombre)} (${esc(t.cadena || '')} · ${esc(t.estado || '')})"></option>`).join('');
function filaGrid(r, i) {
  const e = errorFila(r), vac = vacia(r);
  const celda = (c, j) => {
    const bad = !vac && e[c.k] ? 'bad' : '', ttl = !vac && e[c.k] ? ` title="${esc(e[c.k])}"` : '';
    if (c.tipo === 'sel') return `<td class="${bad}"${ttl}><select data-r="${i}" data-c="${j}"><option value=""></option>${opcionesCampo(c.k, r).map(([v, t]) => `<option value="${esc(v)}" ${v === r[c.k] ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></td>`;
    if (c.tipo === 'time') return `<td class="${bad}"${ttl}><input type="time" data-r="${i}" data-c="${j}" value="${esc(r.hora)}"></td>`;
    if (c.tipo === 'ing') return `<td class="${bad}"${ttl}><input data-r="${i}" data-c="${j}" list="dl-i${i}" value="${esc(r.ingresa)}" autocomplete="off"><datalist id="dl-i${i}">${nombresIngresa(r.acomp, r.idpdv).map(n => `<option value="${esc(n)}">`).join('')}</datalist></td>`;
    if (c.tipo === 'nom') return `<td class="${bad}"${ttl}><input data-r="${i}" data-c="${j}" list="dl-r${i}" value="${esc(r.recl)}" autocomplete="off"><datalist id="dl-r${i}">${nombresRecl(r.generado, r.idpdv).map(n => `<option value="${esc(n)}">`).join('')}</datalist></td>`;
    if (c.tipo === 'date') return `<td class="${bad}"${ttl}><input type="date" data-r="${i}" data-c="${j}" value="${esc(r.fecha)}"></td>`;
    if (c.k === 'idpdv') { const t = tienda(+r.idpdv); return `<td class="${bad}"${ttl}><input data-r="${i}" data-c="${j}" list="dl-tiendas" value="${esc(r.idpdv)}" autocomplete="off" placeholder="IDPDV o nombre"><small id="ts${i}" class="ts">${t ? esc(t.nombre) : (r.idpdv ? 'IDPDV no existe' : '')}</small></td>`; }
    return `<td class="${bad}"${ttl}><input data-r="${i}" data-c="${j}" value="${esc(r[c.k])}"></td>`;
  };
  return `<tr id="gr${i}" class="${vac ? 'vac' : ''}"><td class="n">${i + 1}</td>${CAMPOS.map(celda).join('')}<td><button class="btn sm" title="Quitar fila" onclick="IG.grid.splice(${i},1);tCaptura()">✕</button></td></tr>`;
}
function ingListas(i) {   // al cambiar tienda o puesto se renuevan los nombres sugeridos de esa fila
  const r = IG.grid[i], d1 = $('dl-r' + i), d2 = $('dl-i' + i);
  if (d1) d1.innerHTML = nombresRecl(r.generado, r.idpdv).map(n => `<option value="${esc(n)}">`).join(''); if (d2) d2.innerHTML = nombresIngresa(r.acomp, r.idpdv).map(n => `<option value="${esc(n)}">`).join('');
}
function marcar(i) { const tr = $('gr' + i); if (!tr) return; const r = IG.grid[i], e = errorFila(r), vac = vacia(r); tr.classList.toggle('vac', vac); CAMPOS.forEach((c, j) => { const td = tr.children[j + 1]; if (td) td.classList.toggle('bad', !vac && !!e[c.k]); }); }
function resumenGrid() {
  const llenas = IG.grid.filter(r => !vacia(r)), malas = llenas.filter(r => Object.keys(errorFila(r)).length);
  const dup = llenas.filter((r, i) => llenas.findIndex(x => norm(x.nombre) === norm(r.nombre) && x.fecha === r.fecha && x.nombre) !== i).length;
  const ya = llenas.filter(r => IG.lista.some(c => norm(c.nombre) === norm(r.nombre) && c.fecha_programada === r.fecha)).length;
  if ($('g-res')) $('g-res').innerHTML = `<b>${llenas.length}</b> fila${llenas.length === 1 ? '' : 's'} con datos · <span style="color:${malas.length ? 'var(--red)' : 'var(--green)'};font-weight:800">${malas.length} con errores</span>${dup + ya ? ` · <span style="color:var(--amber);font-weight:800">${dup + ya} posible${dup + ya > 1 ? 's' : ''} duplicado${dup + ya > 1 ? 's' : ''}</span>` : ''}`;
  if ($('g-ok')) $('g-ok').disabled = !llenas.length || malas.length > 0;
}
function limpiarVacias() { IG.grid = IG.grid.filter(r => !vacia(r)); while (IG.grid.length < 8) IG.grid.push(filaVacia()); tCaptura(); }
async function guardarGrid() {
  const llenas = IG.grid.filter(r => !vacia(r)); if (!llenas.length) return;
  const b = $('g-ok'); b.disabled = true; b.textContent = 'Guardando…';
  const rows = llenas.map(r => ({ nombre: r.nombre.replace(/\s+/g, ' ').trim(), telefono: r.tel || null, hora_ingreso: r.hora || null, acompanado_por: r.ingresa.trim() || null, idpdv: +r.idpdv, fecha_captura: HOY, fecha_programada: r.fecha, reclutador_id: null, fuente_id: +r.fuente, generado_por: r.generado || null, experiencia: r.experiencia || null, acompanamiento: r.acomp || null, referido_por: r.referido.trim() || null, comentarios: r.coment.trim() || null }));
  try { for (let q = 0; q < llenas.length; q++) rows[q].reclutador_id = await reclId(llenas[q].recl, llenas[q].generado); const n = await API.insertarCandidatos(rows); toast(n + ' candidato' + (n > 1 ? 's' : '') + ' guardado' + (n > 1 ? 's' : '')); IG.grid = Array.from({ length: 12 }, filaVacia); await cargarCands(); IG.tab = 'seguimiento'; vIngresos(); }
  catch (e) { b.disabled = false; b.textContent = 'Guardar candidatos'; toast('No se pudo guardar: ' + (e.message || e)); }
}

/* ----- importar Excel ----- */
const ENC = { fecha: /^(FECHA|DIA|FECHA DE INGRESO)/, nombre: /^NOMBRE/, tel: /^(TEL|CELULAR)/, ingresa: /^INGRESA/, hora: /^HORA/, idpdv: /^ID ?PDV/, fuente: /^MEDIO/, recl: /^RECLUTADO/, generado: /^GENERADO/, experiencia: /^EXPERIENCIA/, acomp: /^ACOMPA/, referido: /^REFERIDO/, coment: /^COMENT/ };
function celdaTxt(v, k) {
  if (v == null || v === '') return '';
  if (k === 'fecha' && typeof v === 'number') { const d = new Date(Math.round((v - 25569) * 864e5)); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  if (k === 'fecha' && v instanceof Date) return v.getFullYear() + '-' + pad(v.getMonth() + 1) + '-' + pad(v.getDate());
  return String(v);
}
async function importarExcel(file) {
  if (!file) return;
  if (!window.XLSX) { toast('El lector de Excel no cargó (revisa tu conexión).'); return; }
  try {
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true }); const ws = wb.Sheets[wb.SheetNames[0]];
    const m = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
    let hi = m.slice(0, 15).findIndex(r => r.some(c => /^NOMBRE/.test(norm(c))));
    const map = {}; if (hi >= 0) m[hi].forEach((c, j) => { const n = norm(c); for (const [k, re] of Object.entries(ENC)) if (re.test(n) && map[k] == null) map[k] = j; });
    const filas = m.slice(hi + 1).filter(r => r.some(c => String(c).trim() !== ''));
    const orden = CAMPOS.map(c => c.k); let n = 0, vac = 0;
    const nuevas = filas.map(r => { const o = filaVacia(); orden.forEach((k, j) => { const col = hi >= 0 && Object.keys(map).length >= 3 ? map[k] : j; if (col != null) o[k] = valorPegado(k, celdaTxt(r[col], k)); }); return o; }).filter(o => o.nombre || o.idpdv);
    IG.grid = IG.grid.filter(r => !vacia(r)).concat(nuevas); while (IG.grid.length < 12) IG.grid.push(filaVacia());
    tCaptura(); toast(`${nuevas.length} fila${nuevas.length === 1 ? '' : 's'} leída${nuevas.length === 1 ? '' : 's'} del Excel: revisa las que quedaron en rojo`);
  } catch (e) { console.error(e); toast('No pude leer el archivo: ' + (e.message || e)); }
}

/* ----- seguimiento: etiquetas por región ----- */
const okAlc = c => c.idpdv == null ? !Object.values(FL).some(Boolean) : okI(c.idpdv);
const nombreRecl = id => (IG.cat.recl.find(x => x.id === id) || {}).nombre || '—';
const nombreFuente = id => (IG.cat.fuentes.find(x => x.id === id) || {}).fuente || '—';
const PEND = ['Programado', 'Confirmado', 'Reagenda'];
const SEST = [['', 'Todos'], ['pend', '⏳ Pendientes'], ['Ingresó', '🙌 Ingresaron'], ['No llegó', '🚫 No llegó'], ['Declinó', '✖️ Declinó'], ['No contesta', '📵 No contesta']];
const hh5 = h => h ? String(h).slice(0, 5) : '';
const quienIngresa = c => c.acompanamiento && c.acompanamiento !== 'Ninguno' ? (c.acompanamiento + (c.acompanado_por ? ' · ' + c.acompanado_por : '')) : (c.acompanado_por || 'Sin acompañamiento');
function tSeguimiento() {
  const r = rangoLibre(), todos = IG.lista.filter(okAlc), pen = c => PEND.includes(c.estatus);
  const enP = todos.filter(c => c.fecha_programada >= r.desde && c.fecha_programada <= r.hasta), est = IG.sest || '';
  const porCerrar = todos.filter(c => c.fecha_programada < HOY && pen(c)).length, man = todos.filter(c => c.fecha_programada === addD(HOY, 1));
  const q = norm(IG.sq || ''), f = enP.filter(c => (!est || (est === 'pend' ? pen(c) : c.estatus === est)) && (!q || norm(c.nombre + ' ' + (c.telefono || '')).includes(q)));
  let h = `<div class="kpis"><div class="kpi"><div class="l">📅 Programados mañana</div><div class="v">${man.length}</div><div class="s">${man.filter(c => c.estatus === 'Confirmado').length} confirmados</div></div>
    <div class="kpi"><div class="l">☀️ Programados hoy</div><div class="v">${todos.filter(c => c.fecha_programada === HOY).length}</div><div class="s">${todos.filter(c => c.fecha_programada === HOY && c.estatus === 'Ingresó').length} ya ingresaron</div></div>
    <div class="kpi ${porCerrar ? 'click' : ''}" onclick="PL.modo='rango';PL.desde=addD(HOY,-30);PL.hasta=addD(HOY,-1);IG.sest='pend';render()"><div class="l">⏰ Por cerrar</div><div class="v" style="color:${porCerrar ? 'var(--red)' : 'var(--green)'}">${porCerrar}</div><div class="s">fecha pasada sin resultado</div></div>
    <div class="kpi"><div class="l">En el periodo</div><div class="v">${enP.length}</div><div class="s">${enP.filter(c => c.estatus === 'Ingresó').length} ingresaron · ${enP.filter(pen).length} pendientes</div></div></div>`;
  h += `<div class="tools" data-nocap>${SEST.map(([k, n]) => `<button class="chip ${est === k ? 'on' : ''}" onclick="IG.sest='${k}';tSeguimiento()">${n} (${k === '' ? enP.length : k === 'pend' ? enP.filter(pen).length : enP.filter(c => c.estatus === k).length})</button>`).join('')}<input type="search" id="sg-q" placeholder="🔎 Buscar nombre o teléfono…" value="${esc(IG.sq || '')}">
    <button class="btn sm" onclick="capturaDescargar($('ing-wrap'),'Posibles ingresos · ${esc(rangoTxt(r))}',subFiltros(),'posibles_ingresos')">📸 Imagen</button><button class="btn sm" onclick="capturaCopiar($('ing-wrap'),'Posibles ingresos · ${esc(rangoTxt(r))}',subFiltros())">📋 Copiar imagen para WhatsApp</button></div>`;
  const MAX = 300, vis = f.slice(0, MAX);
  if (!f.length) h += `<div class="card empty"><img src="${img('pulgares')}" alt="">No hay candidatos con estos filtros y periodo.</div>`;
  const reg = new Map(); vis.forEach(c => { const k = (tienda(c.idpdv) || {}).region || 'Sin región'; if (!reg.has(k)) reg.set(k, []); reg.get(k).push(c); });
  h += `<div id="ing-wrap" class="err-dia">${[...reg].sort((a, b) => a[0].localeCompare(b[0], 'es')).map(([rg, xs]) => `<div class="err-sup"><h4>🗺️ ${esc(rg)} <small>${xs.length} candidato${xs.length === 1 ? '' : 's'} · ${xs.filter(c => c.estatus === 'Ingresó').length} ingresaron</small></h4>${xs.sort((a, b) => a.fecha_programada.localeCompare(b.fecha_programada) || (a.hora_ingreso || '').localeCompare(b.hora_ingreso || '') || a.nombre.localeCompare(b.nombre, 'es')).map(filaCand).join('')}</div>`).join('')}</div>`;
  if (f.length > MAX) h += `<p class="muted">Mostrando ${MAX} de ${f.length}: acota el periodo o usa los filtros de arriba.</p>`;
  $('ig-body').innerHTML = h;
  $('sg-q').oninput = e => { IG.sq = e.target.value; clearTimeout(IG.t); IG.t = setTimeout(() => { const p = e.target.selectionStart; tSeguimiento(); const q2 = $('sg-q'); q2.focus(); q2.setSelectionRange(p, p); }, 250); };
}
const rangoTxt = r => r.desde === r.hasta ? fdia(r.desde) : r.todo ? 'todo el histórico' : fdate(r.desde) + ' al ' + fdate(r.hasta);
function filaCand(c) {
  const t = tienda(c.idpdv) || {}, ed = can('posibles_ingresos', 'editar');
  const ac = ed ? `<div class="acts" data-nocap>${c.estatus === 'Programado' ? `<button class="btn sm" onclick="cambiarEst('${c.id}','Confirmado')">✔️ Confirmó</button>` : ''}
    ${c.estatus !== 'Ingresó' ? `<button class="btn sm primary" onclick="modalIngreso('${c.id}')">🙌 Ingresó</button><button class="btn sm" onclick="cambiarEst('${c.id}','No llegó')">🚫 No llegó</button><button class="btn sm" onclick="cambiarEst('${c.id}','No contesta')">📵 No contesta</button><button class="btn sm" onclick="cambiarEst('${c.id}','Declinó')">✖️ Declinó</button><button class="btn sm" onclick="modalReagendar('${c.id}')">🔁 Reagendar</button>` : `<button class="btn sm" onclick="modalIngreso('${c.id}')">👤 Datos</button>`}
    <button class="btn sm" onclick="modalCandidato('${c.id}')">✏️ Editar</button>${can('posibles_ingresos', 'borrar') ? `<button class="btn sm danger" onclick="eliminarCand('${c.id}')" title="Solo candidatos creados por error">🗑</button>` : ''}</div>` : '';
  return `<div class="err-card"><div class="err-h"><b>${esc(c.nombre)}</b><small>📞 ${esc(c.telefono || 'sin teléfono')} · ${fdia(c.fecha_programada)}${c.hora_ingreso ? ' · ⏰ ' + hh5(c.hora_ingreso) : ''}</small></div>
    <div>${pillx(esc(c.estatus), ESTC[c.estatus] || 'x')} <small class="muted">IDPDV ${c.idpdv || '—'} · ${esc(t.nombre || 'Tienda no identificada')}${t.cadena ? ' · ' + esc(t.cadena) : ''}</small></div>
    <div class="muted" style="font-size:12px;font-weight:600">🧍 Ingresa: ${esc(quienIngresa(c))} · ${esc(nombreFuente(c.fuente_id))} · ${esc(nombreRecl(c.reclutador_id))}${c.reagendas ? ' · reagendó ' + c.reagendas + 'x' : ''}${c.usuario_fieldwy ? ' · ' + esc(c.usuario_fieldwy) : ''}</div>${ac}</div>`;
}
async function cambiarEst(id, est) { try { await API.actualizarCandidato(id, { estatus: est }); IG.lista.find(x => x.id === id).estatus = est; toast(est); tSeguimiento(); } catch (e) { toast('No se pudo guardar: ' + (e.message || e)); } }
async function eliminarCand(id) {
  const c = IG.lista.find(x => x.id === id); if (!confirm(`¿Eliminar a "${c.nombre}"? Solo debe usarse para candidatos creados por error. No se puede deshacer.`)) return;
  try { await API.eliminarCandidato(id); IG.lista = IG.lista.filter(x => x.id !== id); toast('Candidato eliminado'); tSeguimiento(); } catch (e) { toast('No se pudo eliminar: ' + (e.message || e)); }
}

/* ----- confirmar que ingresó: datos de identidad (los mismos que pide Fieldway) y pase automático a Altas ----- */
async function modalIngreso(id) {
  const c = IG.lista.find(x => x.id === id); let p = null; try { p = await API.datosCandidato(id); } catch (e) { }
  if (!p) { const sp = splitNombre(c.nombre); p = { nombre_pila: sp.n, apellido_p: sp.ap, apellido_m: sp.am, telefono: c.telefono || '' }; }
  $('modal').innerHTML = `<div class="mbox wide" style="width:min(720px,96vw);max-height:92vh;overflow:auto" role="dialog" aria-modal="true"><h3>🙌 ${c.estatus === 'Ingresó' ? 'Datos del ingreso' : 'Confirmar ingreso'}</h3><div class="who">${esc(c.nombre)} · ${fdate(c.fecha_programada)} · IDPDV ${c.idpdv || '—'} ${esc((tienda(c.idpdv) || {}).nombre || '')}</div>
    <div class="note">Confirma los datos como se capturan en Fieldway. Al guardar, el ingreso pasa a <b>Altas</b> (aquí queda el histórico) para que se genere su usuario.</div>
    ${identidadCampos(p, 'ci-')}<div class="row2"><div class="fld"><label>Hora de ingreso</label><input id="ci-hora" type="time" value="${esc(hh5(c.hora_ingreso))}"></div><div></div></div>
    <div class="warn" id="ci-warn" hidden></div><div class="mfoot"><button class="btn" onclick="cerrarM()">Cancelar</button><button class="btn primary" id="ci-ok">${c.estatus === 'Ingresó' ? 'Guardar datos' : 'Confirmar y pasar a Altas'}</button></div></div>`;
  $('modal').hidden = false; $('modal').onclick = e => { if (e.target.id === 'modal') cerrarM(); };
  $('ci-ok').onclick = async () => {
    const d = idLeer('ci-'), er = idErrores(d), w = $('ci-warn'); if (er.length) { w.hidden = false; w.innerHTML = er.map(esc).join('<br>'); return; }
    $('ci-ok').disabled = true;
    try { await API.confirmarIngreso(id, d, $('ci-hora').value || null); c.estatus = 'Ingresó'; c.telefono = d.telefono; c.hora_ingreso = $('ci-hora').value || null; c.nombre = [d.nombre_pila, d.apellido_p, d.apellido_m].filter(Boolean).join(' ').toUpperCase(); cerrarM(); toast('Ingreso confirmado: pasa a Altas'); tSeguimiento(); }
    catch (e) { $('ci-ok').disabled = false; w.hidden = false; w.textContent = 'No se pudo guardar: ' + (e.message || e); }
  };
}
function modalReagendar(id) {
  const c = IG.lista.find(x => x.id === id);
  $('modal').innerHTML = `<div class="mbox"><h3>🔁 Reagendar</h3><div class="who">${esc(c.nombre)} · estaba para ${fdate(c.fecha_programada)}</div><div class="row2"><div class="fld"><label>Nueva fecha</label><input type="date" id="m-f" value="${addD(HOY, 1)}" min="${HOY}"></div><div class="fld"><label>Hora de ingreso</label><input type="time" id="m-h" value="${esc(hh5(c.hora_ingreso))}"></div></div><div class="mfoot"><button class="btn" onclick="cerrarM()">Cancelar</button><button class="btn primary" id="m-ok">Reagendar</button></div></div>`; $('modal').hidden = false;
  $('modal').onclick = e => { if (e.target.id === 'modal') cerrarM(); };
  $('m-ok').onclick = async () => { const f = $('m-f').value; if (!f) return; try { const patch = { fecha_programada: f, estatus: 'Programado', reagendas: (c.reagendas || 0) + 1, hora_ingreso: $('m-h').value || null }; await API.actualizarCandidato(id, patch); Object.assign(c, patch); cerrarM(); toast('Reagendado para ' + fdate(f) + ' (queda el historial del cambio)'); tSeguimiento(); } catch (e) { toast('No se pudo guardar: ' + (e.message || e)); } };
}

/* ----- alta individual y edición de lo capturado ----- */
function modalCandidato(id) {
  const c = id ? IG.lista.find(x => x.id === id) : null, v = k => esc(c ? (c[k] == null ? '' : c[k]) : ''), t = c ? tienda(c.idpdv) : null;
  const sel = (idc, lista, val, ph) => `<select id="${idc}"><option value="">${ph || '— elige —'}</option>${lista.map(([a, b]) => `<option value="${esc(a)}" ${String(a) === String(val) ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>`;
  const cat = IG.cat;
  $('modal').innerHTML = `<div class="mbox wide" style="width:min(760px,96vw);max-height:92vh;overflow:auto" role="dialog" aria-modal="true"><h3>${c ? '✏️ Editar posible ingreso' : '➕ Nuevo posible ingreso'}</h3>
    <datalist id="cd-tl">${Object.values(S.cat.tiendas).map(x => `<option value="${x.idpdv} · ${esc(x.nombre)} (${esc(x.cadena || '')} · ${esc(x.estado || '')})">`).join('')}</datalist><datalist id="cd-ing"></datalist>
    <div class="row2"><div class="fld"><label>Fecha de ingreso *</label><input type="date" id="cd-f" value="${v('fecha_programada') || HOY}"></div><div class="fld"><label>Hora de ingreso</label><input type="time" id="cd-h" value="${esc(hh5(c && c.hora_ingreso))}"></div></div>
    <div class="row2"><div class="fld"><label>Nombre completo del candidato *</label><input id="cd-n" value="${v('nombre')}" autocomplete="off"></div><div class="fld"><label>Teléfono de contacto (10 dígitos)</label><input id="cd-t" inputmode="numeric" value="${v('telefono')}"></div></div>
    <div class="fld"><label>Tienda * (IDPDV o nombre)</label><input id="cd-p" list="cd-tl" value="${t ? esc(c.idpdv + ' · ' + t.nombre + ' (' + (t.cadena || '') + ' · ' + (t.estado || '') + ')') : ''}" placeholder="Escribe IDPDV o nombre…" oninput="cdIng()"></div>
    <div class="row2"><div class="fld"><label>Medio *</label>${sel('cd-fu', cat.fuentes.map(x => [x.id, x.fuente]), c && c.fuente_id)}</div><div class="fld"><label>Generado por (puesto)</label>${sel('cd-g', cat.generado.map(x => [x, x]), c && c.generado_por)}</div></div>
    <div class="row2"><div class="fld"><label>Reclutado por *</label><input id="cd-r" list="cd-rl" autocomplete="off" placeholder="Elige o escribe el nombre" value="${esc(c ? nombreReclDe(c.reclutador_id) : (S.me && S.me.reclutador_id ? nombreReclDe(S.me.reclutador_id) : ''))}"><datalist id="cd-rl"></datalist></div><div class="fld"><label>Experiencia</label>${sel('cd-ex', cat.experiencia.map(x => [x, x]), c && c.experiencia)}</div></div>
    <div class="row2"><div class="fld"><label>Acompañamiento (puesto)</label>${sel('cd-a', cat.acomp.map(x => [x, x]), c && c.acompanamiento)}</div><div class="fld"><label>Ingresa (nombre)</label><input id="cd-i" list="cd-ing" value="${v('acompanado_por')}" autocomplete="off"></div></div>
    <div class="row2"><div class="fld"><label>Referido por</label><input id="cd-rf" value="${v('referido_por')}"></div><div class="fld"><label>Comentarios</label><input id="cd-c" value="${v('comentarios')}"></div></div>
    <div class="warn" id="cd-warn" hidden></div><div class="mfoot"><button class="btn" onclick="cerrarM()">Cancelar</button><button class="btn primary" id="cd-ok">Guardar</button></div></div>`;
  $('modal').hidden = false; $('modal').onclick = e => { if (e.target.id === 'modal') cerrarM(); };
  const pintaRecl = () => { $('cd-rl').innerHTML = nombresRecl($('cd-g').value, parseInt($('cd-p').value, 10)).map(n => `<option value="${esc(n)}">`).join(''); };
  $('cd-g').onchange = () => { pintaRecl(); cdIng(); }; $('cd-a').onchange = cdIng; $('cd-p').oninput = () => { pintaRecl(); cdIng(); }; pintaRecl(); cdIng();
  $('cd-ok').onclick = () => candGuardar(id);
}
function cdIng() { const dl = $('cd-ing'); if (!dl) return; dl.innerHTML = nombresIngresa($('cd-a').value, parseInt($('cd-p').value, 10)).map(n => `<option value="${esc(n)}">`).join(''); }
async function candGuardar(id) {
  const g = k => limpia($(k).value), w = $('cd-warn'), idp = parseInt(g('cd-p'), 10), tel = g('cd-t').replace(/\D/g, ''), e = [];
  if (!$('cd-f').value) e.push('Falta la fecha de ingreso.'); if (g('cd-n').length < 5) e.push('Escribe el nombre completo.'); if (!idp || !tienda(idp)) e.push('Elige una tienda de la lista (empieza con su IDPDV).');
  if (!$('cd-fu').value) e.push('Elige el medio.'); if (!limpia($('cd-r').value)) e.push('Escribe o elige quién reclutó.'); if (tel && tel.length !== 10) e.push('El teléfono debe tener 10 dígitos.');
  if (e.length) { w.hidden = false; w.innerHTML = e.map(esc).join('<br>'); return; }
  const row = { nombre: g('cd-n').replace(/\s+/g, ' ').toUpperCase(), telefono: tel || null, idpdv: idp, fecha_programada: $('cd-f').value, hora_ingreso: $('cd-h').value || null, fuente_id: +$('cd-fu').value, reclutador_id: null, generado_por: $('cd-g').value || null,
    experiencia: $('cd-ex').value || null, acompanamiento: $('cd-a').value || null, acompanado_por: g('cd-i') || null, referido_por: g('cd-rf') || null, comentarios: g('cd-c') || null };
  $('cd-ok').disabled = true;
  try {
    row.reclutador_id = await reclId(limpia($('cd-r').value), $('cd-g').value);
    if (id) { const c = IG.lista.find(x => x.id === id); if (row.fecha_programada !== c.fecha_programada && PEND.includes(c.estatus)) row.reagendas = (c.reagendas || 0) + 1; await API.actualizarCandidato(id, row); Object.assign(c, row); toast('Cambios guardados (queda el historial)'); }
    else { await API.insertarCandidatos([{ ...row, fecha_captura: HOY }]); await cargarCands(); toast('Posible ingreso guardado'); }
    cerrarM(); if (IG.tab === 'captura') IG.tab = 'seguimiento'; vIngresos();
  } catch (x) { $('cd-ok').disabled = false; w.hidden = false; w.textContent = 'No se pudo guardar: ' + (x.message || x); }
}

/* ----- esquema por región, gerente y cadena (pestaña Resumen) ----- */
const CADS = ['Coppel', 'Elektra', 'Suburbia', 'Cimaco'];
function esquemaHtml(rows) {
  const cad = [...CADS, ...new Set(rows.map(c => (tienda(c.idpdv) || {}).cadena).filter(x => x && !CADS.includes(x)))];
  return `<div>` + arbol(rows, [...cad.map(c => ({ h: c, f: a => a.filter(x => (tienda(x.idpdv) || {}).cadena === c).length })), { h: 'Total general', f: a => a.length, cero: true }], { titulo: 'REGIÓN / GERENTE / SUPERVISOR / TIENDA', abrir: 2 }) + '</div>';
}
function tResumen() {
  const r = rangoLibre(), base = IG.lista.filter(okAlc).filter(c => c.fecha_programada >= r.desde && c.fecha_programada <= r.hasta && (PEND.includes(c.estatus) || c.estatus === 'Ingresó'));
  $('ig-body').innerHTML = sect('Esquema por región, gerente y cadena', '🗺️') + `<p class="note">${fmt(base.length)} ingresos (pendientes e ingresados) · ${esc(rangoTxt(r))}. Es el esquema que se comparte con Operaciones; cambia el periodo arriba.</p>
    <div class="tools" data-nocap><button class="btn sm" onclick="capturaDescargar($('esq-wrap'),'Esquema de posibles ingresos · ${esc(rangoTxt(r))}',subFiltros(),'esquema_ingresos')">📸 Imagen</button><button class="btn sm" onclick="capturaCopiar($('esq-wrap'),'Esquema de posibles ingresos · ${esc(rangoTxt(r))}',subFiltros())">📋 Copiar imagen</button></div><div id="esq-wrap" class="cap-pad">${esquemaHtml(base)}</div>`;
  drawAll();
}

/* ----- resumen y conversión ----- */
const VER = [['cand', 'Candidato'], ['supervisor', 'Supervisor'], ['zona_rrhh', 'Gerencia RR.HH.'], ['rrhh', 'RR.HH.'], ['recl', 'Reclutador'], ['fuente', 'Medio'], ['estado', 'Estado'], ['region', 'Región']];
function tDetalle() {
  const rr = rangoLibre(), desde = rr.desde, hasta = rr.hasta;
  const base = IG.lista.filter(okAlc).filter(x => x.fecha_programada >= desde && x.fecha_programada <= hasta);
  const cerr = base.filter(x => !PEND.includes(x.estatus)), ing = cerr.filter(x => x.estatus === 'Ingresó'), cnt = e => cerr.filter(x => x.estatus === e).length;
  const PAL = [C.or, C.bl, C.gr, C.pu, C.te, C.am, C.rd, '#7B8794', '#B0467B'];
  const pie = (rows, keyf, namef, o = {}) => { const g = new Map(); rows.forEach(x => { const k = keyf(x); g.set(k, (g.get(k) || 0) + 1); }); let it = [...g].map(([k, v]) => ({ n: namef(k), v })).sort((a, b) => b.v - a.v); if (it.length > 8) { const r = it.slice(7).reduce((a, b) => a + b.v, 0); it = it.slice(0, 7).concat([{ n: 'Otros', v: r }]); } return donut(it.map((x, i) => ({ ...x, c: PAL[i % PAL.length] })), { best: 1, sub: o.sub || 'candidatos' }); };
  const conv = (keyf, namef, min) => { const g = new Map(); cerr.forEach(x => { const k = keyf(x); const o = g.get(k) || { n: 0, i: 0 }; o.n++; if (x.estatus === 'Ingresó') o.i++; g.set(k, o); }); return [...g].filter(([, o]) => o.n >= min).map(([k, o]) => ({ n: namef(k), v: o.i / o.n * 100, s: `${o.i}/${o.n}`, c: o.i / o.n >= 0.75 ? C.gr : o.i / o.n >= 0.6 ? C.am : C.rd })).sort((a, b) => b.v - a.v).slice(0, 10); };
  let h = '';
  h += `<div class="tools"><span class="muted">${fmt(cerr.length)} candidatos con resultado en el periodo de arriba</span></div>`;
  h += `<div class="kpis"><div class="kpi"><div class="l">🧑‍💼 Programados</div><div class="v">${fmt(cerr.length)}</div></div><div class="kpi"><div class="l">🙌 Ingresaron</div><div class="v" style="color:var(--green)">${fmt(ing.length)}</div></div><div class="kpi"><div class="l">📈 Conversión</div><div class="v">${cerr.length ? (ing.length / cerr.length * 100).toFixed(2) + '%' : '—'}</div></div><div class="kpi"><div class="l">🚫 No llegó</div><div class="v" style="color:var(--red)">${cnt('No llegó')}</div></div><div class="kpi"><div class="l">✖️ Declinó</div><div class="v" style="color:var(--red)">${cnt('Declinó')}</div></div><div class="kpi"><div class="l">📵 No contesta</div><div class="v" style="color:var(--amber)">${cnt('No contesta')}</div></div></div>`;
  const res = ['Ingresó', 'No llegó', 'Declinó', 'No contesta', 'Reagenda'].map((e, i) => ({ n: e, v: cnt(e), c: [C.gr, C.rd, C.am, C.dk, C.gy][i] }));
  h += `<div class="grid g3"><div class="card"><h3>🎯 Resultado de los candidatos</h3>${donut(res, { sub: 'candidatos' })}</div><div class="card"><h3>🏆 Ingresos por reclutador</h3>${pie(ing, x => x.reclutador_id, nombreRecl, { sub: 'ingresos' })}</div><div class="card"><h3>📣 Ingresos por medio</h3>${pie(ing, x => x.fuente_id, nombreFuente, { sub: 'ingresos' })}</div></div>`;
  h += `<div class="grid g3"><div class="card"><h3>✖️ Declinados por medio</h3>${pie(cerr.filter(x => x.estatus === 'Declinó'), x => x.fuente_id, nombreFuente, { sub: 'declinados' })}</div><div class="card"><h3>🚫 No llegaron por reclutador</h3>${pie(cerr.filter(x => x.estatus === 'No llegó'), x => x.reclutador_id, nombreRecl, { sub: 'no llegaron' })}</div><div class="card"><h3>📵 No contestan por reclutador</h3>${pie(cerr.filter(x => x.estatus === 'No contesta'), x => x.reclutador_id, nombreRecl, { sub: 'sin respuesta' })}</div></div>`;
  h += `<div class="grid g2"><div class="card"><h3>🥇 Mejor conversión por medio</h3><p class="note">Ingresos ÷ candidatos con resultado (mín. 10).</p>${hbars(conv(x => x.fuente_id, nombreFuente, 10), C.gr, { pct: 1 })}</div><div class="card"><h3>🥇 Mejor conversión por reclutador</h3><p class="note">Mín. 15 candidatos.</p>${hbars(conv(x => x.reclutador_id, nombreRecl, 15), C.gr, { pct: 1 })}</div></div>`;
  // tabla única con vista seleccionable
  const vista = IG.ver || 'cand';
  h += sect('Detalle', '🧾') + `<div class="tools"><span>Ver por:</span><select onchange="IG.ver=this.value;tDetalle()">${VER.map(([k, n]) => `<option value="${k}" ${vista === k ? 'selected' : ''}>${n}</option>`).join('')}</select><span class="muted">Mismo periodo y filtros de arriba (elige un solo día con las fechas para el día completo)</span></div>`;
  TB = {};
  if (vista === 'cand') {
    h += tbl('t-ig', [{ h: 'Fecha', v: c => c.fecha_programada, r: c => fdate(c.fecha_programada), w: 82 }, { h: 'Candidato', t: 1, v: c => c.nombre, w: 210, r: c => `<b>${esc(c.nombre)}</b>` }, { h: 'Estatus', t: 1, v: c => c.estatus, r: c => `<span class="pill ${ESTC[c.estatus] || 'x'}">${esc(c.estatus)}</span>` }, { h: 'IDPDV', v: c => c.idpdv }, { h: 'Tienda', t: 1, v: c => (tienda(c.idpdv) || {}).nombre || '' }, { h: 'Cadena', t: 1, v: c => (tienda(c.idpdv) || {}).cadena }, { h: 'Estado', t: 1, v: c => (tienda(c.idpdv) || {}).estado },
      { h: 'Reclutador', t: 1, v: c => nombreRecl(c.reclutador_id) }, { h: 'Medio', t: 1, v: c => nombreFuente(c.fuente_id) }, { h: 'Generado por', t: 1, v: c => c.generado_por }, { h: 'Usuario Fieldwy', t: 1, v: c => c.usuario_fieldwy }, { h: 'Supervisor', t: 1, v: c => (tienda(c.idpdv) || {}).supervisor }, { h: 'Gerencia RR.HH.', t: 1, v: c => (tienda(c.idpdv) || {}).zona_rrhh }, { h: 'RR.HH.', t: 1, v: c => (tienda(c.idpdv) || {}).rrhh }],
      base, { fix: 2, search: 1, csv: 1, png: 1, file: 'posibles_ingresos_detalle', titulo: 'Posibles ingresos · detalle', sort: 0, dir: -1, maxh: '65vh', lim: 600 });
  } else {
    const kf = { supervisor: c => (tienda(c.idpdv) || {}).supervisor || 'Sin dato', zona_rrhh: c => (tienda(c.idpdv) || {}).zona_rrhh || 'Sin dato', rrhh: c => (tienda(c.idpdv) || {}).rrhh || 'Sin dato', recl: c => nombreRecl(c.reclutador_id), fuente: c => nombreFuente(c.fuente_id), estado: c => (tienda(c.idpdv) || {}).estado || 'Sin dato', region: c => (tienda(c.idpdv) || {}).region || 'Sin dato' }[vista];
    const g = new Map(); base.forEach(c => { const k = kf(c); if (!g.has(k)) g.set(k, []); g.get(k).push(c); });
    const rows = [...g].map(([k, v]) => { const ce = v.filter(x => !PEND.includes(x.estatus)); return { n: k, tot: v.length, pr: v.filter(x => PEND.includes(x.estatus)).length, i: v.filter(x => x.estatus === 'Ingresó').length, nl: v.filter(x => x.estatus === 'No llegó').length, d: v.filter(x => x.estatus === 'Declinó').length, nc: v.filter(x => x.estatus === 'No contesta').length, ce: ce.length }; });
    h += tbl('t-ig', [{ h: VER.find(x => x[0] === vista)[1], t: 1, v: r => r.n, w: 230, r: r => `<b>${esc(r.n)}</b>` }, { h: 'Candidatos', v: r => r.tot }, { h: '⏳ Pendientes', v: r => r.pr }, { h: '🙌 Ingresos', v: r => r.i, r: r => `<b class="cell-green">${r.i}</b>` }, { h: '📈 Conversión', v: r => pn(r.i, r.ce), r: r => r.ce ? `<span class="pill ${r.i / r.ce >= 0.75 ? 'g' : r.i / r.ce >= 0.6 ? 'a' : 'r'}">${(r.i / r.ce * 100).toFixed(0)}%</span>` : '—' }, { h: '🚫 No llegó', v: r => r.nl }, { h: '✖️ Declinó', v: r => r.d }, { h: '📵 No contesta', v: r => r.nc }],
      rows, { fix: 1, csv: 1, png: 1, file: 'posibles_ingresos_' + vista, titulo: 'Posibles ingresos por ' + VER.find(x => x[0] === vista)[1], sort: 3, dir: -1, maxh: '65vh' });
  }
  $('ig-body').innerHTML = h; drawAll();
}
