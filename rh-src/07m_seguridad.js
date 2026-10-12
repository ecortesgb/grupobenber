/* ====================================================================== SEGURIDAD: MFA (código del celular), CIERRE POR INACTIVIDAD Y BITÁCORA DE LECTURAS SENSIBLES ======================================================================
   MFA obligatorio para admin, analista y nómina (TOTP: Google/Microsoft Authenticator). La base exige además que la sesión sea aal2 para esos roles (ver puede()).
   La bitácora de lecturas la escribe registrar_lectura() y se ve en Auditoría (acción LECTURA). Es del lado de la app: no sustituye al control de acceso de la base. */
const MFA_ROLES = ['admin', 'analista', 'nomina'];
function mfaModal(titulo, cuerpo, ok, cancelar) {
  return new Promise(res => {
    $('modal').innerHTML = `<div class="mbox" style="width:min(440px,96vw)" role="dialog" aria-modal="true"><h3>${titulo}</h3>${cuerpo}<div class="fld"><label>Código de 6 dígitos</label><input id="mf-c" inputmode="numeric" maxlength="6" autocomplete="one-time-code" style="font:700 20px monospace;letter-spacing:6px"></div><div class="warn" id="mf-w" hidden></div><div class="mfoot"><button class="btn" id="mf-x">Salir</button><button class="btn primary" id="mf-ok">Verificar</button></div></div>`;
    $('modal').hidden = false; $('modal').onclick = null; setTimeout(() => $('mf-c').focus(), 50);
    const go = async () => { const code = $('mf-c').value.replace(/\D/g, ''); if (code.length !== 6) { $('mf-w').hidden = false; $('mf-w').textContent = 'Escribe los 6 dígitos de la app.'; return; } $('mf-ok').disabled = true; try { await ok(code); cerrarM(); res(true); } catch (e) { $('mf-ok').disabled = false; $('mf-w').hidden = false; $('mf-w').textContent = 'Código incorrecto o vencido. Intenta con el siguiente que muestre la app.'; $('mf-c').select(); } };
    $('mf-ok').onclick = go; $('mf-c').onkeydown = e => { if (e.key === 'Enter') go(); }; $('mf-x').onclick = () => { cerrarM(); res(false); };
  });
}
async function mfaGate() {
  if (DEMO || !MFA_ROLES.includes(S.me.rol)) return;
  const m = sb.auth.mfa, { data: a } = await m.getAuthenticatorAssuranceLevel(); if (a && a.currentLevel === 'aal2') return;
  const { data: f } = await m.listFactors(), ver = ((f && f.totp) || []).find(x => x.status === 'verified'); let ok;
  if (ver) ok = await mfaModal('🔐 Verificación en dos pasos', '<div class="note">Escribe el código que muestra tu app de autenticación (Google o Microsoft Authenticator).</div>', async code => { const { error } = await m.challengeAndVerify({ factorId: ver.id, code }); if (error) throw error; });
  else {
    for (const x of ((f && f.all) || []).filter(x => x.status !== 'verified')) await m.unenroll({ factorId: x.id });   // altas a medias de intentos anteriores
    const { data: e, error } = await m.enroll({ factorType: 'totp', friendlyName: 'GB ' + new Date().toISOString().slice(0, 10) }); if (error) throw error;
    const svg = String(e.totp.qr_code || '').replace(/^data:image\/svg\+xml;?(utf-8|charset=utf-8)?,/i, ''), qr = svg.trim().startsWith('<svg') ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) : e.totp.qr_code;
    ok = await mfaModal('🔐 Protege tu cuenta con un código en tu celular', `<div class="note">Es una medida de seguridad de la empresa para quien maneja sueldos y datos personales. Se hace una sola vez.<br><b>1.</b> En tu celular abre Google Authenticator o Microsoft Authenticator (si no lo tienes, instálalo de la tienda de apps).<br><b>2.</b> Elige "Agregar cuenta" y escanea este cuadro.<br><b>3.</b> Escribe abajo el código de 6 dígitos que te muestre la app.</div><div style="text-align:center;margin:8px 0"><img src="${qr}" alt="Código QR para la app de autenticación" style="width:190px;height:190px;background:#fff;padding:8px;border-radius:8px"><br><small class="muted">¿No puedes escanear? En la app elige "Ingresar clave de configuración" y escribe: <b>${esc(e.totp.secret)}</b></small></div>`, async code => { const { error: er } = await m.challengeAndVerify({ factorId: e.id, code }); if (er) throw er; });
  }
  if (!ok) throw new Error('Para entrar con este rol necesitas la verificación en dos pasos.');
}

/* ---- cierre por inactividad: 15 min en roles con datos sensibles, 30 min en los demás ---- */
const IDLE = { t: null, aviso: null, ult: 0 };
function idleIniciar() {
  if (DEMO) return; const lim = (MFA_ROLES.includes(S.me.rol) ? 15 : 30) * 60000;
  const reinicia = () => { const n = Date.now(); if (n - IDLE.ult < 5000) return; IDLE.ult = n; clearTimeout(IDLE.t); clearTimeout(IDLE.aviso); IDLE.aviso = setTimeout(() => toast('Tu sesión se cerrará en 1 minuto por inactividad'), lim - 60000);
    IDLE.t = setTimeout(async () => { try { await API.logout(); } catch (e) { } cerrarM(); mostrarLogin('Sesión cerrada por inactividad. Vuelve a entrar.'); }, lim); };
  if (!IDLE.on) { IDLE.on = true; ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(ev => window.addEventListener(ev, reinicia, { passive: true })); }
  IDLE.ult = 0; reinicia();
}

/* ---- bitácora de lecturas: quién abrió datos personales, bancarios o sueldos ---- */
(function () {
  if (DEMO) return;
  const log = (tabla, detalle, n) => { try { sb.rpc('registrar_lectura', { p_tabla: tabla, p_detalle: detalle, p_n: n }).then(() => { }, () => { }); } catch (e) { } };
  const envuelve = (nombre, tabla, detalle) => { const o = Real[nombre]; if (typeof o !== 'function') return; Real[nombre] = async function () { const r = await o.apply(this, arguments); const n = Array.isArray(r) ? r.length : r ? 1 : 0; if (n) log(tabla, detalle(arguments), n); return r; }; };
  envuelve('sensiblesLote', 'datos_sensibles', a => 'lote ' + (a[0] || []).length + ' usuarios'); envuelve('sensiblesDe', 'datos_sensibles', a => a[0]);
  envuelve('bancariosDe', 'datos_bancarios', a => a[0]); envuelve('finBancarios', 'datos_bancarios', a => 'lote ' + (a[0] || []).length + ' usuarios'); envuelve('nomBanc', 'datos_bancarios', a => 'lote ' + (a[0] || []).length + ' usuarios');
  envuelve('sueldosDe', 'sueldos_historial', a => a[0]); envuelve('nomSueldos', 'sueldos_historial', () => 'nómina completa');
})();
