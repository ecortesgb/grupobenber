/* ============================================================================================================
   MÓDULO 6 · PROMOTORES (Modo Dirección) -- bloque CIFRADO
   Los datos por promotor (nombres, ventas, categoría) viajan comprimidos dentro de la página (gzip) y se cargan solos la primera vez que
   alguien abre una sección de promotores. Sin clave ni cifrado (decisión de Elías, 2026-10-09); si algún día se necesita privacidad,
   el esquema anterior (AES-GCM + PBKDF2, como Pospago) está en CalculoBase/exportar_promotores.antes_publico.py.
   Cuota del promotor = cuota de la tienda ese día / divisor (posiciones, o promotores presentes si fueron más), solo los días con check.
   Venta = registros (Total = todo lo que no es pospago, igual que el resto del dashboard).
   Categoría (semanal; con varias semanas se promedian los alcances):
     Dorado: total y temm >= 100% y >= 1 porta · Verde: temm >= 90%, o total >= 85%, o >= 5 portas
     Amarillo: total >= 70% o temm >= 75%, o 2 a 4 portas · Naranja: al menos la mitad de sus días con check tuvo venta
     Rojo: más de la mitad de sus días con check sin venta (o ninguna venta) · Adaptación: antigüedad < 14 días (si no es Dorado ni Verde)
   La categoría se calcula con DÍAS CERRADOS (hasta ayer): el día en curso trae checks pero casi ningún registro todavía.
   ============================================================================================================ */
const PRM = {enc: (typeof PRM_ENC !== 'undefined' ? PRM_ENC : null), d: null, listo: false, abriendo: false, error: ''};
const PRM_U = {temm_comision:.90, total_comision:.85, dorado:1.0, porta_dorado:1, porta_verde:5, porta_amarillo:[2,4],
               cerca_total:.70, cerca_temm:.75, pct_sin_venta:.5, adaptacion_dias:14};
const PRM_CATS = ['Dorado','Verde','Amarillo','Naranja','Rojo','Adaptación'];
const PRM_COLOR = {'Dorado':'#C9A227','Verde':'#1E7A1E','Amarillo':'#F2C94C','Naranja':'#F2790A','Rojo':'#DC2626','Adaptación':'#00509C'};
const PRM_DEF = {
  'Dorado':'Supera su cuota: total y temm al 100% o más y al menos 1 portabilidad en la semana.',
  'Verde':'Llega a comisionar: temm 90% o total 85%, o 5 o más portabilidades (por si su tienda tiene poco inventario).',
  'Amarillo':'Cerca de cobrar: total 70% o temm 75%, o entre 2 y 4 portabilidades.',
  'Naranja':'Vende poco, pero al menos la mitad de sus días con check tuvo una venta.',
  'Rojo':'Más de la mitad de sus días con check sin venta, o ninguna venta en la semana.',
  'Adaptación':'Menos de 2 semanas de antigüedad. Si ya es Dorado o Verde se queda ahí; si no, se muestra como Adaptación.'};

(function injectCssPrm(){
  const css = `
  .prm-lock{display:flex; gap:16px; align-items:center; background:linear-gradient(135deg,#FFF4EA,#fff); border:1.5px solid var(--orange-soft); border-radius:16px; padding:18px 20px; margin:6px 0 14px; flex-wrap:wrap;}
  .prm-lock .ic{font-size:34px;} .prm-lock b{font-size:15px;} .prm-lock p{margin:2px 0 0; font-size:12.5px; color:var(--text-muted); font-weight:600; max-width:620px;}
  .prm-lock form{display:flex; gap:8px; flex-wrap:wrap; margin-left:auto;}
  .prm-lock input{padding:9px 12px; border-radius:9px; border:1.5px solid var(--line); font:inherit; min-width:210px;}
  .prm-lock .err{width:100%; color:var(--red); font-size:12.5px; font-weight:700; min-height:16px; margin:0;}
  .prm-cats{display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:10px; margin-bottom:6px;}
  .prm-cat{background:#fff; border:1px solid var(--line); border-top:5px solid var(--cc); border-radius:12px; padding:10px 12px;}
  .prm-cat h4{margin:0; font-size:14px; display:flex; justify-content:space-between; gap:6px;} .prm-cat h4 span{font-variant-numeric:tabular-nums;}
  .prm-cat .pc{font-size:11.5px; font-weight:800; color:var(--cc);} .prm-cat p{margin:5px 0 0; font-size:11.5px; line-height:1.4; color:var(--text-muted); font-weight:600;}
  .prm-pill{display:inline-block; padding:2px 10px; border-radius:999px; font-size:11px; font-weight:800; color:#fff; background:var(--cc,#6B7280);}
  .prm-pill.am{color:#4a3b00;}
  .prm-bars{display:flex; flex-direction:column; gap:6px; margin-top:8px;}
  .prm-bar{display:grid; grid-template-columns:minmax(150px,230px) 1fr 50px; gap:8px; align-items:center; font-size:12px; font-weight:700;}
  .prm-bar .tr{display:flex; height:18px; border-radius:6px; overflow:hidden; background:#f1efec;} .prm-bar .tr i{display:block; height:100%;}
  .prm-bar .n{text-align:right; font-variant-numeric:tabular-nums; color:var(--text-muted);}
  .prm-filtros{display:flex; gap:6px; flex-wrap:wrap; align-items:center; margin-bottom:10px;}
  .prm-chipbtn{border:1.5px solid var(--line); background:#fff; border-radius:999px; padding:5px 12px; font:700 12px inherit; font-family:inherit; cursor:pointer;}
  .prm-chipbtn.on{background:var(--orange); border-color:var(--orange); color:#fff;}
  `;
  const el = document.createElement('style'); el.id = 'prm-css'; el.textContent = css; document.head.appendChild(el);
})();

/* ---------------- descifrado ---------------- */
async function prmAbrir(){
  if(PRM.listo) return;
  if(!PRM.enc) throw new Error('Esta versión no trae datos de promotores.');
  const gz = Uint8Array.from(atob(PRM.enc.gz), c => c.charCodeAt(0));
  const txt = await new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  PRM.d = JSON.parse(txt);
  prmIndexar();
  PRM.listo = true;
}
/* Carga una sola vez, la primera vez que algo de promotores lo necesita (no se paga en la carga inicial de la página). */
function prmCargar(){
  if(PRM.listo) return Promise.resolve();
  if(!PRM._promesa) PRM._promesa = prmAbrir().catch(e=>{ PRM._promesa = null; PRM.error = e.message || 'No se pudo cargar'; throw e; });
  return PRM._promesa;
}

/* ---------------- índices (una sola vez, al cargar) ---------------- */
function prmIndexar(){
  const d = PRM.d, c = d.cols, n = c.d.length, NF = FECHAS.length;
  const idMap = new Map(); ST.idpdv.forEach((v,i)=>idMap.set(Number(v), i));
  const f2i = new Map(FECHAS.map((f,i)=>[f,i]));
  const ini = new Date(d.ini + 'T00:00:00'); let maxOff = 0; for(let i=0;i<n;i++) if(c.d[i] > maxOff) maxOff = c.d[i];
  const off2f = new Int32Array(maxOff + 1).fill(-1);
  for(let o=0;o<=maxOff;o++){ const t = new Date(ini); t.setDate(t.getDate()+o); const iso = t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0'); const j = f2i.get(iso); if(j!==undefined) off2f[o] = j; }
  const fila = new Int32Array(N_STORES * NF).fill(-1);
  for(let i=0;i<N_ROWS;i++) fila[RW.store[i]*NF + RW.fecha[i]] = i;
  const X = {n, S:new Int32Array(n), D:new Int32Array(n), P:Int32Array.from(c.p), chk:Int32Array.from(c.chk), nchk:Int32Array.from(c.nchk),
             tot:Int32Array.from(c.tot), temm:Int32Array.from(c.temm), porta:Int32Array.from(c.porta), pos:Int32Array.from(c.pos), imp:Int32Array.from(c.imp),
             qT:new Float64Array(n), qM:new Float64Array(n), qP:new Float64Array(n), qS:new Float64Array(n)};
  for(let r=0;r<n;r++){
    const s = idMap.has(c.s[r]) ? idMap.get(c.s[r]) : -1, di = off2f[c.d[r]];
    X.S[r] = s; X.D[r] = di;
    if(s < 0 || di < 0) continue;
    const row = fila[s*NF + di]; if(row < 0) continue;
    const dv = Math.max(1, c.dv[r]);
    X.qT[r] = (RW.cuota_t[row]||0)/dv; X.qM[r] = (RW.cuota_temm[row]||0)/dv; X.qP[r] = (RW.cuota_porta[row]||0)/dv; X.qS[r] = (RW.cuota_pospago[row]||0)/dv;
  }
  // mix de recarga: clases por producto (t=Total, m=Temm, p=Porta), de REGISTROS (mx/ms/mn) y de VENTA REAL de proforma (rx/rs/rn)
  X.M = {reg:{}, real:{}};
  for(const p of ['t','m','p']){
    X.M.reg[p]  = {c:[0,1,2,3].map(k=>Int32Array.from(c['mx_'+p+k])), s:Float64Array.from(c['ms_'+p]), n:Int32Array.from(c['mn_'+p])};
    X.M.real[p] = {c:[0,1,2,3].map(k=>Int32Array.from(c['rx_'+p+k])), s:Float64Array.from(c['rs_'+p]), n:Int32Array.from(c['rn_'+p])};
  }
  X.pro = Int32Array.from(c.mx_pro);
  X.estado = new Int16Array(N_STORES).fill(-1);
  ST.idpdv.forEach((v,i)=>{ const e = d.est_tienda[String(Number(v))]; if(e !== undefined) X.estado[i] = e; });
  X.hoyIdx = f2i.has(d.hoy) ? f2i.get(d.hoy) : FECHAS.length;      // el día de generación aún no está cerrado
  X.ultimoCheck = new Int32Array(d.personas.length).fill(-1);
  for(let r=0;r<n;r++) if(X.chk[r] > 0 && X.D[r] > X.ultimoCheck[X.P[r]]) X.ultimoCheck[X.P[r]] = X.D[r];
  PRM.X = X;
}

/* ---------------- categoría (mismas reglas que CalculoBase/promotores.py) ---------------- */
function prmCategoria(aT, aM, nP, ventas, dck, dsv, antig){
  const U = PRM_U;
  let cat;
  if(aT >= U.dorado && aM >= U.dorado && nP >= U.porta_dorado) cat = 'Dorado';
  else if(aM >= U.temm_comision || aT >= U.total_comision || nP >= U.porta_verde) cat = 'Verde';
  else if(aT >= U.cerca_total || aM >= U.cerca_temm || (nP >= U.porta_amarillo[0] && nP <= U.porta_amarillo[1])) cat = 'Amarillo';
  else if(ventas === 0 || (dck > 0 && dsv/dck > U.pct_sin_venta)) cat = 'Rojo';
  else cat = 'Naranja';
  if(antig < U.adaptacion_dias && cat !== 'Dorado' && cat !== 'Verde') cat = 'Adaptación';
  return cat;
}
const prmAlc = (venta, cuota) => cuota > 0 ? venta/cuota : (venta > 0 ? 1 : 0);
function prmAntigClase(dias){
  if(dias == null || dias >= 9999) return '—';
  return dias < 7 ? 'Nuevo ingreso' : dias < 14 ? '1 semana' : dias < 21 ? '2 semanas' : dias < 28 ? '3 semanas' : dias < 60 ? '1 mes' : dias < 90 ? '2 meses'
       : dias < 120 ? '3 meses' : dias < 183 ? '3 a 6 meses' : dias < 365 ? '6 meses a 1 año' : '1 año o más';
}

/* ---------------- agregación promotor x semana (respeta los filtros de tienda; días cerrados) ---------------- */
function prmSemanal(a, b){
  const X = PRM.X, NP = PRM.d.personas.length, NW = SEMANAS.length;
  const ok = new Uint8Array(N_STORES); for(const s of STATE.storeIdxArray) ok[s] = 1;
  const fin = Math.min(b, X.hoyIdx - 1);
  const K = NP*NW, A = {tot:new Float64Array(K), temm:new Float64Array(K), porta:new Float64Array(K), pos:new Float64Array(K), imp:new Float64Array(K),
    qT:new Float64Array(K), qM:new Float64Array(K), qP:new Float64Array(K), qS:new Float64Array(K), dck:new Int16Array(K), dsv:new Int16Array(K),
    ult:new Int32Array(K).fill(-1), act:new Uint8Array(K)};
  const tiendasDias = new Map();                 // persona|tienda -> días con check (para la tienda principal)
  let pAct = -1, dAct = -1, chkDia = 0, ventaDia = 0, wAct = -1;
  const cerrar = () => { if(pAct < 0 || chkDia <= 0) return; const k = pAct*NW + wAct; A.dck[k]++; if(ventaDia === 0) A.dsv[k]++; if(dAct > A.ult[k]) A.ult[k] = dAct; };
  for(let r=0;r<X.n;r++){
    const s = X.S[r], di = X.D[r];
    if(s < 0 || di < 0 || !ok[s] || di < a || di > fin) continue;
    if(X.P[r] !== pAct || di !== dAct){ cerrar(); pAct = X.P[r]; dAct = di; chkDia = 0; ventaDia = 0; wAct = DATE_TO_SEMANA[di]; }
    chkDia += X.chk[r]; ventaDia += X.tot[r] + X.pos[r];
    const k = pAct*NW + wAct;
    A.tot[k] += X.tot[r]; A.temm[k] += X.temm[r]; A.porta[k] += X.porta[r]; A.pos[k] += X.pos[r]; A.imp[k] += X.imp[r];
    if(X.nchk[r] > 0 || X.tot[r] + X.pos[r] > 0) A.act[k] = 1;      // estuvo en una tienda que operamos (aunque su check no haya sido válido)
    if(X.nchk[r] > 0){ A.qT[k] += X.qT[r]; A.qM[k] += X.qM[r]; A.qP[k] += X.qP[r]; A.qS[k] += X.qS[r];
      const t = pAct+'|'+s; tiendasDias.set(t, (tiendasDias.get(t)||0) + 1); }
  }
  cerrar();
  return {A, NP, NW, fin, tiendasDias};
}

/* ---------------- promotores del periodo filtrado: una fila por promotor con su categoría ---------------- */
function prmPromotores(){
  const a = currentRange.startIdx, b = currentRange.endIdx;
  const {A, NP, NW, fin, tiendasDias} = prmSemanal(a, b);
  const P = PRM.d.personas, X = PRM.X, filas = [];
  const principal = new Map();                   // persona -> {tienda, dias, n}
  for(const [t, dias] of tiendasDias){ const [p, s] = t.split('|').map(Number); let o = principal.get(p); if(!o){ o = {s:-1, dias:0, n:0}; principal.set(p, o); } o.n++; if(dias > o.dias){ o.dias = dias; o.s = s; } }
  const finFecha = FECHAS[Math.max(0, Math.min(fin, FECHAS.length-1))];
  for(let p=0;p<NP;p++){
    const sem = [];
    for(let w=0;w<NW;w++){ const k = p*NW + w; if(A.act[k]) sem.push(k); }
    if(!sem.length) continue;
    let tot=0,temm=0,porta=0,pos=0,imp=0,qT=0,qM=0,qP=0,qS=0,dck=0,dsv=0,sT=0,sM=0,sP=0;
    for(const k of sem){ tot+=A.tot[k]; temm+=A.temm[k]; porta+=A.porta[k]; pos+=A.pos[k]; imp+=A.imp[k]; qT+=A.qT[k]; qM+=A.qM[k]; qP+=A.qP[k]; qS+=A.qS[k]; dck+=A.dck[k]; dsv+=A.dsv[k];
      sT += prmAlc(A.tot[k], A.qT[k]); sM += prmAlc(A.temm[k], A.qM[k]); sP += A.porta[k]; }
    const nw = sem.length, ing = P[p][3];
    const antig = ing ? Math.round((new Date(finFecha+'T00:00:00') - new Date(ing+'T00:00:00'))/86400000) : 9999;
    const aT = sT/nw, aM = sM/nw, nP = sP/nw;      // varias semanas: promedio de alcances y de portas por semana
    const cat = prmCategoria(aT, aM, nP, tot + pos, dck, dsv, antig);
    const pr = principal.get(p) || {s:-1, n:0};
    const ult = X.ultimoCheck[p];
    filas.push({p, codigo:P[p][0], nombre:P[p][1], rol:P[p][2], ingreso:ing, antig, antigClase:prmAntigClase(antig), cat, aT, aM, nP, tot, temm, porta, pos, imp,
      qT, qM, qP, qS, gapT:tot-qT, gapM:temm-qM, dck, dsv, semanas:nw, tienda:pr.s, nTiendas:pr.n, ultimoCheck:ult, sinCheck:(ult>=0 ? X.hoyIdx - ult : null)});
  }
  return {filas, A, NP, NW};
}

/* ---------------- distribución de categorías por semana (últimas semanas; filtros de tienda, sin recorte de fechas) ---------------- */
function prmSerieSemanal(maxSemanas){
  const {A, NP, NW} = prmSemanal(0, FECHAS.length-1), P = PRM.d.personas, X = PRM.X;
  const serie = [];
  for(let w=0;w<NW;w++){
    const rng = WEEK_RANGES[w]; if(!rng || rng.start >= X.hoyIdx) continue;
    const cont = Object.fromEntries(PRM_CATS.map(c=>[c,0])); let n = 0;
    const finSem = FECHAS[Math.min(rng.end, FECHAS.length-1)];
    for(let p=0;p<NP;p++){
      const k = p*NW + w; if(!A.act[k]) continue;
      const ing = P[p][3], antig = ing ? Math.round((new Date(finSem+'T00:00:00') - new Date(ing+'T00:00:00'))/86400000) : 9999;
      cont[prmCategoria(prmAlc(A.tot[k], A.qT[k]), prmAlc(A.temm[k], A.qM[k]), A.porta[k], A.tot[k] + A.pos[k], A.dck[k], A.dsv[k], antig)]++; n++;
    }
    if(n) serie.push({semana:SEMANAS[w], idx:w, n, ...cont});
  }
  return serie.slice(-(maxSemanas||10));
}

/* ---------------- interfaz ---------------- */
const prmCorta = (s, n) => { s = String(s==null?'':s); return s.length > n ? s.slice(0, n-1) + '…' : s; };
const prmEsc = s => String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const prmPill = cat => `<span class="prm-pill${cat==='Amarillo'?' am':''}" style="--cc:${PRM_COLOR[cat]}">${cat}</span>`;
const prmUI = {cat:new Set(), buscar:'', orden:'alcT', dir:1, pagina:1, vistaPor:'region', cargado:false};
const PRM_PAG = 50;

function prmCandado(){
  return `<div class="prm-lock"><div class="ic">⏳</div><div><b>Cargando información de promotores…</b><p id="prm-err">${prmEsc(PRM.error)}</p></div></div>`;
}
/* Antes pedía la clave; ahora solo arranca la carga y avisa cuando termina. */
function prmEnlazarCandado(alCargar){
  prmCargar().then(()=>alCargar()).catch(e=>{ const p = document.getElementById('prm-err'); if(p) p.textContent = 'No se pudo cargar: ' + (e.message || e); });
}

function skeletonPromotores(){
  document.getElementById('view-promotores').innerHTML = `
    <div class="page-head"><div><h2>🧑‍💼 Promotores</h2><div class="sub">Categoría, productividad contra la cuota de las tiendas donde checaron y alertas</div></div></div>
    <div id="prm-cuerpo"></div>`;
}
function renderPromotores(){
  const cuerpo = document.getElementById('prm-cuerpo');
  if(!PRM.enc){ cuerpo.innerHTML = '<div class="card"><p class="note">Esta versión del dashboard se generó sin la información de promotores.</p></div>'; return; }
  if(!PRM.listo){ cuerpo.innerHTML = prmCandado(); prmEnlazarCandado(()=>renderPromotores()); return; }
  const {filas} = prmPromotores();
  const conteo = Object.fromEntries(PRM_CATS.map(c=>[c,0])); filas.forEach(f=>conteo[f.cat]++);
  const total = filas.length || 1;
  const rango = `${fmtDateShort(FECHAS[currentRange.startIdx])} – ${fmtDateShort(FECHAS[Math.min(currentRange.endIdx, PRM.X.hoyIdx-1)])}`;
  cuerpo.innerHTML = `
    <div class="section-title"><div class="bar"></div><h3>Categorías de promotor <span style="font-weight:600;color:var(--text-muted);font-size:12px;">· ${filas.length} promotores · ${rango} · días cerrados</span></h3></div>
    <div class="prm-cats">${PRM_CATS.map(c=>`<div class="prm-cat" style="--cc:${PRM_COLOR[c]}"><h4>${c}<span>${conteo[c]}</span></h4><div class="pc">${(conteo[c]/total*100).toFixed(1)}% de los promotores</div><p>${PRM_DEF[c]}</p></div>`).join('')}</div>
    <p class="note" style="font-size:11.5px;color:var(--text-muted);margin:4px 2px 14px;">Con una sola semana se usa su alcance; con varias semanas, el promedio de los alcances de cada semana. La cuota de cada promotor es la de la tienda donde checó, dividida entre sus posiciones, y solo de los días con check. Venta = registros.</p>
    <div class="section-title"><div class="bar"></div><h3>Evolución semanal de categorías</h3></div>
    <div class="card tight" style="height:290px;"><canvas id="prm-serie"></canvas></div>
    <div class="section-title"><div class="bar"></div><h3>Zonas: qué tipo de promotores tiene cada una</h3></div>
    <div class="table-toolbar"><span style="font-size:12px;font-weight:700;">Ver por</span>
      <select id="prm-vista">${[['region','Región'],['gerente_lider','Gerente / Líder'],['supervisor','Supervisor'],['cadena','Cadena'],['plaza','Plaza']].map(([k,l])=>`<option value="${k}"${prmUI.vistaPor===k?' selected':''}>${l}</option>`).join('')}</select></div>
    <div class="card"><div id="prm-zonas"></div></div>
    <div class="section-title"><div class="bar"></div><h3>Detalle de promotores</h3></div>
    <div class="prm-filtros" id="prm-chips"></div>
    <div class="table-toolbar"><input class="grow" id="prm-buscar" placeholder="Buscar promotor o código…" value="${prmEsc(prmUI.buscar)}"><span id="prm-cuenta" style="font-size:12px;font-weight:700;color:var(--text-muted);"></span>
      <button class="btn" id="prm-csv">⬇ CSV</button></div>
    <div id="prm-tabla" style="overflow-x:auto;"></div><div id="prm-pag" style="margin-top:8px;"></div>
    <div class="section-title"><div class="bar"></div><h3>Alertas de promotor <span style="font-weight:600;color:var(--text-muted);font-size:12px;">· quién acumula más temas en el periodo</span></h3></div>
    <div id="prm-alertas"></div>`;
  window.__prmFilas = filas;
  prmGrafSerie(); prmZonas(filas); prmTabla();
  if(typeof prmRenderAlertas === 'function') prmRenderAlertas();
  document.getElementById('prm-vista').addEventListener('change', e=>{ prmUI.vistaPor = e.target.value; prmZonas(window.__prmFilas); });
  document.getElementById('prm-buscar').addEventListener('input', e=>{ prmUI.buscar = e.target.value; prmUI.pagina = 1; prmTabla(); });
  document.getElementById('prm-csv').addEventListener('click', prmCsv);
}

let PRM_CHART = null;
function prmGrafSerie(){
  const ctx = document.getElementById('prm-serie'); if(!ctx || typeof Chart === 'undefined') return;
  const serie = prmSerieSemanal(10);
  if(PRM_CHART) PRM_CHART.destroy();
  PRM_CHART = new Chart(ctx, {type:'bar',
    data:{labels:serie.map(s=>s.semana), datasets:PRM_CATS.map(c=>({label:c, data:serie.map(s=>s[c]), backgroundColor:PRM_COLOR[c], stack:'c'}))},
    options:{responsive:true, maintainAspectRatio:false, scales:{x:{stacked:true}, y:{stacked:true, title:{display:true, text:'Promotores'}}},
      plugins:{legend:{position:'bottom'}, tooltip:{callbacks:{footer:items=>{ const s = serie[items[0].dataIndex]; return 'Total: '+s.n; }}}}}});
}
function prmZonas(filas){
  const dim = prmUI.vistaPor, g = new Map();
  for(const f of filas){
    const lbl = f.tienda >= 0 ? (DC[dim] ? DC[dim][ST[dim][f.tienda]] : '—') : 'Sin tienda';
    let o = g.get(lbl); if(!o){ o = Object.fromEntries(PRM_CATS.map(c=>[c,0])); o.n = 0; g.set(lbl, o); }
    o[f.cat]++; o.n++;
  }
  const lista = [...g.entries()].sort((x,y)=>y[1].n - x[1].n).slice(0, 40);
  document.getElementById('prm-zonas').innerHTML = `<div class="prm-bars">${lista.map(([lbl,o])=>`<div class="prm-bar"><span title="${prmEsc(lbl)}">${prmEsc(prmCorta(lbl, 34))}</span>
    <div class="tr">${PRM_CATS.map(c=>o[c] ? `<i style="width:${o[c]/o.n*100}%;background:${PRM_COLOR[c]}" title="${c}: ${o[c]} (${(o[c]/o.n*100).toFixed(0)}%)"></i>` : '').join('')}</div><span class="n">${o.n}</span></div>`).join('')}</div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:10px;font-size:11.5px;font-weight:700;">${PRM_CATS.map(c=>`<span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${PRM_COLOR[c]};margin-right:5px;"></i>${c}</span>`).join('')}</div>`;
}
function prmFilasFiltradas(){
  let r = window.__prmFilas || [];
  if(prmUI.cat.size) r = r.filter(f=>prmUI.cat.has(f.cat));
  const q = prmUI.buscar.trim().toLowerCase();
  if(q) r = r.filter(f=>f.nombre.toLowerCase().includes(q) || f.codigo.toLowerCase().includes(q));
  const k = prmUI.orden, dir = prmUI.dir;
  const val = f => k==='cat' ? PRM_CATS.indexOf(f.cat) : k==='nombre' ? f.nombre : k==='antig' ? f.antig : k==='alcT' ? f.aT : k==='alcM' ? f.aM : k==='gapT' ? f.gapT : k==='tot' ? f.tot : k==='dck' ? f.dck : f.aT;
  return r.slice().sort((x,y)=>{ const a = val(x), b = val(y); return (typeof a==='string' ? a.localeCompare(b) : a - b) * dir; });
}
function prmTabla(){
  const chips = document.getElementById('prm-chips');
  chips.innerHTML = `<button class="prm-chipbtn${prmUI.cat.size?'':' on'}" data-c="">Todas</button>` + PRM_CATS.map(c=>`<button class="prm-chipbtn${prmUI.cat.has(c)?' on':''}" data-c="${c}">${c}</button>`).join('');
  chips.querySelectorAll('button').forEach(b=>b.addEventListener('click', ()=>{ const c = b.dataset.c; if(!c) prmUI.cat.clear(); else if(prmUI.cat.has(c)) prmUI.cat.delete(c); else prmUI.cat.add(c); prmUI.pagina = 1; prmTabla(); }));
  const r = prmFilasFiltradas(), pag = Math.max(1, Math.ceil(r.length/PRM_PAG)); if(prmUI.pagina > pag) prmUI.pagina = pag;
  const ini = (prmUI.pagina-1)*PRM_PAG, trozo = r.slice(ini, ini+PRM_PAG);
  document.getElementById('prm-cuenta').textContent = `${fmtInt(r.length)} promotores`;
  const th = (k, t) => `<th data-k="${k}" title="Ordenar">${t}${prmUI.orden===k ? (prmUI.dir>0?' ▲':' ▼') : ''}</th>`;
  const estatus = f => f.sinCheck == null ? '—' : f.sinCheck <= 1 ? 'Activo' : `Sin check ${f.sinCheck} d`;
  document.getElementById('prm-tabla').innerHTML = `<table class="dt st gbt"><thead><tr>${th('nombre','Promotor')}${th('cat','Categoría')}${th('antig','Antigüedad')}<th>Estatus</th><th>Tienda principal</th>${th('dck','Días con check')}
    ${th('tot','Venta total')}<th>Temm</th><th>Porta</th><th>Pospago</th><th>Cuota total</th><th>Cuota temm</th>${th('alcT','Alcance total')}<th>Alcance temm</th>${th('gapT','Gap total')}</tr></thead><tbody>
    ${trozo.map(f=>`<tr><td class="sticky-col" title="${prmEsc(f.codigo)}">${prmEsc(prmCorta(f.nombre, 30))}${f.rol==='Cubre descansos'?' <small>(cubre)</small>':''}</td><td>${prmPill(f.cat)}</td><td>${f.antigClase}</td><td>${estatus(f)}</td>
      <td style="text-align:left">${f.tienda>=0 ? prmEsc(prmCorta(ST.nombre[f.tienda], 28)) : '—'}${f.nTiendas>1 ? ` <small>+${f.nTiendas-1}</small>` : ''}</td><td>${f.dck}</td>
      <td>${fmtInt(f.tot)}</td><td>${fmtInt(f.temm)}</td><td>${fmtInt(f.porta)}</td><td>${fmtInt(f.pos)}</td><td>${f.qT.toFixed(1)}</td><td>${f.qM.toFixed(1)}</td>
      <td class="${pctClass(f.aT*100)}">${fmtPct(f.aT*100)}</td><td class="${pctClass(f.aM*100)}">${fmtPct(f.aM*100)}</td><td>${f.gapT>=0?'+':''}${f.gapT.toFixed(1)}</td></tr>`).join('') || '<tr><td colspan="15">Sin promotores con este filtro.</td></tr>'}</tbody></table>`;
  document.querySelectorAll('#prm-tabla th[data-k]').forEach(h=>h.addEventListener('click', ()=>{ const k = h.dataset.k; if(prmUI.orden===k) prmUI.dir *= -1; else { prmUI.orden = k; prmUI.dir = (k==='nombre'||k==='cat') ? 1 : -1; } prmTabla(); }));
  document.getElementById('prm-pag').innerHTML = pag > 1 ? `<button class="btn" id="prm-ant"${prmUI.pagina<=1?' disabled':''}>◀</button> <span style="font-size:12px;font-weight:700;margin:0 8px;">Página ${prmUI.pagina} de ${pag}</span> <button class="btn" id="prm-sig"${prmUI.pagina>=pag?' disabled':''}>▶</button>` : '';
  const ant = document.getElementById('prm-ant'), sig = document.getElementById('prm-sig');
  if(ant) ant.addEventListener('click', ()=>{ prmUI.pagina--; prmTabla(); }); if(sig) sig.addEventListener('click', ()=>{ prmUI.pagina++; prmTabla(); });
}
function prmCsv(){
  const r = prmFilasFiltradas(), enc = ['Codigo','Promotor','Rol','Categoria','Antiguedad','Tienda principal','Tiendas','Dias con check','Venta total','Temm','Porta','Pospago','Cuota total','Cuota temm','Alcance total','Alcance temm','Gap total'];
  const q = v => '"'+String(v==null?'':v).replace(/"/g,'""')+'"';
  const lineas = [enc.join(',')].concat(r.map(f=>[f.codigo,f.nombre,f.rol,f.cat,f.antigClase,f.tienda>=0?ST.nombre[f.tienda]:'',f.nTiendas,f.dck,f.tot,f.temm,f.porta,f.pos,f.qT.toFixed(2),f.qM.toFixed(2),(f.aT*100).toFixed(1),(f.aM*100).toFixed(1),f.gapT.toFixed(2)].map(q).join(',')));
  const blob = new Blob(['﻿'+lineas.join('\r\n')], {type:'text/csv;charset=utf-8'}); const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'promotores_'+FECHAS[currentRange.startIdx]+'_'+FECHAS[currentRange.endIdx]+'.csv'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 2000);
}
