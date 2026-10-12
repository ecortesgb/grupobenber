/* ============================================================================================================
   MÓDULO 5 · Barra de filtros ordenada + grupo "Desempeño" del menú
   - Hora de actualización arriba; filtros de sección (Cadena, Posc., Class, Resurtible, Tienda·IDPDV con búsqueda dinámica) a la izquierda;
     filtros de estructura (Región, Subdirección GB, Gerente GB, Supervisor GB, Sub_Terr, Líder) a la derecha, que se pueden ocultar;
     en ese espacio quedan las etiquetas de lo que se va filtrando, en orden.
   - El menú agrupa Alcances, Venta natural, Conversión, Interanual y Sell Out en "Desempeño" (el resto del menú queda igual).
   ============================================================================================================ */

/* ---------- hora de actualización ---------- */
(function(){
  const el = document.getElementById('fb-act'); if(!el) return;
  const m = String(GENERADO||'').match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if(!m){ el.textContent = '🕒 Actualizado: '+GENERADO; return; }
  const d = new Date(+m[1], +m[2]-1, +m[3], +m[4], +m[5]);
  const dias = ['dom','lun','mar','mié','jue','vie','sáb'], meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  el.textContent = `🕒 Actualizado: ${dias[d.getDay()]} ${d.getDate()} ${meses[d.getMonth()]} ${d.getFullYear()} · ${m[4]}:${m[5]}`;
})();

/* ---------- filtros de estructura ocultables ---------- */
(function(){
  const row = document.getElementById('fb-row'), btn = document.getElementById('fb-est-toggle'); if(!row || !btn) return;
  const KEY = 'gb_fb_est_cerrada';
  const pintar = ()=>{ const c = row.classList.contains('est-cerrada'); btn.textContent = c ? 'Estructura ▸' : 'Estructura ▾'; btn.setAttribute('aria-expanded', c?'false':'true'); };
  try{ if(localStorage.getItem(KEY)==='1') row.classList.add('est-cerrada'); }catch(e){}
  btn.addEventListener('click', ()=>{ row.classList.toggle('est-cerrada'); try{ localStorage.setItem(KEY, row.classList.contains('est-cerrada')?'1':'0'); }catch(e){} pintar(); });
  pintar();
})();

/* ---------- Tienda · IDPDV: se escribe y la lista se despliega conforme se teclea ---------- */
(function(){
  const sel = document.getElementById('f-tienda'); if(!sel) return;
  const wrap = sel.closest('.fb-tienda'); if(!wrap) return;
  const inp = document.createElement('input'); inp.type = 'text'; inp.className = 'ta-in'; inp.placeholder = 'Escribe IDPDV o nombre…'; inp.autocomplete = 'off'; inp.setAttribute('aria-label','Tienda o IDPDV');
  const x = document.createElement('span'); x.className = 'ta-x'; x.textContent = '×'; x.title = 'Quitar tienda';
  const lista = document.createElement('div'); lista.className = 'ta-list'; lista.setAttribute('role','listbox');
  wrap.appendChild(inp); wrap.appendChild(x); wrap.appendChild(lista);
  let sugeridos = [], pos = -1;
  const norm = s => String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  function opciones(){ return [...sel.options].filter(o=>o.value!=='').map(o=>({v:o.value, txt:o.textContent})); }
  function pintarLista(){
    const q = norm(inp.value.trim());
    const todas = opciones();
    sugeridos = (q ? todas.filter(o=>norm(o.txt).includes(q)) : todas).slice(0, 14);
    lista.innerHTML = sugeridos.length
      ? sugeridos.map((o,i)=>{ const [id, ...resto] = o.txt.split(' — '); return `<div data-v="${o.v}" class="${i===pos?'sel':''}"><small>${gbxEsc(id)}</small>${gbxEsc(resto.join(' — '))}</div>`; }).join('') + (todas.length>14 && !q ? '<div class="vacio">Sigue escribiendo para acotar…</div>' : '')
      : '<div class="vacio">Sin coincidencias</div>';
    lista.classList.add('on');
  }
  function elegir(v){
    sel.value = String(v); sel.dispatchEvent(new Event('change', {bubbles:true})); lista.classList.remove('on'); inp.blur();
  }
  inp.addEventListener('input', ()=>{ pos = -1; pintarLista(); });
  inp.addEventListener('focus', ()=>{ if(currentTienda!=null) inp.select(); pintarLista(); });
  inp.addEventListener('keydown', e=>{
    if(e.key==='ArrowDown'){ pos = Math.min(sugeridos.length-1, pos+1); pintarLista(); e.preventDefault(); }
    else if(e.key==='ArrowUp'){ pos = Math.max(0, pos-1); pintarLista(); e.preventDefault(); }
    else if(e.key==='Enter'){ const o = sugeridos[pos>=0?pos:0]; if(o) elegir(o.v); e.preventDefault(); }
    else if(e.key==='Escape'){ lista.classList.remove('on'); inp.blur(); }
  });
  lista.addEventListener('mousedown', e=>{ const d = e.target.closest('[data-v]'); if(d){ e.preventDefault(); elegir(d.dataset.v); } });
  x.addEventListener('click', ()=>{ sel.value = ''; sel.dispatchEvent(new Event('change', {bubbles:true})); inp.value = ''; });
  document.addEventListener('click', e=>{ if(!wrap.contains(e.target)) { lista.classList.remove('on'); sincronizarTiendaTypeahead(); } });
  window.sincronizarTiendaTypeahead = function(){
    if(document.activeElement===inp) return;
    inp.value = currentTienda!=null ? `${ST.idpdv[currentTienda]} — ${ST.nombre[currentTienda]||''}` : '';
    wrap.classList.toggle('tiene', currentTienda!=null);
  };
})();

/* ---------- menú: solo "Desempeño" se agrupa; el resto queda como estaba ---------- */
const GRUPOS = [{key:'desempeno', label:'Desempeño', ic:'📊', views:['alcances','natural','conversion','interanual','sellout','mixrecarga']}];
const SUB_LABEL = {alcances:'Alcances', natural:'Venta natural', conversion:'Conversión', interanual:'Interanual e Intermensual', sellout:'Sell Out', mixrecarga:'Mix de recarga'};
(function injectCssNav(){
  const css = `
  #subnav{display:flex; gap:6px; overflow-x:auto; padding:2px 0 12px; position:sticky; top:0; z-index:8; background:var(--bg); margin:-4px 0 4px; scrollbar-width:thin;}
  #subnav:empty{display:none;}
  #subnav button{flex:0 0 auto; border:1.5px solid var(--line); background:#fff; border-radius:999px; padding:7px 15px; font:700 12.5px inherit; font-family:inherit; cursor:pointer; color:var(--text-muted); white-space:nowrap;}
  #subnav button:hover{border-color:var(--orange); color:var(--orange-dark);}
  #subnav button.on{background:var(--orange); border-color:var(--orange); color:#fff;}
  `;
  const el = document.createElement('style'); el.id = 'nav-css'; el.textContent = css; document.head.appendChild(el);
})();
const vistaVisibleEnModo = v => { const dir = document.body.classList.contains('modo-direccion'); if((v==='promotores' || v==='mixrecarga') && !PRM_ENC) return false; return !(dir && OP_ONLY_VIEWS.has(v)) && !(!dir && DIR_ONLY_VIEWS.has(v)); };
const grupoDeVista = v => GRUPOS.find(g=>g.views.includes(v));
function construirNavGrupos(){
  const nav = document.getElementById('sb-nav'), bn = document.getElementById('bn-list'); if(!nav || !bn) return;
  const g = GRUPOS[0], visibles = g.views.filter(vistaVisibleEnModo);
  const items = []; let grupoPuesto = false;
  for(const t of TEMAS){
    if(!vistaVisibleEnModo(t.key)) continue;
    if(g.views.includes(t.key)){
      if(!grupoPuesto){ items.push({grupo:true, ic:g.ic, label:g.label, short:g.label, view:visibles[0]}); grupoPuesto = true; }
    } else items.push({grupo:false, ic:t.ic, label:t.label, short:t.short||t.label, view:t.key});
  }
  const actual = grupoDeVista(currentView);
  const html = (cls, campo)=>items.map(it=>`<div class="${cls}${(it.grupo ? !!actual : it.view===currentView) ? ' active' : ''}" data-view="${it.view}"${it.grupo?' data-grupo="1"':''} role="button" tabindex="0"><span class="ic">${it.ic}</span>${it[campo]}</div>`).join('');
  nav.innerHTML = html('nav-item','label'); bn.innerHTML = html('bn-item','short');
  // el elemento de grupo solo se marca si estamos dentro de el
  nav.querySelectorAll('[data-grupo]').forEach(e=>e.classList.toggle('active', !!actual)); bn.querySelectorAll('[data-grupo]').forEach(e=>e.classList.toggle('active', !!actual));
  const ir = el=>{ const v = el.dataset.grupo ? (g.views.includes(currentView) ? currentView : visibles[0]) : el.dataset.view; goToView(v); };
  nav.querySelectorAll('.nav-item').forEach(el=>el.addEventListener('click', ()=>ir(el)));
  bn.querySelectorAll('.bn-item').forEach(el=>el.addEventListener('click', ()=>ir(el)));
  const sub = document.getElementById('subnav');
  if(sub) sub.innerHTML = (actual && visibles.length>1) ? visibles.map(v=>`<button type="button" data-v="${v}" class="${v===currentView?'on':''}">${SUB_LABEL[v]}</button>`).join('') : '';
}
(function(){
  const sub = document.getElementById('subnav'); if(!sub) return;
  sub.addEventListener('click', e=>{ const b = e.target.closest('button[data-v]'); if(b) goToView(b.dataset.v); });
})();


/* ---------- etiquetas de filtros en la fila del periodo: solo las que caben, sin crecer ---------- */
function ajustarChipsPeriodo(){
  const cont = document.getElementById('pb-chips'); if(!cont) return;
  const chips = [...cont.querySelectorAll('.chip')];
  chips.forEach(c=>c.classList.remove('oculto'));
  let sobra = false;
  for(const c of chips){
    if(sobra || c.offsetLeft + c.offsetWidth > cont.clientWidth + 1){ c.classList.add('oculto'); sobra = true; }
  }
}
window.addEventListener('resize', ()=>ajustarChipsPeriodo());

/* ---------- panel de filtros: aparece al pasar el mouse o se fija; menu lateral: compacto o fijo ---------- */
(function(){
  const pin = document.getElementById('fb-pin'), tog = document.getElementById('fb-toggle');
  const card = document.getElementById('global-headline-card');
  const guardar = (k,v)=>{ try{ localStorage.setItem(k, v); }catch(e){} };
  const leer = (k, def)=>{ try{ const v = localStorage.getItem(k); return v===null ? def : v; }catch(e){ return def; } };
  let auto = leer('gb_fb_auto','1')==='1';
  function aplicarPanel(){
    const desktop = window.matchMedia('(min-width:901px)').matches;
    const modoAuto = auto && desktop;
    document.body.classList.toggle('fb-auto', modoAuto);
    if(!modoAuto) document.body.classList.remove('fb-abierto');
    // la tarjeta de GBsaurio: grande al lado de los filtros cuando estan fijos; compacta arriba cuando el panel se oculta
    const destino = (desktop && !modoAuto) ? document.getElementById('fb-card-panel') : document.getElementById('fb-card-top');
    if(card && destino && card.parentElement!==destino) destino.appendChild(card);
    if(pin){ pin.textContent = auto ? '📌 Fijar filtros' : '📌 Filtros fijos'; pin.classList.toggle('on', !auto); }
    ajustarChipsPeriodo();
  }
  if(pin) pin.addEventListener('click', ()=>{ auto = !auto; guardar('gb_fb_auto', auto?'1':'0'); aplicarPanel(); });
  if(tog) tog.addEventListener('click', ()=>{ if(document.body.classList.contains('fb-auto')) document.body.classList.toggle('fb-abierto'); });
  window.addEventListener('resize', aplicarPanel);
  aplicarPanel();

  const sbPin = document.getElementById('sb-pin');
  let rail = leer('gb_sb_rail','1')==='1';
  function aplicarMenu(){
    document.body.classList.toggle('sb-rail', rail);
    if(sbPin){ sbPin.textContent = rail ? '»' : '«'; sbPin.title = rail ? 'Fijar el menú abierto' : 'Dejar el menú compacto (se abre al pasar el mouse)'; }
    setTimeout(ajustarChipsPeriodo, 250);
  }
  if(sbPin) sbPin.addEventListener('click', e=>{ e.stopPropagation(); rail = !rail; guardar('gb_sb_rail', rail?'1':'0'); aplicarMenu(); });
  aplicarMenu();
})();
