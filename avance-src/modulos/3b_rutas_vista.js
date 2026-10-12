/* ============================================================================================================
   MÓDULO 3b · Vista de RUTAS: lista de supervisores (los del filtro global) → calendario semanal horizontal y
   detalle de tiendas, ambos contraídos por supervisor. (La lógica de plan/simulación está en 3_rutas.js.)
   ============================================================================================================ */
const RT = {w:null, abiertos:new Set(), filtros:{}};
const RT_CACHE = new Map();
function rtSim(supIdx){
  const key = supIdx+'|'+RT.w.wObj.label+'|'+STATE.storeIdxArray.length;
  if(!RT_CACHE.has(key)) RT_CACHE.set(key, rtSimular(STATE.storeIdxArray.filter(s=>ST.supervisor[s]===supIdx), RT.w));
  return RT_CACHE.get(key);
}
(function injectCssRutas3(){
  const css = `
  .rt3-how{background:#fff; border:1px solid var(--line); border-radius:14px; padding:10px 14px; margin:0 0 12px; box-shadow:var(--shadow);}
  .rt3-how summary{cursor:pointer; font-weight:800; font-size:13px; color:var(--orange-dark);}
  .rt3-how .cols{display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:12px; margin-top:8px;}
  .rt3-how h5{margin:0 0 3px; font-size:12.5px;} .rt3-how ol{margin:0 0 4px; padding-left:18px; font-size:12px; line-height:1.5;} .rt3-how .sub{font-size:10.5px; font-weight:800; text-transform:uppercase; color:var(--text-muted); margin-top:5px;}
  .rt3-lista{background:#fff; border:1px solid var(--line); border-radius:14px; box-shadow:var(--shadow); overflow:hidden; margin-bottom:14px;}
  .rt3-row{display:flex; flex-wrap:wrap; align-items:center; gap:4px 14px; padding:10px 14px; border-bottom:1px solid #f1ede9; cursor:pointer;}
  .rt3-row:hover{background:#FFF9F3;} .rt3-row .car{color:var(--orange); font-size:11px; width:12px; transition:transform .15s;} .rt3-row.open .car{transform:rotate(90deg);}
  .rt3-row b{font-size:13px;} .rt3-row .mini{font-size:11.5px; font-weight:600; color:var(--text-muted);} .rt3-row .mini b{font-size:12px; color:var(--text);} .rt3-row .mini .w{color:var(--red); font-weight:800;}
  .rt3-body{padding:10px 14px 14px; border-bottom:2px solid var(--orange-soft); background:#FFFDFB;}
  .rt3-strip{display:flex; gap:12px; overflow-x:auto; padding:2px 2px 12px; scroll-snap-type:x proximity;}
  .rt3-strip .rt2-dia{flex:0 0 292px; scroll-snap-align:start;}
  .rt3-fil{display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin:0 0 8px; font-size:12px; font-weight:700; color:var(--text-muted);}
  .rt3-fil select{border:1.5px solid var(--line); border-radius:9px; padding:6px 9px; font:700 12px inherit; font-family:inherit; background:#fff;}
  details.rt3-fuera{margin-top:8px;} details.rt3-fuera summary{cursor:pointer; font-size:10.5px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; color:var(--blue);}
  `;
  const el = document.createElement('style'); el.id = 'rt-css3'; el.textContent = css; document.head.appendChild(el);
})();
function skeletonRutas(){
  document.getElementById('view-rutas').innerHTML = `
    <div class="page-head"><div><h2>🗺️ Rutas sugeridas</h2><div class="sub" id="rt-sub"></div></div></div>
    <div id="rt-body"></div>`;
  document.getElementById('view-rutas').addEventListener('click', e=>{
    const row = e.target.closest('.rt3-row'); if(!row) return;
    const key = row.dataset.k+'|'+row.dataset.sup, sig = row.nextElementSibling;
    if(sig && sig.classList.contains('rt3-body')){ sig.remove(); row.classList.remove('open'); RT.abiertos.delete(key); return; }
    RT.abiertos.add(key); row.classList.add('open');
    const d = document.createElement('div'); d.className = 'rt3-body'; row.after(d); rtPintarCuerpo(d, row.dataset.k, Number(row.dataset.sup));
  });
  document.getElementById('view-rutas').addEventListener('change', e=>{
    const f = e.target.dataset && e.target.dataset.rtf; if(!f) return;
    const sup = Number(e.target.dataset.sup); (RT.filtros[sup] || (RT.filtros[sup] = {res:'', mot:''}))[f] = e.target.value;
    rtTablaTiendas(sup);
  });
}
const rtLinea = s => gbxEsc(ST.nombre[s]);
/* Qué revisar en las visitas: una sola vez arriba (aplica igual para cada día y cada supervisor). */
function rtPanelPuntos(){
  const lista = (arr, sub)=>`${sub?`<div class="sub">${sub}</div>`:''}<ol>${arr.map(x=>`<li>${gbxEsc(x)}</li>`).join('')}</ol>`;
  const bloque = (tit, c)=>`<div><h5>${tit}</h5>${c.elektra?lista(c.base,'Coppel y otras cadenas')+lista(c.elektra,'Elektra'):lista(c.base)}</div>`;
  return `<details class="rt3-how"><summary>📋 Qué revisar, reforzar y hacer en las visitas (aplica igual en todos los días y supervisores) ▾</summary><div class="cols">
    ${bloque('🚀 Arranque rápido', RT_CHECK.arranque)}${bloque('📉 Productividad · 🔴 Gap actual · 🔄 Recuperación', RT_CHECK.baja)}${bloque('🚨 Cobertura', RT_CHECK.vacante)}</div></details>`;
}
/* Semana pasada de la tienda: alcance y gap TEMM, y día del promotor nuevo si lo hay. */
function rtInfoHtml(i){
  if(!i) return '';
  const alc = i.alc==null ? '—' : fmtPct(i.alc), gap = i.gap==null ? '—' : fmtSigned(i.gap);
  return `<small>Sem. pasada: TEM <b class="${i.alc==null?'':(i.alc<90?'gbx-dn':'gbx-up')}">${alc}</b> · gap <b class="${i.gap<0?'gbx-dn':''}">${gap}</b>${i.arr?` · 🚀 promotor nuevo: día <b>${i.arr}</b> de 14`:''}</small>`;
}
function rtDiaHtml(sim, d){
  const w = RT.w; const tit = rtDiaStr(w, d.k);
  if(d.estado==='descanso_est'){
    const fueraDesc = d.fuera.map(x=>{
      const motivosTxt = x.motivos.map(m=>`${RT_MOTIVO[m.key].ic} ${RT_MOTIVO[m.key].label}: ${gbxEsc(m.det)}`).join(' · ');
      return `<div class="rt2-f${x.juicio==='justificada'?'':' sin'}">🔵 <b>${rtLinea(x.s)}</b><small>${x.juicio==='justificada'?'ℹ️ Visita en día de descanso estimado, con prioridad — '+motivosTxt:'⚠️ Visita en día de descanso estimado, sin prioridad actual (alerta observativa)'}</small>${rtInfoHtml(x.info)}</div>`; }).join('');
    return `<div class="rt2-dia desc"><h5>${tit} <span class="rt2-badge">💤 Descanso estimado</span></h5><div class="rt2-vacio">Es el día de la semana con más semanas sin checks del supervisor (últimas 4): no se cargan visitas.</div>${d.fuera.length?`<details class="rt3-fuera"><summary>🔵 Visitas reales ese día (${d.fuera.length}) ▾</summary>${fueraDesc}</details>`:''}</div>`;
  }
  if(d.estado==='descanso_det') return `<div class="rt2-dia desc"><h5>${tit} <span class="rt2-badge d">💤 Descanso / ausencia detectado</span></h5><div class="rt2-vacio">Sin checks del supervisor este día (descanso, falta, incapacidad u otra incidencia).${d.movidas?` ${d.movidas} visita${d.movidas>1?'s':''} pasa${d.movidas>1?'n':''} al siguiente día disponible.`:''}</div></div>`;
  if(d.estado==='sin_plan') return `<div class="rt2-dia"><h5>${tit}</h5><div class="rt2-vacio">${d.fija?'Sin visitas sugeridas.':'Sin pendientes ni tiendas por recuperar.'}</div></div>`;
  const cl = d.cluster; const lejos = cl && cl.tier!=='local' ? `<span class="rt2-badge d">🚗 ${rtFmtH(cl.horas)}</span>` : '';
  const realiz = d.sugeridas.filter(x=>x.estado==='realizada').length;
  const estado = d.cerrado ? `<span class="rt2-badge ${d.pendientes?'pen':'ok'}">${realiz} de ${d.sugeridas.length}</span>` : (realiz ? '<span class="rt2-badge hoy">Hoy</span>' : '');
  const sug = d.sugeridas.map(x=>{
    const m = RT_MOTIVO[x.motivo.key]; const marca = x.estado==='realizada' ? '✅' : x.estado==='pendiente' ? '⚠️' : '•';
    return `<div class="rt2-s ${x.estado==='pendiente'?'pen':''}"><span class="p">${x.prio}</span><span>${marca}</span><span class="n"><b>${rtLinea(x.s)}</b>${x.repro?' <span class="rt2-badge hoy">↻</span>':''}${x.seguimiento?' <span class="rt2-badge">seguimiento</span>':''}${x.estado==='pendiente'?' <span class="rt2-badge pen">Pendiente</span>':''}<span class="m">${m.ic} ${m.label} · ${gbxEsc(x.motivo.det||'')}</span>${rtInfoHtml(x.info)}</span></div>`; }).join('');
  const fuera = d.fuera.map(x=>{
    const est = estatusTiendaDia(x.s, d.f), e = ESTATUS[est.key];
    const motivosTxt = x.motivos.map(m=>`${RT_MOTIVO[m.key].ic} ${RT_MOTIVO[m.key].label}: ${gbxEsc(m.det)}`).join(' · ');
    if(x.juicio==='justificada') return `<div class="rt2-f">🔵 <b>${rtLinea(x.s)}</b><small>ℹ️ Fuera de ruta con prioridad — ${motivosTxt}</small>${rtInfoHtml(x.info)}</div>`;
    return `<div class="rt2-f sin">🔵 <b>${rtLinea(x.s)}</b> — sin prioridad actual<small>${e.ic} ${est.key==='linea'?'Operación normal':e.label} · TEMM ≥ 90% · sin gap relevante</small>${rtInfoHtml(x.info)}<small>⚠️ Visita fuera de prioridad${x.sustituyo?' · quedaron pendientes visitas prioritarias':''} (alerta observativa)</small></div>`; }).join('');
  return `<div class="rt2-dia ${d.fija?'fija':'rec'}"><h5>${tit}${cl?` · ${gbxEsc(cl.nombre)}`:''} ${lejos} ${estado}<small>${d.fija?'ruta fija':'recuperación + pendientes'}</small></h5>
    ${d.sugeridas.length?`<div class="rt2-sec s">🟢 Sugeridas</div>${sug}`:''}
    ${d.fuera.length?`<details class="rt3-fuera"><summary>🔵 Visitas reales fuera de ruta (${d.fuera.length}) ▾</summary>${fuera}</details>`:''}</div>`;
}
function rtResumenBoxes(r){
  const fueraJ = r.fuera.filter(x=>x.juicio==='justificada').length, fueraS = r.fuera.length-fueraJ;
  return `<div class="rt2-res">
      <div><h4>Ruta</h4><ul><li><b>${r.sug}</b> visitas sugeridas</li><li><b>${r.aplic}</b> aplicables</li><li><b>${r.real}</b> realizadas según ruta</li>
        <li><b>${r.fuera.length}</b> fuera de ruta</li><li class="${r.pend?'w':''}"><b>${r.pend}</b> pendientes</li>
        <li>💤 <b>${r.descansos}</b> día${r.descansos!==1?'s':''} de descanso detectado${r.descansos!==1?'s':''}</li><li>↻ <b>${r.reprog}</b> reprogramadas</li></ul></div>
      <div><h4>Impacto · semana anterior vs. visitada</h4><ul><li><b>${r.intervenidas}</b> tiendas intervenidas</li>
        <li>🟢 <b>${r.rec}</b> recuperadas</li><li>🟡 <b>${r.par}</b> mejora parcial</li><li>🔴 <b>${r.sin}</b> sin recuperación / empeoraron</li><li>⚪ <b>${r.man}</b> se mantienen en línea</li>
        <li>Efectividad posterior a la visita: <b>${r.efect==null?'—':fmtPct(r.efect)}</b></li></ul></div>
      <div><h4>Desviaciones</h4><ul><li class="${r.pend?'w':''}">⚠️ <b>${r.pend}</b> tiendas prioritarias no visitadas</li>
        <li>🔵 <b>${r.fuera.length}</b> visitas fuera de ruta</li><li>&nbsp;&nbsp;ℹ️ <b>${fueraJ}</b> justificadas</li><li>&nbsp;&nbsp;⚠️ <b>${fueraS}</b> a tiendas sin prioridad</li></ul></div></div>`;
}
/* ---- cuerpo de cada supervisor (se genera al abrir) ---- */
function rtPintarCuerpo(el, k, supIdx){
  const sim = rtSim(supIdx);
  if(k==='cal'){
    const estr = {cubrir:'cubrirlas todas durante la semana', clusters:'repartirlas por clusters', priorizar:'priorizar las de mayor necesidad'}[sim.estrategia];
    el.innerHTML = `<div class="rt2-estr" style="margin-bottom:10px;">👥 <b>${sim.n} tiendas</b> · ${sim.clusters.length} cluster${sim.clusters.length!==1?'s':''} · estrategia: <b>${estr}</b> · capacidad <b>${sim.cap} visitas/día</b>. Desliza a la derecha para ver toda la semana →</div>
      <div class="rt3-strip">${sim.dias.map(d=>rtDiaHtml(sim, d)).join('')}</div>`;
  } else {
    el.innerHTML = `<div class="rt3-fil">Filtrar: <select data-rtf="res" data-sup="${supIdx}" aria-label="Resultado"><option value="">Todos los resultados</option>${Object.entries(RT_RES).filter(([k2])=>k2!=='nd').map(([k2,v])=>`<option value="${k2}">${v.ic} ${v.txt}</option>`).join('')}</select>
      <select data-rtf="mot" data-sup="${supIdx}" aria-label="Motivo"><option value="">Todos los motivos</option>${Object.entries(RT_MOTIVO).map(([k2,v])=>`<option value="${k2}">${v.ic} ${v.label}</option>`).join('')}<option value="fuera">🔵 Fuera de ruta</option></select></div>
      <div id="rt3-t-${supIdx}"></div>
      <div class="rt2-nota">Resultado = alcance y gap TEMM de la semana <b>anterior</b> contra la semana <b>visitada</b>: 🟢 llegó a 90% o más · 🟡 subió 10 pp o más · 🔴 sigue igual o peor · ⚪ ya estaba en línea. Es el resultado posterior a la visita, no necesariamente su efecto directo. Tiempo = promedio por visita del supervisor.</div>`;
    const f = RT.filtros[supIdx]; if(f){ el.querySelectorAll('select[data-rtf]').forEach(sel=>{ sel.value = f[sel.dataset.rtf]||''; }); }
    rtTablaTiendas(supIdx);
  }
}
function rtTablaTiendas(supIdx){
  const sim = rtSim(supIdx); const f = RT.filtros[supIdx] || {res:'', mot:''};
  const rows = sim.impactos.map(i=>{
    const m = RT_MOTIVO[i.motivo.key], e = i.ev, motKey = i.enRuta ? i.motivo.key : 'fuera';
    return {s:i.s, idpdv:ST.idpdv[i.s], nombre:ST.nombre[i.s]||String(ST.idpdv[i.s]), motKey, motTxt: i.enRuta ? `${m.ic} ${m.label}` : '🔵 Fuera de ruta', motOrd: i.enRuta ? m.ord : 9, visitas:i.visitas, tiempo:i.tiempo,
      alcPrev:e.alcPrev, alcCur:e.alcCur, gapPrev:e.gapPrev, gapCur:e.gapCur, estAntes:e.estAntes, estDespues:e.estDespues, res:e.res, resOrd:RT_RES[e.res].ord,
      _q:((ST.nombre[i.s]||'')+' '+ST.idpdv[i.s]).toLowerCase()};
  }).filter(r=>(!f.res || r.res===f.res) && (!f.mot || r.motKey===f.mot));
  const pill = k=>{ const e = k?ESTATUS[k]:null; return e ? `${e.ic} ${e.label}` : '—'; };
  gbTabla('rt3-t-'+supIdx, {
    sort:'resOrd', dir:1, rows, rowKey:r=>String(r.s), pageSize:40, maxH:'50vh', placeholder:'Buscar tienda…', fixed:2, titulo:'Rutas · detalle de tiendas · '+(DC.supervisor[supIdx]||''), archivo:'rutas_tiendas',
    cols:[
      {k:'idpdv', label:'IDPDV', t:true, f:r=>gbxEsc(r.idpdv)},
      {k:'nombre', label:'Tienda', t:true, f:r=>`<b>${gbxEsc(r.nombre)}</b>`},
      {k:'motOrd', label:'Motivo', f:r=>r.motTxt},
      {k:'visitas', label:'Visitas', f:r=>r.visitas?fmtInt(r.visitas):'<span class="cell-muted">0</span>'},
      {k:'tiempo', label:'Tiempo prom.<br>por visita', f:r=>r.tiempo==null?'<span class="cell-muted">—</span>':`${Math.round(r.tiempo)} min`},
      {k:'alcPrev', label:'Alcance TEM<br>sem. anterior', f:r=>fmtPct(r.alcPrev), cls:r=>r.alcPrev==null?'':pctClass(r.alcPrev)},
      {k:'alcCur', label:'Alcance TEM<br>sem. visitada', f:r=>fmtPct(r.alcCur), cls:r=>r.alcCur==null?'':pctClass(r.alcCur)},
      {k:'gapPrev', label:'Gap TEM<br>sem. anterior', f:r=>r.gapPrev==null?'—':fmtSigned(r.gapPrev), cls:r=>r.gapPrev<0?'cell-red':''},
      {k:'gapCur', label:'Gap TEM<br>sem. visitada', f:r=>r.gapCur==null?'—':fmtSigned(r.gapCur), cls:r=>r.gapCur<0?'cell-red':''},
      {k:'estAntes', label:'Estado<br>sem. anterior', v:r=>(ESTATUS[r.estAntes]||{orden:9}).orden, f:r=>pill(r.estAntes)},
      {k:'estDespues', label:'Estado<br>sem. visitada', v:r=>(ESTATUS[r.estDespues]||{orden:9}).orden, f:r=>pill(r.estDespues)},
      {k:'resOrd', label:'Resultado', f:r=>`<span class="rt2-res3 ${RT_RES[r.res].cls}">${RT_RES[r.res].ic} ${RT_RES[r.res].txt}</span>`},
    ]});
}
function renderRutas(){
  const semanas = semanasParaRutas(); const body = document.getElementById('rt-body');
  const sups = groupByNivel('supervisor', STATE.storeIdxArray, STATE.sumsMap).sort((a,b)=>a.label.localeCompare(b.label,'es'));
  if(!semanas || !sups.length){ body.innerHTML = '<div class="gbx-empty">Sin supervisores para este filtro.</div>'; return; }
  RT.w = rtSemanasDe(semanas.wObjetivo); RT_CACHE.clear();
  const w = RT.w, r = w.wObj.range, a = FECHAS[r.start].split('-').map(Number), b = FECHAS[r.end].split('-').map(Number);
  document.getElementById('rt-sub').innerHTML = `Semana <b>${w.wObj.label}</b> (${a[2]} ${RUTAS_MESES[a[1]-1]} – ${b[2]} ${RUTAS_MESES[b[1]-1]}) · ${sups.length} supervisor${sups.length!==1?'es':''}. Qué visitar, qué se visitó de verdad y qué resultado tuvo. Usa los filtros de arriba para elegir supervisores.`;
  const sims = sups.map(s=>({s, sim:rtSim(s.id)}));
  const sum = {sug:0, aplic:0, real:0, fuera:[], pend:0, descansos:0, reprog:0, intervenidas:0, rec:0, par:0, sin:0, man:0};
  sims.forEach(({sim})=>{ const q = sim.resumen; ['sug','aplic','real','pend','descansos','reprog','intervenidas','rec','par','sin','man'].forEach(k=>{ sum[k]+=q[k]; }); sum.fuera.push(...q.fuera); });
  const prob = sum.rec+sum.par+sum.sin; sum.efect = prob ? sum.rec/prob*100 : null;
  const auto = sims.length===1;
  const fila = (k, s, mini)=>{ const key = k+'|'+s.id, abierto = auto || RT.abiertos.has(key);
    return `<div class="rt3-row ${abierto?'open':''}" data-k="${k}" data-sup="${s.id}"><span class="car">▶</span><b>${gbxEsc(s.label)}</b><span class="mini">${s.nStores} tiendas</span><span class="mini">${mini}</span></div>${abierto?'<div class="rt3-body" data-auto="1"></div>':''}`; };
  body.innerHTML = rtPanelPuntos() + rtResumenBoxes(sum) +
    `<div class="section-title"><div class="bar"></div><h3>Calendario semanal por supervisor</h3></div>
     <div class="rt3-lista">${sims.map(({s,sim})=>{ const q = sim.resumen; return fila('cal', s, `<b>${q.real}</b> de ${q.aplic} según ruta · <b>${q.fuera.length}</b> fuera de ruta · <span class="${q.pend?'w':''}"><b>${q.pend}</b> pendientes</span> · 💤 ${q.descansos}`); }).join('')}</div>
     <div class="section-title"><div class="bar"></div><h3>Detalle de tiendas por supervisor</h3></div>
     <div class="rt3-lista">${sims.map(({s,sim})=>{ const q = sim.resumen; return fila('det', s, `<b>${q.intervenidas}</b> intervenidas · 🟢 <b>${q.rec}</b> · 🟡 <b>${q.par}</b> · 🔴 <b>${q.sin}</b> · efectividad <b>${q.efect==null?'—':fmtPct(q.efect)}</b>`); }).join('')}</div>`;
  body.querySelectorAll('.rt3-body[data-auto]').forEach(el=>{ const row = el.previousElementSibling; el.removeAttribute('data-auto'); rtPintarCuerpo(el, row.dataset.k, Number(row.dataset.sup)); });
}
