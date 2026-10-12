/* ============================================================================================================
   MÓDULO 6c · PROMOTORES DENTRO DE CADA PANTALLA (botón 👥 en las filas de tienda)
   Al abrir una tienda se ven los promotores que checaron ahí en el periodo filtrado, con la información que importa en cada pantalla:
     Alcances / Venta natural: días, venta por producto, cuota prorrateada, alcance y gap · Cobertura: días con check y tipo de check
     Piso: quién aporta menos al piso (para no reenviarlo) · Conversión: quién registra y no convierte · Visitas: quiénes estaban en la visita
   Usa el bloque cifrado de promotores (6_promotores.js): si está bloqueado, el botón pide la clave general.
   ============================================================================================================ */
(function injectCssExp(){
  const css = `
  tr.pt-prm > td.prm-sub{background:#FFFDFB; padding:10px 0 12px; border-bottom:2px solid var(--orange-soft); text-align:left; white-space:normal;}
  td.prm-sub .prm-wrap{position:sticky; left:110px; box-sizing:border-box; width:min(1180px, calc(100vw - 280px)); text-align:left; padding:0 14px 0 8px;}
  td.prm-sub h5{margin:0 0 6px; font-size:12px; color:var(--orange-dark); text-transform:uppercase; letter-spacing:.04em; text-align:left;}
  td.prm-sub .note{font-size:11.5px; color:var(--text-muted); font-weight:600; margin:6px 0 0; text-align:left; white-space:normal;}
  td.prm-sub table.prm-t{border-collapse:collapse; font-size:11.5px; width:100%;}
  td.prm-sub table.prm-t thead th{background:#faf8f6; color:var(--text-muted); font-size:10px; text-transform:uppercase; padding:5px 7px; text-align:center; white-space:nowrap; position:static;}
  td.prm-sub table.prm-t tbody td{padding:5px 7px; border-bottom:1px solid #f2efec; text-align:center; white-space:nowrap; background:transparent;}
  td.prm-sub table.prm-t td.l, td.prm-sub table.prm-t th.l{text-align:left;}
  .prm-dias{display:flex; flex-wrap:wrap; gap:3px; justify-content:flex-start; white-space:normal; max-width:430px;}
  .prm-d{display:inline-block; min-width:30px; padding:2px 4px; border-radius:6px; font-size:10px; font-weight:800; text-align:center; background:#e5e7eb; color:#374151;}
  .prm-d.ok{background:#d9f2df; color:#14532d;} .prm-d.sv{background:#fde2e2; color:#7f1d1d;} .prm-d.ab{background:#dbeafe; color:#1e3a8a;}
  .prm-d.er{background:#fee2e2; color:#991b1b; border:1px solid #fca5a5;} .prm-d.au{background:#ede9fe; color:#5b21b6;} .prm-d.ot{background:#fef3c7; color:#92400e;} .prm-d.no{background:#f3f4f6; color:#9ca3af;}
  .prm-modal{position:fixed; inset:0; background:rgba(0,0,0,.45); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;}
  .prm-modal .box{background:#fff; border-radius:16px; padding:22px 24px; width:min(380px,100%); box-shadow:0 20px 60px rgba(0,0,0,.3);}
  .prm-modal h3{margin:0 0 4px;} .prm-modal p{margin:0 0 12px; font-size:12.5px; color:var(--text-muted); font-weight:600;}
  .prm-modal input{width:100%; padding:10px 12px; border-radius:9px; border:1.5px solid var(--line); font:inherit; margin-bottom:10px;}
  .prm-modal .row{display:flex; gap:8px; justify-content:flex-end;} .prm-modal .err{color:var(--red); font-size:12.5px; font-weight:700; min-height:16px; margin:0 0 6px;}
  `;
  const el = document.createElement('style'); el.id = 'prm-exp-css'; el.textContent = css; document.head.appendChild(el);
})();

/* ---------------- carga de promotores (antes pedía clave; ahora solo carga) ---------------- */
function prmPedirClave(alCargar){
  prmCargar().then(()=>alCargar && alCargar()).catch(()=>{});
}

/* ---------------- índices extra (la primera vez que se abre una tienda) ---------------- */
function prmIndexarExp(){
  const X = PRM.X; if(X.exp) return; const d = PRM.d, c = d.cols, NF = FECHAS.length, n = X.n;
  X.altas = Int32Array.from(c.altas); X.conoc = Int32Array.from(c.conoc); X.ec = Int32Array.from(c.ec);
  const pt = new Map();
  for(let r=0;r<n;r++){ const s = X.S[r]; if(s < 0 || X.D[r] < 0) continue; let a = pt.get(s); if(!a){ a = []; pt.set(s, a); } a.push(r); }
  X.porTienda = pt;
  X.trab = new Uint8Array(d.personas.length * NF);                       // la persona tuvo un check válido ese día (en cualquier tienda)
  for(let r=0;r<n;r++) if(X.chk[r] > 0 && X.D[r] >= 0) X.trab[X.P[r]*NF + X.D[r]] = 1;
  X.inval = new Uint8Array(d.personas.length * NF);                     // tuvo registro de check ese día pero ninguno válido
  for(let r=0;r<n;r++) if(X.nchk[r] > 0 && X.chk[r] === 0 && X.D[r] >= 0) X.inval[X.P[r]*NF + X.D[r]] = 1;
  X.aus = new Map();                                                       // persona -> rangos de ausencia justificada en índices de fecha
  const ini = new Date(d.ini + 'T00:00:00');
  const aIdx = off => { const t = new Date(ini); t.setDate(t.getDate()+off); const iso = t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0'); return FECHAS.indexOf(iso); };
  for(const [p, rangos] of Object.entries(d.aus || {})) X.aus.set(Number(p), rangos.map(([x,y])=>[aIdx(x), aIdx(y)]));
  X.exp = true;
}
const prmEnAusencia = (p, di) => { const r = PRM.X.aus.get(p); if(!r) return false; for(const [a,b] of r) if(a >= 0 && di >= a && di <= b) return true; return false; };

/* categorías del periodo (se calcula una vez por recálculo de filtros) */
function prmCatMap(){
  const clave = currentRange.startIdx + '-' + currentRange.endIdx;
  if(PRM._cacheState === STATE && PRM._cacheClave === clave) return PRM._cacheMap;
  const {filas} = prmPromotores(); const m = new Map(filas.map(f=>[f.p, f]));
  PRM._cacheState = STATE; PRM._cacheClave = clave; PRM._cacheMap = m; return m;
}

/* promotores de UNA tienda en el periodo: ventas, cuota prorrateada y días */
function prmTiendaFilas(s){
  prmIndexarExp();
  const X = PRM.X, P = PRM.d.personas, a = currentRange.startIdx, b = Math.min(currentRange.endIdx, FECHAS.length-1);
  const mapa = new Map();
  for(const r of (X.porTienda.get(s) || [])){
    const di = X.D[r]; if(di < a || di > b) continue;
    let o = mapa.get(X.P[r]);
    if(!o){ o = {p:X.P[r], dias:[], tot:0, temm:0, porta:0, pos:0, imp:0, qT:0, qM:0, qP:0, qS:0, regC:0, altasC:0}; mapa.set(X.P[r], o); }
    o.dias.push({di, chk:X.chk[r], nchk:X.nchk[r], tot:X.tot[r], temm:X.temm[r], porta:X.porta[r], pos:X.pos[r], ec:X.ec[r]});
    o.tot += X.tot[r]; o.temm += X.temm[r]; o.porta += X.porta[r]; o.pos += X.pos[r]; o.imp += X.imp[r];
    if(X.nchk[r] > 0){ o.qT += X.qT[r]; o.qM += X.qM[r]; o.qP += X.qP[r]; o.qS += X.qS[r]; }
    if(X.conoc[r]){ o.regC += X.tot[r]; o.altasC += X.altas[r]; }
  }
  const cats = prmCatMap();
  return [...mapa.values()].map(o=>{ const f = cats.get(o.p), ing = P[o.p][3];
    return {...o, nombre:P[o.p][1], rol:P[o.p][2], ingreso:ing, cat:f ? f.cat : '—', antig:f ? f.antigClase : '—', antigDias:f ? f.antig : 9999,
      diasChk:o.dias.filter(d=>d.chk>0).length, aT:prmAlc(o.tot, o.qT), aM:prmAlc(o.temm, o.qM)}; });
}
const prmDiaCorto = di => { const f = FECHAS[di]; if(!f) return '—'; const [y,m,d] = f.split('-'); return d+'/'+m; };
const prmDow = di => ['D','L','M','M','J','V','S'][new Date(FECHAS[di]+'T00:00:00').getDay()];
const prmNom = o => prmEsc(prmCorta(o.nombre, 30)) + (o.rol==='Cubre descansos' ? ' <small>(cubre)</small>' : '');
const prmFmt1 = v => v.toFixed(1);

/* ---------------- Alcances / Venta natural / Interanual ---------------- */
function prmExpAlcances(s, natural){
  const f = prmTiendaFilas(s).sort((x,y)=>y.tot - x.tot);
  if(!f.length) return '<h5>Promotores</h5><p class="note">Ningún promotor registró check ni venta en esta tienda en el periodo filtrado.</p>';
  const tot = f.reduce((a,o)=>({tot:a.tot+o.tot, qT:a.qT+o.qT}), {tot:0, qT:0});
  return `<h5>Promotores de la tienda · ${f.length}</h5><table class="prm-t"><thead><tr><th class="l">Promotor</th><th>Categoría</th><th>Antigüedad</th><th>Días con check</th><th class="l">Días</th><th>Total</th><th>Temm</th><th>Porta</th><th>Pospago</th>${natural?'<th title="Registros de DN de impulso (no natural)">No natural</th>':''}
    <th>Cuota total</th><th>Cuota temm</th><th>Alcance total</th><th>Alcance temm</th><th>Gap total</th></tr></thead><tbody>${f.map(o=>`<tr><td class="l">${prmNom(o)}</td><td>${prmPill(o.cat)}</td><td>${o.antig}</td><td>${o.diasChk}</td>
    <td class="l"><div class="prm-dias">${o.dias.map(d=>`<span class="prm-d ${d.chk>0 ? (d.tot+d.pos>0 ? 'ok' : 'sv') : 'no'}" title="${prmDiaCorto(d.di)}: ${d.chk>0?'check':'sin check válido'} · venta ${d.tot+d.pos} (total ${d.tot}, temm ${d.temm}, porta ${d.porta}, pospago ${d.pos})">${prmDow(d.di)}${prmDiaCorto(d.di).slice(0,2)}</span>`).join('')}</div></td>
    <td><b>${fmtInt(o.tot)}</b></td><td>${fmtInt(o.temm)}</td><td>${fmtInt(o.porta)}</td><td>${fmtInt(o.pos)}</td>${natural?`<td>${fmtInt(o.imp)}</td>`:''}<td>${prmFmt1(o.qT)}</td><td>${prmFmt1(o.qM)}</td>
    <td class="${pctClass(o.aT*100)}">${fmtPct(o.aT*100)}</td><td class="${pctClass(o.aM*100)}">${fmtPct(o.aM*100)}</td><td>${o.tot-o.qT>=0?'+':''}${prmFmt1(o.tot-o.qT)}</td></tr>`).join('')}</tbody>${natural?prmPieNatural(f):''}</table>
    <p class="note">Venta = registros. Cuota del promotor = cuota de esta tienda cada día que checó, entre las posiciones (o entre los promotores presentes). Verde = día con venta, rojo = día con check y sin venta, gris = sin check válido. La categoría es la del periodo con todas sus tiendas.</p>`;
}

/* Venta natural: pie con los totales de la tienda, el total no natural (impulso) y el alcance/gap solo con lo natural */
function prmPieNatural(f){
  const a = f.reduce((x,o)=>({tot:x.tot+o.tot, temm:x.temm+o.temm, porta:x.porta+o.porta, pos:x.pos+o.pos, imp:x.imp+o.imp, qT:x.qT+o.qT, qM:x.qM+o.qM}), {tot:0,temm:0,porta:0,pos:0,imp:0,qT:0,qM:0});
  const nat = a.tot - a.imp, alc = a.qT>0 ? nat/a.qT*100 : null, gap = nat - a.qT;
  return `<tfoot><tr class="prm-pie"><td class="l" colspan="5"><b>Total de la tienda</b></td><td><b>${fmtInt(a.tot)}</b></td><td>${fmtInt(a.temm)}</td><td>${fmtInt(a.porta)}</td><td>${fmtInt(a.pos)}</td><td><b>${fmtInt(a.imp)}</b></td><td>${prmFmt1(a.qT)}</td><td>${prmFmt1(a.qM)}</td><td colspan="3"></td></tr>
    <tr class="prm-pie"><td class="l" colspan="15"><b>Natural</b> (registros sin impulso): ${fmtInt(nat)} de ${fmtInt(a.tot)} · no natural ${fmtInt(a.imp)} · Alcance natural <b class="${alc==null?'':pctClass(alc)}">${alc==null?'—':fmtPct(alc)}</b> · Gap natural <b>${gap>=0?'+':''}${prmFmt1(gap)}</b> (contra la cuota total de la tienda)</td></tr></tfoot>`;
}
const prmExpNatural = s => prmExpAlcances(s, true);

/* ---------------- Cobertura: días con check y tipo de check ---------------- */
const PRM_EC_CLASE = ['no','ok','ok','ok','ab','er','er','er','er','er','er','er','er','er'];
function prmExpCobertura(s){
  const f = prmTiendaFilas(s).sort((x,y)=>y.diasChk - x.diasChk), X = PRM.X, NF = FECHAS.length, EC = PRM.d.ec_labels;
  if(!f.length) return '<h5>Promotores</h5><p class="note">Ningún promotor registró check en esta tienda en el periodo filtrado.</p>';
  const a = currentRange.startIdx, b = Math.min(currentRange.endIdx, X.hoyIdx);
  const largo = (b - a + 1) > 21;
  const fila = o => {
    const porDia = new Map(o.dias.map(d=>[d.di, d])); const ini = Math.max(a, o.dias[0].di), fin = Math.min(b, o.dias[o.dias.length-1].di);
    const cuenta = {}; const chips = [];
    for(let di=ini; di<=fin; di++){
      const d = porDia.get(di); let clase, txt;
      if(d && d.ec > 0){ clase = PRM_EC_CLASE[d.ec]; txt = EC[d.ec]; }
      else if(d){ clase = 'sv'; txt = 'Registró venta sin check'; }
      else if(X.trab[o.p*NF + di]){ clase = 'ot'; txt = 'Checó en otra tienda'; }
      else if(prmEnAusencia(o.p, di)){ clase = 'au'; txt = 'Ausencia justificada'; }
      else { clase = 'no'; txt = 'Sin check'; }
      cuenta[txt] = (cuenta[txt]||0) + 1;
      chips.push(`<span class="prm-d ${clase}" title="${prmDiaCorto(di)}: ${txt}">${prmDow(di)}${prmDiaCorto(di).slice(0,2)}</span>`);
    }
    const resumen = Object.entries(cuenta).sort((x,y)=>y[1]-x[1]).map(([k,v])=>`${k} ${v}`).join(' · ');
    return `<tr><td class="l">${prmNom(o)}</td><td>${prmPill(o.cat)}</td><td>${o.antig}</td><td><b>${o.diasChk}</b></td><td class="l" style="white-space:normal">${largo ? '' : `<div class="prm-dias">${chips.join('')}</div>`}<small style="color:var(--text-muted);font-weight:700">${resumen}</small></td></tr>`;
  };
  return `<h5>Días con check de cada promotor · ${f.length}</h5><table class="prm-t"><thead><tr><th class="l">Promotor</th><th>Categoría</th><th>Antigüedad</th><th>Días con check</th><th class="l">Día por día y tipo de check</th></tr></thead><tbody>${f.map(fila).join('')}</tbody></table>
    <p class="note"><span class="prm-d ok">Cumple</span> incluye cumple por productividad o por Telefónica · <span class="prm-d ab">Abierto</span> cuenta como cumple mientras siga abierto · <span class="prm-d er">Error</span> con su tipo en el detalle · <span class="prm-d ot">Otra tienda</span> checó ese día en otra tienda · <span class="prm-d au">Ausencia</span> justificada (sin motivo) · <span class="prm-d no">Sin check</span>. Solo se muestran los días desde que llegó hasta su último día en esta tienda dentro del periodo${largo ? '; con más de 3 semanas se muestra el conteo' : ''}.</p>`;
}

/* ---------------- Conversión: registra y no convierte ---------------- */
function prmExpConversion(s){
  const f = prmTiendaFilas(s);
  if(!f.length) return '<h5>Promotores</h5><p class="note">Ningún promotor registró en esta tienda en el periodo filtrado.</p>';
  const conv = o => o.regC > 0 ? o.altasC/o.regC*100 : null;
  f.sort((x,y)=>{ const a = conv(x), b = conv(y); if(a==null && b==null) return y.tot - x.tot; if(a==null) return 1; if(b==null) return -1; return a - b; });
  return `<h5>Registros y altas por promotor · de peor a mejor conversión</h5><table class="prm-t"><thead><tr><th class="l">Promotor</th><th>Categoría</th><th>Antigüedad</th><th>Registros</th><th>Registros con proforma</th><th>Altas</th><th>Sin convertir</th><th>Conversión</th></tr></thead><tbody>
    ${f.map(o=>{ const c = conv(o); return `<tr><td class="l">${prmNom(o)}</td><td>${prmPill(o.cat)}</td><td>${o.antig}</td><td>${fmtInt(o.tot)}</td><td>${fmtInt(o.regC)}</td><td>${fmtInt(o.altasC)}</td><td>${fmtInt(Math.max(0, o.regC - o.altasC))}</td><td class="${c!=null ? pctClass(c) : ''}">${c!=null ? fmtPct(c) : 'Sin proforma'}</td></tr>`; }).join('')}</tbody></table>
    <p class="note">Conversión = altas de la proforma entre registros, solo de los días que la proforma ya cubre (llega con unas 2 semanas de rezago). Registros de días sin proforma no entran a la conversión.</p>`;
}

/* ---------------- Visitas del supervisor: quiénes estaban ---------------- */
function prmExpVisitas(s){
  prmIndexarExp();
  const X = PRM.X, a = currentRange.startIdx, b = Math.min(currentRange.endIdx, FECHAS.length-1), NF = FECHAS.length, P = PRM.d.personas;
  const cats = prmCatMap(), visitas = [];
  for(const i of STORE_ROWS[s]){ const di = RW.fecha[i]; if(di < a || di > b) continue; if((RW.visitas_sup[i]||0) > 0) visitas.push({di, i, min:Math.round(RW.tiempo_visita_sup[i]||0)}); }
  visitas.sort((x,y)=>x.di - y.di);
  if(!visitas.length) return '<h5>Visitas del supervisor</h5><p class="note">El supervisor no registró visita a esta tienda en el periodo filtrado.</p>';
  const rows = X.porTienda.get(s) || [];
  const filas = visitas.map(v=>{
    const pres = []; for(const r of rows){ if(X.D[r] === v.di && X.chk[r] > 0) pres.push(r); }
    const lista = pres.map(r=>{ const f = cats.get(X.P[r]); return {nombre:P[X.P[r]][1], cat:f ? f.cat : '—', antig:f ? f.antigClase : '—', antigDias:f ? f.antig : 9999, venta:X.tot[r] + X.pos[r], temm:X.temm[r]}; });
    const foco = lista.some(o=>o.cat==='Rojo' || o.cat==='Naranja' || o.cat==='Adaptación');
    return `<tr><td>${prmDow(v.di)} ${prmDiaCorto(v.di)}</td><td>${v.min ? v.min+' min' : '—'}</td><td class="l" style="white-space:normal">${lista.length ? lista.map(o=>`<span style="display:inline-block;margin:2px 8px 2px 0;">${prmPill(o.cat)} ${prmEsc(prmCorta(o.nombre,26))} <small>· ${o.antig} · venta ${o.venta}${o.temm ? ' ('+o.temm+' temm)' : ''}</small></span>`).join('') : '<small>Sin promotor con check ese día</small>'}</td>
      <td>${lista.length ? (foco ? '✔ había promotor que necesita apoyo' : 'Solo promotores Dorado/Verde/Amarillo') : '⚠ Tienda sin promotor'}</td></tr>`; });
  return `<h5>Visitas del supervisor · ${visitas.length}</h5><table class="prm-t"><thead><tr><th>Día</th><th>Duración</th><th class="l">Promotores presentes</th><th>¿Visita enfocada?</th></tr></thead><tbody>${filas.join('')}</tbody></table>
    <p class="note">Enfocada = coincidió con al menos un promotor Rojo, Naranja o en Adaptación (nuevo ingreso). Categoría = la del periodo filtrado.</p>`;
}

/* ---------------- Piso: quién aporta menos ---------------- */
const prmIdxPorId = id => { if(!PRM._idMap){ PRM._idMap = new Map(); ST.idpdv.forEach((v,i)=>PRM._idMap.set(String(v), i)); } return PRM._idMap.get(String(id)); };
function prmExpPiso(s){
  const f = prmTiendaFilas(s);
  if(!f.length) return '<h5>Promotores</h5><p class="note">Ningún promotor registró venta ni check en esta tienda en el periodo filtrado.</p>';
  f.forEach(o=>{ o.piso = o.tot + 2*o.pos; o.dias_ = Math.max(1, o.diasChk); o.porDia = o.piso/o.dias_; });
  const totPiso = f.reduce((a,o)=>a+o.piso, 0), totDias = f.reduce((a,o)=>a+o.diasChk, 0), promTienda = totDias > 0 ? totPiso/totDias : 0;
  f.sort((x,y)=>x.porDia - y.porDia);
  const sug = o => o.diasChk >= 2 && o.porDia < 0.4*promTienda ? '⚠ Revisar: no reenviar' : (o.diasChk >= 2 && o.cat==='Rojo' ? '⚠ Categoría Rojo' : '—');
  return `<h5>Qué aportó cada promotor al piso · de quien menos a quien más aporta por día</h5><table class="prm-t"><thead><tr><th class="l">Promotor</th><th>Categoría</th><th>Antigüedad</th><th>Días con check</th><th>Aportó al piso</th><th>% de lo que vendió la tienda</th><th>Por día</th><th>Total</th><th>Temm</th><th>Porta</th><th>Pospago</th><th>Sugerencia</th></tr></thead><tbody>
    ${f.map(o=>`<tr><td class="l">${prmNom(o)}</td><td>${prmPill(o.cat)}</td><td>${o.antig}</td><td>${o.diasChk}</td><td><b>${fmtInt(o.piso)}</b></td><td>${totPiso>0 ? fmtPct(o.piso/totPiso*100) : '—'}</td><td>${o.porDia.toFixed(1)}</td><td>${fmtInt(o.tot)}</td><td>${fmtInt(o.temm)}</td><td>${fmtInt(o.porta)}</td><td>${fmtInt(o.pos)}</td><td class="${sug(o)!=='—' ? 'cell-flag' : ''}" style="text-align:left">${sug(o)}</td></tr>`).join('')}</tbody></table>
    <p class="note">Piso = ventas (registros) + 2 por cada pospago, como en esta pantalla. "Por día" = aporte entre sus días con check. La sugerencia aparece cuando tiene 2 o más días y aporta menos de 40% del promedio por día de la tienda (${promTienda.toFixed(1)}), o es Rojo: es una pista para decidir, no una regla.</p>`;
}

/* contenido de la expansión dentro de tableComponent */
function prmExpHtml(opts, s){
  if(!PRM.listo){
    if(!PRM._cargandoExp){ PRM._cargandoExp = true; prmCargar().then(()=>{ PRM._cargandoExp = false; renderView(currentView); }).catch(()=>{ PRM._cargandoExp = false; }); }
    return `<div class="prm-wrap"><h5>Promotores</h5><p class="note">⏳ Cargando la información de promotores…</p></div>`;
  }
  try{ return `<div class="prm-wrap">${opts.promotoresDe(s)}</div>`; }catch(e){ return `<div class="prm-wrap"><p class="note">No se pudo mostrar a los promotores (${prmEsc(e.message)}).</p></div>`; }
}
