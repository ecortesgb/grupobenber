/* ====================================================================== arranque ====================================================================== */
async function entrar() {
  try {
    S.me = await API.me();
    if (S.me.debeCambiar) { await cambiarClaveObligatoria(($('lg-p') || {}).value || ''); S.me = await API.me(); }   // clave temporal: se elige una propia antes de ver datos
    await mfaGate();   // admin/analista/nómina: código del celular
    S.cat = await API.catalogos();
    soloMisTiendas();   // RH y reclutadores: filtros y listas solo con sus tiendas
    $('login').hidden = true; $('app').hidden = false;
    $('u-nombre').textContent = S.me.nombre; $('u-rol').textContent = NIVEL[S.me.rol] || S.me.rol;
    const alc = S.me.permisos.alertas; $('u-alc').textContent = S.me.rol === 'rh' && S.me.rrhh ? 'Estados de ' + S.me.rrhh : alc && alc.alcance === 'todo' ? 'Acceso general' : alc ? 'Alcance: ' + alc.alcance : '';
    [S.alertas, S.vigentes] = await Promise.all([can('alertas', 'ver') ? API.alertas() : [], can('ausencias', 'ver') ? API.vigentes() : []]);
    const primera = VISTAS.find(v => !v.soon && can(v.mod, 'ver')); S.view = primera ? primera.k : 'bandeja';
    nav(); render();
    vacInsignia();
    idleIniciar();
    API.generado().then(g => { S.gen = g; fbPintar(); }).catch(() => { });
  } catch (e) { await API.logout(); mostrarLogin(e.message || String(e)); }
}
function mostrarLogin(msg) { $('app').hidden = true; $('login').hidden = false; $('lg-msg').textContent = msg || ''; $('lg-u').focus(); }
(async function () {
  ['sb-logo', 'tb-logo'].forEach(i => $(i).src = img('logo_gb')); $('lg-mascot').src = img('mochila');
  $('u-salir').onclick = () => API.logout().then(() => mostrarLogin());
  $('tb-menu').onclick = () => $('sidebar').classList.toggle('open');
  ponerOjo('lg-p'); $('lg-form').onsubmit = async e => { e.preventDefault(); $('lg-msg').textContent = ''; const b = $('lg-btn'); b.disabled = true; b.textContent = 'Entrando…'; try { await API.login($('lg-u').value, $('lg-p').value); await entrar(); } catch (x) { $('lg-msg').textContent = x.message; } b.disabled = false; b.textContent = 'Entrar'; };
  if (DEMO) { await entrar(); return; }
  try { if (await API.init()) await entrar(); else mostrarLogin(); } catch (e) { mostrarLogin('No se pudo conectar: ' + e.message); }
})();

/* ====== exportar CSV y tomar fotos: solo con permiso (la base lo define en permisos: exportar_csv / exportar_foto) ====== */
const puedeExportar = tipo => {
  if (!S.me || !can(tipo === 'csv' ? 'exportar_csv' : 'exportar_foto', 'ver')) return false;
  if (S.view === 'nomina' && !can('nomina', 'editar')) return false;          // nómina y finiquitos: los gerentes solo los ven
  if (S.view === 'finiquitos' && !can('finiquitos', 'editar')) return false;
  return true;
};
function exportClases() { document.body.classList.toggle('sin-csv', !puedeExportar('csv')); document.body.classList.toggle('sin-foto', !puedeExportar('foto')); }
(function () {
  const guarda = (nombre, tipo, aviso) => { const orig = window[nombre]; if (typeof orig !== 'function') return; window[nombre] = function () { if (!puedeExportar(tipo)) { toast(aviso); return; } return orig.apply(this, arguments); }; };
  guarda('capturaDescargar', 'foto', 'Tu usuario no puede tomar fotos de las pantallas'); guarda('capturaCopiar', 'foto', 'Tu usuario no puede tomar fotos de las pantallas');
  guarda('tcsv', 'csv', 'Tu usuario no puede exportar archivos CSV'); guarda('finBajar', 'csv', 'Tu usuario no puede exportar archivos CSV');
})();

function soloMisTiendas() {
  const r = S.me.permisos.reportes || {}, alc = r.alcance_ver || r.alcance, m = S.me, mismo = (a, b) => a && b && String(a).toUpperCase() === String(b).toUpperCase();
  const ok = { estado: t => mismo(t.rrhh, m.rrhh), zona: t => mismo(t.zona_rrhh, m.zona), reclutador: t => mismo(t.reclutador, m.reclutador_nombre) }[alc];
  if (!ok || !S.cat || !S.cat.tiendas) return;
  S.cat.tiendas = Object.fromEntries(Object.entries(S.cat.tiendas).filter(([, t]) => ok(t)));
}
