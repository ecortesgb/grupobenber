/* Actualizador de los dashboards GB (Avance, Pospago, Elektra, Centro de Mando GB y RH).
   Se publica como docs/actualizador.js y cada página lo carga con:
     <script src="https://ecortesgb.github.io/grupobenber/actualizador.js" data-dash="avance"></script>
   · Cada 5 minutos (y cada vez que vuelves a la pestaña) revisa docs/version.json, que el orquestador actualiza al terminar
     cada actualización correcta. Si cambió la versión de este dashboard:
       - pestaña en segundo plano o más de 5 min sin moverle -> se recarga sola
       - la estás usando -> aviso arriba con botón "Actualizar"
   · Antes de recargar guarda dónde estabas (cada página puede definir window.gbGuardarEstado y leerlo con
     window.gbEstadoGuardado()) y la posición del scroll. La sesión de la contraseña sigue guardada, no se vuelve a pedir.
   · Recarga con ?v=<versión> para saltarse la caché de GitHub Pages (hasta 10 min). */
(function(){
  var s = document.currentScript, D = s && s.getAttribute('data-dash');
  if(!D || window.__gbActualizador) return; window.__gbActualizador = true;
  var URL_V = 'https://ecortesgb.github.io/grupobenber/version.json', CADA = 5*60e3, INACT = 5*60e3;
  var base = null, nuevo = null, ultAct = Date.now(), ocultoDesde = null, avisoEl = null;
  var KE = 'gb_estado_' + D, KS = 'gb_scroll_' + D;

  function leer(){
    return fetch(URL_V + '?t=' + Date.now(), {cache:'no-store'})
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(j){ return j && j[D] ? String(j[D]) : null; })
      .catch(function(){ return null; });
  }
  function revisar(alVolver){
    return leer().then(function(v){
      if(!v) return;
      if(base === null){ base = v; return; }
      if(v !== base){ nuevo = v; decidir(alVolver); }
    });
  }
  function decidir(lejos){
    if(!nuevo) return;
    if(document.hidden || lejos || Date.now() - ultAct > INACT) recargar(); else aviso();
  }
  function recargar(){
    try{
      if(typeof window.gbGuardarEstado === 'function') sessionStorage.setItem(KE, JSON.stringify({t:Date.now(), e:window.gbGuardarEstado()}));
      sessionStorage.setItem(KS, JSON.stringify({t:Date.now(), y:window.scrollY||0}));
    }catch(e){}
    location.replace(location.pathname + '?v=' + encodeURIComponent(nuevo) + location.hash);
  }
  function aviso(){
    if(avisoEl) return;
    var hora = String(nuevo).slice(-5);
    avisoEl = document.createElement('div');
    avisoEl.setAttribute('role', 'status');
    avisoEl.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:2147483000;display:flex;gap:10px;align-items:center;'
      + 'background:#1A1A1A;color:#fff;padding:9px 10px 9px 16px;border-radius:999px;box-shadow:0 8px 24px rgba(0,0,0,.25);'
      + 'font:600 13px Poppins,system-ui,Segoe UI,Arial,sans-serif;max-width:calc(100vw - 24px);';
    avisoEl.innerHTML = '<span>🔄 Hay información nueva (' + hora + ')</span>'
      + '<button type="button" style="border:0;border-radius:999px;background:#EE6602;color:#fff;font-weight:700;font-size:12.5px;font-family:inherit;padding:7px 14px;cursor:pointer">Actualizar</button>'
      + '<button type="button" aria-label="Cerrar aviso" style="border:0;background:none;color:#aaa;font-size:16px;cursor:pointer;padding:2px 6px">✕</button>';
    var b = avisoEl.querySelectorAll('button');
    b[0].addEventListener('click', recargar);
    b[1].addEventListener('click', function(){ avisoEl.remove(); avisoEl = null; base = nuevo; nuevo = null; });   // no vuelve a avisar hasta la siguiente versión
    document.body.appendChild(avisoEl);
  }

  ['pointerdown','keydown','scroll','touchstart','mousemove','wheel'].forEach(function(ev){
    addEventListener(ev, function(){ ultAct = Date.now(); }, {passive:true});
  });
  document.addEventListener('visibilitychange', function(){
    if(document.hidden){ ocultoDesde = Date.now(); return; }
    var lejos = ocultoDesde && Date.now() - ocultoDesde > INACT; ocultoDesde = null;
    if(nuevo) decidir(lejos); else revisar(lejos);
  });
  setInterval(function(){ revisar(false); }, CADA);
  revisar(false);

  // lo que la página guardó antes de recargar (solo sirve si la recarga fue hace menos de 2 min)
  window.gbEstadoGuardado = function(){
    try{ var x = JSON.parse(sessionStorage.getItem(KE) || 'null'); sessionStorage.removeItem(KE); return x && Date.now() - x.t < 120000 ? x.e : null; }
    catch(e){ return null; }
  };
  addEventListener('load', function(){
    try{
      var x = JSON.parse(sessionStorage.getItem(KS) || 'null'); sessionStorage.removeItem(KS);
      if(x && Date.now() - x.t < 120000 && x.y > 0) setTimeout(function(){ window.scrollTo(0, x.y); }, 1200);
    }catch(e){}
  });
})();
