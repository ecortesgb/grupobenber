/* ============================================================================================================
   MÓDULO 3 · RUTAS: asistente operativo dinámico del supervisor
   Detectar → Priorizar → Planificar → Ejecutar → Comparar → Reajustar → Recuperar → Medir impacto.

   Al cierre de cada semana se analiza por supervisor: tiendas, clusters (distancia real con las coordenadas de TOTAL PDVS),
   gap y cumplimiento TEMM, arranques rápidos, vacantes, cuota actual, histórico de visitas y capacidad (3 a 5 visitas por día).
   La cantidad de tiendas cambia la estrategia:  ≤6 → cubrirlas todas · 7 a 14 → repartirlas por clusters · 15 o más → solo las de mayor necesidad.
   Primero se eligen clusters, después las tiendas dentro de cada uno. La ruta inicial es solo una sugerencia operativa:
   la actividad REAL (checks del supervisor) siempre manda. Si un día no hay actividad se detecta descanso/ausencia y solo se mueve lo afectado;
   lo sugerido y no visitado queda pendiente y vuelve al frente de la cola; las visitas fuera de ruta se muestran, no se ocultan, y se evalúan
   de forma observativa. Lunes a jueves = intervención prioritaria; viernes a domingo = recuperación + pendientes.
   El impacto se mide como resultado POSTERIOR a la visita (no causalidad directa).
   ============================================================================================================ */
const COORD = __COORDENADAS_JSON__ || {};
(function injectCssRutas(){
  const css = `
  .rt2-top{display:flex; flex-wrap:wrap; gap:10px 14px; align-items:center; margin:0 0 10px;}
  .rt2-top select{border:1.5px solid var(--line); border-radius:9px; padding:8px 11px; font:700 13px inherit; font-family:inherit; background:#fff; min-width:260px; max-width:100%;}
  .rt2-key{display:flex; flex-wrap:wrap; gap:4px 14px; font-size:12px; font-weight:700; color:var(--text-muted); margin:0 0 12px;}
  .rt2-estr{background:linear-gradient(135deg,#FFF4EA,#fff); border:1.5px solid var(--orange-soft); border-radius:14px; padding:11px 15px; margin:0 0 12px; font-size:13px; font-weight:600; line-height:1.5;}
  .rt2-estr b{font-weight:800;}
  .rt2-res{display:grid; grid-template-columns:repeat(auto-fit,minmax(250px,1fr)); gap:10px; margin:0 0 14px;}
  .rt2-res > div{background:#fff; border:1px solid var(--line); border-radius:14px; padding:11px 14px; box-shadow:var(--shadow);}
  .rt2-res h4{margin:0 0 6px; font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:var(--orange-dark); font-weight:800;}
  .rt2-res ul{margin:0; padding:0; list-style:none; font-size:12.5px; line-height:1.65;} .rt2-res li b{font-variant-numeric:tabular-nums;}
  .rt2-res .w{color:var(--red); font-weight:800;}
  .rt2-dias{display:grid; grid-template-columns:repeat(auto-fit,minmax(340px,1fr)); gap:12px; margin-bottom:14px;}
  .rt2-dia{background:#fff; border:1px solid var(--line); border-radius:14px; padding:11px 14px; box-shadow:var(--shadow); border-top:4px solid var(--line);}
  .rt2-dia.fija{border-top-color:var(--orange);} .rt2-dia.rec{border-top-color:var(--blue);} .rt2-dia.desc{border-top-style:dashed; background:#FAF8F6;}
  .rt2-dia h5{margin:0; font-size:13px; font-weight:800; text-transform:uppercase; letter-spacing:.03em; display:flex; gap:6px; align-items:baseline; flex-wrap:wrap;}
  .rt2-dia h5 small{font-weight:700; font-size:10.5px; color:var(--text-muted); text-transform:none; letter-spacing:0;}
  .rt2-badge{display:inline-block; padding:2px 8px; border-radius:20px; font-size:10.5px; font-weight:800; background:#f1efec; color:var(--text-muted); text-transform:none; letter-spacing:0;}
  .rt2-badge.ok{background:#e6f4e6; color:var(--green);} .rt2-badge.pen{background:#fbe6e6; color:var(--red);} .rt2-badge.hoy{background:#e3eefa; color:var(--blue);} .rt2-badge.d{background:#fdf1de; color:var(--amber);}
  .rt2-sec{font-size:10.5px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; margin:9px 0 4px;} .rt2-sec.s{color:var(--green);} .rt2-sec.f{color:var(--blue);}
  .rt2-s{display:grid; grid-template-columns:20px 18px 1fr; gap:4px; padding:4px 0; border-bottom:1px solid #f1ede9; font-size:12.5px; line-height:1.35;}
  .rt2-s .p{font-weight:800; color:var(--text-muted); font-variant-numeric:tabular-nums;} .rt2-s .n b{font-weight:800;} .rt2-s .m{display:block; font-size:11.5px; color:var(--text-muted); font-weight:600;}
  .rt2-s.pen .n b{color:var(--red);}
  .rt2-f{padding:6px 9px; margin:3px 0; border-radius:9px; background:#EEF4FB; border-left:3px solid var(--blue); font-size:12px; line-height:1.4;} .rt2-f.sin{background:#FFF8EC; border-left-color:var(--amber);}
  .rt2-f small{display:block; color:var(--text-muted); font-weight:600; font-size:11px;}
  .rt2-how{margin-top:8px; font-size:11.5px;} .rt2-how summary{cursor:pointer; font-weight:800; color:var(--orange-dark);} .rt2-how ol{margin:3px 0 6px; padding-left:18px; line-height:1.45;} .rt2-how .t{font-weight:800; margin-top:6px;}
  .rt2-vacio{font-size:12px; color:var(--text-muted); font-weight:600; padding:8px 0;}
  .rt2-imp{width:100%; border-collapse:collapse; font-size:12px;} .rt2-imp th{font-size:10px; text-transform:uppercase; color:var(--text-muted); padding:6px 8px; border-bottom:2px solid var(--orange-soft); background:#fff; text-align:center; position:static;}
  .rt2-imp td{padding:6px 8px; border-bottom:1px solid #eee7e0; text-align:center; font-variant-numeric:tabular-nums;} .rt2-imp td.t,.rt2-imp th.t{text-align:left;}
  .rt2-res3{display:inline-block; padding:2px 9px; border-radius:20px; font-weight:800; font-size:11.5px; white-space:nowrap;} .rt2-res3.g{background:#e6f4e6; color:var(--green);} .rt2-res3.a{background:#fdf1de; color:var(--amber);} .rt2-res3.r{background:#fbe6e6; color:var(--red);} .rt2-res3.n{background:#f1efec; color:var(--text-muted);}
  .rt2-nota{font-size:11.5px; color:var(--text-muted); font-weight:600; line-height:1.5; margin:6px 0 12px;}
  table.dt.st.rt2t thead th{cursor:default; white-space:normal; line-height:1.2; vertical-align:bottom;} table.dt.st.rt2t tbody tr{cursor:pointer;} table.dt.st.rt2t tbody tr:hover td{background:#FFF9F3;}
  table.dt.st.rt2t td{padding:8px 9px; text-align:center; background:#fff; vertical-align:middle;} table.dt.st.rt2t td.t,table.dt.st.rt2t th.t{text-align:left;}
  `;
  const el = document.createElement('style'); el.id = 'rt-css'; el.textContent = css; document.head.appendChild(el);
})();

const RT_KMH = 40, RT_FACTOR = 1.35, RT_CLUSTER_KM = 25, RT_FILL_KM = 12;   // el supervisor se mueve en transporte: 40 km/h reales, clusters de ≤25 km entre tiendas y relleno solo a ≤12 km
const RT_TIER = {local:{f:1, cap:99}, foraneo:{f:0.8, cap:2}, lejano:{f:0.6, cap:1}};
const RT_MOTIVO = {
  cobertura:     {ic:'🚨', label:'Cobertura',        ord:0, chk:'vacante'},
  arranque:      {ic:'🚀', label:'Arranque rápido',  ord:1, chk:'arranque'},
  recuperacion:  {ic:'🔄', label:'Recuperación',     ord:2, chk:'baja'},
  gap:           {ic:'🔴', label:'Gap actual',       ord:3, chk:'baja'},
  productividad: {ic:'📉', label:'Productividad',    ord:4, chk:'baja'},
  seguimiento:   {ic:'🟢', label:'Seguimiento',      ord:5, chk:'linea'},
};
/* Qué ver, reforzar y hacer en la visita (texto del área). Elektra tiene sus propios puntos. */
const RT_CHECK = {
  arranque: {
    base: ['Capacitación con la Instrucción Operativa de la cadena.', 'Oferta comercial.', 'Monetización: cuota vs. comisiones.',
      'Capacitación de terminales de las marcas Killer (OPPO, HONOR, XIAOMI, MOTOROLA) con fichas técnicas.', 'Revisión de inventarios.', 'Roll play de abordaje y embudo de ventas.'],
    elektra: ['Capacitación con la Instrucción Operativa de la cadena.', 'Oferta comercial.', 'Monetización: cuota vs. comisiones.',
      'Capacitación de terminales de las marcas Killer (OPPO, HONOR, XIAOMI, MOTOROLA) con fichas técnicas.', 'Revisión de inventarios.', 'Roll play de abordaje y embudo de ventas.', 'Armado de combos.', 'Registro de huella.'],
  },
  baja: {
    base: ['Capacitación con la Instrucción Operativa de la cadena: calculadora de mix ideal de venta vs. objetivo semanal de ingresos del promotor.',
      'Objetivo del 18% de share por PDV.', 'Profundidad de inventario.', 'Manteleta de promociones.', 'Encuesta de portabilidad.',
      'Equipo KILLER por PDV: enfocar la visita a los promotores a señalizar y vender estas terminales.', 'Objetivo de clientes nuevos.'],
    elektra: ['Capacitación con la Instrucción Operativa de la cadena: calculadora de mix ideal de venta vs. objetivo semanal de ingresos del promotor.',
      'Objetivo del 10% de share por PDV.', 'Revisión diaria de etiquetas para combos.', 'Transferencias.', 'Manteleta de promociones.', 'Encuesta de portabilidad.'],
  },
  vacante: {base: ['Confirmar con RR.HH. si es vacante, ausencia o baja.', 'Definir cobertura (cubre-descansos o apoyo de otra tienda) mientras se recluta.']},
  linea: {base: ['Sin acción correctiva: dar seguimiento y reconocer el resultado.']},
};
const rtEsElektra = s => /elektra/i.test(DC.cadena[ST.cadena[s]]||'');

/* ---------- geografía ---------- */
function rtGeo(s){ const c = COORD[String(ST.idpdv[s])]; return c ? {lat:c[0], lon:c[1], ciudad:c[2]||'', estado:c[3]||''} : null; }
function rtKm(a, b){
  const R = 6371, rad = Math.PI/180, dLat = (b.lat-a.lat)*rad, dLon = (b.lon-a.lon)*rad;
  const h = Math.sin(dLat/2)**2 + Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}
const rtHoras = km => km*RT_FACTOR/RT_KMH;
const rtFmtH = h => h<1 ? Math.round(h*60)+' min' : h.toFixed(1)+' h';
const rtTier = h => h>=2 ? 'lejano' : h>=1 ? 'foraneo' : 'local';
/* Clusters de un supervisor (tiendas encadenadas a ≤30 km) y su base (la tienda más central). */
function rtClusters(storeIdxs){
  const geos = new Map(storeIdxs.map(s=>[s, rtGeo(s)]));
  const conGeo = storeIdxs.filter(s=>geos.get(s));
  const par = new Map(storeIdxs.map(s=>[s,s]));
  const find = x => { while(par.get(x)!==x){ par.set(x, par.get(par.get(x))); x = par.get(x); } return x; };
  for(let i=0;i<conGeo.length;i++) for(let j=i+1;j<conGeo.length;j++)
    if(rtKm(geos.get(conGeo[i]), geos.get(conGeo[j]))<=RT_CLUSTER_KM) par.set(find(conGeo[i]), find(conGeo[j]));
  for(const s of storeIdxs){ if(geos.get(s)) continue; const p2 = conGeo.find(o=>ST.plaza[o]===ST.plaza[s]); if(p2!=null) par.set(find(s), find(p2)); }
  const grupos = new Map();
  for(const s of storeIdxs){ const r = find(s); if(!grupos.has(r)) grupos.set(r, []); grupos.get(r).push(s); }
  let base = null;
  if(conGeo.length){ let mejor = Infinity;
    for(const s of conGeo){ let t = 0; for(const o of conGeo) t += rtKm(geos.get(s), geos.get(o)); if(t<mejor){ mejor = t; base = {s, ...geos.get(s)}; } } }
  const usados = new Map();
  const clusters = [...grupos.values()].map((ss,i)=>{
    const g = ss.map(s=>geos.get(s)).filter(Boolean);
    const lat = g.length ? g.reduce((a,x)=>a+x.lat,0)/g.length : null, lon = g.length ? g.reduce((a,x)=>a+x.lon,0)/g.length : null;
    const conteo = {}; ss.forEach(s=>{ const n = (geos.get(s) && geos.get(s).ciudad) || DC.plaza[ST.plaza[s]] || 'Sin plaza'; conteo[n] = (conteo[n]||0)+1; });
    let nombre = Object.entries(conteo).sort((a,b)=>b[1]-a[1])[0][0]; nombre = nombre.charAt(0).toUpperCase()+nombre.slice(1);
    usados.set(nombre, (usados.get(nombre)||0)+1); if(usados.get(nombre)>1) nombre += ' '+usados.get(nombre);
    const km = (base && lat!=null) ? rtKm({lat,lon}, base) : 0, horas = rtHoras(km);
    return {id:i, nombre, stores:ss, km, horas, tier:rtTier(horas), lat, lon};
  });
  return {clusters, base};
}
/* Un día de traslado a una zona foránea solo se justifica con varias tiendas o peso alto. */
function rtVale(c, chunk, peso){
  if(c.tier==='lejano') return chunk.length>=2 || peso>=4;
  if(c.tier==='foraneo') return chunk.length>=2 || peso>=2;
  return true;
}

/* ---------- tiempo ---------- */
function rtHoyIdx(){
  const d = new Date(), hoy = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const i = FECHAS.indexOf(hoy);
  if(i>=0) return i;
  return hoy > FECHAS[FECHAS.length-1] ? FECHAS.length+1 : -1;       // después de los datos: todo lo anterior ya venció
}
const rtCerrado = f => f!=null && f<=ultimoDiaConDatos() && f<rtHoyIdx();
function rtSemanasDe(wObjetivo){
  const todas = SEMANAS.map((lbl,idx)=>({label:lbl, range:WEEK_RANGES[idx], idx})).filter(w=>w.range);
  const i = todas.findIndex(w=>w.label===wObjetivo.label);
  return {wObj:todas[i], wRef:i>=1?todas[i-1]:todas[i], wPrev:i>=1?todas[i-1]:null, i, todas};
}
const rtFecha = (w, k) => fechaIdxParaDia(w.wObj, RUTAS_DIAS[k]);
function rtDiaStr(w, k){ const f = rtFecha(w, k); if(f==null) return RUTAS_DIAS[k]; const [,mm,dd] = FECHAS[f].split('-').map(Number); return `${RUTAS_DIAS[k]} ${dd} ${RUTAS_MESES[mm-1]}`; }
function rtSuma(s, d0, d1){ let a = 0, c = 0; if(d1<d0) return {a, c}; for(const i of storeRowsInWeekUnfiltered(s,{start:Math.max(0,d0), end:d1})){ a += RW.altas_temm[i]||0; c += RW.cuota_temm[i]||0; } return {a, c}; }
function rtVisitoDia(s, d){ return d!=null && storeRowsInWeekUnfiltered(s,{start:d,end:d}).some(i=>(RW.visitas_sup[i]||0)>0); }

/* ---------- actividad real y descansos ---------- */
function rtActividad(storeIdxs, w){
  const vis = [];
  for(let k=0;k<7;k++){ const f = rtFecha(w, k); vis.push(new Set(f==null ? [] : storeIdxs.filter(s=>rtVisitoDia(s, f)))); }
  return vis;
}
/* Día de descanso estimado: SIEMPRE uno solo. Se miran las últimas 4 semanas (las que haya) y se toma el día de la semana sin checks
   del supervisor en más de ellas; si hay empate, el primero de la semana. Si no hay historia o trabajó todos los días, domingo. */
function rtDescansoHist(storeIdxs, w){
  const previas = w.todas.slice(Math.max(0, w.i-4), w.i);
  let mejor = null;
  for(let k=0;k<7;k++){
    let sin = 0, n = 0;
    for(const sw of previas){ const f = fechaIdxParaDia(sw, RUTAS_DIAS[k]); if(f==null || f>ultimoDiaConDatos()) continue; n++; if(!storeIdxs.some(s=>rtVisitoDia(s,f))) sin++; }
    if(n>0 && sin>0 && (!mejor || sin>mejor.sin)) mejor = {k, sin};     // '>' estricto: en empate se queda el primero
  }
  return new Set([mejor ? mejor.k : 6]);
}

/* ---------- peso y motivos ---------- */
function rtPesosBase(storeIdxs, w){
  const out = new Map(); const fLun = rtFecha(w, 0);
  for(const s of storeIdxs){
    const sums = sumRows(storeRowsInWeekUnfiltered(s, w.wRef.range)); const m = deriveMetrics(sums);
    const lossTemm = Math.max(0, -(m.gap_temm||0)), lossT = Math.max(0, -(m.gap_t||0));
    const est = fLun!=null ? estatusTiendaDia(s, fLun) : {key:'linea'};
    let mult = 1, extra = 0;
    if(est.key==='arranque'){ mult += 0.75; extra += (fLun!=null && visitasSupEnVentana(s, fLun-(est.dia-1), fLun-1)===0) ? 2 : 1; }
    else if(est.key==='vacante'){ mult += 0.25; extra += 2; }
    else if(est.key==='baja') extra += 0.8;
    // histórico de visitas: sin visita en 3 semanas suma; visitada hace menos de una semana resta
    const ult = fLun!=null ? visitasSupEnVentana(s, fLun-21, fLun-1) : 1, rec = fLun!=null ? visitasSupEnVentana(s, fLun-7, fLun-1) : 0;
    if(ult===0) extra += 1.2; else if(rec>0) extra -= 0.3;
    const cuotaAct = rtSuma(s, w.wObj.range.start, w.wObj.range.end).c;     // cuota TEMM actual: más cuota = más potencial
    const peso = Math.max(0.05, lossTemm*mult + 0.3*lossT + extra + 0.04*cuotaAct);
    out.set(s, {peso, lossTemm, alcPrev:m.alcance_temm, gapPrev:m.gap_temm||0, est});
  }
  return out;
}
/* Motivos vigentes de una tienda en un día (con lo que se sabe ANTES de ese día). */
function rtMotivos(s, k, w, base){
  const f = rtFecha(w, k); const lista = [];
  const est = f!=null ? estatusTiendaDia(s, f) : {key:'linea'};
  if(est.key==='vacante') lista.push({key:'cobertura', det:'Sin check en los 2 días previos'});
  if(est.key==='arranque') lista.push({key:'arranque', det:est.det});
  if(f!=null && f>w.wObj.range.start){
    const y = rtSuma(s, w.wObj.range.start, Math.min(f-1, ultimoDiaConDatos()));
    const gap = y.a-y.c; if(y.c>0 && y.a/y.c<0.9 && gap<=-2) lista.push({key:'gap', det:`Gap TEMM ${gap.toFixed(0)} en lo que va de la semana`});
  }
  const b = base.get(s);
  if(est.key==='baja' || (b && b.alcPrev!=null && b.alcPrev<BAJA_PROD_UMBRAL)) lista.push({key:'productividad', det:b&&b.alcPrev!=null?`${fmtPct(b.alcPrev)} de TEMM la semana anterior`:'Menos de 90% de TEMM'});
  return lista.sort((x,y)=>RT_MOTIVO[x.key].ord-RT_MOTIVO[y.key].ord);
}

/* Datos de la semana pasada de una tienda para mostrarlos junto a cada visita: alcance TEMM, gap TEMM y día del promotor nuevo. */
function rtInfoTienda(s, pesos, f){
  const b = pesos.get(s); const est = f!=null ? estatusTiendaDia(s, f) : {key:'linea'};
  return {alc:b?b.alcPrev:null, gap:b?b.gapPrev:null, arr:est.key==='arranque'?est.dia:null};
}
/* ---------- impacto de una visita ---------- */
function rtEvalVisita(s, dVisita){
  const ult = Math.min(ultimoDiaConDatos(), rtHoyIdx()-1);
  const pre = rtSuma(s, dVisita-7, dVisita-1), postFin = Math.min(dVisita+7, ult), np = postFin-dVisita;
  if(np<2) return {pendiente:true};
  const post = rtSuma(s, dVisita+1, postFin);
  const alcPre = pre.c>0 ? pre.a/pre.c*100 : null, alcPost = post.c>0 ? post.a/post.c*100 : null;
  const tPre = pre.a/7, tPost = post.a/np;
  let res;
  if(alcPost!=null && (alcPost>=90 || post.a-post.c>=0)) res = 'rec';
  else if((alcPre!=null && alcPost!=null && alcPost-alcPre>=10) || (tPost>=tPre*1.25 && tPost-tPre>=0.15)) res = 'par';
  else res = 'sin';
  return {res, tPre, tPost, gapPre:(pre.a-pre.c)/7, gapPost:(post.a-post.c)/np, alcPre, alcPost, estAntes:estatusTiendaDia(s, dVisita).key, estDespues:estatusTiendaDia(s, ult).key, np};
}
const RT_RES = {rec:{ic:'🟢', txt:'Recuperada', cls:'g', ord:0}, par:{ic:'🟡', txt:'Mejora parcial', cls:'a', ord:1}, sin:{ic:'🔴', txt:'Sin recuperación', cls:'r', ord:2},
  emp:{ic:'🔴', txt:'Empeoró', cls:'r', ord:3}, man:{ic:'⚪', txt:'Se mantiene en línea', cls:'n', ord:4}, nov:{ic:'⚠️', txt:'Sin visita (pendiente)', cls:'n', ord:5}, nd:{ic:'—', txt:'Sin dato', cls:'n', ord:6}};
/* Resultado de una tienda visitada: alcance y gap TEMM de la semana ANTERIOR vs. la semana visitada, y si cambió su estado. */
function rtEvalSemana(s, w){
  if(!w.wPrev) return {res:'nd'};
  const ult = Math.min(ultimoDiaConDatos(), rtHoyIdx()-1), d1 = Math.min(w.wObj.range.end, ult);
  const prev = rtSuma(s, w.wPrev.range.start, w.wPrev.range.end), cur = rtSuma(s, w.wObj.range.start, d1);
  const alcPrev = prev.c>0 ? prev.a/prev.c*100 : null, alcCur = cur.c>0 ? cur.a/cur.c*100 : null;
  let res = 'nd';
  if(alcPrev!=null && alcCur!=null){
    if(alcPrev<BAJA_PROD_UMBRAL) res = alcCur>=BAJA_PROD_UMBRAL ? 'rec' : (alcCur-alcPrev>=10 ? 'par' : 'sin');
    else res = alcCur>=BAJA_PROD_UMBRAL ? 'man' : 'emp';
  }
  return {res, alcPrev, alcCur, gapPrev:prev.a-prev.c, gapCur:cur.a-cur.c, estAntes:estatusTiendaDia(s, w.wPrev.range.end).key, estDespues:estatusTiendaDia(s, d1).key};
}
function rtVisitasTienda(s, w){
  let v = 0, t = 0; for(const i of storeRowsInWeekUnfiltered(s, w.wObj.range)){ v += RW.visitas_sup[i]||0; t += RW.tiempo_visita_sup[i]||0; }
  return {visitas:v, tiempo: v>0 ? t/v : null};
}

/* Día compacto dentro de un cluster: parte de la tienda de más peso y suma las de más peso que queden a ≤25 km de ella
   (así un cluster largo no pone en el mismo día dos tiendas que ya no son cercanas). */
function rtCompacto(r, cap){
  if(!r.length) return [];
  const seed = r[0], gs = rtGeo(seed); const out = [seed];
  for(const s of r.slice(1)){
    if(out.length>=cap) break;
    const g = rtGeo(s);
    if(!gs || !g || rtKm(gs, g)<=RT_CLUSTER_KM) out.push(s);
  }
  return out;
}
/* ---------- cola: clusters completos primero, relleno con tiendas cercanas, y ciclos si hay pocas tiendas ---------- */
function rtGenerarChunks(stores, pesos, clusters, cap, maxChunks, usoInicial, ciclos){
  const uso = new Map(usoInicial||[]); const set = new Set(stores);
  const fresco = ()=>new Map(clusters.map(c=>[c.id, c.stores.filter(s=>set.has(s)).sort((a,b)=>pesos.get(b).peso-pesos.get(a).peso)]));
  let rest = fresco(); const chunks = []; let prev = null, vueltas = 0;
  while(chunks.length<maxChunks){
    let mejor = null;
    for(const c of clusters){
      const t = RT_TIER[c.tier]; if((uso.get(c.id)||0)>=t.cap) continue;
      const r = rest.get(c.id); if(!r || !r.length) continue;
      const chunk = rtCompacto(r, cap); const peso = chunk.reduce((a,s)=>a+pesos.get(s).peso,0);
      if(!rtVale(c, chunk, peso)) continue;
      const val = peso*t.f*(prev===c.id?1.15:1);
      if(!mejor || val>mejor.val) mejor = {c, chunk, val};
    }
    if(!mejor){
      if(ciclos && chunks.length && vueltas<6){
        vueltas++; rest = fresco(); let hay = false;
        for(const c of clusters){ if((uso.get(c.id)||0)<RT_TIER[c.tier].cap && (rest.get(c.id)||[]).length) hay = true; }
        if(hay) continue;
      }
      break;
    }
    uso.set(mejor.c.id, (uso.get(mejor.c.id)||0)+1);
    rest.set(mejor.c.id, rest.get(mejor.c.id).filter(s=>!mejor.chunk.includes(s)));
    const chunk = mejor.chunk.slice();
    // si no llegan a la capacidad, se aprovechan tiendas CERCANAS (≤12 km del cluster) de otros clusters
    const gsC = chunk.map(rtGeo).filter(Boolean);
    if(chunk.length<cap && gsC.length){
      const centro = {lat:gsC.reduce((a,g)=>a+g.lat,0)/gsC.length, lon:gsC.reduce((a,g)=>a+g.lon,0)/gsC.length};
      const cerca = [];
      for(const c2 of clusters){ for(const s of (rest.get(c2.id)||[])){ if(chunk.includes(s)) continue; const g = rtGeo(s); if(g && rtKm(centro, g)<=RT_FILL_KM) cerca.push(s); } }
      cerca.sort((a,b)=>pesos.get(b).peso-pesos.get(a).peso);
      for(const s of cerca){ if(chunk.length>=cap) break; chunk.push(s); clusters.forEach(c2=>{ rest.set(c2.id, (rest.get(c2.id)||[]).filter(x=>x!==s)); }); }
    }
    chunks.push({cluster:mejor.c, stores:chunk, repro:false, repeat:vueltas>0}); prev = mejor.c.id;
  }
  return {chunks, uso};
}

/* ============================================================================================================
   Simulación semanal de un supervisor: plan inicial → actividad real → pendientes → reajuste → recuperación → impacto
   ============================================================================================================ */
function rtSimular(storeIdxs, w){
  const n = storeIdxs.length;
  const {clusters, base} = rtClusters(storeIdxs);
  const pesos = rtPesosBase(storeIdxs, w);
  const cap = n<=6 ? 3 : n<=14 ? 4 : 5;
  const estrategia = n<=6 ? 'cubrir' : n<=14 ? 'clusters' : 'priorizar';
  const actividad = rtActividad(storeIdxs, w);
  const descHist = rtDescansoHist(storeIdxs, w);
  const diasTrabajo = [0,1,2,3,4,5,6].filter(k=>!descHist.has(k));
  const nDiasTrab = diasTrabajo.length;
  let cand = storeIdxs.slice();
  if(estrategia==='priorizar') cand = storeIdxs.filter(s=>pesos.get(s).peso>=0.25).sort((a,b)=>pesos.get(b).peso-pesos.get(a).peso).slice(0, Math.max(1, nDiasTrab)*cap);
  const gen = rtGenerarChunks(cand, pesos, clusters, cap, nDiasTrab, null, true);
  let queue = gen.chunks.map(c=>({...c, stores:c.stores.slice()}));
  const usoSem = gen.uso;
  const visitadasSem = new Set(), forzado = new Map();
  const sugSet = new Set(), aplicSet = new Set(), realSet = new Set(), reprogSet = new Set(), pendSet = new Set(), motivoSug = new Map();
  const intervenidas = [];                              // {s, k, motivo, enRuta}
  const dias = []; let descansos = 0, fueraN = 0;
  for(let k=0;k<7;k++){
    const f = rtFecha(w, k); const cerrado = rtCerrado(f); const A = actividad[k]; const activo = A.size>0;
    const dia = {k, f, fija:k<=3, cerrado, cluster:null, sugeridas:[], fuera:[], estado:'plan', hoyParcial:false};
    // viernes: arranca la recuperación con lo que pasó de lunes a jueves + pendientes
    if(k===4 && rtCerrado(rtFecha(w,3))){
      const peso2 = new Map(pesos); const rec = [];
      for(const iv of intervenidas){
        const ev = rtEvalVisita(iv.s, rtFecha(w, iv.k)); iv.ev = ev; if(ev.pendiente) continue;
        const y = rtSuma(iv.s, w.wObj.range.start, Math.min(rtFecha(w,3), ultimoDiaConDatos()));
        if(ev.res!=='rec' && y.a-y.c<0){
          rec.push(iv.s); forzado.set(iv.s, {key:'recuperacion', det:`${RT_RES[ev.res].txt} tras la visita del ${RUTAS_DIAS[iv.k].toLowerCase()}`});
          peso2.set(iv.s, {...pesos.get(iv.s), peso:(pesos.get(iv.s)?pesos.get(iv.s).peso:0) + Math.max(0.5, y.c-y.a) + 1});
        }
      }
      const pend = []; queue.forEach(ch=>ch.stores.forEach(s=>{ if(!visitadasSem.has(s)) pend.push(s); }));
      let stores = [...new Set([...rec, ...pend])]; if(!stores.length) stores = cand.slice();
      const g2 = rtGenerarChunks(stores, peso2, clusters, cap, Math.max(1, diasTrabajo.filter(x=>x>=4).length), usoSem, true);
      queue = g2.chunks.map(c=>({...c, stores:c.stores.slice()}));
    }
    // descanso estimado por histórico: no se cargan visitas; si ese día el supervisor sí trabajó, sus visitas reales se muestran (fuera de ruta)
    if(descHist.has(k)){
      dia.estado = 'descanso_est';
      if(cerrado && activo){
        fueraN += A.size;
        dia.fuera = [...A].map(s=>{
          const m = rtMotivos(s, k, w, pesos); const just = m.length>0;
          intervenidas.push({s, k, motivo:m[0]||{key:'seguimiento', det:'Sin prioridad'}, enRuta:false});
          return {s, motivos:m, info:rtInfoTienda(s, pesos, f), juicio:just?'justificada':'sin_prioridad', sustituyo:false};
        });
        A.forEach(s=>visitadasSem.add(s));
        queue.forEach(c=>{ c.stores = c.stores.filter(s=>!A.has(s)); }); queue = queue.filter(c=>c.stores.length);
      }
      dias.push(dia); continue;
    }
    // día cerrado sin actividad: descanso/ausencia detectado; solo se mueve lo afectado (la cola no se consume)
    if(cerrado && !activo){
      dia.estado = 'descanso_det'; descansos++;
      const ch = queue[0];
      if(ch && !ch.repro){ ch.stores.forEach(s=>{ sugSet.add(s); reprogSet.add(s); }); dia.movidas = ch.stores.length; }
      dias.push(dia); continue;
    }
    let ch = queue.shift() || null;
    const utiles = c => c ? c.stores.filter(s=>c.repeat || !visitadasSem.has(s) || forzado.has(s)) : [];
    while(ch && !utiles(ch).length && queue.length) ch = queue.shift();
    if(!ch || !utiles(ch).length){   // se acabó lo nuevo: se repiten las tiendas por orden de prioridad (todos los días trabajados llevan sugeridas)
      const restantes = Math.max(1, diasTrabajo.filter(x=>x>=k).length);
      queue = rtGenerarChunks(cand.length?cand:storeIdxs, pesos, clusters, cap, restantes, usoSem, true).chunks.map(c=>({...c, repeat:true}));
      ch = queue.shift() || null;
    }
    if(!ch && !activo){ dia.estado = 'sin_plan'; dias.push(dia); continue; }
    dia.cluster = ch ? ch.cluster : null;
    const stores = (ch ? ch.stores.filter(s=>ch.repeat || !visitadasSem.has(s) || forzado.has(s)) : []).sort((a,b)=>(pesos.get(b)?pesos.get(b).peso:0)-(pesos.get(a)?pesos.get(a).peso:0));
    const hoy = f!=null && f===rtHoyIdx();
    dia.sugeridas = stores.map((s,i)=>{
      const f2 = forzado.get(s), m = rtMotivos(s, k, w, pesos), prim = f2 || m[0] || {key:'seguimiento', det:'Sin alerta: seguimiento'};
      sugSet.add(s); aplicSet.add(s); motivoSug.set(s, prim);
      return {s, prio:i+1, motivo:prim, info:rtInfoTienda(s, pesos, f), repro:!!(ch&&ch.repro), seguimiento:!!(ch&&ch.repeat), estado: cerrado ? (A.has(s)?'realizada':'pendiente') : (hoy && A.has(s) ? 'realizada' : 'futura')};
    });
    if(cerrado){
      const realizadas = dia.sugeridas.filter(x=>x.estado==='realizada'), pend = dia.sugeridas.filter(x=>x.estado==='pendiente');
      realizadas.forEach(x=>{ realSet.add(x.s); intervenidas.push({s:x.s, k, motivo:x.motivo, enRuta:true}); });
      const fuera = [...A].filter(s=>!stores.includes(s));
      fueraN += fuera.length;
      dia.fuera = fuera.map(s=>{
        const m = rtMotivos(s, k, w, pesos); const just = m.length>0;
        intervenidas.push({s, k, motivo:m[0]||{key:'seguimiento', det:'Sin prioridad'}, enRuta:false});
        return {s, motivos:m, info:rtInfoTienda(s, pesos, f), juicio:just?'justificada':'sin_prioridad', sustituyo:!just && pend.length>0};
      });
      A.forEach(s=>visitadasSem.add(s));
      // lo no visitado queda pendiente y regresa al frente de la cola; lo ya visitado sale del resto de la semana
      queue.forEach(c=>{ c.stores = c.stores.filter(s=>!A.has(s)); }); queue = queue.filter(c=>c.stores.length);
      if(pend.length){ pend.forEach(x=>{ pendSet.add(x.s); reprogSet.add(x.s); }); queue.unshift({cluster:ch.cluster, stores:pend.map(x=>x.s), repro:true}); }
      dia.pendientes = pend.length;
    }
    dias.push(dia);
  }
  const noVisitadasPrio = [...pendSet].filter(s=>!visitadasSem.has(s));
  const impactos = []; const vistas = new Set();
  const mkImp = (s, motivo, enRuta, k)=>({s, k, motivo, enRuta, ev:rtEvalSemana(s, w), ...rtVisitasTienda(s, w)});
  for(const iv of intervenidas){ if(vistas.has(iv.s)) continue; vistas.add(iv.s); impactos.push(mkImp(iv.s, iv.motivo, iv.enRuta, iv.k)); }
  for(const s of noVisitadasPrio){ if(vistas.has(s)) continue; vistas.add(s); const i = mkImp(s, motivoSug.get(s)||{key:'seguimiento', det:''}, true, null); i.ev = {...i.ev, res:'nov'}; impactos.push(i); }
  const cuenta = r=>impactos.filter(i=>i.ev.res===r).length;
  const nRec = cuenta('rec'), nPar = cuenta('par'), nSin = cuenta('sin')+cuenta('emp'), nMan = cuenta('man');
  const resumen = {sug:sugSet.size, aplic:aplicSet.size, real:realSet.size, fuera:dias.flatMap(d=>d.fuera.map(x=>({...x, k:d.k}))), pend:noVisitadasPrio.length, noVisitadasPrio,
    descansos, reprog:reprogSet.size, intervenidas:impactos.filter(i=>i.visitas>0).length, rec:nRec, par:nPar, sin:nSin, man:nMan,
    efect: (nRec+nPar+nSin) ? nRec/(nRec+nPar+nSin)*100 : null, cola:queue.reduce((a,c)=>a+c.stores.length,0)};
  return {n, estrategia, cap, clusters, base, descHist, dias, resumen, impactos, pesos};
}

