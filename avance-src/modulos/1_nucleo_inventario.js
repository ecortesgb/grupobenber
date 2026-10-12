/* ============================================================================================================
   MÓDULO 1 · Núcleo de inventario + vistas INVENTARIO y SELL OUT
   (se incrusta en dashboard_template.html por build_dashboard.py; datos: inventario_generado.json -> INV)
   Reglas de datos: las del dashboard de Share de Marcas (cada semana del archivo más reciente que la contiene,
   solo Grupo Benber, precio promedio = Σ(PVP×piezas)/Σpiezas). SO = sell out = cajas facturadas.
   Estatus de nivel de stock:
     · Coppel  -> contra el stock OBJETIVO de la cadena (tamaño de tienda EX/GR/ME/CH, archivo CADENAS\COPPEL).
     · Resto   -> contra el PROMEDIO de la propia tienda (últimas 8 semanas).
   ============================================================================================================ */
const INV = __INVENTARIO_JSON__;
(function injectCss(){
  const css = `
  .gbx-seg{display:inline-flex; background:#fff; border:1.5px solid var(--orange); border-radius:11px; overflow:hidden; max-width:100%; flex-wrap:wrap;}
  .gbx-seg button{border:0; background:transparent; padding:7px 14px; font:700 12px/1.2 inherit; font-family:inherit; cursor:pointer; color:var(--orange-dark); white-space:nowrap;}
  .gbx-seg button.on{background:var(--orange); color:#fff;}
  .gbx-bar{display:flex; flex-wrap:wrap; gap:8px 10px; align-items:center; margin:0 0 12px;}
  .gbx-bar select,.gbx-bar input[type=search]{border:1.5px solid var(--line); border-radius:9px; padding:7px 10px; font:600 12px inherit; font-family:inherit; background:#fff; max-width:100%;}
  .gbx-bar .grow{flex:1; min-width:180px;}
  .gbx-kpis{display:grid; grid-template-columns:repeat(auto-fit,minmax(168px,1fr)); gap:10px; margin:0 0 14px;}
  .gbx-kpi{background:#fff; border:1px solid var(--line); border-radius:14px; padding:11px 14px; box-shadow:var(--shadow); border-top:3px solid var(--line);}
  .gbx-kpi .l{font-size:10.5px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; color:var(--text-muted);}
  .gbx-kpi .v{font-size:23px; font-weight:800; font-variant-numeric:tabular-nums; margin-top:2px;}
  .gbx-kpi .d{font-size:11.5px; font-weight:700; margin-top:2px; color:var(--text-muted);}
  .gbx-kpi.g{border-top-color:var(--green);} .gbx-kpi.a{border-top-color:var(--amber);} .gbx-kpi.n{border-top-color:var(--orange-n);} .gbx-kpi.rd{border-top-color:var(--red);}
  .gbx-up{color:var(--green);} .gbx-dn{color:var(--red);}
  .gbx-grid{display:grid; grid-template-columns:repeat(auto-fit,minmax(340px,1fr)); gap:12px; margin-bottom:14px;}
  .gbx-card{background:#fff; border:1px solid var(--line); border-radius:var(--radius); padding:12px 14px; box-shadow:var(--shadow);}
  .gbx-card h4{margin:0 0 8px; font-size:12.5px; font-weight:800;}
  .gbx-card .sub{font-size:11px; color:var(--text-muted); font-weight:600; margin:-4px 0 8px;}
  .gbx-ch{position:relative; height:250px;}
  .gbx-empty{background:#fff; border:1.5px dashed var(--line); border-radius:var(--radius); padding:26px; text-align:center; color:var(--text-muted); font-weight:600;}
  table.dt.st.gbt{width:100%;}
  table.dt.st.gbt th.fx, table.dt.st.gbt td.fx{position:sticky; z-index:3; box-shadow:1px 0 0 var(--line);}
  table.dt.st.gbt thead th.fx{z-index:6;}
  table.dt.st.gbt .fxc1{left:0; min-width:76px; max-width:76px;} table.dt.st.gbt .fxc2{left:76px; min-width:210px; max-width:280px; overflow:hidden; text-overflow:ellipsis;}
  table.dt.st.gbt tbody td.fx{background:#fff;} table.dt.st.gbt tbody tr:hover td.fx{background:#FFF9F3;}
  table.dt.st.gbt thead th{cursor:pointer; white-space:normal; line-height:1.2; vertical-align:bottom;}
  table.dt.st.gbt thead th.nosort{cursor:default;}
  table.dt.st.gbt tbody tr.gbt-r{cursor:pointer;}
  table.dt.st.gbt tbody tr.gbt-r:hover td{background:#FFF9F3;}
  table.dt.st.gbt tbody td{vertical-align:middle; padding:7px 9px; text-align:center;}
  table.dt.st.gbt td.t, table.dt.st.gbt th.t{text-align:left;}
  table.dt.st.gbt tr.gbt-det td{background:#FAF8F6; padding:10px 14px; text-align:left; white-space:normal;}
  table.dt.st.gbt .gbt-car{display:inline-block; width:16px; color:var(--orange); font-size:10px; transition:transform .15s;}
  table.dt.st.gbt tr.open .gbt-car{transform:rotate(90deg);}
  .gbx-mini{width:100%; border-collapse:collapse; font-size:11.5px;}
  .gbx-mini th{background:#fff; text-align:center; padding:5px 8px; font-size:10px; text-transform:uppercase; color:var(--text-muted); border-bottom:2px solid var(--orange-soft); position:static;}
  .gbx-mini td{padding:5px 8px; border-bottom:1px solid #eee7e0; text-align:center;}
  .gbx-mini td.t, .gbx-mini th.t{text-align:left;}
  .gbx-chip{display:inline-block; padding:2px 8px; border-radius:20px; font-size:10.5px; font-weight:800; background:#f1efec; color:var(--text-muted); margin:1px 3px 1px 0;}
  .gbx-chip.rd{background:#fbe6e6; color:var(--red);} .gbx-chip.g{background:#e6f4e6; color:var(--green);} .gbx-chip.n{background:#fdead2; color:var(--orange-n);} .gbx-chip.a{background:#fdf1de; color:var(--amber);}
  .gbx-note{font-size:11.5px; color:var(--text-muted); font-weight:600; margin:6px 0 10px; line-height:1.45;}
  .gbx-pager{display:flex; justify-content:space-between; align-items:center; font-size:12px; font-weight:600; color:var(--text-muted); margin:8px 2px;}
  .gbx-pager button{border:1.5px solid var(--line); background:#fff; border-radius:8px; padding:3px 11px; cursor:pointer; font-weight:800;}
  .gbx-pager button:disabled{opacity:.4; cursor:default;}
  `;
  const el = document.createElement('style'); el.id = 'gbx-css'; el.textContent = css; document.head.appendChild(el);
})();

/* ---------- utilidades ---------- */
const GBX_MARCA_COLOR = {MOTOROLA:'#0A6EBD', XIAOMI:'#F2790A', OPPO:'#1E7A1E', SAMSUNG:'#5C2483', HONOR:'#DC2626', 'OTRAS':'#9CA3AF'};
const gbxMarcaColor = m => GBX_MARCA_COLOR[m] || GBX_MARCA_COLOR.OTRAS;
const gbxEsc = s => String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const gbxPct = (n,d)=> d>0 ? n/d*100 : null;
const gbxSum = a => a.reduce((x,y)=>x+y,0);
function gbxDelta(cur, prev, fmt, invert){
  if(prev==null || cur==null) return '<span class="cell-muted">—</span>';
  const d = prev===0 ? (cur===0?0:100) : (cur-prev)/Math.abs(prev)*100;
  const good = invert ? d<=0 : d>=0;
  return `<span class="${good?'gbx-up':'gbx-dn'}">${d>=0?'▲':'▼'} ${Math.abs(d).toFixed(1)}%</span>`;
}
function gbxChart(id, cfg){
  const cv = document.getElementById(id); if(!cv || typeof Chart==='undefined') return;
  if(GB_TREND_CHARTS.has(id)) GB_TREND_CHARTS.get(id).destroy();
  GB_TREND_CHARTS.set(id, new Chart(cv, cfg));
}
const GBX_TIER = {'Sin stock':'rd', 'Crítico':'rd', 'Bajo':'n', 'Normal':'g', 'Alto':'a'};
const gbxEst = l => l ? estatusPillHtml({label:l, tier:GBX_TIER[l]||'g'}) : '<span class="cell-muted">—</span>';

/* ---------- tabla genérica ordenable (encabezado fijo, conserva scroll al ordenar, filas expandibles) ---------- */
const GBT_STATE = {};
function gbTabla(contId, spec){
  const el = document.getElementById(contId); if(!el) return;
  const st = GBT_STATE[contId] || (GBT_STATE[contId] = {k:spec.sort, dir:spec.dir||-1, open:new Set(), page:1, q:''});
  if(spec.resetKey!==undefined && st.resetKey!==spec.resetKey){ st.resetKey = spec.resetKey; st.open.clear(); st.page = 1; }
  const PAGE = spec.pageSize || 40;
  const fixN = spec.fixed || 0;                       // 1 o 2 primeras columnas fijas (IDPDV y Tienda)
  const fxCls = ci => ci<fixN ? ` fx fxc${ci+1}` : '';
  function filtradas(){
    let rows = spec.rows.slice();
    if(st.q){ const q = st.q.toLowerCase(); rows = rows.filter(r=>(r._q||'').includes(q)); }
    const col = spec.cols.find(c=>c.k===st.k);
    if(col){
      const v = r => col.v ? col.v(r) : r[col.k];
      rows.sort((a,b)=>{ const x=v(a), y=v(b); if(x==null&&y==null) return 0; if(x==null) return 1; if(y==null) return -1;
        return (typeof x==='string' ? x.localeCompare(y,'es') : x-y)*st.dir; });
    }
    return rows;
  }
  function tablaHtml(lista, ini, conDetalle){
    const head = spec.cols.map((c,ci)=>`<th class="${c.t?'t ':''}${c.nosort?'nosort':''}${fxCls(ci)}" ${c.nosort?'':`data-k="${c.k}"`} ${c.title?`title="${gbxEsc(c.title)}"`:''}>${c.label}${st.k===c.k?(st.dir>0?' ▲':' ▼'):''}</th>`).join('');
    const body = lista.map((r,i)=>{
      const key = spec.rowKey ? spec.rowKey(r) : String(ini+i); const open = conDetalle && spec.detail && st.open.has(key);
      const tds = spec.cols.map((c,ci)=>`<td class="${c.t?'t ':''}${c.cls?c.cls(r):''}${fxCls(ci)}">${ci===0 && spec.detail && conDetalle ? `<span class="gbt-car">▶</span>`:''}${c.f ? c.f(r) : gbxEsc(r[c.k])}</td>`).join('');
      return `<tr class="gbt-r${open?' open':''}" data-key="${gbxEsc(key)}">${tds}</tr>` + (open ? `<tr class="gbt-det"><td colspan="${spec.cols.length}">${spec.detail(r)}</td></tr>` : '');
    }).join('') || `<tr><td colspan="${spec.cols.length}" style="padding:22px;color:var(--text-muted);">Sin resultados</td></tr>`;
    return `<table class="dt st gbt"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  }
  function pintar(){
    const antes = el.querySelector('.tw'); const sl = antes?antes.scrollLeft:0, sT = antes?antes.scrollTop:0;
    const rows = filtradas();
    const pages = Math.max(1, Math.ceil(rows.length/PAGE)); if(st.page>pages) st.page = pages;
    const ini = (st.page-1)*PAGE, pag = rows.slice(ini, ini+PAGE);
    el.innerHTML = `${spec.search===false?'':`<div class="gbx-bar"><input class="grow" type="search" placeholder="${gbxEsc(spec.placeholder||'Buscar…')}" value="${gbxEsc(st.q)}" data-q aria-label="Buscar"><span class="gbx-note" style="margin:0;">${rows.length} resultado${rows.length!==1?'s':''}</span>${spec.extraBar||''}
        <button class="btn" data-foto="descargar" title="Descarga la tabla completa como imagen">📸 Imagen</button><button class="btn" data-foto="copiar" title="Copia la imagen de la tabla completa para pegarla en WhatsApp">📋 Copiar</button></div>`}
      <div class="tw" style="max-height:${spec.maxH||'62vh'}">${tablaHtml(pag, ini, true)}</div>
      ${pages>1?`<div class="gbx-pager"><span>${ini+1}–${Math.min(ini+PAGE,rows.length)} de ${rows.length}</span><span><button data-pg="-1" ${st.page<=1?'disabled':''}>‹</button> Página ${st.page} de ${pages} <button data-pg="1" ${st.page>=pages?'disabled':''}>›</button></span></div>`:''}`;
    const nuevo = el.querySelector('.tw'); if(nuevo){ nuevo.scrollLeft = sl; nuevo.scrollTop = sT; }
    if(el.__enfocarBuscar){ const i = el.querySelector('[data-q]'); if(i){ i.focus(); i.setSelectionRange(i.value.length, i.value.length); } el.__enfocarBuscar = false; }
  }
  async function foto(modo){
    avisoRapido('Generando imagen…');
    try{
      const cont = document.createElement('div'); cont.innerHTML = `<div class="tw" style="max-height:none">${tablaHtml(filtradas(), 0, false)}</div>`;
      const canvas = await canvasDeContenedor(cont, spec.titulo || contId.replace(/[-_]/g,' '), filtrosActivosTexto(), '');
      if(modo==='copiar'){
        canvas.toBlob(async b=>{ try{ await navigator.clipboard.write([new ClipboardItem({'image/png': b})]); avisoRapido('Imagen copiada: pégala en WhatsApp'); }
          catch(e){ avisoRapido('Tu navegador no permite copiar imágenes; usa 📸 Imagen'); } });
      } else {
        const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = (spec.archivo||contId)+'_'+new Date().toISOString().slice(0,10)+'.png';
        document.body.appendChild(a); a.click(); a.remove(); avisoRapido('Imagen descargada');
      }
    } catch(e){ avisoRapido(e.message || 'No se pudo generar la imagen'); }
  }
  if(el.__gbtH){ el.removeEventListener('click', el.__gbtH.c); el.removeEventListener('input', el.__gbtH.i); }
  let deb;
  el.__gbtH = {
    c: e=>{
      const f = e.target.closest('[data-foto]'); if(f){ foto(f.dataset.foto); return; }
      const th = e.target.closest('th[data-k]');
      if(th){ const k = th.dataset.k; if(st.k===k) st.dir*=-1; else { st.k = k; const c = spec.cols.find(x=>x.k===k); st.dir = (c&&c.t)?1:-1; } st.page = 1; pintar(); return; }
      const pg = e.target.closest('[data-pg]'); if(pg){ st.page += Number(pg.dataset.pg); pintar(); return; }
      const tr = e.target.closest('tr.gbt-r'); if(tr && spec.detail){ const k = tr.dataset.key; st.open.has(k) ? st.open.delete(k) : st.open.add(k); pintar(); }
    },
    i: e=>{ if(e.target.matches('[data-q]')){ const v = e.target.value; clearTimeout(deb); deb = setTimeout(()=>{ st.q = v; st.page = 1; el.__enfocarBuscar = true; pintar(); }, 140); } }
  };
  el.addEventListener('click', el.__gbtH.c); el.addEventListener('input', el.__gbtH.i);
  pintar();
}

/* ============================================================================================================
   Preparación de datos de inventario (una vez)
   ============================================================================================================ */
const INVD = (function(){
  if(!INV || !INV.tiendas || !INV.hist) return null;
  const idToS = new Map(); for(let s=0;s<N_STORES;s++) idToS.set(Number(ST.idpdv[s]), s);
  const NW = INV.semanas.length;
  const sOfI = INV.tiendas.map(id=>idToS.has(Number(id)) ? idToS.get(Number(id)) : -1);
  const porTienda = new Map();                       // s -> [{mi, st[], so[]}]
  for(const [i,mi,st,so] of INV.hist){ const s = sOfI[i]; if(s<0) continue; if(!porTienda.has(s)) porTienda.set(s, []); porTienda.get(s).push({mi, st, so}); }
  const skuPorTienda = new Map();                    // s -> [{k, st, so4}]  (solo existe para la última semana)
  for(const [i,k,st,so4] of INV.sku){ const s = sOfI[i]; if(s<0) continue; if(!skuPorTienda.has(s)) skuPorTienda.set(s, []); skuPorTienda.get(s).push({k, st, so4}); }
  const tam = new Array(N_STORES).fill('');
  const cop = new Map();                             // s -> Map(mi -> {tgt,tda,bod,tr,vema})
  if(INV.coppel){
    for(const [i,v] of Object.entries(INV.coppel.tam)){ const s = sOfI[Number(i)]; if(s>=0) tam[s] = v; }
    for(const [i,mi,tgt,tda,bod,tr,vema] of INV.coppel.f){ const s = sOfI[i]; if(s<0) continue; if(!cop.has(s)) cop.set(s, new Map()); cop.get(s).set(mi, {tgt,tda,bod,tr,vema}); }
    /* Fuente única de piezas: en la última semana, el archivo de Coppel (existencia en tienda por modelo) manda sobre el de inventario.
       Así la fila de la tienda y su detalle siempre cuadran (antes una tienda podía salir con 0 piezas arriba y con piezas al abrirla). */
    for(const [s,mm] of cop){
      let rows = porTienda.get(s); if(!rows){ rows = []; porTienda.set(s, rows); }
      const byMi = new Map(rows.map(r=>[r.mi, r]));
      for(const [mi,c] of mm){
        let r = byMi.get(mi);
        if(!r){ r = {mi, st:new Array(NW).fill(0), so:new Array(NW).fill(0)}; rows.push(r); byMi.set(mi, r); }
        r.st[NW-1] = Math.max(0, c.tda||0);
      }
    }
  }
  const semIdx = {}; INV.semanas.forEach((l,i)=>{ semIdx[l] = i; });
  // primera semana en que cada modelo tuvo stock en todo el universo (para marcar "Nuevo lanzamiento")
  const primera = {}; const tot = {};
  for(const rows of porTienda.values()) for(const r of rows){ const t = tot[r.mi] || (tot[r.mi] = new Array(NW).fill(0)); for(let w=0; w<NW; w++) t[w] += r.st[w]; }
  for(const k of Object.keys(tot)){ const w = tot[k].findIndex(v=>v>0); primera[k] = w; }
  return {NW, sOfI, porTienda, skuPorTienda, tam, cop, semIdx, primera, modelos:INV.modelos, skus:INV.skus, lineup:INV.lineup, semanas:INV.semanas, rowMap:new Map()};
})();

const GBX_BANDAS = (r, ref)=> r==null ? null : (r<0.5 ? 'Crítico' : r<0.8 ? 'Bajo' : r<=1.25 ? 'Normal' : 'Alto');
const GBX_BANDAS_PROM = r => r==null ? null : (r<0.7 ? 'Crítico' : r<0.9 ? 'Bajo' : r<=1.15 ? 'Normal' : 'Alto');
const GBX_CACHE = new Map();

/* Semana de inventario que se muestra = la del filtro de periodo de arriba (el mismo de todo el dashboard). Si el periodo es posterior
   a la última semana con inventario (ej. S41), se muestra la última que existe (S40) y se avisa. */
const INVU = {tab:'panorama', zona:'region', modeloQ:'', sem:'auto', fEst:new Set(), fNivel:new Set(), fEstM:new Set(), fTam:new Set()};
function invSemActual(){
  if(!INVD) return {L:0, aviso:''};
  const last = INVD.NW-1;
  if(INVU.sem!=='auto'){ const L = Math.min(last, Math.max(0, Number(INVU.sem))); return {L, aviso:''}; }
  let pedido = null; try{ const ws = weeksInCurrentRange(); if(ws.length) pedido = ws[ws.length-1].label; }catch(e){}
  if(!pedido) return {L:last, aviso:''};
  if(INVD.semIdx[pedido]!=null) return {L:INVD.semIdx[pedido], aviso:''};
  const di = SEMANAS.indexOf(pedido); if(di<0) return {L:last, aviso:''};
  let L = -1; INVD.semanas.forEach((l,i)=>{ const d = SEMANAS.indexOf(l); if(d>=0 && d<=di) L = Math.max(L, i); });
  if(L<0) return {L:0, aviso:`El periodo elegido (${pedido}) es anterior al primer inventario; se muestra ${INVD.semanas[0]}.`};
  return {L, aviso:`El periodo elegido (${pedido}) todavía no tiene inventario; se muestra el más reciente: ${INVD.semanas[L]}.`};
}
const invL = () => invSemActual().L;

function invRow(s, mi){
  let m = INVD.rowMap.get(s);
  if(!m){ m = new Map((INVD.porTienda.get(s)||[]).map(r=>[r.mi, r])); INVD.rowMap.set(s, m); }
  return m.get(mi);
}
/* Estatus del modelo: Línea / Descatalogado / Nuevo lanzamiento (línea que apareció hace menos de 8 semanas, ya iniciado el histórico) */
function invEstatusModelo(mi, L){
  const m = INVD.modelos[mi]; if(!m || m.s!=='LINEA') return 'Descatalogado';
  const p = INVD.primera[mi];
  return (p!=null && p>=3 && L>=p && L-p<8) ? 'Nuevo lanzamiento' : 'Línea';
}

/* Estadísticas de inventario de UNA tienda en la semana L (independientes de los filtros globales; con cache) */
function invStats(s, L){
  if(!INVD) return null;
  if(L==null) L = INVD.NW-1;
  const key = s*100 + L;
  if(GBX_CACHE.has(key)) return GBX_CACHE.get(key);
  const rows = INVD.porTienda.get(s) || [];
  const tw = new Array(INVD.NW).fill(0), sw = new Array(INVD.NW).fill(0);
  let nMod = 0; const marcas = new Set();
  for(const r of rows){
    for(let w=0; w<INVD.NW; w++){ tw[w] += r.st[w]; sw[w] += r.so[w]; }
    if(r.st[L]>0){ nMod++; marcas.add(INVD.modelos[r.mi].b); }
  }
  const i4 = Math.max(0, L-3); let so4 = 0; for(let w=i4; w<=L; w++) so4 += sw[w];
  const pz = tw[L], pzPrev = L>0 ? tw[L-1] : null;
  const ult8 = tw.slice(Math.max(0, L-7), L+1);
  const prom8 = ult8.length ? gbxSum(ult8)/ult8.length : 0;
  const copS = INVD.cop.get(s); const tm = INVD.tam[s];
  let ratio = null, ref = 'su promedio', tgtTot = 0, tdaTot = 0;
  if(copS){ for(const [mi,v] of copS){ if(v.tgt>0){ const r = invRow(s, mi); const p = r ? r.st[L] : 0; tgtTot += v.tgt; tdaTot += Math.min(p, v.tgt*3); } } }
  let estatus;
  if(copS && tgtTot>0){ ratio = tdaTot/tgtTot; ref = 'objetivo Coppel'; estatus = GBX_BANDAS(ratio); }
  else { ratio = prom8>0 ? pz/prom8 : null; estatus = GBX_BANDAS_PROM(ratio); }
  if(pz<=0) estatus = 'Sin stock';
  // line up Coppel por tamaño de tienda
  let lu = null; const debMis = new Set();
  if(tm){
    const stockMod = new Map(rows.map(r=>[r.mi, r.st[L]]));
    const req = INVD.lineup.filter(it=>it.t.includes(tm));
    const items = req.map(it=>{
      if(!it.m.length) return {n:it.n, estado:'porllegar', pz:0, m:it.m};
      let p = 0; for(const mi of it.m) p += (stockMod.get(mi)||0);
      return {n:it.n, estado:p>0?'ok':'falta', pz:p, m:it.m};
    });
    const medibles = items.filter(i=>i.estado!=='porllegar');
    lu = {tam:tm, items, req:medibles.length, ok:medibles.filter(i=>i.estado==='ok').length, falta:items.filter(i=>i.estado==='falta').map(i=>i.n),
          porLlegar:items.filter(i=>i.estado==='porllegar').map(i=>i.n)};
    lu.pct = lu.req ? lu.ok/lu.req*100 : null;
    items.filter(i=>i.estado==='falta').forEach(i=>i.m.forEach(mi=>{ if(INVD.modelos[mi].s==='LINEA') debMis.add(mi); }));
  }
  if(copS) for(const [mi,v] of copS) if(v.tgt>0 && INVD.modelos[mi].s==='LINEA') debMis.add(mi);
  // "debería tener": Coppel = line up de su tamaño; el resto = modelos de línea que la propia tienda tuvo en las últimas 8 semanas
  let deb, tiene, faltNombres;
  if(lu){ deb = lu.req; tiene = lu.ok; faltNombres = lu.falta; }
  else {
    const D = rows.filter(r=>INVD.modelos[r.mi].s==='LINEA' && Math.max(...r.st.slice(Math.max(0,L-8), L+1))>0);
    deb = D.length; tiene = D.filter(r=>r.st[L]>0).length;
    const fa = D.filter(r=>r.st[L]<=0); faltNombres = fa.map(r=>INVD.modelos[r.mi].n); fa.forEach(r=>debMis.add(r.mi));
  }
  const nS = L-i4+1;
  const o = {s, L, rows, tw, sw, pz, pzPrev, nMod, marcas:marcas.size, so4, soL:sw[L], semInv: so4>0 ? pz/(so4/nS) : null, prom8, ratio, ref, estatus, tgtTot, lu,
             deb, tiene, falt:Math.max(0, deb-tiene), faltNombres, debMis};
  GBX_CACHE.set(key, o); return o;
}
/* Nivel de un modelo en una tienda: Coppel contra objetivo, resto contra su promedio */
function invNivelModelo(s, mi, L){
  if(L==null) L = INVD.NW-1;
  const c = INVD.cop.get(s) && INVD.cop.get(s).get(mi);
  const r = invRow(s, mi); const pz = r ? r.st[L] : 0;
  if(c && c.tgt>0) return {nivel:pz<=0?'Sin stock':GBX_BANDAS(pz/c.tgt), ref:'obj '+c.tgt, pz, tgt:c.tgt, bod:c.bod, tr:c.tr};
  if(!r) return {nivel:null, pz:0, tgt:null};
  const ult = r.st.slice(Math.max(0,L-7), L+1); const prom = gbxSum(ult)/ult.length;
  const x = prom>0 ? pz/prom : null;
  return {nivel: pz<=0 ? (prom>0?'Sin stock':null) : GBX_BANDAS_PROM(x), ref:'prom '+prom.toFixed(1), pz, tgt:null};
}

/* Agregados de un conjunto de tiendas (respeta filtros): semanal, por marca, por modelo (marca/modelo al corte L) */
function invAgregado(storeIdxs, L){
  const NW = INVD.NW; if(L==null) L = NW-1;
  const stW = new Array(NW).fill(0), soW = new Array(NW).fill(0), recW = new Array(NW).fill(0);
  const valStW = new Array(NW).fill(0), valSoW = new Array(NW).fill(0);
  const marcaSt = {}, marcaSo4 = {}, marcaSoW = {}, modelo = new Map();
  let tiendasConStock = 0;
  for(const s of storeIdxs){
    const rows = INVD.porTienda.get(s); if(!rows) continue;
    let tot = 0;
    for(const r of rows){
      const m = INVD.modelos[r.mi]; const p = m.p||0;
      for(let w=0; w<NW; w++){
        stW[w] += r.st[w]; soW[w] += r.so[w]; valStW[w] += r.st[w]*p; valSoW[w] += r.so[w]*p;
        if(w>0){ const rec = r.st[w]-r.st[w-1]+r.so[w]; if(rec>0) recW[w] += rec; }
      }
      marcaSt[m.b] = (marcaSt[m.b]||0) + r.st[L];
      let so4 = 0; for(let w=Math.max(0,L-3); w<=L; w++) so4 += r.so[w];
      marcaSo4[m.b] = (marcaSo4[m.b]||0) + so4;
      (marcaSoW[m.b] || (marcaSoW[m.b] = new Array(NW).fill(0)));
      for(let w=0; w<NW; w++) marcaSoW[m.b][w] += r.so[w];
      let o = modelo.get(r.mi); if(!o){ o = {mi:r.mi, pz:0, pzPrev:0, so4:0, tiendas:0, st:new Array(NW).fill(0)}; modelo.set(r.mi, o); }
      o.pz += r.st[L]; o.pzPrev += (L>0 ? r.st[L-1] : 0); o.so4 += so4; if(r.st[L]>0) o.tiendas++;
      for(let w=0; w<NW; w++) o.st[w] += r.st[w];
      tot += r.st[L];
    }
    if(tot>0) tiendasConStock++;
  }
  return {stW, soW, recW, valStW, valSoW, marcaSt, marcaSo4, marcaSoW, modelo, tiendasConStock};
}

/* Color a partir del SKU: solo la(s) palabra(s) de color (los SKU traen modelo, marca, 5G, CB, etc.). Acepta recortes del archivo
   (NEG, VERD, ESMERALD, CAF?). Si el SKU no trae color, queda vacío. */
const GBX_COLORES = ['NEGRO','AZUL','VERDE','GRIS','PLATA','BLANCO','MORADO','CYAN','DORADO','ROSA','ROJO','NARANJA','TITANIO','LILA','CAFÉ','ZAFIRO','VIOLETA','PÚRPURA','CELESTE','OLIVO','ESMERALDA','ARÁNDANO','AMARILLO','TURQUESA','BEIGE','GRAFITO','MENTA','CORAL','CREMA','MARINO','CHAMPAGNE','LAVANDA','MARFIL','BRONCE','MAGENTA','VINO','FUCSIA','GRANATE','ARENA','LIMA','JADE','PERLA','AZUFRE'];
const GBX_COLORES_N = GBX_COLORES.map(c=>[c, c.normalize('NFD').replace(/[^A-Z]/g,'')]);
function invNombreColor(sku){
  const out = [];
  for(const tk of String(sku||'').toUpperCase().split(/\s+/)){
    const n = tk.normalize('NFD').replace(/[^A-Z]/g,''); if(n.length<3) continue;
    const c = GBX_COLORES_N.find(([, base])=>base===n) || GBX_COLORES_N.find(([, base])=>base.startsWith(n));
    if(c && !out.includes(c[0])) out.push(c[0]);
  }
  return out.join(' ');
}
/* Filas de modelos de una tienda en la semana L: SOLO los que tiene (piezas > 0) y los que debería tener.
   Los descatalogados que ya no llegan no aparecen aunque tengan sell out. Colores: solo si hay más de un color con piezas. */
function invFilasModelos(s, L){
  const x = invStats(s, L); const out = new Map();
  const ultima = L===INVD.NW-1;
  const colPorMi = new Map();
  if(ultima) for(const k of (INVD.skuPorTienda.get(s)||[])){ if(k.st<=0) continue; const mi = INVD.skus[k.k][0]; if(!colPorMi.has(mi)) colPorMi.set(mi, []); colPorMi.get(mi).push(k); }
  const add = (mi, debe)=>{
    if(out.has(mi)) { if(debe) out.get(mi).debe = true; return; }
    const m = INVD.modelos[mi]; const r = invRow(s, mi); const n = invNivelModelo(s, mi, L);
    const so1 = r ? r.so[L] : 0; let so4 = 0; if(r) for(let w=Math.max(0,L-3); w<=L; w++) so4 += r.so[w];
    const cs = colPorMi.get(mi) || [];
    const cm = new Map(); for(const k of cs){ const nm = invNombreColor(INVD.skus[k.k][1]); cm.set(nm, (cm.get(nm)||0)+k.st); }
    const colores = [...cm].filter(([n])=>n).map(([n,pz])=>({n, pz})).sort((a,b)=>b.pz-a.pz);
    out.set(mi, {mi, marca:m.b, modelo:m.n, pz:n.pz||0, so1, so4, nivel:n.nivel, tgt:n.tgt, estM:invEstatusModelo(mi, L), colores, debe:!!debe});
  };
  for(const r of x.rows) if(r.st[L]>0) add(r.mi, x.debMis.has(r.mi));
  for(const mi of x.debMis) add(mi, true);
  return [...out.values()].sort((a,b)=>b.pz-a.pz || a.modelo.localeCompare(b.modelo,'es'));
}
const invColoresTxt = f => f.colores.length>1 ? f.colores.map(c=>`${c.n}: ${c.pz}`).join(' | ') : (f.colores[0] ? f.colores[0].n : '');
const invColoresHtml = f => !f.colores.length ? '' : (f.colores.length>1 ? f.colores.map(c=>`<span class="gbx-chip">${gbxEsc(c.n)}: ${c.pz}</span>`).join('') : `<span class="gbx-chip">${gbxEsc(f.colores[0].n)}</span>`);
function invPasaModelo(f){
  return (!INVU.fNivel.size || INVU.fNivel.has(f.nivel||'—')) && (!INVU.fEstM.size || INVU.fEstM.has(f.estM));
}
const invHayFiltroModelo = () => INVU.fNivel.size>0 || INVU.fEstM.size>0;

/* ============================================================================================================
   VISTA · INVENTARIO
   ============================================================================================================ */
const GBX_ZONAS = [['region','Región'],['cadena','Cadena'],['gerente_lider','Gerente/Líder']];
function gbxSinInventario(id){
  document.getElementById(id).innerHTML = `<div class="page-head"><div><h2>${id==='view-inventario'?'Inventario':'Sell Out'}</h2></div></div>
    <div class="gbx-empty">Todavía no hay archivos de inventario cargados (carpeta <b>INVENTARIOS\\2026</b>). Cuando se actualice el motor aparecerá aquí.</div>`;
}
function skeletonInventario(){
  if(!INVD){ gbxSinInventario('view-inventario'); return; }
  document.getElementById('view-inventario').innerHTML = `
    <div class="page-head"><div><h2>Inventario</h2><div class="sub" id="inv-sub"></div></div></div>
    <div class="gbx-bar"><div class="gbx-seg" id="inv-tabs">
      <button data-t="panorama">Panorama</button><button data-t="tiendas">Tiendas</button><button data-t="modelos">Modelos · ¿dónde hay?</button></div>
      <button class="btn" data-inv="csv-t" title="Una fila por tienda, con las tiendas y filtros que estás viendo">⬇ Resumen por tienda (CSV)</button>
      <button class="btn" data-inv="csv-m" title="Una fila por tienda y modelo (marca, modelo, piezas, colores, sell out, estatus, nivel)">⬇ Detalle tienda × modelo (CSV)</button></div>
    <div class="gbx-note" id="inv-aviso" style="display:none;color:var(--orange-dark);"></div>
    <div id="inv-body"></div>`;
  document.getElementById('inv-tabs').addEventListener('click', e=>{ const b = e.target.closest('button[data-t]'); if(!b) return; INVU.tab = b.dataset.t; renderInventario(); });
  document.getElementById('view-inventario').addEventListener('click', e=>{
    const d = e.target.closest('[data-inv]'); if(d){ if(d.dataset.inv==='csv-t') invCsvResumen(); else if(d.dataset.inv==='csv-m') invCsvDetalle(); return; }
    const c = e.target.closest('[data-fc]'); if(!c) return;
    const set = INVU[c.dataset.fc]; const v = c.dataset.v;
    if(v===''){ set.clear(); } else { set.has(v) ? set.delete(v) : set.add(v); }
    renderInventario();
  });
}
function renderInventario(){
  if(!INVD) return;
  const {L, aviso} = invSemActual();
  document.querySelectorAll('#inv-tabs button').forEach(b=>b.classList.toggle('on', b.dataset.t===INVU.tab));
  const sub = document.getElementById('inv-sub');
  if(sub) sub.innerHTML = `Piezas, modelos y colores por tienda, contra su objetivo. Datos al corte de <b>${gbxEsc(INVD.semanas[L])}</b>${INV.coppel?` · objetivo Coppel: ${gbxEsc(INV.coppel.archivo.replace('.xlsx',''))}`:''}.`;
  const av = document.getElementById('inv-aviso'); if(av){ av.style.display = aviso ? '' : 'none'; av.textContent = aviso; }
  const f = {panorama:invPanorama, tiendas:invTiendas, modelos:invModelos}[INVU.tab];
  f();
}
function invKpisHtml(a, idxs, L){
  const i4 = Math.max(0, L-3), nS = L-i4+1;
  const pz = a.stW[L], pzP = L>0 ? a.stW[L-1] : null, so4 = gbxSum(a.soW.slice(i4, L+1)), so4P = gbxSum(a.soW.slice(Math.max(0,i4-4), i4));
  const stats = idxs.map(s=>invStats(s, L)).filter(x=>x && (x.rows.length));
  const por = e => stats.filter(x=>x.estatus===e).length;
  const bajos = por('Bajo')+por('Crítico')+por('Sin stock');
  const semInv = so4>0 ? pz/(so4/nS) : null;
  const precioStock = pz>0 ? a.valStW[L]/pz : null, ticket = so4>0 ? gbxSum(a.valSoW.slice(i4, L+1))/so4 : null;
  const ticketP = so4P>0 ? gbxSum(a.valSoW.slice(Math.max(0,i4-4), i4))/so4P : null;
  const rec = a.recW[L], recP = L>0 ? a.recW[L-1] : null;
  const luS = stats.filter(x=>x.lu && x.lu.req>0); const luOk = luS.filter(x=>x.lu.pct>=100).length;
  const card = (cls,l,v,d)=>`<div class="gbx-kpi ${cls||''}"><div class="l">${l}</div><div class="v">${v}</div><div class="d">${d||''}</div></div>`;
  return `<div class="gbx-kpis">
    ${card('', 'Piezas en tienda', fmtInt(pz), `${gbxDelta(pz,pzP)} vs sem. anterior`)}
    ${card('', 'Sell out 4 semanas', fmtInt(so4), `${gbxDelta(so4,so4P)} vs 4 sem. previas`)}
    ${card(semInv==null?'':semInv<3?'n':semInv>10?'a':'g', 'Semanas de inventario', semInv==null?'—':semInv.toFixed(1), 'piezas ÷ sell out semanal (4 sem.)')}
    ${card(bajos/(stats.length||1)>0.3?'rd':bajos/(stats.length||1)>0.15?'n':'g', 'Tiendas en nivel bajo', fmtInt(bajos), `${fmtPct(gbxPct(bajos, stats.length))} de ${fmtInt(stats.length)} · sin stock ${por('Sin stock')}`)}
    ${card(luS.length? (luOk/luS.length>0.6?'g':'n') :'', 'Line up Coppel completo', luS.length? fmtPct(gbxPct(luOk,luS.length)) : '—', luS.length ? `${fmtInt(luOk)} de ${fmtInt(luS.length)} tiendas con el line up de su tamaño` : 'sin datos de Coppel')}
    ${card('', 'Resurtido (estimado)', fmtInt(rec), `${gbxDelta(rec,recP)} vs sem. anterior`)}
    ${card('', 'Precio prom. del stock', precioStock?('$'+fmtInt(precioStock)):'—', 'Σ(PVP × piezas) ÷ piezas')}
    ${card('', 'Ticket prom. sell out', ticket?('$'+fmtInt(ticket)):'—', ticketP&&ticket?`${gbxDelta(ticket,ticketP)} vs 4 sem. previas`:'')}
  </div>`;
}
function invPanorama(){
  const idxs = STATE.storeIdxArray.filter(s=>INVD.porTienda.has(s));
  const body = document.getElementById('inv-body');
  if(!idxs.length){ body.innerHTML = '<div class="gbx-empty">Sin inventario para este filtro.</div>'; return; }
  const L = invL(); const a = invAgregado(idxs, L);
  const cut = v => v.slice(0, L+1);
  body.innerHTML = invKpisHtml(a, idxs, L) + `
    <div class="gbx-grid">
      <div class="gbx-card"><h4>Tendencia: piezas, sell out y semanas de inventario</h4><div class="sub">Barras = piezas en tienda · líneas = sell out semanal y semanas de inventario</div><div class="gbx-ch"><canvas id="inv-ch-tend"></canvas></div></div>
      <div class="gbx-card"><h4>Participación de marca</h4><div class="sub">% de piezas en tienda vs % del sell out (4 semanas al corte)</div><div class="gbx-ch"><canvas id="inv-ch-share"></canvas></div></div>
      <div class="gbx-card"><h4>Participación de marca por zona</h4><div class="gbx-bar" style="margin:0 0 6px;"><select id="inv-zona">${GBX_ZONAS.map(([k,l])=>`<option value="${k}" ${INVU.zona===k?'selected':''}>Sell out por ${l}</option>`).join('')}</select></div><div class="gbx-ch" style="height:205px;"><canvas id="inv-ch-zona"></canvas></div></div>
      <div class="gbx-card"><h4>Estatus de nivel de stock</h4><div class="sub">Coppel contra su objetivo por tamaño · resto contra su promedio</div><div class="gbx-ch"><canvas id="inv-ch-est"></canvas></div></div>
      <div class="gbx-card"><h4>Resurtido y crecimiento</h4><div class="sub">Piezas recibidas estimadas por semana (Δ stock + sell out)</div><div class="gbx-ch"><canvas id="inv-ch-rec"></canvas></div></div>
    </div>
    <div class="gbx-note">Para ver una tienda o un modelo en detalle usa las pestañas <b>Tiendas</b> y <b>Modelos</b>: ahí puedes ordenar por cualquier columna, buscar, filtrar y abrir cada renglón. Los botones <b>⬇ CSV</b> de arriba descargan la información de la semana elegida.</div>`;
  const labels = cut(INVD.semanas);
  const semInvW = cut(a.stW).map((p,w)=>{ const ini = Math.max(0,w-3); const so = gbxSum(a.soW.slice(ini,w+1))/(w-ini+1); return so>0 ? +(p/so).toFixed(1) : null; });
  gbxChart('inv-ch-tend', {type:'bar', data:{labels, datasets:[
    {type:'bar', label:'Piezas en tienda', data:cut(a.stW), backgroundColor:'#F2790A99', yAxisID:'y'},
    {type:'line', label:'Sell out semanal', data:cut(a.soW), borderColor:'#0A6EBD', backgroundColor:'#0A6EBD', tension:.3, yAxisID:'y1', pointRadius:3},
    {type:'line', label:'Semanas de inventario', data:semInvW, borderColor:'#1A1A1A', borderDash:[5,3], tension:.3, yAxisID:'y2', pointRadius:2}]},
    options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom', labels:{boxWidth:10, font:{size:10}}}},
      scales:{y:{beginAtZero:true, ticks:{callback:v=>fmtInt(v), font:{size:9.5}}}, y1:{position:'right', beginAtZero:true, grid:{drawOnChartArea:false}, ticks:{font:{size:9.5}}}, y2:{display:false, beginAtZero:true}, x:{ticks:{font:{size:9.5}}}}}});
  const marcas = Object.keys(a.marcaSt).sort((x,y)=>a.marcaSt[y]-a.marcaSt[x]).filter(m=>a.marcaSt[m]>0||a.marcaSo4[m]>0).slice(0,7);
  const totSt = gbxSum(Object.values(a.marcaSt)), totSo = gbxSum(Object.values(a.marcaSo4));
  gbxChart('inv-ch-share', {type:'bar', data:{labels:marcas, datasets:[
    {label:'% de piezas', data:marcas.map(m=>+(a.marcaSt[m]/totSt*100).toFixed(1)), backgroundColor:'#9CA3AF'},
    {label:'% del sell out', data:marcas.map(m=>+(a.marcaSo4[m]/totSo*100).toFixed(1)), backgroundColor:marcas.map(gbxMarcaColor)}]},
    options:{indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom', labels:{boxWidth:10, font:{size:10}}}, tooltip:{callbacks:{label:c=>` ${c.dataset.label}: ${c.parsed.x}%`}}},
      scales:{x:{beginAtZero:true, ticks:{callback:v=>v+'%', font:{size:9.5}}}, y:{ticks:{font:{size:10.5}}}}}});
  invGraficaZona(idxs, L);
  document.getElementById('inv-zona').addEventListener('change', e=>{ INVU.zona = e.target.value; invGraficaZona(idxs, L); });
  const conteo = {}; const cad = s=>DC.cadena[ST.cadena[s]]||'—';
  for(const s of idxs){ const x = invStats(s, L); const k = cad(s)+'|'+x.estatus; conteo[k] = (conteo[k]||0)+1; }
  const cadenas = [...new Set(idxs.map(cad))];
  const ests = ['Sin stock','Crítico','Bajo','Normal','Alto']; const col = {'Sin stock':'#7F1D1D','Crítico':'#DC2626','Bajo':'#F2790A','Normal':'#1E7A1E','Alto':'#E0A800'};
  gbxChart('inv-ch-est', {type:'bar', data:{labels:cadenas, datasets:ests.map(e=>({label:e, backgroundColor:col[e], data:cadenas.map(c=>conteo[c+'|'+e]||0), stack:'e'}))},
    options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom', labels:{boxWidth:10, font:{size:10}}}}, scales:{x:{stacked:true, ticks:{font:{size:10.5}}}, y:{stacked:true, ticks:{font:{size:9.5}}, title:{display:true, text:'Tiendas', font:{size:9}}}}}});
  const recW = cut(a.recW);
  gbxChart('inv-ch-rec', {type:'bar', data:{labels, datasets:[
    {type:'bar', label:'Resurtido estimado', data:recW, backgroundColor:'#1E7A1E99'},
    {type:'line', label:'Crecimiento vs sem. anterior (%)', data:recW.map((v,w)=> w>1 && recW[w-1]>0 ? +((v-recW[w-1])/recW[w-1]*100).toFixed(1) : null), borderColor:'#1A1A1A', yAxisID:'y1', tension:.3, pointRadius:3, spanGaps:true}]},
    options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom', labels:{boxWidth:10, font:{size:10}}}}, scales:{y:{beginAtZero:true, ticks:{callback:v=>fmtInt(v), font:{size:9.5}}}, y1:{position:'right', grid:{drawOnChartArea:false}, ticks:{callback:v=>v+'%', font:{size:9.5}}}, x:{ticks:{font:{size:9.5}}}}}});
}
function invGraficaZona(idxs, L){
  const dim = INVU.zona;
  const grupos = new Map();
  for(const s of idxs){ const vi = ST[dim][s]; const lab = DC[dim][vi]||'—'; if(!grupos.has(lab)) grupos.set(lab, {}); const g = grupos.get(lab);
    for(const r of (INVD.porTienda.get(s)||[])){ const b = INVD.modelos[r.mi].b; let so4 = 0; for(let w=Math.max(0,L-3); w<=L; w++) so4 += r.so[w]; g[b] = (g[b]||0)+so4; } }
  const labs = [...grupos.keys()].map(k=>({k, t:gbxSum(Object.values(grupos.get(k)))})).sort((a,b)=>b.t-a.t).slice(0,10).map(x=>x.k);
  const marcas = ['MOTOROLA','XIAOMI','OPPO','SAMSUNG','HONOR'];
  const ds = marcas.map(m=>({label:m, backgroundColor:gbxMarcaColor(m), data:labs.map(k=>{ const g = grupos.get(k); const t = gbxSum(Object.values(g)); return t>0 ? +((g[m]||0)/t*100).toFixed(1) : 0; }), stack:'m'}));
  ds.push({label:'Otras', backgroundColor:GBX_MARCA_COLOR.OTRAS, stack:'m', data:labs.map(k=>{ const g = grupos.get(k); const t = gbxSum(Object.values(g)); const o = t - marcas.reduce((a,m)=>a+(g[m]||0),0); return t>0 ? +(o/t*100).toFixed(1) : 0; })});
  gbxChart('inv-ch-zona', {type:'bar', data:{labels:labs, datasets:ds}, options:{indexAxis:'y', responsive:true, maintainAspectRatio:false,
    plugins:{legend:{position:'bottom', labels:{boxWidth:10, font:{size:10}}}, tooltip:{callbacks:{label:c=>` ${c.dataset.label}: ${c.parsed.x}%`}}},
    scales:{x:{stacked:true, max:100, ticks:{callback:v=>v+'%', font:{size:9.5}}}, y:{stacked:true, ticks:{font:{size:10}}}}}});
}

/* ---- Tiendas ---- */
const GBX_EST_M = {'Línea':'g', 'Nuevo lanzamiento':'n', 'Descatalogado':''};
function invDetalleTienda(r){
  const L = invL(); const st = r.st;
  let filas = invFilasModelos(r.s, L); if(invHayFiltroModelo()) filas = filas.filter(invPasaModelo);
  const nota = st.lu
    ? `<div class="gbx-note"><b>Line up ${st.lu.tam}</b>: ${st.lu.ok} de ${st.lu.req} modelos con stock ${st.lu.falta.length?`· <span class="gbx-dn">faltan: ${st.lu.falta.map(gbxEsc).join(', ')}</span>`:'· completo'}${st.lu.porLlegar.length?` · por llegar (lanzamientos): ${st.lu.porLlegar.map(gbxEsc).join(', ')}`:''}</div>`
    : `<div class="gbx-note">Referencia: ${st.ref}. Promedio de las últimas 8 semanas: ${fmtProm(st.prom8)} piezas. Debería tener ${st.deb} modelos de línea que tuvo en las últimas 8 semanas${st.falt?` · <span class="gbx-dn">faltan: ${st.faltNombres.map(gbxEsc).join(', ')}</span>`:''}.</div>`;
  return `${nota}
    <table class="gbx-mini"><thead><tr><th class="t">Marca</th><th class="t">Modelo</th><th>Piezas</th><th class="t">Colores (piezas)</th><th>Sell out sem.</th><th>Sell out 4 sem.</th><th>Estatus</th><th>Nivel</th></tr></thead><tbody>
    ${filas.map(x=>`<tr><td class="t">${gbxEsc(x.marca)}</td><td class="t"><b>${gbxEsc(x.modelo)}</b>${x.debe && x.pz<=0 ? ' <span class="cell-muted">(debería tener)</span>':''}</td><td>${fmtInt(x.pz)}</td><td class="t">${invColoresHtml(x)}</td><td>${fmtInt(x.so1)}</td><td>${fmtInt(x.so4)}</td><td><span class="gbx-chip ${GBX_EST_M[x.estM]||''}">${x.estM}</span></td><td>${gbxEst(x.nivel)}</td></tr>`).join('') || '<tr><td colspan="8" class="cell-muted">Sin modelos con este filtro.</td></tr>'}
    </tbody></table>${L!==INVD.NW-1?'<div class="gbx-note">Los colores solo existen para la última semana de inventario.</div>':''}`;
}
/* Filas de tiendas (con todos los filtros) — las usan la tabla y las descargas */
/* Tipo de tienda: Coppel = su tamaño (EX/GR/ME/CH); Elektra = Resurtible / No Resurtible; Cimaco, Suburbia y demás = N/A */
function invTipoTienda(s){
  const cad = String(DC.cadena[ST.cadena[s]]||'').toLowerCase();
  if(cad.includes('elektra')){ const r = (DC.tipo_ekt && DC.tipo_ekt[ST.tipo_ekt[s]]) || ''; return r || 'N/A'; }
  if(cad.includes('coppel') && INVD.tam[s]) return INVD.tam[s];
  return 'N/A';
}
function invTiendasRows(){
  const L = invL();
  const idxs = STATE.storeIdxArray.filter(s=>INVD.porTienda.has(s));
  const rows = [];
  for(const s of idxs){
    const st = invStats(s, L);
    const tipo = invTipoTienda(s);
    if(INVU.fEst.size && !INVU.fEst.has(st.estatus)) continue;
    if(INVU.fTam.size && !INVU.fTam.has(tipo)) continue;
    let filas = null;
    if(invHayFiltroModelo()){ filas = invFilasModelos(s, L).filter(invPasaModelo); if(!filas.length) continue; }
    rows.push({s, st, id:ST.idpdv[s], nombre:ST.nombre[s]||String(ST.idpdv[s]), cadena:DC.cadena[ST.cadena[s]]||'—', tipo, pz:st.pz,
      d:st.pzPrev>0 ? (st.pz-st.pzPrev)/st.pzPrev*100 : null, nMod:st.nMod, deb:st.deb, falt:st.falt, so1:st.soL, so4:st.so4, semInv:st.semInv,
      lu:st.lu && st.lu.pct!=null ? st.lu.pct : null, nivel:st.ratio!=null ? st.ratio*100 : null, est:st.estatus,
      _q:(String(ST.idpdv[s])+' '+(ST.nombre[s]||'')+' '+(DC.supervisor[ST.supervisor[s]]||'')+' '+(DC.cadena[ST.cadena[s]]||'')).toLowerCase()});
  }
  return rows;
}
function invChips(titulo, clave, opciones, conteo){
  const set = INVU[clave];
  return `<div class="pt-chips" style="margin:2px 0 6px;"><span class="pt-lbl">${titulo}</span><button type="button" class="pt-chip${set.size===0?' on':''}" data-fc="${clave}" data-v="">Todos</button>` +
    opciones.map(o=>`<button type="button" class="pt-chip${set.has(o)?' on':''}" data-fc="${clave}" data-v="${gbxEsc(o)}" aria-pressed="${set.has(o)}">${gbxEsc(o)}${conteo&&conteo[o]!=null?` <span class="n">${conteo[o]}</span>`:''}</button>`).join('') + `</div>`;
}
function invTiendas(){
  const L = invL();
  const idxs = STATE.storeIdxArray.filter(s=>INVD.porTienda.has(s));
  const a = invAgregado(idxs, L);
  const rows = invTiendasRows();
  const ordEst = {'Sin stock':0,'Crítico':1,'Bajo':2,'Normal':3,'Alto':4};
  const cuenta = f => { const c = {}; idxs.forEach(s=>{ const k = f(s); c[k] = (c[k]||0)+1; }); return c; };
  const cEst = cuenta(s=>invStats(s, L).estatus), cTam = cuenta(invTipoTienda);
  const tams = ['EX','GR','ME','CH'].filter(t=>cTam[t]).concat(Object.keys(cTam).filter(k=>!['EX','GR','ME','CH','N/A'].includes(k)).sort()); if(cTam['N/A']) tams.push('N/A');
  document.getElementById('inv-body').innerHTML = invKpisHtml(a, idxs, L) +
    invChips('Estatus de la tienda', 'fEst', ['Sin stock','Crítico','Bajo','Normal','Alto'], cEst) +
    invChips('Nivel de modelos', 'fNivel', ['Sin stock','Crítico','Bajo','Normal','Alto']) +
    invChips('Estatus del modelo', 'fEstM', ['Línea','Nuevo lanzamiento','Descatalogado']) +
    invChips('Tipo de tienda', 'fTam', tams, cTam) +
    `<div id="inv-tbl-t"></div>`;
  gbTabla('inv-tbl-t', {
    sort:'est', dir:1, rowKey:r=>String(r.s), resetKey:INVU.tab+'|'+L, placeholder:'Buscar tienda, IDPDV, supervisor o cadena…', rows, fixed:2, titulo:'Inventario por tienda', archivo:'inventario_tiendas',
    detail: invDetalleTienda,
    cols:[
      {k:'id', label:'IDPDV', f:r=>gbxEsc(r.id), t:true},
      {k:'nombre', label:'Tienda', t:true, f:r=>gbxEsc(r.nombre)},
      {k:'cadena', label:'Cadena', f:r=>gbxEsc(r.cadena)},
      {k:'tipo', label:'Tipo tienda', f:r=>r.tipo==='N/A'?'<span class="cell-muted">N/A</span>':gbxEsc(r.tipo), title:'Coppel: tamaño (EX/GR/ME/CH) · Elektra: Resurtible / No Resurtible · Cimaco y Suburbia: N/A'},
      {k:'pz', label:'Piezas', f:r=>fmtInt(r.pz)},
      {k:'d', label:'Δ sem.', f:r=>gbxDelta(r.st.pz, r.st.pzPrev), title:'Cambio de piezas vs semana anterior'},
      {k:'nMod', label:'Modelos', f:r=>fmtInt(r.nMod), title:'Modelos con piezas en la tienda'},
      {k:'deb', label:'Debería tener', f:r=>fmtInt(r.deb), title:'Coppel: modelos del line up de su tamaño. Resto: modelos de línea que la tienda tuvo en las últimas 8 semanas'},
      {k:'falt', label:'Faltan', f:r=>r.falt?`<b class="gbx-dn" title="${gbxEsc(r.st.faltNombres.join(', '))}">${fmtInt(r.falt)}</b>`:'<span class="cell-muted">·</span>', title:'Modelos que debería tener y no tiene (pasa el cursor para ver cuáles)'},
      {k:'lu', label:'Line up', f:r=>r.lu==null?'<span class="cell-muted">—</span>':fmtPct(r.lu), cls:r=>r.lu==null?'':(r.lu>=100?'cell-green':r.lu<70?'cell-red':''), title:'% de modelos del line up de su tamaño que tiene con stock (solo Coppel). Es distinto del Nivel.'},
      {k:'so1', label:'Sell out sem.', f:r=>fmtInt(r.so1), title:'Sell out de la semana de inventario elegida'},
      {k:'so4', label:'Sell out 4 sem.', f:r=>fmtInt(r.so4)},
      {k:'semInv', label:'Sem. inv.', f:r=>r.semInv==null?'<span class="cell-muted">—</span>':r.semInv.toFixed(1), title:'Piezas ÷ sell out semanal (4 sem.)'},
      {k:'nivel', label:'Nivel', f:r=>r.nivel==null?'<span class="cell-muted">—</span>':fmtPct(r.nivel), title:'Piezas vs objetivo (Coppel) o vs su promedio (resto)'},
      {k:'est', label:'Estatus', v:r=>ordEst[r.est]!=null?ordEst[r.est]:9, f:r=>gbxEst(r.est)},
    ]});
}

/* ---- Descargas (CSV con acentos para Excel): respetan semana, filtros y tiendas del panel izquierdo ---- */
function invCsv(nombre, cab, filas){
  const esc = v => { v = v==null ? '' : String(v); return /[",\r\n]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v; };
  const txt = '﻿' + [cab, ...filas].map(r=>r.map(esc).join(',')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], {type:'text/csv;charset=utf-8'}));
  a.download = `${nombre}_${INVD.semanas[invL()]}.csv`; document.body.appendChild(a); a.click(); a.remove();
  avisoRapido(`Descargado: ${filas.length} filas`);
}
const invZona = s => [DC.region[ST.region[s]]||'', DC.gerente_lider[ST.gerente_lider[s]]||'', DC.supervisor[ST.supervisor[s]]||''];
function invCsvResumen(){
  const L = invL(); const rows = invTiendasRows().sort((x,y)=>Number(x.id)-Number(y.id));
  invCsv('inventario_resumen_tiendas',
    ['Semana inventario','IDPDV','Tienda','Cadena','Región','Gerente/Líder','Supervisor','Tipo tienda','Piezas','Modelos con stock','Modelos que debería tener','Modelos que faltan','Cuáles faltan','Por llegar (lanzamientos)','% Line up','Sell out semana','Sell out 4 sem.','Semanas de inventario','Nivel %','Estatus'],
    rows.map(r=>[INVD.semanas[L], r.id, r.nombre, r.cadena, ...invZona(r.s), r.tipo, r.pz, r.nMod, r.deb, r.falt, r.st.faltNombres.join(' | '), r.st.lu ? r.st.lu.porLlegar.join(' | ') : '',
      r.lu==null?'':+r.lu.toFixed(1), r.so1, r.so4, r.semInv==null?'':+r.semInv.toFixed(2), r.nivel==null?'':+r.nivel.toFixed(1), r.est]));
}
function invCsvDetalle(){
  const L = invL(); const rows = invTiendasRows().sort((x,y)=>Number(x.id)-Number(y.id)); const out = [];
  for(const r of rows){
    for(const f of invFilasModelos(r.s, L)){
      if(invHayFiltroModelo() && !invPasaModelo(f)) continue;
      out.push([INVD.semanas[L], r.id, r.nombre, r.cadena, ...invZona(r.s), r.tipo, f.marca, f.modelo, f.estM, f.pz, invColoresTxt(f), f.so1, f.so4, f.tgt==null?'':f.tgt, f.nivel||'', f.debe?'Sí':'No']);
    }
  }
  invCsv('inventario_tienda_modelo',
    ['Semana inventario','IDPDV','Tienda','Cadena','Región','Gerente/Líder','Supervisor','Tipo tienda','Marca','Modelo','Estatus modelo','Piezas','Colores (si hay más de uno)','Sell out semana','Sell out 4 sem.','Objetivo','Nivel','¿Debería tenerlo?'], out);
}

/* ---- Modelos ---- */
function invDetalleModelo(r){
  const mi = r.mi; const L = invL();
  const lista = [];
  for(const s of r.idxs){
    const x = invRow(s, mi); if(!x) continue;
    const pz = x.st[L]; if(pz<=0) continue;
    lista.push({s, pz, so4:gbxSum(x.so.slice(Math.max(0,L-3), L+1)), n:invNivelModelo(s, mi, L)});
  }
  lista.sort((a,b)=>b.pz-a.pz);
  const top = lista.slice(0,30);
  const sin = r.sinStock;
  const colores = {};
  if(L===INVD.NW-1) for(const s of r.idxs){ for(const k of (INVD.skuPorTienda.get(s)||[])){ if(INVD.skus[k.k][0]!==mi) continue; const nm = INVD.skus[k.k][1]; colores[nm] = (colores[nm]||0)+k.st; } }
  const cs = Object.entries(colores).filter(([n,v])=>v>0).sort((a,b)=>b[1]-a[1]);
  const csHtml = cs.length>1 ? cs.map(([n,v])=>`<span class="gbx-chip">${gbxEsc(n)}: ${fmtInt(v)}</span>`).join('') : '';
  return `<div class="gbx-note"><b>${fmtInt(lista.length)}</b> tiendas con este modelo (${fmtInt(r.pz)} piezas). ${sin?`<span class="gbx-dn">${fmtInt(sin)} tiendas del line up de su tamaño no lo tienen.</span>`:''}</div>
    <div style="margin-bottom:8px;">${csHtml}</div>
    <table class="gbx-mini"><thead><tr><th class="t">Tienda</th><th class="t">Supervisor</th><th>Piezas</th><th>Objetivo</th><th>Nivel</th><th>Sell out 4 sem.</th></tr></thead><tbody>
    ${top.map(x=>`<tr><td class="t"><b>${gbxEsc(ST.nombre[x.s])}</b> <span class="cell-muted">${gbxEsc(ST.idpdv[x.s])}</span></td><td class="t">${gbxEsc(DC.supervisor[ST.supervisor[x.s]]||'')}</td><td>${fmtInt(x.pz)}</td><td>${x.n.tgt!=null?fmtInt(x.n.tgt):'<span class="cell-muted">—</span>'}</td><td>${gbxEst(x.n.nivel)}</td><td>${fmtInt(x.so4)}</td></tr>`).join('')}
    </tbody></table>${lista.length>top.length?`<div class="gbx-note">Se muestran las 30 tiendas con más piezas; el detalle completo está en el botón <b>⬇ Detalle tienda × modelo</b>.</div>`:''}`;
}
function invModelos(){
  const L = invL();
  const idxs = STATE.storeIdxArray.filter(s=>INVD.porTienda.has(s));
  const a = invAgregado(idxs, L);
  // tiendas que deberían tener el modelo (line up por tamaño) y no lo tienen
  const faltan = new Map();
  for(const s of idxs){ const lu = invStats(s, L).lu; if(!lu) continue; for(const it of lu.items){ if(it.estado==='falta'){ for(const mi of it.m) faltan.set(mi, (faltan.get(mi)||0)+1); } } }
  const rows = [...a.modelo.values()].filter(o=>o.pz>0 || o.so4>0).map(o=>{
    const m = INVD.modelos[o.mi]; const so = o.so4/Math.min(4, L+1);
    return {mi:o.mi, idxs, marca:m.b, modelo:m.n, pvp:m.p, pz:o.pz, d:o.pzPrev>0?(o.pz-o.pzPrev)/o.pzPrev*100:null, o, tiendas:o.tiendas, so4:o.so4, semInv:so>0?o.pz/so:null,
      share:gbxPct(o.pz, a.stW[L]), sinStock:faltan.get(o.mi)||0, linea:m.s==='LINEA', estM:invEstatusModelo(o.mi, L),
      _q:(m.b+' '+m.n).toLowerCase()};
  });
  document.getElementById('inv-body').innerHTML = `<div class="gbx-note">Busca un modelo para saber <b>dónde hay</b> y cuántas piezas tiene cada tienda; ordena por piezas para ver quién tiene más. <b>Faltan</b> = tiendas del line up Coppel que deberían tenerlo y no lo tienen.</div><div id="inv-tbl-m"></div>`;
  gbTabla('inv-tbl-m', {
    sort:'pz', dir:-1, rowKey:r=>String(r.mi), resetKey:INVU.tab+'|'+L, placeholder:'Buscar marca o modelo (ej. G06, A17, Redmi)…', rows, detail:invDetalleModelo, titulo:'Inventario por modelo', archivo:'inventario_modelos',
    cols:[
      {k:'marca', label:'Marca', t:true, f:r=>`<span class="gbx-chip" style="background:${gbxMarcaColor(r.marca)}22;color:${gbxMarcaColor(r.marca)}">${gbxEsc(r.marca)}</span>`},
      {k:'modelo', label:'Modelo', t:true, f:r=>`<b>${gbxEsc(r.modelo)}</b>`},
      {k:'estM', label:'Estatus', f:r=>`<span class="gbx-chip ${GBX_EST_M[r.estM]||''}">${r.estM}</span>`},
      {k:'pvp', label:'PVP', f:r=>r.pvp?('$'+fmtInt(r.pvp)):'—'},
      {k:'pz', label:'Piezas', f:r=>fmtInt(r.pz)},
      {k:'d', label:'Δ sem.', f:r=>gbxDelta(r.o.pz, r.o.pzPrev)},
      {k:'share', label:'% del stock', f:r=>fmtPct(r.share)},
      {k:'tiendas', label:'Tiendas con stock', f:r=>fmtInt(r.tiendas)},
      {k:'sinStock', label:'Faltan', f:r=>r.sinStock?`<b class="gbx-dn">${fmtInt(r.sinStock)}</b>`:'<span class="cell-muted">·</span>', title:'Tiendas del line up de su tamaño que no lo tienen'},
      {k:'so4', label:'Sell out 4 sem.', f:r=>fmtInt(r.so4)},
      {k:'semInv', label:'Sem. inv.', f:r=>r.semInv==null?'<span class="cell-muted">—</span>':r.semInv.toFixed(1)},
    ]});
}

/* ============================================================================================================
   VISTA · SELL OUT   (semanal: cajas facturadas vs altas Temm reales; la conversión aquí es Temm, no la de Fieldwy)
   Usa el MISMO filtro de periodo de arriba. El sell out solo existe por semana completa: se toman las semanas del periodo que ya
   traen sell out; "semana anterior" = las semanas inmediatamente previas del mismo tamaño.
   ============================================================================================================ */
const SOU = {estatus:new Set()};
const SO_ESTATUS = ['Bien','Revisar','Conversión baja'];
const SO_TIER = {'Bien':'g', 'Revisar':'a', 'Conversión baja':'rd'};
function estatusSo(m){
  if(m.conv==null) return null;
  const l = m.conv>=85 ? 'Bien' : m.conv>=70 ? 'Revisar' : 'Conversión baja';
  return {label:l, tier:SO_TIER[l]};
}
function soSemanasRango(){
  return weeksInCurrentRange().map(w=>({label:w.label, di:w.key, wi:INVD.semIdx[w.label]})).filter(w=>w.wi!=null);
}
function soSemanasPrevias(cur){
  if(!cur.length) return [];
  const todas = INVD.semanas.map((lbl,wi)=>({label:lbl, wi, di:SEMANAS.indexOf(lbl)})).filter(x=>x.di>=0 && WEEK_RANGES[x.di]);
  const ini = todas.findIndex(x=>x.label===cur[0].label);
  return ini>0 ? todas.slice(Math.max(0, ini-cur.length), ini) : [];
}
function soTotTienda(s, sems){
  const rows = INVD.porTienda.get(s) || []; let so = 0, alt = 0;
  for(const w of sems){
    for(const r of rows) so += r.so[w.wi];
    for(const i of storeRowsInWeekUnfiltered(s, WEEK_RANGES[w.di])) alt += RW.altas_temm[i]||0;
  }
  return {so, alt};
}
function soMetricas(c, p){
  const conv = c.so>0 ? c.alt/c.so*100 : null, convP = p.so>0 ? p.alt/p.so*100 : null;
  const m = {so:c.so, alt:c.alt, conv, dif:c.so-c.alt, so_prev:p.so, alt_prev:p.alt, conv_prev:convP, dpp:(conv!=null && convP!=null) ? conv-convP : null};
  m.estatus_so = estatusSo(m);
  return m;
}
function skeletonSellout(){
  if(!INVD){ gbxSinInventario('view-sellout'); return; }
  document.getElementById('view-sellout').innerHTML = `
    <div class="page-head"><div><h2>Sell Out</h2><div class="sub">Cajas facturadas vs. altas Temm reales, con el periodo de arriba. La conversión es Temm (altas ÷ cajas), no la de Fieldwy. El sell out llega por semana completa.</div></div></div>
    <div class="gbx-kpis" id="so-kpis"></div>
    <div class="section-title"><div class="bar"></div><h3>Comparativo semanal: cajas facturadas y % de conversión</h3></div>
    <div class="card tight" id="so-trend-card" style="height:290px;margin-bottom:14px;"><canvas id="so-trend"></canvas></div>
    <div class="section-title"><div class="bar"></div><h3>Detalle</h3></div>
    <div class="pt-chips" id="so-chips"></div>
    <div id="so-table"></div>`;
  document.getElementById('view-sellout').addEventListener('click', e=>{
    const b = e.target.closest('#so-chips [data-e]'); if(!b) return;
    if(b.dataset.e==='') SOU.estatus.clear(); else (SOU.estatus.has(b.dataset.e) ? SOU.estatus.delete(b.dataset.e) : SOU.estatus.add(b.dataset.e));
    renderSellout();
  });
}
function renderSellout(){
  if(!INVD) return;
  const cur = soSemanasRango(), prev = soSemanasPrevias(cur);
  const idxs = STATE.storeIdxArray.filter(s=>INVD.porTienda.has(s));
  const card = (cls,l,v,d)=>`<div class="gbx-kpi ${cls||''}"><div class="l">${l}</div><div class="v">${v}</div><div class="d">${d||''}</div></div>`;
  // ---- métricas por tienda (periodo y periodo anterior) ----
  const porTienda = new Map(); let tot = {so:0, alt:0}, totP = {so:0, alt:0};
  for(const s of idxs){
    const c = soTotTienda(s, cur), p = soTotTienda(s, prev);
    porTienda.set(s, {c, p, m:soMetricas(c, p)});
    tot.so += c.so; tot.alt += c.alt; totP.so += p.so; totP.alt += p.alt;
  }
  const mT = soMetricas(tot, totP);
  // ticket promedio del sell out = Σ(PVP × cajas) / Σ cajas
  const agg = invAgregado(idxs);
  const tk = sems => { let v = 0, c = 0; for(const w of sems){ v += agg.valSoW[w.wi]; c += agg.soW[w.wi]; } return c>0 ? v/c : null; };
  const ticket = tk(cur), ticketP = tk(prev);
  const dlt = (a,b)=> (a==null||b==null||b===0) ? '' : `${gbxDelta(a,b)} vs sem. anterior`;
  document.getElementById('so-kpis').innerHTML = !cur.length
    ? `<div class="gbx-empty" style="grid-column:1/-1;">El periodo elegido todavía no tiene sell out (llega por semana completa). Elige una semana anterior para ver cajas y conversión.</div>`
    : card('', 'Cajas facturadas (sell out)', fmtInt(tot.so), dlt(tot.so, totP.so)) +
      card('', 'Altas Temm', fmtInt(tot.alt), dlt(tot.alt, totP.alt)) +
      card(mT.conv==null?'':(mT.conv>=85?'g':mT.conv>=70?'a':'rd'), 'Conversión Temm', mT.conv==null?'—':fmtPct(mT.conv), mT.dpp==null?'':`<span class="${mT.dpp>=0?'gbx-up':'gbx-dn'}">${mT.dpp>=0?'▲':'▼'} ${Math.abs(mT.dpp).toFixed(1)} pp</span> vs sem. anterior`) +
      card('', 'Cajas sin alta', fmtInt(Math.max(0, tot.so-tot.alt)), `${fmtPct(gbxPct(Math.max(0,tot.so-tot.alt), tot.so))} del sell out`) +
      card('', 'Precio ticket sell out', ticket?('$'+fmtInt(ticket)):'—', ticket&&ticketP?`${gbxDelta(ticket,ticketP)} vs sem. anterior`:'promedio por caja');
  // ---- gráfica lineal semanal (mismas semanas que las demás tendencias) ----
  const semsG = semanasParaComparativoPiso(6);
  const labs = semsG.map(w=>w.label);
  const soW = semsG.map(w=>{ const wi = INVD.semIdx[w.label]; return wi==null ? null : agg.soW[wi]; });
  const altW = semsG.map((w,i)=>{ if(soW[i]==null) return null; let a = 0; for(const s of idxs) for(const r of storeRowsInWeekUnfiltered(s, w.range)) a += RW.altas_temm[r]||0; return a; });
  const convW = soW.map((v,i)=> (v!=null && v>0) ? +(altW[i]/v*100).toFixed(1) : null);
  const tcard = document.getElementById('so-trend-card');
  if(tcard) tcard.hidden = !labs.length;
  gbxChart('so-trend', {type:'line', data:{labels:labs, datasets:[
    {label:'Cajas facturadas (sell out)', data:soW, borderColor:'#0A6EBD', backgroundColor:'#0A6EBD33', fill:true, tension:.35, spanGaps:false, yAxisID:'y', labelFmt:fmtInt},
    {label:'% Conversión Temm', data:convW, borderColor:'#F2790A', backgroundColor:'#F2790A', borderDash:[5,3], tension:.35, spanGaps:false, yAxisID:'y1', labelFmt:v=>v.toFixed(1)+'%'}]},
    plugins:[GB_LINE_LABELS_PLUGIN],
    options:{responsive:true, maintainAspectRatio:false, animation:{duration:500}, layout:{padding:{top:40}},
      plugins:{legend:{position:'bottom', labels:{boxWidth:10, font:{size:10}}}},
      scales:{y:{position:'left', beginAtZero:true, ticks:{font:{size:9.5}, callback:v=>fmtInt(v)}, title:{display:true, text:'Cajas', font:{size:9}}},
        y1:{position:'right', beginAtZero:true, max:120, grid:{drawOnChartArea:false}, ticks:{font:{size:9.5}, callback:v=>v+'%'}, title:{display:true, text:'% Conversión', font:{size:9}}}}}});
  // ---- filtro de estatus (varios a la vez) y tabla en cascada ----
  const cnt = {}; for(const v of porTienda.values()){ const e = v.m.estatus_so; if(e) cnt[e.label] = (cnt[e.label]||0)+1; }
  const icon = {g:'✔', a:'⚠', rd:'⛔'};
  document.getElementById('so-chips').innerHTML = `<span class="pt-lbl">Estatus</span><button type="button" class="pt-chip${SOU.estatus.size===0?' on':''}" data-e="">Todos <span class="n">${porTienda.size}</span></button>` +
    SO_ESTATUS.map(e=>`<button type="button" class="pt-chip${SOU.estatus.has(e)?' on':''}" data-e="${e}" aria-pressed="${SOU.estatus.has(e)}">${icon[SO_TIER[e]]} ${e} <span class="n">${cnt[e]||0}</span></button>`).join('');
  const pasa = s => { if(!SOU.estatus.size) return true; const e = porTienda.get(s).m.estatus_so; return e && SOU.estatus.has(e.label); };
  const pp = v => v==null ? '—' : (v>=0?'+':'')+v.toFixed(1)+' pp';
  tableComponent({
    containerId:'so-table', csvName:'sell_out', titulo:'Sell Out · cajas facturadas vs. altas Temm', defaultSort:'dif', defaultGrp:'temm',
    estatusFn: m=>m.estatus_so,
    columns:[
      {key:'so', label:'Sell Out (cajas facturadas)', short:'Sell Out', fmt:v=>fmtInt(v)},
      {key:'alt', label:'Altas Temm', short:'Altas Temm', fmt:v=>fmtInt(v)},
      {key:'conv', label:'% Conversión', short:'% Conversión', fmt:v=>fmtPct(v), pct:true},
      {key:'dif', label:'Diferencia (cajas sin alta)', short:'Diferencia', fmt:v=>fmtInt(v)},
      {key:'so_prev', label:'Sell Out semana anterior', short:'Sell Out sem. ant.', fmt:v=>fmtInt(v)},
      {key:'alt_prev', label:'Altas Temm semana anterior', short:'Altas Temm sem. ant.', fmt:v=>fmtInt(v)},
      {key:'conv_prev', label:'% Conversión semana anterior', short:'% Conv. sem. ant.', fmt:v=>fmtPct(v), pct:true},
      {key:'dpp', label:'Diferencia pp vs semana anterior', short:'Δ pp vs sem. ant.', fmt:pp, sign:true},
    ],
    getRows:(nivel)=>{
      const nv = NIVELES.find(x=>x.key===nivel) || NIVELES[0];
      const grupos = new Map();
      for(const s of idxs){
        if(!pasa(s)) continue;
        let id, lab; if(nv.dim===null){ id = s; lab = ST.nombre[s]||String(ST.idpdv[s]); } else { id = ST[nv.dim][s]; lab = DC[nv.dim][id]; }
        if(!grupos.has(id)) grupos.set(id, {label:lab, ss:[]}); grupos.get(id).ss.push(s);
      }
      return [...grupos.values()].map(g=>{
        const c = {so:0, alt:0}, p = {so:0, alt:0};
        g.ss.forEach(s=>{ const v = porTienda.get(s); c.so += v.c.so; c.alt += v.c.alt; p.so += v.p.so; p.alt += v.p.alt; });
        return {label:g.label, nStores:g.ss.length, storeIdxs:g.ss, metrics:soMetricas(c, p)};
      });
    },
    getRowsExtra:(weekInfo, m, storeIdxs)=>{
      const wi = INVD.semIdx[weekInfo.label]; if(wi==null) return {};
      const di = SEMANAS.indexOf(weekInfo.label), pi = di>0 ? INVD.semIdx[SEMANAS[di-1]] : null;
      const sum = (ss, w, d)=>{ let so = 0, alt = 0; for(const s of ss){ for(const r of (INVD.porTienda.get(s)||[])) so += r.so[w]; for(const i of storeRowsInWeekUnfiltered(s, WEEK_RANGES[d])) alt += RW.altas_temm[i]||0; } return {so, alt}; };
      const c = sum(storeIdxs, wi, di), p = (pi!=null && WEEK_RANGES[di-1]) ? sum(storeIdxs, pi, di-1) : {so:0, alt:0};
      return soMetricas(c, p);
    }
  });
}
