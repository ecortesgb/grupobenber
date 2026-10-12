/* ============================================================================================================
   MÓDULO 6b · MIX DE RECARGA (Modo Operación, grupo Desempeño junto a Sell Out)
   Cómo se reparte la recarga de las líneas vendidas (<= $60, $61-100, $101-150, > $150) y cuánto recarga en promedio cada línea.
   Base REGISTROS: monto capturado en el registro (tope 250 como Telefónica). Base VENTA REAL: recarga de los primeros 30 días del DN según la
   proforma (REC_30 sin IVA entre 0.837), solo donde la proforma ya cubre el DN (llega con unas 2 semanas de rezago).
   Comparación por zona de Avance, estado, tienda o promotor, con los filtros y el periodo de la página. Usa el bloque CIFRADO de promotores
   (misma clave, ver 6_promotores.js): los promotores y las ventas por tienda viajan cifrados.
   ============================================================================================================ */
const MIX_CLASES = ['≤ $60','$61 – $100','$101 – $150','> $150'];
const MIX_COLOR = ['#F5A623','#019DF4','#00A37A','#5C2483'];
const MIX_PROD = {t:'Total', m:'Temm', p:'Porta'};
const MIX_DIMS = [['region','Región'],['estado','Estado'],['plaza','Plaza'],['sub_terr','Zona (sub territorio)'],['subdireccion','Subdirección'],['gerente_lider','Gerente / Líder'],
                  ['lider','Líder'],['supervisor','Supervisor'],['cadena','Cadena'],['tienda','Tienda'],['promotor','Promotor']];
const mixUI = {base:'reg', prod:'t', dim:'region', minLineas:30, pag:1, orden:'prom', dir:-1};

function prmMix(base, prod, dim){
  const X = PRM.X, M = X.M[base][prod], P = PRM.d.personas;
  const ok = new Uint8Array(N_STORES); for(const s of STATE.storeIdxArray) ok[s] = 1;
  const a = currentRange.startIdx, b = Math.min(currentRange.endIdx, FECHAS.length-1);
  const g = new Map(); const tot = {c:[0,0,0,0], s:0, n:0, pro:0, reg:0};
  for(let r=0;r<X.n;r++){
    const s = X.S[r], di = X.D[r];
    if(s < 0 || di < 0 || !ok[s] || di < a || di > b) continue;
    const n = M.n[r], k0 = M.c[0][r], k1 = M.c[1][r], k2 = M.c[2][r], k3 = M.c[3][r];
    tot.reg += X.tot[r];
    if(!n && !k0 && !k1 && !k2 && !k3 && !(base==='reg' && X.pro[r])) continue;
    let key, label;
    if(dim === 'promotor'){ key = X.P[r]; label = P[X.P[r]][1]; }
    else if(dim === 'tienda'){ key = s; label = ST.nombre[s]; }
    else if(dim === 'estado'){ const e = X.estado[s]; key = e; label = e >= 0 ? PRM.d.estados[e] : 'Sin estado'; }
    else { key = ST[dim][s]; label = DC[dim][key]; }
    let o = g.get(key); if(!o){ o = {label, c:[0,0,0,0], s:0, n:0, pro:0}; g.set(key, o); }
    o.c[0] += k0; o.c[1] += k1; o.c[2] += k2; o.c[3] += k3; o.s += M.s[r]; o.n += n;
    tot.c[0] += k0; tot.c[1] += k1; tot.c[2] += k2; tot.c[3] += k3; tot.s += M.s[r]; tot.n += n;
    if(base==='reg' && prod==='t'){ o.pro += X.pro[r]; tot.pro += X.pro[r]; }
  }
  return {grupos:[...g.values()], tot};
}
const mixLin = o => o.c[0] + o.c[1] + o.c[2] + o.c[3];
const mixProm = o => o.n > 0 ? o.s/o.n : null;
const mixAlto = o => { const l = mixLin(o); return l > 0 ? (o.c[2] + o.c[3])/l*100 : null; };

function skeletonMixrecarga(){
  document.getElementById('view-mixrecarga').innerHTML = `
    <div class="page-head"><div><h2>💳 Mix de recarga</h2><div class="sub">Cuánto recarga cada línea vendida y cómo se reparte, por zona, estado, tienda o promotor</div></div></div>
    <div id="mix-cuerpo"></div>`;
}
function renderMixrecarga(){
  const cuerpo = document.getElementById('mix-cuerpo');
  if(!PRM.enc){ cuerpo.innerHTML = '<div class="card"><p class="note">Esta versión del dashboard se generó sin la información de promotores.</p></div>'; return; }
  if(!PRM.listo){ cuerpo.innerHTML = prmCandado(); prmEnlazarCandado(()=>renderMixrecarga()); return; }
  const {grupos, tot} = prmMix(mixUI.base, mixUI.prod, mixUI.dim);
  const nombreProd = MIX_PROD[mixUI.prod], real = mixUI.base === 'real';
  const minL = +mixUI.minLineas || 0;
  const lista = grupos.filter(o=>mixLin(o) >= minL);
  const val = o => mixUI.orden==='lineas' ? mixLin(o) : mixUI.orden==='alto' ? (mixAlto(o)||0) : mixUI.orden==='nombre' ? o.label : (mixProm(o)||0);
  lista.sort((x,y)=>{ const a = val(x), b = val(y); return (typeof a==='string' ? a.localeCompare(b) : a-b) * mixUI.dir; });
  const lineas = mixLin(tot), prom = mixProm(tot), alto = mixAlto(tot);
  const corte = PRM.d.corte_altas || '—';
  const aviso = !real ? '' : (lineas === 0 ? `Sin venta real en este periodo: la proforma llega con unas 2 semanas de rezago (cubre hasta ${corte}).`
      : `Venta real de proforma: ${fmtInt(lineas)} líneas${tot.reg ? ` de ${fmtInt(tot.reg)} registradas (${(lineas/tot.reg*100).toFixed(0)}%)` : ''}. La proforma cubre hasta ${corte}.`);
  const ranking = lista.filter(o=>mixProm(o)!=null).sort((x,y)=>mixProm(y)-mixProm(x)), n10 = Math.min(10, Math.floor(ranking.length/2));
  const fila = o => { const l = mixLin(o); return `<tr><td style="text-align:left" title="${prmEsc(o.label)}">${prmEsc(prmCorta(o.label, 36))}</td><td>${fmtInt(l)}</td><td><b>${mixProm(o)!=null ? '$'+mixProm(o).toFixed(0) : '—'}</b></td>
    <td style="min-width:170px"><div class="prm-bar" style="display:block"><div class="tr">${o.c.map((v,k)=>v ? `<i style="width:${v/l*100}%;background:${MIX_COLOR[k]}" title="${MIX_CLASES[k]}: ${v} (${(v/l*100).toFixed(0)}%)"></i>` : '').join('')}</div></div></td>
    ${o.c.map(v=>`<td>${l ? (v/l*100).toFixed(0)+'%' : '—'}</td>`).join('')}<td>${mixAlto(o)!=null ? mixAlto(o).toFixed(0)+'%' : '—'}</td>${!real && mixUI.prod==='t' ? `<td>${o.pro||0}</td>` : ''}</tr>`; };
  const top = (arr, tit, color) => `<div class="card"><h3 style="margin:0 0 6px;color:${color};font-size:13px;">${tit}</h3>${arr.map((o,i)=>`<div style="display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px solid #f2efec;font-size:12.5px;font-weight:700;"><span>${i+1}. ${prmEsc(prmCorta(o.label,34))}</span><span>$${mixProm(o).toFixed(0)} <small style="color:var(--text-muted)">· ${fmtInt(mixLin(o))} líneas</small></span></div>`).join('') || '<small>Sin datos suficientes.</small>'}</div>`;
  const th = (k, t) => `<th data-k="${k}" title="Ordenar">${t}${mixUI.orden===k ? (mixUI.dir>0?' ▲':' ▼') : ''}</th>`;
  const pag = 50, np = Math.max(1, Math.ceil(lista.length/pag)); if(mixUI.pag > np) mixUI.pag = np;
  const dimNombre = MIX_DIMS.find(x=>x[0]===mixUI.dim)[1];
  cuerpo.innerHTML = `
    <div class="table-toolbar" style="gap:8px;">
      <span style="font-size:12px;font-weight:800;">Basado en</span>
      <button class="prm-chipbtn${mixUI.base==='reg'?' on':''}" data-b="reg">Registros</button><button class="prm-chipbtn${mixUI.base==='real'?' on':''}" data-b="real">Venta real (proforma)</button>
      <span style="font-size:12px;font-weight:800;margin-left:10px;">Producto</span>
      ${Object.entries(MIX_PROD).map(([k,l])=>`<button class="prm-chipbtn${mixUI.prod===k?' on':''}" data-p="${k}">${l}</button>`).join('')}
      <span style="font-size:12px;font-weight:800;margin-left:10px;">Ver por</span>
      <select id="mix-dim">${MIX_DIMS.map(([k,l])=>`<option value="${k}"${mixUI.dim===k?' selected':''}>${l}</option>`).join('')}</select>
      <span style="font-size:12px;font-weight:800;margin-left:10px;">Mín. líneas</span><input type="number" id="mix-min" min="0" value="${mixUI.minLineas}" style="width:70px;">
    </div>
    ${aviso ? `<p class="note" style="font-size:12px;font-weight:700;color:var(--text-muted);margin:2px 2px 10px;">${aviso}</p>` : ''}
    <div class="prm-cats" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr));margin-bottom:12px;">
      <div class="prm-cat" style="--cc:#5C2483"><h4>Recarga promedio</h4><div style="font-size:26px;font-weight:900;">${prom!=null?'$'+prom.toFixed(0):'—'}</div><p>${nombreProd} · ${fmtInt(tot.n)} líneas con monto</p></div>
      <div class="prm-cat" style="--cc:#00A37A"><h4>Líneas de más de $100</h4><div style="font-size:26px;font-weight:900;">${alto!=null?alto.toFixed(0)+'%':'—'}</div><p>Clases $101–150 y > $150</p></div>
      <div class="prm-cat" style="--cc:#F5A623"><h4>Líneas de $60 o menos</h4><div style="font-size:26px;font-weight:900;">${lineas?((tot.c[0]/lineas)*100).toFixed(0)+'%':'—'}</div><p>La recarga más baja</p></div>
      ${!real && mixUI.prod==='t' ? `<div class="prm-cat" style="--cc:#6B7280"><h4>Plan Pro (pospago)</h4><div style="font-size:26px;font-weight:900;">${fmtInt(tot.pro)}</div><p>Líneas, aparte del prepago</p></div>` : ''}
    </div>
    <div class="section-title"><div class="bar"></div><h3>Mejores y peores por ${dimNombre.toLowerCase()} <span style="font-weight:600;color:var(--text-muted);font-size:12px;">· recarga promedio · mínimo ${minL} líneas</span></h3></div>
    <div class="grid g2" style="margin-bottom:12px;">${top(ranking.slice(0,n10), '🟢 Mejor recarga promedio', 'var(--green)')}${top(ranking.slice(ranking.length-n10).reverse(), '🔴 Menor recarga promedio', 'var(--red)')}</div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin:4px 0 8px;font-size:11.5px;font-weight:700;">${MIX_CLASES.map((c,k)=>`<span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${MIX_COLOR[k]};margin-right:5px;"></i>${c}</span>`).join('')}</div>
    <div style="overflow-x:auto;"><table class="dt st gbt"><thead><tr>${th('nombre', dimNombre)}${th('lineas','Líneas')}${th('prom','Recarga prom.')}<th>Mix</th>${MIX_CLASES.map(c=>`<th>${c}</th>`).join('')}${th('alto','> $100')}${!real && mixUI.prod==='t' ? '<th>Plan Pro</th>' : ''}</tr></thead>
      <tbody>${lista.slice((mixUI.pag-1)*pag, mixUI.pag*pag).map(fila).join('') || '<tr><td colspan="12">Sin datos con este filtro (prueba bajar el mínimo de líneas).</td></tr>'}</tbody></table></div>
    ${np>1 ? `<div style="margin-top:8px;"><button class="btn" id="mix-ant"${mixUI.pag<=1?' disabled':''}>◀</button> <span style="font-size:12px;font-weight:700;margin:0 8px;">Página ${mixUI.pag} de ${np} · ${fmtInt(lista.length)} grupos</span> <button class="btn" id="mix-sig"${mixUI.pag>=np?' disabled':''}>▶</button></div>` : ''}`;
  cuerpo.querySelectorAll('[data-b]').forEach(b=>b.addEventListener('click', ()=>{ mixUI.base = b.dataset.b; mixUI.pag = 1; renderMixrecarga(); }));
  cuerpo.querySelectorAll('[data-p]').forEach(b=>b.addEventListener('click', ()=>{ mixUI.prod = b.dataset.p; mixUI.pag = 1; renderMixrecarga(); }));
  document.getElementById('mix-dim').addEventListener('change', e=>{ mixUI.dim = e.target.value; mixUI.minLineas = (mixUI.dim==='promotor') ? 8 : (mixUI.dim==='tienda' ? 10 : 30); mixUI.pag = 1; renderMixrecarga(); });
  document.getElementById('mix-min').addEventListener('change', e=>{ mixUI.minLineas = +e.target.value || 0; mixUI.pag = 1; renderMixrecarga(); });
  cuerpo.querySelectorAll('th[data-k]').forEach(h=>h.addEventListener('click', ()=>{ const k = h.dataset.k; if(mixUI.orden===k) mixUI.dir *= -1; else { mixUI.orden = k; mixUI.dir = k==='nombre' ? 1 : -1; } renderMixrecarga(); }));
  const ant = document.getElementById('mix-ant'), sig = document.getElementById('mix-sig');
  if(ant) ant.addEventListener('click', ()=>{ mixUI.pag--; renderMixrecarga(); });
  if(sig) sig.addEventListener('click', ()=>{ mixUI.pag++; renderMixrecarga(); });
}
