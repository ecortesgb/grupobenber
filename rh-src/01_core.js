/* RH GB · app de Recursos Humanos. Pantalla 1: bandeja de posibles bajas y ausencias. */
const CFG = window.RH_CONFIG, ASSET = window.RH_ASSETS || {};
const DEMO = new URLSearchParams(location.search).has('demo');
const $ = id => document.getElementById(id);
const img = k => ASSET[k] || '';
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pad = n => String(n).padStart(2, '0');
const hoyISO = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const HOY = hoyISO();
const addD = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const diffD = (a, b) => Math.round((new Date(a + 'T12:00:00') - new Date(b + 'T12:00:00')) / 864e5);
const fdate = s => s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(2, 4) : '—';
const fmt = n => (n == null || isNaN(n)) ? '—' : Math.round(n).toLocaleString('es-MX');
const toast = m => { const t = $('toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.k); toast.k = setTimeout(() => t.hidden = true, 2800); };
const NIVEL = { admin: 'Administrador', direccion: 'Dirección', gerente: 'Gerente', rh: 'RH', reclutador: 'Reclutador' };

/* ====================================================================== capa de datos ====================================================================== */
let sb = null;
async function todo(q) { // pagina de 1000 en 1000 (las páginas siguientes se piden en paralelo), con reintentos si la red falla
  const pag = async i => { let data, error; for (let k = 0; k < 4; k++) { try { ({ data, error } = await q().range(i, i + 999)); if (!error) break; } catch (e) { error = e; } await new Promise(r => setTimeout(r, 700 * (k + 1))); } if (error) throw error; return data; };
  let out = await pag(0); if (out.length < 1000) return out;
  for (let i = 1000; ;) {
    const lote = await Promise.all([0, 1, 2, 3].map(k => pag(i + k * 1000))); let fin = false;
    for (const d of lote) { out = out.concat(d); if (d.length < 1000) { fin = true; break; } }
    if (fin) return out; i += 4000;
  }
}
const Real = {
  async init() { sb = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: true, autoRefreshToken: true } }); const { data } = await sb.auth.getSession(); return !!data.session; },
  async login(u, p) { const email = u.includes('@') ? u : u.trim().toLowerCase() + CFG.dominio; const { error } = await sb.auth.signInWithPassword({ email, password: p }); if (error) throw new Error('Usuario o contraseña incorrectos'); },
  async logout() { await sb.auth.signOut(); },
  async me() {
    const { data: u } = await sb.auth.getUser(); const id = u.user.id;
    const { data: p, error } = await sb.from('perfiles').select('*').eq('id', id).maybeSingle();
    if (error || !p) throw new Error('Tu usuario existe pero no tiene perfil asignado. Pide a un administrador que lo active.');
    const { data: pm } = await sb.from('permisos').select('*').eq('rol', p.rol);
    return { id, debeCambiar: !!p.debe_cambiar_clave, nombre: p.nombre, rol: p.rol, rrhh: p.rrhh_nombre, zona: p.zona_rrhh, reclutador_id: p.reclutador_id, reclutador_nombre: p.reclutador_nombre, permisos: Object.fromEntries((pm || []).map(x => [x.modulo, x])) };
  },
  async catalogos() {
    const [t, ma, mb] = await Promise.all([todo(() => sb.from('tiendas').select('idpdv,nombre,cadena,estado,region,gerente,supervisor,rrhh,reclutador,posiciones,zona_rrhh,clase,tipo_ekt,subdireccion_gb,sub_terr,lider')),
      sb.from('catalogo_motivos_ausencia').select('motivo').eq('activo', true), sb.from('catalogo_motivos_baja').select('motivo,tipo').eq('activo', true)]);
    return { tiendas: Object.fromEntries(t.map(x => [x.idpdv, x])), motAus: ma.data.map(x => x.motivo), motBaja: mb.data };
  },
  async alertas() {
    const al = await todo(() => sb.from('alertas_asistencia').select('id,usuario_fieldwy,ultimo_check,dias_sin_check,idpdv,origen,nota,colaboradores(nombre,empresa,fecha_ingreso,idpdv)').eq('estatus', 'Abierta').order('dias_sin_check', { ascending: false, nullsFirst: false }));
    const desde = addD(HOY, -90);
    const us = al.map(a => a.usuario_fieldwy);
    let hist = [];
    if (us.length) hist = await todo(() => sb.from('ausencias').select('usuario_fieldwy,motivo,fecha_inicio,dias,fecha_regreso').gte('fecha_inicio', desde).neq('motivo', 'Descanso').in('usuario_fieldwy', us.slice(0, 400)));
    const por = {}; hist.forEach(h => (por[h.usuario_fieldwy] = por[h.usuario_fieldwy] || []).push(h));
    return al.map(a => ({ id: a.id, usuario: a.usuario_fieldwy, nombre: a.colaboradores?.nombre || a.usuario_fieldwy, ultimo: a.ultimo_check, dias: a.dias_sin_check, idpdv: a.idpdv || a.colaboradores?.idpdv, empresa: a.colaboradores?.empresa, ingreso: a.colaboradores?.fecha_ingreso, origen: a.origen || 'asistencia', nota: a.nota || '', aus: por[a.usuario_fieldwy] || [] }));
  },
  async vigentes() {
    const r = await todo(() => sb.from('ausencias').select('id,usuario_fieldwy,motivo,fecha_inicio,dias,fecha_regreso,comentarios,idpdv,colaboradores(nombre,idpdv)').gt('fecha_regreso', HOY).lte('fecha_inicio', HOY).neq('motivo', 'Descanso').order('fecha_regreso'));
    return r.map(a => ({ id: a.id, usuario: a.usuario_fieldwy, nombre: a.colaboradores?.nombre || a.usuario_fieldwy, motivo: a.motivo, inicio: a.fecha_inicio, dias: a.dias, regreso: a.fecha_regreso, idpdv: a.idpdv || a.colaboradores?.idpdv, comentarios: a.comentarios }));
  },
  async solapes(usuario, ini, reg) {
    const { data } = await sb.from('ausencias').select('motivo,fecha_inicio,fecha_regreso').eq('usuario_fieldwy', usuario).neq('motivo', 'Descanso').lt('fecha_inicio', reg).gt('fecha_regreso', ini);
    return data || [];
  },
  async registrarAusencia(al, d) {
    // ausencia + cierre de la alerta en una sola transacción
    const { error } = await sb.rpc('registrar_ausencia_desde_alerta', { p_alerta: al.id, p_motivo: d.motivo, p_inicio: d.inicio, p_dias: d.dias, p_comentarios: d.comentarios || null });
    if (error) throw new Error(error.message);
  },
  async confirmarBaja(al, d, usr) {
    // baja + movimiento + estatus + cierre de la alerta en una sola transacción
    const { error } = await sb.rpc('registrar_baja', { p_usuario: al.usuario, p_fecha: d.fecha, p_ultimo: al.ultimo || null, p_motivo: d.motivo, p_marca: d.marca || null, p_adeudo: 0, p_adeudo_detalle: null,
      p_evidencia: null, p_comentarios: d.comentarios || null, p_idpdv: al.idpdv || null, p_enc: null });
    if (error) throw new Error(error.message);
  },
  async errorAsistencia(al) { await this.cerrar(al, 'Error de asistencia'); },
  async cerrar(al, estatus, ausId) {
    const { data: u } = await sb.auth.getUser();
    const { error } = await sb.from('alertas_asistencia').update({ estatus, ausencia_id: ausId || null, resuelta_por: u.user.id, resuelta_en: new Date().toISOString() }).eq('id', al.id);
    if (error) throw error;
  }
};

