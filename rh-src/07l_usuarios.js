/* ====================================================================== USUARIOS Y ACCESO ======================================================================
   Acceso con USUARIO corto (no el correo) y contraseña. Las cuentas nuevas traen una clave temporal y la app obliga a cambiarla al primer ingreso (hasta entonces la base no deja leer datos).
   Administración y analista pueden reiniciar una contraseña (sale una temporal nueva que también obliga a cambiarse), quitar o devolver el acceso. Las cuentas nuevas se crean con crear_usuario.py. */
function ponerOjo(inputId) {   // envuelve un input de contraseña existente con su botón de ojo
  const i = $(inputId); if (!i || i.dataset.ojo) return; i.dataset.ojo = '1'; const w = document.createElement('span'); w.className = 'pw-wrap'; i.parentNode.insertBefore(w, i); w.appendChild(i);
  const b = document.createElement('button'); b.type = 'button'; b.className = 'pw-eye'; b.tabIndex = -1; b.title = 'Mostrar u ocultar'; b.setAttribute('aria-label', 'Mostrar u ocultar la contraseña'); b.textContent = '👁';
  b.onclick = () => { i.type = i.type === 'password' ? 'text' : 'password'; b.textContent = i.type === 'password' ? '👁' : '🙈'; }; w.appendChild(b);
}
const claveValida = (c, temp) => c.length >= 6 && /[A-Za-z]/.test(c) && /[0-9]/.test(c) && c !== temp;   // mínimo 6 caracteres; letras, números y símbolos permitidos
const claveTemporal = () => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789', r = crypto.getRandomValues(new Uint8Array(9)); return 'GB-' + [...r].map(x => A[x % A.length]).join(''); };

/* primer ingreso (o clave reiniciada): elegir contraseña propia antes de entrar */
function cambiarClaveObligatoria(temp) {
  return new Promise(res => {
    $('modal').innerHTML = `<div class="mbox" style="width:min(460px,96vw)" role="dialog" aria-modal="true"><h3>🔐 Elige tu contraseña</h3><div class="note">Tu contraseña actual es temporal. Escribe una propia para seguir: mínimo 6 caracteres con al menos una letra y un número; también puedes usar símbolos.</div>
      <div class="fld"><label>Contraseña temporal actual</label><input id="cc-0" type="password" autocomplete="current-password" value="${esc(temp || '')}"></div>
      <div class="fld"><label>Nueva contraseña</label><input id="cc-1" type="password" autocomplete="new-password"></div><div class="fld"><label>Repite la nueva contraseña</label><input id="cc-2" type="password" autocomplete="new-password"></div>
      <div class="warn" id="cc-w" hidden></div><div class="mfoot"><button class="btn primary" id="cc-ok">Guardar y entrar</button></div></div>`; $('modal').hidden = false; $('modal').onclick = null; ponerOjo('cc-0'); ponerOjo('cc-1'); ponerOjo('cc-2'); $(temp ? 'cc-1' : 'cc-0').focus();
    $('cc-ok').onclick = async () => {
      const act = $('cc-0').value, a = $('cc-1').value, b = $('cc-2').value, w = $('cc-w'); w.hidden = false;
      if (!act) { w.textContent = 'Escribe tu contraseña temporal actual.'; return; }
      if (!claveValida(a, act)) { w.textContent = 'Mínimo 6 caracteres, con al menos una letra y un número, y distinta de la temporal.'; return; } if (a !== b) { w.textContent = 'Las dos contraseñas no coinciden.'; return; }
      $('cc-ok').disabled = true;
      try { const ses = (await sb.auth.getSession()).data.session, rr = await fetch(CFG.url + '/auth/v1/user', { method: 'PUT', headers: { 'Content-Type': 'application/json', apikey: CFG.key, Authorization: 'Bearer ' + ses.access_token }, body: JSON.stringify({ password: a, current_password: act }) });
        if (!rr.ok) { const j = await rr.json().catch(() => ({})); throw new Error(j.error_code === 'current_password_invalid' ? 'La contraseña temporal actual no es correcta.' : (j.msg || 'No se pudo cambiar la contraseña')); } const r = await sb.rpc('clave_cambiada'); if (r.error) throw r.error; cerrarM(); toast('Contraseña actualizada'); res(); }
      catch (e) { $('cc-ok').disabled = false; w.textContent = 'No se pudo cambiar: ' + (e.message || e); }
    };
  });
}

Real.usuariosLista = async function () { const { data, error } = await sb.rpc('usuarios_lista'); if (error) throw new Error(error.message); return data || []; };
Real.usuarioReiniciar = async function (id, clave) { return Real.finRpc('usuario_reiniciar_clave', { p_id: id, p_clave: clave }); };
Real.usuarioActivar = async function (id, act) { return Real.finRpc('usuario_activar', { p_id: id, p_activo: act }); };
Demo.usuariosLista = async () => [{ id: 'd1', nombre: 'Usuario de ejemplo', rol: 'rh', activo: true, usuario: 'ejemplo', email: 'ejemplo@usuarios.rhgb.app', ultimo_acceso: null, debe_cambiar_clave: false }]; Demo.usuarioReiniciar = async () => { }; Demo.usuarioActivar = async () => { };
const NIVEL_USR = { admin: 'Administrador', analista: 'Analista', nomina: 'Nómina', rh: 'RR.HH.', gerente: 'Gerente', direccion: 'Dirección', reclutador: 'Reclutador', altas: 'Altas' };
async function vUsuarios() {
  $('content').innerHTML = cab('Usuarios y acceso', 'Quién puede entrar. El acceso es con usuario y contraseña; las claves temporales se cambian al primer ingreso. Desactiva el acceso cuando alguien se va.', 'mochila') + '<div class="loading">Cargando…</div>';
  let us; try { us = await API.usuariosLista(); } catch (e) { $('content').innerHTML += `<div class="warn">${esc(e.message || e)}</div>`; return; }
  const edita = can('usuarios', 'editar'); TB = {};
  let h = cab('Usuarios y acceso', 'Quién puede entrar. El acceso es con usuario y contraseña; las claves temporales se cambian al primer ingreso. Desactiva el acceso cuando alguien se va.', 'mochila');
  h += `<div class="kpis">${kp('Con acceso', fmt(us.filter(u => u.activo).length), 'activos', C.gr, null, '🔓')}${kp('Sin acceso', fmt(us.filter(u => !u.activo).length), 'desactivados', C.gy, null, '🔒')}${kp('Sin entrar en 30+ días', fmt(us.filter(u => u.activo && (!u.ultimo_acceso || u.ultimo_acceso < addD(HOY, -30))).length), 'revisa si aún necesitan acceso', C.am, null, '🕓')}${kp('Falta cambiar clave', fmt(us.filter(u => u.activo && u.debe_cambiar_clave).length), 'todavía con clave temporal', C.am, null, '🔐')}</div>`;
  h += tbl('t-usr', [{ h: 'Usuario', t: 1, v: u => u.usuario, w: 160, r: u => `<b>${esc(u.usuario)}</b>` }, { h: 'Nombre', t: 1, v: u => u.nombre, w: 260 }, { h: 'Rol', t: 1, v: u => NIVEL_USR[u.rol] || u.rol }, { h: 'Alcance', t: 1, v: u => u.rrhh_nombre || u.zona_rrhh || 'General' },
    { h: 'Último acceso', v: u => u.ultimo_acceso || '', r: u => u.ultimo_acceso ? fdate(String(u.ultimo_acceso).slice(0, 10)) : '<span class="muted">nunca</span>' }, { h: 'Estatus', t: 1, v: u => u.activo ? (u.debe_cambiar_clave ? 1 : 2) : 0, r: u => !u.activo ? pillx('🔒 Sin acceso', 'x') : u.debe_cambiar_clave ? pillx('🔐 Clave temporal', 'a') : pillx('🟢 Activo', 'g') },
    ...(edita ? [{ h: '', v: () => '', r: u => `<button class="rsv" onclick="usrReiniciar('${u.id}','${esc(u.nombre).replace(/'/g, '')}')">🔑 Reiniciar clave</button> <button class="rsv" onclick="usrActivar('${u.id}',${!u.activo},'${esc(u.nombre).replace(/'/g, '')}')">${u.activo ? '🔒 Quitar acceso' : '🔓 Devolver acceso'}</button>` }] : [])],
    us, { fix: 2, search: 1, csv: 1, file: 'usuarios', titulo: 'Usuarios', sort: 2, dir: 1, maxh: '70vh' });
  $('content').innerHTML = h; drawAll();
}
async function usrReiniciar(id, nombre) {
  if (!confirm('¿Reiniciar la contraseña de ' + nombre + '? Se cerrará su sesión y tendrá que elegir una nueva al entrar.')) return;
  const t = claveTemporal(); try { await API.usuarioReiniciar(id, t); } catch (e) { toast(e.message || e); return; }
  $('modal').innerHTML = `<div class="mbox" style="width:min(460px,96vw)" role="dialog" aria-modal="true"><h3>🔑 Clave temporal</h3><div class="who">${esc(nombre)}</div><div class="note">Entrégala por un medio seguro. Se muestra solo ahora; al entrar, la persona elige la suya.</div><div class="fld"><input id="rt-c" readonly value="${t}" style="font:700 18px monospace"></div><div class="mfoot"><button class="btn" onclick="navigator.clipboard.writeText('${t}').then(()=>toast('Copiada'))">📋 Copiar</button><button class="btn primary" onclick="cerrarM();vUsuarios()">Listo</button></div></div>`; $('modal').hidden = false;
}
async function usrActivar(id, act, nombre) {
  if (!confirm((act ? '¿Devolver el acceso a ' : '¿Quitar el acceso a ') + nombre + '?')) return;
  try { await API.usuarioActivar(id, act); toast(act ? 'Acceso devuelto' : 'Acceso quitado'); vUsuarios(); } catch (e) { toast(e.message || e); }
}
