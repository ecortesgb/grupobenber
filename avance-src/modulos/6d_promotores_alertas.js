/* ============================================================================================================
   MÓDULO 6d · TOP 10 DE PROMOTORES Y ALERTAS DE PROMOTOR
   Top 10: alcance, gap, altas (registros) y cuota por promotor, con su antigüedad y categoría (la sección Top 10 de Dirección lo llama).
   Alertas: qué promotores acumulan más temas en el periodo filtrado (días cerrados, tiendas del filtro). Severidad: Crítica 3, Alta 2, Media 1.
   ============================================================================================================ */
const PRM_TOP10_MIN_DIAS = 3;                    // un promotor entra al ranking con al menos 3 días con check en el periodo
const PRM_SEV = {'Crítica':3, 'Alta':2, 'Media':1};
const PRM_SEV_COLOR = {'Crítica':'#DC2626', 'Alta':'#F2790A', 'Media':'#D97706'};
const PRM_ALERTAS_DEF = {
  'Dos o más semanas seguidas en categoría baja':['Crítica','Terminó el periodo con 2 o más semanas seguidas en Rojo o Naranja (sin contar su adaptación).'],
  'Nuevo ingreso sin visita del supervisor':['Crítica','Ingresó hace menos de 30 días y ninguna de sus tiendas recibió visita del supervisor en el periodo.'],
  'Faltó sábado y domingo la misma semana':['Crítica','En una misma semana no checó ni sábado ni domingo, y no tenía ausencia justificada.'],
  'Equipo repetido':['Crítica','Checó desde un celular que ese día ya había usado otra persona.'],
  'Categoría Rojo':['Alta','Más de la mitad de sus días con check sin venta, o ninguna venta en el periodo.'],
  'Solo vende prepago':['Alta','3 o más días con check, vendió prepago y ningún TEMM, portabilidad ni pospago (fuera de su adaptación).'],
  'Ausentismo mayor a 15%':['Alta','Faltas sin justificar entre los 6 días que debía trabajar por semana: más de 15% (crítico arriba de 30%).'],
  'Faltas en fin de semana':['Media','Dos o más sábados o domingos sin check y sin ausencia justificada en el periodo.'],
  'Checks con error':['Media','3 o más días con check que no fue válido (fuera de rango, sin salida, fuera de ventana, error de comida, tiempo incompleto).'],
  'Sin visita de supervisión en 2 o más semanas':['Media','En 2 o más semanas ninguna de sus tiendas recibió visita del supervisor.'],
  'Cambia de tienda seguido':['Media','Trabajó en 3 o más tiendas en una misma semana, o en 4 o más en el periodo (no aplica a Cubre descansos).'],
};
const prmUIA = {sev:'', tipo:'', buscar:'', pagina:1};

/* ---------------- Top 10: filas con la misma forma que las de tiendas/supervisores ---------------- */
function prmTop10Filas(){
  const {filas} = prmPromotores();
  const R = (v, q) => q > 0 ? v/q*100 : null;
  return filas.filter(f=>f.dck >= PRM_TOP10_MIN_DIAS).map(f=>({
    id:'p'+f.p, label:f.nombre, nStores:0, extra:f,
    metrics:{soloTotal:true, alcance_t:R(f.tot,f.qT), alcance_temm:R(f.temm,f.qM), alcance_porta:R(f.porta,f.qP), alcance_pospago:R(f.pos,f.qS),
      gap_t:f.tot-f.qT, gap_temm:f.temm-f.qM, gap_porta:f.porta-f.qP, gap_pospago:f.pos-f.qS,
      raw:{altas_t:f.tot, altas_temm:f.temm, altas_porta:f.porta, altas_pospago:f.pos, cuota_t:f.qT, cuota_temm:f.qM, cuota_porta:f.qP, cuota_pospago:f.qS}}}));
}

/* ---------------- Alertas ---------------- */
function prmAlertas(){
  const a = currentRange.startIdx, X = PRM.X, d = PRM.d, P = d.personas, NF = FECHAS.length;
  const fin = Math.min(currentRange.endIdx, X.hoyIdx - 1);
  const {A, NP, NW} = prmSemanal(a, currentRange.endIdx);
  prmIndexarExp();
  const ok = new Uint8Array(N_STORES); for(const s of STATE.storeIdxArray) ok[s] = 1;
  // semanas completas y cerradas dentro del periodo
  const semOk = []; for(let w=0; w<NW; w++){ const r = WEEK_RANGES[w]; if(r && r.start >= a && r.end <= fin) semOk.push(w); }
  // visitas del supervisor por tienda y semana
  const visit = new Uint8Array(N_STORES * NW);
  for(let i=0;i<N_ROWS;i++) if((RW.visitas_sup[i]||0) > 0){ const w = DATE_TO_SEMANA[RW.fecha[i]]; if(w != null) visit[RW.store[i]*NW + w] = 1; }
  const per = new Map();
  const get = p => { let o = per.get(p); if(!o){ o = {p, dias:new Map(), tiendas:new Set(), tiendasSem:new Map(), errores:0, equipo:0, ventas:0, tot:0, otros:0}; per.set(p, o); } return o; };
  for(let r=0;r<X.n;r++){
    const s = X.S[r], di = X.D[r]; if(s < 0 || di < 0 || !ok[s] || di < a || di > fin) continue;
    const o = get(X.P[r]), w = DATE_TO_SEMANA[di];
    if(X.chk[r] > 0 || X.nchk[r] > 0){ o.tiendas.add(s); let t = o.tiendasSem.get(w); if(!t){ t = new Set(); o.tiendasSem.set(w, t); } t.add(s); }
    if(X.chk[r] > 0) o.dias.set(di, 1);
    if(X.ec[r] >= 5 && X.ec[r] <= 12 && X.nchk[r] > 0 && !X.trab[X.P[r]*NF + di]) o.errores++;
    if(X.ec[r] === 12) o.equipo++;
    o.tot += X.tot[r]; o.otros += X.temm[r] + X.porta[r] + X.pos[r];
  }
  const cats = prmCatMap(), out = [];
  for(const [p, o] of per){
    const f = cats.get(p); if(!f) continue;
    const al = []; const add = (t, extra) => al.push({tipo:t, sev:PRM_ALERTAS_DEF[t][0], extra:extra||''});
    // categoría semanal consecutiva baja (Rojo/Naranja) al cierre
    const sem = []; for(const w of semOk){ const k = p*NW + w; if(A.act[k]){ const r = WEEK_RANGES[w]; const ing = P[p][3]; const antig = ing ? Math.round((new Date(FECHAS[r.end]+'T00:00:00') - new Date(ing+'T00:00:00'))/86400000) : 9999;
      sem.push(prmCategoria(prmAlc(A.tot[k], A.qT[k]), prmAlc(A.temm[k], A.qM[k]), A.porta[k], A.tot[k]+A.pos[k], A.dck[k], A.dsv[k], antig)); } }
    let racha = 0; for(let i=sem.length-1; i>=0 && (sem[i]==='Rojo' || sem[i]==='Naranja'); i--) racha++;
    if(racha >= 2) add('Dos o más semanas seguidas en categoría baja', racha + ' semanas');
    if(f.cat === 'Rojo') add('Categoría Rojo');
    if(f.antig >= PRM_U.adaptacion_dias && o.tot > 0 && o.otros === 0 && f.dck >= 3) add('Solo vende prepago');
    // ausentismo y fines de semana (semanas completas y cerradas, sin la semana de su primer check ni la de su baja aparente)
    const ult = X.ultimoCheck[p], semUlt = ult >= 0 ? DATE_TO_SEMANA[ult] : null, bajaAparente = ult >= 0 && ult < X.hoyIdx - 8;
    let esperados = 0, faltas = 0, finde = 0, ambos = 0;
    for(const w of semOk){
      const k = p*NW + w; if(!A.act[k]) continue;
      if(w === semUlt && bajaAparente) continue;
      let primera = true; for(let w2 = 0; w2 < w; w2++) if(A.act[p*NW + w2]) { primera = false; break; }      // su primer semana con check en el periodo
      if(primera && f.antig < 14 + 7) continue;
      const r = WEEK_RANGES[w]; let trab = 0, aus = 0, inval = 0, sabDom = 0;
      for(let di = r.start; di <= r.end; di++){
        const dow = (new Date(FECHAS[di]+'T00:00:00').getDay() + 6) % 7;            // 0 = lunes
        const checo = X.trab[p*NF + di] === 1, inv = !checo && X.inval[p*NF + di] === 1, just = !checo && !inv && prmEnAusencia(p, di);
        if(checo) trab++; else if(inv) inval++; else if(just) aus++;      // check no válido: sale de los denominadores (ni día trabajado ni falta)
        if(dow >= 5 && !checo && !just && !inv) sabDom++;
      }
      esperados += Math.max(0, 6 - aus - inval); faltas += Math.max(0, 6 - aus - inval - trab); finde += sabDom; if(sabDom === 2) ambos++;
    }
    if(esperados >= 6 && faltas >= 2){ const pctF = faltas/esperados*100; if(pctF > 15) add('Ausentismo mayor a 15%', pctF.toFixed(0)+'% ('+faltas+' de '+esperados+' días)'); }
    if(ambos > 0) add('Faltó sábado y domingo la misma semana', ambos + (ambos===1 ? ' semana' : ' semanas'));
    else if(finde >= 2) add('Faltas en fin de semana', finde + ' días');
    if(o.equipo > 0) add('Equipo repetido', o.equipo + (o.equipo===1 ? ' día' : ' días'));
    if(o.errores >= 3) add('Checks con error', o.errores + ' días');
    // acompañamiento del supervisor
    let sinVisita = 0; for(const [w, st] of o.tiendasSem){ if(!semOk.includes(w)) continue; let v = false; for(const s of st) if(visit[s*NW + w]){ v = true; break; } if(!v) sinVisita++; }
    if(f.antig < 30 && o.tiendas.size > 0){ let alguna = false; for(const s of o.tiendas) for(const w of semOk) if(visit[s*NW + w]){ alguna = true; break; } if(!alguna && semOk.length) add('Nuevo ingreso sin visita del supervisor'); }
    if(sinVisita >= 2) add('Sin visita de supervisión en 2 o más semanas', sinVisita + ' semanas');
    // cambios de tienda
    if(f.rol !== 'Cubre descansos'){ let mx = 0; for(const st of o.tiendasSem.values()) mx = Math.max(mx, st.size);
      if(mx >= 3 || o.tiendas.size >= 4) add('Cambia de tienda seguido', o.tiendas.size + ' tiendas'); }
    if(!al.length) continue;
    // ausentismo crítico (>30%) sube de severidad
    al.forEach(x=>{ if(x.tipo==='Ausentismo mayor a 15%' && parseInt(x.extra) > 30) x.sev = 'Crítica'; });
    out.push({f, alertas:al, puntos:al.reduce((s,x)=>s + PRM_SEV[x.sev], 0), criticas:al.filter(x=>x.sev==='Crítica').length});
  }
  return out.sort((x,y)=>y.puntos - x.puntos || y.criticas - x.criticas);
}

function prmRenderAlertas(){
  const cont = document.getElementById('prm-alertas'); if(!cont) return;
  const todas = prmAlertas(), conteoTipo = {}, conteoSev = {};
  todas.forEach(r=>r.alertas.forEach(x=>{ conteoTipo[x.tipo] = (conteoTipo[x.tipo]||0) + 1; conteoSev[x.sev] = (conteoSev[x.sev]||0) + 1; }));
  let lista = todas;
  if(prmUIA.sev) lista = lista.filter(r=>r.alertas.some(x=>x.sev===prmUIA.sev));
  if(prmUIA.tipo) lista = lista.filter(r=>r.alertas.some(x=>x.tipo===prmUIA.tipo));
  const q = prmUIA.buscar.trim().toLowerCase(); if(q) lista = lista.filter(r=>r.f.nombre.toLowerCase().includes(q) || r.f.codigo.toLowerCase().includes(q));
  const pag = 25, np = Math.max(1, Math.ceil(lista.length/pag)); if(prmUIA.pagina > np) prmUIA.pagina = np;
  const chip = x => `<span class="prm-pill" style="--cc:${PRM_SEV_COLOR[x.sev]};margin:1px 3px 1px 0;" title="${prmEsc(PRM_ALERTAS_DEF[x.tipo][1])}">${x.tipo}${x.extra ? ' · '+prmEsc(x.extra) : ''}</span>`;
  cont.innerHTML = `
    <div class="prm-filtros"><button class="prm-chipbtn${prmUIA.sev?'':' on'}" data-sev="">Todas · ${todas.length} promotores</button>
      ${['Crítica','Alta','Media'].map(s=>`<button class="prm-chipbtn${prmUIA.sev===s?' on':''}" data-sev="${s}">${s} · ${conteoSev[s]||0}</button>`).join('')}
      <select id="prma-tipo" style="margin-left:6px"><option value="">Todos los tipos de alerta</option>${Object.keys(PRM_ALERTAS_DEF).map(t=>`<option value="${prmEsc(t)}"${prmUIA.tipo===t?' selected':''}>${t} (${conteoTipo[t]||0})</option>`).join('')}</select>
      <input class="grow" id="prma-buscar" placeholder="Buscar promotor o código…" value="${prmEsc(prmUIA.buscar)}" style="flex:1;min-width:180px;padding:7px 10px;border-radius:9px;border:1.5px solid var(--line);font:inherit;"></div>
    <div style="overflow-x:auto;"><table class="dt st gbt"><thead><tr><th>Promotor</th><th>Categoría</th><th>Antigüedad</th><th>Tienda principal</th><th>Puntos</th><th style="min-width:420px">Alertas</th></tr></thead><tbody>
      ${lista.slice((prmUIA.pagina-1)*pag, prmUIA.pagina*pag).map(r=>`<tr><td class="sticky-col" title="${prmEsc(r.f.codigo)}">${prmEsc(prmCorta(r.f.nombre, 30))}${r.f.rol==='Cubre descansos'?' <small>(cubre)</small>':''}</td><td>${prmPill(r.f.cat)}</td><td>${r.f.antigClase}</td>
        <td style="text-align:left">${r.f.tienda>=0 ? prmEsc(prmCorta(ST.nombre[r.f.tienda], 26)) : '—'}${r.f.nTiendas>1 ? ` <small>+${r.f.nTiendas-1}</small>` : ''}</td><td><b>${r.puntos}</b></td>
        <td style="text-align:left;white-space:normal">${r.alertas.sort((x,y)=>PRM_SEV[y.sev]-PRM_SEV[x.sev]).map(chip).join('')}</td></tr>`).join('') || '<tr><td colspan="6">Sin promotores con alertas para este filtro.</td></tr>'}</tbody></table></div>
    ${np>1 ? `<div style="margin-top:8px;"><button class="btn" id="prma-ant"${prmUIA.pagina<=1?' disabled':''}>◀</button> <span style="font-size:12px;font-weight:700;margin:0 8px;">Página ${prmUIA.pagina} de ${np} · ${fmtInt(lista.length)} promotores</span> <button class="btn" id="prma-sig"${prmUIA.pagina>=np?' disabled':''}>▶</button></div>` : ''}
    <details style="margin-top:10px;"><summary style="cursor:pointer;font-size:12px;font-weight:800;">Cómo se calcula cada alerta</summary>
      <table class="dt st gbt" style="margin-top:6px;"><thead><tr><th>Alerta</th><th>Severidad</th><th style="text-align:left">Regla</th></tr></thead><tbody>${Object.entries(PRM_ALERTAS_DEF).map(([t,[s,c]])=>`<tr><td style="text-align:left">${t}</td><td><span class="prm-pill" style="--cc:${PRM_SEV_COLOR[s]}">${s}</span></td><td style="text-align:left;white-space:normal">${c}</td></tr>`).join('')}</tbody></table>
      <p class="note" style="font-size:11.5px;color:var(--text-muted);margin:6px 0 0;">Puntos: Crítica 3, Alta 2, Media 1. Se evalúan días cerrados y semanas completas dentro del periodo y de las tiendas del filtro. El ausentismo no cuenta la semana de su primer check ni la de su baja aparente, y descuenta las ausencias justificadas de RH (sin mostrar el motivo).</p></details>`;
  cont.querySelectorAll('[data-sev]').forEach(b=>b.addEventListener('click', ()=>{ prmUIA.sev = b.dataset.sev; prmUIA.pagina = 1; prmRenderAlertas(); }));
  document.getElementById('prma-tipo').addEventListener('change', e=>{ prmUIA.tipo = e.target.value; prmUIA.pagina = 1; prmRenderAlertas(); });
  document.getElementById('prma-buscar').addEventListener('input', e=>{ const pos = e.target.selectionStart; prmUIA.buscar = e.target.value; prmUIA.pagina = 1; prmRenderAlertas();
    const n = document.getElementById('prma-buscar'); n.focus(); try{ n.setSelectionRange(pos, pos); }catch(x){} });
  const ant = document.getElementById('prma-ant'), sig = document.getElementById('prma-sig');
  if(ant) ant.addEventListener('click', ()=>{ prmUIA.pagina--; prmRenderAlertas(); }); if(sig) sig.addEventListener('click', ()=>{ prmUIA.pagina++; prmRenderAlertas(); });
}
