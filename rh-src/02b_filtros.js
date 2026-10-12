/* ====================================================================== BARRA GLOBAL DE FILTROS Y PERIODO (igual que Avance GB) ======================================================================
   Una sola barra para todas las secciones: periodo (solo en reportes), etiquetas de lo filtrado, filtros de sección (Cadena, Posc., Class, Resurtible, Tienda · IDPDV)
   y filtros de estructura (Región, Sub_GB, Gerente, Supervisor, Sub_Terr, Líder, Gerencia RR.HH., RR.HH.) que se pueden ocultar. En escritorio el panel aparece al pasar el mouse
   o se fija con 📌; el menú lateral es una tira de iconos que se abre al pasar el mouse o se fija con «. Las preferencias usan las mismas llaves que Avance GB.
   Las opciones de cada filtro dependen de los demás (cascada). La estructura (tiendas, supervisores, class…) viene de Maestra, no de un archivo. */
const FB_SECCION = ['cadena', 'posiciones', 'clase', 'tipo_ekt', 'idpdv'], FB_ESTR = ['region', 'subdireccion_gb', 'gerente', 'supervisor', 'sub_terr', 'lider', 'zona_rrhh', 'rrhh'];
const FB_IC = { cadena: '🔗', posiciones: '👥', clase: '🏷️', tipo_ekt: '♻️', idpdv: '🏬', region: '📍', subdireccion_gb: '🏙️', gerente: '🧑‍💼', supervisor: '🧭', sub_terr: '🗺️', lider: '🧑‍💼', zona_rrhh: '🧩', rrhh: '👤' };
const fbLs = { get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } } };
const fbEtq = k => (FCAMPOS.find(c => c[0] === k) || [k, k])[1];
const fbBase = () => (S.cat && S.cat.tiendas) ? Object.values(S.cat.tiendas) : [];
const fbVista = () => (typeof VISTAS !== 'undefined' && VISTAS.find(x => x.k === S.view)) || {};
function fbOpciones(k) {   // valores posibles de k según los demás filtros activos
  const ok = t => Object.entries(FL).every(([kk, v]) => kk === k || !v || String(t[kk]) === String(v));
  const xs = fbBase().filter(ok);
  if (k === 'idpdv') return xs.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es')).map(t => [String(t.idpdv), `${t.idpdv} — ${t.nombre}`]);
  const vs = [...new Set(xs.map(t => t[k]).filter(v => v !== null && v !== undefined && v !== ''))];
  vs.sort((a, b) => typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'es'));
  return vs.map(v => [String(v), String(v)]);
}
function fbSet(k, v) {
  FL[k] = v;
  FB_SECCION.concat(FB_ESTR).forEach(kk => { if (kk !== k && FL[kk] && !fbOpciones(kk).some(([x]) => x === String(FL[kk]))) FL[kk] = ''; });   // un filtro que ya no existe en la cascada se quita
  render();
}
function fbLimpiar() { Object.keys(FL).forEach(k => FL[k] = ''); render(); }
function fbCampo(k) {
  const ic = `<span class="fb-ic">${FB_IC[k]}</span>`;
  if (k === 'idpdv') {
    const sel = FL.idpdv ? (S.cat.tiendas[FL.idpdv] || {}) : null;
    return `<div class="fb-field fb-tienda ${FL.idpdv ? 'on tiene' : ''}"><label>${ic}Tienda · IDPDV</label><input class="ta-in" id="fb-ta" autocomplete="off" aria-label="Tienda o IDPDV" placeholder="Escribe IDPDV o nombre…" value="${esc(sel ? sel.idpdv + ' — ' + sel.nombre : '')}"><span class="ta-x" onclick="fbSet('idpdv','')" title="Quitar tienda">×</span><div class="ta-list" id="fb-ta-l" role="listbox"></div></div>`;
  }
  const ops = fbOpciones(k);
  return `<div class="fb-field ${FL[k] ? 'on' : ''}"><label>${ic}${esc(fbEtq(k))}</label><select aria-label="${esc(fbEtq(k))}" onchange="fbSet('${k}',this.value)"><option value="">${k === 'posiciones' || k === 'clase' || k === 'cadena' || k === 'region' || k === 'subdireccion_gb' ? 'Todas' : 'Todos'}</option>${ops.map(([v, t]) => `<option value="${esc(v)}" ${String(FL[k]) === v ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>`;
}
function fbTienda() {   // lista que se despliega conforme se escribe
  const inp = $('fb-ta'), lista = $('fb-ta-l'); if (!inp) return;
  let sug = [], pos = -1;
  const pintar = () => {
    const q = norm(inp.value.trim()), todas = fbOpciones('idpdv');
    sug = (q && !FL.idpdv ? todas.filter(([, t]) => norm(t).includes(q)) : todas).slice(0, 14);
    lista.innerHTML = sug.length ? sug.map(([v, t], i) => { const [id, ...r] = t.split(' — '); return `<div data-v="${esc(v)}" class="${i === pos ? 'sel' : ''}"><small>${esc(id)}</small>${esc(r.join(' — '))}</div>`; }).join('') + (todas.length > 14 && !q ? '<div class="vacio">Sigue escribiendo para ver más…</div>' : '') : '<div class="vacio">Sin coincidencias</div>';
    lista.classList.add('on');
  };
  inp.addEventListener('input', () => { if (FL.idpdv) { FL.idpdv = ''; } pos = -1; pintar(); });
  inp.addEventListener('focus', () => { if (FL.idpdv) inp.select(); pintar(); });
  inp.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { pos = Math.min(sug.length - 1, pos + 1); pintar(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { pos = Math.max(0, pos - 1); pintar(); e.preventDefault(); }
    else if (e.key === 'Enter') { const o = sug[pos >= 0 ? pos : 0]; if (o) fbSet('idpdv', o[0]); e.preventDefault(); }
    else if (e.key === 'Escape') { lista.classList.remove('on'); inp.blur(); }
  });
  inp.addEventListener('blur', () => setTimeout(() => lista.classList.remove('on'), 150));
  lista.addEventListener('mousedown', e => { const d = e.target.closest('[data-v]'); if (d) { e.preventDefault(); fbSet('idpdv', d.dataset.v); } });
}
function fbChips() {
  const act = FCAMPOS.filter(([k]) => FL[k]);
  const txt = k => k === 'idpdv' ? ((S.cat.tiendas[FL.idpdv] || {}).nombre || FL.idpdv) : FL[k];
  $('fb-chips').innerHTML = act.map(([k, l]) => `<span class="chip">${esc(l)}: ${esc(txt(k))}<button class="chip-x" type="button" aria-label="Quitar ${esc(l)}" onclick="fbSet('${k}','')">×</button></span>`).join('');
  $('fb-summary').textContent = act.length ? act.map(([k]) => txt(k)).join(' · ') : 'Sin filtros';
}

/* ---------- periodo libre (secciones que trabajan con fechas futuras, como Posibles ingresos): hoy, mañana, semana, mes, rango o todo ---------- */
const PL = { modo: 'sem', sem: 0, mes: '', desde: '', hasta: '' };
const lunesDe = d => { const x = new Date(d + 'T12:00:00'); return addD(d, -((x.getDay() + 6) % 7)); };
function rangoLibre() {
  if (PL.modo === 'hoy') return { desde: HOY, hasta: HOY, txt: 'Hoy' };
  if (PL.modo === 'man') return { desde: addD(HOY, 1), hasta: addD(HOY, 1), txt: 'Mañana' };
  if (PL.modo === 'sem') { const l = addD(lunesDe(HOY), 7 * PL.sem); return { desde: l, hasta: addD(l, 6), txt: 'Semana' }; }
  if (PL.modo === 'mes') { const m = PL.mes || HOY.slice(0, 7), n = new Date(m + '-01T12:00:00'); n.setMonth(n.getMonth() + 1); n.setDate(0); return { desde: m + '-01', hasta: n.getFullYear() + '-' + pad(n.getMonth() + 1) + '-' + pad(n.getDate()), txt: 'Mes' }; }
  if (PL.modo === 'todo') return { desde: '2020-01-01', hasta: addD(HOY, 120), txt: 'Todo', todo: true };
  const d = PL.desde || HOY, h = PL.hasta || d; return { desde: d <= h ? d : h, hasta: d <= h ? h : d, txt: 'Rango' };
}
function periodoLibreHTML() {
  const r = rangoLibre(), modos = [['hoy', '☀️ Hoy'], ['man', '🌅 Mañana'], ['sem', '📅 Semana'], ['mes', '🗓️ Mes'], ['rango', '↔️ Rango'], ['todo', '📊 Todo']];
  let ctl = '';
  if (PL.modo === 'sem') { const opts = []; for (let k = -12; k <= 4; k++) { const l = addD(lunesDe(HOY), 7 * k); opts.push(`<option value="${k}" ${k === PL.sem ? 'selected' : ''}>${fdate(l)} al ${fdate(addD(l, 6))}${k === 0 ? ' (esta semana)' : k === 1 ? ' (próxima)' : ''}</option>`); } ctl = `<select onchange="PL.sem=+this.value;render()">${opts.join('')}</select>`; }
  else if (PL.modo === 'mes') { const o = [], m0 = new Date(HOY.slice(0, 7) + '-01T12:00:00'); for (let k = -12; k <= 2; k++) { const d = new Date(m0); d.setMonth(d.getMonth() + k); const m = d.getFullYear() + '-' + pad(d.getMonth() + 1); o.push(`<option value="${m}" ${(PL.mes || HOY.slice(0, 7)) === m ? 'selected' : ''}>${mlabel(m)}${m === HOY.slice(0, 7) ? ' (en curso)' : ''}</option>`); } ctl = `<select onchange="PL.mes=this.value;render()">${o.join('')}</select>`; }
  else if (PL.modo === 'rango') ctl = `<input type="date" value="${r.desde}" onchange="PL.desde=this.value;if(!PL.hasta||PL.hasta<PL.desde)PL.hasta=PL.desde;render()"> <span>a</span> <input type="date" value="${r.hasta}" onchange="PL.hasta=this.value;if(!PL.desde)PL.desde=PL.hasta;render()">`;
  return `<div class="pb-seg">${modos.map(([k, n]) => `<button class="${PL.modo === k ? 'on' : ''}" onclick="PL.modo='${k}';if('${k}'==='rango'&&!PL.desde){PL.desde=HOY;PL.hasta=HOY}render()">${n}</button>`).join('')}</div>${ctl}<span class="pb-info">${r.todo ? 'Todo el histórico cargado' : r.desde === r.hasta ? fdate(r.desde) : fdate(r.desde) + ' al ' + fdate(r.hasta)}</span>`;
}

function fbPintar() {
  if (!S.cat || !$('filterbar')) return;
  const v = fbVista(), sinFb = !!v.sinFiltros;
  document.body.classList.toggle('sin-fb', sinFb); if (sinFb) return;
  const gen = (typeof R !== 'undefined' && R.meta && R.meta.generado) ? R.meta.generado : (S.gen || '');
  $('fb-act').textContent = gen ? '🕒 Actualizado: ' + gen : '';
  $('pbar').innerHTML = v.per === 'libre' ? periodoLibreHTML() : v.per && typeof R !== 'undefined' && R.loaded && R.meta ? periodoHTML('render', { dia: v.per === 'dia' }) : '';
  const abierta = !$('fb-row').classList.contains('est-cerrada');
  $('fb-row').innerHTML = `<div class="fb-line"><div class="fb-left">${FB_SECCION.map(fbCampo).join('')}<div class="fb-field fb-clear-wrap"><label>&nbsp;</label><button id="fb-clear" type="button" title="Quitar todos los filtros" onclick="fbLimpiar()"><span>✕</span> Quitar filtros</button></div></div>
    <div class="fb-right"><button id="fb-est-toggle" type="button" class="btn" title="Mostrar u ocultar los filtros de estructura" onclick="fbEstructura()">Estructura ${abierta ? '▾' : '▸'}</button><div class="fb-est">${FB_ESTR.map(fbCampo).join('')}</div></div></div>`;
  fbTienda(); fbChips();
}
function fbEstructura() { const r = $('fb-row'); r.classList.toggle('est-cerrada'); fbLs.set('gb_fb_est_cerrada', r.classList.contains('est-cerrada') ? '1' : '0'); $('fb-est-toggle').textContent = 'Estructura ' + (r.classList.contains('est-cerrada') ? '▸' : '▾'); }

/* panel de filtros: aparece al pasar el mouse o se fija; menú lateral: compacto o fijo; en celular el botón Filtros abre y cierra el panel */
(function () {
  let auto = fbLs.get('gb_fb_auto', '1') === '1', rail = fbLs.get('gb_sb_rail', '1') === '1';
  if (fbLs.get('gb_fb_est_cerrada', '0') === '1') $('fb-row').classList.add('est-cerrada');
  const pin = $('fb-pin'), tog = $('fb-toggle'), sbPin = $('sb-pin'), desk = () => window.matchMedia('(min-width:861px)').matches;
  function panel() {
    const modoAuto = auto && desk();
    document.body.classList.toggle('fb-auto', modoAuto); if (!modoAuto) document.body.classList.remove('fb-abierto');
    pin.textContent = auto ? '📌 Fijar filtros' : '📌 Filtros fijos'; pin.classList.toggle('on', !auto);
  }
  function menu() { document.body.classList.toggle('sb-rail', rail); sbPin.textContent = rail ? '»' : '«'; sbPin.title = rail ? 'Fijar el menú abierto' : 'Dejar el menú compacto (se abre al pasar el mouse)'; }
  pin.addEventListener('click', () => { auto = !auto; fbLs.set('gb_fb_auto', auto ? '1' : '0'); panel(); });
  tog.addEventListener('click', () => { if (desk()) document.body.classList.toggle('fb-abierto'); else { const o = $('filterbar').classList.toggle('fb-open'); tog.textContent = o ? '▲ Ocultar filtros' : '🔎 Filtros'; } });
  sbPin.addEventListener('click', e => { e.stopPropagation(); rail = !rail; fbLs.set('gb_sb_rail', rail ? '1' : '0'); menu(); });
  window.addEventListener('resize', panel); panel(); menu();
})();

Real.generado = async function () { const { data } = await sb.from('rep_meta').select('valor').eq('clave', 'ventana').maybeSingle(); return data && data.valor ? data.valor.generado : ''; };
Demo.generado = async () => 'datos de ejemplo';
