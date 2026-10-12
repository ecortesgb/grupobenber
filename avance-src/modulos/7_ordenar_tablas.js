/* ============================================================================================================
   MÓDULO 7 · Ordenar cualquier tabla con un clic en el encabezado
   Las tablas que ya ordenan por su cuenta (encabezados con data-k) no se tocan. Todas las demás (detalles que se expanden por
   tienda, promotores, semanas, alertas, etc.) se ordenan aquí, en el navegador, reacomodando las filas que ya están pintadas.
   Una fila "de detalle" (colspan, o clases pt-prm / gbt-det) viaja pegada a la fila de arriba. tfoot no se mueve.
   Si la tabla se vuelve a pintar (cambio de filtro), regresa a su orden original.
   ============================================================================================================ */
(function ordenarTablas(){
  const css = `
  .view table thead th:not([data-k]):not(.nosort), .tw table thead th:not([data-k]):not(.nosort){cursor:pointer;}
  .view table thead th:not([data-k]):not(.nosort):hover{color:var(--orange);}
  th[data-gbsort="asc"]::after{content:' ▲'; font-size:.8em;} th[data-gbsort="desc"]::after{content:' ▼'; font-size:.8em;}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  const limpio = t => t.replace(/[ \s]+/g,' ').trim();
  const esDetalle = tr => { const tds = tr.children; return (tds.length===1 && tds[0].colSpan>1) || /\b(gbt-det|pt-prm|prm-sub|det)\b/.test(tr.className) || (tds.length>0 && [...tds].some(td=>td.colSpan>3)); };
  function valor(td){
    if(!td) return null;
    let t = limpio(td.textContent); if(!t || /^[—–\-·.]$/.test(t)) return null;
    const neg = /^▼/.test(t);
    const n = t.replace(/[▲▼↗↘+%$,\s]/g,'').replace(/^−/,'-');
    if(/^-?\d+(\.\d+)?$/.test(n)) return {n: neg ? -Math.abs(Number(n)) : Number(n), s:t};
    return {n:null, s:t};
  }
  document.addEventListener('click', e=>{
    const th = e.target.closest('th'); if(!th || th.hasAttribute('data-k') || th.classList.contains('nosort')) return;
    if(e.target.closest('button,a,input,select')) return;
    const tabla = th.closest('table'); if(!tabla || !tabla.tHead || !tabla.tBodies.length) return;
    if(!th.closest('#app, body')) return;
    // posición de la columna considerando colspan en la fila del encabezado
    const fila = th.parentElement; let col = 0; for(const c of fila.children){ if(c===th) break; col += c.colSpan||1; }
    const asc = th.getAttribute('data-gbsort')!=='asc';
    const tb = tabla.tBodies[0];
    const grupos = []; for(const tr of [...tb.rows]){ if(esDetalle(tr) && grupos.length){ grupos[grupos.length-1].extra.push(tr); } else grupos.push({main:tr, extra:[]}); }
    if(grupos.length<2) return;
    const vals = grupos.map(g=>valor(g.main.children[col]));
    const numerica = vals.every(v=>v==null || v.n!=null);
    grupos.forEach((g,i)=>{ g.v = vals[i]; g.i = i; });
    grupos.sort((a,b)=>{
      const x = a.v, y = b.v; if(x==null && y==null) return a.i-b.i; if(x==null) return 1; if(y==null) return -1;   // vacíos siempre al final
      const r = numerica ? x.n-y.n : x.s.localeCompare(y.s,'es',{numeric:true});
      return (asc ? r : -r) || a.i-b.i;
    });
    for(const g of grupos){ tb.appendChild(g.main); g.extra.forEach(x=>tb.appendChild(x)); }
    tabla.querySelectorAll('th[data-gbsort]').forEach(h=>h.removeAttribute('data-gbsort'));
    th.setAttribute('data-gbsort', asc ? 'asc' : 'desc');
  });
})();
