/* ============================================================================================================
   MÓDULO 2 · DIAGNÓSTICO (Modo Dirección)
   Responde: ¿qué pasó?, ¿dónde?, ¿por qué?, ¿cuándo?, ¿cómo lo corregimos? y ¿dónde causa más impacto?
   Siempre se mide por SUPERVISOR: al elegir gerente o región, cada bloque es un supervisor (nunca se agrupa por gerente).
   Ventana: 4 semanas terminando en la semana de análisis; histórico = todas las semanas del dashboard hasta esa semana.
   Prioridad (1 = lo más urgente) = 40% pérdida (altas que faltan vs cuota) + 25% volumen de cuota
                                    + 20% potencial (lo que la tienda ya ha vendido en su mejor semana) + 15% inventario disponible.
   ============================================================================================================ */
(function injectCssDiag(){
  const css = `
  .dg-head{background:linear-gradient(135deg,#FFF4EA,#fff); border:1.5px solid var(--orange-soft); border-radius:16px; padding:14px 16px; margin-bottom:12px;}
  .dg-head h3{margin:0 0 3px; font-size:19px;} .dg-head .meta{font-size:12px; font-weight:600; color:var(--text-muted);}
  .dg-first{display:inline-flex; gap:6px; align-items:center; background:var(--orange); color:#fff; border-radius:999px; padding:5px 13px; font-size:12px; font-weight:800; margin-top:8px;}
  .dg-prio{display:inline-block; min-width:30px; text-align:center; background:#17191D; color:#fff; border-radius:8px; padding:2px 7px; font-weight:800; font-variant-numeric:tabular-nums;}
  .dg-prio.t1{background:var(--red);} .dg-prio.t2{background:var(--orange-n);} .dg-prio.t3{background:var(--amber);}
  .dg-sec{margin:14px 0 6px; font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:.05em; color:var(--orange-dark); display:flex; gap:8px; align-items:center;}
  .dg-sec:before{content:''; width:4px; height:15px; background:var(--orange); border-radius:3px;}
  .dg-q{font-weight:600; text-transform:none; letter-spacing:0; color:var(--text-muted);}
  .dg-pasa li{margin:3px 0; font-size:12.5px; line-height:1.45;} .dg-pasa{margin:4px 0 0; padding-left:18px;}
  .dg-cause{display:grid; grid-template-columns:34px 1fr auto; gap:10px; background:#fff; border:1px solid var(--line); border-left:4px solid var(--line); border-radius:12px; padding:9px 12px; margin-bottom:7px;}
  .dg-cause.rd{border-left-color:var(--red);} .dg-cause.n{border-left-color:var(--orange-n);} .dg-cause.a{border-left-color:var(--amber);} .dg-cause.g{border-left-color:var(--green);}
  .dg-cause .n{font-weight:800; font-size:15px; color:var(--text-muted); align-self:center; text-align:center;}
  .dg-cause b{font-size:13px;} .dg-cause p{margin:2px 0 0; font-size:12px; color:var(--text-muted); font-weight:600; line-height:1.4;}
  .dg-cause .act{font-size:12px; font-weight:700; color:var(--text); margin-top:4px;} .dg-cause .imp{font-size:11.5px; font-weight:800; text-align:right; white-space:nowrap; align-self:center;}
  .dg-cols{display:grid; grid-template-columns:repeat(auto-fit,minmax(360px,1fr)); gap:12px;}
  .dg-dow{display:flex; gap:6px; align-items:flex-end; height:84px; margin-top:4px;}
  .dg-dow div{flex:1; text-align:center; font-size:10.5px; font-weight:700; color:var(--text-muted);}
  .dg-dow i{display:block; background:var(--orange); border-radius:5px 5px 0 0; margin:0 4px 3px; min-height:2px;} .dg-dow i.low{background:var(--red);} .dg-dow i.top{background:var(--green);}
  .dg-rank td.cause{white-space:normal; text-align:left; min-width:210px; max-width:330px; line-height:1.3; font-size:11.5px;}
  table.dt.st.gbt tr.dg-det td{background:#FFFDFB; padding:12px 16px; border-bottom:2px solid var(--orange-soft);}
  .dg-legend{font-size:11.5px; color:var(--text-muted); font-weight:600; line-height:1.5; background:#fff; border:1px dashed var(--line); border-radius:12px; padding:8px 12px; margin:0 0 12px;}
  .dg-mini{width:100%; border-collapse:collapse; font-size:12px;} .dg-mini th{font-size:10px; text-transform:uppercase; color:var(--text-muted); padding:5px 8px; text-align:center; border-bottom:2px solid var(--orange-soft); background:#fff; position:static;}
  .dg-mini td{padding:5px 8px; border-bottom:1px solid #eee7e0; text-align:center; font-variant-numeric:tabular-nums;} .dg-mini td.t,.dg-mini th.t{text-align:left;}
  .dg-mini tr.cur td{background:#FFF4EA; font-weight:800;}
  `;
  const el = document.createElement('style'); el.id = 'dg-css'; el.textContent = css; document.head.appendChild(el);
})();

const DG = {nivel:'supervisor', tienda:null, supervisor:null, sem:null, abiertos:new Set()};
const DG_DIAS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
const DG_DIAS_LARGO = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
const DG_FDOW = FECHAS.map(f=>{ const d = new Date(f+'T12:00:00'); return (d.getDay()+6)%7; });
let _DGW = null;
function dgWeeks(){ if(!_DGW || _DGW.length!==SEMANAS.filter((l,i)=>WEEK_RANGES[i]).length) _DGW = SEMANAS.map((l,i)=>({l, i, r:WEEK_RANGES[i]})).filter(x=>x.r).sort((a,b)=>a.r.start-b.r.start); return _DGW; }
const dgCache = new Map();
const dgPP = v => v==null ? '—' : (v>=0?'+':'')+v.toFixed(1)+' pp';
const dgSg = v => v==null ? '—' : (v>=0?'+':'')+fmtInt(v);
const dgCl = pct => pct==null ? '' : pctClass(pct);
const dgDeS = s => ST.nombre[s]||String(ST.idpdv[s]);

/* ---------- sumas de una tienda en una semana (con cache) ---------- */
function dgSemana(s, di){
  const key = s*100+di; if(dgCache.has(key)) return dgCache.get(key);
  const rows = storeRowsInWeekUnfiltered(s, WEEK_RANGES[di]);
  const o = {n:rows.length, cuota_t:0, cuota_temm:0, cuota_porta:0, cuota_pos:0, altas_t:0, altas_temm:0, altas_porta:0, altas_pos:0, reg_t:0,
    checks:0, cuota_checks:0, visitas:0, nuevoDias:0, impulso:0, dow:[0,0,0,0,0,0,0], piso:null};
  for(const i of rows){
    o.cuota_t += RW.cuota_t[i]||0; o.cuota_temm += RW.cuota_temm[i]||0; o.cuota_porta += RW.cuota_porta[i]||0; o.cuota_pos += RW.cuota_pospago[i]||0;
    o.altas_t += RW.altas_t[i]||0; o.altas_temm += RW.altas_temm[i]||0; o.altas_porta += RW.altas_porta[i]||0; o.altas_pos += RW.altas_pospago[i]||0;
    o.reg_t += RW.reg_t[i]||0; o.checks += RW.checks[i]||0; o.cuota_checks += RW.cuota_checks[i]||0; o.visitas += RW.visitas_sup[i]||0;
    o.impulso += RW.impulso[i]||0;
    if((RW.nuevos_ing[i]||0)>0) o.nuevoDias++;
    o.dow[DG_FDOW[RW.fecha[i]]] += RW.altas_t[i]||0;
  }
  if(rows.length){ const p = pisoTiendaSemana(s, rows); o.piso = {est:p.est, gap:p.gap, piso:p.piso, ventas:p.ventas, lineas:p.lineas}; }
  o.loss = Math.max(0, o.cuota_t - o.altas_t);
  o.al_t = gbxPct(o.altas_t, o.cuota_t); o.al_temm = gbxPct(o.altas_temm, o.cuota_temm);
  o.cob = gbxPct(o.checks, o.cuota_checks);
  dgCache.set(key, o); return o;
}
function dgVentana(di, n){
  const pos = dgWeeks().findIndex(w=>w.i===di);
  return dgWeeks().slice(Math.max(0, pos-(n-1)), pos+1);
}
function dgSumarSemanas(arr){          // suma varias semanas-tienda (o varias tiendas) en un solo objeto
  const o = {n:0, cuota_t:0, cuota_temm:0, cuota_porta:0, cuota_pos:0, altas_t:0, altas_temm:0, altas_porta:0, altas_pos:0, reg_t:0, checks:0, cuota_checks:0, visitas:0, nuevoDias:0, impulso:0, dow:[0,0,0,0,0,0,0]};
  for(const x of arr){ if(!x) continue; for(const k of Object.keys(o)){ if(k==='dow') x.dow.forEach((v,i)=>{ o.dow[i]+=v; }); else o[k] += x[k]||0; } }
  o.loss = Math.max(0, o.cuota_t - o.altas_t); o.al_t = gbxPct(o.altas_t, o.cuota_t); o.al_temm = gbxPct(o.altas_temm, o.cuota_temm); o.cob = gbxPct(o.checks, o.cuota_checks);
  return o;
}

/* ---------- base de una tienda: 4 semanas + histórico + inventario ---------- */
function dgBase(s, di){
  const vent = dgVentana(di, 4);
  const w = vent.map(x=>dgSemana(s, x.i));
  const cur = w[w.length-1];
  const prev = w.length>1 ? dgSumarSemanas(w.slice(0,-1)) : null;
  const nPrev = Math.max(1, w.length-1);
  const hist = dgVentana(di, 13).map(x=>({l:x.l, ...dgSemana(s, x.i)}));
  const previas = hist.slice(0,-1).filter(h=>h.cuota_t>0);
  const mejor = previas.reduce((m,h)=> (!m || h.altas_t>m.altas_t) ? h : m, null);
  const mejorAl = previas.reduce((m,h)=> (h.al_t!=null && (m==null || h.al_t>m.al_t)) ? h : m, null);
  const buenas = previas.filter(h=>h.al_t!=null && h.al_t>=90).length;
  const inv = INVD ? invStats(s) : null;
  return {s, vent, w, cur, prev, nPrev, hist, mejor, mejorAl, buenas, inv,
    cuotaPrevProm: prev ? prev.cuota_t/nPrev : null, altasPrevProm: prev ? prev.altas_t/nPrev : null,
    potencial: mejor ? Math.max(0, mejor.altas_t - cur.altas_t) : 0,
    posc: ST.posc[s]||1};
}

/* ---------- causas (motor de reglas) ---------- */
function dgInvFactor(inv){
  if(!inv) return 0.7;
  return {'Normal':1, 'Alto':1, 'Bajo':0.6, 'Crítico':0.3, 'Sin stock':0}[inv.estatus] ?? 0.7;
}
function dgProductos(c){
  const lst = [
    {k:'TEMM', cuota:c.cuota_temm, altas:c.altas_temm}, {k:'Portabilidad', cuota:c.cuota_porta, altas:c.altas_porta},
    {k:'Pospago', cuota:c.cuota_pos, altas:c.altas_pos}, {k:'Total prepago', cuota:c.cuota_t, altas:c.altas_t}];
  return lst.map(p=>({...p, gap:Math.max(0, p.cuota-p.altas), al:gbxPct(p.altas, p.cuota)}));
}
function dgCausas(b, ctx){
  const c = b.cur, out = [], loss = c.loss;
  const add = (key, sev, tier, titulo, evidencia, accion, cuando, impacto)=>out.push({key, sev, tier, titulo, evidencia, accion, cuando, impacto:Math.max(0, Math.min(loss, Math.round(impacto*10)/10))});
  const posc = b.posc;
  if(c.n===0) return out;
  // 1) Cobertura
  if(c.checks===0 && c.cuota_checks>0){
    add('vacante', 100, 'rd', 'Sin cobertura: la tienda no tuvo promotor', `0 checks de ${fmtProm(c.cuota_checks)} esperados en la semana.`,
      'Cubrir la vacante (reclutamiento / apoyo temporal) antes que cualquier otra acción.', 'Inmediato · esta semana', loss);
  } else if(c.cob!=null && c.cob<75){
    const faltan = Math.max(0, c.cuota_checks - c.checks);
    const posFalta = posc>=2 && c.checks <= 6*(posc-1);
    add('cobertura', 85-Math.min(20,c.cob/5), c.cob<50?'rd':'n', posFalta ? 'Falta promotoría: una posición sin cubrir' : 'Faltan días de cobertura',
      `${fmtProm(c.checks)} de ${fmtProm(c.cuota_checks)} checks (${fmtPct(c.cob)}): faltan ${fmtProm(faltan)} días.`,
      posFalta ? `Con ${posc} posiciones autorizadas solo se cubre ${Math.max(1,Math.round(c.checks/6))}: completar la plantilla (más promotoría).` : 'Cubrir los días faltantes (rolar descansos, apoyo de otra tienda o promotor adicional).',
      'Esta semana', loss*(1-c.cob/100));
  }
  // 2) Inventario
  if(b.inv){
    const lu = b.inv.lu;
    const bajo = ['Sin stock','Crítico'].includes(b.inv.estatus) || (lu && lu.falta.length>=2) || b.inv.estatus==='Bajo';
    if(bajo){
      const sev = b.inv.estatus==='Sin stock' ? 90 : b.inv.estatus==='Crítico' ? 75 : (lu && lu.falta.length>=3 ? 62 : 52);
      add('inventario', sev, sev>=75?'rd':'n', 'Falta de inventario',
        `Nivel ${b.inv.ratio!=null?fmtPct(b.inv.ratio*100):'—'} vs ${b.inv.ref} (${b.inv.estatus.toLowerCase()})${lu&&lu.falta.length?` · sin stock del line up: ${lu.falta.slice(0,4).join(', ')}${lu.falta.length>4?'…':''}`:''}.`,
        'Pedir resurtido de los modelos faltantes y priorizar los de mayor rotación; mientras tanto reforzar la venta de lo disponible.', 'Esta semana (resurtido)', loss*0.3*(b.inv.estatus==='Bajo'?0.6:1));
    }
  }
  // 3) Nuevo ingreso
  if(c.nuevoDias>0 || (b.prev && b.w.length>1 && b.w[b.w.length-2].nuevoDias>0)){
    add('nuevo', 68, 'n', 'Promotor de nuevo ingreso (en arranque)', `${c.nuevoDias} día${c.nuevoDias!==1?'s':''} con promotor de menos de 14 días en la semana.`,
      'Acompañamiento del supervisor y capacitación en la tienda; revisar el plan de arranque (producto, portabilidad, proceso de registro).', 'Primeros 14 días', loss*0.5);
  }
  // 4) Productividad (con cobertura suficiente)
  if((c.cob==null || c.cob>=75) && c.checks>0 && c.al_temm!=null && c.al_temm<75){
    const ap = c.altas_t/c.checks;
    add('productividad', 66, c.al_temm<60?'rd':'n', 'Baja productividad con cobertura completa',
      `Vende ${ap.toFixed(1)} altas por check${ctx&&ctx.medAPC?` (mediana de su zona: ${ctx.medAPC.toFixed(1)})`:''}; alcance Temm ${fmtPct(c.al_temm)}.`,
      'Coaching de venta en piso, metas diarias, revisar técnica de oferta TEMM/portabilidad y el uso de impulso.', 'Próximas 2 semanas', loss*0.6);
  }
  // 5) Histórico
  if(b.mejorAl && b.mejorAl.al_t!=null){
    if(b.mejorAl.al_t>=90 && b.buenas>=3 && c.al_t!=null && c.al_t<75){
      add('historico', 60, 'n', 'Antes vendía bien y ahora no', `Su mejor semana fue ${b.mejorAl.l} con ${fmtPct(b.mejorAl.al_t)}; esta semana ${fmtPct(c.al_t)} (${b.buenas} semanas ≥90%).`,
        'Revisar motivación y cambios recientes (promotor, horario, inventario, exhibición); conversar con el promotor y el supervisor.', 'Esta semana', Math.max(0,(b.mejor?b.mejor.altas_t:0)-c.altas_t)*0.6);
    } else if(b.mejorAl.al_t<60 && b.hist.filter(h=>h.cuota_t>0).length>=6){
      add('nunca', 58, 'n', 'Nunca ha rendido', `En ${b.hist.filter(h=>h.cuota_t>0).length} semanas su mejor alcance fue ${fmtPct(b.mejorAl.al_t)} (${b.mejorAl.l}).`,
        'Revisar el perfil del promotor y el potencial real de la tienda (tráfico, ubicación); evaluar cambio de perfil o ajuste de cuota/posiciones.', 'Próximas 4 semanas', loss*0.4);
    }
  }
  // 6) Cuota subió
  if(b.cuotaPrevProm>0){
    const d = (c.cuota_t-b.cuotaPrevProm)/b.cuotaPrevProm*100;
    if(d>=10) add('cuota', 40, 'a', 'La cuota subió', `Cuota ${fmtProm(c.cuota_t)} vs ${fmtProm(b.cuotaPrevProm)} de promedio en las semanas previas (${dgPP(d).replace(' pp','%')}).`,
      'Reajustar el plan semanal a la nueva cuota y reforzar los días fuertes; comunicarla al promotor.', 'Inicio de semana', Math.min(loss, c.cuota_t-b.cuotaPrevProm)*0.5);
  }
  // 7) Supervisión
  if(c.visitas===0) add('visita', 35, 'a', 'Sin visita del supervisor', 'Ninguna visita registrada en la semana.', 'Programar visita (priorizar si hay arranque o vacante).', 'Esta semana', loss*0.2);
  return out.sort((a,b2)=>b2.sev-a.sev);
}
function dgScorePrioridad(items){           // items: [{loss, cuota, pot, inv}] -> score 0..100
  const mx = k=>Math.max(1e-9, ...items.map(i=>i[k]));
  const mL = mx('loss'), mC = mx('cuota'), mP = mx('pot');
  items.forEach(i=>{ i.score = 100*(0.40*i.loss/mL + 0.25*i.cuota/mC + 0.20*i.pot/mP + 0.15*i.inv); });
  return items.sort((a,b)=>b.score-a.score);
}
/* Diagnóstico completo de un conjunto de tiendas: base + causas + ranking */
function dgAnalizar(stores, di){
  const bases = stores.map(s=>dgBase(s, di)).filter(b=>b.cur.n>0);
  const apc = bases.filter(b=>b.cur.checks>0).map(b=>b.cur.altas_t/b.cur.checks).sort((a,b)=>a-b);
  const ctx = {medAPC: apc.length ? apc[Math.floor(apc.length/2)] : null};
  const lossTot = gbxSum(bases.map(b=>b.cur.loss));
  bases.forEach(b=>{ b.causas = dgCausas(b, ctx); b.top = b.causas[0]||null; b.pctLoss = lossTot>0 ? b.cur.loss/lossTot*100 : 0; });
  const items = bases.map(b=>({b, loss:b.cur.loss, cuota:b.cur.cuota_t, pot:b.potencial, inv:dgInvFactor(b.inv)}));
  dgScorePrioridad(items);
  items.forEach((it,i)=>{ it.b.rank = i+1; it.b.score = it.score; });
  return {bases:items.map(i=>i.b), lossTot, ctx};
}

/* ---------- bloques HTML ---------- */
function dgTabla4(ws, labels, filas){
  // filas: [{k, f:(x)=>html, cls?}] ; ws = objetos semana (mismo orden que labels); la última columna es Δ vs promedio de previas
  const n = ws.length; const prevs = ws.slice(0,-1);
  const head = labels.map((l,i)=>`<th>${gbxEsc(l)}${i===n-1?' ●':''}</th>`).join('');
  return `<table class="dg-mini"><thead><tr><th class="t">Indicador</th>${head}<th>vs prom. previas</th></tr></thead><tbody>${filas.map(f=>{
    const vals = ws.map(x=>f.v(x));
    const cur = vals[n-1], pv = prevs.map((_,i)=>vals[i]).filter(v=>v!=null);
    const avg = pv.length ? gbxSum(pv)/pv.length : null;
    let d = '<span class="cell-muted">—</span>';
    if(cur!=null && avg!=null){ const dd = f.pp ? cur-avg : (Math.abs(avg)<0.05?(Math.abs(cur)<0.05?0:100):(cur-avg)/Math.abs(avg)*100); const good = f.inv ? dd<=0 : dd>=0; d = `<span class="${Math.abs(dd)<0.05?'cell-muted':good?'gbx-up':'gbx-dn'}">${dd>=0?'▲':'▼'} ${Math.abs(dd).toFixed(1)}${f.pp?' pp':'%'}</span>`; }
    return `<tr><td class="t"><b>${f.k}</b></td>${vals.map((v,i)=>`<td class="${f.cls&&v!=null?f.cls(v):''}${i===n-1?' cell-cur':''}">${v==null?'—':f.f(v)}</td>`).join('')}<td>${d}</td></tr>`;
  }).join('')}</tbody></table>`;
}
const DG_FILAS = [
  {k:'Cuota total', v:x=>x.cuota_t, f:fmtProm},
  {k:'Altas totales', v:x=>x.altas_t, f:fmtProm},
  {k:'% Alcance total', v:x=>x.al_t, f:fmtPct, cls:pctClass, pp:true},
  {k:'Altas TEMM', v:x=>x.altas_temm, f:fmtProm},
  {k:'% Alcance TEMM', v:x=>x.al_temm, f:fmtPct, cls:pctClass, pp:true},
  {k:'Altas Porta', v:x=>x.altas_porta, f:fmtProm},
  {k:'Altas Pospago', v:x=>x.altas_pos, f:fmtProm},
  {k:'Pérdida (altas vs cuota)', v:x=>x.loss, f:fmtProm, inv:true},
  {k:'Checks (cobertura)', v:x=>x.cuota_checks>0?x.cob:null, f:fmtPct, cls:pctClass, pp:true},
  {k:'Visitas del supervisor', v:x=>x.visitas, f:fmtProm},
];
function dgDow(dow){
  const t = gbxSum(dow); if(t<=0) return '<div class="gbx-note">Sin altas en el periodo.</div>';
  const mx = Math.max(...dow), mn = Math.min(...dow);
  return `<div class="dg-dow">${dow.map((v,i)=>`<div title="${DG_DIAS_LARGO[i]}: ${fmtProm(v)} altas"><i class="${v===mx?'top':v===mn?'low':''}" style="height:${Math.max(2, v/mx*62)}px"></i>${DG_DIAS[i]}<br>${(v/t*100).toFixed(0)}%</div>`).join('')}</div>`;
}
function dgProductosHtml(c, titulo){
  const ps = dgProductos(c); const mayor = ps.filter(p=>p.k!=='Total prepago').sort((a,b)=>b.gap-a.gap)[0];
  return `<table class="dg-mini"><thead><tr><th class="t">Producto</th><th>Cuota</th><th>Altas</th><th>Alcance</th><th>Falta</th></tr></thead><tbody>${ps.map(p=>`<tr class="${mayor&&p.k===mayor.k&&p.gap>0?'cur':''}"><td class="t"><b>${p.k}</b></td><td>${p.k==='Pospago'?fmtDec2(p.cuota):fmtProm(p.cuota)}</td><td>${fmtProm(p.altas)}</td><td class="${dgCl(p.al)}">${fmtPct(p.al)}</td><td>${p.gap>0?`<b class="gbx-dn">${p.k==='Pospago'?fmtDec2(p.gap):fmtProm(p.gap)}</b>`:'<span class="cell-muted">·</span>'}</td></tr>`).join('')}</tbody></table>
    ${mayor&&mayor.gap>0?`<div class="gbx-note"><b>Reforzar primero: ${mayor.k}</b> — faltan ${fmtProm(mayor.gap)} altas (${fmtPct(100-(mayor.al||0))} de su cuota).</div>`:''}`;
}
function dgQuePaso(b){
  const c = b.cur, p = b.prev; const li = [];
  if(c.al_t!=null){
    const base = p && p.al_t!=null ? ` (${dgPP(c.al_t-p.al_t)} vs promedio de las 3 semanas previas, ${fmtPct(p.al_t)})` : '';
    li.push(`Cerró la semana ${b.vent[b.vent.length-1].l} con <b class="${dgCl(c.al_t)}">${fmtPct(c.al_t)}</b> de alcance total${base}: ${fmtProm(c.altas_t)} altas contra una cuota de ${fmtProm(c.cuota_t)}; dejó de vender <b>${fmtProm(c.loss)}</b>.`);
  }
  if(c.al_temm!=null) li.push(`TEMM al <b class="${dgCl(c.al_temm)}">${fmtPct(c.al_temm)}</b> (${fmtProm(c.altas_temm)} de ${fmtProm(c.cuota_temm)}).`);
  if(c.piso) li.push(`Piso: <b>${c.piso.est}</b> (${fmtProm(c.piso.ventas)} ventas efectivas vs piso ${fmtProm(c.piso.piso)}${c.piso.lineas>0?`; líneas sugeridas ${fmtProm(c.piso.lineas)}`:''}).`);
  if(c.cob!=null) li.push(`Cobertura ${fmtPct(c.cob)} (${fmtProm(c.checks)} de ${fmtProm(c.cuota_checks)} checks).`);
  const tend = b.w.map(x=>x.al_t); const bajando = tend.length>=3 && tend.slice(-3).every((v,i,a)=>v!=null && (i===0 || v<a[i-1]));
  if(bajando) li.push('<b class="gbx-dn">Tres semanas seguidas a la baja.</b>');
  if(INVD && b.inv && b.inv.pz!=null) li.push(`Inventario: ${fmtInt(b.inv.pz)} piezas, nivel <b>${b.inv.estatus}</b>${b.inv.ratio!=null?` (${fmtPct(b.inv.ratio*100)} vs ${b.inv.ref})`:''}.`);
  return `<ul class="dg-pasa">${li.map(x=>`<li>${x}</li>`).join('')}</ul>`;
}
function dgCausasHtml(b){
  if(!b.causas.length) return '<div class="gbx-note">Sin causas relevantes detectadas esta semana: la tienda está en rango.</div>';
  return b.causas.map((x,i)=>`<div class="dg-cause ${x.tier}"><div class="n">${i+1}</div><div><b>${gbxEsc(x.titulo)}</b><p>${x.evidencia}</p><div class="act">Cómo: ${gbxEsc(x.accion)}</div><p>Cuándo: ${gbxEsc(x.cuando)}</p></div><div class="imp">${x.impacto>0?`hasta +${fmtProm(x.impacto)} altas/sem.`:''}</div></div>`).join('');
}
function dgGrafica(id, b){
  setTimeout(()=>{
    const labs = b.hist.map(h=>h.l);
    gbxChart(id, {type:'bar', data:{labels:labs, datasets:[
      {type:'bar', label:'Cuota', data:b.hist.map(h=>+h.cuota_t.toFixed(1)), backgroundColor:'#E5E7EB'},
      {type:'bar', label:'Altas', data:b.hist.map(h=>h.altas_t), backgroundColor:'#F2790AAA'},
      {type:'line', label:'% Alcance total', data:b.hist.map(h=>h.al_t==null?null:+h.al_t.toFixed(1)), borderColor:'#1A1A1A', yAxisID:'y1', tension:.3, pointRadius:3, spanGaps:true},
      {type:'line', label:'% Alcance TEMM', data:b.hist.map(h=>h.al_temm==null?null:+h.al_temm.toFixed(1)), borderColor:'#0A6EBD', borderDash:[5,3], yAxisID:'y1', tension:.3, pointRadius:2, spanGaps:true}]},
      options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom', labels:{boxWidth:10, font:{size:10}}}},
        scales:{y:{beginAtZero:true, ticks:{font:{size:9.5}}}, y1:{position:'right', min:0, grid:{drawOnChartArea:false}, ticks:{callback:v=>v+'%', font:{size:9.5}}}, x:{ticks:{font:{size:9}}}}}});
  }, 30);
}
/* Tarjeta completa de UNA tienda */
function dgTiendaHtml(b, opts){
  opts = opts||{}; const s = b.s; const c = b.cur; const gid = 'dg-g-'+s+(opts.sufijo||'');
  const top = b.top;
  return `
    ${opts.sinCabecera ? '' : `<div class="dg-head"><h3>${gbxEsc(dgDeS(s))} <span class="cell-muted" style="font-size:13px;">${gbxEsc(ST.idpdv[s])}</span></h3>
      <div class="meta">${gbxEsc(DC.cadena[ST.cadena[s]]||'')}${INVD&&INVD.tam[s]?` · tamaño ${INVD.tam[s]}`:''} · ${ST.posc[s]||1} ${(ST.posc[s]||1)>1?'posiciones':'posición'} · Supervisor: <b>${gbxEsc(DC.supervisor[ST.supervisor[s]]||'—')}</b> · Gerente/Líder: ${gbxEsc(DC.gerente_lider[ST.gerente_lider[s]]||'—')}</div>
      <div style="margin-top:6px;"><span class="dg-prio ${(b.rankSup||b.rank)<=3?'t1':(b.rankSup||b.rank)<=10?'t2':''}">#${b.rankSup||b.rank}</span> <span class="gbx-note">${b.rankSup?`prioridad dentro de su supervisor (de ${b.nSup}) · #${b.rank} de ${b.nTot} en el filtro · representa <b>${fmtPct(b.pctLossSup)}</b> de la pérdida de su supervisor (${fmtPct(b.pctLoss)} del total)`:`prioridad · representa <b>${fmtPct(b.pctLoss)}</b> de la pérdida del grupo`}</span></div>
      ${top?`<div class="dg-first">Corregir primero: ${gbxEsc(top.titulo)}</div>`:'<div class="dg-first" style="background:var(--green);">Sin alertas: mantener el ritmo</div>'}</div>`}
    <div class="dg-sec">¿Qué pasó? <span class="dg-q">últimas 4 semanas, terminando en ${b.vent[b.vent.length-1].l}</span></div>
    ${dgQuePaso(b)}
    <div class="dg-cols">
      <div><div class="dg-sec">Comparativo de 4 semanas</div>${dgTabla4(b.w, b.vent.map(v=>v.l), DG_FILAS)}</div>
      <div><div class="dg-sec">¿Dónde? <span class="dg-q">producto con mayor brecha</span></div>${dgProductosHtml(c)}
        <div class="dg-sec">¿Cuándo? <span class="dg-q">altas por día de la semana (4 sem.)</span></div>${dgDow(dgSumarSemanas(b.w).dow)}</div>
    </div>
    <div class="dg-sec">¿Por qué? <span class="dg-q">causas ordenadas · ¿cómo y cuándo corregirlas?</span></div>
    ${dgCausasHtml(b)}
    <div class="dg-sec">Histórico de la tienda <span class="dg-q">hasta 13 semanas</span></div>
    <div class="gbx-card"><div class="gbx-ch" style="height:230px;"><canvas id="${gid}"></canvas></div></div>`;
}

/* ---------- vistas ---------- */
function skeletonDiagnostico(){
  document.getElementById('view-diagnostico').innerHTML = `
    <div class="page-head"><div><h2>Diagnóstico</h2><div class="sub">Qué pasó, dónde, por qué y cómo corregirlo, siempre ordenado por prioridad. La medición es por supervisor.</div></div></div>
    <div class="gbx-bar"><div class="gbx-seg" id="dg-nivel"><button data-n="tienda">Tienda</button><button data-n="supervisor">Supervisor</button><button data-n="gerente_lider">Gerente / Líder</button><button data-n="region">Región</button></div>
      <select id="dg-sem" aria-label="Semana de análisis"></select><select id="dg-pick" aria-label="Elegir" style="min-width:230px;"></select></div>
    <div class="dg-legend"><b>Cómo se prioriza:</b> 40% pérdida (altas que faltan contra la cuota) · 25% volumen de cuota · 20% potencial (lo que la tienda ya vendió en su mejor semana) · 15% inventario disponible. <b>1</b> = lo más urgente. Usa los filtros de arriba para elegir gerente, región o supervisores.</div>
    <div id="dg-body"></div>`;
  const root = document.getElementById('view-diagnostico');
  root.addEventListener('click', e=>{
    const nv = e.target.closest('#dg-nivel button'); if(nv){ DG.nivel = nv.dataset.n; renderDiagnostico(); return; }
    const tr = e.target.closest('tr.dg-row'); if(tr){ dgToggleFila(tr); }
  });
  root.addEventListener('change', e=>{
    if(e.target.id==='dg-sem'){ DG.sem = Number(e.target.value); renderDiagnostico(); }
    else if(e.target.id==='dg-pick'){ if(DG.nivel==='tienda') DG.tienda = Number(e.target.value); else DG.supervisor = Number(e.target.value); renderDiagnostico(); }
  });
}
function dgToggleFila(tr){
  const sig = tr.nextElementSibling;
  if(sig && sig.classList.contains('dg-det')){ sig.remove(); tr.classList.remove('open'); return; }
  const di = DG.semActual; let html = '';
  if(tr.dataset.s!==undefined){ const sup = ST.supervisor[Number(tr.dataset.s)]; const scope = DG.nivel==='tienda' ? STATE.storeIdxArray : STATE.storeIdxArray.filter(x=>ST.supervisor[x]===sup); const an = dgAnalizar(scope, di); const b = an.bases.find(x=>x.s===Number(tr.dataset.s)); if(b) html = dgTiendaHtml(b, {sinCabecera:true, sufijo:'-r'}); if(b) dgGrafica('dg-g-'+b.s+'-r', b); }
  else if(tr.dataset.sup!==undefined){ html = dgSupervisorHtml(Number(tr.dataset.sup), di, true); }
  const d = document.createElement('tr'); d.className = 'gbt-det dg-det'; d.innerHTML = `<td colspan="${tr.children.length}">${html}</td>`;
  tr.after(d); tr.classList.add('open');
}
/* Ranking de tiendas (un supervisor) */
function dgRankTiendasHtml(bases, enDetalle){
  return `${enDetalle?'':'<div class="tw" style="max-height:70vh">'}<table class="dt st gbt dg-rank"><thead><tr><th>#</th><th class="t">Tienda</th><th>Cuota</th><th>Altas</th><th>Pérdida</th><th>% de la pérdida</th><th>Alcance total</th><th>Δ vs previas</th><th>Alcance TEMM</th><th>Inventario</th><th class="t">Causa principal → cómo</th></tr></thead><tbody>
  ${bases.map(b=>{ const c=b.cur, p=b.prev; const d = p&&p.al_t!=null&&c.al_t!=null ? c.al_t-p.al_t : null;
    return `<tr class="gbt-r dg-row" data-s="${b.s}"><td><span class="dg-prio ${b.rank<=3?'t1':b.rank<=10?'t2':''}">${b.rank}</span></td><td class="t"><span class="gbt-car">▶</span><b>${gbxEsc(dgDeS(b.s))}</b> <span class="cell-muted">${gbxEsc(ST.idpdv[b.s])}</span></td>
      <td>${fmtProm(c.cuota_t)}</td><td>${fmtProm(c.altas_t)}</td><td>${c.loss>0?`<b class="gbx-dn">${fmtProm(c.loss)}</b>`:'<span class="cell-muted">·</span>'}</td><td>${fmtPct(b.pctLoss)}</td>
      <td class="${dgCl(c.al_t)}">${fmtPct(c.al_t)}</td><td>${d==null?'—':`<span class="${d>=0?'gbx-up':'gbx-dn'}">${dgPP(d)}</span>`}</td><td class="${dgCl(c.al_temm)}">${fmtPct(c.al_temm)}</td>
      <td>${b.inv?gbxEst(b.inv.estatus):'—'}</td><td class="cause">${b.top?`<b>${gbxEsc(b.top.titulo)}</b><br>${gbxEsc(b.top.accion)}`:'<span class="cell-muted">Sin alertas</span>'}</td></tr>`; }).join('')}
  </tbody></table>${enDetalle?'':'</div>'}`;
}
/* Tarjeta de un supervisor: agregado + ranking de sus tiendas */
function dgSupervisorHtml(supIdx, di, enDetalle){
  const stores = STATE.storeIdxArray.filter(s=>ST.supervisor[s]===supIdx);
  const an = dgAnalizar(stores, di);
  if(!an.bases.length) return '<div class="gbx-empty">Sin datos para este supervisor en la semana elegida.</div>';
  DG.scopeRanking = stores;
  const vent = dgVentana(di, 4);
  const ws = vent.map(v=>dgSumarSemanas(an.bases.map(b=>b.w[b.w.length-vent.length+vent.indexOf(v)] )));
  const cur = ws[ws.length-1], prev = ws.length>1 ? dgSumarSemanas(ws.slice(0,-1)) : null;
  // causas más frecuentes entre sus tiendas
  const frec = {}; for(const b of an.bases) for(const c of b.causas) { (frec[c.titulo] || (frec[c.titulo] = {n:0, imp:0, tier:c.tier, accion:c.accion})).n++; frec[c.titulo].imp += c.impacto; }
  const topFrec = Object.entries(frec).sort((a,b)=>b[1].imp-a[1].imp).slice(0,5);
  const criticas = an.bases.filter(b=>b.cur.al_t!=null && b.cur.al_t<60).length;
  const pseudo = {cur, prev, w:ws, vent, inv:null};
  const nombre = DC.supervisor[supIdx]||'—';
  const topLoss = an.bases.slice(0,3).reduce((a,b)=>a+b.cur.loss,0);
  const bloque = `
    ${enDetalle?'':`<div class="dg-head"><h3>${gbxEsc(nombre)}</h3><div class="meta">Gerente/Líder: ${gbxEsc(DC.gerente_lider[ST.gerente_lider[stores[0]]]||'—')} · ${an.bases.length} tiendas con datos · ${criticas} por debajo de 60% de alcance</div>
      <div class="dg-first">Concentra ${fmtPct(gbxPct(topLoss, an.lossTot))} de su pérdida en las 3 primeras tiendas</div></div>`}
    <div class="dg-sec">¿Qué pasó? <span class="dg-q">todas sus tiendas, semana ${vent[vent.length-1].l}</span></div>
    <ul class="dg-pasa"><li>Alcance total <b class="${dgCl(cur.al_t)}">${fmtPct(cur.al_t)}</b>${prev&&prev.al_t!=null?` (${dgPP(cur.al_t-prev.al_t)} vs promedio de las 3 previas, ${fmtPct(prev.al_t)})`:''}: ${fmtProm(cur.altas_t)} altas vs cuota ${fmtProm(cur.cuota_t)}; faltaron <b>${fmtProm(cur.loss)}</b> (${fmtPct(gbxPct(cur.loss,cur.cuota_t))} de la cuota).</li>
      <li>TEMM <b class="${dgCl(cur.al_temm)}">${fmtPct(cur.al_temm)}</b> · cobertura ${fmtPct(cur.cob)} · ${criticas} de ${an.bases.length} tiendas críticas (menos de 60%).</li></ul>
    <div class="dg-cols"><div><div class="dg-sec">Comparativo de 4 semanas</div>${dgTabla4(ws, vent.map(v=>v.l), DG_FILAS)}</div>
      <div><div class="dg-sec">¿Dónde? <span class="dg-q">producto con mayor brecha</span></div>${dgProductosHtml(cur)}<div class="dg-sec">¿Cuándo? <span class="dg-q">altas por día</span></div>${dgDow(dgSumarSemanas(ws).dow)}</div></div>
    <div class="dg-sec">¿Por qué? <span class="dg-q">causas más frecuentes entre sus tiendas, por impacto</span></div>
    ${topFrec.map(([t,v],i)=>`<div class="dg-cause ${v.tier}"><div class="n">${i+1}</div><div><b>${gbxEsc(t)}</b><p>${v.n} de ${an.bases.length} tiendas.</p><div class="act">Cómo: ${gbxEsc(v.accion)}</div></div><div class="imp">hasta +${fmtProm(v.imp)} altas/sem.</div></div>`).join('') || '<div class="gbx-note">Sin causas relevantes.</div>'}
    <div class="dg-sec">Prioridad de tiendas <span class="dg-q">1 = la que más conviene atender · clic en una tienda para ver su diagnóstico completo</span></div>
    ${dgRankTiendasHtml(an.bases, enDetalle)}`;
  return bloque;
}
/* Gerente / Región: ranking de supervisores */
function dgRankSupervisoresHtml(di){
  const grupos = new Map();
  for(const s of STATE.storeIdxArray){ const v = ST.supervisor[s]; if(!grupos.has(v)) grupos.set(v, []); grupos.get(v).push(s); }
  const sups = [];
  const todas = [];
  for(const [v, ss] of grupos){ const an = dgAnalizar(ss, di); if(!an.bases.length) continue; todas.push(...an.bases); sups.push({v, ss, an}); }
  const vent = dgVentana(di, 4);
  const items = sups.map(x=>{
    const ws = vent.map((vv,i)=>dgSumarSemanas(x.an.bases.map(b=>b.w[b.w.length-vent.length+i]).filter(Boolean)));
    const cur = ws[ws.length-1], prev = ws.length>1 ? dgSumarSemanas(ws.slice(0,-1)) : null;
    const pot = gbxSum(x.an.bases.map(b=>b.potencial)); const inv = x.an.bases.length ? gbxSum(x.an.bases.map(b=>dgInvFactor(b.inv)))/x.an.bases.length : 0.7;
    const frec = {}; for(const b of x.an.bases) for(const c of b.causas){ (frec[c.titulo]||(frec[c.titulo]={n:0,imp:0,accion:c.accion})).n++; frec[c.titulo].imp += c.impacto; }
    const top = Object.entries(frec).sort((a,b)=>b[1].imp-a[1].imp)[0];
    return {v:x.v, nombre:DC.supervisor[x.v]||'—', ger:DC.gerente_lider[ST.gerente_lider[x.ss[0]]]||'—', n:x.an.bases.length, cur, prev, loss:cur.loss, cuota:cur.cuota_t, pot, inv,
      crit:x.an.bases.filter(b=>b.cur.al_t!=null && b.cur.al_t<60).length, top};
  });
  const lossTot = gbxSum(items.map(i=>i.loss));
  dgScorePrioridad(items); items.forEach((it,i)=>{ it.rank = i+1; });
  DG.scopeRanking = STATE.storeIdxArray;
  const regTxt = {region:'Región', gerente_lider:'Gerente/Líder'}[DG.nivel];
  return `<div class="gbx-note">Se miden <b>${items.length}</b> supervisores con <b>${fmtInt(todas.length)}</b> tiendas; pérdida total de la semana: <b>${fmtProm(lossTot)}</b> altas. Clic en un supervisor para ver sus tiendas ordenadas por prioridad.</div>
  <div class="tw" style="max-height:72vh"><table class="dt st gbt dg-rank"><thead><tr><th>#</th><th class="t">Supervisor</th><th class="t">Gerente/Líder</th><th>Tiendas</th><th>Cuota</th><th>Altas</th><th>Pérdida</th><th>% de la pérdida</th><th>Alcance total</th><th>Δ vs previas</th><th>Alcance TEMM</th><th>Tiendas críticas</th><th class="t">Causa principal → cómo</th></tr></thead><tbody>
  ${items.map(i=>{ const d = i.prev&&i.prev.al_t!=null&&i.cur.al_t!=null ? i.cur.al_t-i.prev.al_t : null;
    return `<tr class="gbt-r dg-row" data-sup="${i.v}"><td><span class="dg-prio ${i.rank<=3?'t1':i.rank<=10?'t2':''}">${i.rank}</span></td><td class="t"><span class="gbt-car">▶</span><b>${gbxEsc(i.nombre)}</b></td><td class="t">${gbxEsc(i.ger)}</td><td>${i.n}</td>
      <td>${fmtProm(i.cuota)}</td><td>${fmtProm(i.cur.altas_t)}</td><td><b class="gbx-dn">${fmtProm(i.loss)}</b></td><td>${fmtPct(gbxPct(i.loss,lossTot))}</td><td class="${dgCl(i.cur.al_t)}">${fmtPct(i.cur.al_t)}</td>
      <td>${d==null?'—':`<span class="${d>=0?'gbx-up':'gbx-dn'}">${dgPP(d)}</span>`}</td><td class="${dgCl(i.cur.al_temm)}">${fmtPct(i.cur.al_temm)}</td><td>${i.crit}</td>
      <td class="cause">${i.top?`<b>${gbxEsc(i.top[0])}</b> (${i.top[1].n} tiendas)<br>${gbxEsc(i.top[1].accion)}`:'<span class="cell-muted">Sin alertas</span>'}</td></tr>`; }).join('')}</tbody></table></div>`;
}
function renderDiagnostico(){
  const body = document.getElementById('dg-body'); if(!body) return;
  document.querySelectorAll('#dg-nivel button').forEach(b=>b.classList.toggle('on', b.dataset.n===DG.nivel));
  // semana de análisis: las semanas del filtro de fechas (por defecto, la última)
  let semsRango = weeksInCurrentRange();
  if(!semsRango.length) semsRango = dgWeeks().slice(-1).map(w=>({key:w.i, label:w.l}));
  if(DG.sem==null || !semsRango.find(w=>w.key===DG.sem)) DG.sem = semsRango[semsRango.length-1].key;
  const sel = document.getElementById('dg-sem');
  sel.innerHTML = semsRango.slice().reverse().map(w=>`<option value="${w.key}" ${w.key===DG.sem?'selected':''}>Semana ${gbxEsc(w.label)}</option>`).join('');
  DG.semActual = DG.sem;
  const pick = document.getElementById('dg-pick');
  const alcance = STATE.storeIdxArray;
  if(!alcance.length){ pick.style.display = 'none'; body.innerHTML = '<div class="gbx-empty">Sin tiendas para este filtro.</div>'; return; }
  DG.abiertos.clear();
  if(DG.nivel==='tienda'){
    // lista ordenada por prioridad para elegir; por defecto la #1
    const an = dgAnalizar(alcance, DG.sem);
    if(!an.bases.length){ pick.style.display='none'; body.innerHTML = '<div class="gbx-empty">Sin datos en la semana elegida.</div>'; return; }
    if(DG.tienda==null || !an.bases.find(b=>b.s===DG.tienda)) DG.tienda = an.bases[0].s;
    pick.style.display = ''; pick.innerHTML = an.bases.map(b=>`<option value="${b.s}" ${b.s===DG.tienda?'selected':''}>#${b.rank} · ${gbxEsc(dgDeS(b.s))} (${gbxEsc(ST.idpdv[b.s])})</option>`).join('');
    const b = an.bases.find(x=>x.s===DG.tienda);
    const hermanas = an.bases.filter(x=>ST.supervisor[x.s]===ST.supervisor[b.s]);
    b.rankSup = hermanas.indexOf(b)+1; b.nSup = hermanas.length; b.nTot = an.bases.length;
    const lossSup = gbxSum(hermanas.map(x=>x.cur.loss)); b.pctLossSup = lossSup>0 ? b.cur.loss/lossSup*100 : 0;
    DG.scopeRanking = alcance;
    body.innerHTML = `<div class="gbx-note">Tiendas ordenadas de la más prioritaria (#1) a la menos; el selector las lista en ese orden. Para ver a todas juntas usa la vista Supervisor.</div>` + dgTiendaHtml(b);
    dgGrafica('dg-g-'+b.s, b);
  } else if(DG.nivel==='supervisor'){
    const sups = [...new Set(alcance.map(s=>ST.supervisor[s]))];
    const orden = sups.map(v=>{ const an = dgAnalizar(alcance.filter(s=>ST.supervisor[s]===v), DG.sem); return {v, loss:an.lossTot, n:an.bases.length}; }).filter(x=>x.n>0).sort((a,b)=>b.loss-a.loss);
    if(!orden.length){ pick.style.display='none'; body.innerHTML = '<div class="gbx-empty">Sin datos en la semana elegida.</div>'; return; }
    if(DG.supervisor==null || !orden.find(o=>o.v===DG.supervisor)) DG.supervisor = orden[0].v;
    pick.style.display = ''; pick.innerHTML = orden.map((o,i)=>`<option value="${o.v}" ${o.v===DG.supervisor?'selected':''}>${gbxEsc(DC.supervisor[o.v]||'—')} · pérdida ${fmtProm(o.loss)}</option>`).join('');
    body.innerHTML = dgSupervisorHtml(DG.supervisor, DG.sem, false);
  } else {
    pick.style.display = 'none';
    body.innerHTML = dgRankSupervisoresHtml(DG.sem);
  }
}
