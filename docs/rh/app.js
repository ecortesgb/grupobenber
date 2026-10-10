/* >>> 01_core.js */
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
async function todo(q) { // pagina de 1000 en 1000, con reintentos si la red falla
  let out = [], i = 0;
  for (;;) {
    let data, error;
    for (let k = 0; k < 4; k++) { try { ({ data, error } = await q().range(i, i + 999)); if (!error) break; } catch (e) { error = e; } await new Promise(r => setTimeout(r, 700 * (k + 1))); }
    if (error) throw error; out = out.concat(data); if (data.length < 1000) return out; i += 1000;
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
    return { id, nombre: p.nombre, rol: p.rol, rrhh: p.rrhh_nombre, zona: p.zona_rrhh, reclutador_id: p.reclutador_id, permisos: Object.fromEntries((pm || []).map(x => [x.modulo, x])) };
  },
  async catalogos() {
    const [t, ma, mb] = await Promise.all([todo(() => sb.from('tiendas').select('idpdv,nombre,cadena,estado,region,gerente,supervisor,rrhh,posiciones,zona_rrhh,clase,tipo_ekt,subdireccion_gb,sub_terr,lider')),
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


/* >>> 01b_demo_base.js */
/* ---------- datos de ejemplo (todo ficticio; escribe solo en memoria) ---------- */
const Demo = (() => {
  const nombres = ['Ana Karen Solís', 'Luis Ángel Ortega', 'María Fernanda Cruz', 'José Manuel Reyes', 'Daniela Ruiz Peña', 'Carlos Iván Mora', 'Paola Estrada', 'Jorge Alberto Lara', 'Valeria Núñez', 'Diego Armando Gil', 'Karla Itzel Vega', 'Miguel Ángel Soto', 'Fátima Luna', 'Ricardo Salas', 'Brenda Morales', 'Héctor Duarte', 'Itzel Aguirre', 'Omar Castañeda', 'Lucía Montes', 'Andrés Cabrera', 'Nancy Palacios', 'Emilio Rangel', 'Sofía Barrera', 'Raúl Meza'];
  const est = [['Puebla', 'SUR', 'Julio César Aldana'], ['Veracruz', 'SUR', 'Jessica Santos'], ['Guanajuato', 'OCCIDENTE', 'Andrea Maya'], ['Nuevo León', 'NORTE', 'Flor Morado'], ['Ciudad de México', 'CENTRO', 'Dulce Apaiz']];
  const cad = ['Coppel', 'Elektra', 'Suburbia', 'Cimaco'];
  const tiendas = {}; let id = 1000;
  const tien = []; for (let i = 0; i < 40; i++) { const e = est[i % 5]; const t = { idpdv: id + i, nombre: (cad[i % 4]).toUpperCase() + ' ' + ['CENTRO', 'PLAZA SOL', 'NORTE', 'REFORMA', 'ALAMEDA', 'LAS TORRES', 'CANADA', 'AZTECAS'][i % 8] + ' ' + (i + 1), cadena: cad[i % 4], estado: e[0], region: e[1], gerente: 'Gerente Demo', supervisor: 'Supervisor ' + (i % 7 + 1), rrhh: e[2], posiciones: 1 + ((id + i) % 2), zona_rrhh: ['ANDREA AGUILAR BUENO', 'GUADALUPE GOMEZ GARCIA', 'MARIA EUGENIA JUAREZ MORA'][i % 3] }; tiendas[t.idpdv] = t; tien.push(t); }
  const mkAus = (u, k) => { const m = ['Permiso especial', 'Vacaciones', 'Incapacidad (IMSS)', 'Tema médico (particular)']; return Array.from({ length: k }, (_, j) => ({ motivo: m[(u + j) % 4], fecha_inicio: addD(HOY, -(8 + j * 21 + u % 9)), dias: 1 + (u + j) % 5, fecha_regreso: addD(HOY, -(8 + j * 21 + u % 9) + 1 + (u + j) % 5) })); };
  let alertas = nombres.map((n, i) => { const dias = [2, 2, 3, 2, 4, 6, 2, 3, 9, 2, 5, 2, 3, 2, 12, 2, 4, 3, 2, 7, 2, 3, 2, 5][i]; const t = tien[(i * 7) % 40]; return { id: i + 1, usuario: 'DEMO' + String(100 + i), nombre: n, ultimo: addD(HOY, -dias), dias, idpdv: t.idpdv, empresa: ['Benber SS', 'Revelor', 'Doma Legal', 'Atmosphera'][i % 4], ingreso: addD(HOY, -(30 + i * 37)), aus: mkAus(i, i % 4 === 0 ? 3 : i % 3) }; });
  let vigentes = [['Vacaciones', 6, 3], ['Incapacidad (IMSS)', 10, 5], ['Permiso especial', 3, 1], ['Tema médico (particular)', 4, 2], ['Vacaciones', 12, 8], ['Incapacidad (IMSS)', 20, 9], ['Permiso especial', 2, 1]].map((v, i) => ({ id: 500 + i, usuario: 'DEMO' + (300 + i), nombre: ['Pedro Lozano', 'Gabriela Ibarra', 'Mónica Téllez', 'Saúl Cervantes', 'Teresa Pineda', 'Víctor Maya', 'Elena Ochoa'][i], motivo: v[0], inicio: addD(HOY, -v[2]), dias: v[1], regreso: addD(HOY, v[1] - v[2]), idpdv: tien[(i * 5) % 40].idpdv }));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  return {
    async init() { return true; }, async login() { }, async logout() { location.href = location.pathname; },
    async me() { return { id: 'demo', nombre: 'Usuario de ejemplo', rol: 'rh', rrhh: 'Julio César Aldana', zona: null, permisos: Object.fromEntries(['alertas', 'ausencias', 'bajas', 'colaboradores', 'posibles_ingresos', 'expedientes', 'reportes'].map(m => [m, { ver: true, crear: true, editar: true, borrar: false, alcance: 'estado' }])) }; },
    async catalogos() { return { tiendas, motAus: ['Permiso especial', 'Vacaciones', 'Incapacidad (IMSS)', 'Tema médico (particular)', 'No localizado'], motBaja: [['Motivos personales', 'Voluntaria'], ['Renuncia voluntaria', 'Voluntaria'], ['Abandono de trabajo', 'Voluntaria'], ['Mejor oferta laboral (telefonía)', 'Voluntaria'], ['Mejor oferta laboral (otro rubro)', 'Voluntaria'], ['Cambio a marca o cadena', 'Voluntaria'], ['Malas prácticas', 'Involuntaria'], ['Baja productividad', 'Involuntaria'], ['Rescisión de contrato', 'Involuntaria'], ['Faltas consecutivas e injustificadas', 'Involuntaria']].map(([motivo, tipo]) => ({ motivo, tipo })) }; },
    async alertas() { await wait(150); return alertas.map(a => ({ ...a, aus: a.aus.map(x => ({ usuario_fieldwy: a.usuario, ...x })) })); },
    async vigentes() { await wait(100); return vigentes; },
    async solapes(u, ini, reg) { return []; },
    async registrarAusencia(al, d) { await wait(250); vigentes.push({ id: Date.now(), usuario: al.usuario, nombre: al.nombre, motivo: d.motivo, inicio: d.inicio, dias: d.dias, regreso: addD(d.inicio, d.dias), idpdv: al.idpdv }); alertas = alertas.filter(x => x.id !== al.id); },
    async confirmarBaja(al) { await wait(250); alertas = alertas.filter(x => x.id !== al.id); },
    async errorAsistencia(al) { await wait(150); alertas = alertas.filter(x => x.id !== al.id); }
  };
})();
const API = DEMO ? Demo : Real;


/* >>> 02_ui.js */
/* ====================================================================== UI: gráficos, tablas fijas, filtros, periodo, capturas ====================================================================== */
const MESN = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const mlabel = k => MESN[+k.slice(5, 7) - 1] + ' ' + k.slice(2, 4);
const f1 = n => n == null || isNaN(n) ? '—' : n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt1 = n => n == null || isNaN(n) ? '—' : (Math.abs(n - Math.round(n)) < 0.005 ? Math.round(n).toLocaleString('es-MX') : n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const pn = (a, b) => b > 0 ? a / b * 100 : null;
const pc1 = (a, b) => b > 0 ? (a / b * 100).toFixed(2) + '%' : '—';
const pct = (a, b, d = 2) => b > 0 ? (a / b * 100).toFixed(d) + '%' : '—';
const C = { or: '#EE6602', od: '#C74F00', gr: '#1E7A1E', rd: '#DC2626', am: '#D97706', ye: '#F2C94C', bl: '#00509C', pu: '#5C2483', gy: '#8B939E', dk: '#3B4048', te: '#0F8B8D' };
const pillx = (t, c) => `<span class="pill ${c}">${t}</span>`;
const kp = (l, v, s, col, click, ic) => `<div class="kpi ${click ? 'click' : ''}" ${click ? `onclick="${click}"` : ''}><div class="l">${ic ? `<span class="kic">${ic}</span>` : ''}${l}</div><div class="v" style="${col ? 'color:' + col : ''}">${v}</div><div class="s">${s || '&nbsp;'}</div></div>`;
const sect = (t, ic) => `<div class="section-title"><span class="bar"></span><h3>${ic ? ic + ' ' : ''}${t}</h3></div>`;
const legend = items => `<div class="leg">${items.map(([n, c]) => `<span><b style="background:${c}"></b>${n}</span>`).join('')}</div>`;
const dl = (a, b, fx = 2) => a == null || b == null ? '' : `<span class="${a - b >= 0 ? 'up' : 'dn'}">${a - b >= 0 ? '▲' : '▼'} ${Math.abs(a - b).toFixed(fx)} pts vs ant.</span>`;

/* ---------- gráficos SVG ---------- */
function niceTop(v) { // tope del eje tal que sus 4 divisiones sean números redondos (40 -> 0,10,20,30,40)
  if (v <= 0) return 1; const s = v / 4, p = Math.pow(10, Math.floor(Math.log10(s))), m = s / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : (m <= 2.5 && p >= 10) ? 2.5 : m <= 5 ? 5 : 10) * p * 4;
}
function niceMax(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; }
function regresion(vals) { // recta de tendencia (mínimos cuadrados) sobre los puntos con dato
  const p = vals.map((v, i) => [i, v]).filter(q => q[1] != null); if (p.length < 2) return null;
  const n = p.length, sx = p.reduce((a, q) => a + q[0], 0), sy = p.reduce((a, q) => a + q[1], 0), sxy = p.reduce((a, q) => a + q[0] * q[1], 0), sxx = p.reduce((a, q) => a + q[0] * q[0], 0), d = n * sxx - sx * sx;
  if (!d) return null; const m = (n * sxy - sx * sy) / d, b = (sy - m * sx) / n; return i => b + m * i;
}
/* chart(labels, series, {bars, stack, pct, max, h, w, ticks, vals, lines (misma escala), lines2 (escala derecha), band (la línea va en una franja arriba, sin tapar las barras), y2:{max,pct}}) */
function chart(labels, series, o = {}) {
  const l2 = o.lines2 || [], band = !!(o.band && l2.length), W = o.w || 600, H = o.h || 290, L = 46, R = l2.length ? 54 : 30, T = band ? 36 : 26, B = 28, pw = W - L - R, ph = H - T - B, n = labels.length;
  const phB = band ? ph * 0.64 : ph, phL = band ? ph * 0.27 : ph;
  const all = [...series.flatMap(s => s.v), ...(o.lines || []).flatMap(s => s.v)].filter(x => x != null);
  let mx = o.max != null ? o.max : niceTop(Math.max(1e-9, ...all));
  if (o.stack) { const tot = labels.map((_, i) => series.reduce((a, s) => a + (s.v[i] || 0), 0)); mx = o.max != null ? o.max : niceTop(Math.max(1e-9, ...tot, ...(o.lines || []).flatMap(s => s.v).filter(x => x != null))); }
  const y = v => T + ph - (v / mx) * phB, bw = pw / Math.max(1, n), xc = i => L + i * bw + bw / 2, xs = i => L + (n <= 1 ? pw / 2 : i * pw / (n - 1)), X = i => o.bars ? xc(i) : xs(i);
  const v2 = l2.flatMap(s => s.v).filter(x => x != null), fT = l2.map(s => s.trend ? regresion(s.v) : null);
  const vt = [...v2]; l2.forEach((s, k) => { if (fT[k]) { vt.push(fT[k](0), fT[k](n - 1)); } });
  let lo2 = 0, hi2 = o.y2 && o.y2.max != null ? o.y2.max : niceMax(Math.max(1e-9, ...v2) * 1.15);
  if (band) { const a = Math.min(...vt), b = Math.max(...vt), r = (b - a) || Math.max(0.5, Math.abs(b) * 0.2); lo2 = Math.max(0, a - r * 0.5); hi2 = b + r * 0.5; }
  const y2 = band ? v => T + phL - (v - lo2) / (hi2 - lo2) * phL : v => T + ph - (v / hi2) * ph;
  const lab = v => o.pct ? (mx < 10 ? v.toFixed(1) : Math.round(v)) + '%' : fmt(v), lab2 = v => o.y2 && o.y2.pct ? v.toFixed(2) + '%' : fmt1(v);
  let g = band ? `<rect x="${L}" y="${T - 12}" width="${pw}" height="${phL + 24}" rx="9" fill="#FFF3E6"/>` : '';
  for (let k = 0; k <= 4; k++) { const v = mx * k / 4; g += `<line class="g" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 7}" y="${y(v) + 4}" text-anchor="end">${lab(v)}</text>`; }
  if (l2.length) (band ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1]).forEach(f => { const v = lo2 + (hi2 - lo2) * f; g += `<text x="${W - R + 7}" y="${y2(v) + 4}" text-anchor="start" style="fill:#9A4A00;font-weight:700">${o.y2 && o.y2.pct ? v.toFixed(band ? 2 : 1) + '%' : fmt1(v)}</text>`; });
  const every = Math.ceil(n / (o.ticks || 14));
  labels.forEach((l, i) => { if (i % every === 0) g += `<text x="${X(i)}" y="${H - 8}" text-anchor="middle" style="font-weight:700;fill:#3a3f47">${esc(l)}</text>`; });
  const vi = (x, yy, t) => `<text x="${x}" y="${yy}" text-anchor="middle" class="vi">${t}</text>`, vo = (x, yy, t, c) => `<text x="${x}" y="${yy}" text-anchor="middle" class="vl" style="fill:${c}">${t}</text>`;
  const pill = (x, yy, t, c) => { const w = t.length * 7.6 + 14; return `<rect x="${x - w / 2}" y="${yy - 25}" width="${w}" height="20" rx="7" fill="#fff" stroke="${c}" stroke-width="1.8"/><text x="${x}" y="${yy - 10.5}" text-anchor="middle" class="vp" style="fill:${c}">${t}</text>`; };
  if (o.bars) {
    const ns = o.stack ? 1 : series.length, w = Math.max(3, bw * 0.8 / ns);
    labels.forEach((_, i) => {
      let acc = 0;
      series.forEach((s, j) => {
        const v = s.v[i] || 0, x = o.stack ? L + i * bw + bw * 0.1 : L + i * bw + bw * 0.1 + j * w, h = v / mx * phB, yy = o.stack ? T + ph - (acc + v) / mx * phB : T + ph - h, ww = o.stack ? bw * 0.8 : w;
        g += `<rect x="${x}" y="${yy}" width="${ww}" height="${Math.max(0, h)}" fill="${s.c}" rx="3"><title>${esc(labels[i])} · ${esc(s.n)}: ${o.pct ? v.toFixed(2) + '%' : fmt(v)}</title></rect>`;
        if (o.vals && v > 0) { if (h >= 17 && ww >= 22) g += vi(x + ww / 2, yy + h / 2 + 5, fmt(v)); else if (!o.stack) g += vo(x + ww / 2, yy - 5, fmt(v), s.tc || s.c); }
        acc += v;
      });
    });
  } else series.forEach(s => {
    let d = ''; s.v.forEach((v, i) => { if (v != null) d += (d ? 'L' : 'M') + xs(i) + ',' + y(v); });
    g += `<path d="${d}" fill="none" stroke="${s.c}" stroke-width="3" stroke-linejoin="round"/>`;
    s.v.forEach((v, i) => { if (v != null) g += `<circle cx="${xs(i)}" cy="${y(v)}" r="4" fill="${s.c}"><title>${esc(labels[i])} · ${esc(s.n)}: ${o.pct ? v.toFixed(2) + '%' : fmt(v)}</title></circle>${o.vals ? pill(xs(i), y(v) - 2, o.pct ? v.toFixed(2) + '%' : fmt(v), s.tc || s.c) : ''}`; });
  });
  (o.lines || []).forEach(s => {
    let d = ''; s.v.forEach((v, i) => { if (v != null) d += (d ? 'L' : 'M') + X(i) + ',' + y(v); });
    g += `<path d="${d}" fill="none" stroke="${s.c}" stroke-width="2.8" stroke-dasharray="${s.dash || ''}"/>`;
    s.v.forEach((v, i) => { if (v != null) g += `<circle cx="${X(i)}" cy="${y(v)}" r="3.6" fill="#fff" stroke="${s.c}" stroke-width="2"><title>${esc(labels[i])} · ${esc(s.n)}: ${o.pct2 ? v.toFixed(2) + '%' : fmt(v)}</title></circle>`; });
  });
  l2.forEach((s, k) => {
    const f = fT[k]; if (f) g += `<line x1="${X(0)}" y1="${y2(f(0))}" x2="${X(n - 1)}" y2="${y2(f(n - 1))}" stroke="${s.tc || '#3B4048'}" stroke-width="2.4" stroke-dasharray="7 5"><title>Tendencia de ${esc(s.n)}</title></line>`;
    let d = ''; s.v.forEach((v, i) => { if (v != null) d += (d ? 'L' : 'M') + X(i) + ',' + y2(v); });
    g += `<path d="${d}" fill="none" stroke="${s.c}" stroke-width="3.2" stroke-linejoin="round"/>`;
    s.v.forEach((v, i) => { if (v != null) g += `<circle cx="${X(i)}" cy="${y2(v)}" r="4.6" fill="#fff" stroke="${s.c}" stroke-width="2.6"><title>${esc(labels[i])} · ${esc(s.n)}: ${lab2(v)}</title></circle>${pill(X(i), y2(v) - 5, lab2(v), s.c)}`; });
  });
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img">${g}</svg>`;
}
function donut(items, o = {}) {
  const tot = items.reduce((a, b) => a + b.v, 0) || 1; let a0 = -Math.PI / 2, p = '';
  items.forEach(it => {
    if (!it.v) return; const a1 = a0 + it.v / tot * 2 * Math.PI, r = 66, ri = 42, cx = 80, cy = 80, lg = a1 - a0 > Math.PI ? 1 : 0;
    const P = (rr, a) => [cx + rr * Math.cos(a), cy + rr * Math.sin(a)]; const e = Math.min(a1, a0 + 6.2831);
    const [x0, y0] = P(r, a0), [x1, y1] = P(r, e), [x2, y2] = P(ri, e), [x3, y3] = P(ri, a0);
    p += `<path d="M${x0},${y0}A${r},${r} 0 ${lg} 1 ${x1},${y1}L${x2},${y2}A${ri},${ri} 0 ${lg} 0 ${x3},${y3}Z" fill="${it.c}" stroke="#fff" stroke-width="1.5"><title>${esc(it.n)}: ${fmt(it.v)}</title></path>`; a0 = a1;
  });
  const top = [...items].sort((a, b) => b.v - a.v)[0];
  return `<div class="donut"><svg class="donut-svg" viewBox="0 0 160 160" width="164" height="164">${p}<text x="80" y="76" text-anchor="middle" style="font-size:18px;font-weight:800;fill:#1a1a1a">${o.centro != null ? o.centro : fmt(tot)}</text><text x="80" y="92" text-anchor="middle" style="font-size:9px">${esc(o.sub || 'total')}</text></svg>
  <div class="donut-leg">${items.map(it => `<div class="dl-row ${top && it === top && o.best ? 'best' : ''}"><i style="background:${it.c}"></i><span class="dl-n" title="${esc(it.n)}">${esc(it.n)}</span><b>${o.fmtv ? o.fmtv(it) : fmt(it.v)}</b><em>${pct(it.v, tot, 0)}</em></div>`).join('')}</div></div>`;
}
function hbars(rows, col, o = {}) {
  const mx = Math.max(1e-9, ...rows.map(r => r.v));
  return `<div class="funnel">${rows.map(r => `<div class="frow"><span title="${esc(r.n)}" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.n)}</span><div class="fb"><i style="width:${Math.max(2, r.v / mx * 100)}%;background:${r.c || col}"></i></div><span>${o.pct ? r.v.toFixed(2) + '%' : fmt(r.v)}${r.s ? ` <small class="pc">${r.s}</small>` : ''}</span></div>`).join('')}</div>`;
}
function embudo(titulo, etapas) {
  const mx = etapas[0].v || 1;
  return `<div class="card"><h3>${titulo}</h3><div class="funnel2">${etapas.map(e => `<div class="fn-row"><div class="fn-l">${e.n}</div><div class="fn-b" style="width:${Math.max(10, e.v / mx * 100)}%;background:${e.c}"><span>${fmt1(e.v)}</span></div></div>`).join('')}</div></div>`;
}

/* ---------- tablas con encabezados y columnas fijas, búsqueda, CSV y PNG ----------
   cols: [{h, v, r, t(texto a la izquierda), w(ancho px), grp, c(clase de color)}] · opts: {fix:n, groups:[{t,span,cls}], search, csv, png, file, sort, dir, lim, titulo, maxh} */
let TB = {};
function tbl(id, cols, rows, o = {}) {
  TB[id] = { cols, rows, sort: o.sort == null ? -1 : o.sort, dir: o.dir || -1, q: '', lim: o.lim || 300, file: o.file || id, fix: o.fix || 0, groups: o.groups || null, titulo: o.titulo || o.file || id, maxh: o.maxh };
  return `<div class="tools tb-tools">${o.search ? `<input type="search" placeholder="🔎 Buscar…" oninput="tq('${id}',this.value)">` : ''}<span class="muted" id="${id}-n"></span><span class="tb-btns">${o.png ? `<button class="btn sm" onclick="tpng('${id}')" title="Descarga la tabla filtrada como imagen para compartirla">📸 Imagen</button><button class="btn sm" onclick="tpngCopiar('${id}')" title="Copia la imagen para pegarla en WhatsApp">📋 Copiar</button>` : ''}${o.csv ? `<button class="btn sm" onclick="tcsv('${id}')">⬇ CSV</button>` : ''}</span></div><div class="tw" id="${id}-w" ${o.maxh ? `style="max-height:${o.maxh}"` : ''}><table class="dt st" id="${id}"></table></div>`;
}
function filtraT(T) { let rows = T.rows; if (T.q) { const q = norm(T.q); rows = rows.filter(r => T.cols.some(c => norm(c.v(r) == null ? '' : c.v(r)).includes(q))); } return rows; }
function tdraw(id) {
  const T = TB[id], el = $(id); if (!el) return; let rows = filtraT(T);
  if (T.sort >= 0) { const c = T.cols[T.sort]; rows = rows.slice().sort((a, b) => { const x = c.v(a), y = c.v(b); const nx = x == null || x === '', ny = y == null || y === ''; if (nx || ny) return nx && ny ? 0 : nx ? 1 : -1; return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'es')) * T.dir; }); }
  const shown = rows.slice(0, T.lim); const left = []; let acc = 0; T.cols.forEach((c, i) => { left[i] = acc; if (i < T.fix) acc += c.w || 110; });
  const fx = i => i < T.fix ? ` fx" style="left:${left[i]}px;min-width:${T.cols[i].w || 110}px;max-width:${T.cols[i].w || 110}px` : '"';
  const th = (c, i) => `<th class="s${i < T.fix ? ' fx' : ''}${c.hc ? ' ' + c.hc : ''}" ${i < T.fix ? `style="left:${left[i]}px;min-width:${c.w || 110}px;max-width:${c.w || 110}px"` : ''} onclick="tsort('${id}',${i})">${c.h}${T.sort === i ? (T.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`;
  let h = '<thead>';
  if (T.groups) { let k = 0; h += '<tr class="g1">' + T.groups.map(g => { const cells = T.cols.slice(k, k + g.span); const fixed = k < T.fix; const lf = fixed ? left[k] : 0; const w = fixed ? cells.reduce((a, c, j) => a + (k + j < T.fix ? (c.w || 110) : 0), 0) : 0; const r = `<th colspan="${g.span}" class="gh ${g.cls || ''}${fixed ? ' fx' : ''}" ${fixed ? `style="left:${lf}px;min-width:${w}px"` : ''}>${g.t}</th>`; k += g.span; return r; }).join('') + '</tr>'; }
  h += `<tr class="${T.groups ? 'g2' : ''}">` + T.cols.map(th).join('') + '</tr></thead><tbody>';
  h += shown.map(r => '<tr>' + T.cols.map((c, i) => { const v = c.v(r), disp = c.r ? c.r(r) : (v == null ? '—' : (typeof v === 'number' ? (c.h === 'IDPDV' ? v : fmt(v)) : esc(v))); const cl = (typeof c.c === 'function' ? c.c(r) : c.c) || ''; return `<td class="${c.t ? 't ' : ''}${i < T.fix ? 'fx ' : ''}${cl}" ${i < T.fix ? `style="left:${left[i]}px;min-width:${c.w || 110}px;max-width:${c.w || 110}px"` : ''}>${i < T.fix ? `<div class="cut" style="max-width:${(c.w || 110) - 24}px" title="${esc(String(v == null ? '' : v))}">${disp}</div>` : disp}</td>`; }).join('') + '</tr>').join('');
  el.innerHTML = h + '</tbody>';
  const n = $(id + '-n'); if (n) n.textContent = rows.length > T.lim ? `Mostrando ${T.lim} de ${fmt(rows.length)}` : `${fmt(rows.length)} filas`;
}
const tsort = (id, i) => { const T = TB[id]; if (T.sort === i) T.dir = -T.dir; else { T.sort = i; T.dir = T.cols[i].t ? 1 : -1; } tdraw(id); };
const tq = (id, v) => { TB[id].q = v; tdraw(id); };
function tcsv(id) {
  const T = TB[id], rows = filtraT(T), q = s => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
  const t = [T.cols.map(c => q(c.h.replace(/<[^>]+>/g, ''))).join(',')].concat(rows.map(r => T.cols.map(c => q(c.v(r))).join(','))).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + t], { type: 'text/csv;charset=utf-8' })); a.download = T.file + '.csv'; a.click(); toast('CSV descargado');
}
const drawAll = () => Object.keys(TB).forEach(tdraw);

/* ---------- capturas (PNG) para compartir en los grupos ---------- */
async function pngDe(el, titulo, sub) {
  if (!window.html2canvas) throw new Error('El generador de imágenes no cargó (revisa tu conexión).');
  const box = document.createElement('div'); box.className = 'cap-box'; box.style.width = 'max-content'; box.style.minWidth = '760px';
  box.innerHTML = `<div class="cap-head"><img src="${img('logo_gb')}" alt=""><div><b>${esc(titulo)}</b><small>${esc(sub || '')}</small></div><span>Grupo Benber · RH · ${fdate(HOY)}</span></div>`;
  const clon = el.cloneNode(true);
  [clon, ...clon.querySelectorAll('.tw')].filter(t => t.classList && t.classList.contains('tw')).forEach(t => { t.style.maxHeight = 'none'; t.style.overflow = 'visible'; t.style.width = 'max-content'; t.style.maxWidth = 'none'; });
  clon.querySelectorAll('[data-nocap]').forEach(x => x.remove()); clon.querySelectorAll('details').forEach(d => d.setAttribute('open', '')); clon.querySelectorAll('.xlw').forEach(t => { t.style.overflow = 'visible'; t.style.maxHeight = 'none'; });
  clon.querySelectorAll('.fx').forEach(x => { x.style.position = 'static'; x.style.left = 'auto'; x.style.maxWidth = 'none'; }); clon.querySelectorAll('.cut').forEach(x => { x.style.overflow = 'visible'; x.style.textOverflow = 'clip'; x.style.maxWidth = 'none'; });
  clon.querySelectorAll('thead th').forEach(x => { x.style.position = 'static'; });
  box.appendChild(clon); document.body.appendChild(box);
  try { await (document.fonts && document.fonts.ready); await new Promise(r => setTimeout(r, 60)); const w = Math.ceil(Math.max(box.getBoundingClientRect().width, box.scrollWidth, 760)), hh = Math.ceil(Math.max(box.getBoundingClientRect().height, box.scrollHeight)), sc = Math.min(2, 16000 / Math.max(w, hh)); return await html2canvas(box, { scale: sc, backgroundColor: '#ffffff', useCORS: true, width: w, height: hh, windowWidth: w + 80, windowHeight: hh + 80, scrollX: 0, scrollY: 0 }); } finally { box.remove(); }
}
async function capturaDescargar(el, titulo, sub, nombre) { toast('Generando imagen…'); try { const c = await pngDe(el, titulo, sub); const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = (nombre || titulo).replace(/[^\w\-]+/g, '_') + '_' + HOY + '.png'; a.click(); toast('Imagen descargada'); } catch (e) { toast(e.message || e); } }
async function capturaCopiar(el, titulo, sub) {
  // el portapapeles exige iniciar la escritura dentro del clic: se entrega una promesa del PNG y el navegador la espera
  toast('Generando imagen…');
  const blobP = pngDe(el, titulo, sub).then(c => new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('No se pudo generar la imagen')), 'image/png')));
  try {
    if (!navigator.clipboard || !window.ClipboardItem) throw new Error('sin portapapeles');
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobP })]); toast('Imagen copiada: pégala en WhatsApp o Excel');
  } catch (e) {
    try { const b = await blobP; mostrarImagen(b, titulo); } catch (e2) { toast(e2.message || e2); }
  }
}
function mostrarImagen(blob, titulo) { // plan B: la muestra para copiarla con clic derecho o guardarla
  const u = URL.createObjectURL(blob); $('modal').innerHTML = `<div class="mbox wide" style="width:min(1100px,96vw)"><h3>📋 ${esc(titulo)}</h3><p class="note">Tu navegador no dejó copiar directo. Haz clic derecho sobre la imagen → <b>Copiar imagen</b>, o descárgala.</p><div style="max-height:62vh;overflow:auto;border:1px solid var(--line);border-radius:10px"><img src="${u}" style="display:block;max-width:none;width:100%"></div><div class="mfoot"><button class="btn" onclick="cerrarM()">Cerrar</button><a class="btn primary" href="${u}" download="${esc(titulo).replace(/[^\w\-]+/g, '_')}.png">⬇ Descargar</a></div></div>`; $('modal').hidden = false; $('modal').onclick = e => { if (e.target.id === 'modal') cerrarM(); };
}
const tpng = id => capturaDescargar($(id + '-w'), TB[id].titulo, subFiltros(), TB[id].file);
const tpngCopiar = id => capturaCopiar($(id + '-w'), TB[id].titulo, subFiltros());
const subFiltros = () => { const f = Object.entries(FL).filter(([, v]) => v).map(([k, v]) => v).join(' · '); return f || 'Todas las zonas'; };

/* ---------- filtros de estructura (compartidos por todas las secciones) ---------- */
const FL = { cadena: '', posiciones: '', clase: '', tipo_ekt: '', idpdv: '', region: '', subdireccion_gb: '', gerente: '', supervisor: '', sub_terr: '', lider: '', zona_rrhh: '', rrhh: '' };
const FCAMPOS = [['cadena', 'Cadena'], ['posiciones', 'Posc.'], ['clase', 'Class'], ['tipo_ekt', 'Resurtible'], ['idpdv', 'Tienda · IDPDV'], ['region', 'Región'], ['subdireccion_gb', 'Sub_GB'], ['gerente', 'Gerente'], ['supervisor', 'Supervisor'], ['sub_terr', 'Sub_Terr'], ['lider', 'Líder'], ['zona_rrhh', 'Gerencia RR.HH.'], ['rrhh', 'RR.HH.']];
const okT = t => t ? Object.entries(FL).every(([k, v]) => !v || String(t[k]) === String(v)) : !Object.values(FL).some(Boolean);
const okI = id => okT(tienda(id));
/* los filtros y el periodo viven en la barra global de arriba (02b_filtros.js); estas funciones quedan vacías para que las vistas no pinten una segunda barra */
const barraFiltros = () => '', barraPeriodo = () => '';

/* ---------- periodo: semana · mes · rango (como Avance GB) ---------- */
const PER = { modo: 'semana', sem: null, mes: null, desde: null, hasta: null };
function ventana() { return R.meta.ventana; }
function limites() { const max = R.meta.hoy || R.meta.ultima_fecha || HOY, d = new Date(max.slice(0, 7) + '-01T12:00:00'); d.setMonth(d.getMonth() - 2); const m3 = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-01'; return { min: R.meta.cd_desde > m3 ? R.meta.cd_desde : m3, max, mes3: m3 }; }
function rangoSemanaDe(i) { const w = ventana()[i], L = limites(); const fin = [addD(w.ini, 6), L.max].reduce((a, b) => a < b ? a : b); return { desde: w.ini, hasta: fin }; }
function perRango() {
  const L = limites(), W = ventana(); let d, h;
  if (PER.modo === 'semana') { if (PER.sem == null) PER.sem = W.length - 1; ({ desde: d, hasta: h } = rangoSemanaDe(PER.sem)); }
  else if (PER.modo === 'mes') { const m = PER.mes || L.max.slice(0, 7); d = m + '-01'; const nx = new Date(m + '-01T12:00:00'); nx.setMonth(nx.getMonth() + 1); nx.setDate(0); h = nx.getFullYear() + '-' + pad(nx.getMonth() + 1) + '-' + pad(nx.getDate()); }
  else if (PER.modo === 'dia') { d = h = PER.desde || L.max; }
  else if (PER.modo === 'hoy') { d = h = L.max; }
  else if (PER.modo === 'todo') { d = L.min; h = L.max; }
  else { d = PER.desde || addD(L.max, -6); h = PER.hasta || L.max; }
  if (d < L.min) d = L.min; if (h > L.max) h = L.max; if (h < d) h = d;
  const dias = []; for (let x = d; x <= h; x = addD(x, 1)) dias.push(x);
  return { desde: d, hasta: h, dias };
}
function semanasUlt4(r) { // las 4 últimas semanas (lun-dom) contra las que se compara el periodo filtrado
  const W = ventana(); let i = W.findIndex(w => addD(w.ini, 6) >= r.hasta && w.ini <= r.hasta); if (i < 0) i = W.length - 1;
  const out = []; for (let k = Math.max(0, i - 3); k <= i; k++) { const s = rangoSemanaDe(k); const dias = []; for (let x = s.desde; x <= s.hasta; x = addD(x, 1)) dias.push(x); out.push({ i: k, w: W[k].w, ...s, dias }); }
  return out;
}
function meses3() { const L = limites(), out = []; let m = L.max.slice(0, 7); for (let k = 0; k < 3; k++) { out.unshift(m); const x = new Date(m + '-01T12:00:00'); x.setMonth(x.getMonth() - 1); m = x.getFullYear() + '-' + pad(x.getMonth() + 1); } return out; }
function periodoHTML(fn, opts = {}) {
  const W = ventana(), L = limites(), r = perRango(), modos = [['hoy', '☀️ Hoy'], ['semana', '📅 Semana'], ['mes', '🗓️ Mes'], ['rango', '↔️ Rango'], ['todo', '📊 Todo'], ...(opts.dia ? [['dia', '🗓️ Día']] : [])];
  let ctl = '';
  if (PER.modo === 'semana') ctl = `<select onchange="PER.sem=+this.value;${fn}()">${W.map((w, k) => ({ w, k })).filter(({ w }) => addD(w.ini, 6) >= L.min).map(({ w, k }) => `<option value="${k}" ${k === PER.sem ? 'selected' : ''}>${w.w} · ${fdate(w.ini)}${k === W.length - 1 ? ' (en curso)' : ''}</option>`).join('')}</select>`;
  else if (PER.modo === 'mes') ctl = `<select onchange="PER.mes=this.value;${fn}()">${meses3().map(m => `<option value="${m}" ${(PER.mes || L.max.slice(0, 7)) === m ? 'selected' : ''}>${mlabel(m)}${m === L.max.slice(0, 7) ? ' (en curso)' : ''}</option>`).join('')}</select>`;
  else if (PER.modo === 'dia') ctl = `<input type="date" min="${L.min}" max="${L.max}" value="${r.desde}" onchange="PER.desde=this.value;${fn}()">`;
  else if (PER.modo === 'hoy' || PER.modo === 'todo') ctl = '';
  else ctl = `<input type="date" min="${L.min}" max="${L.max}" value="${r.desde}" onchange="PER.desde=this.value;${fn}()"> <span>a</span> <input type="date" min="${L.min}" max="${L.max}" value="${r.hasta}" onchange="PER.hasta=this.value;${fn}()">`;
  return `<div class="pb-seg">${modos.map(([k, n]) => `<button class="${PER.modo === k ? 'on' : ''}" onclick="PER.modo='${k}';${k === 'dia' ? "PER.desde=PER.desde||'" + L.max + "';" : ''}${fn}()">${n}</button>`).join('')}</div>${ctl}<span class="pb-info">${r.dias.length} día${r.dias.length > 1 ? 's' : ''} · ${fdate(r.desde)} al ${fdate(r.hasta)} (últimos 3 meses disponibles)</span>`;
}

/* ---------- tabla expandible tipo Excel (tabla dinámica): región > gerente > supervisor > tienda, con columnas numéricas ---------- */
let ARN = 0;
function arRef(t) { const st = []; t.querySelectorAll('tbody tr[data-l]').forEach(tr => { const l = +tr.dataset.l, v = l === 0 || st[l - 1]; tr.style.display = v ? '' : 'none'; st[l] = v && tr.classList.contains('open'); }); }
function arTog(tr) { tr.classList.toggle('open'); arRef(tr.closest('table')); }
function arNivel(id, n) { const t = $(id); t.querySelectorAll('tbody tr[data-l]').forEach(tr => { if (tr.dataset.k === 'n') tr.classList.toggle('open', +tr.dataset.l < n); }); arRef(t); }
function arbol(items, cols, o = {}) {
  const T = x => tienda(x.idpdv) || {}, N = cols.length, id = 'ar' + (++ARN), niv = [['region', 'Sin región', '🗺️'], ['gerente', 'Sin gerente', '👔'], ['supervisor', 'Sin supervisor', '🧑‍💼']];
  const val = (v, c) => v === 0 && c.cero !== true ? '' : (c.fmt ? c.fmt(v) : fmt(v));
  const celdas = (arr, tot) => cols.map(c => { const v = c.f(arr); return `<td class="${tot ? '' : (c.cls === 'g' ? 'cg' : c.cls === 'r' ? 'cr' : '')}${v === 0 && !tot ? ' z' : ''}">${val(v, c)}</td>`; }).join('');
  const orden = (a, b) => cols[N - 1].f(b[1]) - cols[N - 1].f(a[1]);
  function nodo(arr, nivel) {
    if (nivel >= niv.length) { const g = new Map(); arr.forEach(x => { const k = T(x).nombre || ('IDPDV ' + x.idpdv); if (!g.has(k)) g.set(k, []); g.get(k).push(x); }); return [...g].sort(orden).map(([k, v]) => `<tr data-l="3" class="lf"><td class="t">${esc(k)}</td>${celdas(v)}</tr>`).join(''); }
    const [campo, vacio, ic] = niv[nivel], g = new Map(); arr.forEach(x => { const k = T(x)[campo] || vacio; if (!g.has(k)) g.set(k, []); g.get(k).push(x); });
    return [...g].sort(orden).map(([k, v]) => `<tr data-l="${nivel}" data-k="n" class="n l${nivel}${nivel < (o.abrir == null ? 1 : o.abrir) ? ' open' : ''}" onclick="arTog(this)"><td class="t"><i class="ar-c"></i>${ic} ${esc(k)}</td>${celdas(v)}</tr>` + nodo(v, nivel + 1)).join('');
  }
  const ctl = `<div class="tools" data-nocap><span class="muted">Toca ⊞ para abrir cada nivel</span><button class="btn sm" onclick="arNivel('${id}',0)">Contraer todo</button><button class="btn sm" onclick="arNivel('${id}',1)">Regiones</button><button class="btn sm" onclick="arNivel('${id}',2)">+ Gerentes</button><button class="btn sm" onclick="arNivel('${id}',3)">+ Supervisores</button><button class="btn sm" onclick="arNivel('${id}',4)">Todo abierto</button></div>`;
  const cab = `<thead><tr><th class="t">${esc(o.titulo || 'REGIÓN / GERENTE / SUPERVISOR / TIENDA')}</th>${cols.map(c => `<th>${c.h}</th>`).join('')}</tr></thead>`;
  const tot = `<tr class="tt"><td class="t">Total general</td>${cols.map(c => `<td>${val(c.f(items), { ...c, cero: true })}</td>`).join('')}</tr>`;
  const body = items.length ? nodo(items, 0) : `<tr><td class="t" colspan="${N + 1}">Sin datos</td></tr>`;
  setTimeout(() => { const t = $(id); if (t) arRef(t); }, 0);
  return `${o.sinCtl ? '' : ctl}<div class="tw xlw"><table class="xl" id="${id}">${cab}<tbody>${body}${tot}</tbody></table></div>`;
}

/* >>> 02b_filtros.js */
/* ====================================================================== BARRA GLOBAL DE FILTROS Y PERIODO (igual que Avance GB) ======================================================================
   Una sola barra para todas las secciones: periodo (solo en reportes), etiquetas de lo filtrado, filtros de sección (Cadena, Posc., Class, Resurtible, Tienda · IDPDV)
   y filtros de estructura (Región, Sub_GB, Gerente, Supervisor, Sub_Terr, Líder, Gerencia RR.HH., RR.HH.) que se pueden ocultar. En escritorio el panel aparece al pasar el mouse
   o se fija con 📌; el menú lateral es una tira de iconos que se abre al pasar el mouse o se fija con «. Las preferencias usan las mismas llaves que Avance GB.
   Las opciones de cada filtro dependen de los demás (cascada). La estructura (tiendas, supervisores, class…) viene de Maestra, no de un archivo. */
const FB_SECCION = ['cadena', 'posiciones', 'clase', 'tipo_ekt', 'idpdv'], FB_ESTR = ['region', 'subdireccion_gb', 'gerente', 'supervisor', 'sub_terr', 'lider', 'zona_rrhh', 'rrhh'];
const FB_IC = { cadena: '🔗', posiciones: '👥', clase: '🏷️', tipo_ekt: '♻️', idpdv: '🏬', region: '📍', subdireccion_gb: '🏙️', gerente: '🧑‍💼', supervisor: '🧭', sub_terr: '🗺️', lider: '🧑‍💼', zona_rrhh: '🧩', rrhh: '👤' };
const fbLs = { get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } } };
const fbEtq = k => (FCAMPOS.find(c => c[0] === k) || [k, k])[1];
const fbBase = () => (S.cat && S.cat.tiendas) ? Object.values(S.cat.tiendas) : [];
const fbVista = () => (typeof VISTAS !== 'undefined' && VISTAS.find(x => x.k === S.view)) || {};
function fbOpciones(k) {   // valores posibles de k según los demás filtros activos
  const ok = t => Object.entries(FL).every(([kk, v]) => kk === k || !v || String(t[kk]) === String(v));
  const xs = fbBase().filter(ok);
  if (k === 'idpdv') return xs.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es')).map(t => [String(t.idpdv), `${t.idpdv} — ${t.nombre}`]);
  const vs = [...new Set(xs.map(t => t[k]).filter(v => v !== null && v !== undefined && v !== ''))];
  vs.sort((a, b) => typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'es'));
  return vs.map(v => [String(v), String(v)]);
}
function fbSet(k, v) {
  FL[k] = v;
  FB_SECCION.concat(FB_ESTR).forEach(kk => { if (kk !== k && FL[kk] && !fbOpciones(kk).some(([x]) => x === String(FL[kk]))) FL[kk] = ''; });   // un filtro que ya no existe en la cascada se quita
  render();
}
function fbLimpiar() { Object.keys(FL).forEach(k => FL[k] = ''); render(); }
function fbCampo(k) {
  const ic = `<span class="fb-ic">${FB_IC[k]}</span>`;
  if (k === 'idpdv') {
    const sel = FL.idpdv ? (S.cat.tiendas[FL.idpdv] || {}) : null;
    return `<div class="fb-field fb-tienda ${FL.idpdv ? 'on tiene' : ''}"><label>${ic}Tienda · IDPDV</label><input class="ta-in" id="fb-ta" autocomplete="off" aria-label="Tienda o IDPDV" placeholder="Escribe IDPDV o nombre…" value="${esc(sel ? sel.idpdv + ' — ' + sel.nombre : '')}"><span class="ta-x" onclick="fbSet('idpdv','')" title="Quitar tienda">×</span><div class="ta-list" id="fb-ta-l" role="listbox"></div></div>`;
  }
  const ops = fbOpciones(k);
  return `<div class="fb-field ${FL[k] ? 'on' : ''}"><label>${ic}${esc(fbEtq(k))}</label><select aria-label="${esc(fbEtq(k))}" onchange="fbSet('${k}',this.value)"><option value="">${k === 'posiciones' || k === 'clase' || k === 'cadena' || k === 'region' || k === 'subdireccion_gb' ? 'Todas' : 'Todos'}</option>${ops.map(([v, t]) => `<option value="${esc(v)}" ${String(FL[k]) === v ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>`;
}
function fbTienda() {   // lista que se despliega conforme se escribe
  const inp = $('fb-ta'), lista = $('fb-ta-l'); if (!inp) return;
  let sug = [], pos = -1;
  const pintar = () => {
    const q = norm(inp.value.trim()), todas = fbOpciones('idpdv');
    sug = (q && !FL.idpdv ? todas.filter(([, t]) => norm(t).includes(q)) : todas).slice(0, 14);
    lista.innerHTML = sug.length ? sug.map(([v, t], i) => { const [id, ...r] = t.split(' — '); return `<div data-v="${esc(v)}" class="${i === pos ? 'sel' : ''}"><small>${esc(id)}</small>${esc(r.join(' — '))}</div>`; }).join('') + (todas.length > 14 && !q ? '<div class="vacio">Sigue escribiendo para ver más…</div>' : '') : '<div class="vacio">Sin coincidencias</div>';
    lista.classList.add('on');
  };
  inp.addEventListener('input', () => { if (FL.idpdv) { FL.idpdv = ''; } pos = -1; pintar(); });
  inp.addEventListener('focus', () => { if (FL.idpdv) inp.select(); pintar(); });
  inp.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { pos = Math.min(sug.length - 1, pos + 1); pintar(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { pos = Math.max(0, pos - 1); pintar(); e.preventDefault(); }
    else if (e.key === 'Enter') { const o = sug[pos >= 0 ? pos : 0]; if (o) fbSet('idpdv', o[0]); e.preventDefault(); }
    else if (e.key === 'Escape') { lista.classList.remove('on'); inp.blur(); }
  });
  inp.addEventListener('blur', () => setTimeout(() => lista.classList.remove('on'), 150));
  lista.addEventListener('mousedown', e => { const d = e.target.closest('[data-v]'); if (d) { e.preventDefault(); fbSet('idpdv', d.dataset.v); } });
}
function fbChips() {
  const act = FCAMPOS.filter(([k]) => FL[k]);
  const txt = k => k === 'idpdv' ? ((S.cat.tiendas[FL.idpdv] || {}).nombre || FL.idpdv) : FL[k];
  $('fb-chips').innerHTML = act.map(([k, l]) => `<span class="chip">${esc(l)}: ${esc(txt(k))}<button class="chip-x" type="button" aria-label="Quitar ${esc(l)}" onclick="fbSet('${k}','')">×</button></span>`).join('');
  $('fb-summary').textContent = act.length ? act.map(([k]) => txt(k)).join(' · ') : 'Sin filtros';
}

/* ---------- periodo libre (secciones que trabajan con fechas futuras, como Posibles ingresos): hoy, mañana, semana, mes, rango o todo ---------- */
const PL = { modo: 'sem', sem: 0, mes: '', desde: '', hasta: '' };
const lunesDe = d => { const x = new Date(d + 'T12:00:00'); return addD(d, -((x.getDay() + 6) % 7)); };
function rangoLibre() {
  if (PL.modo === 'hoy') return { desde: HOY, hasta: HOY, txt: 'Hoy' };
  if (PL.modo === 'man') return { desde: addD(HOY, 1), hasta: addD(HOY, 1), txt: 'Mañana' };
  if (PL.modo === 'sem') { const l = addD(lunesDe(HOY), 7 * PL.sem); return { desde: l, hasta: addD(l, 6), txt: 'Semana' }; }
  if (PL.modo === 'mes') { const m = PL.mes || HOY.slice(0, 7), n = new Date(m + '-01T12:00:00'); n.setMonth(n.getMonth() + 1); n.setDate(0); return { desde: m + '-01', hasta: n.getFullYear() + '-' + pad(n.getMonth() + 1) + '-' + pad(n.getDate()), txt: 'Mes' }; }
  if (PL.modo === 'todo') return { desde: '2020-01-01', hasta: addD(HOY, 120), txt: 'Todo', todo: true };
  const d = PL.desde || HOY, h = PL.hasta || d; return { desde: d <= h ? d : h, hasta: d <= h ? h : d, txt: 'Rango' };
}
function periodoLibreHTML() {
  const r = rangoLibre(), modos = [['hoy', '☀️ Hoy'], ['man', '🌅 Mañana'], ['sem', '📅 Semana'], ['mes', '🗓️ Mes'], ['rango', '↔️ Rango'], ['todo', '📊 Todo']];
  let ctl = '';
  if (PL.modo === 'sem') { const opts = []; for (let k = -12; k <= 4; k++) { const l = addD(lunesDe(HOY), 7 * k); opts.push(`<option value="${k}" ${k === PL.sem ? 'selected' : ''}>${fdate(l)} al ${fdate(addD(l, 6))}${k === 0 ? ' (esta semana)' : k === 1 ? ' (próxima)' : ''}</option>`); } ctl = `<select onchange="PL.sem=+this.value;render()">${opts.join('')}</select>`; }
  else if (PL.modo === 'mes') { const o = [], m0 = new Date(HOY.slice(0, 7) + '-01T12:00:00'); for (let k = -12; k <= 2; k++) { const d = new Date(m0); d.setMonth(d.getMonth() + k); const m = d.getFullYear() + '-' + pad(d.getMonth() + 1); o.push(`<option value="${m}" ${(PL.mes || HOY.slice(0, 7)) === m ? 'selected' : ''}>${mlabel(m)}${m === HOY.slice(0, 7) ? ' (en curso)' : ''}</option>`); } ctl = `<select onchange="PL.mes=this.value;render()">${o.join('')}</select>`; }
  else if (PL.modo === 'rango') ctl = `<input type="date" value="${r.desde}" onchange="PL.desde=this.value;if(!PL.hasta||PL.hasta<PL.desde)PL.hasta=PL.desde;render()"> <span>a</span> <input type="date" value="${r.hasta}" onchange="PL.hasta=this.value;if(!PL.desde)PL.desde=PL.hasta;render()">`;
  return `<div class="pb-seg">${modos.map(([k, n]) => `<button class="${PL.modo === k ? 'on' : ''}" onclick="PL.modo='${k}';if('${k}'==='rango'&&!PL.desde){PL.desde=HOY;PL.hasta=HOY}render()">${n}</button>`).join('')}</div>${ctl}<span class="pb-info">${r.todo ? 'Todo el histórico cargado' : r.desde === r.hasta ? fdate(r.desde) : fdate(r.desde) + ' al ' + fdate(r.hasta)}</span>`;
}

function fbPintar() {
  if (!S.cat || !$('filterbar')) return;
  const v = fbVista(), sinFb = !!v.sinFiltros;
  document.body.classList.toggle('sin-fb', sinFb); if (sinFb) return;
  const gen = (typeof R !== 'undefined' && R.meta && R.meta.generado) ? R.meta.generado : (S.gen || '');
  $('fb-act').textContent = gen ? '🕒 Actualizado: ' + gen : '';
  $('pbar').innerHTML = v.per === 'libre' ? periodoLibreHTML() : v.per && typeof R !== 'undefined' && R.loaded && R.meta ? periodoHTML('render', { dia: v.per === 'dia' }) : '';
  const abierta = !$('fb-row').classList.contains('est-cerrada');
  $('fb-row').innerHTML = `<div class="fb-line"><div class="fb-left">${FB_SECCION.map(fbCampo).join('')}<div class="fb-field fb-clear-wrap"><label>&nbsp;</label><button id="fb-clear" type="button" title="Quitar todos los filtros" onclick="fbLimpiar()"><span>✕</span> Quitar filtros</button></div></div>
    <div class="fb-right"><button id="fb-est-toggle" type="button" class="btn" title="Mostrar u ocultar los filtros de estructura" onclick="fbEstructura()">Estructura ${abierta ? '▾' : '▸'}</button><div class="fb-est">${FB_ESTR.map(fbCampo).join('')}</div></div></div>`;
  fbTienda(); fbChips();
}
function fbEstructura() { const r = $('fb-row'); r.classList.toggle('est-cerrada'); fbLs.set('gb_fb_est_cerrada', r.classList.contains('est-cerrada') ? '1' : '0'); $('fb-est-toggle').textContent = 'Estructura ' + (r.classList.contains('est-cerrada') ? '▸' : '▾'); }

/* panel de filtros: aparece al pasar el mouse o se fija; menú lateral: compacto o fijo; en celular el botón Filtros abre y cierra el panel */
(function () {
  let auto = fbLs.get('gb_fb_auto', '1') === '1', rail = fbLs.get('gb_sb_rail', '1') === '1';
  if (fbLs.get('gb_fb_est_cerrada', '0') === '1') $('fb-row').classList.add('est-cerrada');
  const pin = $('fb-pin'), tog = $('fb-toggle'), sbPin = $('sb-pin'), desk = () => window.matchMedia('(min-width:861px)').matches;
  function panel() {
    const modoAuto = auto && desk();
    document.body.classList.toggle('fb-auto', modoAuto); if (!modoAuto) document.body.classList.remove('fb-abierto');
    pin.textContent = auto ? '📌 Fijar filtros' : '📌 Filtros fijos'; pin.classList.toggle('on', !auto);
  }
  function menu() { document.body.classList.toggle('sb-rail', rail); sbPin.textContent = rail ? '»' : '«'; sbPin.title = rail ? 'Fijar el menú abierto' : 'Dejar el menú compacto (se abre al pasar el mouse)'; }
  pin.addEventListener('click', () => { auto = !auto; fbLs.set('gb_fb_auto', auto ? '1' : '0'); panel(); });
  tog.addEventListener('click', () => { if (desk()) document.body.classList.toggle('fb-abierto'); else { const o = $('filterbar').classList.toggle('fb-open'); tog.textContent = o ? '▲ Ocultar filtros' : '🔎 Filtros'; } });
  sbPin.addEventListener('click', e => { e.stopPropagation(); rail = !rail; fbLs.set('gb_sb_rail', rail ? '1' : '0'); menu(); });
  window.addEventListener('resize', panel); panel(); menu();
})();

Real.generado = async function () { const { data } = await sb.from('rep_meta').select('valor').eq('clave', 'ventana').maybeSingle(); return data && data.valor ? data.valor.generado : ''; };
Demo.generado = async () => 'datos de ejemplo';

/* >>> 03_reportes.js */
/* ====================================================================== REPORTES: RESUMEN · PENALIZACIÓN · DETALLE DE CHECKS · HC ====================================================================== */
const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const EST_COB = ['Cubierta', 'Descubierta', 'Vacante'], COBC = [C.gr, C.am, C.rd];
const EST_PEN = ['Cubierto', 'Riesgo Penalización', 'Penalizado'];
const LOGO = { Coppel: 'logo_coppel_clean', Elektra: 'logo_elektra_clean', Suburbia: 'logo_suburbia_clean', Cimaco: 'logo_cimaco_clean' };
const logoCad = c => LOGO[c] ? `<img class="cadena-logo" src="${img(LOGO[c])}" alt="${esc(c)}">` : `<b style="min-width:70px;font-size:12px">${esc(c)}</b>`;

/* ----- carga ----- */
const R = { loaded: false, T: [], hc: [], uc: {}, bajasLive: new Map(), solo: true, rach: 'todas', est: '', estA: '', estC: '', cadenaPen: true };
Real.reporte = async function () {
  const [m, t, h, u, bj] = await Promise.all([sb.from('rep_meta').select('valor').eq('clave', 'ventana').maybeSingle(), todo(() => sb.from('rep_tienda').select('*')), todo(() => sb.from('rep_hc').select('*')), todo(() => sb.from('rep_ultimo_check').select('*')),
    todo(() => sb.from('bajas').select('usuario_fieldwy,fecha_baja').is('anulada_en', null).gte('fecha_baja', addD(HOY, -200)))]);
  if (!m.data) throw new Error('Todavía no hay reportes publicados. Corre publicar_reporte.py.');
  return { meta: m.data.valor, tiendas: t, hc: h, uc: u, bajas: bj };
};
const CHK_COLS = '*';
Real.checks = function (desde, hasta) { return todo(() => sb.from('rep_checks').select(CHK_COLS).gte('fecha', desde).lte('fecha', hasta).order('fecha').order('hora_in')); };
async function cargarReporte() {
  if (R.loaded) return;
  const d = await API.reporte();
  R.meta = d.meta; R.hc = d.hc; R.uc = Object.fromEntries(d.uc.map(x => [x.usuario, x])); R.bajasLive = new Map(d.bajas.map(b => [b.usuario_fieldwy, b.fecha_baja]));
  R.T = d.tiendas.map(r => ({ id: r.idpdv, t: tienda(r.idpdv) || { nombre: 'IDPDV ' + r.idpdv, cadena: '', estado: '', region: '', gerente: '', supervisor: '', rrhh: '', zona_rrhh: '', posiciones: 0 }, sem: r.semanas || [], chk: (r.chk && r.chk.s) || [], cd: (r.chk && r.chk.cd) || '', dias: r.dias || '', hc: r.hc_sem || [], pen: r.pen || [] }));
  R.loaded = true; if (typeof fbPintar === 'function') fbPintar();
}
const cargando = (t, m) => { $('content').innerHTML = cab(t, 'Cargando…', m); };
async function conReporte(titulo, mascota, fn) {
  try { cargando(titulo, mascota); await cargarReporte(); await fn(); } catch (e) { console.error(e); $('content').innerHTML = cab(titulo, '', mascota) + `<div class="card empty"><img src="${img('guino')}" alt="">${esc(e.message || e)}</div>`; }
}
const xsF = () => R.T.filter(x => okT(x.t));

/* ----- movimientos (ingresos reales por candidatos + bajas) para rotación ----- */
const MV = { loaded: false, ing: [], baj: [], reing: [], vinc: {}, revisar: 0 };
Real.movs = async function () {
  const desde = addD(HOY, -125);
  const [i, b] = await Promise.all([todo(() => sb.from('candidatos').select('id,fecha_programada,idpdv,reclutador_id,fuente_id,usuario_fieldwy').eq('estatus', 'Ingresó').gte('fecha_programada', desde)), todo(() => sb.from('bajas').select('usuario_fieldwy,fecha_baja,idpdv,motivo').is('anulada_en', null).gte('fecha_baja', desde))]);
  // del historial laboral (opcional: si falla, el reporte sigue igual): reingresos, usuarios vinculados como una misma persona y cuántos periodos están por revisar
  let reing = [], vinc = {}, revisar = 0;
  try { reing = (await todo(() => sb.from('v_eventos_laborales').select('fecha,idpdv,usuario_fieldwy,persona').eq('evento', 'Reingreso').gte('fecha', desde))).map(x => ({ f: x.fecha, idpdv: x.idpdv, u: x.usuario_fieldwy })); } catch (e) { }
  try { (await todo(() => sb.from('vinculos_usuario').select('usuario_a,usuario_b'))).forEach(x => { vinc[x.usuario_b] = x.usuario_a; }); } catch (e) { }
  try { const r = await sb.from('relaciones_laborales').select('id', { count: 'exact', head: true }).eq('calidad', 'revisar'); revisar = r.count || 0; } catch (e) { }
  return { ing: i.map(x => ({ f: x.fecha_programada, idpdv: x.idpdv, rec: x.reclutador_id, fu: x.fuente_id, u: x.usuario_fieldwy })), baj: b.map(x => ({ f: x.fecha_baja, idpdv: x.idpdv, mot: x.motivo, u: x.usuario_fieldwy })), reing, vinc, revisar };
};
async function cargarMovs(force) { if (MV.loaded && !force) return; const d = await API.movs(); MV.ing = d.ing; MV.baj = d.baj; MV.reing = d.reing || []; MV.vinc = d.vinc || {}; MV.revisar = d.revisar || 0; MV.loaded = true; }
function hcProm(r) { // promedio de promotores con check por semana dentro del periodo (estructura filtrada)
  const sa = R.meta.semanas_anio, xs = xsF(); let tot = [], n = 0;
  sa.forEach((s, i) => { const fin = addD(s.ini, 6); if (fin < r.desde || s.ini > r.hasta) return; tot.push(xs.reduce((a, x) => a + (x.hc[i] || 0), 0)); });
  return tot.length ? tot.reduce((a, b) => a + b, 0) / tot.length : 0;
}
function hcPromX(r, pred) {
  const sa = R.meta.semanas_anio, xs = R.T.filter(x => okT(x.t) && pred(x.t)), tot = [];
  sa.forEach((s, i) => { const fin = addD(s.ini, 6); if (fin < r.desde || s.ini > r.hasta) return; tot.push(xs.reduce((a, x) => a + (x.hc[i] || 0), 0)); });
  return tot.length ? tot.reduce((a, b) => a + b, 0) / tot.length : 0;
}
function rotPeriodo(r) {
  const ing = MV.ing.filter(x => x.f >= r.desde && x.f <= r.hasta && okI(x.idpdv)).length, baj = MV.baj.filter(x => x.f >= r.desde && x.f <= r.hasta && okI(x.idpdv)).length, hc = hcProm(r);
  return { ing, baj, hc, rot: hc ? baj / hc * 100 : null };
}

/* ----- medidas de cobertura (misma lógica de Avance GB / medidas DAX) ----- */
const posc = t => t.posiciones || 1;
const dimPdv = ts => ts.reduce((a, t) => a + (posc(t) === 1 ? 6 / 7 : 1), 0);
const dimProm = ts => ts.reduce((a, t) => a + posc(t) * 6 / 7, 0);
const cdv = (x, d) => { const k = diffD(d, R.meta.cd_desde); const ch = x.cd[k]; return ch == null ? 0 : parseInt(ch, 36); };
function medidas(xs, dias) {
  const ts = xs.filter(x => (x.t.posiciones || 0) > 0), T = ts.map(z => z.t), nD = Math.max(1, dias.length);
  let cubSum = 0, chk = 0; ts.forEach(x => dias.forEach(d => { const c = cdv(x, d); if (c > 0) cubSum++; chk += c; }));
  const dP = dimPdv(T), dM = dimProm(T), pP = cubSum / nD, pM = chk / nD, cuota = T.reduce((a, t) => a + 6 * posc(t), 0) * nD / 7;
  return { n: ts.length, posc: T.reduce((a, t) => a + posc(t), 0), dP, pP, pctP: dP ? Math.min(pP / dP * 100, 100) : null, difP: pP - dP, dM, pM, pctM: dM ? Math.min(pM / dM * 100, 100) : null, difM: pM - dM, chk, nD, cuota, pctC: cuota ? Math.min(chk / cuota * 100, 100) : null, exc: Math.max(0, chk - cuota) };
}
function medTienda(x, dias, last) {
  const ps = posc(x.t), nD = Math.max(1, dias.length); let dc = 0, chk = 0; dias.forEach(d => { const c = cdv(x, d); if (c > 0) dc++; chk += c; });
  const cuota = 6 * ps * nD / 7, dimC = ps === 1 ? 6 / 7 : 1, dimA = ps * 6 / 7, promC = dc / nD, promA = chk / nD;
  let ult = null; const fin = diffD(dias[dias.length - 1], R.meta.cd_desde); for (let k = Math.min(fin, x.cd.length - 1); k >= 0; k--) if (x.cd[k] !== '0') { ult = addD(R.meta.cd_desde, k); break; }
  return { ps, chk, cuota, pctCh: Math.min(chk / cuota * 100, 100), falt: Math.max(0, cuota - chk), adic: Math.max(0, chk - cuota), dimA, promA, pctA: Math.min(promA / dimA * 100, 100), difA: promA - dimA, dimC, promC, pctC: Math.min(promC / dimC * 100, 100), difC: promC - dimC, ult };
}
function estatusTienda(x, dias) {
  const last2 = dias.slice(-2).reverse(), ps = posc(x.t), r = last2.length ? cdv(x, last2[0]) : 0, a = last2.length > 1 ? cdv(x, last2[1]) : null; let cob;
  if (a == null) cob = r > 0 ? 'Cubierta' : 'Descubierta'; else cob = r > 0 && a > 0 ? 'Cubierta' : r === 0 && a === 0 ? 'Vacante' : 'Descubierta';
  const A = a || 0; let asi;
  if (ps <= 1) asi = cob; else if (a == null) asi = r >= ps ? 'Cubierta' : r > 0 ? 'Posc Desc' : 'Descubierta';
  else if (r > ps && A > ps) asi = 'Posc Adic'; else if (r >= ps && A >= ps) asi = 'Cubierta'; else if (r === 0 && A === 0) asi = 'Vacante';
  else if (r < ps && r > 0 && A < ps && A > 0) asi = 'Posc Faltante'; else if ((r < ps && r > 0) || (A < ps && A > 0)) asi = 'Posc Desc'; else if (r === 0 || A === 0) asi = 'Descubierta'; else asi = 'Sin Definir';
  return { cob, asi };
}
const ASIC = { 'Cubierta': 'g', 'Posc Adic': 'g', 'Posc Desc': 'a', 'Descubierta': 'a', 'Posc Faltante': 'r', 'Vacante': 'r', 'Sin Definir': 'x' };
const ASIE = { 'Cubierta': '🟢', 'Posc Adic': '🔵', 'Posc Desc': '🟠', 'Descubierta': '🟠', 'Posc Faltante': '🔴', 'Vacante': '🔴', 'Sin Definir': '⚪' };
const colPct = p => p == null ? '' : p >= 90 ? 'ok' : p >= 75 ? 'wa' : 'ko';

/* riesgo de sobredimensionar: checks de la semana contra el tope pagado por Telefónica (6 fijos + 3 adicionales por posición). sem = [estatus, checks, cuota, tope, faltantes, no válidos, proyección, exceso, último] */
function sobredim(x, wi) {
  const sd = wi == null ? null : x.sem[wi]; if (!sd) return { tope: null, chk: null, proy: null, exc: 0, nivel: 0 };
  const tope = sd[3], chk = sd[1], proy = sd[6], exc = Math.max(0, proy - tope);
  return { tope, chk, proy, exc, nivel: chk > tope ? 2 : exc > 0.05 ? 1 : 0 };   // 2 = ya se pasó del tope, 1 = a este ritmo se pasa
}
/* ====================================================================== 1 · RESUMEN ====================================================================== */
async function vResumen() {
  await conReporte('Resumen', 'pulgares', async () => {
    await cargarMovs();
    const r = perRango(), dias = r.dias, xs = xsF(), cur = medidas(xs, dias), sems = semanasUlt4(r), S4 = sems.map(w => medidas(xs, w.dias)), prev = S4.length > 1 ? S4[S4.length - 2] : null;
    const rot = rotPeriodo(r);
    const wi = sems.length ? sems[sems.length - 1].i : null, sdm = new Map(xs.map(x => [x.id, sobredim(x, wi)])), nSobre = [...sdm.values()].filter(z => z.nivel > 0).length;
    let h = cab('Resumen', 'Cobertura de PDV, asistencia de promotores y checks contra cuota (misma lógica de Avance GB), más rotación del periodo. Todo responde a los filtros de estructura y al periodo elegido.', 'pulgares') + barraFiltros('vResumen') + barraPeriodo('vResumen');
    h += `<div class="kpis kp-hero">${kp('% Cobertura PDV', cur.pctP == null ? '—' : f1(cur.pctP) + '%', `${fmt1(cur.pP)} tiendas/día vs ${fmt1(cur.dP)} dimensionadas<br>${dl(cur.pctP, prev && prev.pctP)}`, colorPct(cur.pctP), null, '🏬')}
      ${kp('% Asistencia Promotor', cur.pctM == null ? '—' : f1(cur.pctM) + '%', `${fmt1(cur.pM)} promotores/día vs ${fmt1(cur.dM)} dimensionados<br>${dl(cur.pctM, prev && prev.pctM)}`, colorPct(cur.pctM), null, '🧍')}
      ${kp('% Checks vs cuota', cur.pctC == null ? '—' : f1(cur.pctC) + '%', `${fmt(cur.chk)} checks vs cuota ${fmt(cur.cuota)} (6 por posición por semana)<br>${dl(cur.pctC, prev && prev.pctC)}`, colorPct(cur.pctC), null, '✅')}
      ${kp('Rotación del periodo', rot.rot == null ? '—' : f1(rot.rot) + '%', `${rot.baj} bajas ÷ ${fmt(rot.hc)} HC promedio<br>${rot.ing} ingresos · neto ${rot.ing - rot.baj >= 0 ? '+' : ''}${rot.ing - rot.baj}`, C.am, null, '🔄')}</div>`;
    h += `<div class="grid g3">${embudo('🏬 Cobertura PDV', [{ n: "Total PDV's", v: cur.n, c: C.bl }, { n: 'Dimensionamiento', v: cur.dP, c: '#3D6FB6' }, { n: 'Cubiertos (prom. diario)', v: cur.pP, c: C.gr }, { n: 'Descubiertos', v: Math.max(0, -cur.difP), c: C.rd }])}
      ${embudo('🧍 Asistencia Promotor', [{ n: 'Posiciones autorizadas', v: cur.posc, c: C.bl }, { n: 'Dimensionamiento', v: cur.dM, c: '#3D6FB6' }, { n: 'Asistieron (prom. diario)', v: cur.pM, c: C.gr }, { n: 'Sin asistir', v: Math.max(0, -cur.difM), c: C.rd }])}
      ${embudo('✅ Checks vs cuota', [{ n: 'Cuota de checks (periodo)', v: cur.cuota, c: C.bl }, { n: 'Checks válidos', v: cur.chk, c: C.gr }, { n: 'Faltantes', v: Math.max(0, cur.cuota - cur.chk), c: C.rd }, { n: 'Adicionales', v: cur.exc, c: C.am }])}</div>`;
    const cads = [...new Set(xs.map(x => x.t.cadena).filter(Boolean))];
    const cadRows = cads.map(c => { const m = medidas(xs.filter(y => y.t.cadena === c), dias); return { c, n: m.n, p: m.pctP, a: m.pctM }; }).filter(q => q.n).sort((a, b) => b.n - a.n);
    const st = xs.filter(x => (x.t.posiciones || 0) > 0).map(x => ({ x, s: estatusTienda(x, dias) })), ce = { Cubierta: 0, Descubierta: 0, Vacante: 0 }; st.forEach(z => ce[z.s.cob]++);
    h += `<div class="grid g2"><div class="card"><h3>🏪 Cobertura por cadena</h3><p class="note">% Cobertura PDV (barra) y % Asistencia Promotor.</p>${cadRows.map(q => `<div class="cadena-row">${logoCad(q.c)}<div class="cadena-track"><i style="width:${q.p || 0}%;background:${colorPct(q.p)}"></i></div><b class="cadena-val" style="color:${colorPct(q.p)}">${f1(q.p)}%</b><span class="muted" style="min-width:96px;text-align:right">asist. ${f1(q.a)}%</span></div>`).join('')}</div>
      <div class="card"><h3>🚦 Estatus de tiendas (últimos 2 días)</h3><p class="note">Cubierta: check los 2 días · Descubierta: falta 1 día · Vacante: 2 días sin check.</p>${donut(['Cubierta', 'Descubierta', 'Vacante'].map((n, k) => ({ n, v: ce[n], c: COBC[k] })), { sub: 'tiendas' })}</div></div>`;
    const labs = sems.map(w => w.w.slice(3));
    const est4 = sems.map(w => { const e = { Cubierta: 0, Descubierta: 0, Vacante: 0 }; xs.filter(x => (x.t.posiciones || 0) > 0).forEach(x => e[estatusTienda(x, w.dias).cob]++); return e; });
    const rotS = sems.map(w => { const hcS = hcPromX({ desde: w.desde, hasta: w.hasta }, () => true); const b = MV.baj.filter(x => x.f >= w.desde && x.f <= w.hasta && okI(x.idpdv)).length; return hcS ? b / hcS * 100 : null; });
    h += `<div class="grid g2"><div class="card"><h3>📈 Tiendas cubiertas, descubiertas y vacantes · últimas 4 semanas</h3><p class="note">Estatus de cada tienda al cierre de la semana (últimos 2 días con datos). La línea es el % de tiendas cubiertas.</p>${legend([['Cubiertas', C.gr], ['Descubiertas', C.am], ['Vacantes', C.rd], ['% cubiertas', C.dk]])}${chart(labs, [{ n: 'Cubiertas', c: C.gr, v: est4.map(e => e.Cubierta) }, { n: 'Descubiertas', c: C.am, v: est4.map(e => e.Descubierta) }, { n: 'Vacantes', c: C.rd, v: est4.map(e => e.Vacante) }], { bars: 1, stack: 1, vals: 1, h: 320, band: 1, lines2: [{ n: '% cubiertas', c: C.dk, v: est4.map(e => pn(e.Cubierta, e.Cubierta + e.Descubierta + e.Vacante)) }], y2: { pct: 1 } })}</div>
      <div class="card"><h3>🔄 Ingresos, bajas y rotación · últimas 4 semanas</h3><p class="note">Rotación del periodo: <b>${rot.rot == null ? '—' : f1(rot.rot) + '%'}</b> (${rot.baj} bajas ÷ ${fmt(rot.hc)} HC promedio). Línea: rotación semanal con su tendencia.</p>${legend([['Ingresos', C.gr], ['Bajas', C.rd], ['Rotación %', C.od], ['Tendencia', C.dk]])}${chart(labs, [{ n: 'Ingresos', c: C.gr, v: sems.map(w => MV.ing.filter(x => x.f >= w.desde && x.f <= w.hasta && okI(x.idpdv)).length) }, { n: 'Bajas', c: C.rd, v: sems.map(w => MV.baj.filter(x => x.f >= w.desde && x.f <= w.hasta && okI(x.idpdv)).length) }], { bars: 1, vals: 1, h: 320, band: 1, lines2: [{ n: 'Rotación %', c: C.od, v: rotS, trend: 1 }], y2: { pct: 1 } })}</div></div>`;
    h += sect('Tiendas: medición de checks, asistencia y cobertura', '🧾') + `<p class="note">Periodo ${fdate(r.desde)} – ${fdate(r.hasta)}. Mueve la tabla a los lados o hacia abajo: encabezados e IDPDV/tienda se quedan fijos.</p>`;
    h += `<div class="tools" data-nocap><span>Estatus cobertura:</span><select onchange="R.estC=this.value;vResumen()"><option value="">Todos</option>${['Cubierta', 'Descubierta', 'Vacante'].map(e => `<option ${R.estC === e ? 'selected' : ''}>${e} (${ce[e]})</option>`).join('')}</select><span>Estatus asistencia:</span><select onchange="R.estA=this.value;vResumen()"><option value="">Todos</option>${['Cubierta', 'Posc Adic', 'Posc Desc', 'Descubierta', 'Posc Faltante', 'Vacante'].map(e => `<option ${R.estA === e ? 'selected' : ''}>${e}</option>`).join('')}</select><span>Dimensionamiento:</span><select onchange="R.dimz=this.value;vResumen()"><option value="">Todas</option><option value="1" ${R.dimz ? 'selected' : ''}>⚖️ Riesgo de sobredimensionar (${nSobre})</option></select></div>`;
    const rows = st.filter(z => (!R.estC || R.estC.startsWith(z.s.cob + ' (') || R.estC === z.s.cob) && (!R.estA || R.estA === z.s.asi) && (!R.dimz || sdm.get(z.x.id).nivel > 0)).map(({ x, s }) => ({ ...x, s, m: medTienda(x, dias), pe: penActual(x), sb: sdm.get(x.id) }));
    TB = {};
    const cs = [{ h: 'IDPDV', v: q => q.id, w: 86 }, { h: 'Nombre PDV', t: 1, v: q => q.t.nombre, w: 230, r: q => `<b>${esc(q.t.nombre)}</b>` },
      { h: 'Cadena', t: 1, v: q => q.t.cadena, r: q => `${esc(q.t.cadena)}` }, { h: 'Estado', t: 1, v: q => q.t.estado }, { h: 'Supervisor', t: 1, v: q => q.t.supervisor }, { h: 'Gerente / Líder', t: 1, v: q => q.t.gerente }, { h: 'Posc.', v: q => q.m.ps },
      { h: 'Checks válidos', v: q => q.m.chk, hc: 'hy' }, { h: 'Cuota checks', v: q => q.m.cuota, r: q => fmt1(q.m.cuota), hc: 'hy' }, { h: '% Cobertura checks', v: q => q.m.pctCh, r: q => `<span class="bar-pct ${colPct(q.m.pctCh)}">${f1(q.m.pctCh)}%</span>`, hc: 'hy' }, { h: 'Checks faltantes', v: q => q.m.falt, r: q => q.m.falt ? `<span class="cell-red">${fmt1(q.m.falt)}</span>` : '0', hc: 'hy' }, { h: 'Checks adicionales', v: q => q.m.adic, r: q => q.m.adic ? `<span class="cell-green">+${fmt1(q.m.adic)}</span>` : '0', hc: 'hy' },
      { h: 'Dimens. promotor', v: q => q.m.dimA, r: q => f1(q.m.dimA), hc: 'hg' }, { h: 'Prom. promotor/día', v: q => q.m.promA, r: q => f1(q.m.promA), hc: 'hg' }, { h: '% Asistencia', v: q => q.m.pctA, r: q => `<span class="bar-pct ${colPct(q.m.pctA)}">${f1(q.m.pctA)}%</span>`, hc: 'hg' }, { h: 'Dif. asistencia', v: q => q.m.difA, r: q => `<span class="${q.m.difA < -0.05 ? 'cell-red' : 'cell-green'}">${q.m.difA > 0 ? '+' : ''}${f1(q.m.difA)}</span>`, hc: 'hg' },
      { h: 'Dimens. PDV', v: q => q.m.dimC, r: q => f1(q.m.dimC), hc: 'hd' }, { h: 'Prom. cobertura/día', v: q => q.m.promC, r: q => f1(q.m.promC), hc: 'hd' }, { h: '% Cobertura real', v: q => q.m.pctC, r: q => `<span class="bar-pct ${colPct(q.m.pctC)}">${f1(q.m.pctC)}%</span>`, hc: 'hd' }, { h: 'Dif. cobertura', v: q => q.m.difC, r: q => `<span class="${q.m.difC < -0.05 ? 'cell-red' : 'cell-green'}">${q.m.difC > 0 ? '+' : ''}${f1(q.m.difC)}</span>`, hc: 'hd' },
      { h: 'Tope checks semana', v: q => q.sb.tope, hc: 'hy' }, { h: 'Checks semana', v: q => q.sb.chk, hc: 'hy' }, { h: 'Proyección semana', v: q => q.sb.proy, r: q => q.sb.proy == null ? '—' : f1(q.sb.proy), hc: 'hy' }, { h: 'Exceso proyectado', v: q => q.sb.exc, r: q => q.sb.exc > 0.05 ? `<span class="cell-red">+${f1(q.sb.exc)}</span>` : '0', hc: 'hy' },
      { h: 'Riesgo sobredimensionar', t: 1, v: q => q.sb.nivel, r: q => q.sb.nivel === 2 ? pillx('🔴 Ya rebasó el tope', 'r') : q.sb.nivel === 1 ? pillx('🟠 En riesgo', 'a') : pillx('🟢 Sin riesgo', 'g'), hc: 'hy' },
      { h: 'Último check', v: q => q.m.ult, r: q => q.m.ult ? `${fdate(q.m.ult)}${diffD(r.hasta, q.m.ult) >= 2 ? ' <span title="2 o más días sin check">⚠️</span>' : ''}` : '—', hc: 'ho' },
      { h: 'Estatus cobertura', t: 1, v: q => q.s.cob, r: q => pillx((q.s.cob === 'Cubierta' ? '🟢 ' : q.s.cob === 'Vacante' ? '🔴 ' : '🟠 ') + q.s.cob, q.s.cob === 'Cubierta' ? 'g' : q.s.cob === 'Vacante' ? 'r' : 'a'), hc: 'hp' },
      { h: 'Estatus asistencia', t: 1, v: q => q.s.asi, r: q => pillx((ASIE[q.s.asi] || '') + ' ' + q.s.asi, ASIC[q.s.asi] || 'x'), hc: 'hp' }, { h: 'Región', t: 1, v: q => q.t.region }, { h: 'Gerencia RR.HH.', t: 1, v: q => q.t.zona_rrhh }, { h: 'RR.HH.', t: 1, v: q => q.t.rrhh }];
    const grp = [{ t: '🏪 Tienda', span: 2, cls: 'gt' }, { t: 'Estructura', span: 5, cls: 'gt' }, { t: '✅ Medición de checks', span: 5, cls: 'gy' }, { t: '🧍 Medición de asistencia promotoría', span: 4, cls: 'gg' }, { t: '🏬 Medición de cobertura', span: 4, cls: 'gd' }, { t: '⚖️ Tope pagado por Telefónica', span: 5, cls: 'gy' }, { t: '📅 Último día check', span: 1, cls: 'go' }, { t: '🚦 Estatus', span: 2, cls: 'gp' }, { t: 'Estructura', span: 3, cls: 'gt' }];
    h += tbl('t-tiendas', cs, rows, { fix: 2, groups: grp, search: 1, csv: 1, png: 1, file: 'resumen_tiendas', titulo: 'Resumen de tiendas · cobertura, asistencia y checks', sort: 18, dir: 1, maxh: '72vh', lim: 600 });
    $('content').innerHTML = h; drawAll();
  });
}
const colorPct = p => p == null ? C.gy : p >= 90 ? C.gr : p >= 75 ? C.am : C.rd;

/* ====================================================================== 2 · PENALIZACIÓN ====================================================================== */
const penActual = x => (x.pen || []).find(p => p.act) || (x.pen || []).slice(-1)[0] || null;
/* Racha = días seguidos sin cobertura DENTRO del mes. Hoy todavía se puede salvar: el día en juego (hoy) no cuenta como perdido hasta que pasa.
   Día 3 / 4 / 5 = el día de la racha en el que estamos hoy (racha confirmada hasta ayer + hoy). Penalizada = 5 o más días ya perdidos (sin contar hoy). */
const HOYE = { 'C': '✅ Check cumple', 'A': '🔵 Check abierto', 'E': '🟠 Check con error', '0': '🔴 Sin check' };
const periodoIni = (ini, fin) => `${fdate(ini)} al ${fdate(fin)}`;
function rachasConfirmadas(p, act) { // rachas del mes con sus días ya perdidos (sin contar hoy)
  return (p.rs || []).map(q => { const enCurso = act && q[2] >= HOY; const conf = q[0] - (enCurso ? 1 : 0); return { dias: conf, ini: q[1], fin: enCurso ? addD(HOY, -1) : q[2], enCurso }; }).filter(q => q.dias >= 1);
}
async function vPenal() {
  await conReporte('Penalización', 'puno', async () => {
    const meses = meses3(); if (!R.mes || !meses.includes(R.mes)) R.mes = meses[meses.length - 1];
    const act = R.mes === HOY.slice(0, 7), sel = R.T.filter(x => okT(x.t) && (!R.solo || x.t.cadena === 'Coppel'));
    const dePen = sel.map(x => ({ ...x, p: (x.pen || []).find(p => p.m === R.mes) })).filter(x => x.p);
    const enJuego = act ? dePen.filter(x => x.p.act && x.p.hoy !== 'C') : [];
    const c5 = enJuego.filter(x => x.p.ra === 4), c4 = enJuego.filter(x => x.p.ra === 3), c3 = enJuego.filter(x => x.p.ra === 2);
    const todasR = []; dePen.forEach(x => rachasConfirmadas(x.p, act).forEach(q => todasR.push({ ...x, ...q })));
    const rach3 = todasR.filter(q => q.dias >= 3).sort((a, b) => b.dias - a.dias), pen = [...todasR.filter(q => q.dias >= 5).sort((a, b) => a.ini.localeCompare(b.ini)).reduce((m, q) => m.has(q.id) ? m : m.set(q.id, q), new Map()).values()].sort((a, b) => b.dias - a.dias);   // una sola fila por tienda: su primera racha penalizada
    const penT = new Set(pen.map(q => q.id)).size;
    let h = cab('Penalización por falta de cobertura', 'Una tienda se penaliza con 5 días seguidos sin cobertura dentro del mes. Cuenta como cobertura un check dentro de rango con 420 minutos en tienda (300 los domingos con horario diferenciado); el check de un supervisor también rompe la racha. El día 5 todavía se puede salvar si hoy se cubre.', 'puno') + barraFiltros('vPenal');
    h += `<div class="tools"><span>Mes:</span><select onchange="R.mes=this.value;vPenal()">${meses.map(m => `<option value="${m}" ${m === R.mes ? 'selected' : ''}>${mlabel(m)}${m === HOY.slice(0, 7) ? ' (en curso)' : ''}</option>`).join('')}</select><button class="chip ${R.solo ? 'on' : ''}" onclick="R.solo=!R.solo;vPenal()">⭐ Solo Coppel (prioridad)</button><span class="muted">${fmt(dePen.length)} tiendas en el mes</span></div>`;
    h += `<div class="kpis">${act ? kp('Día 5 · último día', fmt(c5.length), 'si hoy no se cubre, se penaliza', c5.length ? C.rd : C.gr, null, '🔴') + kp('Día 4', fmt(c4.length), 'enviar a cubrir hoy', c4.length ? C.am : C.gr, null, '🟡') + kp('Día 3', fmt(c3.length), 'programar cobertura', C.gr, null, '🟢') : ''}${kp('Penalizadas ' + mlabel(R.mes), fmt(penT), 'tiendas con 5 o más días seguidos sin cobertura', penT ? C.rd : C.gr, null, '🚫')}${kp('Rachas de 3+ días', fmt(rach3.length), 'en el mes', C.am, null, '📜')}</div>`;
    h += `<div class="tools" data-nocap><button class="btn sm" onclick="capturaDescargar($('alertas-wrap'),'Alertas de cobertura · ${fdate(HOY)}',subFiltros(),'alertas_cobertura')">📸 Imagen de todas las alertas</button><button class="btn sm" onclick="capturaCopiar($('alertas-wrap'),'Alertas de cobertura · ${fdate(HOY)}',subFiltros())">📋 Copiar imagen</button><span class="muted">Cada día RH comparte esta imagen. Abre una tarjeta para ver sus tiendas; 📸 captura solo esa tarjeta.</span></div>`;
    h += `<div id="alertas-wrap" class="alertas2">`;
    if (act) h += tarjetaPen({ k: 'r', ic: '🔴', t: 'Día 5 · último día para salvar', sub: 'Hoy es el 5.º día sin cobertura: si no se cubre hoy, queda penalizada', rows: c5.map(x => ({ ...x, per: periodoIni(addD(HOY, -4), addD(HOY, -1)) })), racha: false, abrir: true }) +
      tarjetaPen({ k: 'a', ic: '🟡', t: 'Día 4', sub: 'Hoy es el 4.º día sin cobertura · enviar a cubrir hoy', rows: c4.map(x => ({ ...x, per: periodoIni(addD(HOY, -3), addD(HOY, -1)) })), racha: false }) +
      tarjetaPen({ k: 'g', ic: '🟢', t: 'Día 3', sub: 'Hoy es el 3.er día sin cobertura · todavía hay margen', rows: c3.map(x => ({ ...x, per: periodoIni(addD(HOY, -2), addD(HOY, -1)) })), racha: false });
    h += tarjetaPen({ k: 'neutro', ic: '📜', t: 'Mayores rachas del mes', sub: 'Rachas de 3 o más días consecutivos en el mes (cerradas o en curso)', rows: rach3.map(q => ({ ...q, per: periodoIni(q.ini, q.fin) + (q.enCurso ? ' · en curso' : '') })), racha: true }) +
      tarjetaPen({ k: 'r', ic: '🚫', t: 'Penalizadas', sub: 'Una fila por tienda, con su primera racha de 5 o más días sin cobertura', rows: pen.map(q => ({ ...q, per: periodoIni(q.ini, q.fin) + (q.enCurso ? ' · en curso' : '') })), racha: true }) + '</div>';
    $('content').innerHTML = h; drawAll();
  });
}
function tarjetaPen(o) {
  const lista = o.rows.slice().sort((a, b) => (b.t.cadena === 'Coppel') - (a.t.cadena === 'Coppel') || (b.dias || 0) - (a.dias || 0));
  const titulo = o.t.replace(/'/g, '');
  const body = lista.length ? `<div class="tw tw-in"><table class="dt st"><thead><tr><th class="fx" style="left:0;min-width:92px">IDPDV</th><th class="fx t" style="left:92px;min-width:250px">Tienda</th>${o.racha ? '<th>Racha</th>' : ''}<th class="t">Periodo sin checks</th>${o.racha ? '' : '<th class="t">Hoy</th>'}<th class="t">Región</th><th class="t">Gerente</th><th class="t">Supervisor</th></tr></thead><tbody>${lista.map(x => `<tr><td class="fx" style="left:0;min-width:92px"><b>${x.id}</b></td><td class="fx t" style="left:92px;min-width:250px;max-width:250px"><div class="cut" style="max-width:226px" title="${esc(x.t.nombre)}"><b>${esc(x.t.nombre)}</b></div><small class="muted">${esc(x.t.cadena)} · ${esc(x.t.estado)}</small></td>${o.racha ? `<td><span class="dchip ${x.dias >= 5 ? 'r' : x.dias >= 4 ? 'a' : 'g'}">${x.dias} d</span></td>` : ''}<td class="t">${x.per}</td>${o.racha ? '' : `<td class="t">${HOYE[x.p.hoy] || '—'}</td>`}<td class="t">${esc(x.t.region)}</td><td class="t">${esc(x.t.gerente)}</td><td class="t">${esc(x.t.supervisor)}</td></tr>`).join('')}</tbody></table></div>` : `<div class="empty-in">Sin tiendas en esta categoría 🎉</div>`;
  return `<details class="alc ${o.k}" ${o.abrir && lista.length ? 'open' : ''}><summary><span class="alc-n">${lista.length}</span><div><b>${o.ic} ${esc(o.t)}</b><small>${esc(o.sub)}</small></div><button class="btn sm cam" data-nocap onclick="event.preventDefault();event.stopPropagation();capturaDescargar(this.closest('details'),'${o.ic} ${titulo} · ${fdate(HOY)}',subFiltros(),'alerta_${o.k}')">📸</button><i>▾</i></summary><div class="alc-body">${body}</div></details>`;
}

/* ====================================================================== 3 · DETALLE DE CHECKS ====================================================================== */
const CKS = { cache: {}, vista: null, just: '', est: '', fin: '', jus: '', tab: 'checks', dia: '' };
const ERRN = { 'Cumple': 'Cumple', 'Check In Fuera Ventana': 'Entrada fuera de horario', 'Check Out Fuera Ventana': 'Salida fuera de horario', 'Error Comida': 'Error de comida', 'Tiempo Incompleto': 'Tiempo incompleto', 'Check In Fuera Rango': 'Entrada fuera de rango', 'Check Out Fuera Rango': 'Salida fuera de rango', 'No Check Salida': 'Sin check de salida', 'Equipo Duplicado': 'Equipo duplicado', 'Abierto': 'Abierto (hoy)' };
const ERRI = { 'Cumple': '✅', 'Check In Fuera Ventana': '🕘', 'Check Out Fuera Ventana': '🕕', 'Error Comida': '🍽️', 'Tiempo Incompleto': '⏱️', 'Check In Fuera Rango': '📍', 'Check Out Fuera Rango': '📍', 'No Check Salida': '🚪', 'Equipo Duplicado': '📱', 'Abierto': '🟦' };
const OKF = ['Cumple', 'Cumple Productividad', 'Cumple Telefonica'];
const VALC = { 'Cumple': 'g', 'Cumple Productividad': 'b', 'Cumple Telefonica': 'b', 'No Cumple': 'r' };
const NOJUST = ['Check In Fuera Rango', 'Check Out Fuera Rango', 'Equipo Duplicado', 'No Check Salida'];   // la venta no los justifica (regla del modelo): hay que enviarlos a otra tienda o corregir
async function checksRango(d, h) { // se piden por semana (con reintentos) y se guardan en memoria
  const W = ventana(), blocks = W.filter(w => addD(w.ini, 6) >= d && w.ini <= h), out = [];
  for (const w of blocks) { if (!CKS.cache[w.ini]) CKS.cache[w.ini] = await API.checks(w.ini, addD(w.ini, 6)); out.push(...CKS.cache[w.ini]); }
  return out.filter(r => r.fecha >= d && r.fecha <= h);
}
const esErr = r => r.estatus_check !== 'Cumple' && r.estatus_check !== 'Abierto' && r.estatus_final !== 'Otro Check';
const justif = r => r.estatus_final === 'Cumple Productividad' || r.estatus_final === 'Cumple Telefonica';
function justTxt(r) { if (r.estatus_check === 'Cumple' || r.estatus_check === 'Abierto' || NOJUST.includes(r.estatus_check)) return 'No aplica'; return justif(r) ? 'Con venta' : 'Sin venta'; }
const JUSTP = { 'No aplica': ['x', '➖ No aplica'], 'Con venta': ['b', '💸 Con venta'], 'Sin venta': ['r', '🔴 Sin venta'] };
async function vChecks() {
  await conReporte('Detalle de checks', 'sim', async () => {
    const r = perRango(); $('content').innerHTML = cab('Detalle de checks', 'Cargando checks… (los periodos largos tardan unos segundos)', 'sim');
    const vistaSem = CKS.vista ? CKS.vista === 'sem' : r.dias.length > 14, ws4 = semanasUlt4(r), desdeCarga = vistaSem && ws4.length ? (ws4[0].desde < r.desde ? ws4[0].desde : r.desde) : r.desde;
    const todos = (await checksRango(desdeCarga, r.hasta)).filter(x => okI(x.idpdv)), rows = todos.filter(x => x.fecha >= r.desde && x.fecha <= r.hasta);
    const prim = rows.filter(x => x.estatus_final !== 'Otro Check'), ok = prim.filter(x => OKF.includes(x.estatus_final));
    const prom = new Set(prim.map(x => x.usuario)).size, prod = prim.filter(x => x.estatus_final === 'Cumple Productividad').length, vtas = prim.reduce((a, x) => a + x.registros, 0);
    const errores = prim.filter(esErr), sinVta = errores.filter(x => justTxt(x) === 'Sin venta').length, conJ = errores.filter(x => justTxt(x) === 'Con venta').length, noAp = errores.filter(x => justTxt(x) === 'No aplica').length;
    const mix = {}; prim.forEach(x => mix[x.estatus_check] = (mix[x.estatus_check] || 0) + 1);
    let h = cab('Detalle de checks', 'Cada check de cada promotor con horarios, tiempos, rangos y resultado, y la venta registrada del día para confirmar la justificación por productividad.', 'sim') + barraFiltros('vChecks') + barraPeriodo('vChecks', { dia: true });
    h += `<div class="tools" data-nocap>${[['checks', '🧾 Checks'], ['errores', '🛠️ Errores de check']].map(([k, n]) => `<button class="chip ${CKS.tab === k ? 'on' : ''}" onclick="CKS.tab='${k}';vChecks()">${n}</button>`).join('')}</div>`;
    if (CKS.tab === 'errores') { $('content').innerHTML = h + erroresCheckHTML(r, rows, prim, errores); drawAll(); return; }
    h += `<div class="kpis">${kp('Checks evaluados', fmt(prim.length), 'todos los del periodo, incluidos abiertos', null, null, '🧾')}${kp('Promotores con check', fmt(prom), fdate(r.desde) + ' – ' + fdate(r.hasta), null, null, '🧍')}${kp('Cumplen (regla de pago)', pc1(ok.length, prim.length), fmt(ok.length) + ' checks', colorPct(pn(ok.length, prim.length)), null, '✅')}${kp('Con error', fmt(errores.length), `${fmt(conJ)} con venta · ${fmt(sinVta)} sin venta · ${fmt(noAp)} no justificables`, errores.length ? C.rd : C.gr, null, '⚠️')}${kp('Cumple por productividad', pc1(prod, prim.length), fmt(prod) + ' checks', C.pu, null, '💸')}${kp('Ventas registradas', fmt(vtas), 'en días con check', null, null, '🛒')}</div>`;
    // gráfica: promotores que checaron bien / mal
    const cuenta = x => ({ b: new Set(x.filter(y => OKF.includes(y.estatus_final)).map(y => y.usuario)).size, m: new Set(x.filter(y => !OKF.includes(y.estatus_final)).map(y => y.usuario)).size, n: x.length, c: x.filter(y => OKF.includes(y.estatus_final)).length });
    const base = x => x.estatus_final !== 'Otro Check';
    let labs, g, tit;
    if (vistaSem) { labs = ws4.map(w => w.w.slice(3)); g = ws4.map(w => cuenta(todos.filter(y => y.fecha >= w.desde && y.fecha <= w.hasta && base(y)))); tit = 'Vista semanal · comparativo de las últimas 4 semanas'; }
    else { labs = r.dias.map(d => d.slice(8) + '/' + d.slice(5, 7)); g = r.dias.map(d => cuenta(prim.filter(y => y.fecha === d))); tit = 'Vista diaria'; }
    h += `<div class="grid g2"><div class="card"><div class="card-h"><h3>👥 Promotores que checaron bien y mal</h3><span class="seg sm" data-nocap><button class="${!vistaSem ? 'on' : ''}" onclick="CKS.vista='dia';vChecks()">Diaria</button><button class="${vistaSem ? 'on' : ''}" onclick="CKS.vista='sem';vChecks()">Semanal</button></span></div><p class="note">${tit}. Cantidad de promotores por resultado; la línea es el % de checks que cumplen, con su tendencia.</p>${legend([['Checaron bien', C.gr], ['Checaron mal', C.rd], ['% checks que cumplen', C.dk]])}${chart(labs, [{ n: 'Checaron bien', c: C.gr, v: g.map(q => q.b) }, { n: 'Checaron mal', c: C.rd, v: g.map(q => q.m) }], { bars: 1, stack: 1, vals: 1, h: 310, ticks: 16, lines2: [{ n: '% cumplen', c: C.dk, v: g.map(q => pn(q.c, q.n)), trend: 1 }], y2: { pct: 1, max: 100 } })}</div>
      <div class="card"><h3>🧩 Resultado del check</h3><p class="note">Antes de aplicar productividad o Telefónica.</p>${hbars(Object.entries(mix).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ n: (ERRI[k] || '') + ' ' + (ERRN[k] || k), v, c: k === 'Cumple' ? C.gr : NOJUST.includes(k) ? C.rd : C.am, s: pc1(v, prim.length) })), C.am)}</div></div>`;
    // detalle
    const sel = rows.slice().sort((a, b) => b.fecha.localeCompare(a.fecha) || (a.hora_in || '').localeCompare(b.hora_in || '')).filter(q => (!CKS.est || q.estatus_check === CKS.est) && (!CKS.fin || q.estatus_final === CKS.fin) && (!CKS.jus || justTxt(q) === CKS.jus));
    h += sect('Detalle de cada check', '🧾') + `<div class="tools" data-nocap><select onchange="CKS.est=this.value;vChecks()"><option value="">Todos los resultados</option>${Object.keys(ERRN).map(k => `<option value="${k}" ${CKS.est === k ? 'selected' : ''}>${ERRI[k]} ${ERRN[k]}</option>`).join('')}</select><select onchange="CKS.fin=this.value;vChecks()"><option value="">Todos los estatus finales</option>${['Cumple', 'Cumple Productividad', 'Cumple Telefonica', 'No Cumple', 'Otro Check'].map(k => `<option ${CKS.fin === k ? 'selected' : ''}>${k}</option>`).join('')}</select><select onchange="CKS.jus=this.value;vChecks()"><option value="">Toda justificación</option>${['Con venta', 'Sin venta', 'No aplica'].map(k => `<option ${CKS.jus === k ? 'selected' : ''}>${k}</option>`).join('')}</select></div>`;
    h += tbl('t-checks', [{ h: 'Fecha', v: q => q.fecha, r: q => fdate(q.fecha), w: 82 }, { h: 'Usuario', t: 1, v: q => q.usuario, w: 112 }, { h: 'Promotor', t: 1, v: q => q.nombre, w: 220, r: q => `<b>${esc(q.nombre)}</b>` }, { h: 'IDPDV', v: q => q.idpdv }, { h: 'Tienda', t: 1, v: q => (tienda(q.idpdv) || {}).nombre || '' },
      { h: 'Entrada', v: q => q.hora_in, r: q => hh(q.hora_in) }, { h: 'Comida', v: q => q.hora_com_in, r: q => hh(q.hora_com_in) + ' – ' + hh(q.hora_com_out) }, { h: 'Salida', v: q => q.hora_out, r: q => hh(q.hora_out) }, { h: 'En tienda (min)', v: q => q.tiempo_ub, r: q => `<span class="${q.tiempo_ub < 420 ? 'cell-amber' : ''}">${fmt(q.tiempo_ub)}</span>` }, { h: 'Comida (min)', v: q => q.tiempo_com, r: q => f1(q.tiempo_com) },
      { h: 'Rango entrada', t: 1, v: q => q.rango_in, r: q => /fuera/i.test(q.rango_in || '') ? `<span class="cell-red">📍 ${esc(q.rango_in)}</span>` : esc(q.rango_in || '—') }, { h: 'Rango salida', t: 1, v: q => q.rango_out, r: q => /fuera/i.test(q.rango_out || '') ? `<span class="cell-red">📍 ${esc(q.rango_out)}</span>` : esc(q.rango_out || '—') },
      { h: 'Resultado', t: 1, v: q => ERRN[q.estatus_check] || q.estatus_check, r: q => pillx((ERRI[q.estatus_check] || '') + ' ' + (ERRN[q.estatus_check] || q.estatus_check), q.estatus_check === 'Cumple' ? 'g' : q.estatus_check === 'Abierto' ? 'b' : NOJUST.includes(q.estatus_check) ? 'r' : 'a') }, { h: 'Estatus final', t: 1, v: q => q.estatus_final, r: q => pillx(q.estatus_final, VALC[q.estatus_final] || 'x') },
      { h: 'Ventas', v: q => q.registros, r: q => q.registros ? `<b>${q.registros}</b> <small class="muted">T${q.temm} P${q.porta} Pos${q.pospago} Pre${q.prepago}</small>` : '0' }, { h: 'Justifica', t: 1, v: q => justTxt(q), r: q => { const p = JUSTP[justTxt(q)]; return pillx(p[1], p[0]); } },
      { h: 'Supervisor', t: 1, v: q => (tienda(q.idpdv) || {}).supervisor }, { h: 'Gerente', t: 1, v: q => (tienda(q.idpdv) || {}).gerente }, { h: 'RR.HH.', t: 1, v: q => (tienda(q.idpdv) || {}).rrhh }], sel, { fix: 3, search: 1, csv: 1, png: 1, file: 'detalle_checks', titulo: 'Detalle de checks', sort: 0, dir: -1, maxh: '70vh', lim: 600 });
    $('content').innerHTML = h; drawAll();
  });
}
const hh = s => s ? s.slice(0, 5) : '—';

/* ====================================================================== 4 · HC ====================================================================== */
const ACTC = { 'Activo': 'g', 'Descanso / falta / error': 'a', 'Posible baja': 'r', 'Baja': 'x', 'Sin check': 'x' };
const ACTI = { 'Activo': '🟢', 'Descanso / falta / error': '🟠', 'Posible baja': '🔴', 'Baja': '⚫', 'Sin check': '⚪', 'Vacaciones': '🏖️', 'Incapacidad (IMSS)': '🏥', 'Permiso especial': '📝', 'Tema médico (particular)': '🩺', 'No localizado': '❓' };
const ANTB = [['< 2 sem', 0, 13, C.rd], ['2–4 sem', 14, 27, C.am], ['1–3 meses', 28, 89, C.ye], ['3–6 meses', 90, 179, C.te], ['6 m – 1 año', 180, 364, C.bl], ['1–2 años', 365, 729, C.pu], ['2–3 años', 730, 1094, C.gr], ['3+ años', 1095, 1e9, C.dk]];
const antLabel = d => d == null ? '—' : (ANTB.find(b => d >= b[1] && d <= b[2]) || [''])[0];
function tipoIngreso(h, ant) { if (h.tipo_ingreso === 'Reingreso') return 'Reingreso'; if (ant == null) return 'Normal'; if (ant <= 14) return 'Nuevo ingreso'; if (ant <= 28) return 'Adaptación'; return 'Normal'; }
const TIPC = { 'Nuevo ingreso': ['r', '🆕'], 'Reingreso': ['b', '🔁'], 'Adaptación': ['a', '🌱'], 'Normal': ['x', ''] };
function estadoVivo(h) {
  const baja = R.bajasLive.get(h.usuario); if (baja && (!h.fecha_alta || baja >= h.fecha_alta)) return { e: 'Baja', det: 'Baja ' + fdate(baja) };
  const au = S.vigentes.find(v => v.usuario === h.usuario); if (au) return { e: au.motivo, det: `${au.dias} d · regresa ${fdate(au.regreso)}`, aus: au };
  if (h.ausencia_motivo && h.ausencia_regreso && h.ausencia_regreso > HOY) return { e: h.ausencia_motivo, det: `${h.ausencia_dias} d · regresa ${fdate(h.ausencia_regreso)}`, aus: { motivo: h.ausencia_motivo, inicio: addD(h.ausencia_regreso, -h.ausencia_dias), regreso: h.ausencia_regreso } };
  const d = h.ultimo_check ? diffD(HOY, h.ultimo_check) : null;
  if (d == null) return { e: 'Sin check', det: '' }; if (d <= 0) return { e: 'Activo', det: '' }; if (d === 1) return { e: 'Descanso / falta / error', det: '1 día sin check' }; if (d > 21) return { e: 'Baja', det: d + ' días sin check · sin baja registrada' }; return { e: 'Posible baja', det: d + ' días sin check' };
}
const HCF = { est: '', tipo: '', ant: '', emp: '', cat: '' };
async function vHC() {
  await conReporte('HC', 'mochila', async () => {
    if (!R.vivo) { try { S.vigentes = await API.vigentes(); } catch (e) { } R.vivo = true; }
    await cargarCatPromotores();
    const rp = perRango(), tpor = new Map();   // tiendas donde checó cada promotor en el periodo filtrado
    try { (await checksRango(rp.desde, rp.hasta)).filter(c => c.estatus_final !== 'Otro Check').forEach(c => { if (!tpor.has(c.usuario)) tpor.set(c.usuario, new Map()); const m = tpor.get(c.usuario); m.set(c.idpdv, (m.get(c.idpdv) || 0) + 1); }); } catch (e) { console.warn('tiendas por promotor:', e); }
    const rows = R.hc.filter(h => okI(h.ultimo_idpdv)).map(h => { const v = estadoVivo(h), u = R.uc[h.usuario] || {}, t = tienda(h.ultimo_idpdv), ant = h.fecha_alta ? diffD(HOY, h.fecha_alta) : null; return { ...h, v, u, t: t || {}, ant, tipo: tipoIngreso(h, ant), antL: antLabel(ant), alerta: S.alertas.find(a => a.usuario === h.usuario), tdas: tpor.get(h.usuario) || new Map(), cat: catActual(h.usuario) }; });
    const vis = rows.filter(q => R.incBaja || q.v.e !== 'Baja'), cnt = {}; vis.forEach(q => cnt[q.v.e] = (cnt[q.v.e] || 0) + 1);
    const ausN = vis.filter(q => !['Activo', 'Descanso / falta / error', 'Posible baja', 'Baja', 'Sin check'].includes(q.v.e)), nuevos = vis.filter(q => q.tipo === 'Nuevo ingreso').length, adap = vis.filter(q => q.tipo === 'Adaptación').length;
    const ests = [...new Set(vis.map(q => q.v.e))].sort(), emps = [...new Set(vis.map(q => q.empresa).filter(Boolean))].sort();
    const tabla = vis.filter(q => (!HCF.est || q.v.e === HCF.est) && (!HCF.tipo || q.tipo === HCF.tipo) && (!HCF.ant || q.antL === HCF.ant) && (!HCF.emp || q.empresa === HCF.emp) && (!HCF.cat || (q.cat ? q.cat.categoria : 'Sin categoría') === HCF.cat));
    let h = cab('HC · plantilla de promotoría', 'Promotores y cubre-descansos con su último check y estatus. El estatus se actualiza en vivo con las ausencias y bajas que RH captura en Posibles bajas.', 'mochila') + barraFiltros('vHC');
    h += `<div class="tools"><button class="chip ${R.incBaja ? 'on' : ''}" onclick="R.incBaja=!R.incBaja;vHC()">Incluir bajas</button><span class="muted">${fmt(vis.length)} promotores · publicado ${esc(R.meta.generado)} · las columnas de tiendas usan el periodo de arriba</span></div>`;
    h += `<div class="kpis">${kp('Plantilla', fmt(vis.filter(q => q.v.e !== 'Baja').length), 'sin bajas', null, null, '👥')}${kp('Activos hoy', fmt(cnt['Activo'] || 0), pc1(cnt['Activo'] || 0, vis.length), C.gr, null, '🟢')}${kp('Descanso / falta', fmt(cnt['Descanso / falta / error'] || 0), 'último check ayer', C.am, null, '🟠')}${kp('Posible baja', fmt(cnt['Posible baja'] || 0), '2 o más días sin check', C.rd, "ir('bandeja')", '🔴')}${kp('Con ausencia', fmt(ausN.length), 'vacaciones, incapacidad…', C.bl, "ir('vigentes')", '🏖️')}${kp('Nuevo ingreso', fmt(nuevos), 'menos de 2 semanas · arranque rápido', C.rd, null, '🆕')}${kp('Adaptación', fmt(adap), '2 a 4 semanas', C.am, null, '🌱')}</div>`;
    h += `<div class="grid g2"><div class="card"><h3>🚦 Estatus de la plantilla</h3>${donut(Object.entries(cnt).map(([k, v]) => ({ n: (ACTI[k] || '') + ' ' + k, v, c: k === 'Activo' ? C.gr : k === 'Posible baja' ? C.rd : k === 'Descanso / falta / error' ? C.am : k === 'Baja' ? C.gy : C.bl })), { sub: 'promotores' })}</div>
      <div class="card"><h3>⏳ Antigüedad</h3><p class="note">Menos de 2 semanas = nuevo ingreso: requiere arranque rápido (visita del supervisor, básicos y capacitación práctica).</p>${hbars(ANTB.map(b => ({ n: b[0], v: vis.filter(q => q.ant != null && q.ant >= b[1] && q.ant <= b[2]).length, c: b[3] })), C.pu)}</div></div>`;
    TB = {};
    h += sect('Promotores', '👥') + `<div class="tools" data-nocap><select onchange="HCF.est=this.value;vHC()"><option value="">Todos los estatus</option>${ests.map(e => `<option ${HCF.est === e ? 'selected' : ''}>${esc(e)}</option>`).join('')}</select><select onchange="HCF.tipo=this.value;vHC()"><option value="">Todo tipo de ingreso</option>${['Nuevo ingreso', 'Adaptación', 'Reingreso', 'Normal'].map(e => `<option ${HCF.tipo === e ? 'selected' : ''}>${e}</option>`).join('')}</select><select onchange="HCF.ant=this.value;vHC()"><option value="">Toda antigüedad</option>${ANTB.map(b => `<option ${HCF.ant === b[0] ? 'selected' : ''}>${b[0]}</option>`).join('')}</select><select onchange="HCF.cat=this.value;vHC()"><option value="">Toda categoría (Avance)</option>${[...CATS, 'Sin categoría'].map(e => `<option ${HCF.cat === e ? 'selected' : ''}>${e}</option>`).join('')}</select><select onchange="HCF.emp=this.value;vHC()"><option value="">Toda razón social</option>${emps.map(e => `<option ${HCF.emp === e ? 'selected' : ''}>${esc(e)}</option>`).join('')}</select></div>`;
    h += tbl('t-hc', [{ h: 'Usuario', t: 1, v: q => q.usuario, w: 120 }, { h: 'Nombre', t: 1, v: q => q.nombre, w: 230, r: q => `<b>${esc(q.nombre)}</b>` },
      { h: 'Estatus', t: 1, v: q => q.v.e, w: 250, r: q => { const pend = ['Posible baja', 'Descanso / falta / error'].includes(q.v.e) && q.alerta && can('alertas', 'editar'); return `<div class="est-c"><div class="est-r">${pillx((ACTI[q.v.e] || '🔵') + ' ' + esc(q.v.e), ACTC[q.v.e] || 'b')}${pend ? `<button class="rsv" onclick="resolverDesdeHC(${q.alerta.id})">Resolver ›</button>` : ''}</div>${q.v.det ? `<small class="muted">${esc(q.v.det)}</small>` : ''}</div>`; } },
      { h: 'Categoría Avance GB', t: 1, w: 150, v: q => q.cat ? CATS.indexOf(q.cat.categoria) : 99, r: q => q.cat ? `${catPill(q.cat.categoria)}<br><small class="muted">${esc(q.cat.semana)} · ${catHist(q.usuario)}</small>` : '<span class="muted">Sin dato</span>' },
      { h: 'Tipo de ingreso', t: 1, v: q => q.tipo, r: q => pillx((TIPC[q.tipo][1] + ' ' + q.tipo).trim(), TIPC[q.tipo][0]) }, { h: 'Antigüedad', t: 1, v: q => q.ant, r: q => q.ant == null ? '—' : `<b>${esc(q.antL)}</b><br><small class="muted">${Math.floor(q.ant / 7)} sem · ${q.ant} d</small>` },
      { h: 'Fecha de ingreso', v: q => q.fecha_alta, r: q => fdate(q.fecha_alta) }, { h: 'Baja anterior', v: q => q.tipo_ingreso === 'Reingreso' ? q.baja_final : null, r: q => q.tipo_ingreso === 'Reingreso' ? fdate(q.baja_final) : '—' },
      { h: 'Último check', v: q => q.ultimo_check, r: q => fdate(q.ultimo_check) + (q.u.hora_in ? `<br><small class="muted">${hh(q.u.hora_in)} – ${hh(q.u.hora_out)}</small>` : '') }, { h: 'Tipo de check', t: 1, v: q => q.rol, r: q => esc(q.rol || '—') + (q.u.estatus_check ? `<br><small class="muted">${esc((ERRI[q.u.estatus_check] || '') + ' ' + (ERRN[q.u.estatus_check] || q.u.estatus_check))}</small>` : '') },
      { h: 'Tiendas en el periodo', v: q => q.tdas.size, r: q => q.tdas.size > 1 ? `<span class="cell-amber"><b>${q.tdas.size}</b> 🔀</span>` : String(q.tdas.size || 0) }, { h: 'Dónde checó (periodo)', t: 1, w: 320, v: q => [...q.tdas.keys()].map(i => (tienda(i) || {}).nombre || i).join(' · '), r: q => [...q.tdas].sort((a, b) => b[1] - a[1]).map(([i, n]) => `${esc((tienda(i) || {}).nombre || 'IDPDV ' + i)} <small class="muted">(${n})</small>`).join('<br>') || '—' },
      { h: 'Tienda (último check)', t: 1, v: q => q.t.nombre || '', r: q => esc(q.t.nombre || '—') }, { h: 'Cadena', t: 1, v: q => q.t.cadena }, { h: 'Estado', t: 1, v: q => q.t.estado }, { h: 'Región', t: 1, v: q => q.t.region }, { h: 'Gerente', t: 1, v: q => q.t.gerente }, { h: 'Supervisor', t: 1, v: q => q.t.supervisor }, { h: 'RR.HH.', t: 1, v: q => q.t.rrhh }, { h: 'Razón social', t: 1, v: q => q.empresa }],
      tabla, { fix: 3, search: 1, csv: 1, png: 1, file: 'hc_promotores', titulo: 'HC · promotores', sort: 2, dir: 1, maxh: '72vh', lim: 600 });
    $('content').innerHTML = h; drawAll();
  });
}
function resolverDesdeHC(id) { S.view = 'bandeja'; nav(); render(); setTimeout(() => abrir('aus', id), 80); }

/* >>> 03b_errores_check.js */
/* ====================================================================== DETALLE DE CHECKS · ERRORES DE CHECK ======================================================================
   Subsección de Detalle de checks. Por día: tarjetas por promotor con el tipo de error, su tienda y supervisor y la forma sugerida de corregirlo, para mandar como imagen por WhatsApp
   mientras todavía se puede corregir. Por periodo: acumulado de errores por promotor, tipo de error y supervisor. La venta justifica los errores de tiempo/horario/comida,
   no los de rango, equipo duplicado ni salida sin check (misma regla de la sección de checks). */
const ERRFIX = {
  'Check In Fuera Ventana': 'Hacer el check de entrada dentro de la ventana de horario de la tienda. Si ya pasó, avisar al supervisor para dejar nota.',
  'Check Out Fuera Ventana': 'Hacer el check de salida dentro de la ventana de horario de la tienda. Si ya pasó, avisar al supervisor para dejar nota.',
  'Error Comida': 'Registrar la salida y el regreso de comida dentro del horario permitido. Pedir al supervisor revisar el registro del día.',
  'Tiempo Incompleto': 'Completar el tiempo mínimo en tienda (420 min; 300 los domingos con horario diferenciado). Si hubo venta, queda justificado.',
  'Check In Fuera Rango': 'Hacer el check de entrada estando en la tienda (dentro del rango de ubicación). Si estuvo en otra tienda, reasignar o enviarlo a la correcta.',
  'Check Out Fuera Rango': 'Hacer el check de salida estando en la tienda (dentro del rango). Si salió de otra tienda, reasignar o enviarlo a la correcta.',
  'No Check Salida': 'Cerrar siempre la jornada con su check de salida. Pedir al promotor que lo registre y avisar al supervisor.',
  'Equipo Duplicado': 'Cada promotor debe checar con su propio equipo. Revisar con el supervisor quién usó el mismo celular.'
};
const ERR_TIPOS = Object.keys(ERRFIX);
const ERR_JUST = [['', 'Todos los errores'], ['sin', '🔴 Sin justificación'], ['con', '🟢 Con justificación (venta)']];
const errFiltra = (xs, just) => xs.filter(x => !just || (just === 'con' ? justTxt(x) === 'Con venta' : justTxt(x) !== 'Con venta'));
const errNom = k => ERRN[k] || k;

function erroresCheckHTML(r, rows, prim, errores) {
  const just = CKS.just, errF = errFiltra(errores, just), dias = [...new Set(prim.map(x => x.fecha))].sort();
  const dia = CKS.dia && dias.includes(CKS.dia) ? CKS.dia : (dias[dias.length - 1] || r.hasta);
  const delDia = errF.filter(x => x.fecha === dia), evalDia = prim.filter(x => x.fecha === dia);
  const sup = x => (tienda(x.idpdv) || {}).supervisor || 'Sin supervisor';
  let h = `<div class="tools" data-nocap>${ERR_JUST.map(([k, n]) => `<button class="chip ${just === k ? 'on' : ''}" onclick="CKS.just='${k}';vChecks()">${n}</button>`).join('')}<span class="muted">Fuera de rango, equipo duplicado y sin check de salida no se justifican con venta.</span></div>`;
  h += `<div class="kpis">${kp('Errores del día', fmt(delDia.length), `${fdate(dia)} · ${fmt(evalDia.length)} checks evaluados`, delDia.length ? C.rd : C.gr, null, '🛠️')}${kp('Promotores con error (día)', fmt(new Set(delDia.map(x => x.usuario)).size), 'a corregir hoy si es el día actual', null, null, '🧍')}${kp('Errores del periodo', fmt(errF.length), `${fdate(r.desde)} – ${fdate(r.hasta)}`, null, null, '📅')}${kp('Promotores con error (periodo)', fmt(new Set(errF.map(x => x.usuario)).size), `de ${fmt(new Set(prim.map(x => x.usuario)).size)} que checaron`, null, null, '👥')}</div>`;

  /* ---- del día: tarjetas para WhatsApp ---- */
  const hoy = dia === HOY;
  h += sect('Errores del día · ' + fdate(dia), '📲') + `<div class="tools" data-nocap><span>Día:</span><select onchange="CKS.dia=this.value;vChecks()">${dias.slice().reverse().map(d => `<option value="${d}" ${d === dia ? 'selected' : ''}>${fdate(d)}${d === HOY ? ' (hoy)' : ''}</option>`).join('')}</select>
    <button class="btn sm" onclick="capturaDescargar($('err-dia'),'Errores de check · ${fdate(dia)}',subFiltros(),'errores_check_${dia}')">📸 Imagen para WhatsApp</button><button class="btn sm" onclick="capturaCopiar($('err-dia'),'Errores de check · ${fdate(dia)}',subFiltros())">📋 Copiar imagen</button><button class="btn sm" onclick="erroresCsv('dia')">⬇ CSV del día</button>
    <span class="muted">${hoy ? 'Es el día de hoy: todavía se pueden corregir.' : 'No es el día de hoy: sirve de seguimiento.'}</span></div>`;
  const porSup = new Map(); delDia.forEach(x => { const k = sup(x); if (!porSup.has(k)) porSup.set(k, []); porSup.get(k).push(x); });
  h += `<div id="err-dia" class="err-dia">${delDia.length ? [...porSup].sort((a, b) => a[0].localeCompare(b[0], 'es')).map(([s, xs]) => `<div class="err-sup"><h4>🧭 ${esc(s)} <small>${xs.length} error${xs.length === 1 ? '' : 'es'}</small></h4>${xs.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map(x => {
    const t = tienda(x.idpdv) || {}, jt = justTxt(x), p = JUSTP[jt];
    return `<div class="err-card"><div class="err-h"><b>${esc(x.nombre)}</b><small>${esc(x.usuario)} · ${esc(t.nombre || 'IDPDV ' + x.idpdv)}</small></div><div>${pillx((ERRI[x.estatus_check] || '') + ' ' + errNom(x.estatus_check), NOJUST.includes(x.estatus_check) ? 'r' : 'a')} ${pillx(p[1], p[0])}${x.registros ? ` <small class="muted">${x.registros} venta${x.registros === 1 ? '' : 's'}</small>` : ''}</div><div class="err-fix">💡 ${esc(ERRFIX[x.estatus_check] || 'Revisar el check con el supervisor.')}</div></div>`;
  }).join('')}</div>`).join('') : '<div class="card empty"><img src="' + img('triunfo') + '" alt="">Sin errores de check ese día con este filtro.</div>'}</div>`;

  /* ---- del periodo: acumulado ---- */
  h += sect('Acumulado del periodo', '📊') + `<p class="note">${fdate(r.desde)} – ${fdate(r.hasta)}. Cambia el periodo arriba para ver otra semana o mes.</p>`;
  const tipos = {}; errF.forEach(x => tipos[x.estatus_check] = (tipos[x.estatus_check] || 0) + 1);
  h += `<div class="grid g2"><div class="card"><h3>🧩 Tipos de error</h3>${hbars(Object.entries(tipos).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ n: (ERRI[k] || '') + ' ' + errNom(k), v, c: NOJUST.includes(k) ? C.rd : C.am, s: pc1(v, errF.length) })), C.am)}</div>`;
  const gs = new Map(); errF.forEach(x => { const k = sup(x); if (!gs.has(k)) gs.set(k, { s: k, e: 0, u: new Set() }); const g = gs.get(k); g.e++; g.u.add(x.usuario); });
  h += `<div class="card"><h3>🧭 Supervisores con más errores</h3>${hbars([...gs.values()].sort((a, b) => b.e - a.e).slice(0, 10).map(g => ({ n: g.s, v: g.e, c: C.am, s: g.u.size + ' promotores' })), C.am)}</div></div>`;
  const checksPor = new Map(); prim.forEach(x => checksPor.set(x.usuario, (checksPor.get(x.usuario) || 0) + 1));
  const gp = new Map(); errF.forEach(x => { if (!gp.has(x.usuario)) gp.set(x.usuario, { u: x.usuario, n: x.nombre, id: x.idpdv, tipos: {}, e: 0, j: 0 }); const g = gp.get(x.usuario); g.e++; g.tipos[x.estatus_check] = (g.tipos[x.estatus_check] || 0) + 1; if (justTxt(x) === 'Con venta') g.j++; g.id = x.idpdv; });
  const lista = [...gp.values()].map(g => ({ ...g, d: checksPor.get(g.u) || g.e, top: Object.entries(g.tipos).sort((a, b) => b[1] - a[1])[0][0] }));
  TB = {};
  const cols = [{ h: 'Usuario', t: 1, v: q => q.u, w: 112 }, { h: 'Promotor', t: 1, v: q => q.n, w: 230, r: q => `<b>${esc(q.n)}</b>` }, { h: 'Tienda (último error)', t: 1, v: q => (tienda(q.id) || {}).nombre || '' }, { h: 'Supervisor', t: 1, v: q => (tienda(q.id) || {}).supervisor },
    { h: 'Checks', v: q => q.d }, { h: 'Errores', v: q => q.e, r: q => `<b>${q.e}</b>` }, { h: '% con error', v: q => q.e / q.d * 100, r: q => f1(q.e / q.d * 100) + '%' }, { h: 'Con venta', v: q => q.j }, { h: 'Sin venta', v: q => q.e - q.j },
    { h: 'Error más frecuente', t: 1, v: q => errNom(q.top), r: q => pillx((ERRI[q.top] || '') + ' ' + errNom(q.top), NOJUST.includes(q.top) ? 'r' : 'a') },
    ...ERR_TIPOS.map(k => ({ h: (ERRI[k] || '') + ' ' + errNom(k), v: q => q.tipos[k] || 0, r: q => q.tipos[k] ? `<b>${q.tipos[k]}</b>` : '' })), { h: 'Cómo corregirlo (error más frecuente)', t: 1, v: q => ERRFIX[q.top] || '', w: 360 }];
  h += sect('Errores por promotor', '🧍') + tbl('t-err-per', cols, lista, { fix: 2, search: 1, csv: 1, png: 1, file: 'errores_check_periodo', titulo: 'Errores de check por promotor · ' + fdate(r.desde) + ' al ' + fdate(r.hasta), sort: 5, dir: -1, maxh: '60vh', lim: 500 });
  ERR_CTX = { dia, delDia, errF };
  return h;
}
let ERR_CTX = null;
function erroresCsv(que) {
  if (!ERR_CTX) return; const xs = que === 'dia' ? ERR_CTX.delDia : ERR_CTX.errF;
  finBajar('errores_check_' + (que === 'dia' ? ERR_CTX.dia : 'periodo') + '.csv', [['fecha', 'usuario', 'promotor', 'idpdv', 'tienda', 'supervisor', 'gerente', 'error', 'ventas', 'justifica', 'como_corregirlo'],
    ...xs.map(x => { const t = tienda(x.idpdv) || {}; return [x.fecha, x.usuario, x.nombre, x.idpdv, t.nombre, t.supervisor, t.gerente, errNom(x.estatus_check), x.registros, justTxt(x), ERRFIX[x.estatus_check] || '']; })]);
}

/* >>> 03c_categoria.js */
/* ====================================================================== CATEGORÍA DEL PROMOTOR (de Avance GB) ======================================================================
   Categoría semanal: Dorado, Verde, Amarillo, Naranja, Rojo, Adaptación (reglas de Avance GB: alcance de cuota total y TEMM, portabilidades y días con/sin venta).
   Sirve para justificar una baja por productividad y para decidir si un promotor es recontratable. Los datos los publica publicar_reporte.py (datos_avance.py). */
const CATS = ['Dorado', 'Verde', 'Amarillo', 'Naranja', 'Rojo', 'Adaptación'];
const CATCOL = { 'Dorado': '#C9A227', 'Verde': '#1E7A1E', 'Amarillo': '#F2C94C', 'Naranja': '#F2790A', 'Rojo': '#DC2626', 'Adaptación': '#00509C' };
const CATTXT = { 'Dorado': 'Supera su cuota (total y TEMM al 100 % o más y al menos 1 portabilidad)', 'Verde': 'Llega a comisionar (TEMM 90 %, total 85 % o 5+ portabilidades)', 'Amarillo': 'Cerca de cobrar (total 70 %, TEMM 75 % o 2 a 4 portabilidades)',
  'Naranja': 'Vende poco, pero al menos la mitad de sus días con check tuvo venta', 'Rojo': 'Más de la mitad de sus días con check sin venta, o ninguna venta', 'Adaptación': 'Menos de 2 semanas de antigüedad' };
const CATP = { loaded: false, por: new Map(), semanas: [] };   // usuario -> [{semana, categoria, ...}] de la más reciente a la más antigua

Real.catPromotores = async function () { return todo(() => sb.from('rep_promotor_semana').select('*')); };
Demo.catPromotores = async function () {
  const sem = ['26-S38', '26-S39', '26-S40', '26-S41'], out = [];
  for (let i = 0; i < 70; i++) sem.forEach((s, k) => out.push({ usuario: 'DEMO' + (100 + i), semana: s, categoria: CATS[(i + k * 2) % 6], alcance_t: .4 + ((i + k) % 7) / 8, alcance_m: .3 + ((i + k) % 6) / 8, portas: (i + k) % 5, dias_check: 5, dias_sin_venta: (i + k) % 4, antig_dias: 100 + i, tiendas: 1 + (i % 3 === 0 ? 1 : 0) }));
  return out;
};
async function cargarCatPromotores() {
  if (CATP.loaded) return;
  try {
    const xs = await API.catPromotores(); CATP.por = new Map();
    xs.sort((a, b) => b.semana.localeCompare(a.semana)).forEach(x => { if (!CATP.por.has(x.usuario)) CATP.por.set(x.usuario, []); CATP.por.get(x.usuario).push(x); });
    CATP.semanas = [...new Set(xs.map(x => x.semana))].sort().reverse();
  } catch (e) { console.warn('categorías de promotor no disponibles:', e); }
  CATP.loaded = true;
}
const catActual = u => (CATP.por.get(u) || [])[0] || null;
function catPill(c) { return c ? `<span class="prm-pill" style="background:${CATCOL[c] || '#6B7280'};${c === 'Amarillo' ? 'color:#4a3b00' : ''}" title="${esc(CATTXT[c] || '')}">${esc(c)}</span>` : '<span class="muted">—</span>'; }
const catHist = u => (CATP.por.get(u) || []).slice(0, 4).map(x => `<span class="prm-dot" style="background:${CATCOL[x.categoria] || '#bbb'}" title="${esc(x.semana + ': ' + x.categoria)}"></span>`).join('');

/* >>> 04_gestion.js */
/* ====================================================================== estado y UI ====================================================================== */
const S = { me: null, cat: null, alertas: [], vigentes: [], view: 'resumen', f: { q: '', min: 2 } };
const can = (mod, acc) => !!(S.me && S.me.permisos[mod] && S.me.permisos[mod][acc]);
const tienda = id => (S.cat && S.cat.tiendas[id]) || null;
const colorDias = d => d >= 5 ? 'd5' : d >= 3 ? 'd3' : 'd2';

const VISTAS = [
  { k: 'resumen', ic: '📊', n: 'Resumen', mod: 'reportes', f: vResumen, per: true },
  { k: 'penal', ic: '⚠️', n: 'Penalización', mod: 'reportes', f: vPenal },
  { k: 'checks', ic: '✅', n: 'Detalle de checks', mod: 'reportes', f: vChecks, per: 'dia' },
  { k: 'hc', ic: '👥', n: 'HC', mod: 'reportes', f: vHC, per: true },
  { k: 'movs', ic: '🔄', n: 'Ingresos y bajas', mod: 'reportes', f: vMovs, per: 'dia' },
  { k: 'sep', n: 'Gestión', sep: true },
  { k: 'ingresos', ic: '🧑‍💼', n: 'Posibles ingresos', mod: 'posibles_ingresos', f: vIngresos, per: 'libre' },
  { k: 'altas', ic: '🆕', n: 'Altas', mod: 'colaboradores', f: vAltas },
  { k: 'expedientes', ic: '🗂️', n: 'Expedientes', mod: 'expedientes', f: vExpedientes },
  { k: 'bandeja', ic: '🚨', n: 'Posibles bajas', mod: 'alertas', f: vBandeja },
  { k: 'vigentes', ic: '🩺', n: 'Motivos de ausencia', mod: 'ausencias', f: vVigentes },
  { k: 'bajas', ic: '📤', n: 'Bajas y encuesta', mod: 'bajas', f: vBajas },
  { k: 'vacantes', ic: '🏬', n: 'Vacantes', mod: 'vacantes', f: vVacantes, per: true },
  { k: 'finiquitos', ic: '🧾', n: 'Finiquitos', mod: 'finiquitos', f: vFiniquitos },
  { k: 'sueldos', ic: '💳', n: 'Sueldos y bancarios', mod: 'sueldos', f: vSueldos, sinFiltros: true },
  { k: 'auditoria', ic: '🧾', n: 'Auditoría', mod: 'auditoria', f: vAuditoria, sinFiltros: true }
];

function nav() {
  $('nav').innerHTML = VISTAS.filter(v => v.sep || can(v.mod, 'ver')).map(v => v.sep ? `<div class="nav-sep">${v.n}</div>` : `<div class="nav-item ${v.k === S.view ? 'active' : ''} ${v.soon ? 'off' : ''}" ${v.soon ? '' : `onclick="ir('${v.k}')"`}><span class="ic">${v.ic}</span>${v.n}${v.soon ? '<span class="soon">pronto</span>' : ''}${v.k === 'vacantes' && S.vacBadge ? `<span class="nav-badge" title="Compromisos de cobertura vencidos o que vencen en 3 días">${S.vacBadge}</span>` : ''}</div>`).join('');
}
function ir(k) { S.view = k; $('sidebar').classList.remove('open'); nav(); render(); window.scrollTo(0, 0); }
function render() { const v = VISTAS.find(x => x.k === S.view); if (typeof fbPintar === 'function') fbPintar(); if (v && v.f) v.f(); }
const cab = (t, sub, m) => `<div class="page-head"><div><h2>${t}${DEMO ? '<span class="demo-tag">DATOS DE EJEMPLO</span>' : ''}</h2><div class="sub">${sub}</div></div><img class="pg-mascot" src="${img(m)}" alt=""></div>`;

/* ---------- bandeja ---------- */
function filtradas() {
  const q = norm(S.f.q);
  return S.alertas.filter(a => a.dias == null || a.dias >= S.f.min).filter(a => {   // las alertas por conciliar (sin check reciente) no dependen del filtro de días
    const t = tienda(a.idpdv); if (!okT(t)) return false;
    if (q && !norm(`${a.nombre} ${a.usuario} ${t ? t.nombre + ' ' + t.supervisor : ''}`).includes(q)) return false;
    return true;
  });
}
function vBandeja() {
  const todas = S.alertas, f = filtradas();
  const n = (min, max = 9999) => todas.filter(a => a.dias >= min && a.dias <= max).length;
  const reg = S.vigentes.filter(v => diffD(v.regreso, HOY) <= 3).length;
  let h = cab('Posibles bajas', 'Promotores que llevan 2 o más días sin check y no tienen una ausencia registrada. Resuelve cada caso aquí mismo: registra la ausencia, confirma la baja o márcalo como error de asistencia.', 'guino');
  h += `<div class="kpis">
    <div class="kpi click ${S.f.min === 2 ? 'sel' : ''}" onclick="S.f.min=2;vBandeja()"><div class="l">Abiertas</div><div class="v">${fmt(todas.length)}</div><div class="s">2 o más días sin check</div></div>
    <div class="kpi click ${S.f.min === 3 ? 'sel' : ''}" onclick="S.f.min=3;vBandeja()"><div class="l">3 o más días</div><div class="v" style="color:var(--orange-n)">${fmt(n(3))}</div><div class="s">prioridad media</div></div>
    <div class="kpi click ${S.f.min === 5 ? 'sel' : ''}" onclick="S.f.min=5;vBandeja()"><div class="l">5 o más días</div><div class="v" style="color:var(--red)">${fmt(n(5))}</div><div class="s">prioridad alta</div></div>
    <div class="kpi"><div class="l">Por conciliar</div><div class="v" style="color:var(--purple)">${fmt(todas.filter(a => a.origen === 'conciliacion').length)}</div><div class="s">baja sin registro: confirmar con históricos</div></div>
    <div class="kpi"><div class="l">Con ausencia vigente</div><div class="v" style="color:var(--blue)">${fmt(S.vigentes.length)}</div><div class="s">${fmt(reg)} regresan en ≤ 3 días</div></div></div>`;
  h += barraFiltros('vBandeja', S.alertas.map(a => tienda(a.idpdv)).filter(Boolean), ['zona_rrhh', 'rrhh', 'supervisor', 'region', 'cadena']);
  h += `<div class="tools"><input type="search" id="q" placeholder="🔎 Buscar nombre, usuario, tienda o supervisor…" value="${esc(S.f.q)}"><span class="muted">${fmt(f.length)} caso${f.length === 1 ? '' : 's'}</span><span data-nocap><button class="btn sm" onclick="bandejaPng()">📸 Imagen</button> <button class="btn sm" onclick="bandejaCsv()">⬇ CSV</button></span></div>`;
  if (!f.length) h += `<div class="card empty"><img src="${img('triunfo')}" alt="">Sin casos pendientes con estos filtros. ¡Todo al día!</div>`;
  else h += `<div class="list" id="baj-lista"><div class="al head"><span>Promotor</span><span>Tienda</span><span>Sin check</span><span>Último check</span><span>Últimos 90 días</span><span></span></div>${f.slice(0, 300).map(filaAlerta).join('')}</div>${f.length > 300 ? '<p class="muted">Mostrando 300; usa los filtros para acotar.</p>' : ''}`;
  $('content').innerHTML = h;
  $('q').oninput = e => { S.f.q = e.target.value; clearTimeout(vBandeja.t); vBandeja.t = setTimeout(() => { const p = e.target.selectionStart; vBandeja(); const q = $('q'); q.focus(); q.setSelectionRange(p, p); }, 250); };
}
function bandejaPng() { const n = filtradas().length; if (n > 40 && !confirm('La imagen tendrá ' + n + ' casos y saldrá muy larga. ¿Continuar? (el CSV trae todos)')) return; capturaDescargar($('baj-lista'), 'Posibles bajas · ' + fdate(HOY), subFiltros() + ' · mínimo ' + S.f.min + ' días sin check', 'posibles_bajas'); }
function bandejaCsv() {
  const f = filtradas(); if (!f.length) { toast('No hay casos que exportar'); return; }
  finBajar('posibles_bajas_' + HOY + '.csv', [['usuario', 'nombre', 'idpdv', 'tienda', 'cadena', 'estado', 'region', 'gerente', 'supervisor', 'rrhh', 'dias_sin_check', 'ultimo_check', 'origen', 'ausencias_90d', 'dias_ausencia_90d', 'razon_social'],
    ...f.map(a => { const t = tienda(a.idpdv) || {}; return [a.usuario, a.nombre, a.idpdv, t.nombre, t.cadena, t.estado, t.region, t.gerente, t.supervisor, t.rrhh, a.dias == null ? 'sin check' : a.dias, a.ultimo, a.origen === 'conciliacion' ? 'Por conciliar' : 'Alerta', a.aus.length, a.aus.reduce((x, y) => x + y.dias, 0), a.empresa]; })]);
}
function filaAlerta(a) {
  const t = tienda(a.idpdv), ant = a.ingreso ? diffD(HOY, a.ingreso) : null;
  const rep = a.aus.length >= 3;
  const dias90 = a.aus.reduce((s, x) => s + x.dias, 0);
  const hist = a.aus.length ? `<span class="${rep ? 'rep' : ''}">${a.aus.length} ausencia${a.aus.length > 1 ? 's' : ''} · ${dias90} d</span><br>${esc(a.aus.slice().sort((x, y) => y.fecha_inicio.localeCompare(x.fecha_inicio))[0].motivo)} (${fdate(a.aus.slice().sort((x, y) => y.fecha_inicio.localeCompare(x.fecha_inicio))[0].fecha_inicio)})` : 'Sin ausencias';
  return `<div class="al">
    <div class="who a-who"><b>${esc(a.nombre)}</b>${a.origen === 'conciliacion' ? `<span class="pill" style="background:#fdf1de;color:#8a5a00;margin-left:6px;font-size:10px" title="${esc(a.nota)}">Por conciliar</span>` : ''}<small>${esc(a.usuario)}${ant != null ? ' · ' + (ant < 90 ? ant + ' días en la empresa' : Math.floor(ant / 30) + ' meses') : ''}${a.empresa ? ' · ' + esc(a.empresa) : ''}</small></div>
    <div class="store a-store"><b>${t ? esc(t.nombre) : 'Tienda no identificada'}</b><small>${t ? esc(t.estado) + ' · ' + esc(t.supervisor || '') : ''}</small></div>
    <div class="a-days">${a.dias == null ? '<span class="days d5" title="Sin check en las últimas 10 semanas">sin check</span>' : `<span class="days ${colorDias(a.dias)}">${a.dias} d</span>`}</div>
    <div class="muted a-last">${fdate(a.ultimo)}</div>
    <div class="hist a-hist">${hist}</div>
    <div class="acts a-acts" data-nocap>
      ${can('ausencias', 'crear') ? `<button class="btn sm primary" onclick="abrir('aus',${a.id})">Registrar ausencia</button>` : ''}
      ${can('bajas', 'crear') ? `<button class="btn sm danger" onclick="abrir('baja',${a.id})">Confirmar baja</button>` : ''}
      ${can('alertas', 'editar') ? `<button class="btn sm" onclick="abrir('err',${a.id})" title="Marcar como error de asistencia">Error</button>` : ''}
    </div></div>`;
}

/* ---------- ausencias vigentes ---------- */
function vVigentes() {
  const todos = S.vigentes.map(v => ({ ...v, faltan: diffD(v.regreso, HOY), t: tienda(v.idpdv) || {} }));
  const rows = todos.filter(v => okT(v.t.nombre ? v.t : null) && (!S.f.mot || v.motivo === S.f.mot)).sort((a, b) => a.faltan - b.faltan);
  const porMot = {}; rows.forEach(r => porMot[r.motivo] = (porMot[r.motivo] || 0) + 1);
  const MI = { 'Vacaciones': '🏖️', 'Incapacidad (IMSS)': '🏥', 'Permiso especial': '📝', 'Tema médico (particular)': '🩺', 'No localizado': '❓' };
  let h = cab('Motivos de ausencia', 'Promotores con ausencia registrada que sigue vigente hoy, y cuándo regresan.', 'mochila') + barraFiltros('vVigentes', todos.map(v => v.t).filter(t => t.nombre), ['zona_rrhh', 'rrhh', 'supervisor', 'region', 'cadena']);
  h += `<div class="kpis"><div class="kpi"><div class="l">🩺 Vigentes</div><div class="v">${fmt(rows.length)}</div><div class="s">hoy</div></div>${Object.entries(porMot).map(([m, c]) => `<div class="kpi"><div class="l">${MI[m] || ''} ${esc(m)}</div><div class="v">${c}</div></div>`).join('')}<div class="kpi"><div class="l">⏰ Regresan en ≤ 3 días</div><div class="v" style="color:var(--orange-n)">${rows.filter(r => r.faltan <= 3).length}</div></div></div>`;
  h += `<div class="tools" data-nocap><span>Motivo:</span><select onchange="S.f.mot=this.value;vVigentes()"><option value="">Todos</option>${[...new Set(todos.map(v => v.motivo))].sort().map(m => `<option ${S.f.mot === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></div>`;
  TB = {};
  h += tbl('t-vig', [{ h: 'Usuario', t: 1, v: r => r.usuario, w: 112 }, { h: 'Promotor', t: 1, v: r => r.nombre, w: 210, r: r => `<b>${esc(r.nombre)}</b>` }, { h: 'Motivo', t: 1, v: r => r.motivo, r: r => `<span class="pill b">${MI[r.motivo] || ''} ${esc(r.motivo)}</span>` }, { h: 'Inicio', v: r => r.inicio, r: r => fdate(r.inicio) }, { h: 'Días', v: r => r.dias }, { h: 'Regresa', v: r => r.regreso, r: r => fdate(r.regreso) },
    { h: 'Faltan', v: r => r.faltan, r: r => `<span class="pill ${r.faltan <= 0 ? 'r' : r.faltan <= 3 ? 'a' : 'x'}">${r.faltan <= 0 ? '⏰ hoy' : r.faltan + ' d'}</span>` }, { h: 'Tienda', t: 1, v: r => r.t.nombre || '' }, { h: 'Estado', t: 1, v: r => r.t.estado }, { h: 'Supervisor', t: 1, v: r => r.t.supervisor }, { h: 'Gerente', t: 1, v: r => r.t.gerente }, { h: 'Gerencia RR.HH.', t: 1, v: r => r.t.zona_rrhh }, { h: 'RR.HH.', t: 1, v: r => r.t.rrhh }],
    rows, { fix: 2, search: 1, csv: 1, png: 1, file: 'ausencias_vigentes', titulo: 'Motivos de ausencia', sort: 6, dir: 1, maxh: '72vh' });
  $('content').innerHTML = h; drawAll();
}

/* ---------- acciones (ventana) ---------- */
const cerrarM = () => { $('modal').hidden = true; $('modal').innerHTML = ''; };
function abrir(tipo, id) {
  const a = S.alertas.find(x => x.id === id); if (!a) return;
  const t = tienda(a.idpdv);
  const cab = (tt) => `<h3>${tt}</h3><div class="who">${esc(a.nombre)} · ${esc(a.usuario)}<br>${t ? esc(t.nombre) : ''} · último check ${fdate(a.ultimo)} (${a.dias} días sin check)</div>`;
  let h = '';
  if (tipo === 'aus') {
    const ini = addD(a.ultimo, 1);
    h = cab('Registrar ausencia') + `<div class="fld"><label>Motivo</label><select id="m-mot">${S.cat.motAus.map(m => `<option>${esc(m)}</option>`).join('')}</select></div>
      <div class="row2"><div class="fld"><label>Primer día de ausencia</label><input type="date" id="m-ini" value="${ini}"></div><div class="fld"><label>Días</label><input type="number" id="m-dias" min="1" max="365" value="${Math.max(1, a.dias)}"></div></div>
      <div class="note" id="m-reg"></div><div class="warn" id="m-warn" hidden></div>
      <div class="fld"><label>Comentarios (opcional)</label><textarea id="m-com" placeholder="Folio de incapacidad, quién avisó, etc."></textarea></div>
      <div class="mfoot"><button class="btn" onclick="cerrarM()">Cancelar</button><button class="btn primary" id="m-ok">Guardar ausencia</button></div>`;
  } else if (tipo === 'baja') {
    const vol = S.cat.motBaja.filter(m => m.tipo === 'Voluntaria'), inv = S.cat.motBaja.filter(m => m.tipo !== 'Voluntaria');
    h = cab('Confirmar baja') + `<div class="fld"><label>Motivo de baja</label><select id="m-mot"><optgroup label="Voluntaria">${vol.map(m => `<option>${esc(m.motivo)}</option>`).join('')}</optgroup><optgroup label="Involuntaria">${inv.map(m => `<option>${esc(m.motivo)}</option>`).join('')}</optgroup></select></div>
      <div class="fld"><label>Fecha de baja</label><input type="date" id="m-fecha" value="${HOY}"></div>
      <div class="fld" id="m-marca-w" hidden><label>Marca o cadena destino</label><input id="m-marca" placeholder="Ej. Telcel, Walmart…"></div>
      <div class="fld"><label>Comentarios / adeudos con la agencia</label><textarea id="m-com"></textarea></div>
      <div class="note">La encuesta de salida la contestará el promotor por un enlace (próximamente).</div>
      <div class="mfoot"><button class="btn" onclick="cerrarM()">Cancelar</button><button class="btn danger" id="m-ok">Confirmar baja</button></div>`;
  } else {
    h = cab('Marcar como error de asistencia') + `<p class="muted" style="font-weight:600">Úsalo cuando el promotor sí laboró pero su check no se registró bien (falla de la app, equipo, ubicación…). Sale de la bandeja y no cuenta como ausencia ni baja.</p>
      <div class="mfoot"><button class="btn" onclick="cerrarM()">Cancelar</button><button class="btn primary" id="m-ok">Marcar como error</button></div>`;
  }
  $('modal').innerHTML = `<div class="mbox" role="dialog" aria-modal="true">${h}</div>`; $('modal').hidden = false;
  $('modal').onclick = e => { if (e.target.id === 'modal') cerrarM(); };
  const calc = async () => {
    if (tipo !== 'aus') return;
    const ini = $('m-ini').value, dias = +$('m-dias').value, w = $('m-warn');
    if (!ini || !dias) { $('m-reg').textContent = ''; return; }
    const reg = addD(ini, dias); $('m-reg').textContent = `Regresa el ${fdate(reg)} (${dias} día${dias > 1 ? 's' : ''} desde el ${fdate(ini)}).`;
    const sol = await API.solapes(a.usuario, ini, reg);
    if (sol.length) { w.hidden = false; w.textContent = 'Se traslapa con otra ausencia: ' + sol.map(s => `${s.motivo} (${fdate(s.fecha_inicio)} al ${fdate(addD(s.fecha_regreso, -1))})`).join('; ') + '. Ajusta las fechas.'; } else w.hidden = true;
    $('m-ok').disabled = sol.length > 0;
  };
  if (tipo === 'aus') { $('m-ini').oninput = calc; $('m-dias').oninput = calc; calc(); }
  if (tipo === 'baja') { const mm = () => { $('m-marca-w').hidden = $('m-mot').value !== 'Cambio a marca o cadena'; }; $('m-mot').onchange = mm; mm(); }
  $('m-ok').onclick = async () => {
    const b = $('m-ok'); b.disabled = true; b.textContent = 'Guardando…';
    try {
      if (tipo === 'aus') await API.registrarAusencia(a, { motivo: $('m-mot').value, inicio: $('m-ini').value, dias: +$('m-dias').value, comentarios: $('m-com').value });
      else if (tipo === 'baja') await API.confirmarBaja(a, { motivo: $('m-mot').value, fecha: $('m-fecha').value, marca: $('m-marca').value, comentarios: $('m-com').value });
      else await API.errorAsistencia(a);
      cerrarM(); toast(tipo === 'aus' ? 'Ausencia registrada' : tipo === 'baja' ? 'Baja confirmada' : 'Marcada como error de asistencia');
      S.alertas = S.alertas.filter(x => x.id !== a.id); if (tipo === 'aus') S.vigentes = await API.vigentes(); nav(); render();
    } catch (e) { b.disabled = false; b.textContent = 'Reintentar'; const w = document.createElement('div'); w.className = 'warn'; w.textContent = 'No se pudo guardar: ' + (e.message || e); b.parentElement.before(w); }
  };
}


/* >>> 05_ingresos.js */
/* ====================================================================== POSIBLES INGRESOS ====================================================================== */
const ESTI = ['Programado', 'Confirmado', 'Ingresó', 'No llegó', 'Declinó', 'No contesta', 'Reagenda'];
const ESTC = { 'Programado': 'x', 'Confirmado': 'b', 'Ingresó': 'g', 'No llegó': 'r', 'Declinó': 'r', 'No contesta': 'a', 'Reagenda': 'a' };
const IG = { tab: 'captura', cat: null, grid: [], lista: [], per: '90', loaded: false };
const DIAS_SEM = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const fdia = s => { const d = new Date(s + 'T12:00:00'); return DIAS_SEM[d.getDay()] + ' ' + fdate(s); };

/* ----- datos: real y demo ----- */
Real.catIngresos = async function () {
  const [r, f, v] = await Promise.all([sb.from('catalogo_reclutadores').select('id,nombre').eq('activo', true).order('nombre'), sb.from('catalogo_fuentes').select('id,fuente').order('fuente'), sb.from('catalogo_valores').select('tipo,valor,orden').eq('activo', true).order('orden')]);
  const val = t => (v.data || []).filter(x => x.tipo === t).map(x => x.valor);
  return { recl: r.data || [], fuentes: f.data || [], generado: val('generado_por'), experiencia: val('experiencia'), acomp: val('acompanamiento') };
};
const COLS_CAND = 'id,nombre,telefono,hora_ingreso,idpdv,fecha_programada,estatus,reclutador_id,fuente_id,generado_por,experiencia,acompanamiento,acompanado_por,referido_por,comentarios,usuario_fieldwy,reagendas,origen';
Real.candidatos = function (desde, hasta) { return todo(() => sb.from('candidatos').select(COLS_CAND).gte('fecha_programada', desde).lte('fecha_programada', hasta).order('fecha_programada').order('nombre')); };
Real.insertarCandidatos = async function (rows) {
  const lote = crypto.randomUUID(); let n = 0;
  for (let i = 0; i < rows.length; i += 200) { const parte = rows.slice(i, i + 200).map(r => ({ ...r, lote, origen: 'app' })); const { error } = await sb.from('candidatos').insert(parte); if (error) throw error; n += parte.length; }
  return n;
};
Real.confirmarIngreso = async function (id, datos, hora) { return Real.finRpc('confirmar_ingreso', { p_id: id, p_datos: datos, p_hora: hora || null }); };
Real.datosCandidato = async function (id) { const { data, error } = await sb.from('candidatos_datos').select('*').eq('candidato_id', id).maybeSingle(); if (error) throw error; return data; };
Real.eliminarCandidato = async function (id) { const { error } = await sb.from('candidatos').delete().eq('id', id); if (error) throw error; };
Real.actualizarCandidato = async function (id, patch) { const { error } = await sb.from('candidatos').update(patch).eq('id', id); if (error) throw error; };

Demo.catIngresos = async function () {
  return { recl: ['Julio', 'Itzel', 'Veronica', 'Sandy', 'Blanca', 'Luis', 'Karla Martinez', 'Jessica'].map((n, i) => ({ id: i + 1, nombre: n })), fuentes: ['Redes Sociales', 'Viterbit', 'Personal', 'Campo', 'Campaña', 'Referido', 'Pauta', 'Feria Del Empleo', 'Otros'].map((f, i) => ({ id: i + 1, fuente: f })),
    generado: ['Auxiliar', 'Supervisor', 'Reclutador', 'RR.HH.', 'Gerente', 'Telefónica'], experiencia: ['Ventas y atención al cliente', 'Atención al cliente', 'Ventas', 'Telefonía', 'Ventas de telefonía', 'Sin experiencia'], acomp: ['Ninguno', 'Supervisor', 'Auxiliar', 'Reclutador'] };
};
Demo._cands = null;
Demo.candidatos = async function (desde, hasta) {
  if (!Demo._cands) {
    const ids = Object.keys((await Demo.catalogos()).tiendas).map(Number); let k = 0;
    const nom = ['Alan Torres', 'Brenda Ríos', 'César Lugo', 'Diana Paz', 'Erick Salas', 'Fabiola Cruz', 'Gael Ponce', 'Hilda Mora', 'Iván Rojas', 'Julia Vera', 'Kevin Luna', 'Laura Peña', 'Marco Díaz', 'Nadia Soto', 'Oscar Meza'];
    Demo._cands = [];
    for (let d = -45; d <= 6; d++) for (let j = 0; j < (d < 0 ? 5 : 7); j++) {
      k++; const f = addD(HOY, d); const pas = d < 0 || (d === 0 && j % 2 === 0); const r = (k * 7) % 20;
      Demo._cands.push({ id: 'C' + k, nombre: nom[k % 15] + ' ' + (k % 97), idpdv: ids[(k * 3) % ids.length], fecha_programada: f, estatus: pas ? (r < 12 ? 'Ingresó' : r < 15 ? 'Declinó' : r < 17 ? 'No llegó' : r < 19 ? 'No contesta' : 'Reagenda') : (r < 8 ? 'Confirmado' : 'Programado'), reclutador_id: (k % 8) + 1, fuente_id: (k * 5) % 9 + 1, generado_por: ['Auxiliar', 'Supervisor', 'Reclutador', 'RR.HH.'][k % 4], experiencia: 'Ventas', acompanamiento: 'Ninguno', usuario_fieldwy: null, reagendas: 0, comentarios: null });
    }
  }
  return Demo._cands.filter(c => c.fecha_programada >= desde && c.fecha_programada <= hasta);
};
Demo.insertarCandidatos = async function (rows) { await new Promise(r => setTimeout(r, 300)); rows.forEach(r => Demo._cands.push({ id: 'N' + Math.random(), reagendas: 0, estatus: 'Programado', ...r })); return rows.length; };
Demo.confirmarIngreso = async function (id, datos, hora) { const c = Demo._cands.find(x => x.id === id); Object.assign(c, { estatus: 'Ingresó', hora_ingreso: hora, telefono: datos.telefono, nombre: [datos.nombre_pila, datos.apellido_p, datos.apellido_m].filter(Boolean).join(' ').toUpperCase() }); };
Demo.datosCandidato = async function () { return null };
Demo.eliminarCandidato = async function (id) { Demo._cands = Demo._cands.filter(x => x.id !== id); };
Demo.actualizarCandidato = async function (id, patch) { const c = Demo._cands.find(x => x.id === id); Object.assign(c, patch); };

/* ----- normalización de lo que se pega desde Excel ----- */
function parseFecha(t) {
  t = String(t || '').trim(); if (!t) return '';
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = t.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/); if (m) { let y = +m[3]; if (y < 100) y += 2000; return `${y}-${pad(+m[2])}-${pad(+m[1])}`; }
  return '';
}
function aOpcion(v, lista, mapa) { // lista de textos; devuelve el texto exacto de la lista o ''
  const k = norm(v); if (!k) return '';
  for (const o of lista) if (norm(o) === k) return o;
  for (const o of lista) if (norm(o).includes(k) || (k.length > 3 && k.includes(norm(o)))) return o;
  if (mapa) for (const [pat, dest] of mapa) if (pat.test(k)) { const o = lista.find(x => norm(x) === norm(dest)); if (o) return o; }
  return '';
}
const MAPA_FUENTE = [[/R\.?R\.?S\.?S|REDES/, 'Redes Sociales'], [/CAMPA/, 'Campaña'], [/FERIA/, 'Feria Del Empleo'], [/REFERID/, 'Referido'], [/OTRO/, 'Otros']];
const MAPA_GEN = [[/R\.?R\.?H\.?H|RHHH/, 'RR.HH.'], [/GERENTE/, 'Gerente'], [/TELEFON/, 'Telefónica']];
function aExperiencia(v) {
  const k = norm(v); if (!k) return '';
  const tel = k.includes('TELEFON'), ven = k.includes('VENT'), atc = /ATENC|ATC|CLIE|CLEIN/.test(k);
  const L = IG.cat.experiencia; const g = x => L.find(o => norm(o) === norm(x)) || '';
  if (tel && ven) return g('Ventas de telefonía'); if (tel) return g('Telefonía'); if (ven && atc) return g('Ventas y atención al cliente'); if (atc) return g('Atención al cliente'); if (ven) return g('Ventas'); if (/SIN EXP|NINGUNA/.test(k)) return g('Sin experiencia'); return '';
}
const CAMPOS = [
  { k: 'fecha', h: 'Fecha de ingreso', w: 128, tipo: 'date' }, { k: 'nombre', h: 'Nombre del candidato', w: 210 }, { k: 'tel', h: 'Teléfono de contacto', w: 128 }, { k: 'idpdv', h: 'IDPDV', w: 96 },
  { k: 'fuente', h: 'Medio', w: 140, tipo: 'sel' }, { k: 'generado', h: 'Generado por (puesto)', w: 140, tipo: 'sel' }, { k: 'recl', h: 'Reclutado por', w: 150, tipo: 'sel' },
  { k: 'experiencia', h: 'Experiencia', w: 170, tipo: 'sel' }, { k: 'acomp', h: 'Acompañamiento (puesto)', w: 150, tipo: 'sel' }, { k: 'ingresa', h: 'Ingresa', w: 160, tipo: 'ing' }, { k: 'hora', h: 'Hora de ingreso', w: 100, tipo: 'time' },
  { k: 'referido', h: 'Referido por', w: 130 }, { k: 'coment', h: 'Comentarios', w: 180 }
];
const filaVacia = () => ({ fecha: '', nombre: '', tel: '', idpdv: '', fuente: '', generado: '', recl: S.me && S.me.reclutador_id ? String(S.me.reclutador_id) : '', experiencia: '', acomp: '', ingresa: '', hora: '', referido: '', coment: '' });
/* reclutadores: si el catálogo trae el puesto de cada uno, al elegir "Generado por" solo salen los de ese puesto; si no, salen todos */
const reclPorPuesto = p => { const L = IG.cat.recl, hay = L.some(x => x.puesto); return hay && p ? L.filter(x => !x.puesto || norm(x.puesto) === norm(p)) : L; };
/* nombres sugeridos para "Ingresa" según el puesto de acompañamiento: Supervisor, Líder Telefónica (de la estructura) o Reclutador (catálogo) */
function nombresIngresa(puesto, idpdv) {
  const T = Object.values(S.cat.tiendas), uniq = a => [...new Set(a.filter(Boolean))].sort((x, y) => x.localeCompare(y, 'es')), t = tienda(+idpdv);
  if (puesto === 'Supervisor') { const l = uniq(T.map(x => x.supervisor)); return t && t.supervisor ? [t.supervisor, ...l.filter(x => x !== t.supervisor)] : l; }
  if (puesto === 'Líder Telefónica') { const l = uniq(T.map(x => x.lider)); return t && t.lider ? [t.lider, ...l.filter(x => x !== t.lider)] : l; }
  if (puesto === 'Reclutador') return IG.cat.recl.map(x => x.nombre);
  return [];
}
function opcionesCampo(k, r) {
  const c = IG.cat;
  if (k === 'fuente') return c.fuentes.map(x => [String(x.id), x.fuente]); if (k === 'recl') return reclPorPuesto(r && r.generado).map(x => [String(x.id), x.nombre]);
  if (k === 'generado') return c.generado.map(x => [x, x]); if (k === 'experiencia') return c.experiencia.map(x => [x, x]); if (k === 'acomp') return c.acomp.map(x => [x, x]); return [];
}
function valorPegado(k, t) {
  t = String(t || '').trim();
  if (k === 'fecha') return parseFecha(t);
  if (k === 'idpdv') return t.replace(/\D/g, '');
  if (k === 'tel') return t.replace(/\D/g, '').slice(-10);
  if (k === 'hora') { const m = t.match(/(\d{1,2})[:.](\d{2})/); return m ? pad(+m[1]) + ':' + m[2] : ''; }
  if (k === 'fuente') { const o = aOpcion(t, IG.cat.fuentes.map(x => x.fuente), MAPA_FUENTE); const f = IG.cat.fuentes.find(x => x.fuente === o); return f ? String(f.id) : ''; }
  if (k === 'recl') { const nombre = t.replace(/\s+/g, ' ').trim(); const o = aOpcion(nombre, IG.cat.recl.map(x => x.nombre)); const f = IG.cat.recl.find(x => x.nombre === o); return f ? String(f.id) : ''; }
  if (k === 'generado') return aOpcion(t, IG.cat.generado, MAPA_GEN);
  if (k === 'experiencia') return aExperiencia(t);
  if (k === 'acomp') return aOpcion(t, IG.cat.acomp);
  return t;
}
function errorFila(r) {
  const e = {};
  if (!r.fecha) e.fecha = 'Falta la fecha'; else if (r.fecha < addD(HOY, -1)) e.fecha = 'Fecha pasada';
  if (r.nombre.trim().length < 5) e.nombre = 'Escribe nombre completo';
  if (!r.idpdv) e.idpdv = 'Falta IDPDV'; else if (!tienda(+r.idpdv)) e.idpdv = 'IDPDV no existe';
  if (!r.fuente) e.fuente = 'Elige el medio'; if (!r.recl) e.recl = 'Elige reclutador'; if (r.tel && r.tel.length !== 10) e.tel = 'El teléfono debe tener 10 dígitos';
  return e;
}
const vacia = r => !r.fecha && !r.nombre && !r.idpdv && !r.fuente && !(r.generado || r.experiencia || r.referido || r.coment || r.tel || r.ingresa || r.hora);

/* ----- vista principal ----- */
async function vIngresos() {
  if (!IG.loaded) { $('content').innerHTML = cab('Posibles ingresos', 'Cargando…', 'mochila'); IG.cat = await API.catIngresos(); IG.grid = Array.from({ length: 12 }, filaVacia); IG.tab = can('posibles_ingresos', 'crear') ? 'captura' : 'seguimiento'; IG.loaded = true; }
  const T = [['captura', '✍️ Captura', can('posibles_ingresos', 'crear')], ['seguimiento', '📅 Seguimiento', true], ['resumen', '🗺️ Resumen', true], ['detalle', '📊 Detalle', true]].filter(x => x[2]);
  if (!T.find(x => x[0] === IG.tab)) IG.tab = T[0][0];
  let h = cab('Posibles ingresos', 'Programa los ingresos (en bloque o uno por uno), da seguimiento por región, confirma quién ingresó y mide qué reclutadores y medios convierten. El periodo se elige arriba.', 'mochila');
  h += `<div class="tools">${T.map(([k, n]) => `<button class="chip ${IG.tab === k ? 'on' : ''}" onclick="IG.tab='${k}';vIngresos()">${n}</button>`).join('')}</div><div id="ig-body"><div class="loading">Cargando…</div></div>`;
  $('content').innerHTML = h;
  try { if (IG.tab !== 'captura') { const r = rangoLibre(); await asegurarCands(r.desde, r.hasta); } else if (!IG.lista.length) await cargarCands(); } catch (e) { $('ig-body').innerHTML = `<div class="warn">No se pudieron cargar los candidatos: ${esc(e.message || e)}</div>`; return; }
  ({ captura: tCaptura, seguimiento: tSeguimiento, resumen: tResumen, detalle: tDetalle })[IG.tab]();
}
IG.rng = null;
async function cargarCands(d, h) { d = d || (IG.rng ? IG.rng[0] : addD(HOY, -120)); h = h || (IG.rng ? IG.rng[1] : addD(HOY, 60)); IG.lista = await API.candidatos(d, h); IG.rng = [d, h]; }
async function asegurarCands(d, h) {   // carga solo lo que falta del rango pedido (el periodo de arriba puede ir a fechas viejas o futuras)
  d = d < '2020-01-01' ? '2020-01-01' : d; h = h > addD(HOY, 120) ? addD(HOY, 120) : h;
  if (IG.rng && d >= IG.rng[0] && h <= IG.rng[1]) return;
  await cargarCands(IG.rng ? (d < IG.rng[0] ? d : IG.rng[0]) : (d < addD(HOY, -120) ? d : addD(HOY, -120)), IG.rng ? (h > IG.rng[1] ? h : IG.rng[1]) : (h > addD(HOY, 60) ? h : addD(HOY, 60)));
}

/* ----- captura masiva ----- */
function tCaptura() {
  const prop = S.me.permisos.posibles_ingresos.alcance === 'propio';
  let h = `<div class="card"><div class="note">Copia las filas de tu Excel (sin encabezados) en este orden: <b>fecha · nombre · teléfono · IDPDV · medio · generado por (puesto) · reclutado por · experiencia · acompañamiento (puesto) · ingresa · hora de ingreso · referido por · comentarios</b>, haz clic en la primera celda y pega con <b>Ctrl+V</b>. También puedes escribir directo. Lo que no se reconozca queda en rojo para que lo corrijas.</div>
  <datalist id="dl-ing"></datalist>
  <div class="tools"><button class="btn sm primary" onclick="modalCandidato()">➕ Nuevo ingreso individual</button><button class="btn sm" onclick="IG.grid.push(...Array.from({length:10},filaVacia));tCaptura()">+ 10 filas</button><button class="btn sm" onclick="limpiarVacias()">Quitar filas vacías</button><label class="btn sm xl-btn">📂 Cargar Excel<input type="file" accept=".xlsx,.xls,.csv" hidden onchange="importarExcel(this.files[0]);this.value=''"></label><button class="btn sm" onclick="IG.grid=Array.from({length:12},filaVacia);tCaptura()">Empezar de nuevo</button><span class="muted" id="g-res"></span><button class="btn primary" id="g-ok" style="margin-left:auto" onclick="guardarGrid()">Guardar candidatos</button></div>
  <div class="tbl-wrap grid-wrap"><table class="dt gt" id="gt"><thead><tr><th>#</th>${CAMPOS.map(c => `<th style="min-width:${c.w}px">${c.h}</th>`).join('')}<th></th></tr></thead><tbody>${IG.grid.map((r, i) => filaGrid(r, i)).join('')}</tbody></table></div></div>`;
  $('ig-body').innerHTML = h; resumenGrid();
  const t = $('gt');
  t.addEventListener('change', e => { const el = e.target.closest('[data-r]'); if (!el || CAMPOS[+el.dataset.c].k !== 'generado') return; const i = +el.dataset.r, j = CAMPOS.findIndex(c => c.k === 'recl'), rs = t.querySelector('#gr' + i + ' select[data-c="' + j + '"]'); if (rs) { rs.innerHTML = '<option value=""></option>' + reclPorPuesto(IG.grid[i].generado).map(x => `<option value="${x.id}" ${String(x.id) === IG.grid[i].recl ? 'selected' : ''}>${esc(x.nombre)}</option>`).join(''); } });
  t.addEventListener('paste', e => {
    const el = e.target.closest('[data-r]'); if (!el) return; const txt = (e.clipboardData || window.clipboardData).getData('text'); if (!txt || !/[\t\n]/.test(txt)) return; e.preventDefault();
    const r0 = +el.dataset.r, c0 = +el.dataset.c; const filas = txt.replace(/\r/g, '').split('\n'); if (filas[filas.length - 1] === '') filas.pop();
    filas.forEach((ln, i) => { while (IG.grid.length <= r0 + i) IG.grid.push(filaVacia()); ln.split('\t').forEach((v, j) => { const c = CAMPOS[c0 + j]; if (c) IG.grid[r0 + i][c.k] = valorPegado(c.k, v); }); });
    tCaptura(); toast(filas.length + ' fila' + (filas.length > 1 ? 's' : '') + ' pegada' + (filas.length > 1 ? 's' : ''));
  });
  t.addEventListener('input', e => { const el = e.target.closest('[data-r]'); if (!el) return; const r = IG.grid[+el.dataset.r], k = CAMPOS[+el.dataset.c].k; r[k] = k === 'idpdv' ? el.value.replace(/\D/g, '') : el.value; if (k === 'idpdv') { const t2 = tienda(+r.idpdv); const s = $('ts' + el.dataset.r); if (s) s.textContent = t2 ? t2.nombre : (r.idpdv ? 'IDPDV no existe' : ''); el.title = ''; } marcar(+el.dataset.r); resumenGrid(); });
}
function filaGrid(r, i) {
  const e = errorFila(r), vac = vacia(r);
  const celda = (c, j) => {
    const bad = !vac && e[c.k] ? 'bad' : '', ttl = !vac && e[c.k] ? ` title="${esc(e[c.k])}"` : '';
    if (c.tipo === 'sel') return `<td class="${bad}"${ttl}><select data-r="${i}" data-c="${j}"><option value=""></option>${opcionesCampo(c.k, r).map(([v, t]) => `<option value="${esc(v)}" ${v === r[c.k] ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></td>`;
    if (c.tipo === 'time') return `<td class="${bad}"${ttl}><input type="time" data-r="${i}" data-c="${j}" value="${esc(r.hora)}"></td>`;
    if (c.tipo === 'ing') return `<td class="${bad}"${ttl}><input data-r="${i}" data-c="${j}" list="dl-ing" value="${esc(r.ingresa)}" onfocus="IG.gi=${i};ingListaFila(${i})"></td>`;
    if (c.tipo === 'date') return `<td class="${bad}"${ttl}><input type="date" data-r="${i}" data-c="${j}" value="${esc(r.fecha)}"></td>`;
    if (c.k === 'idpdv') { const t = tienda(+r.idpdv); return `<td class="${bad}"${ttl}><input data-r="${i}" data-c="${j}" inputmode="numeric" value="${esc(r.idpdv)}"><small id="ts${i}" class="ts">${t ? esc(t.nombre) : (r.idpdv ? 'IDPDV no existe' : '')}</small></td>`; }
    return `<td class="${bad}"${ttl}><input data-r="${i}" data-c="${j}" value="${esc(r[c.k])}"></td>`;
  };
  return `<tr id="gr${i}" class="${vac ? 'vac' : ''}"><td class="n">${i + 1}</td>${CAMPOS.map(celda).join('')}<td><button class="btn sm" title="Quitar fila" onclick="IG.grid.splice(${i},1);tCaptura()">✕</button></td></tr>`;
}
function ingListaFila(i) { const r = IG.grid[i], dl = $('dl-ing'); if (dl) dl.innerHTML = nombresIngresa(r.acomp, r.idpdv).map(n => `<option value="${esc(n)}">`).join(''); }
function marcar(i) { const tr = $('gr' + i); if (!tr) return; const r = IG.grid[i], e = errorFila(r), vac = vacia(r); tr.classList.toggle('vac', vac); CAMPOS.forEach((c, j) => { const td = tr.children[j + 1]; if (td) td.classList.toggle('bad', !vac && !!e[c.k]); }); }
function resumenGrid() {
  const llenas = IG.grid.filter(r => !vacia(r)), malas = llenas.filter(r => Object.keys(errorFila(r)).length);
  const dup = llenas.filter((r, i) => llenas.findIndex(x => norm(x.nombre) === norm(r.nombre) && x.fecha === r.fecha && x.nombre) !== i).length;
  const ya = llenas.filter(r => IG.lista.some(c => norm(c.nombre) === norm(r.nombre) && c.fecha_programada === r.fecha)).length;
  if ($('g-res')) $('g-res').innerHTML = `<b>${llenas.length}</b> fila${llenas.length === 1 ? '' : 's'} con datos · <span style="color:${malas.length ? 'var(--red)' : 'var(--green)'};font-weight:800">${malas.length} con errores</span>${dup + ya ? ` · <span style="color:var(--amber);font-weight:800">${dup + ya} posible${dup + ya > 1 ? 's' : ''} duplicado${dup + ya > 1 ? 's' : ''}</span>` : ''}`;
  if ($('g-ok')) $('g-ok').disabled = !llenas.length || malas.length > 0;
}
function limpiarVacias() { IG.grid = IG.grid.filter(r => !vacia(r)); while (IG.grid.length < 8) IG.grid.push(filaVacia()); tCaptura(); }
async function guardarGrid() {
  const llenas = IG.grid.filter(r => !vacia(r)); if (!llenas.length) return;
  const b = $('g-ok'); b.disabled = true; b.textContent = 'Guardando…';
  const rows = llenas.map(r => ({ nombre: r.nombre.replace(/\s+/g, ' ').trim(), telefono: r.tel || null, hora_ingreso: r.hora || null, acompanado_por: r.ingresa.trim() || null, idpdv: +r.idpdv, fecha_captura: HOY, fecha_programada: r.fecha, reclutador_id: +r.recl, fuente_id: +r.fuente, generado_por: r.generado || null, experiencia: r.experiencia || null, acompanamiento: r.acomp || null, referido_por: r.referido.trim() || null, comentarios: r.coment.trim() || null }));
  try { const n = await API.insertarCandidatos(rows); toast(n + ' candidato' + (n > 1 ? 's' : '') + ' guardado' + (n > 1 ? 's' : '')); IG.grid = Array.from({ length: 12 }, filaVacia); await cargarCands(); IG.tab = 'seguimiento'; vIngresos(); }
  catch (e) { b.disabled = false; b.textContent = 'Guardar candidatos'; toast('No se pudo guardar: ' + (e.message || e)); }
}

/* ----- importar Excel ----- */
const ENC = { fecha: /^(FECHA|DIA|FECHA DE INGRESO)/, nombre: /^NOMBRE/, tel: /^(TEL|CELULAR)/, ingresa: /^INGRESA/, hora: /^HORA/, idpdv: /^ID ?PDV/, fuente: /^MEDIO/, recl: /^RECLUTADO/, generado: /^GENERADO/, experiencia: /^EXPERIENCIA/, acomp: /^ACOMPA/, referido: /^REFERIDO/, coment: /^COMENT/ };
function celdaTxt(v, k) {
  if (v == null || v === '') return '';
  if (k === 'fecha' && typeof v === 'number') { const d = new Date(Math.round((v - 25569) * 864e5)); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  if (k === 'fecha' && v instanceof Date) return v.getFullYear() + '-' + pad(v.getMonth() + 1) + '-' + pad(v.getDate());
  return String(v);
}
async function importarExcel(file) {
  if (!file) return;
  if (!window.XLSX) { toast('El lector de Excel no cargó (revisa tu conexión).'); return; }
  try {
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true }); const ws = wb.Sheets[wb.SheetNames[0]];
    const m = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
    let hi = m.slice(0, 15).findIndex(r => r.some(c => /^NOMBRE/.test(norm(c))));
    const map = {}; if (hi >= 0) m[hi].forEach((c, j) => { const n = norm(c); for (const [k, re] of Object.entries(ENC)) if (re.test(n) && map[k] == null) map[k] = j; });
    const filas = m.slice(hi + 1).filter(r => r.some(c => String(c).trim() !== ''));
    const orden = CAMPOS.map(c => c.k); let n = 0, vac = 0;
    const nuevas = filas.map(r => { const o = filaVacia(); orden.forEach((k, j) => { const col = hi >= 0 && Object.keys(map).length >= 3 ? map[k] : j; if (col != null) o[k] = valorPegado(k, celdaTxt(r[col], k)); }); return o; }).filter(o => o.nombre || o.idpdv);
    IG.grid = IG.grid.filter(r => !vacia(r)).concat(nuevas); while (IG.grid.length < 12) IG.grid.push(filaVacia());
    tCaptura(); toast(`${nuevas.length} fila${nuevas.length === 1 ? '' : 's'} leída${nuevas.length === 1 ? '' : 's'} del Excel: revisa las que quedaron en rojo`);
  } catch (e) { console.error(e); toast('No pude leer el archivo: ' + (e.message || e)); }
}

/* ----- seguimiento: etiquetas por región ----- */
const okAlc = c => c.idpdv == null ? !Object.values(FL).some(Boolean) : okI(c.idpdv);
const nombreRecl = id => (IG.cat.recl.find(x => x.id === id) || {}).nombre || '—';
const nombreFuente = id => (IG.cat.fuentes.find(x => x.id === id) || {}).fuente || '—';
const PEND = ['Programado', 'Confirmado', 'Reagenda'];
const SEST = [['', 'Todos'], ['pend', '⏳ Pendientes'], ['Ingresó', '🙌 Ingresaron'], ['No llegó', '🚫 No llegó'], ['Declinó', '✖️ Declinó'], ['No contesta', '📵 No contesta']];
const hh5 = h => h ? String(h).slice(0, 5) : '';
const quienIngresa = c => c.acompanamiento && c.acompanamiento !== 'Ninguno' ? (c.acompanamiento + (c.acompanado_por ? ' · ' + c.acompanado_por : '')) : (c.acompanado_por || 'Sin acompañamiento');
function tSeguimiento() {
  const r = rangoLibre(), todos = IG.lista.filter(okAlc), pen = c => PEND.includes(c.estatus);
  const enP = todos.filter(c => c.fecha_programada >= r.desde && c.fecha_programada <= r.hasta), est = IG.sest || '';
  const porCerrar = todos.filter(c => c.fecha_programada < HOY && pen(c)).length, man = todos.filter(c => c.fecha_programada === addD(HOY, 1));
  const q = norm(IG.sq || ''), f = enP.filter(c => (!est || (est === 'pend' ? pen(c) : c.estatus === est)) && (!q || norm(c.nombre + ' ' + (c.telefono || '')).includes(q)));
  let h = `<div class="kpis"><div class="kpi"><div class="l">📅 Programados mañana</div><div class="v">${man.length}</div><div class="s">${man.filter(c => c.estatus === 'Confirmado').length} confirmados</div></div>
    <div class="kpi"><div class="l">☀️ Programados hoy</div><div class="v">${todos.filter(c => c.fecha_programada === HOY).length}</div><div class="s">${todos.filter(c => c.fecha_programada === HOY && c.estatus === 'Ingresó').length} ya ingresaron</div></div>
    <div class="kpi ${porCerrar ? 'click' : ''}" onclick="PL.modo='rango';PL.desde=addD(HOY,-30);PL.hasta=addD(HOY,-1);IG.sest='pend';render()"><div class="l">⏰ Por cerrar</div><div class="v" style="color:${porCerrar ? 'var(--red)' : 'var(--green)'}">${porCerrar}</div><div class="s">fecha pasada sin resultado</div></div>
    <div class="kpi"><div class="l">En el periodo</div><div class="v">${enP.length}</div><div class="s">${enP.filter(c => c.estatus === 'Ingresó').length} ingresaron · ${enP.filter(pen).length} pendientes</div></div></div>`;
  h += `<div class="tools" data-nocap>${SEST.map(([k, n]) => `<button class="chip ${est === k ? 'on' : ''}" onclick="IG.sest='${k}';tSeguimiento()">${n} (${k === '' ? enP.length : k === 'pend' ? enP.filter(pen).length : enP.filter(c => c.estatus === k).length})</button>`).join('')}<input type="search" id="sg-q" placeholder="🔎 Buscar nombre o teléfono…" value="${esc(IG.sq || '')}">
    <button class="btn sm" onclick="capturaDescargar($('ing-wrap'),'Posibles ingresos · ${esc(rangoTxt(r))}',subFiltros(),'posibles_ingresos')">📸 Imagen</button><button class="btn sm" onclick="capturaCopiar($('ing-wrap'),'Posibles ingresos · ${esc(rangoTxt(r))}',subFiltros())">📋 Copiar imagen para WhatsApp</button></div>`;
  const MAX = 300, vis = f.slice(0, MAX);
  if (!f.length) h += `<div class="card empty"><img src="${img('pulgares')}" alt="">No hay candidatos con estos filtros y periodo.</div>`;
  const reg = new Map(); vis.forEach(c => { const k = (tienda(c.idpdv) || {}).region || 'Sin región'; if (!reg.has(k)) reg.set(k, []); reg.get(k).push(c); });
  h += `<div id="ing-wrap" class="err-dia">${[...reg].sort((a, b) => a[0].localeCompare(b[0], 'es')).map(([rg, xs]) => `<div class="err-sup"><h4>🗺️ ${esc(rg)} <small>${xs.length} candidato${xs.length === 1 ? '' : 's'} · ${xs.filter(c => c.estatus === 'Ingresó').length} ingresaron</small></h4>${xs.sort((a, b) => a.fecha_programada.localeCompare(b.fecha_programada) || (a.hora_ingreso || '').localeCompare(b.hora_ingreso || '') || a.nombre.localeCompare(b.nombre, 'es')).map(filaCand).join('')}</div>`).join('')}</div>`;
  if (f.length > MAX) h += `<p class="muted">Mostrando ${MAX} de ${f.length}: acota el periodo o usa los filtros de arriba.</p>`;
  $('ig-body').innerHTML = h;
  $('sg-q').oninput = e => { IG.sq = e.target.value; clearTimeout(IG.t); IG.t = setTimeout(() => { const p = e.target.selectionStart; tSeguimiento(); const q2 = $('sg-q'); q2.focus(); q2.setSelectionRange(p, p); }, 250); };
}
const rangoTxt = r => r.desde === r.hasta ? fdia(r.desde) : r.todo ? 'todo el histórico' : fdate(r.desde) + ' al ' + fdate(r.hasta);
function filaCand(c) {
  const t = tienda(c.idpdv) || {}, ed = can('posibles_ingresos', 'editar');
  const ac = ed ? `<div class="acts" data-nocap>${c.estatus === 'Programado' ? `<button class="btn sm" onclick="cambiarEst('${c.id}','Confirmado')">✔️ Confirmó</button>` : ''}
    ${c.estatus !== 'Ingresó' ? `<button class="btn sm primary" onclick="modalIngreso('${c.id}')">🙌 Ingresó</button><button class="btn sm" onclick="cambiarEst('${c.id}','No llegó')">🚫 No llegó</button><button class="btn sm" onclick="cambiarEst('${c.id}','No contesta')">📵 No contesta</button><button class="btn sm" onclick="cambiarEst('${c.id}','Declinó')">✖️ Declinó</button><button class="btn sm" onclick="modalReagendar('${c.id}')">🔁 Reagendar</button>` : `<button class="btn sm" onclick="modalIngreso('${c.id}')">👤 Datos</button>`}
    <button class="btn sm" onclick="modalCandidato('${c.id}')">✏️ Editar</button>${can('posibles_ingresos', 'borrar') ? `<button class="btn sm danger" onclick="eliminarCand('${c.id}')" title="Solo candidatos creados por error">🗑</button>` : ''}</div>` : '';
  return `<div class="err-card"><div class="err-h"><b>${esc(c.nombre)}</b><small>📞 ${esc(c.telefono || 'sin teléfono')} · ${fdia(c.fecha_programada)}${c.hora_ingreso ? ' · ⏰ ' + hh5(c.hora_ingreso) : ''}</small></div>
    <div>${pillx(esc(c.estatus), ESTC[c.estatus] || 'x')} <small class="muted">IDPDV ${c.idpdv || '—'} · ${esc(t.nombre || 'Tienda no identificada')}${t.cadena ? ' · ' + esc(t.cadena) : ''}</small></div>
    <div class="muted" style="font-size:12px;font-weight:600">🧍 Ingresa: ${esc(quienIngresa(c))} · ${esc(nombreFuente(c.fuente_id))} · ${esc(nombreRecl(c.reclutador_id))}${c.reagendas ? ' · reagendó ' + c.reagendas + 'x' : ''}${c.usuario_fieldwy ? ' · ' + esc(c.usuario_fieldwy) : ''}</div>${ac}</div>`;
}
async function cambiarEst(id, est) { try { await API.actualizarCandidato(id, { estatus: est }); IG.lista.find(x => x.id === id).estatus = est; toast(est); tSeguimiento(); } catch (e) { toast('No se pudo guardar: ' + (e.message || e)); } }
async function eliminarCand(id) {
  const c = IG.lista.find(x => x.id === id); if (!confirm(`¿Eliminar a "${c.nombre}"? Solo debe usarse para candidatos creados por error. No se puede deshacer.`)) return;
  try { await API.eliminarCandidato(id); IG.lista = IG.lista.filter(x => x.id !== id); toast('Candidato eliminado'); tSeguimiento(); } catch (e) { toast('No se pudo eliminar: ' + (e.message || e)); }
}

/* ----- confirmar que ingresó: datos de identidad (los mismos que pide Fieldway) y pase automático a Altas ----- */
async function modalIngreso(id) {
  const c = IG.lista.find(x => x.id === id); let p = null; try { p = await API.datosCandidato(id); } catch (e) { }
  if (!p) { const sp = splitNombre(c.nombre); p = { nombre_pila: sp.n, apellido_p: sp.ap, apellido_m: sp.am, telefono: c.telefono || '' }; }
  $('modal').innerHTML = `<div class="mbox wide" style="width:min(720px,96vw);max-height:92vh;overflow:auto" role="dialog" aria-modal="true"><h3>🙌 ${c.estatus === 'Ingresó' ? 'Datos del ingreso' : 'Confirmar ingreso'}</h3><div class="who">${esc(c.nombre)} · ${fdate(c.fecha_programada)} · IDPDV ${c.idpdv || '—'} ${esc((tienda(c.idpdv) || {}).nombre || '')}</div>
    <div class="note">Confirma los datos como se capturan en Fieldway. Al guardar, el ingreso pasa a <b>Altas</b> (aquí queda el histórico) para que se genere su usuario.</div>
    ${identidadCampos(p, 'ci-')}<div class="row2"><div class="fld"><label>Hora de ingreso</label><input id="ci-hora" type="time" value="${esc(hh5(c.hora_ingreso))}"></div><div></div></div>
    <div class="warn" id="ci-warn" hidden></div><div class="mfoot"><button class="btn" onclick="cerrarM()">Cancelar</button><button class="btn primary" id="ci-ok">${c.estatus === 'Ingresó' ? 'Guardar datos' : 'Confirmar y pasar a Altas'}</button></div></div>`;
  $('modal').hidden = false; $('modal').onclick = e => { if (e.target.id === 'modal') cerrarM(); };
  $('ci-ok').onclick = async () => {
    const d = idLeer('ci-'), er = idErrores(d), w = $('ci-warn'); if (er.length) { w.hidden = false; w.innerHTML = er.map(esc).join('<br>'); return; }
    $('ci-ok').disabled = true;
    try { await API.confirmarIngreso(id, d, $('ci-hora').value || null); c.estatus = 'Ingresó'; c.telefono = d.telefono; c.hora_ingreso = $('ci-hora').value || null; c.nombre = [d.nombre_pila, d.apellido_p, d.apellido_m].filter(Boolean).join(' ').toUpperCase(); cerrarM(); toast('Ingreso confirmado: pasa a Altas'); tSeguimiento(); }
    catch (e) { $('ci-ok').disabled = false; w.hidden = false; w.textContent = 'No se pudo guardar: ' + (e.message || e); }
  };
}
function modalReagendar(id) {
  const c = IG.lista.find(x => x.id === id);
  $('modal').innerHTML = `<div class="mbox"><h3>🔁 Reagendar</h3><div class="who">${esc(c.nombre)} · estaba para ${fdate(c.fecha_programada)}</div><div class="row2"><div class="fld"><label>Nueva fecha</label><input type="date" id="m-f" value="${addD(HOY, 1)}" min="${HOY}"></div><div class="fld"><label>Hora de ingreso</label><input type="time" id="m-h" value="${esc(hh5(c.hora_ingreso))}"></div></div><div class="mfoot"><button class="btn" onclick="cerrarM()">Cancelar</button><button class="btn primary" id="m-ok">Reagendar</button></div></div>`; $('modal').hidden = false;
  $('modal').onclick = e => { if (e.target.id === 'modal') cerrarM(); };
  $('m-ok').onclick = async () => { const f = $('m-f').value; if (!f) return; try { const patch = { fecha_programada: f, estatus: 'Programado', reagendas: (c.reagendas || 0) + 1, hora_ingreso: $('m-h').value || null }; await API.actualizarCandidato(id, patch); Object.assign(c, patch); cerrarM(); toast('Reagendado para ' + fdate(f) + ' (queda el historial del cambio)'); tSeguimiento(); } catch (e) { toast('No se pudo guardar: ' + (e.message || e)); } };
}

/* ----- alta individual y edición de lo capturado ----- */
function modalCandidato(id) {
  const c = id ? IG.lista.find(x => x.id === id) : null, v = k => esc(c ? (c[k] == null ? '' : c[k]) : ''), t = c ? tienda(c.idpdv) : null;
  const sel = (idc, lista, val, ph) => `<select id="${idc}"><option value="">${ph || '— elige —'}</option>${lista.map(([a, b]) => `<option value="${esc(a)}" ${String(a) === String(val) ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>`;
  const cat = IG.cat;
  $('modal').innerHTML = `<div class="mbox wide" style="width:min(760px,96vw);max-height:92vh;overflow:auto" role="dialog" aria-modal="true"><h3>${c ? '✏️ Editar posible ingreso' : '➕ Nuevo posible ingreso'}</h3>
    <datalist id="cd-tl">${Object.values(S.cat.tiendas).map(x => `<option value="${x.idpdv} · ${esc(x.nombre)} (${esc(x.cadena || '')} · ${esc(x.estado || '')})">`).join('')}</datalist><datalist id="cd-ing"></datalist>
    <div class="row2"><div class="fld"><label>Fecha de ingreso *</label><input type="date" id="cd-f" value="${v('fecha_programada') || HOY}"></div><div class="fld"><label>Hora de ingreso</label><input type="time" id="cd-h" value="${esc(hh5(c && c.hora_ingreso))}"></div></div>
    <div class="row2"><div class="fld"><label>Nombre completo del candidato *</label><input id="cd-n" value="${v('nombre')}" autocomplete="off"></div><div class="fld"><label>Teléfono de contacto (10 dígitos)</label><input id="cd-t" inputmode="numeric" value="${v('telefono')}"></div></div>
    <div class="fld"><label>Tienda * (IDPDV o nombre)</label><input id="cd-p" list="cd-tl" value="${t ? esc(c.idpdv + ' · ' + t.nombre + ' (' + (t.cadena || '') + ' · ' + (t.estado || '') + ')') : ''}" placeholder="Escribe IDPDV o nombre…" oninput="cdIng()"></div>
    <div class="row2"><div class="fld"><label>Medio *</label>${sel('cd-fu', cat.fuentes.map(x => [x.id, x.fuente]), c && c.fuente_id)}</div><div class="fld"><label>Generado por (puesto)</label>${sel('cd-g', cat.generado.map(x => [x, x]), c && c.generado_por)}</div></div>
    <div class="row2"><div class="fld"><label>Reclutado por *</label><select id="cd-r"></select></div><div class="fld"><label>Experiencia</label>${sel('cd-ex', cat.experiencia.map(x => [x, x]), c && c.experiencia)}</div></div>
    <div class="row2"><div class="fld"><label>Acompañamiento (puesto)</label>${sel('cd-a', cat.acomp.map(x => [x, x]), c && c.acompanamiento)}</div><div class="fld"><label>Ingresa (nombre)</label><input id="cd-i" list="cd-ing" value="${v('acompanado_por')}" autocomplete="off"></div></div>
    <div class="row2"><div class="fld"><label>Referido por</label><input id="cd-rf" value="${v('referido_por')}"></div><div class="fld"><label>Comentarios</label><input id="cd-c" value="${v('comentarios')}"></div></div>
    <div class="warn" id="cd-warn" hidden></div><div class="mfoot"><button class="btn" onclick="cerrarM()">Cancelar</button><button class="btn primary" id="cd-ok">Guardar</button></div></div>`;
  $('modal').hidden = false; $('modal').onclick = e => { if (e.target.id === 'modal') cerrarM(); };
  const pintaRecl = () => { const sv = $('cd-r').value || (c ? String(c.reclutador_id || '') : (S.me && S.me.reclutador_id ? String(S.me.reclutador_id) : '')); $('cd-r').innerHTML = '<option value="">— elige —</option>' + reclPorPuesto($('cd-g').value).map(x => `<option value="${x.id}" ${String(x.id) === sv ? 'selected' : ''}>${esc(x.nombre)}</option>`).join(''); };
  $('cd-g').onchange = pintaRecl; $('cd-a').onchange = cdIng; pintaRecl(); cdIng();
  $('cd-ok').onclick = () => candGuardar(id);
}
function cdIng() { const dl = $('cd-ing'); if (!dl) return; dl.innerHTML = nombresIngresa($('cd-a').value, parseInt($('cd-p').value, 10)).map(n => `<option value="${esc(n)}">`).join(''); }
async function candGuardar(id) {
  const g = k => limpia($(k).value), w = $('cd-warn'), idp = parseInt(g('cd-p'), 10), tel = g('cd-t').replace(/\D/g, ''), e = [];
  if (!$('cd-f').value) e.push('Falta la fecha de ingreso.'); if (g('cd-n').length < 5) e.push('Escribe el nombre completo.'); if (!idp || !tienda(idp)) e.push('Elige una tienda de la lista (empieza con su IDPDV).');
  if (!$('cd-fu').value) e.push('Elige el medio.'); if (!$('cd-r').value) e.push('Elige quién reclutó.'); if (tel && tel.length !== 10) e.push('El teléfono debe tener 10 dígitos.');
  if (e.length) { w.hidden = false; w.innerHTML = e.map(esc).join('<br>'); return; }
  const row = { nombre: g('cd-n').replace(/\s+/g, ' ').toUpperCase(), telefono: tel || null, idpdv: idp, fecha_programada: $('cd-f').value, hora_ingreso: $('cd-h').value || null, fuente_id: +$('cd-fu').value, reclutador_id: +$('cd-r').value, generado_por: $('cd-g').value || null,
    experiencia: $('cd-ex').value || null, acompanamiento: $('cd-a').value || null, acompanado_por: g('cd-i') || null, referido_por: g('cd-rf') || null, comentarios: g('cd-c') || null };
  $('cd-ok').disabled = true;
  try {
    if (id) { const c = IG.lista.find(x => x.id === id); if (row.fecha_programada !== c.fecha_programada && PEND.includes(c.estatus)) row.reagendas = (c.reagendas || 0) + 1; await API.actualizarCandidato(id, row); Object.assign(c, row); toast('Cambios guardados (queda el historial)'); }
    else { await API.insertarCandidatos([{ ...row, fecha_captura: HOY }]); await cargarCands(); toast('Posible ingreso guardado'); }
    cerrarM(); if (IG.tab === 'captura') IG.tab = 'seguimiento'; vIngresos();
  } catch (x) { $('cd-ok').disabled = false; w.hidden = false; w.textContent = 'No se pudo guardar: ' + (x.message || x); }
}

/* ----- esquema por región, gerente y cadena (pestaña Resumen) ----- */
const CADS = ['Coppel', 'Elektra', 'Suburbia', 'Cimaco'];
function esquemaHtml(rows) {
  const cad = [...CADS, ...new Set(rows.map(c => (tienda(c.idpdv) || {}).cadena).filter(x => x && !CADS.includes(x)))];
  return `<div>` + arbol(rows, [...cad.map(c => ({ h: c, f: a => a.filter(x => (tienda(x.idpdv) || {}).cadena === c).length })), { h: 'Total general', f: a => a.length, cero: true }], { titulo: 'REGIÓN / GERENTE / SUPERVISOR / TIENDA', abrir: 2 }) + '</div>';
}
function tResumen() {
  const r = rangoLibre(), base = IG.lista.filter(okAlc).filter(c => c.fecha_programada >= r.desde && c.fecha_programada <= r.hasta && (PEND.includes(c.estatus) || c.estatus === 'Ingresó'));
  $('ig-body').innerHTML = sect('Esquema por región, gerente y cadena', '🗺️') + `<p class="note">${fmt(base.length)} ingresos (pendientes e ingresados) · ${esc(rangoTxt(r))}. Es el esquema que se comparte con Operaciones; cambia el periodo arriba.</p>
    <div class="tools" data-nocap><button class="btn sm" onclick="capturaDescargar($('esq-wrap'),'Esquema de posibles ingresos · ${esc(rangoTxt(r))}',subFiltros(),'esquema_ingresos')">📸 Imagen</button><button class="btn sm" onclick="capturaCopiar($('esq-wrap'),'Esquema de posibles ingresos · ${esc(rangoTxt(r))}',subFiltros())">📋 Copiar imagen</button></div><div id="esq-wrap" class="cap-pad">${esquemaHtml(base)}</div>`;
  drawAll();
}

/* ----- resumen y conversión ----- */
const VER = [['cand', 'Candidato'], ['supervisor', 'Supervisor'], ['zona_rrhh', 'Gerencia RR.HH.'], ['rrhh', 'RR.HH.'], ['recl', 'Reclutador'], ['fuente', 'Medio'], ['estado', 'Estado'], ['region', 'Región']];
function tDetalle() {
  const rr = rangoLibre(), desde = rr.desde, hasta = rr.hasta;
  const base = IG.lista.filter(okAlc).filter(x => x.fecha_programada >= desde && x.fecha_programada <= hasta);
  const cerr = base.filter(x => !PEND.includes(x.estatus)), ing = cerr.filter(x => x.estatus === 'Ingresó'), cnt = e => cerr.filter(x => x.estatus === e).length;
  const PAL = [C.or, C.bl, C.gr, C.pu, C.te, C.am, C.rd, '#7B8794', '#B0467B'];
  const pie = (rows, keyf, namef, o = {}) => { const g = new Map(); rows.forEach(x => { const k = keyf(x); g.set(k, (g.get(k) || 0) + 1); }); let it = [...g].map(([k, v]) => ({ n: namef(k), v })).sort((a, b) => b.v - a.v); if (it.length > 8) { const r = it.slice(7).reduce((a, b) => a + b.v, 0); it = it.slice(0, 7).concat([{ n: 'Otros', v: r }]); } return donut(it.map((x, i) => ({ ...x, c: PAL[i % PAL.length] })), { best: 1, sub: o.sub || 'candidatos' }); };
  const conv = (keyf, namef, min) => { const g = new Map(); cerr.forEach(x => { const k = keyf(x); const o = g.get(k) || { n: 0, i: 0 }; o.n++; if (x.estatus === 'Ingresó') o.i++; g.set(k, o); }); return [...g].filter(([, o]) => o.n >= min).map(([k, o]) => ({ n: namef(k), v: o.i / o.n * 100, s: `${o.i}/${o.n}`, c: o.i / o.n >= 0.75 ? C.gr : o.i / o.n >= 0.6 ? C.am : C.rd })).sort((a, b) => b.v - a.v).slice(0, 10); };
  let h = '';
  h += `<div class="tools"><span class="muted">${fmt(cerr.length)} candidatos con resultado en el periodo de arriba</span></div>`;
  h += `<div class="kpis"><div class="kpi"><div class="l">🧑‍💼 Programados</div><div class="v">${fmt(cerr.length)}</div></div><div class="kpi"><div class="l">🙌 Ingresaron</div><div class="v" style="color:var(--green)">${fmt(ing.length)}</div></div><div class="kpi"><div class="l">📈 Conversión</div><div class="v">${cerr.length ? (ing.length / cerr.length * 100).toFixed(2) + '%' : '—'}</div></div><div class="kpi"><div class="l">🚫 No llegó</div><div class="v" style="color:var(--red)">${cnt('No llegó')}</div></div><div class="kpi"><div class="l">✖️ Declinó</div><div class="v" style="color:var(--red)">${cnt('Declinó')}</div></div><div class="kpi"><div class="l">📵 No contesta</div><div class="v" style="color:var(--amber)">${cnt('No contesta')}</div></div></div>`;
  const res = ['Ingresó', 'No llegó', 'Declinó', 'No contesta', 'Reagenda'].map((e, i) => ({ n: e, v: cnt(e), c: [C.gr, C.rd, C.am, C.dk, C.gy][i] }));
  h += `<div class="grid g3"><div class="card"><h3>🎯 Resultado de los candidatos</h3>${donut(res, { sub: 'candidatos' })}</div><div class="card"><h3>🏆 Ingresos por reclutador</h3>${pie(ing, x => x.reclutador_id, nombreRecl, { sub: 'ingresos' })}</div><div class="card"><h3>📣 Ingresos por medio</h3>${pie(ing, x => x.fuente_id, nombreFuente, { sub: 'ingresos' })}</div></div>`;
  h += `<div class="grid g3"><div class="card"><h3>✖️ Declinados por medio</h3>${pie(cerr.filter(x => x.estatus === 'Declinó'), x => x.fuente_id, nombreFuente, { sub: 'declinados' })}</div><div class="card"><h3>🚫 No llegaron por reclutador</h3>${pie(cerr.filter(x => x.estatus === 'No llegó'), x => x.reclutador_id, nombreRecl, { sub: 'no llegaron' })}</div><div class="card"><h3>📵 No contestan por reclutador</h3>${pie(cerr.filter(x => x.estatus === 'No contesta'), x => x.reclutador_id, nombreRecl, { sub: 'sin respuesta' })}</div></div>`;
  h += `<div class="grid g2"><div class="card"><h3>🥇 Mejor conversión por medio</h3><p class="note">Ingresos ÷ candidatos con resultado (mín. 10).</p>${hbars(conv(x => x.fuente_id, nombreFuente, 10), C.gr, { pct: 1 })}</div><div class="card"><h3>🥇 Mejor conversión por reclutador</h3><p class="note">Mín. 15 candidatos.</p>${hbars(conv(x => x.reclutador_id, nombreRecl, 15), C.gr, { pct: 1 })}</div></div>`;
  // tabla única con vista seleccionable
  const vista = IG.ver || 'cand';
  h += sect('Detalle', '🧾') + `<div class="tools"><span>Ver por:</span><select onchange="IG.ver=this.value;tDetalle()">${VER.map(([k, n]) => `<option value="${k}" ${vista === k ? 'selected' : ''}>${n}</option>`).join('')}</select><span class="muted">Mismo periodo y filtros de arriba (elige un solo día con las fechas para el día completo)</span></div>`;
  TB = {};
  if (vista === 'cand') {
    h += tbl('t-ig', [{ h: 'Fecha', v: c => c.fecha_programada, r: c => fdate(c.fecha_programada), w: 82 }, { h: 'Candidato', t: 1, v: c => c.nombre, w: 210, r: c => `<b>${esc(c.nombre)}</b>` }, { h: 'Estatus', t: 1, v: c => c.estatus, r: c => `<span class="pill ${ESTC[c.estatus] || 'x'}">${esc(c.estatus)}</span>` }, { h: 'IDPDV', v: c => c.idpdv }, { h: 'Tienda', t: 1, v: c => (tienda(c.idpdv) || {}).nombre || '' }, { h: 'Cadena', t: 1, v: c => (tienda(c.idpdv) || {}).cadena }, { h: 'Estado', t: 1, v: c => (tienda(c.idpdv) || {}).estado },
      { h: 'Reclutador', t: 1, v: c => nombreRecl(c.reclutador_id) }, { h: 'Medio', t: 1, v: c => nombreFuente(c.fuente_id) }, { h: 'Generado por', t: 1, v: c => c.generado_por }, { h: 'Usuario Fieldwy', t: 1, v: c => c.usuario_fieldwy }, { h: 'Supervisor', t: 1, v: c => (tienda(c.idpdv) || {}).supervisor }, { h: 'Gerencia RR.HH.', t: 1, v: c => (tienda(c.idpdv) || {}).zona_rrhh }, { h: 'RR.HH.', t: 1, v: c => (tienda(c.idpdv) || {}).rrhh }],
      base, { fix: 2, search: 1, csv: 1, png: 1, file: 'posibles_ingresos_detalle', titulo: 'Posibles ingresos · detalle', sort: 0, dir: -1, maxh: '65vh', lim: 600 });
  } else {
    const kf = { supervisor: c => (tienda(c.idpdv) || {}).supervisor || 'Sin dato', zona_rrhh: c => (tienda(c.idpdv) || {}).zona_rrhh || 'Sin dato', rrhh: c => (tienda(c.idpdv) || {}).rrhh || 'Sin dato', recl: c => nombreRecl(c.reclutador_id), fuente: c => nombreFuente(c.fuente_id), estado: c => (tienda(c.idpdv) || {}).estado || 'Sin dato', region: c => (tienda(c.idpdv) || {}).region || 'Sin dato' }[vista];
    const g = new Map(); base.forEach(c => { const k = kf(c); if (!g.has(k)) g.set(k, []); g.get(k).push(c); });
    const rows = [...g].map(([k, v]) => { const ce = v.filter(x => !PEND.includes(x.estatus)); return { n: k, tot: v.length, pr: v.filter(x => PEND.includes(x.estatus)).length, i: v.filter(x => x.estatus === 'Ingresó').length, nl: v.filter(x => x.estatus === 'No llegó').length, d: v.filter(x => x.estatus === 'Declinó').length, nc: v.filter(x => x.estatus === 'No contesta').length, ce: ce.length }; });
    h += tbl('t-ig', [{ h: VER.find(x => x[0] === vista)[1], t: 1, v: r => r.n, w: 230, r: r => `<b>${esc(r.n)}</b>` }, { h: 'Candidatos', v: r => r.tot }, { h: '⏳ Pendientes', v: r => r.pr }, { h: '🙌 Ingresos', v: r => r.i, r: r => `<b class="cell-green">${r.i}</b>` }, { h: '📈 Conversión', v: r => pn(r.i, r.ce), r: r => r.ce ? `<span class="pill ${r.i / r.ce >= 0.75 ? 'g' : r.i / r.ce >= 0.6 ? 'a' : 'r'}">${(r.i / r.ce * 100).toFixed(0)}%</span>` : '—' }, { h: '🚫 No llegó', v: r => r.nl }, { h: '✖️ Declinó', v: r => r.d }, { h: '📵 No contesta', v: r => r.nc }],
      rows, { fix: 1, csv: 1, png: 1, file: 'posibles_ingresos_' + vista, titulo: 'Posibles ingresos por ' + VER.find(x => x[0] === vista)[1], sort: 3, dir: -1, maxh: '65vh' });
  }
  $('ig-body').innerHTML = h; drawAll();
}

/* >>> 06_movs.js */
/* ====================================================================== INGRESOS Y BAJAS ====================================================================== */
const MVX = { ver: 'region', dia: null };
const DIMV = [['region', 'Región'], ['gerente', 'Gerente / Líder'], ['supervisor', 'Supervisor'], ['zona_rrhh', 'Gerencia RR.HH.'], ['rrhh', 'RR.HH.'], ['cadena', 'Cadena'], ['estado', 'Estado']];
const enR = (arr, d, h) => arr.filter(x => x.f >= d && x.f <= h && okI(x.idpdv));
async function vMovs() {
  await conReporte('Ingresos y bajas', 'saltando', async () => {
    await cargarMovs();
    const r = perRango(), dias = r.dias.length, ing = enR(MV.ing, r.desde, r.hasta), baj = enR(MV.baj, r.desde, r.hasta), hc = hcPromX(r, () => true);
    const pd = addD(r.desde, -dias), ph = addD(r.desde, -1), ingP = enR(MV.ing, pd, ph).length, bajP = enR(MV.baj, pd, ph).length;
    const semanas = []; if (dias <= 10) { r.dias.forEach(d => semanas.push({ l: d.slice(8) + '/' + d.slice(5, 7), d, h: d })); } else { const W = ventana(); W.forEach(w => { const s = rangoSemanaDe(W.indexOf(w)); if (s.hasta >= r.desde && s.desde <= r.hasta) semanas.push({ l: w.w.slice(3), d: s.desde < r.desde ? r.desde : s.desde, h: s.hasta > r.hasta ? r.hasta : s.hasta }); }); }
    const si = semanas.map(s => enR(MV.ing, s.d, s.h).length), sb_ = semanas.map(s => enR(MV.baj, s.d, s.h).length);
    let h = cab('Ingresos y bajas', 'Ingresos (candidatos que ingresaron) y bajas registradas, con rotación, comparativos por semana y por cadena. Sirve de base para los cierres diarios y semanales.', 'saltando') + barraFiltros('vMovs') + barraPeriodo('vMovs', { dia: true });
    h += `<div class="kpis kp-hero">${kp('Ingresos', fmt(ing.length), `${dl(ing.length, ingP, 0).replace('pts', '')}`.replace('vs ant.', 'vs periodo anterior (' + ingP + ')'), C.gr, null, '🙌')}${kp('Bajas', fmt(baj.length), `${dl(baj.length, bajP, 0).replace('pts', '').replace('vs ant.', 'vs periodo anterior (' + bajP + ')')}`, C.rd, null, '📤')}${kp('Neto', (ing.length - baj.length >= 0 ? '+' : '') + (ing.length - baj.length), 'ingresos − bajas', ing.length - baj.length >= 0 ? C.gr : C.rd, null, '⚖️')}${kp('Rotación del periodo', hc ? f1(baj.length / hc * 100) + '%' : '—', `${baj.length} bajas ÷ ${fmt(hc)} HC promedio`, C.am, null, '🔄')}</div>`;
    // del historial laboral: reingresos y personas únicas (un usuario con GB vinculado a su original cuenta como una sola persona)
    const reing = enR(MV.reing || [], r.desde, r.hasta), personaDe = u => (MV.vinc && MV.vinc[u]) || u, pers = new Set(ing.filter(x => x.u).map(x => personaDe(x.u)));
    h += `<div class="kpis">${kp('Reingresos', fmt(reing.length), 'personas que ya habían trabajado y regresaron (historial laboral)', C.pu, null, '🔁')}${kp('Personas únicas que ingresaron', fmt(pers.size), `${fmt(ing.length)} ingresos de candidatos · ${fmt(ing.length - pers.size)} repetidos o sin usuario`, C.bl, null, '🧍')}${kp('Historial por revisar', fmt(MV.revisar || 0), 'periodos laborales con datos dudosos; se corrigen con los archivos históricos', C.am, null, '🧾')}</div>`;
    const rotS = semanas.map(s => { const hcS = hcPromX({ desde: s.d, hasta: s.h }, () => true); return hcS ? enR(MV.baj, s.d, s.h).length / hcS * 100 : null; });
    h += `<div class="grid g2"><div class="card"><h3>📊 Ingresos, bajas y rotación por ${dias <= 10 ? 'día' : 'semana'}</h3><p class="note">Barras: cantidad. Línea naranja: % de rotación (eje derecho) con su tendencia punteada.</p>${legend([['Ingresos', C.gr], ['Bajas', C.rd], ['Rotación %', C.od], ['Tendencia', C.dk]])}${chart(semanas.map(s => s.l), [{ n: 'Ingresos', c: C.gr, v: si }, { n: 'Bajas', c: C.rd, v: sb_ }], { bars: 1, vals: 1, h: 320, ticks: 16, band: 1, lines2: [{ n: 'Rotación %', c: C.od, v: rotS, trend: 1 }], y2: { pct: 1 } })}</div>
      <div class="card"><h3>🔄 Rotación ${dias <= 10 ? 'diaria' : 'semanal'} y tendencia</h3><p class="note">Bajas ÷ promotores con check (HC promedio). Si la línea punteada baja, la rotación va mejorando.</p>${chart(semanas.map(s => s.l), [{ n: 'Rotación %', c: C.od, v: rotS }], { pct: 1, h: 320, vals: 1, ticks: 16 })}</div></div>`;
    const cads = [...new Set(R.T.filter(x => okT(x.t)).map(x => x.t.cadena).filter(Boolean))];
    const cr = cads.map(c => { const i = ing.filter(x => (tienda(x.idpdv) || {}).cadena === c).length, b = baj.filter(x => (tienda(x.idpdv) || {}).cadena === c).length, hcC = hcPromX(r, t => t.cadena === c); return { c, i, b, rot: hcC ? b / hcC * 100 : null }; }).sort((a, b) => b.i + b.b - a.i - a.b);
    const mot = {}; baj.forEach(x => mot[x.mot] = (mot[x.mot] || 0) + 1); const PAL = [C.or, C.bl, C.rd, C.pu, C.te, C.am, C.gr, C.gy];
    const mi = Object.entries(mot).sort((a, b) => b[1] - a[1]); const top = mi.slice(0, 6).map(([n, v], i) => ({ n, v, c: PAL[i] })); const rest = mi.slice(6).reduce((a, b) => a + b[1], 0); if (rest) top.push({ n: 'Otros', v: rest, c: C.gy });
    h += `<div class="grid g2"><div class="card"><h3>🏬 Por cadena</h3>${cr.map(q => `<div class="cadena-row">${logoCad(q.c)}<div class="dual"><div class="d-i" style="width:${Math.max(3, q.i / Math.max(1, ...cr.map(z => z.i + z.b)) * 100)}%"><span>${q.i}</span></div><div class="d-b" style="width:${Math.max(3, q.b / Math.max(1, ...cr.map(z => z.i + z.b)) * 100)}%"><span>${q.b}</span></div></div><span class="muted" style="min-width:92px;text-align:right">rot. ${f1(q.rot)}%</span></div>`).join('')}<p class="tblnote">🟩 ingresos · 🟥 bajas</p></div>
      <div class="card"><h3>📤 Motivos de baja</h3>${donut(top, { sub: 'bajas', best: 1 })}</div></div>`;
    // tabla por vista de estructura
    h += sect('Ingresos y bajas por estructura', '🧾') + `<div class="tools" data-nocap><span>Ver por:</span><select onchange="MVX.ver=this.value;vMovs()">${DIMV.map(([k, n]) => `<option value="${k}" ${MVX.ver === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`;
    const keys = [...new Set(R.T.filter(x => okT(x.t)).map(x => x.t[MVX.ver]).filter(Boolean))];
    const rows = keys.map(k => { const i = ing.filter(x => (tienda(x.idpdv) || {})[MVX.ver] === k).length, b = baj.filter(x => (tienda(x.idpdv) || {})[MVX.ver] === k).length, hcK = hcPromX(r, t => t[MVX.ver] === k); return { n: k, i, b, net: i - b, hc: hcK, rot: hcK ? b / hcK * 100 : null }; }).filter(q => q.i || q.b);
    TB = {};
    h += tbl('t-mv', [{ h: DIMV.find(x => x[0] === MVX.ver)[1], t: 1, v: q => q.n, w: 240, r: q => `<b>${esc(q.n)}</b>` }, { h: '🙌 Ingresos', v: q => q.i, r: q => `<b class="cell-green">${q.i}</b>` }, { h: '📤 Bajas', v: q => q.b, r: q => `<b class="cell-red">${q.b}</b>` }, { h: '⚖️ Neto', v: q => q.net, r: q => `<span class="${q.net < 0 ? 'cell-red' : 'cell-green'}">${q.net > 0 ? '+' : ''}${q.net}</span>` }, { h: 'HC promedio', v: q => q.hc, r: q => fmt(q.hc) }, { h: '🔄 Rotación', v: q => q.rot, r: q => q.rot == null ? '—' : `<span class="bar-pct ${q.rot > 40 ? 'ko' : q.rot > 25 ? 'wa' : 'ok'}">${f1(q.rot)}%</span>` }],
      rows, { fix: 1, csv: 1, png: 1, file: 'ingresos_bajas_estructura', titulo: 'Ingresos y bajas por ' + DIMV.find(x => x[0] === MVX.ver)[1], sort: 1, dir: -1, maxh: '60vh' });
    // cierre: una sola tabla expandible (región > gerente > supervisor > tienda) con una columna por cadena, del periodo elegido arriba
    const met = MVX.met || 'i', METN = { i: '🙌 Ingresos', b: '📤 Bajas', n: '⚖️ Neto' };
    const items = [...(met === 'b' ? [] : ing).map(x => ({ idpdv: x.idpdv, tipo: 'i' })), ...(met === 'i' ? [] : baj).map(x => ({ idpdv: x.idpdv, tipo: 'b' }))];
    const cadX = [...CADS, ...new Set(items.map(x => (tienda(x.idpdv) || {}).cadena).filter(c => c && !CADS.includes(c)))];
    const cnt = (a, c, t) => a.filter(x => x.tipo === t && (!c || (tienda(x.idpdv) || {}).cadena === c)).length;
    const fm = c => a => met === 'n' ? cnt(a, c, 'i') - cnt(a, c, 'b') : cnt(a, c, met);
    const nf = v => (v > 0 ? '+' : '') + v;
    const colsX = [...cadX.map(c => ({ h: c, f: fm(c), cero: met === 'n', fmt: met === 'n' ? nf : null })), { h: 'Total general', f: fm(null), cero: true, fmt: met === 'n' ? nf : null }];
    const perT = PER.modo === 'semana' ? 'Semana ' + ventana()[PER.sem == null ? ventana().length - 1 : PER.sem].w + ' · ' : PER.modo === 'mes' ? mlabel(PER.mes || r.hasta.slice(0, 7)) + ' · ' : '';
    const perL = perT + (r.desde === r.hasta ? fdia(r.desde) : fdate(r.desde) + ' al ' + fdate(r.hasta));
    const tt = `${METN[met].replace(/^\S+ /, '')} · ${perL}`;
    h += sect('Cierre por región, gerente, supervisor y tienda', '📸') + `<p class="note">Sigue el periodo de arriba: semana → cierre semanal, mes → mensual, día → diario, o un rango.</p><div class="tools" data-nocap><div class="seg">${Object.entries(METN).map(([k, n]) => `<button class="${met === k ? 'on' : ''}" onclick="MVX.met='${k}';vMovs()">${n}</button>`).join('')}</div><span class="tb-btns"><button class="btn sm" onclick="capturaDescargar($('cierre-x'),'Cierre · ${tt}',subFiltros(),'cierre_${met}')">📸 Imagen</button><button class="btn sm" onclick="capturaCopiar($('cierre-x'),'Cierre · ${tt}',subFiltros())">📋 Copiar</button></span></div><div id="cierre-x" class="cap-pad"><div class="cierre-t">${esc(tt)}</div>${arbol(items, colsX, { titulo: 'REGIÓN / GERENTE / SUPERVISOR / TIENDA', abrir: 2 })}</div>`;
    $('content').innerHTML = h; drawAll();
  });
}
function semanaCierre(d) { const W = ventana(); let i = W.findIndex(w => addD(w.ini, 6) >= d && w.ini <= d); if (i < 0) i = W.length - 1; const s = rangoSemanaDe(i); return { w: W[i].w, ...s }; }

/* >>> 07_bajas.js */
/* ====================================================================== BAJAS Y ENCUESTA DE SALIDA ======================================================================
   Formulario único de baja (reemplaza el de Google): busca al colaborador, captura fecha, motivo, adeudos y, si RH quiere, la encuesta de salida.
   Al guardar: alimenta `bajas` (reporte de ingresos y bajas y HC), `movimientos`, marca al colaborador como Baja y cierra su alerta abierta. */
const BJ = { per: '90', mot: '', tipo: '', enc: '', lista: null, sel: null, res: [], tm: null };
const FINQ = ['Sin iniciar', 'Calculado', 'Validado RH', 'Documento generado', 'Firmado', 'Autorizado', 'Pagado'];
const ENC_OPC = {
  cuando: ['Desde que ingresé', 'Menos de 1 mes', 'De 1 a 3 meses', 'Más de 3 meses', 'Fue una decisión repentina'],
  gusto: ['Sí', 'Más o menos', 'No'], derechos: ['Sí', 'Parcialmente', 'No'], acoso: ['No', 'Sí', 'Prefiero no decir'],
  visita: ['Nunca', 'Menos de una vez al mes', 'Una vez al mes', 'Cada 15 días', 'Cada semana', 'Más de una vez por semana'],
  valora: ['Excelente', 'Buena', 'Regular', 'Mala', 'Muy mala'], apoyo: ['Siempre', 'Casi siempre', 'A veces', 'Nunca'], queja: ['No', 'Sí']
};
const selX = (id, ops, ph) => `<select id="${id}"><option value="">${ph || '— elige —'}</option>${ops.map(o => `<option>${esc(o)}</option>`).join('')}</select>`;
const limpiaQ = q => String(q || '').replace(/[%,()*"\\]/g, ' ').trim();
const tipoMotivo = m => ((S.cat.motBaja || []).find(x => x.motivo === m) || {}).tipo || '';

/* ----- API real ----- */
Real.buscarColab = async function (q) {
  q = limpiaQ(q); if (q.length < 3) return [];
  const { data, error } = await sb.from('colaboradores').select('usuario_fieldwy,nombre,empresa,idpdv,estatus,fecha_ingreso').or(`nombre.ilike.%${q}%,usuario_fieldwy.ilike.%${q}%`).order('estatus').limit(15);
  if (error) throw error; return data || [];
};
Real.bajasPrevias = async function (usuario) {
  const { data } = await sb.from('bajas').select('id,fecha_baja,motivo').is('anulada_en', null).eq('usuario_fieldwy', usuario).gte('fecha_baja', addD(HOY, -45)); return data || [];
};
Real.bajasLista = async function (desde) {
  let q = () => { let x = sb.from('bajas').select('id,usuario_fieldwy,fecha_baja,ultimo_dia_laborado,motivo,marca_destino,adeudo_monto,adeudo_detalle,finiquito_estatus,idpdv,comentarios,capturado_en,colaboradores(nombre,idpdv,empresa),encuesta_salida(baja_id)').is('anulada_en', null).order('fecha_baja', { ascending: false }); if (desde) x = x.gte('fecha_baja', desde); return x; };
  const r = await todo(q);
  return r.map(b => ({ id: b.id, usuario: b.usuario_fieldwy, nombre: (b.colaboradores || {}).nombre || b.usuario_fieldwy, empresa: (b.colaboradores || {}).empresa, fecha: b.fecha_baja, ultimo: b.ultimo_dia_laborado, motivo: b.motivo, marca: b.marca_destino, adeudo: +b.adeudo_monto || 0, adeudoDet: b.adeudo_detalle, finq: b.finiquito_estatus, idpdv: b.idpdv || (b.colaboradores || {}).idpdv, com: b.comentarios, cap: b.capturado_en, enc: !!(b.encuesta_salida && (Array.isArray(b.encuesta_salida) ? b.encuesta_salida.length : b.encuesta_salida.baja_id)) }));
};
Real.registrarBaja = async function (d) {
  // Baja, movimiento, estatus del colaborador, cierre de alertas y encuesta: una sola transacción en la base.
  const { data, error } = await sb.rpc('registrar_baja', { p_usuario: d.usuario, p_fecha: d.fecha, p_ultimo: d.ultimo || null, p_motivo: d.motivo, p_marca: d.marca || null, p_adeudo: d.adeudo || 0,
    p_adeudo_detalle: d.adeudoDet || null, p_evidencia: d.evidencia || null, p_comentarios: d.comentarios || null, p_idpdv: d.idpdv || null, p_enc: d.enc || null });
  if (error) throw new Error(error.message);
  return data;
};
Real.guardarEncuesta = async function (bajaId, e) {
  const { error } = await sb.from('encuesta_salida').upsert({ baja_id: bajaId, respondida_por: 'rh', ...e }); if (error) throw error;
};
Real.actualizarFiniquito = async function (id, est) { const { error } = await sb.from('bajas').update({ finiquito_estatus: est }).eq('id', id); if (error) throw error; };
Real.anularBaja = async function (b, motivo) {
  const { error } = await sb.rpc('anular_baja', { p_baja: b.id, p_motivo: motivo }); if (error) throw new Error(error.message);   // queda el rastro (quién, cuándo y por qué) en Auditoría
};

/* ----- encuesta de salida: campos reutilizables ----- */
function encuestaCampos(p) {
  const f = (l, id, ops) => `<div class="fld"><label>${l}</label>${selX(p + id, ops)}</div>`, t = (l, id, ph) => `<div class="fld"><label>${l}</label><input id="${p}${id}" placeholder="${ph || 'Opcional'}"></div>`;
  return `<div class="enc-box"><div class="note">Complemento del motivo de baja: la versión del promotor. Todo es opcional; si el promotor no la contestó, déjala vacía y se puede capturar después desde la lista.</div>
    <div class="row2">${f('¿Desde cuándo había pensado en terminar la relación laboral?', 'cuando', ENC_OPC.cuando)}${t('¿Cuál es la razón principal del término?', 'razon', 'En sus palabras')}</div>
    <div class="row2">${f('¿Le gustó formar parte de Grupo Benber?', 'gusto', ENC_OPC.gusto)}${t('¿Por qué?', 'gustop')}</div>
    <div class="row2">${f('¿Se respetaron sus derechos laborales?', 'der', ENC_OPC.derechos)}${t('¿Por qué?', 'derp')}</div>
    <div class="row2">${f('🔒 ¿Sufrió acoso, violencia de género, racismo, discriminación o violación de derechos humanos?', 'acoso', ENC_OPC.acoso)}${t('🔒 ¿Qué pasó?', 'acosop')}</div>
    <div class="row2">${f('¿Con qué frecuencia lo visitó su supervisor?', 'vis', ENC_OPC.visita)}${f('¿Cómo valora la capacitación y el soporte de su supervisor?', 'val', ENC_OPC.valora)}</div>
    <div class="row2">${f('¿Recibió apoyo de Recursos Humanos en todo momento?', 'apoyo', ENC_OPC.apoyo)}${f('🔒 ¿Quiere interponer una queja?', 'queja', ENC_OPC.queja)}</div>
    <div class="row2">${t('🔒 Colaborador o situación', 'quejas')}${t('🔒 Motivos de la queja', 'quejam')}</div>
    <p class="muted" style="font-size:11px;font-weight:600">🔒 Las respuestas marcadas son confidenciales: solo las ve RH y administración.</p></div>`;
}
function leerEncuesta(p) {
  const v = id => { const x = $(p + id); return x && x.value ? x.value.trim() : null; };
  const e = { desde_cuando_pensaba_terminar: v('cuando'), razon_principal: v('razon'), le_gusto_grupo_benber: v('gusto'), le_gusto_porque: v('gustop'), derechos_respetados: v('der'), derechos_porque: v('derp'), acoso_discriminacion: v('acoso'), acoso_porque: v('acosop'), frecuencia_visita_supervisor: v('vis'), valoracion_supervisor: v('val'), apoyo_rh: v('apoyo'), desea_queja: v('queja') == null ? null : v('queja') === 'Sí', queja_sobre: v('quejas'), queja_motivos: v('quejam') };
  return Object.values(e).some(x => x != null) ? e : null;
}

/* ----- vista ----- */
async function vBajas() {
  $('content').innerHTML = cab('Bajas y encuesta de salida', 'Registra aquí las bajas. Alimentan el reporte de Ingresos y bajas, el HC y la rotación; la encuesta de salida complementa el motivo.', 'saltando') + '<div class="loading">Cargando bajas…</div>';
  const desde = BJ.per === 'all' ? null : addD(HOY, -(+BJ.per));
  try { BJ.lista = await API.bajasLista(desde); PF.lista = new Map((await API.perfilesBaja().catch(() => [])).map(p => [p.usuario_fieldwy + '|' + p.fecha_baja, p])); } catch (e) { $('content').innerHTML += `<div class="warn">No se pudieron cargar las bajas: ${esc(e.message || e)}</div>`; return; }
  const ok = b => okT(tienda(b.idpdv) || null) || (!tienda(b.idpdv) && !Object.values(FL).some(Boolean));
  const base = BJ.lista.filter(ok), tipoDe = b => tipoMotivo(b.motivo) || 'Sin clasificar';
  const rows = base.filter(b => (!BJ.mot || b.motivo === BJ.mot) && (!BJ.tipo || tipoDe(b) === BJ.tipo) && (!BJ.enc || (BJ.enc === 'si' ? b.enc : !b.enc)));
  const vol = base.filter(b => tipoDe(b) === 'Voluntaria').length, inv = base.filter(b => tipoDe(b) === 'Involuntaria').length, conEnc = base.filter(b => b.enc).length, adeudos = base.filter(b => b.adeudo > 0).length, pend = base.filter(b => b.finq !== 'Pagado').length;
  const motivos = [...new Set(base.map(b => b.motivo))].sort();
  let h = cab('Bajas y encuesta de salida', 'Registra aquí las bajas. Alimentan el reporte de Ingresos y bajas, el HC y la rotación; la encuesta de salida complementa el motivo.', 'saltando') + barraFiltros('vBajas');
  h += `<div class="tools"><span>Periodo:</span><select onchange="BJ.per=this.value;vBajas()">${[['30', 'Últimos 30 días'], ['60', 'Últimos 60 días'], ['90', 'Últimos 90 días'], ['365', 'Último año'], ['all', 'Todo el histórico']].map(([v, t]) => `<option value="${v}" ${BJ.per === v ? 'selected' : ''}>${t}</option>`).join('')}</select><select onchange="BJ.mot=this.value;vBajas()"><option value="">Todos los motivos</option>${motivos.map(m => `<option ${BJ.mot === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select><select onchange="BJ.tipo=this.value;vBajas()"><option value="">Voluntaria e involuntaria</option>${['Voluntaria', 'Involuntaria'].map(m => `<option ${BJ.tipo === m ? 'selected' : ''}>${m}</option>`).join('')}</select><select onchange="BJ.enc=this.value;vBajas()"><option value="">Con y sin encuesta</option><option value="si" ${BJ.enc === 'si' ? 'selected' : ''}>Con encuesta</option><option value="no" ${BJ.enc === 'no' ? 'selected' : ''}>Sin encuesta</option></select>${can('bajas', 'crear') ? '<button class="btn primary" style="margin-left:auto" onclick="bajaNueva()">➕ Registrar baja</button>' : ''}</div>`;
  h += `<div class="kpis">${kp('Bajas', fmt(base.length), 'en el periodo y filtros', C.rd, null, '📤')}${kp('Voluntarias', fmt(vol), pc1(vol, base.length), C.am, null, '🚶')}${kp('Involuntarias', fmt(inv), pc1(inv, base.length), C.dk, null, '⛔')}${kp('Con encuesta', fmt(conEnc), pc1(conEnc, base.length), C.bl, null, '📝')}${kp('Con adeudo', fmt(adeudos), 'monto o detalle por cobrar', C.rd, null, '💸')}${kp('Finiquito pendiente', fmt(pend), 'sin marcar como pagado', C.am, null, '🧾')}</div>`;
  TB = {};
  const puedeFin = can('bajas', 'editar');
  h += sect('Bajas registradas', '🧾') + tbl('t-bj', [
    { h: 'Fecha de baja', v: b => b.fecha, r: b => fdate(b.fecha), w: 96 }, { h: 'Colaborador', t: 1, v: b => b.nombre, w: 230, r: b => `<b>${esc(b.nombre)}</b><br><small class="muted">${esc(b.usuario)}</small>` },
    { h: 'Motivo', t: 1, v: b => b.motivo, r: b => pillx(esc(b.motivo) + (b.marca ? ' → ' + esc(b.marca) : ''), tipoDe(b) === 'Involuntaria' ? 'r' : 'a') }, { h: 'Tipo', t: 1, v: b => tipoDe(b) },
    { h: 'Encuesta', v: b => b.enc ? 1 : 0, r: b => b.enc ? '<span class="pill g">✔ Capturada</span>' : (can('encuesta_salida', 'crear') ? `<button class="rsv" onclick="encuestaDeBaja(${b.id})">Capturar</button>` : '—') },
    { h: 'Finiquito', t: 1, v: b => FINQ.indexOf(b.finq), r: b => puedeFin ? `<select class="finq" onchange="cambiaFinq(${b.id},this.value)">${FINQ.map(f => `<option ${f === b.finq ? 'selected' : ''}>${f}</option>`).join('')}</select>` : esc(b.finq) },
    { h: 'Recontratable', t: 1, v: b => (PF.lista.get(b.usuario + '|' + b.fecha) || {}).recontratable || '', r: b => { const p = PF.lista.get(b.usuario + '|' + b.fecha); return `${p ? pillx(PF_REC[p.recontratable][1] + ' ' + p.recontratable, PF_REC[p.recontratable][0]) : '<span class="muted">Sin evaluar</span>'} <button class="rsv" onclick="perfilAbrir(${b.id})">Perfil</button>`; } },
    { h: 'Adeudo', v: b => b.adeudo, r: b => b.adeudo ? `<b class="cell-red">$${fmt(b.adeudo)}</b>` : '—' }, { h: 'Tienda', t: 1, v: b => (tienda(b.idpdv) || {}).nombre || '' }, { h: 'Cadena', t: 1, v: b => (tienda(b.idpdv) || {}).cadena }, { h: 'Región', t: 1, v: b => (tienda(b.idpdv) || {}).region },
    { h: 'Gerente', t: 1, v: b => (tienda(b.idpdv) || {}).gerente }, { h: 'Supervisor', t: 1, v: b => (tienda(b.idpdv) || {}).supervisor }, { h: 'Comentarios', t: 1, v: b => b.com || '' },
    ...(can('bajas', 'borrar') ? [{ h: '', v: () => '', r: b => `<button class="rsv" onclick="anularBaja(${b.id})" title="Marca la baja como anulada (queda guardada con su motivo) y deja al colaborador activo">Anular</button>` }] : [])
  ], rows, { fix: 2, search: 1, csv: 1, png: 1, file: 'bajas', titulo: 'Bajas registradas', sort: 0, dir: -1, maxh: '70vh', lim: 500 });
  $('content').innerHTML = h; drawAll();
}
async function cambiaFinq(id, est) { try { await API.actualizarFiniquito(id, est); const b = BJ.lista.find(x => x.id === id); if (b) b.finq = est; toast('Finiquito: ' + est); } catch (e) { toast('No se pudo guardar: ' + (e.message || e)); } }
async function anularBaja(id) {
  const b = BJ.lista.find(x => x.id === id); if (!b || !confirm(`¿Anular la baja de ${b.nombre} (${fdate(b.fecha)})?\nLa baja queda anulada (se conserva con su motivo) y el colaborador vuelve a quedar activo.`)) return;
  const motivo = prompt('Motivo de la anulación (obligatorio; queda en Auditoría):', ''); if (motivo === null) return; if (limpia(motivo).length < 5) { toast('Escribe el motivo de la anulación (mínimo 5 caracteres)'); return; }
  try { await API.anularBaja(b, limpia(motivo)); MV.loaded = false; R.vivo = false; toast('Baja anulada'); vBajas(); } catch (e) { toast('No se pudo anular: ' + (e.message || e)); }
}

/* ----- captura de una baja ----- */
function bajaNueva(pre) {
  BJ.sel = pre || null; BJ.res = [];
  const vol = (S.cat.motBaja || []).filter(m => m.tipo === 'Voluntaria'), inv = (S.cat.motBaja || []).filter(m => m.tipo !== 'Voluntaria');
  $('modal').innerHTML = `<div class="mbox wide" style="width:min(820px,96vw);max-height:92vh;overflow:auto" role="dialog" aria-modal="true"><h3>📤 Registrar baja</h3>
    <div class="fld"><label>Colaborador (usuario Fieldwy o nombre)</label><input id="bj-q" autocomplete="off" placeholder="Escribe al menos 3 letras…" oninput="bajaBuscar(this.value)"></div><div id="bj-res"></div><div id="bj-sel"></div>
    <div id="bj-resto" hidden>
      <div class="row2"><div class="fld"><label>Fecha de baja</label><input type="date" id="bj-f" value="${HOY}"></div><div class="fld"><label>Último día laborado</label><input type="date" id="bj-u" value="${addD(HOY, -1)}"></div></div>
      <div class="fld"><label>Motivo de baja</label><select id="bj-m"><option value="">— elige el motivo —</option><optgroup label="Voluntaria">${vol.map(m => `<option>${esc(m.motivo)}</option>`).join('')}</optgroup><optgroup label="Involuntaria">${inv.map(m => `<option>${esc(m.motivo)}</option>`).join('')}</optgroup></select></div>
      <div class="fld" id="bj-marca-w" hidden><label>Marca o cadena destino</label><input id="bj-marca" placeholder="Ej. Telcel, Walmart…"></div>
      <div class="row2"><div class="fld"><label>Adeudo con la agencia ($)</label><input type="number" id="bj-ad" min="0" step="0.01" placeholder="0"></div><div class="fld"><label>Detalle del adeudo</label><input id="bj-adt" placeholder="Equipo, uniforme, faltante…"></div></div>
      <div class="fld"><label>Enlace a evidencia (opcional)</label><input id="bj-ev" placeholder="https://… carpeta de OneDrive o Drive"></div>
      <div class="fld"><label>Comentarios</label><textarea id="bj-c"></textarea></div>
      <details class="enc-d"><summary>📝 Capturar encuesta de salida ahora (opcional)</summary>${encuestaCampos('be-')}</details>
      <div id="bj-perfil"></div>
      <div class="warn" id="bj-warn" hidden></div>
    </div>
    <div class="mfoot"><button class="btn" onclick="cerrarM()">Cancelar</button><button class="btn danger" id="bj-ok" disabled>Registrar baja</button></div></div>`;
  $('modal').hidden = false; $('modal').onclick = e => { if (e.target.id === 'modal') cerrarM(); };
  const mm = () => { $('bj-marca-w').hidden = $('bj-m').value !== 'Cambio a marca o cadena'; }; $('bj-m').onchange = mm; mm();
  $('bj-ok').onclick = bajaGuardar;
  if (pre) bajaElegir(pre); else setTimeout(() => $('bj-q').focus(), 50);
}
function bajaBuscar(q) {
  clearTimeout(BJ.tm); const r = $('bj-res');
  if (limpiaQ(q).length < 3) { r.innerHTML = ''; return; }
  BJ.tm = setTimeout(async () => {
    try { BJ.res = await API.buscarColab(q); } catch (e) { r.innerHTML = `<div class="warn">${esc(e.message || e)}</div>`; return; }
    r.innerHTML = BJ.res.length ? `<div class="bj-list">${BJ.res.map((c, i) => { const t = tienda(c.idpdv) || {}; return `<div class="bj-it ${c.estatus === 'Baja' ? 'off' : ''}" onclick="bajaElegir(BJ.res[${i}])"><b>${esc(c.nombre)}</b><span>${esc(c.usuario_fieldwy)}</span><span>${esc(t.nombre || 'Sin tienda')}</span>${c.estatus === 'Baja' ? '<span class="pill r">Ya está de baja</span>' : '<span class="pill g">Activo</span>'}</div>`; }).join('')}</div>` : '<div class="muted" style="padding:8px">Sin resultados. Revisa el usuario o el nombre.</div>';
  }, 280);
}
async function bajaElegir(c) {
  BJ.sel = c; const t = tienda(c.idpdv) || {};
  $('bj-res').innerHTML = ''; $('bj-q').value = '';
  $('bj-sel').innerHTML = `<div class="bj-card"><div><b>${esc(c.nombre)}</b><br><small>${esc(c.usuario_fieldwy)} · ${esc(c.empresa || 'sin razón social')}</small></div><div><b>${esc(t.nombre || 'Sin tienda')}</b><br><small>${esc([t.cadena, t.estado, t.supervisor].filter(Boolean).join(' · '))}</small></div><button class="rsv" onclick="BJ.sel=null;$('bj-sel').innerHTML='';$('bj-resto').hidden=true;$('bj-ok').disabled=true">Cambiar</button></div>`;
  $('bj-resto').hidden = false; $('bj-ok').disabled = false;
  bajaPerfilPanel(c);
  const w = $('bj-warn'); w.hidden = true;
  try { const p = await API.bajasPrevias(c.usuario_fieldwy); if (c.estatus === 'Baja' || p.length) { w.hidden = false; w.textContent = c.estatus === 'Baja' ? 'Este colaborador ya aparece como baja.' : ''; if (p.length) w.textContent += ` Ya tiene una baja registrada el ${fdate(p[0].fecha_baja)} (${p[0].motivo}). Si es la misma, no la dupliques.`; } } catch (e) { }
}
async function bajaGuardar() {
  const c = BJ.sel, b = $('bj-ok'); if (!c) return;
  const f = $('bj-f').value, m = $('bj-m').value, w = $('bj-warn');
  const err = !f ? 'Falta la fecha de baja.' : f > addD(HOY, 7) ? 'La fecha de baja está muy adelante; revísala.' : !m ? 'Elige el motivo de baja.' : ($('bj-m').value === 'Cambio a marca o cadena' && !$('bj-marca').value.trim()) ? 'Escribe la marca o cadena destino.' : ($('bj-u').value && $('bj-u').value > f) ? 'El último día laborado no puede ser posterior a la fecha de baja.' : '';
  if (err) { w.hidden = false; w.textContent = err; return; }
  b.disabled = true; b.textContent = 'Guardando…';
  try {
    await API.registrarBaja({ usuario: c.usuario_fieldwy, idpdv: c.idpdv, fecha: f, ultimo: $('bj-u').value, motivo: m, marca: $('bj-marca').value.trim(), adeudo: +$('bj-ad').value || 0, adeudoDet: $('bj-adt').value.trim(), evidencia: $('bj-ev').value.trim(), comentarios: $('bj-c').value.trim(), enc: leerEncuesta('be-') });
    await perfilGuardarDeModal(c, f);
    MV.loaded = false; R.vivo = false; cerrarM(); toast('Baja registrada: ' + c.nombre);
    if (S.alertas) S.alertas = S.alertas.filter(x => x.usuario !== c.usuario_fieldwy);
    if (S.view === 'bajas') vBajas(); else if (typeof nav === 'function') { nav(); render(); }
  } catch (e) { b.disabled = false; b.textContent = 'Reintentar'; w.hidden = false; w.textContent = 'No se pudo guardar: ' + (e.message || e) + (/row-level|policy/i.test(String(e.message || e)) ? ' (este colaborador no está en tu alcance)' : ''); }
}
function encuestaDeBaja(id) {
  const b = BJ.lista.find(x => x.id === id); if (!b) return;
  $('modal').innerHTML = `<div class="mbox wide" style="width:min(820px,96vw);max-height:92vh;overflow:auto" role="dialog" aria-modal="true"><h3>📝 Encuesta de salida</h3><div class="who">${esc(b.nombre)} · ${esc(b.usuario)} · baja ${fdate(b.fecha)} · ${esc(b.motivo)}</div>${encuestaCampos('ee-')}<div class="warn" id="ee-warn" hidden></div><div class="mfoot"><button class="btn" onclick="cerrarM()">Cancelar</button><button class="btn primary" id="ee-ok">Guardar encuesta</button></div></div>`;
  $('modal').hidden = false; $('modal').onclick = e => { if (e.target.id === 'modal') cerrarM(); };
  $('ee-ok').onclick = async () => { const e = leerEncuesta('ee-'); if (!e) { $('ee-warn').hidden = false; $('ee-warn').textContent = 'Contesta al menos una pregunta.'; return; } $('ee-ok').disabled = true; try { await API.guardarEncuesta(id, e); b.enc = true; cerrarM(); toast('Encuesta guardada'); vBajas(); } catch (x) { $('ee-ok').disabled = false; $('ee-warn').hidden = false; $('ee-warn').textContent = 'No se pudo guardar: ' + (x.message || x); } };
}

/* >>> 07b_altas.js */
/* ====================================================================== ALTAS (nuevo ingreso) Y EXPEDIENTES ======================================================================
   Alta: sale de un candidato que "Ingresó" (precargado) o se captura directa. Crea el colaborador, el movimiento de alta, guarda los datos sensibles
   (tabla aparte: solo RH y administración, nunca en reportes) y abre los pendientes de Expediente, Datos bancarios y CSF a 7 días.
   Expedientes: semáforo de pendientes por colaborador; cada responsable ve los de su estado. */
const AL = { pend: null, ult: null, emp: [], pre: null };
const PLAZO_DOCS = 7;
const DOCS = ['Expediente', 'Datos bancarios', 'CSF'];
/* checklist del expediente: [documento, obligatorio]. Los archivos viven en OneDrive/Drive; aquí se guarda el enlace y la validación */
const DOCS_EXP = [['INE (frente y vuelta)', 1], ['CURP', 1], ['Acta de nacimiento', 1], ['Comprobante de domicilio', 1], ['NSS / constancia IMSS', 1], ['Contrato firmado', 1], ['Constancia de situación fiscal (CSF)', 0], ['Datos bancarios (carátula)', 0], ['Fotografía', 0], ['Otro documento', 0]];
const DOC_PEND = { 'Constancia de situación fiscal (CSF)': 'CSF', 'Datos bancarios (carátula)': 'Datos bancarios' };
const ESTADO_CIVIL = ['Soltero(a)', 'Casado(a)', 'Unión libre', 'Divorciado(a)', 'Viudo(a)'], TALLAS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

/* ----- validaciones ----- */
const V = {
  curp: s => /^[A-Z]{4}\d{6}[HMX][A-Z]{2}[A-Z]{3}[A-Z0-9]\d$/.test(s),
  rfc: s => /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(s),
  nss: s => /^\d{11}$/.test(s),
  tel: s => /^\d{10}$/.test(s),
  mail: s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s),
  clabe: s => { if (!/^\d{18}$/.test(s)) return false; const w = [3, 7, 1]; const sum = s.slice(0, 17).split('').reduce((a, d, i) => a + ((+d * w[i % 3]) % 10), 0); return (10 - sum % 10) % 10 === +s[17]; }
};
const limpia = s => String(s || '').trim();
const urlSegura = u => /^https?:\/\//i.test(limpia(u)) ? limpia(u) : '';   // solo http/https (evita javascript: en enlaces guardados)
const mayus = s => limpia(s).toUpperCase().replace(/\s+/g, '');
const digs = s => String(s || '').replace(/\D/g, '');

/* ----- API real ----- */
Real.altasPend = async function () {
  const desde = addD(HOY, -60);
  const c = await todo(() => sb.from('candidatos').select('id,nombre,telefono,idpdv,fecha_programada,reclutador_id,usuario_fieldwy').eq('estatus', 'Ingresó').gte('fecha_programada', desde).order('fecha_programada', { ascending: false }));
  const us = c.map(x => x.usuario_fieldwy).filter(Boolean); let hechos = new Set();
  if (us.length) { const r = await todo(() => sb.from('colaboradores').select('usuario_fieldwy').in('usuario_fieldwy', us.slice(0, 400))); hechos = new Set(r.map(x => x.usuario_fieldwy)); }
  return c.filter(x => !x.usuario_fieldwy || !hechos.has(x.usuario_fieldwy));
};
Real.altasUltimas = async function () {
  const q = cols => todo(() => sb.from('colaboradores').select(cols).gte('fecha_ingreso', addD(HOY, -45)).order('fecha_ingreso', { ascending: false }).limit(400));
  try { return await q('usuario_fieldwy,nombre,empresa,idpdv,fecha_ingreso,tipo_ingreso,estatus'); } catch (e) { return await q('usuario_fieldwy,nombre,empresa,idpdv,fecha_ingreso,estatus'); } // antes de correr schema_v08 no existe tipo_ingreso
};
Real.empresas = async function () { const { data } = await sb.from('colaboradores').select('empresa').not('empresa', 'is', null).limit(3000); return [...new Set((data || []).map(x => x.empresa))].sort(); };
Real.registrarAlta = async function (d) {
  // Todo ocurre dentro de la base en una sola transacción (colaborador, movimiento, datos personales, bancarios, sueldo, pendientes y candidato): o se guarda completo o no se guarda nada.
  const { data, error } = await sb.rpc('registrar_alta', { p_usuario: d.usuario, p_nombre: d.nombre, p_empresa: d.empresa || null, p_fecha: d.fecha, p_idpdv: d.idpdv, p_tipo: d.tipo || 'Nuevo',
    p_candidato: d.candidato || null, p_sens: d.sens || {}, p_banc: d.banc || {}, p_sueldo: d.sueldo || null });
  if (error) throw new Error(error.message);
  return data;
};
Real.expedientes = async function () {
  const r = await todo(() => sb.from('pendientes_documentos').select('id,usuario_fieldwy,tipo,fecha_limite,estatus,enlace_url,colaboradores(nombre,fecha_ingreso,idpdv,empresa,estatus)').eq('estatus', 'Pendiente').order('fecha_limite'));
  return r.filter(x => x.colaboradores && x.colaboradores.estatus !== 'Baja');
};
Real.marcarDoc = async function (id, url) { const { data: u } = await sb.auth.getUser(); const { error } = await sb.from('pendientes_documentos').update({ estatus: 'Recibido', recibido_en: HOY, recibido_por: u.user.id, enlace_url: url || null }).eq('id', id); if (error) throw error; };


Real.altasDia = async function (fecha) {
  const ini = new Date(fecha + 'T00:00:00'), fin = new Date(ini.getTime() + 864e5);
  const q = cols => todo(() => sb.from('colaboradores').select(cols).gte('creado_en', ini.toISOString()).lt('creado_en', fin.toISOString()).order('creado_en'));
  const base = 'usuario_fieldwy,nombre,empresa,idpdv,fecha_ingreso,creado_en';
  try { return await q(base + ',tipo_ingreso,usuario_creado_en,datos_sensibles(curp,rfc,nss,correo,telefono)'); }
  catch (e) { try { return await q(base + ',datos_sensibles(curp,rfc,nss,correo,telefono)'); } catch (e2) { return await q(base); } } // antes de correr los SQL v08/v09
};
Real.marcarUsuarioCreado = async function (usuario, v) { const { data: u } = await sb.auth.getUser(); const { error } = await sb.from('colaboradores').update(v ? { usuario_creado_en: new Date().toISOString(), usuario_creado_por: u.user.id } : { usuario_creado_en: null, usuario_creado_por: null }).eq('usuario_fieldwy', usuario); if (error) throw error; };
Real.docsDe = async function (usuario) { const { data, error } = await sb.from('expediente_docs').select('*').eq('usuario_fieldwy', usuario); if (error) throw error; return data || []; };
Real.guardarDoc = async function (usuario, tipo, url) { const { error } = await sb.from('expediente_docs').upsert({ usuario_fieldwy: usuario, tipo, enlace_url: url, estatus: 'Cargado', nota: null, validado_por: null, validado_en: null, cargado_en: new Date().toISOString() }); if (error) throw error; };
Real.validarDoc = async function (usuario, tipo, estatus, nota) { const { data: u } = await sb.auth.getUser(); const { error } = await sb.from('expediente_docs').update({ estatus, nota: nota || null, validado_por: u.user.id, validado_en: new Date().toISOString() }).eq('usuario_fieldwy', usuario).eq('tipo', tipo); if (error) throw error; };
Real.cerrarPendientes = async function (usuario, tipos) { if (!tipos.length) return; const { data: u } = await sb.auth.getUser(); await sb.from('pendientes_documentos').update({ estatus: 'Recibido', recibido_en: HOY, recibido_por: u.user.id }).eq('usuario_fieldwy', usuario).eq('estatus', 'Pendiente').in('tipo', tipos); };

/* ----- ALTAS ----- */
async function vAltas() {
  $('content').innerHTML = cab('Altas · nuevo ingreso', 'Da de alta a los candidatos que ingresaron: crea el colaborador, guarda sus datos y abre los pendientes de expediente a 7 días.', 'mochila') + '<div class="loading">Cargando…</div>';
  try { [AL.pend, AL.ult] = await Promise.all([API.altasPend(), API.altasUltimas()]); } catch (e) { $('content').innerHTML += `<div class="warn">No se pudo cargar: ${esc(e.message || e)}</div>`; return; }
  const puede = can('colaboradores', 'crear'), ok = x => okT(tienda(x.idpdv) || null) || (!tienda(x.idpdv) && !Object.values(FL).some(Boolean));
  const pend = AL.pend.filter(ok), ult = AL.ult.filter(ok);
  let h = cab('Altas · nuevo ingreso', 'Da de alta a los candidatos que ingresaron: crea el colaborador, guarda sus datos y abre los pendientes de expediente a 7 días.', 'mochila') + barraFiltros('vAltas');
  h += `<div class="kpis">${(puede ? kp('Por dar de alta', fmt(pend.length), 'candidatos que ingresaron (60 días)', pend.length ? C.rd : C.gr, null, '🆕') : '')}${kp('Altas últimos 45 días', fmt(ult.length), 'colaboradores creados', C.gr, null, '✅')}</div>`;
  h += `<div class="tools">${puede ? '<button class="btn primary" onclick="altaNueva()">➕ Alta sin candidato</button>' : ''}<span class="muted">Los candidatos salen de Posibles ingresos cuando los marcas como "Ingresó".</span></div>`;
  TB = {};
  h += await altasDiaHtml();
  if (puede) h += sect('Candidatos que ingresaron y no tienen alta', '🆕') + tbl('t-alp', [
    { h: 'Fecha de ingreso', v: c => c.fecha_programada, r: c => fdate(c.fecha_programada), w: 100 }, { h: 'Candidato', t: 1, v: c => c.nombre, w: 230, r: c => `<b>${esc(c.nombre)}</b>` },
    { h: 'Tienda', t: 1, v: c => (tienda(c.idpdv) || {}).nombre || '' }, { h: 'Cadena', t: 1, v: c => (tienda(c.idpdv) || {}).cadena }, { h: 'Estado', t: 1, v: c => (tienda(c.idpdv) || {}).estado }, { h: 'Supervisor', t: 1, v: c => (tienda(c.idpdv) || {}).supervisor }, { h: 'RR.HH.', t: 1, v: c => (tienda(c.idpdv) || {}).rrhh },
    { h: '', v: () => '', r: c => puede ? `<button class="rsv" onclick="altaNueva('${c.id}')">Dar de alta ›</button>` : '' }], pend, { fix: 2, search: 1, csv: 1, png: 1, file: 'altas_pendientes', titulo: 'Candidatos por dar de alta', sort: 0, dir: -1, maxh: '50vh' });
  h += sect('Altas recientes', '✅') + tbl('t-alu', [
    { h: 'Ingreso', v: c => c.fecha_ingreso, r: c => fdate(c.fecha_ingreso), w: 96 }, { h: 'Usuario', t: 1, v: c => c.usuario_fieldwy, w: 130 }, { h: 'Colaborador', t: 1, v: c => c.nombre, r: c => `<b>${esc(c.nombre)}</b>` }, { h: 'Tipo', t: 1, v: c => c.tipo_ingreso || 'Nuevo' }, { h: 'Razón social', t: 1, v: c => c.empresa },
    { h: 'Tienda', t: 1, v: c => (tienda(c.idpdv) || {}).nombre || '' }, { h: 'Región', t: 1, v: c => (tienda(c.idpdv) || {}).region }, { h: 'Supervisor', t: 1, v: c => (tienda(c.idpdv) || {}).supervisor }, { h: 'RR.HH.', t: 1, v: c => (tienda(c.idpdv) || {}).rrhh }, ...(can('expedientes', 'ver') ? [{ h: '', v: () => '', r: c => `<button class="rsv" onclick="expedienteAbrir('${c.usuario_fieldwy}')">Expediente ›</button>` }] : [])], ult, { fix: 2, search: 1, csv: 1, png: 1, file: 'altas_recientes', titulo: 'Altas recientes', sort: 0, dir: -1, maxh: '50vh' });
  $('content').innerHTML = h; drawAll();
}
function tiendaOpts() { return Object.values(S.cat.tiendas).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es')).map(t => `<option value="${t.idpdv} · ${esc(t.nombre)} (${esc(t.cadena || '')} · ${esc(t.estado || '')})"></option>`).join(''); }
async function altaNueva(candId) {
  const c = candId ? AL.pend.find(x => x.id === candId) : null; AL.pre = c;
  if (!AL.emp.length) { try { AL.emp = await API.empresas(); } catch (e) { } }
  const t = c ? tienda(c.idpdv) : null, fld = (l, id, ph, ex) => `<div class="fld"><label>${l}</label><input id="al-${id}" ${ex || ''} placeholder="${ph || ''}"></div>`;
  $('modal').innerHTML = `<div class="mbox wide" style="width:min(860px,96vw);max-height:92vh;overflow:auto" role="dialog" aria-modal="true"><h3>🆕 Alta de colaborador</h3>${c ? `<div class="who">Candidato: ${esc(c.nombre)} · ingresó el ${fdate(c.fecha_programada)}</div>` : ''}
    <div class="row2">${fld('Usuario Fieldwy *', 'us', 'Ej. ABCD010203XYZ', 'autocomplete="off" style="text-transform:uppercase" onchange="altaAvisoRec()"')}${fld('Nombre(s) *', 'nom', '', '')}</div>
    <div id="al-rec"></div>
    <div class="row2">${fld('Apellido paterno *', 'ap')}${fld('Apellido materno', 'am')}</div>
    <div class="row2"><div class="fld"><label>Fecha de ingreso *</label><input type="date" id="al-f" value="${c ? c.fecha_programada : HOY}"></div><div class="fld"><label>Tienda *</label><input id="al-t" list="al-tl" placeholder="Escribe IDPDV o nombre…" value="${t ? esc(c.idpdv + ' · ' + t.nombre + ' (' + (t.cadena || '') + ' · ' + (t.estado || '') + ')') : ''}"><datalist id="al-tl">${tiendaOpts()}</datalist></div></div>
    <div class="row2"><div class="fld"><label>Razón social (empresa)</label><input id="al-emp" list="al-el" placeholder="Ej. Benber SS"><datalist id="al-el">${AL.emp.map(e => `<option value="${esc(e)}">`).join('')}</datalist></div><div class="fld"><label>Tipo de ingreso</label><select id="al-tipo"><option>Nuevo</option><option>Reingreso</option></select></div></div>
    <div class="note">Reingreso: usa el <b>mismo usuario Fieldway</b> que tenía (debe estar en baja). Solo si no está cargado a la agencia, crea uno nuevo con <b>GB</b> al final.</div>
    <details class="enc-d" open><summary>🔒 Datos personales (solo RH y administración)</summary><div class="enc-box">
      <div class="row2">${fld('CURP', 'curp', '18 caracteres', 'maxlength="18" style="text-transform:uppercase"')}${fld('RFC', 'rfc', '12 o 13 caracteres', 'maxlength="13" style="text-transform:uppercase"')}</div>
      <div class="row2">${fld('NSS (IMSS)', 'nss', '11 dígitos', 'inputmode="numeric" maxlength="11"')}${fld('Teléfono', 'tel', '10 dígitos', `inputmode="numeric" maxlength="10" value="${esc(c && c.telefono ? digs(c.telefono).slice(-10) : '')}"`)}</div>
      <div class="row2">${fld('Correo', 'mail', 'nombre@correo.com', 'type="email"')}<div class="fld"><label>Estado civil</label><select id="al-ec"><option value="">—</option>${ESTADO_CIVIL.map(e => `<option>${e}</option>`).join('')}</select></div></div>
      <div class="row2"><div class="fld"><label>¿Tiene crédito Infonavit?</label><select id="al-inf"><option value="">—</option><option>Sí</option><option>No</option></select></div>${fld('Monto Infonavit ($)', 'minf', '', 'type="number" min="0" step="0.01"')}<div class="fld"><label>Talla de uniforme</label><select id="al-talla"><option value="">—</option>${TALLAS.map(e => `<option>${e}</option>`).join('')}</select></div></div>
      <div class="row2">${fld('Contacto de emergencia', 'emer', 'Nombre y teléfono')}${can('sueldos', 'editar') ? fld('Sueldo mensual ($)', 'suel', '', 'type="number" min="0" step="0.01"') : ''}</div>
      <div class="row2"><div class="fld"><label>¿Asegurado (IMSS)?</label><select id="al-aseg"><option value="">—</option><option>Sí</option><option>No</option></select></div>${can('sueldos', 'editar') ? fld('Bono fijo ($)', 'bono', '', 'type="number" min="0" step="0.01"') : ''}</div>
      <div class="row2">${fld('Canal', 'canal', 'Ej. Autoservicio')}</div></div></details>
    ${can('datos_bancarios', 'crear') ? `<details class="enc-d"><summary>💳 Datos bancarios (pueden llegar después)</summary><div class="enc-box"><div class="row2">${fld('Banco', 'banco')}${fld('CLABE interbancaria', 'clabe', '18 dígitos', 'inputmode="numeric" maxlength="18"')}</div><div class="row2">${fld('Número de tarjeta', 'tarj', '', 'inputmode="numeric" maxlength="19"')}${fld('Cuenta', 'cta')}</div><div class="row2">${fld('Titular de la cuenta', 'titu', 'Si es otra persona')}${fld('Cuenta 2', 'cta2')}</div></div></details>` : '<div class="note">Los datos bancarios los captura personal autorizado desde <b>Sueldos y bancarios</b>.</div>'}
    <div class="note">Al guardar se abren los pendientes <b>Expediente</b>, <b>Datos bancarios</b> y <b>CSF</b> con vencimiento a ${PLAZO_DOCS} días del ingreso. Los documentos se guardan fuera de la app (OneDrive o Drive).</div>
    <div class="warn" id="al-warn" hidden></div>
    <div class="mfoot"><button class="btn" onclick="cerrarM()">Cancelar</button><button class="btn primary" id="al-ok">Guardar alta</button></div></div>`;
  $('modal').hidden = false; $('modal').onclick = e => { if (e.target.id === 'modal') cerrarM(); };
  $('al-ok').onclick = altaGuardar; setTimeout(() => $('al-us').focus(), 60);
}
/* reingresos: si el usuario ya tuvo una baja evaluada como "No recontratable" o "Con reservas", se avisa antes de darlo de alta */
Real.perfilDe = async function (u) { const { data, error } = await sb.from('baja_perfil').select('*').eq('usuario_fieldwy', u).order('fecha_baja', { ascending: false }).limit(1); if (error) throw error; return (data || [])[0] || null; };
Demo.perfilDe = async () => null;
let AL_REC = null;
async function altaAvisoRec() {
  const u = mayus(limpia(($('al-us') || {}).value)), box = $('al-rec'); AL_REC = null; if (!box) return; box.innerHTML = ''; if (u.length < 6) return;
  try { const p = await API.perfilDe(u); if (!p) return; AL_REC = p; const r = PF_REC[p.recontratable];
    box.innerHTML = `<div class="${p.recontratable === 'Sí' ? 'note' : 'warn'}">${r[1]} Este usuario ya tuvo una baja el ${fdate(p.fecha_baja)}: <b>${p.recontratable === 'Sí' ? 'recontratable' : p.recontratable === 'No' ? 'NO recontratable' : 'recontratable con reservas'}</b>${p.nota ? ' · ' + esc(p.nota) : ''}${p.resumen && p.resumen.veredicto ? ` · desempeño: ${esc(p.resumen.veredicto)}` : ''}.</div>`; } catch (e) { }
}
async function altaGuardar() {
  const g = id => { const e = $('al-' + id); return e ? limpia(e.value) : ''; }, w = $('al-warn'), b = $('al-ok');
  const us = mayus(g('us')), nom = g('nom'), f = g('f'), tt = g('t'), idp = parseInt(tt, 10), curp = mayus(g('curp')), rfc = mayus(g('rfc')), nss = digs(g('nss')), tel = digs(g('tel')), mail = g('mail').toLowerCase(), clabe = digs(g('clabe')), suel = g('suel');
  const e = [];
  if (!us) e.push('Falta el usuario Fieldwy.'); if (!nom) e.push('Falta el nombre.'); if (!g('ap')) e.push('Falta el apellido paterno.'); if (!f) e.push('Falta la fecha de ingreso.');
  if (!idp || !tienda(idp)) e.push('Elige una tienda de la lista (empieza con su IDPDV).');
  if (curp && !V.curp(curp)) e.push('La CURP no tiene un formato válido (18 caracteres).'); if (rfc && !V.rfc(rfc)) e.push('El RFC no tiene un formato válido.');
  if (nss && !V.nss(nss)) e.push('El NSS debe tener 11 dígitos.'); if (tel && !V.tel(tel)) e.push('El teléfono debe tener 10 dígitos.'); if (mail && !V.mail(mail)) e.push('El correo no es válido.');
  if (clabe && !V.clabe(clabe)) e.push('La CLABE no es válida (18 dígitos con dígito verificador correcto).');
  if (e.length) { w.hidden = false; w.innerHTML = e.map(esc).join('<br>'); return; }
  if (AL_REC && AL_REC.recontratable !== 'Sí' && AL_REC.usuario_fieldwy === us && !confirm('Este usuario quedó como ' + (AL_REC.recontratable === 'No' ? 'NO recontratable' : 'recontratable con reservas') + (AL_REC.nota ? ' (' + AL_REC.nota + ')' : '') + '.\n¿Confirmas que quieres darlo de alta?')) return;
  const tarj = digs(g('tarj')), ap = mayus(g('ap')), am = mayus(g('am')), npila = mayus(nom), minf = g('minf'), bono = g('bono');
  const sens = { curp: curp || null, rfc: rfc || null, nss: nss || null, correo: mail || null, telefono: tel || null, estado_civil: $('al-ec').value || null, infonavit: $('al-inf').value ? $('al-inf').value === 'Sí' : null, contacto_emergencia: g('emer') || null, talla: $('al-talla').value || null,
    apellido_p: ap || null, apellido_m: am || null, nombre_pila: npila || null, monto_infonavit: minf ? +minf : null, asegurado: $('al-aseg').value ? $('al-aseg').value === 'Sí' : null, canal: g('canal') || null };
  const banc = { banco: g('banco'), titular: g('titu'), clabe, cuenta: digs(g('cta')), cuenta2: digs(g('cta2')), tarjeta: tarj };   // van a datos_bancarios (función con validación y permisos)
  const sueldo = suel !== '' ? { monto: +suel, bono: bono !== '' ? +bono : null } : null;                                          // va a sueldos_historial (solo quien puede editar sueldos)
  b.disabled = true; b.textContent = 'Guardando…';
  try {
    const res = await API.registrarAlta({ usuario: us, nombre: [npila, ap, am].filter(Boolean).join(' '), fecha: f, idpdv: idp, empresa: g('emp'), tipo: $('al-tipo').value, candidato: AL.pre ? AL.pre.id : null, sens, banc, sueldo });
    cerrarM(); toast((res && res.reingreso ? 'Reingreso registrado: ' : 'Alta registrada: ') + nom + (res && res.nota ? ' · ' + res.nota : '')); vAltas();
  } catch (x) { b.disabled = false; b.textContent = 'Reintentar'; w.hidden = false; w.textContent = x.message || String(x); }
}

/* ----- EXPEDIENTES: semáforo de pendientes ----- */
let EXP = { lista: null };
async function vExpedientes() {
  $('content').innerHTML = cab('Expedientes', 'Pendientes de expediente, datos bancarios y CSF por colaborador, con vencimiento a 7 días del ingreso.', 'puno') + '<div class="loading">Cargando…</div>';
  try { EXP.lista = await API.expedientes(); } catch (e) { $('content').innerHTML += `<div class="warn">${esc(e.message || e)}</div>`; return; }
  const por = new Map(); EXP.lista.forEach(p => { if (!por.has(p.usuario_fieldwy)) por.set(p.usuario_fieldwy, { usuario: p.usuario_fieldwy, c: p.colaboradores, docs: [] }); por.get(p.usuario_fieldwy).docs.push(p); });
  const ok = q => okT(tienda(q.c.idpdv) || null) || (!tienda(q.c.idpdv) && !Object.values(FL).some(Boolean));
  let rows = [...por.values()].filter(ok).map(q => ({ ...q, peor: Math.min(...q.docs.map(d => diffD(d.fecha_limite, HOY))) }));
  const venc = rows.filter(r => r.peor < 0).length, prox = rows.filter(r => r.peor >= 0 && r.peor <= 2).length, enT = rows.filter(r => r.peor > 2).length;
  let h = cab('Expedientes', 'Pendientes de expediente, datos bancarios y CSF por colaborador, con vencimiento a 7 días del ingreso.', 'puno') + barraFiltros('vExpedientes');
  h += `<div class="kpis">${kp('Con pendientes', fmt(rows.length), 'colaboradores activos', C.am, null, '🗂️')}${kp('Vencidos', fmt(venc), 'pasó la fecha límite', venc ? C.rd : C.gr, null, '🔴')}${kp('Vencen en ≤ 2 días', fmt(prox), 'atender hoy', prox ? C.am : C.gr, null, '🟡')}${kp('En tiempo', fmt(enT), 'más de 2 días', C.gr, null, '🟢')}</div>`;
  const chip = d => { const n = diffD(d.fecha_limite, HOY), k = n < 0 ? 'r' : n <= 2 ? 'a' : 'g'; return `<span class="dchip ${k} dc-doc" title="Vence ${fdate(d.fecha_limite)}">${d.tipo}${can('expedientes', 'editar') ? ` <button class="dc-ok" onclick="docRecibido(${d.id})">✔ Recibido</button>` : ''}</span>`; };
  TB = {};
  h += sect('Pendientes por colaborador', '🗂️') + tbl('t-exp', [
    { h: 'Vence', v: r => r.peor, r: r => (r.peor < 0 ? `<span class="dchip r">${-r.peor} d vencido</span>` : `<span class="dchip ${r.peor <= 2 ? 'a' : 'g'}">${r.peor === 0 ? 'hoy' : r.peor + ' d'}</span>`) + `<br><small class="muted">día ${Math.max(0, PLAZO_DOCS - r.peor)} de ${PLAZO_DOCS}</small>`, w: 118 },
    { h: 'Colaborador', t: 1, v: r => r.c.nombre, w: 230, r: r => `<b>${esc(r.c.nombre)}</b><br><small class="muted">${esc(r.usuario)}</small>` }, { h: 'Ingreso', v: r => r.c.fecha_ingreso, r: r => fdate(r.c.fecha_ingreso) },
    { h: 'Pendiente', t: 1, v: r => r.docs.map(d => d.tipo).join(', '), r: r => `<div class="dc-wrap">${r.docs.map(chip).join('')}</div>` },
    { h: 'Tienda', t: 1, v: r => (tienda(r.c.idpdv) || {}).nombre || '' }, { h: 'Estado', t: 1, v: r => (tienda(r.c.idpdv) || {}).estado }, { h: 'Supervisor', t: 1, v: r => (tienda(r.c.idpdv) || {}).supervisor }, { h: 'RR.HH.', t: 1, v: r => (tienda(r.c.idpdv) || {}).rrhh }, { h: 'Razón social', t: 1, v: r => r.c.empresa },
    { h: '', v: () => '', r: r => `<button class="rsv" onclick="expedienteAbrir('${r.usuario}')">Expediente ›</button>` }
  ], rows, { fix: 2, search: 1, csv: 1, png: 1, file: 'expedientes_pendientes', titulo: 'Expedientes pendientes', sort: 0, dir: 1, maxh: '72vh' });
  $('content').innerHTML = h; drawAll();
}
async function docRecibido(id) {
  const url = prompt('Enlace a la carpeta o archivo (opcional). Deja vacío si no hay:', ''); if (url === null) return;
  if (limpia(url) && !urlSegura(url)) { toast('El enlace debe empezar con https://'); return; }
  try { await API.marcarDoc(id, limpia(url)); EXP.lista = EXP.lista.filter(x => x.id !== id); toast('Marcado como recibido'); vExpedientes(); } catch (e) { toast('No se pudo guardar: ' + (e.message || e)); }
}

/* ----- altas del día (para quien crea los usuarios de Fieldwy) ----- */
let ALD = { dia: null, lista: [] };
async function altasDiaHtml() {
  ALD.dia = ALD.dia || HOY; let rows = [];
  try { rows = await API.altasDia(ALD.dia); } catch (e) { return `<div class="warn">No se pudieron cargar las altas del día: ${esc(e.message || e)}</div>`; }
  ALD.lista = rows = rows.map(r => ({ ...r, s: (Array.isArray(r.datos_sensibles) ? r.datos_sensibles[0] : r.datos_sensibles) || {} }));
  const sens = can('datos_sensibles', 'ver'), edita = can('colaboradores', 'editar'), pend = rows.filter(r => !r.usuario_creado_en).length;
  const cols = [
    { h: 'Hora', v: r => r.creado_en, r: r => r.creado_en ? new Date(r.creado_en).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '—', w: 70 }, { h: 'Usuario Fieldwy', t: 1, v: r => r.usuario_fieldwy, w: 150, r: r => `<b>${esc(r.usuario_fieldwy)}</b>` },
    { h: 'Nombre', t: 1, v: r => r.nombre, r: r => `<b>${esc(r.nombre)}</b>` }, { h: 'Tipo', t: 1, v: r => r.tipo_ingreso || 'Nuevo' }, { h: 'Tienda', t: 1, v: r => (tienda(r.idpdv) || {}).nombre || '' }, { h: 'Cadena', t: 1, v: r => (tienda(r.idpdv) || {}).cadena }, { h: 'Estado', t: 1, v: r => (tienda(r.idpdv) || {}).estado },
    { h: 'Supervisor', t: 1, v: r => (tienda(r.idpdv) || {}).supervisor }, { h: 'Razón social', t: 1, v: r => r.empresa },
    ...(sens ? [{ h: 'Teléfono', t: 1, v: r => r.s.telefono }, { h: 'Correo', t: 1, v: r => r.s.correo }, { h: 'CURP', t: 1, v: r => r.s.curp }, { h: 'RFC', t: 1, v: r => r.s.rfc }, { h: 'NSS', t: 1, v: r => r.s.nss }] : []),
    { h: 'Usuario creado', v: r => r.usuario_creado_en ? 1 : 0, r: r => r.usuario_creado_en ? `<span class="pill g">✔ ${fdate(r.usuario_creado_en.slice(0, 10))}</span>${edita ? ` <button class="rsv" onclick="usuarioCreado('${r.usuario_fieldwy}',false)">Deshacer</button>` : ''}` : (edita ? `<button class="rsv" onclick="usuarioCreado('${r.usuario_fieldwy}',true)">Marcar creado</button>` : '—') }];
  return sect('Altas capturadas del día', '📋') + `<div class="tools"><span>Día:</span><input type="date" max="${HOY}" value="${ALD.dia}" onchange="ALD.dia=this.value;vAltas()"><span class="muted">${fmt(rows.length)} altas · <b>${fmt(pend)}</b> sin usuario creado</span></div>` +
    tbl('t-ald', cols, rows, { fix: 3, search: 1, csv: 1, png: 1, file: 'altas_del_dia_' + ALD.dia, titulo: 'Altas del ' + fdia(ALD.dia), sort: 0, dir: 1, maxh: '50vh' });
}
async function usuarioCreado(u, v) { try { await API.marcarUsuarioCreado(u, v); toast(v ? 'Marcado: usuario creado' : 'Marca quitada'); vAltas(); } catch (e) { toast('No se pudo guardar (¿ya corriste el SQL v09?): ' + (e.message || e)); } }

/* ----- checklist del expediente: ver 07d_expedientes.js (almacén temporal + revisión) ----- */

/* >>> 07c_sueldos.js */
/* ====================================================================== SUELDOS Y DATOS BANCARIOS · AUDITORÍA ======================================================================
   Sueldos: historial por colaborador; solo administrador, analista y nómina los cambian (función cambiar_sueldo en la base).
   Datos bancarios: administrador, analista y nómina los ven completos; RH los captura una vez y los ve enmascarados (••••1234), sin poder cambiarlos.
   Los permisos reales los aplica la base de datos (RLS y funciones); aquí solo se muestra u oculta lo que corresponde.
   Auditoría: quién cambió qué y cuándo (los valores de datos bancarios y personales no se guardan, solo el nombre del campo). */
const SB = { sel: null, res: [], tm: null, su: [], ba: null };
const dinero = n => n == null || n === '' ? '—' : '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

Real.sueldosDe = async function (u) { const { data, error } = await sb.from('sueldos_historial').select('*').eq('usuario_fieldwy', u).order('vigente_desde', { ascending: false }); if (error) throw error; return data || []; };
Real.bancariosDe = async function (u) {
  if (can('datos_bancarios', 'ver')) { const { data, error } = await sb.from('datos_bancarios').select('*').eq('usuario_fieldwy', u).maybeSingle(); if (error) throw error; return { completo: true, d: data }; }
  const { data, error } = await sb.rpc('bancarios_enmascarados', { p_usuario: u }); if (error) throw new Error(error.message);
  return { completo: false, d: (data || [])[0] || null };
};
Real.guardarBancarios = async function (u, b) {
  const { error } = await sb.rpc('guardar_bancarios', { p_usuario: u, p_banco: b.banco || null, p_titular: b.titular || null, p_clabe: b.clabe || null, p_cuenta: b.cuenta || null, p_cuenta2: b.cuenta2 || null, p_tarjeta: b.tarjeta || null });
  if (error) throw new Error(error.message);
};
Real.cambiarSueldo = async function (u, d) {
  const { error } = await sb.rpc('cambiar_sueldo', { p_usuario: u, p_monto: d.monto, p_bono: d.bono, p_desde: d.desde, p_motivo: d.motivo || null });
  if (error) throw new Error(error.message);
};
Real.auditoria = async function () {
  const { data, error } = await sb.from('auditoria').select('id,tabla,registro,accion,cambios,usuario,en').order('en', { ascending: false }).limit(500); if (error) throw error;
  const { data: ps } = await sb.from('perfiles').select('id,nombre'); const nom = Object.fromEntries((ps || []).map(p => [p.id, p.nombre]));
  return (data || []).map(r => ({ ...r, quien: r.usuario ? (nom[r.usuario] || 'usuario') : 'sistema' }));
};
Real.historialDe = async function (u) { const { data, error } = await sb.from('relaciones_laborales').select('*').eq('usuario_fieldwy', u).order('numero'); if (error) throw error; return data || []; };
Real.vinculosDe = async function (u) { const { data, error } = await sb.from('vinculos_usuario').select('*').or(`usuario_a.eq.${u},usuario_b.eq.${u}`); if (error) throw error; return data || []; };
Real.vincular = async function (a, b, motivo) { const { error } = await sb.rpc('vincular_usuarios', { p_a: a, p_b: b, p_motivo: motivo || null }); if (error) throw new Error(error.message); };
Real.desvincular = async function (a, b) { const { error } = await sb.rpc('desvincular_usuarios', { p_a: a, p_b: b }); if (error) throw new Error(error.message); };
Demo.historialDe = async () => []; Demo.vinculosDe = async () => []; Demo.vincular = async () => { }; Demo.desvincular = async () => { };
Demo.sueldosDe = async () => []; Demo.bancariosDe = async () => ({ completo: false, d: null }); Demo.guardarBancarios = async () => { }; Demo.cambiarSueldo = async () => { }; Demo.auditoria = async () => [];

/* ----- pantalla ----- */
function vSueldos() {
  $('content').innerHTML = cab('Sueldos y datos bancarios', 'Busca un colaborador para consultar su sueldo y sus datos bancarios. Cada cambio queda en la auditoría.', 'mochila') +
    `<div class="tools"><input id="sb-q" type="search" placeholder="Nombre o usuario Fieldwy (mínimo 3 letras)…" oninput="sbBuscar(this.value)" style="flex:1;min-width:240px"></div><div id="sb-res"></div><div id="sb-det"></div>`;
  if (SB.sel) sbElegir(SB.sel); else setTimeout(() => { const q = $('sb-q'); if (q) q.focus(); }, 50);
}
function sbBuscar(q) {
  clearTimeout(SB.tm); const r = $('sb-res');
  if (limpiaQ(q).length < 3) { r.innerHTML = ''; return; }
  SB.tm = setTimeout(async () => {
    try { SB.res = await API.buscarColab(q); } catch (e) { r.innerHTML = `<div class="warn">${esc(e.message || e)}</div>`; return; }
    r.innerHTML = SB.res.length ? `<div class="bj-list">${SB.res.map((c, i) => { const t = tienda(c.idpdv) || {}; return `<div class="bj-it ${c.estatus === 'Baja' ? 'off' : ''}" onclick="sbElegir(SB.res[${i}])"><b>${esc(c.nombre)}</b><span>${esc(c.usuario_fieldwy)}</span><span>${esc(t.nombre || 'Sin tienda')}</span><span>${esc(c.estatus || '')}</span></div>`; }).join('')}</div>` : '<div class="note">Sin coincidencias.</div>';
  }, 280);
}
async function sbElegir(c) {
  SB.sel = c; const rs = $('sb-res'), det = $('sb-det'); if (!det) return; rs.innerHTML = ''; const q = $('sb-q'); if (q) q.value = '';
  det.innerHTML = '<div class="loading">Cargando…</div>';
  const u = c.usuario_fieldwy, t = tienda(c.idpdv) || {}, errs = [];
  SB.su = []; SB.ba = null;
  if (can('sueldos', 'ver')) { try { SB.su = await API.sueldosDe(u); } catch (e) { errs.push('Sueldos: ' + (e.message || e)); } }
  if (can('datos_bancarios', 'ver') || can('bancarios_vista', 'ver')) { try { SB.ba = await API.bancariosDe(u); } catch (e) { errs.push('Datos bancarios: ' + (e.message || e)); } }
  let hist = [], vin = [];
  if (can('colaboradores', 'ver')) { try { [hist, vin] = await Promise.all([API.historialDe(u), API.vinculosDe(u)]); } catch (e) { errs.push('Historial: ' + (e.message || e)); } }
  const vig = SB.su.find(x => !x.vigente_hasta);
  let h = `<div class="bj-card"><div><b>${esc(c.nombre)}</b><br><small>${esc(u)} · ${esc(c.empresa || 'sin razón social')} · ${esc(c.estatus || '')}</small></div><div><b>${esc(t.nombre || 'Sin tienda')}</b><br><small>${esc([t.cadena, t.estado, t.supervisor].filter(Boolean).join(' · '))}</small></div></div>`;
  h += errs.map(e => `<div class="warn">${esc(e)}</div>`).join('');
  if (hist.length) {
    h += sect('Historial laboral', '🕘') + `<div class="tw"><table class="dt"><thead><tr><th>#</th><th class="t">Tipo</th><th>Ingreso</th><th>Baja</th><th class="t">Estatus</th><th class="t">Calidad del dato</th></tr></thead><tbody>${hist.map(x => `<tr><td>${x.numero}</td><td class="t">${esc(x.tipo)}</td><td>${x.fecha_ingreso ? fdate(x.fecha_ingreso) : '—'}</td><td>${x.fecha_baja ? fdate(x.fecha_baja) : '—'}</td><td class="t">${esc(x.estatus)}</td><td class="t">${x.calidad === 'revisar' ? `<span class="pill" style="background:#fdf1de;color:#8a5a00" title="${esc(x.nota || '')}">Revisar</span> <small>${esc(x.nota || '')}</small>` : 'Correcto' + (x.nota ? ` <small>${esc(x.nota)}</small>` : '')}</td></tr>`).join('')}</tbody></table></div>`;
  }
  if (vin.length || can('usuarios', 'editar')) {
    h += `<div class="note">${vin.length ? 'Misma persona que: ' + vin.map(v => { const o = v.usuario_a === u ? v.usuario_b : v.usuario_a; return `<b>${esc(o)}</b>${can('usuarios', 'editar') ? ` <a href="#" onclick="sbDesvincular('${esc(u)}','${esc(o)}');return false" title="Quitar vínculo">✕</a>` : ''}`; }).join(', ') : 'Sin usuarios vinculados.'}${can('usuarios', 'editar') ? ' <button class="btn sm" onclick="sbVincular()">🔗 Vincular con otro usuario</button>' : ''}</div>`;
  }
  if (can('sueldos', 'ver')) {
    h += sect('Sueldo', '💵') + `<div class="kpis">${kp('Sueldo mensual vigente', vig ? dinero(vig.sueldo_mensual) : '—', vig ? 'desde ' + fdate(vig.vigente_desde) : 'sin sueldo capturado', vig ? C.gr : C.gy, null, '💵')}${kp('Bono fijo', vig ? dinero(vig.bono_fijo) : '—', 'vigente', C.gy, null, '🎯')}</div>`;
    h += `<div class="tools">${can('sueldos', 'editar') ? '<button class="btn primary" onclick="sbSueldoForm()">✏️ Cambiar sueldo</button>' : '<span class="muted">Solo administrador, analista y nómina pueden cambiar sueldos.</span>'}</div>`;
    h += SB.su.length ? `<div class="tw"><table class="dt"><thead><tr><th>Desde</th><th>Hasta</th><th>Sueldo mensual</th><th>Bono fijo</th><th class="t">Motivo</th></tr></thead><tbody>${SB.su.map(x => `<tr><td>${fdate(x.vigente_desde)}</td><td>${x.vigente_hasta ? fdate(x.vigente_hasta) : '<b>vigente</b>'}</td><td>${dinero(x.sueldo_mensual)}</td><td>${dinero(x.bono_fijo)}</td><td class="t">${esc(x.motivo || '')}</td></tr>`).join('')}</tbody></table></div>` : '';
  }
  if (SB.ba !== null || can('datos_bancarios', 'crear')) {
    h += sect('Datos bancarios', '💳'); const b = SB.ba && SB.ba.d;
    if (b) {
      h += `<div class="tw"><table class="dt"><tbody>${[['Banco', b.banco], ['Titular', b.titular], ['CLABE', b.clabe], ['Cuenta', b.cuenta], ['Cuenta 2', b.cuenta2], ['Tarjeta', b.tarjeta]].map(([k, v]) => `<tr><td class="t"><b>${k}</b></td><td class="t">${esc(v || '—')}</td></tr>`).join('')}</tbody></table></div>`;
      h += `<div class="note">${SB.ba.completo ? 'Capturado el ' + fdate((b.capturado_en || '').slice(0, 10)) + '.' : 'Datos enmascarados: sirven para confirmar que ya están capturados. No se pueden ver completos ni modificar con tu usuario.'}</div>`;
      if (can('datos_bancarios', 'editar')) h += '<div class="tools"><button class="btn" onclick="sbBancForm()">✏️ Corregir datos bancarios</button></div>';
    } else {
      h += '<div class="note">Todavía no hay datos bancarios capturados.</div>';
      if (can('datos_bancarios', 'crear')) h += '<div class="tools"><button class="btn primary" onclick="sbBancForm()">➕ Capturar datos bancarios</button></div>';
    }
  }
  if (!can('sueldos', 'ver') && SB.ba === null && !can('datos_bancarios', 'crear')) h += '<div class="warn">Tu usuario no tiene acceso a sueldos ni a datos bancarios.</div>';
  det.innerHTML = h;
}
async function sbVincular() {
  const c = SB.sel, otro = prompt(`Usuario Fieldway de la MISMA persona que ${c.usuario_fieldwy} (por ejemplo el mismo con GB al final):`, ''); if (otro === null) return;
  const o = mayus(otro); if (!o) return; const motivo = prompt('Motivo del vínculo (opcional):', 'Misma persona con otro usuario') || '';
  try { await API.vincular(c.usuario_fieldwy, o, motivo); toast('Usuarios vinculados'); sbElegir(c); } catch (e) { toast('No se pudo vincular: ' + (e.message || e)); }
}
async function sbDesvincular(a, b) { if (!confirm(`¿Quitar el vínculo entre ${a} y ${b}?`)) return; try { await API.desvincular(a, b); toast('Vínculo quitado'); sbElegir(SB.sel); } catch (e) { toast('No se pudo: ' + (e.message || e)); } }
function sbSueldoForm() {
  const c = SB.sel, vig = SB.su.find(x => !x.vigente_hasta), fld = (l, id, ex, v) => `<div class="fld"><label>${l}</label><input id="sb-${id}" ${ex || ''} value="${esc(v == null ? '' : v)}"></div>`;
  $('modal').innerHTML = `<div class="mbox" role="dialog" aria-modal="true"><h3>✏️ Cambiar sueldo</h3><div class="who">${esc(c.nombre)} · ${esc(c.usuario_fieldwy)}</div>
    <div class="row2">${fld('Sueldo mensual ($) *', 'monto', 'type="number" min="0" step="0.01"', vig ? vig.sueldo_mensual : '')}${fld('Bono fijo ($)', 'bono', 'type="number" min="0" step="0.01"', vig ? vig.bono_fijo : '')}</div>
    <div class="row2">${fld('Aplica desde *', 'desde', 'type="date"', HOY)}${fld('Motivo', 'motivo', 'placeholder="Ej. ajuste anual"', '')}</div>
    <div class="note">El sueldo anterior se cierra un día antes de la fecha elegida y queda en el historial.</div><div class="warn" id="sb-warn" hidden></div>
    <div class="mfoot"><button class="btn" onclick="cerrarM()">Cancelar</button><button class="btn primary" id="sb-ok">Guardar</button></div></div>`;
  $('modal').hidden = false; $('modal').onclick = e => { if (e.target.id === 'modal') cerrarM(); };
  $('sb-ok').onclick = async () => {
    const m = $('sb-monto').value, bn = $('sb-bono').value, d = $('sb-desde').value, w = $('sb-warn'), b = $('sb-ok');
    if (m === '' || +m < 0) { w.hidden = false; w.textContent = 'Escribe el sueldo mensual.'; return; } if (!d) { w.hidden = false; w.textContent = 'Elige desde cuándo aplica.'; return; }
    b.disabled = true; b.textContent = 'Guardando…';
    try { await API.cambiarSueldo(c.usuario_fieldwy, { monto: +m, bono: bn === '' ? null : +bn, desde: d, motivo: limpia($('sb-motivo').value) }); cerrarM(); toast('Sueldo actualizado'); sbElegir(c); }
    catch (e) { b.disabled = false; b.textContent = 'Reintentar'; w.hidden = false; w.textContent = e.message || String(e); }
  };
}
function sbBancForm() {
  const c = SB.sel, d = (SB.ba && SB.ba.completo && SB.ba.d) || {}, fld = (l, id, ex, v) => `<div class="fld"><label>${l}</label><input id="sb-${id}" ${ex || ''} value="${esc(v == null ? '' : v)}"></div>`;
  const edit = !!(SB.ba && SB.ba.d);
  $('modal').innerHTML = `<div class="mbox" role="dialog" aria-modal="true"><h3>💳 ${edit ? 'Corregir' : 'Capturar'} datos bancarios</h3><div class="who">${esc(c.nombre)} · ${esc(c.usuario_fieldwy)}</div>
    <div class="row2">${fld('Banco', 'banco', '', d.banco)}${fld('CLABE interbancaria', 'clabe', 'inputmode="numeric" maxlength="18" placeholder="18 dígitos"', d.clabe)}</div>
    <div class="row2">${fld('Cuenta', 'cuenta', 'inputmode="numeric"', d.cuenta)}${fld('Cuenta 2', 'cuenta2', 'inputmode="numeric"', d.cuenta2)}</div>
    <div class="row2">${fld('Tarjeta', 'tarjeta', 'inputmode="numeric" maxlength="16"', d.tarjeta)}${fld('Titular (si es otra persona)', 'titular', '', d.titular)}</div>
    <div class="note">${edit ? 'Los campos que dejes vacíos conservan su valor actual.' : 'Una vez capturados, RH ya no puede modificarlos; solo administración, analista o nómina.'}</div><div class="warn" id="sb-warn" hidden></div>
    <div class="mfoot"><button class="btn" onclick="cerrarM()">Cancelar</button><button class="btn primary" id="sb-ok">Guardar</button></div></div>`;
  $('modal').hidden = false; $('modal').onclick = e => { if (e.target.id === 'modal') cerrarM(); };
  $('sb-ok').onclick = async () => {
    const g = id => limpia($('sb-' + id).value), w = $('sb-warn'), b = $('sb-ok'), clabe = digs(g('clabe'));
    if (clabe && !V.clabe(clabe)) { w.hidden = false; w.textContent = 'La CLABE no es válida (18 dígitos con dígito verificador correcto).'; return; }
    if (!edit && !(g('banco') || clabe || g('cuenta') || g('tarjeta'))) { w.hidden = false; w.textContent = 'Captura al menos el banco y la CLABE o la cuenta.'; return; }
    b.disabled = true; b.textContent = 'Guardando…';
    try { await API.guardarBancarios(c.usuario_fieldwy, { banco: g('banco'), titular: g('titular'), clabe, cuenta: digs(g('cuenta')), cuenta2: digs(g('cuenta2')), tarjeta: digs(g('tarjeta')) }); cerrarM(); toast('Datos bancarios guardados'); sbElegir(c); }
    catch (e) { b.disabled = false; b.textContent = 'Reintentar'; w.hidden = false; w.textContent = e.message || String(e); }
  };
}

/* ----- auditoría ----- */
async function vAuditoria() {
  $('content').innerHTML = cab('Auditoría', 'Últimos 500 cambios en colaboradores, bajas, usuarios, permisos, sueldos y datos sensibles. En datos bancarios y personales solo se guarda qué campo cambió, nunca su valor.', 'mochila') + '<div class="loading">Cargando…</div>';
  let rows; try { rows = await API.auditoria(); } catch (e) { $('content').innerHTML += `<div class="warn">No se pudo cargar: ${esc(e.message || e)}</div>`; return; }
  const resumen = c => { if (!c) return ''; const t = Object.entries(c).map(([k, v]) => v && typeof v === 'object' && 'antes' in v ? `${k}: ${String(v.antes)} → ${String(v.despues)}` : (typeof v === 'string' ? `${k} (${v})` : k)).join(' · '); return t.length > 160 ? t.slice(0, 157) + '…' : t; };
  TB = {};
  $('content').innerHTML = cab('Auditoría', 'Últimos 500 cambios. En datos bancarios y personales solo se guarda qué campo cambió, nunca su valor.', 'mochila') + tbl('t-aud', [
    { h: 'Fecha y hora', v: r => r.en, r: r => fdate(String(r.en).slice(0, 10)) + ' ' + String(r.en).slice(11, 16), w: 130 }, { h: 'Quién', t: 1, v: r => r.quien }, { h: 'Tabla', t: 1, v: r => r.tabla }, { h: 'Registro', t: 1, v: r => r.registro || '' },
    { h: 'Acción', t: 1, v: r => r.accion }, { h: 'Cambios', t: 1, v: r => resumen(r.cambios), r: r => `<small>${esc(resumen(r.cambios))}</small>` }
  ], rows, { fix: 0, search: 1, csv: 1, file: 'auditoria', titulo: 'Auditoría', sort: 0, dir: -1, maxh: '72vh' });
  drawAll();
}

/* >>> 07d_expedientes.js */
/* ====================================================================== EXPEDIENTES: ALMACÉN TEMPORAL + REVISIÓN ======================================================================
   RH sube cada documento (PDF/JPG/PNG, máx. 10 MB; las fotos se reducen en el navegador) al almacén privado de Supabase (1 GB en plan Free).
   RH aprueba o pide corrección (con motivo). Los documentos aprobados y los reemplazados los copia a OneDrive la tarea archivar_expedientes.py
   (verifica tamaño y huella SHA-256 y luego borra el temporal). Mientras están en el almacén se abren con un enlace que vence en 60 segundos.
   Los permisos reales los aplica la base de datos (módulo expediente_archivos: administrador, analista y RH de su estado). */
const EXPB = 'expedientes-temp', EXP_MAX = 10 * 1024 * 1024, EXP_MIME = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };
const EXPD = { cat: null, archivos: [], usuario: null };

Real.catalogoDocs = async function () { const { data, error } = await sb.from('catalogo_documentos').select('*').eq('activo', true).order('orden'); if (error) throw error; return data || []; };
Real.archivosDe = async function (u) { const { data, error } = await sb.from('expediente_archivos').select('*').eq('usuario_fieldwy', u).order('version', { ascending: false }); if (error) throw error; return data || []; };
Real.subirDocumento = async function (u, tipo, file) {
  const p = await docPreparar(file), ext = EXP_MIME[p.mime];
  const { data: prep, error: e1 } = await sb.rpc('preparar_subida', { p_usuario: u, p_tipo: tipo, p_ext: ext }); if (e1) throw new Error(e1.message);
  const { error: e2 } = await sb.storage.from(EXPB).upload(prep.ruta, p.blob, { contentType: p.mime, upsert: false }); if (e2) throw new Error('No se pudo subir el archivo: ' + e2.message);
  const { error: e3 } = await sb.rpc('registrar_archivo', { p_usuario: u, p_tipo: tipo, p_version: prep.version, p_ruta: prep.ruta, p_nombre: file.name, p_mime: p.mime, p_bytes: p.bytes, p_sha: p.sha }); if (e3) throw new Error(e3.message);
  return prep.version;
};
Real.urlDocumento = async function (ruta) { const { data, error } = await sb.storage.from(EXPB).createSignedUrl(ruta, 60); if (error) throw new Error(error.message); return data.signedUrl; };
Real.revisarArchivo = async function (id, estado, motivo) { const { error } = await sb.rpc('revisar_archivo', { p_id: id, p_estado: estado, p_motivo: motivo || null }); if (error) throw new Error(error.message); };
Real.almacenUso = async function () { const { data, error } = await sb.rpc('almacen_uso'); if (error) throw new Error(error.message); return data; };
Demo.catalogoDocs = async () => DOCS_EXP.map(([tipo, o], i) => ({ tipo, obligatorio: !!o, orden: i + 1 })); Demo.archivosDe = async () => []; Demo.subirDocumento = async () => 1; Demo.urlDocumento = async () => '#';
Demo.revisarArchivo = async () => { }; Demo.almacenUso = async () => ({ pct: 3.2, bytes: 34e6, archivos: 41 });

/* imágenes: se reducen a 1600 px y JPEG 82 % (si queda más pequeño); se calcula la huella SHA-256 que luego verifica el archivado */
async function docPreparar(file) {
  let blob = file, mime = file.type;
  if (!EXP_MIME[mime]) throw new Error('Solo se aceptan archivos PDF, JPG o PNG');
  if (mime.startsWith('image/')) {
    try {
      const bmp = await createImageBitmap(file), k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
      c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      const b2 = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.82)); if (b2 && b2.size < file.size) { blob = b2; mime = 'image/jpeg'; }
    } catch (e) { /* si el navegador no puede, se sube tal cual */ }
  }
  if (blob.size > EXP_MAX) throw new Error('El archivo pesa más de 10 MB' + (mime === 'application/pdf' ? ': comprímelo antes de subirlo' : ''));
  const h = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return { blob, mime, bytes: blob.size, sha: [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('') };
}
const kbTxt = b => b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';

async function expedienteAbrir(usuario) {
  EXPD.usuario = usuario;
  let cat, arch, uso = null;
  try { [cat, arch] = await Promise.all([API.catalogoDocs(), API.archivosDe(usuario)]); } catch (e) { toast('No se pudo cargar el expediente: ' + (e.message || e)); return; }
  try { if (can('expediente_archivos', 'ver')) uso = await API.almacenUso(); } catch (e) { }
  EXPD.cat = cat; EXPD.archivos = arch;
  const sube = can('expediente_archivos', 'crear'), revisa = can('expediente_archivos', 'editar');
  const nom = (ALD.lista.find(x => x.usuario_fieldwy === usuario) || (AL.ult || []).find(x => x.usuario_fieldwy === usuario) || ((EXP.lista || []).find(x => x.usuario_fieldwy === usuario) || {}).colaboradores || {}).nombre || usuario;
  const vigente = t => arch.filter(a => a.tipo === t && a.estado !== 'Reemplazado').sort((x, y) => y.version - x.version)[0];
  const oblig = cat.filter(c => c.obligatorio), ok = oblig.filter(c => (vigente(c.tipo) || {}).estado === 'Aprobado').length;
  const pill = st => pillx(esc(st), st === 'Aprobado' ? 'g' : st === 'En revisión' ? 'a' : st === 'Pendiente de corrección' ? 'r' : 'x');
  const fila = (c, i) => {
    const a = vigente(c.tipo), st = a ? a.estado : 'Falta', n = arch.filter(x => x.tipo === c.tipo).length;
    const donde = !a ? '' : a.ubicacion === 'Archivado' ? `<small class="muted">Archivado en OneDrive: ${esc(a.ruta_final || '')}</small>` : a.ubicacion === 'Error' ? `<small style="color:var(--red)">Error al archivar: ${esc(a.error_archivo || '')}</small>` : `<small class="muted">En el almacén temporal</small>`;
    return `<div class="xd-row"><div class="xd-n"><b>${esc(c.tipo)}</b>${c.obligatorio ? ' <small class="muted">obligatorio</small>' : ''}<br>${pill(st)}${a ? ` <small class="muted">v${a.version} · ${kbTxt(a.bytes)} · ${fdate(String(a.subido_en).slice(0, 10))}${n > 1 ? ' · ' + n + ' versiones' : ''}</small>` : ''}${a && a.motivo ? `<br><small class="muted">${esc(a.motivo)}</small>` : ''}<br>${donde}</div>
      <div class="xd-a">${a && a.ubicacion === 'Temporal' && can('expediente_archivos', 'ver') ? `<button class="btn sm" onclick="docVer(${a.id})">👁 Ver</button>` : ''}${a && a.ubicacion === 'Archivado' && can('expediente_archivos', 'ver') ? `<button class="btn sm" onclick="docCopiarRuta(${a.id})">📋 Copiar ruta</button>` : ''}
        ${sube ? `<input type="file" id="xd-f${i}" accept="application/pdf,image/jpeg,image/png" hidden onchange="docSubir(${i})"><button class="btn sm" onclick="$('xd-f${i}').click()">${a ? '⬆ Subir otra versión' : '⬆ Subir'}</button>` : ''}
        ${revisa && a && a.estado === 'En revisión' ? `<button class="btn sm primary" onclick="docRevisar(${a.id},'Aprobado')">✔ Aprobar</button><button class="btn sm" onclick="docRevisar(${a.id},'Pendiente de corrección')">✖ Pedir corrección</button>` : ''}</div></div>`;
  };
  $('modal').innerHTML = `<div class="mbox wide" style="width:min(980px,96vw);max-height:92vh;overflow:auto" role="dialog" aria-modal="true"><h3>🗂️ Expediente</h3><div class="who">${esc(nom)} · ${esc(usuario)}<br><b>${ok} de ${oblig.length}</b> documentos obligatorios aprobados</div>
    ${uso && uso.pct >= 70 ? `<div class="warn">El almacén temporal está al ${uso.pct}% (${kbTxt(uso.bytes)} de 1 GB). Corre la tarea de archivado para pasar los aprobados a OneDrive.</div>` : ''}
    <div class="note">Sube PDF, JPG o PNG (máx. 10 MB; las fotos se reducen solas). Al <b>aprobar</b> todos los obligatorios, el pendiente <b>Expediente</b> se cierra solo. Los documentos aprobados se archivan en OneDrive${uso ? ` · almacén temporal: ${uso.pct}% usado` : ''}.</div>
    ${cat.map(fila).join('')}<div class="mfoot"><button class="btn" onclick="cerrarM();if(S.view==='expedientes')vExpedientes()">Cerrar</button></div></div>`;
  $('modal').hidden = false; $('modal').onclick = e => { if (e.target.id === 'modal') { cerrarM(); if (S.view === 'expedientes') vExpedientes(); } };
}
async function docSubir(i) {
  const inp = $('xd-f' + i), f = inp && inp.files && inp.files[0]; if (!f) return; const c = EXPD.cat[i];
  toast('Subiendo ' + c.tipo + '…');
  try { const v = await API.subirDocumento(EXPD.usuario, c.tipo, f); toast(c.tipo + ' subido (versión ' + v + ') · en revisión'); } catch (e) { toast('No se pudo subir: ' + (e.message || e)); }
  expedienteAbrir(EXPD.usuario);
}
async function docVer(id) {
  const a = EXPD.archivos.find(x => x.id === id); if (!a || !a.ruta_temp) return;
  try { const url = await API.urlDocumento(a.ruta_temp); window.open(url, '_blank', 'noopener'); } catch (e) { toast('No se pudo abrir: ' + (e.message || e)); }
}
function docCopiarRuta(id) {
  const a = EXPD.archivos.find(x => x.id === id); if (!a) return; const txt = a.ruta_final || '';
  (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('Ruta copiada: ' + txt), () => prompt('Copia la ruta del archivo en OneDrive:', txt));
}
async function docRevisar(id, estado) {
  let motivo = null; if (estado === 'Pendiente de corrección') { motivo = prompt('¿Qué debe corregir? (ilegible, incompleto, vencido, de otra persona…)', ''); if (motivo === null) return; if (limpia(motivo).length < 5) { toast('Escribe el motivo (mínimo 5 caracteres)'); return; } }
  try {
    await API.revisarArchivo(id, estado, motivo ? limpia(motivo) : null); toast(estado === 'Aprobado' ? 'Documento aprobado' : 'Documento devuelto para corrección');
  } catch (e) { toast('No se pudo guardar: ' + (e.message || e)); }
  expedienteAbrir(EXPD.usuario);
}

/* >>> 07e_finiquitos.js */
/* ====================================================================== FINIQUITOS ======================================================================
   RH confirma la baja. El ANALISTA calcula, valida, pide los documentos, revisa el firmado, autoriza y envía a pago. RH sube el PDF firmado. Nómina/analista marcan Pagado.
   Todo cálculo y toda regla viven en la base (calcular_finiquito, finiquito_*): aquí solo se captura y se muestra. Los documentos (Word -> PDF) los genera la tarea de la PC
   (procesar_finiquitos.py) y los firmados aprobados se archivan en OneDrive\RRHH\FINIQUITOS\AAAA\AAAA-MM\USUARIO. */
const FQB = 'finiquitos-temp', FQ_MAX = 15 * 1024 * 1024;
const FQ = { lista: [], tab: 'calcular', q: '', emp: [], fin: null, arch: [] };
const FQ_TABS = [['calcular', 'Por calcular'], ['proceso', 'En proceso'], ['pagar', 'Por pagar'], ['pagados', 'Pagados']];
const FQ_EN_PROCESO = ['Calculado', 'Validado', 'Documento solicitado', 'Documento generado', 'Firmado'];
const money = n => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

Real.finLista = async function () { const { data, error } = await sb.from('v_finiquitos_lista').select('*').order('fecha_baja', { ascending: false }); if (error) throw error; return data || []; };
Real.finEmpresas = async function () { const { data, error } = await sb.from('empresas_legales').select('*').eq('activa', true).order('clave'); if (error) throw error; return data || []; };
Real.finDetalle = async function (id) {
  const [f, a] = await Promise.all([sb.from('finiquitos').select('*').eq('id', id).single(), sb.from('finiquito_archivos').select('*').eq('finiquito_id', id).order('id', { ascending: false })]);
  if (f.error) throw f.error; if (a.error) throw a.error; return { f: f.data, a: a.data || [] };
};
Real.finParametros = async function () { const { data, error } = await sb.from('parametros_finiquito').select('*').order('clave').order('vigente_desde', { ascending: false }); if (error) throw error; return data || []; };
Real.finRpc = async function (fn, args) { const { data, error } = await sb.rpc(fn, args || {}); if (error) throw new Error(error.message); return data; };
Real.finColab = async function (u) { const { data } = await sb.from('colaboradores').select('empresa').eq('usuario_fieldwy', u).maybeSingle(); return data || {}; };
Real.finBancarios = async function (us) { const { data, error } = await sb.from('datos_bancarios').select('usuario_fieldwy,banco,titular,clabe,cuenta,tarjeta').in('usuario_fieldwy', us); if (error) throw error; return data || []; };
Real.finSubirFirmado = async function (id, file) {
  if (file.type !== 'application/pdf') throw new Error('El firmado debe ser un PDF'); if (file.size > FQ_MAX) throw new Error('El PDF pesa más de 15 MB: comprímelo antes de subirlo');
  const buf = await file.arrayBuffer(), h = await crypto.subtle.digest('SHA-256', buf), sha = [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
  const prep = await Real.finRpc('finiquito_preparar_firmado', { p_id: id });
  const { error } = await sb.storage.from(FQB).upload(prep.ruta, new Blob([buf], { type: 'application/pdf' }), { contentType: 'application/pdf', upsert: false }); if (error) throw new Error('No se pudo subir el archivo: ' + error.message);
  await Real.finRpc('finiquito_registrar_firmado', { p_id: id, p_version: prep.version, p_ruta: prep.ruta, p_nombre: file.name, p_bytes: file.size, p_sha: sha });
};
Real.finUrl = async function (ruta) { const { data, error } = await sb.storage.from(FQB).createSignedUrl(ruta, 60); if (error) throw new Error(error.message); return data.signedUrl; };

Demo.finLista = async () => [
  { baja_id: 1, usuario_fieldwy: 'demo.uno', nombre: 'MARÍA LÓPEZ DEMO', fecha_baja: '2026-10-02', motivo_baja: 'Renuncia', tienda: 'Coppel Centro', estado_tienda: 'Jalisco', dias_desde_baja: 7, finiquito_id: null, estatus: null, total: null, ingreso_historial: '2024-01-16', ingreso_calidad: 'ok' },
  { baja_id: 2, usuario_fieldwy: 'demo.dos', nombre: 'JUAN PÉREZ DEMO', fecha_baja: '2026-09-28', motivo_baja: 'Abandono', tienda: 'Elektra Sur', estado_tienda: 'Puebla', dias_desde_baja: 11, finiquito_id: 5, estatus: 'Documento generado', total: 4826.88, ingreso_historial: null }];
Demo.finEmpresas = async () => [{ clave: 'BENBER', nombre_abreviado: 'GRUPO BENBER VITAL, S.A. DE C.V.' }, { clave: 'SERSOIN', nombre_abreviado: 'SERSOIN, S.A. DE C.V.' }];
Demo.finDetalle = async () => ({ f: null, a: [] }); Demo.finParametros = async () => [{ clave: 'salario_minimo', vigente_desde: '2026-01-01', valor: 315.04, nota: 'por confirmar' }];
Demo.finRpc = async () => null; Demo.finColab = async () => ({}); Demo.finBancarios = async () => []; Demo.finSubirFirmado = async () => { }; Demo.finUrl = async () => '#';

function finPill(st) { return pillx(esc(st || 'Sin calcular'), st === 'Pagado' ? 'g' : st === 'Autorizado' ? 'g' : st === 'Firmado' ? 'g' : !st ? 'x' : 'a'); }
function finBajar(nombre, filas) {
  const csv = filas.map(r => r.map(v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(',')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })); a.download = nombre; a.click(); toast('CSV descargado');
}

async function vFiniquitos() {
  $('content').innerHTML = cab('Finiquitos', 'Solo promotores con baja reciente (máximo 120 días). Salario base: salario mínimo vigente a la fecha de baja. Flujo: calcular → validar → documentos → firmado (RH) → autorizar → pago.', 'mochila') + '<div class="loading">Cargando…</div>';
  try { [FQ.lista, FQ.emp] = await Promise.all([API.finLista(), API.finEmpresas()]); } catch (e) { $('content').innerHTML += `<div class="warn">No se pudo cargar: ${esc(e.message || e)}</div>`; return; }
  finPintar();
}
function finEnTab(r, t) {
  const st = r.estatus; if (t === 'calcular') return !r.finiquito_id; if (t === 'proceso') return FQ_EN_PROCESO.includes(st); if (t === 'pagar') return st === 'Autorizado'; return st === 'Pagado';
}
function finPintar() {
  const q = norm(FQ.q), cuenta = t => FQ.lista.filter(r => finEnTab(r, t)).length;
  const filas = FQ.lista.filter(r => finEnTab(r, FQ.tab)).filter(r => okT(tienda(r.idpdv) || null) || (!tienda(r.idpdv) && !Object.values(FL).some(Boolean))).filter(r => !q || norm(`${r.nombre} ${r.usuario_fieldwy} ${r.tienda || ''}`).includes(q));
  const accion = r => r.finiquito_id ? `<button class="btn sm" onclick="finAbrir(${r.finiquito_id})">Abrir</button>` : can('finiquitos', 'crear') ? `<button class="btn sm primary" onclick="finCalcular(${r.baja_id})">Calcular</button>` : '';
  const fila = r => `<tr>${FQ.tab === 'pagar' && can('finiquitos', 'editar') && !r.lote_id ? `<td><input type="checkbox" class="fq-sel" value="${r.finiquito_id}"></td>` : FQ.tab === 'pagar' && can('finiquitos', 'editar') ? '<td></td>' : ''}
    <td class="t"><b>${esc(r.nombre)}</b><br><small class="muted">${esc(r.usuario_fieldwy)}</small></td><td class="t">${esc(r.tienda || '—')}<br><small class="muted">${esc(r.estado_tienda || '')}</small></td><td>${fdate(r.fecha_baja)}</td>
    <td>${r.dias_desde_baja}${r.dias_desde_baja > 120 && !r.finiquito_id ? ' ' + pillx('fuera de plazo', 'r') : ''}</td><td class="t">${finPill(r.estatus)}${r.lote_id ? `<br><small class="muted">lote ${r.lote_id}</small>` : ''}</td><td>${r.total != null ? money(r.total) : '—'}</td><td>${accion(r)}</td></tr>`;
  const pagar = FQ.tab === 'pagar' && can('finiquitos', 'editar');
  $('content').innerHTML = cab('Finiquitos', 'Solo promotores con baja reciente (máximo 120 días). Salario base: salario mínimo vigente a la fecha de baja. Flujo: calcular → validar → documentos → firmado (RH) → autorizar → pago.', 'mochila') +
    `<div class="tools">${FQ_TABS.map(([k, n]) => `<button class="btn ${FQ.tab === k ? 'primary' : ''}" onclick="FQ.tab='${k}';finPintar()">${n} (${cuenta(k)})</button>`).join('')}
      <input id="fq-q" placeholder="Buscar nombre, usuario o tienda" value="${esc(FQ.q)}" oninput="FQ.q=this.value;finPintar();$('fq-q').focus()" style="min-width:220px">
      ${can('finiquitos', 'editar') ? '<button class="btn" onclick="finParametros()">⚙️ Parámetros</button>' : ''}${FQ.tab === 'pagar' ? '<button class="btn" onclick="finLayoutPago()">⬇ Layout de pago (CSV)</button>' : ''}
      ${pagar ? '<button class="btn primary" onclick="finCrearLote()">📦 Enviar a pago los marcados</button>' : ''}</div>
    <div class="tw"><table class="dt"><thead><tr>${pagar ? '<th></th>' : ''}<th class="t">Promotor</th><th class="t">Tienda</th><th>Baja</th><th>Días</th><th class="t">Estatus</th><th>Total</th><th></th></tr></thead>
    <tbody>${filas.map(fila).join('') || '<tr><td colspan="8" class="muted">Sin registros</td></tr>'}</tbody></table></div>`;
}

async function finCalcular(bajaId) {
  const r = FQ.lista.find(x => x.baja_id === bajaId); if (!r) return;
  let colab = {}; try { colab = await API.finColab(r.usuario_fieldwy); } catch (e) { }
  const emp = norm(colab.empresa || ''), pre = (FQ.emp.find(e => emp && (emp.includes(norm(e.clave)) || norm(e.nombre_abreviado).includes(emp))) || {}).clave || '';
  const hist = r.ingreso_historial && r.ingreso_calidad !== 'revisar';
  $('modal').innerHTML = `<div class="mbox" style="width:min(560px,96vw);max-height:92vh;overflow:auto" role="dialog" aria-modal="true"><h3>🧮 Calcular finiquito</h3><div class="who">${esc(r.nombre)} · baja ${fdate(r.fecha_baja)}</div>
    <div class="fld"><label>Razón social</label><select id="fq-emp"><option value="">— elige —</option>${FQ.emp.map(e => `<option value="${esc(e.clave)}" ${e.clave === pre ? 'selected' : ''}>${esc(e.nombre_abreviado)}</option>`).join('')}</select></div>
    <div class="fld"><label>Estado de emisión del documento</label><input id="fq-edo" value="${esc(r.estado_tienda || '')}"></div>
    <div class="fld"><label>Fecha de ingreso ${hist ? `(historial: ${fdate(r.ingreso_historial)}; déjala vacía para usarla)` : '(no hay una confiable en el historial: captúrala)'}</label><input id="fq-ing" type="date"></div>
    <div class="fld"><label>Fuente de la fecha de ingreso (solo si la capturas)</label><input id="fq-nota" placeholder="Ej. contrato firmado, alta IMSS"></div>
    <div class="row2"><div class="fld"><label>Días de vacaciones pendientes</label><input id="fq-vac" type="number" min="0" step="0.5" value="0"></div><div class="fld"><label>Días de gratificación</label><input id="fq-grat" type="number" min="0" step="0.5" value="0"></div></div>
    <div class="fld"><label>Descuentos ($)</label><input id="fq-desc" type="number" min="0" step="0.01" value="0"></div>
    <div class="mfoot"><button class="btn" onclick="cerrarM()">Cancelar</button><button class="btn primary" onclick="finCalcularOk(${bajaId})">Calcular</button></div></div>`;
  $('modal').hidden = false;
}
async function finCalcularOk(bajaId) {
  const v = id => $(id).value, ing = v('fq-ing');
  try {
    const id = await API.finRpc('calcular_finiquito', { p_baja: bajaId, p_fecha_ingreso: ing || null, p_ingreso_nota: ing ? limpia(v('fq-nota')) : null, p_empresa: v('fq-emp') || null, p_edo: limpia(v('fq-edo')) || null,
      p_dias_vac_pend: +v('fq-vac') || 0, p_dias_grat: +v('fq-grat') || 0, p_descuentos: +v('fq-desc') || 0 });
    toast('Finiquito calculado'); cerrarM(); FQ.lista = await API.finLista(); finAbrir(id);
  } catch (e) { toast(e.message || e); }
}

async function finAbrir(id) {
  let d; try { d = await API.finDetalle(id); } catch (e) { toast('No se pudo abrir: ' + (e.message || e)); return; }
  const f = d.f; FQ.fin = f; FQ.arch = d.a; if (!f) { toast('Sin datos (modo demo)'); return; }
  const nom = (FQ.lista.find(x => x.usuario_fieldwy === f.usuario_fieldwy) || {}).nombre || f.usuario_fieldwy, st = f.estatus, edita = can('finiquitos', 'editar');
  const fila = (k, v) => `<tr><td class="t">${k}</td><td style="text-align:right">${v}</td></tr>`;
  const fir = d.a.filter(a => a.tipo === 'Firmado' && a.estado !== 'Reemplazado')[0], docs = d.a.filter(a => a.tipo === 'Documentos' && a.estado !== 'Reemplazado')[0];
  const ver = a => a && a.ubicacion === 'Temporal' ? `<button class="btn sm" onclick="finVer(${a.id})">👁 Abrir</button>` : a && a.ubicacion === 'Archivado' ? `<small class="muted">Archivado: ${esc(a.ruta_final || '')}</small>` : '';
  const b = [];
  if (edita && st === 'Calculado') b.push(`<button class="btn" onclick="finCalcular(${f.baja_id})">Recalcular</button><button class="btn primary" onclick="finAccion('finiquito_validar',${f.id},'Validado')">✔ Validar</button>`);
  if (edita && st === 'Validado') b.push(`<button class="btn primary" onclick="finAccion('finiquito_solicitar_documentos',${f.id},'Documentos solicitados: la tarea de la PC los genera en la siguiente corrida')">📄 Solicitar documentos</button>`);
  if (st === 'Documento generado' && can('finiquito_archivos', 'crear')) b.push(`<input type="file" id="fq-pdf" accept="application/pdf" hidden onchange="finSubir(${f.id})"><button class="btn primary" onclick="$('fq-pdf').click()">⬆ Subir PDF firmado</button>`);
  if (st === 'Firmado' && edita) b.push(`<button class="btn primary" onclick="finAccion('finiquito_autorizar',${f.id},'Autorizado')">✔ Autorizar</button>`);
  if (st === 'Autorizado' && f.lote_id && can('finiquitos_pago', 'editar')) b.push(`<button class="btn primary" onclick="finPagar(${f.id})">💵 Marcar pagado</button>`);
  if (edita && ['Validado', 'Documento solicitado', 'Documento generado', 'Firmado', 'Autorizado'].includes(st) && !f.lote_id) b.push(`<button class="btn" onclick="finMotivo('finiquito_reabrir',${f.id},'Reabrir para recalcular')">↩ Reabrir</button>`);
  if (edita && st !== 'Pagado' && st !== 'Cancelado') b.push(`<button class="btn" onclick="finMotivo('finiquito_cancelar',${f.id},'Cancelar finiquito')">✖ Cancelar</button>`);
  const revisar = edita && fir && fir.estado === 'Pendiente de revisión' && st === 'Documento generado';
  $('modal').innerHTML = `<div class="mbox" style="width:min(720px,96vw);max-height:92vh;overflow:auto" role="dialog" aria-modal="true"><h3>🧾 Finiquito</h3>
    <div class="who">${esc(nom)} · ${esc(f.usuario_fieldwy)}<br>${finPill(st)} · revisión ${f.revision}${f.lote_id ? ' · lote ' + f.lote_id : ''}</div>
    <div class="tw"><table class="dt"><tbody>
      ${fila('Fecha de ingreso', fdate(f.fecha_ingreso) + ` <small class="muted">(${f.ingreso_fuente}${f.ingreso_nota ? ': ' + esc(f.ingreso_nota) : ''})</small>`)}${fila('Fecha de baja', fdate(f.fecha_baja))}${fila('Razón social', esc(f.empresa_clave || '—'))}${fila('Estado de emisión', esc(f.edo_emision || '—'))}
      ${fila('Salario base (mínimo vigente)', money(f.salario_base))}${fila('Años de antigüedad / días de vacaciones', f.anios_antiguedad + ' / ' + f.dias_vac_corresponden)}
      ${fila('Aguinaldo (' + f.dias_aguinaldo + ' días)', money(f.aguinaldo))}${fila('Vacaciones pendientes (' + f.dias_vac_pendientes + ' d)', money(f.vacaciones))}${fila('Prima vacacional s/ pendientes', money(f.prima_vacacional))}
      ${fila('Vacaciones proporcionales (' + Number(f.dias_vac_prop).toFixed(2) + ' d)', money(f.vac_prop))}${fila('Prima vacacional proporcional', money(f.prima_prop))}${fila('Gratificación (' + f.dias_gratificacion + ' d)', money(f.gratificacion))}
      ${fila('Descuentos', '− ' + money(f.descuentos))}${fila('<b>TOTAL</b>', '<b>' + money(f.total) + '</b>')}
      ${f.fecha_pago ? fila('Pagado', fdate(f.fecha_pago) + ' · ref. ' + esc(f.referencia_pago || '')) : ''}</tbody></table></div>
    ${docs ? `<div class="note">Documentos generados (v${docs.version}): ${ver(docs)}</div>` : st === 'Documento solicitado' ? '<div class="note">Documentos solicitados. Se generan en la siguiente corrida de la tarea (o con «Generar finiquitos ahora» en la PC).</div>' : ''}
    ${fir ? `<div class="note">PDF firmado v${fir.version}: ${finPill(fir.estado)} ${ver(fir)}${fir.motivo ? `<br><small>${esc(fir.motivo)}</small>` : ''}</div>` : ''}
    ${revisar ? `<div class="warn"><b>Revisión del firmado</b> (confirma cada punto para aprobar)<br>${[['nombre', 'Nombre correcto'], ['importes', 'Importes iguales al cálculo'], ['firma', 'Firma'], ['huellas', 'Huellas'], ['ine', 'INE legible (frente y vuelta)'], ['bancarios', 'Datos bancarios']].map(([k, n]) => `<label style="display:block"><input type="checkbox" class="fq-chk" data-k="${k}"> ${n}</label>`).join('')}
      <div class="tools"><button class="btn primary" onclick="finRevisar(${fir.id},true)">✔ Aprobar firmado</button><button class="btn" onclick="finRevisar(${fir.id},false)">✖ Pedir corrección</button></div></div>` : ''}
    <div class="mfoot">${b.join('')}<button class="btn" onclick="cerrarM();vFiniquitos()">Cerrar</button></div></div>`;
  $('modal').hidden = false; $('modal').onclick = e => { if (e.target.id === 'modal') { cerrarM(); vFiniquitos(); } };
}
async function finAccion(fn, id, msg) { try { await API.finRpc(fn, { p_id: id }); toast(msg); finAbrir(id); } catch (e) { toast(e.message || e); } }
async function finMotivo(fn, id, titulo) {
  const m = prompt(titulo + ': escribe el motivo (mínimo 5 caracteres)', ''); if (m === null) return; if (limpia(m).length < 5) { toast('Escribe el motivo (mínimo 5 caracteres)'); return; }
  try { await API.finRpc(fn, { p_id: id, p_motivo: limpia(m) }); toast('Hecho'); FQ.lista = await API.finLista(); if (fn === 'finiquito_cancelar') { cerrarM(); finPintar(); } else finAbrir(id); } catch (e) { toast(e.message || e); }
}
async function finSubir(id) {
  const f = $('fq-pdf').files[0]; if (!f) return; toast('Subiendo PDF…');
  try { await API.finSubirFirmado(id, f); toast('PDF subido · queda pendiente de revisión por el analista'); } catch (e) { toast('No se pudo subir: ' + (e.message || e)); }
  finAbrir(id);
}
async function finVer(archId) {
  const a = FQ.arch.find(x => x.id === archId); if (!a || !a.ruta_temp) return;
  try { window.open(await API.finUrl(a.ruta_temp), '_blank', 'noopener'); } catch (e) { toast('No se pudo abrir: ' + (e.message || e)); }
}
async function finRevisar(archId, aprobar) {
  const chk = {}; document.querySelectorAll('.fq-chk').forEach(c => chk[c.dataset.k] = c.checked);
  let motivo = null; if (!aprobar) { motivo = prompt('¿Qué debe corregirse? (mínimo 5 caracteres)', ''); if (motivo === null) return; motivo = limpia(motivo); if (motivo.length < 5) { toast('Escribe el motivo'); return; } }
  try { await API.finRpc('finiquito_revisar_firmado', { p_archivo: archId, p_aprobar: aprobar, p_motivo: motivo, p_checklist: chk }); toast(aprobar ? 'Firmado aprobado' : 'Devuelto para corrección'); finAbrir(FQ.fin.id); } catch (e) { toast(e.message || e); }
}
async function finCrearLote() {
  const ids = [...document.querySelectorAll('.fq-sel:checked')].map(c => +c.value); if (!ids.length) { toast('Marca al menos un finiquito'); return; }
  const nota = prompt('Nota del lote (opcional)', ''); if (nota === null) return;
  try { const lote = await API.finRpc('finiquito_crear_lote', { p_ids: ids, p_nota: limpia(nota) }); toast('Lote ' + lote + ' creado con ' + ids.length + ' finiquitos'); FQ.lista = await API.finLista(); finPintar(); } catch (e) { toast(e.message || e); }
}
function finPagar(id) {
  const hoy = new Date().toISOString().slice(0, 10);
  $('modal').innerHTML = `<div class="mbox" style="width:min(460px,96vw)" role="dialog" aria-modal="true"><h3>💵 Marcar pagado</h3><div class="note">Se marca una sola vez y no se puede deshacer.</div>
    <div class="fld"><label>Fecha de pago</label><input id="fq-fp" type="date" max="${hoy}" value="${hoy}"></div><div class="fld"><label>Referencia del pago</label><input id="fq-ref" placeholder="Folio, SPEI, recibo…"></div>
    <div class="mfoot"><button class="btn" onclick="finAbrir(${id})">Cancelar</button><button class="btn primary" onclick="finPagarOk(${id})">Confirmar pago</button></div></div>`;
}
async function finPagarOk(id) {
  try { await API.finRpc('finiquito_marcar_pagado', { p_id: id, p_fecha: $('fq-fp').value, p_referencia: limpia($('fq-ref').value) }); toast('Pago registrado'); FQ.lista = await API.finLista(); finAbrir(id); } catch (e) { toast(e.message || e); }
}
async function finLayoutPago() {
  const rows = FQ.lista.filter(r => r.estatus === 'Autorizado' && r.lote_id); if (!rows.length) { toast('No hay finiquitos enviados a pago'); return; }
  let ban = {}; if (can('datos_bancarios', 'ver')) { try { (await API.finBancarios(rows.map(r => r.usuario_fieldwy))).forEach(b => ban[b.usuario_fieldwy] = b); } catch (e) { toast('No se pudieron leer los datos bancarios: ' + (e.message || e)); return; } }
  const conB = can('datos_bancarios', 'ver');
  finBajar('layout_pago_finiquitos_' + new Date().toISOString().slice(0, 10) + '.csv', [['lote', 'usuario', 'nombre', 'fecha_baja', 'total', ...(conB ? ['banco', 'titular', 'clabe', 'cuenta', 'tarjeta'] : [])],
    ...rows.map(r => { const b = ban[r.usuario_fieldwy] || {}; return [r.lote_id, r.usuario_fieldwy, r.nombre, r.fecha_baja, r.total, ...(conB ? [b.banco, b.titular, b.clabe, b.cuenta, b.tarjeta] : [])]; })]);
}
async function finParametros() {
  let ps; try { ps = await API.finParametros(); } catch (e) { toast(e.message || e); return; }
  const noms = { salario_minimo: 'Salario mínimo diario ($)', dias_aguinaldo: 'Días de aguinaldo', prima_vacacional: 'Prima vacacional (0.25 = 25 %)', max_dias_desde_baja: 'Máx. días desde la baja' };
  $('modal').innerHTML = `<div class="mbox" style="width:min(640px,96vw);max-height:92vh;overflow:auto" role="dialog" aria-modal="true"><h3>⚙️ Parámetros de finiquitos</h3>
    <div class="note">Cada valor aplica desde su fecha. El salario mínimo se toma el vigente a la fecha de baja. Revisa que el de 2026 sea el correcto.</div>
    <div class="tw"><table class="dt"><thead><tr><th class="t">Parámetro</th><th>Desde</th><th>Valor</th><th class="t">Nota</th></tr></thead><tbody>${ps.map(p => `<tr><td class="t">${noms[p.clave] || esc(p.clave)}</td><td>${fdate(p.vigente_desde)}</td><td>${p.valor}</td><td class="t">${esc(p.nota || '')}</td></tr>`).join('')}</tbody></table></div>
    ${sect('Agregar o corregir un valor')}<div class="fld"><label>Parámetro</label><select id="fq-pc">${Object.entries(noms).map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></div>
    <div class="row2"><div class="fld"><label>Aplica desde</label><input id="fq-pd" type="date"></div><div class="fld"><label>Valor</label><input id="fq-pv" type="number" step="0.0001" min="0"></div></div>
    <div class="fld"><label>Nota / fuente</label><input id="fq-pn" placeholder="Ej. DOF 2026"></div>
    <div class="mfoot"><button class="btn" onclick="cerrarM()">Cerrar</button><button class="btn primary" onclick="finParametroOk()">Guardar</button></div></div>`;
  $('modal').hidden = false;
}
async function finParametroOk() {
  try { await API.finRpc('guardar_parametro_finiquito', { p_clave: $('fq-pc').value, p_desde: $('fq-pd').value, p_valor: +$('fq-pv').value, p_nota: limpia($('fq-pn').value) }); toast('Parámetro guardado'); finParametros(); } catch (e) { toast(e.message || e); }
}

/* >>> 07f_vacantes.js */
/* ====================================================================== VACANTES ======================================================================
   Vacante = la medición de cobertura de Avance GB: 2 o más días sin check = Vacante (1 día = Descubierta); en tiendas de más de una posición, Posc Faltante.
   Regla de RH: una tienda sigue CUBIERTA mientras tenga un promotor cuyo último check fue en esa tienda y todavía no es baja ni tiene una ausencia registrada
   (Activo, Descanso/falta/error o Posible baja). Cuando se confirma la baja o se registra la ausencia, ese promotor deja de cubrir y la tienda aparece como vacante.
   RH confirma la vacante (fecha compromiso + motivo) o la marca Cubierta aunque todavía no haya checks. Todo cálculo se hace con los filtros y el periodo de arriba.
   Prioridad (0-100): cuota TEMM 35 % · venta TEMM (promedio 4 semanas) 25 % · inventario 15 % · posiciones faltantes 10 % · cadena Coppel 10 % · días sin cubrir 5 %. */
const VC = { tab: 'gestion', est: '', pri: '', tipo: '', ges: new Map(), motivos: [], extra: new Map(), items: [], cargado: false };
const VC_PESO = { cuota: .35, venta: .25, inv: .15, pos: .10, cad: .10, dias: .05 };
const VC_INV = { 'Normal': 1, 'Alto': 1, 'Bajo': .7, 'Crítico': .4, 'Sin stock': .1 };
const VC_ASIG_OK = ['Activo', 'Descanso / falta / error', 'Posible baja'];

Real.vacGestion = async function () { const { data, error } = await sb.from('vacantes_gestion').select('*'); if (error) throw error; return data || []; };
Real.vacMotivos = async function () { const { data, error } = await sb.from('catalogo_motivos_vacante').select('motivo').eq('activo', true).order('orden'); if (error) throw error; return (data || []).map(x => x.motivo); };
Real.tiendaExtra = async function () { return todo(() => sb.from('rep_tienda_extra').select('*')); };
Real.vacHist = async function (idpdv) { const { data, error } = await sb.from('vacantes_historial').select('*').eq('idpdv', idpdv).order('en', { ascending: false }).limit(15); if (error) throw error; return data || []; };
Real.vacGuardar = async function (a) { return Real.finRpc('guardar_vacante', a); };
Real.vacQuitar = async function (id, motivo) { return Real.finRpc('quitar_vacante', { p_idpdv: id, p_motivo: motivo }); };
const DEMO_VAC = [];
Demo.vacGestion = async () => DEMO_VAC.slice(); Demo.vacMotivos = async () => ['Mal ambiente laboral', 'Falta de inventario', 'Tienda cerrada o en remodelación', 'Problema de acceso a la tienda', 'Sin candidatos', 'Decisión de la cadena', 'Otro'];
Demo.tiendaExtra = async () => Object.values(S.cat.tiendas).map((t, i) => ({ idpdv: t.idpdv, semana: '26-S41', cuota_temm: 2 + (i * 7) % 15, venta_temm: (i * 3) % 6, alcance_temm: .2 + (i % 8) / 10, prom4_temm: 1 + (i * 5) % 7, inv_estatus: ['Normal', 'Bajo', 'Crítico', 'Alto', 'Sin stock'][i % 5], inv_piezas: 20 + i, inv_semanas: 3 + i % 6 }));
Demo.vacHist = async () => [];
Demo.vacGuardar = async a => { const i = DEMO_VAC.findIndex(x => x.idpdv === a.p_idpdv); const f = { idpdv: a.p_idpdv, estado: a.p_estado, posiciones: a.p_posiciones, fecha_compromiso: a.p_fecha_compromiso, motivo: a.p_motivo, nota: a.p_nota, cubierta_desde: HOY, cubierta_por: a.p_cubierta_por }; if (i >= 0) DEMO_VAC[i] = f; else DEMO_VAC.push(f); };
Demo.vacQuitar = async id => { const i = DEMO_VAC.findIndex(x => x.idpdv === id); if (i >= 0) DEMO_VAC.splice(i, 1); };

async function vacCargar(force) {
  if (VC.cargado && !force) return;
  const [g, m, e] = await Promise.all([API.vacGestion(), API.vacMotivos(), API.tiendaExtra().catch(() => [])]);
  VC.ges = new Map(g.map(x => [x.idpdv, x])); VC.motivos = m; VC.extra = new Map(e.map(x => [x.idpdv, x])); VC.cargado = true;
}
function diasSinCheck(x, hasta) { let n = 0; for (let d = hasta; d >= R.meta.cd_desde && n < 120; d = addD(d, -1)) { if (cdv(x, d) > 0) return n; n++; } return n; }

function vacCalcular(r) {
  const dias = r.dias, xs = xsF().filter(x => (x.t.posiciones || 0) > 0), asig = new Map();
  R.hc.forEach(h => { if (h.rol !== 'Promotor' || h.ultimo_idpdv == null) return; if (VC_ASIG_OK.includes(estadoVivo(h).e)) asig.set(h.ultimo_idpdv, (asig.get(h.ultimo_idpdv) || 0) + 1); });
  const ex = id => VC.extra.get(id) || {}, q90 = k => { const v = [...VC.extra.values()].map(e => +e[k] || 0).sort((a, b) => a - b); return v.length ? Math.max(1, v[Math.floor(v.length * .9)]) : 1; };
  const Q = q90('cuota_temm'), V = q90('prom4_temm'), items = [];
  xs.forEach(x => {
    const g = VC.ges.get(x.id), s = estatusTienda(x, dias), ps = posc(x.t), a = asig.get(x.id) || 0, dsc = diasSinCheck(x, r.hasta), e = ex(x.id);
    let tipo = null, falt = 0;
    if (s.cob === 'Vacante' && a === 0) { tipo = 'Tienda vacante'; falt = ps; }
    else if (ps > 1 && s.asi === 'Posc Faltante' && a < ps) { tipo = 'Posiciones faltantes'; falt = ps - a; }
    else if (s.cob === 'Vacante' || (ps > 1 && s.asi === 'Posc Faltante')) tipo = 'En seguimiento';           // sin checks pero con promotor asignado que todavía no es baja
    if (!tipo && !g) return;
    const real = tipo === 'Tienda vacante' || tipo === 'Posiciones faltantes';
    let estado = g ? (g.estado === 'Cubierta' ? 'Cubierta (RH)' : real ? 'Confirmada' : tipo === 'En seguimiento' ? 'En seguimiento' : 'Resuelta') : (real ? 'Por confirmar' : 'En seguimiento');
    if (!tipo) tipo = 'Ya cubierta por checks';
    const vac = real && estado !== 'Cubierta (RH)', faltC = g && g.posiciones != null && estado === 'Confirmada' ? g.posiciones : falt;
    const sc = (VC_PESO.cuota * Math.min(1, (+e.cuota_temm || 0) / Q) + VC_PESO.venta * Math.min(1, (+e.prom4_temm || 0) / V) + VC_PESO.inv * (VC_INV[e.inv_estatus] != null ? VC_INV[e.inv_estatus] : .5)
      + VC_PESO.pos * Math.min(1, falt / Math.max(1, ps)) + VC_PESO.cad * (x.t.cadena === 'Coppel' ? 1 : .6) + VC_PESO.dias * Math.min(1, dsc / 10)) * 100;
    items.push({ x, id: x.id, t: x.t, tipo, estado, vac, ps, asig: a, falt: faltC, dsc, ult: dsc < 120 ? addD(r.hasta, -dsc) : null, g, e, score: sc, pri: sc >= 65 ? 'Alta' : sc >= 45 ? 'Media' : 'Baja', cob: s.cob, asi: s.asi });
  });
  return items;
}
const VPC = { 'Alta': 'r', 'Media': 'a', 'Baja': 'g' }, VPE = { 'Alta': '🔴', 'Media': '🟠', 'Baja': '🟢' };
const VEC = { 'Por confirmar': 'a', 'Confirmada': 'r', 'Cubierta (RH)': 'g', 'En seguimiento': 'b', 'Resuelta': 'g' };
const vencida = i => i.estado === 'Confirmada' && i.g && i.g.fecha_compromiso && i.g.fecha_compromiso < HOY;
const proxima = i => i.estado === 'Confirmada' && i.g && i.g.fecha_compromiso && i.g.fecha_compromiso >= HOY && diffD(i.g.fecha_compromiso, HOY) <= 3;

async function vVacantes() {
  await conReporte('Vacantes', 'mochila', async () => {
    await vacCargar(); if (!R.vivo) { try { S.vigentes = await API.vigentes(); } catch (e) { } R.vivo = true; }
    const r = perRango(), items = vacCalcular(r); VC.items = items;
    const vac = items.filter(i => i.vac), puede = can('vacantes', 'editar');
    const cnt = k => items.filter(i => i.estado === k).length;
    let h = cab('Vacantes', 'Tiendas y posiciones sin cobertura real. Una tienda sigue cubierta mientras su promotor no sea baja ni tenga ausencia registrada. Confirma la vacante con fecha compromiso y motivo, o márcala cubierta.', 'mochila');
    h += `<div class="tools" data-nocap>${[['gestion', '📋 Gestión de vacantes'], ['resumen', '📊 Resumen gráfico']].map(([k, n]) => `<button class="chip ${VC.tab === k ? 'on' : ''}" onclick="VC.tab='${k}';vVacantes()">${n}</button>`).join('')}</div>`;
    h += `<div class="kpis">${kp('Tiendas con vacante', fmt(vac.length), `${fmt(vac.filter(i => i.tipo === 'Tienda vacante').length)} completas · ${fmt(vac.filter(i => i.tipo === 'Posiciones faltantes').length)} con posiciones faltantes`, vac.length ? C.rd : C.gr, null, '🏬')}${kp('Posiciones faltantes', fmt(vac.reduce((a, i) => a + i.falt, 0)), 'suma de posiciones sin cubrir', C.am, null, '🧍')}${kp('Por confirmar', fmt(cnt('Por confirmar')), 'falta fecha compromiso y motivo', C.am, "VC.est='Por confirmar';VC.tab='gestion';vVacantes()", '❓')}${kp('Compromisos vencidos', fmt(items.filter(vencida).length), `${fmt(items.filter(proxima).length)} vencen en 3 días o menos`, items.filter(vencida).length ? C.rd : C.gr, "VC.est='vencidas';VC.tab='gestion';vVacantes()", '⏰')}${kp('En seguimiento', fmt(cnt('En seguimiento')), 'sin checks, pero su promotor aún no es baja', C.bl, "ir('bandeja')", '🔎')}</div>`;
    h += VC.tab === 'resumen' ? vacResumenHTML(items, r) : vacGestionHTML(items, r, puede);
    $('content').innerHTML = h; drawAll();
  });
}

function vacGestionHTML(items, r, puede) {
  const cuenta = f => items.filter(f).length;
  const tabs = [['', 'Todas', items.length], ['Por confirmar', 'Por confirmar', cuenta(i => i.estado === 'Por confirmar')], ['Confirmada', 'Confirmadas', cuenta(i => i.estado === 'Confirmada')], ['vencidas', 'Compromisos vencidos', cuenta(vencida)],
    ['Cubierta (RH)', 'Cubiertas por RH', cuenta(i => i.estado === 'Cubierta (RH)')], ['En seguimiento', 'En seguimiento', cuenta(i => i.estado === 'En seguimiento')], ['Resuelta', 'Resueltas', cuenta(i => i.estado === 'Resuelta')]];
  let h = alertasVac(items);
  h += `<div class="tools" data-nocap>${tabs.map(([k, n, c]) => `<button class="chip ${VC.est === k ? 'on' : ''}" onclick="VC.est='${k}';vVacantes()">${n} (${c})</button>`).join('')}</div>`;
  h += `<div class="tools" data-nocap><span>Prioridad:</span><select onchange="VC.pri=this.value;vVacantes()"><option value="">Todas</option>${['Alta', 'Media', 'Baja'].map(p => `<option ${VC.pri === p ? 'selected' : ''}>${p}</option>`).join('')}</select><span>Tipo:</span><select onchange="VC.tipo=this.value;vVacantes()"><option value="">Todos</option>${['Tienda vacante', 'Posiciones faltantes'].map(p => `<option ${VC.tipo === p ? 'selected' : ''}>${p}</option>`).join('')}</select>
    <button class="btn sm" onclick="vacCsvReal()">⬇ CSV de vacantes reales</button><span class="muted">Corte al ${fdate(r.hasta)} · la prioridad se explica al pasar el mouse sobre su etiqueta</span></div>`;
  const rows = items.filter(i => (!VC.est || (VC.est === 'vencidas' ? vencida(i) : i.estado === VC.est)) && (!VC.pri || i.pri === VC.pri) && (!VC.tipo || i.tipo === VC.tipo)).sort((a, b) => b.score - a.score);
  TB = {};
  h += tbl('t-vac', [{ h: 'Prioridad', t: 1, v: q => q.score, w: 96, r: q => `<span title="Puntaje ${q.score.toFixed(0)} de 100">${pillx(VPE[q.pri] + ' ' + q.pri, VPC[q.pri])}</span>` }, { h: 'IDPDV', v: q => q.id, w: 86 }, { h: 'Tienda', t: 1, v: q => q.t.nombre, w: 230, r: q => `<b>${esc(q.t.nombre)}</b>` },
    { h: 'Cadena', t: 1, v: q => q.t.cadena }, { h: 'Class', t: 1, v: q => q.t.clase }, { h: 'Posc.', v: q => q.ps }, { h: 'Tipo', t: 1, v: q => q.tipo, r: q => pillx(q.tipo, q.vac ? 'r' : q.tipo === 'En seguimiento' ? 'b' : 'x') },
    { h: 'Posiciones faltantes', v: q => q.falt, r: q => q.vac ? `<b>${q.falt}</b>` : '—' }, { h: 'Promotores asignados', v: q => q.asig }, { h: 'Días sin check', v: q => q.dsc, r: q => q.dsc >= 5 ? `<span class="cell-red">${q.dsc}</span>` : q.dsc >= 2 ? `<span class="cell-amber">${q.dsc}</span>` : String(q.dsc) },
    { h: 'Último check', v: q => q.ult, r: q => q.ult ? fdate(q.ult) : '120+ días' }, { h: 'Cuota TEMM sem.', v: q => +q.e.cuota_temm || 0, r: q => q.e.cuota_temm != null ? fmt1(+q.e.cuota_temm) : '—' }, { h: 'Venta TEMM (prom. 4 sem.)', v: q => +q.e.prom4_temm || 0, r: q => q.e.prom4_temm != null ? fmt1(+q.e.prom4_temm) : '—' },
    { h: 'Inventario', t: 1, v: q => q.e.inv_estatus || '', r: q => q.e.inv_estatus ? pillx(esc(q.e.inv_estatus), q.e.inv_estatus === 'Normal' || q.e.inv_estatus === 'Alto' ? 'g' : q.e.inv_estatus === 'Bajo' ? 'a' : 'r') : '—' },
    { h: 'Estatus', t: 1, v: q => q.estado, r: q => pillx(q.estado, VEC[q.estado] || 'x') }, { h: 'Fecha compromiso', v: q => q.g && q.g.fecha_compromiso, r: q => q.g && q.g.fecha_compromiso ? (vencida(q) ? `<span class="cell-red">${fdate(q.g.fecha_compromiso)} ⏰</span>` : fdate(q.g.fecha_compromiso)) : '—' },
    { h: 'Motivo / nota', t: 1, w: 220, v: q => q.g ? (q.g.motivo || '') + ' ' + (q.g.nota || '') : '', r: q => q.g ? `${esc(q.g.motivo || (q.g.estado === 'Cubierta' ? 'Cubierta' + (q.g.cubierta_por ? ' por ' + q.g.cubierta_por : '') : ''))}${q.g.nota ? `<br><small class="muted">${esc(q.g.nota)}</small>` : ''}` : '—' },
    { h: 'Supervisor', t: 1, v: q => q.t.supervisor }, { h: 'Gerente', t: 1, v: q => q.t.gerente }, { h: 'RR.HH.', t: 1, v: q => q.t.rrhh },
    { h: '', t: 1, v: q => 0, r: q => puede ? `<button class="btn sm ${q.estado === 'Por confirmar' ? 'primary' : ''}" data-nocap onclick="vacGestionar(${q.id})">Gestionar</button>` : '' }],
    rows, { fix: 3, search: 1, csv: 1, png: 1, file: 'vacantes', titulo: 'Vacantes · corte al ' + fdate(r.hasta), sort: 0, dir: -1, maxh: '70vh', lim: 600 });
  return h;
}
function alertasVac(items) {
  const venc = items.filter(vencida), prox = items.filter(proxima), altas = items.filter(i => i.estado === 'Por confirmar' && i.pri === 'Alta');
  if (!venc.length && !prox.length && !altas.length) return '';
  const tarj = (k, ic, t, sub, xs, extra) => xs.length ? `<details class="alc ${k}" ${k === 'r' ? 'open' : ''}><summary><span class="alc-n">${xs.length}</span><div><b>${ic} ${t}</b><small>${sub}</small></div><i>▾</i></summary><div class="tw tw-in"><table class="dt st"><thead><tr><th class="t">Tienda</th><th class="t">Estado</th><th>Compromiso</th><th>Días sin check</th><th class="t">Supervisor</th><th class="t">RR.HH.</th></tr></thead><tbody>${xs.slice(0, 40).map(i => `<tr><td class="t"><b>${esc(i.t.nombre)}</b> <small class="muted">${i.id}</small></td><td class="t">${esc(i.t.estado || '')}</td><td>${i.g && i.g.fecha_compromiso ? fdate(i.g.fecha_compromiso) : '—'}</td><td>${i.dsc}</td><td class="t">${esc(i.t.supervisor || '')}</td><td class="t">${esc(i.t.rrhh || '')}</td></tr>`).join('')}</tbody></table></div></details>` : '';
  return `<div class="alertas2" id="vac-alertas">${tarj('r', '⏰', 'Compromisos de cobertura vencidos', 'La fecha compromiso ya pasó y la vacante sigue sin cubrirse', venc)}${tarj('a', '🟡', 'Compromisos que vencen en 3 días o menos', 'Dar seguimiento para cumplir la fecha', prox)}${tarj('a', '🔴', 'Prioridad alta sin confirmar', 'Vacantes importantes todavía sin fecha compromiso ni motivo', altas)}</div>
    <div class="tools" data-nocap><button class="btn sm" onclick="capturaDescargar($('vac-alertas'),'Alertas de vacantes · ${fdate(HOY)}',subFiltros(),'alertas_vacantes')">📸 Imagen de las alertas</button></div>`;
}

function vacCsvReal() {
  const xs = VC.items.filter(i => i.vac); if (!xs.length) { toast('No hay vacantes reales con estos filtros'); return; }
  finBajar('vacantes_reales_' + HOY + '.csv', [['idpdv', 'tienda', 'cadena', 'class', 'estado', 'region', 'gerente', 'supervisor', 'rrhh', 'tipo', 'posiciones_tienda', 'posiciones_faltantes', 'dias_sin_check', 'ultimo_check', 'cuota_temm_semana', 'venta_temm_prom4', 'inventario', 'prioridad', 'estatus', 'fecha_compromiso', 'motivo', 'nota'],
    ...xs.sort((a, b) => b.score - a.score).map(i => [i.id, i.t.nombre, i.t.cadena, i.t.clase, i.t.estado, i.t.region, i.t.gerente, i.t.supervisor, i.t.rrhh, i.tipo, i.ps, i.falt, i.dsc, i.ult, i.e.cuota_temm, i.e.prom4_temm, i.e.inv_estatus, i.pri, i.estado, i.g && i.g.fecha_compromiso, i.g && i.g.motivo, i.g && i.g.nota])]);
}

/* ---- gestionar una vacante ---- */
async function vacGestionar(id) {
  const i = VC.items.find(x => x.id === id); if (!i) return; let hist = []; try { hist = await API.vacHist(id); } catch (e) { }
  const g = i.g || {}, esC = g.estado === 'Cubierta';
  $('modal').innerHTML = `<div class="mbox" style="width:min(600px,96vw);max-height:92vh;overflow:auto" role="dialog" aria-modal="true"><h3>📌 Gestionar vacante</h3><div class="who">${esc(i.t.nombre)} · IDPDV ${id}<br><small>${esc(i.t.cadena || '')} · ${esc(i.t.estado || '')} · ${esc(i.tipo)} · ${i.dsc} días sin check · ${i.asig} de ${i.ps} posición${i.ps === 1 ? "" : "es"} con promotor asignado</small></div>
    <div class="fld"><label>¿Qué pasa con esta tienda?</label><select id="vc-est" onchange="vacToggle()"><option value="Confirmada" ${!esC ? 'selected' : ''}>Confirmo la vacante (con fecha compromiso)</option><option value="Cubierta" ${esC ? 'selected' : ''}>Ya está cubierta (aunque todavía no tenga checks)</option></select></div>
    <div id="vc-conf"><div class="row2"><div class="fld"><label>Posiciones vacantes</label><input id="vc-pos" type="number" min="0" max="20" value="${g.posiciones != null ? g.posiciones : i.falt || i.ps}"></div><div class="fld"><label>Fecha compromiso de cobertura</label><input id="vc-fec" type="date" value="${g.fecha_compromiso || ''}"></div></div>
      <div class="fld"><label>Motivo de la vacante</label><select id="vc-mot"><option value="">— elige —</option>${VC.motivos.map(m => `<option ${g.motivo === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></div></div>
    <div id="vc-cub" hidden><div class="fld"><label>Promotor que la cubre (usuario Fieldway, opcional)</label><input id="vc-por" value="${esc(g.cubierta_por || '')}" placeholder="Ej. ABCD123456"></div></div>
    <div class="fld"><label>Nota <small class="muted">(obligatoria si el motivo es «Otro»)</small></label><input id="vc-nota" value="${esc(g.nota || '')}" placeholder="Qué se está haciendo, con quién, bloqueos…"></div>
    ${hist.length ? `<details class="enc-d"><summary>Historial (${hist.length})</summary>${hist.map(h => `<div class="muted" style="font-size:12px;padding:3px 0">${fdate(String(h.en).slice(0, 10))} · <b>${esc(h.estado)}</b>${h.fecha_compromiso ? ' · compromiso ' + fdate(h.fecha_compromiso) : ''}${h.motivo ? ' · ' + esc(h.motivo) : ''}${h.nota ? ' · ' + esc(h.nota) : ''}</div>`).join('')}</details>` : ''}
    <div class="mfoot">${i.g ? `<button class="btn danger" onclick="vacQuitar(${id})">Quitar gestión</button>` : ''}<button class="btn" onclick="cerrarM()">Cancelar</button><button class="btn primary" onclick="vacGuardar(${id})">Guardar</button></div></div>`;
  $('modal').hidden = false; vacToggle();
}
function vacToggle() { const c = $('vc-est').value === 'Cubierta'; $('vc-conf').hidden = c; $('vc-cub').hidden = !c; }
async function vacGuardar(id) {
  const est = $('vc-est').value;
  try {
    await API.vacGuardar({ p_idpdv: id, p_estado: est, p_posiciones: est === 'Confirmada' && $('vc-pos').value !== '' ? +$('vc-pos').value : null, p_fecha_compromiso: est === 'Confirmada' ? ($('vc-fec').value || null) : null, p_motivo: est === 'Confirmada' ? ($('vc-mot').value || null) : null, p_nota: limpia($('vc-nota').value) || null, p_cubierta_por: est === 'Cubierta' ? limpia($('vc-por').value) : null });
    toast(est === 'Cubierta' ? 'Marcada como cubierta' : 'Vacante confirmada'); cerrarM(); await vacCargar(true); vacInsignia(); vVacantes();
  } catch (e) { toast(e.message || e); }
}
async function vacQuitar(id) {
  const m = prompt('¿Por qué se quita la gestión? (mínimo 5 caracteres). La tienda vuelve a evaluarse solo por la cobertura medida.', ''); if (m === null) return; if (limpia(m).length < 5) { toast('Escribe el motivo'); return; }
  try { await API.vacQuitar(id, limpia(m)); toast('Gestión quitada'); cerrarM(); await vacCargar(true); vVacantes(); } catch (e) { toast(e.message || e); }
}

/* ---- resumen gráfico ---- */
function vacResumenHTML(items, r) {
  const vac = items.filter(i => i.vac), W = ventana(), L = limites(), ult = W.slice(-12), xs = xsF().filter(x => (x.t.posiciones || 0) > 0);
  const sem = ult.map(w => { const fin = addD(w.ini, 6) > L.max ? L.max : addD(w.ini, 6), ds = []; for (let d = w.ini; d <= fin; d = addD(d, 1)) if (d >= R.meta.cd_desde) ds.push(d); let tv = 0, pf = 0; if (ds.length) xs.forEach(x => { const s = estatusTienda(x, ds); if (s.cob === 'Vacante') tv++; else if (s.asi === 'Posc Faltante') pf++; }); return { w: w.w.slice(3), tv, pf }; });
  const crec = sem.length > 1 ? sem[sem.length - 1].tv + sem[sem.length - 1].pf - (sem[sem.length - 2].tv + sem[sem.length - 2].pf) : 0;
  let h = sect('Tendencia semanal', '📈') + `<div class="grid g2"><div class="card"><h3>Tiendas vacantes y con posiciones faltantes · últimas ${sem.length} semanas</h3><p class="note">Según la cobertura medida al cierre de cada semana (2 o más días sin check = vacante). ${crec ? `La última semana ${crec > 0 ? 'subió' : 'bajó'} <b>${Math.abs(crec)}</b> contra la anterior.` : ''} El detalle de arriba (con promotor asignado) solo aplica al día de hoy.</p>${legend([['Tiendas vacantes', C.rd], ['Con posiciones faltantes', C.am]])}${chart(sem.map(s => s.w), [{ n: 'Tiendas vacantes', c: C.rd, v: sem.map(s => s.tv) }, { n: 'Con posiciones faltantes', c: C.am, v: sem.map(s => s.pf) }], { bars: 1, vals: 1, h: 300, ticks: 16 })}</div>`;
  const top = vac.slice().sort((a, b) => b.dsc - a.dsc).slice(0, 12);
  h += `<div class="card"><h3>⏳ Tiendas con más días sin cubrirse</h3>${hbars(top.map(i => ({ n: i.t.nombre + ' · ' + i.id, v: i.dsc, c: i.dsc >= 10 ? C.rd : C.am, s: (i.g && i.g.motivo) || i.estado })), C.am)}</div></div>`;
  const mot = {}; items.filter(i => i.g && i.g.motivo && i.estado === 'Confirmada').forEach(i => mot[i.g.motivo] = (mot[i.g.motivo] || 0) + 1);
  const est = {}; items.forEach(i => est[i.estado] = (est[i.estado] || 0) + 1);
  h += `<div class="grid g2"><div class="card"><h3>🧩 Motivos de las vacantes confirmadas</h3>${Object.keys(mot).length ? hbars(Object.entries(mot).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ n: k, v, c: k === 'Mal ambiente laboral' || k === 'Sin candidatos' ? C.rd : C.am, s: pc1(v, Object.values(mot).reduce((a, b) => a + b, 0)) })), C.am) : '<p class="note">Todavía no hay vacantes confirmadas con motivo.</p>'}</div>
    <div class="card"><h3>🚦 Estatus de gestión</h3>${donut(Object.entries(est).map(([k, v]) => ({ n: k, v, c: k === 'Confirmada' ? C.rd : k === 'Por confirmar' ? C.am : k === 'Cubierta (RH)' || k === 'Resuelta' ? C.gr : C.bl })), { sub: 'tiendas' })}</div></div>`;
  const por = (campo, vacio) => { const m = new Map(); vac.forEach(i => { const k = i.t[campo] || vacio; m.set(k, (m.get(k) || 0) + Math.max(1, i.falt)); }); return [...m].sort((a, b) => b[1] - a[1]).slice(0, 10); };
  h += `<div class="grid g2"><div class="card"><h3>🧑‍💼 Posiciones faltantes por gerente</h3>${hbars(por('gerente', 'Sin gerente').map(([k, v]) => ({ n: k, v, c: C.rd })), C.rd)}</div><div class="card"><h3>🔗 Posiciones faltantes por cadena</h3>${hbars(por('cadena', 'Sin cadena').map(([k, v]) => ({ n: k, v, c: C.am })), C.am)}</div></div>`;
  return h;
}

/* insignia del menú: compromisos vencidos o que vencen en 3 días (consulta ligera, sin cargar los reportes) */
async function vacInsignia() {
  if (!can('vacantes', 'ver')) return;
  try { const g = await API.vacGestion(); S.vacBadge = g.filter(x => x.estado === 'Confirmada' && x.fecha_compromiso && diffD(x.fecha_compromiso, HOY) <= 3).length; nav(); } catch (e) { }
}

/* >>> 07g_perfil_baja.js */
/* ====================================================================== PERFIL DEL PROMOTOR AL CAUSAR BAJA ======================================================================
   Al registrar una baja se muestra un resumen del promotor (categoría de Avance GB de las últimas semanas, checks, errores, ventas, tiendas donde checó) y RH marca si es
   recontratable (Sí / Con reservas / No) con una nota. Queda guardado como foto del momento (baja_perfil) para consultarlo después, por ejemplo si pide reingresar.
   Los datos salen de los reportes publicados (últimas ~13 semanas de checks). La categoría y el desempeño ayudan a justificar bajas por productividad. */
const PF = { cache: new Map(), lista: new Map() };
Real.checksDe = async function (u) { return todo(() => sb.from('rep_checks').select('fecha,idpdv,estatus_check,estatus_final,registros').eq('usuario', u)); };
Real.perfilesBaja = async function () { return todo(() => sb.from('baja_perfil').select('*')); };
Real.guardarPerfilBaja = async function (a) { return Real.finRpc('guardar_perfil_baja', a); };
Demo.checksDe = async () => []; Demo.perfilesBaja = async () => []; Demo.guardarPerfilBaja = async () => { };
const PF_REC = { 'Sí': ['g', '🟢'], 'Con reservas': ['a', '🟠'], 'No': ['r', '🔴'] };

async function perfilCalc(u) {
  if (PF.cache.has(u)) return PF.cache.get(u);
  await cargarCatPromotores();
  const cats = (CATP.por.get(u) || []).slice(0, 6).map(x => ({ semana: x.semana, categoria: x.categoria, alcance_t: x.alcance_t, alcance_m: x.alcance_m, portas: x.portas }));
  let chk = []; try { chk = (await API.checksDe(u)).filter(x => x.estatus_final !== 'Otro Check'); } catch (e) { }
  const dias = new Map(); chk.forEach(c => dias.set(c.fecha, (dias.get(c.fecha) || 0) + (c.registros || 0)));
  const err = chk.filter(esErr), tipos = {}; err.forEach(x => tipos[x.estatus_check] = (tipos[x.estatus_check] || 0) + 1);
  const ok = chk.filter(x => OKF.includes(x.estatus_final)).length, tiendas = new Set(chk.map(x => x.idpdv)).size, ventas = chk.reduce((a, x) => a + (x.registros || 0), 0), sinVenta = [...dias.values()].filter(v => v === 0).length;
  const real = cats.filter(c => c.categoria !== 'Adaptación').slice(0, 4), bueno = real.filter(c => c.categoria === 'Dorado' || c.categoria === 'Verde').length, malo = real.filter(c => c.categoria === 'Rojo').length;
  const veredicto = !real.length ? (cats.length ? 'En adaptación (sin evidencia suficiente)' : 'Sin datos de productividad') : bueno * 2 >= real.length ? 'Productivo' : malo * 2 >= real.length ? 'Bajo desempeño' : 'Desempeño regular';
  const temas = []; if (dias.size && err.length / dias.size >= .2) temas.push('Errores de check frecuentes (' + err.length + ' en ' + dias.size + ' días)'); if (tiendas >= 3) temas.push('Checó en ' + tiendas + ' tiendas distintas'); if (dias.size && sinVenta / dias.size > .5) temas.push('Más de la mitad de sus días con check sin venta');
  const o = { categorias: cats, dias_check: dias.size, checks: chk.length, pct_cumple: chk.length ? Math.round(ok / chk.length * 1000) / 10 : null, errores: err.length, tipos_error: tipos, tiendas, ventas, dias_sin_venta: sinVenta, veredicto, temas };
  PF.cache.set(u, o); return o;
}
function perfilHTML(p) {
  const cats = p.categorias.slice(0, 4).map(c => `<span title="${esc(c.semana)}">${catPill(c.categoria)}</span>`).join(' ') || '<span class="muted">sin categoría publicada</span>';
  return `<div class="pf-box"><div><b>${esc(p.veredicto)}</b></div><div class="pf-row"><span>Categoría (últimas semanas, de la más reciente):</span> ${cats}</div>
    <div class="pf-row"><span>${fmt(p.dias_check)} días con check · ${fmt(p.checks)} checks · ${p.pct_cumple == null ? '—' : p.pct_cumple + ' %'} cumplen · ${fmt(p.errores)} con error · ${fmt(p.ventas)} ventas · ${fmt(p.dias_sin_venta)} días sin venta · ${fmt(p.tiendas)} tienda${p.tiendas === 1 ? '' : 's'}</span></div>
    ${Object.keys(p.tipos_error || {}).length ? `<div class="pf-row">${Object.entries(p.tipos_error).sort((a, b) => b[1] - a[1]).map(([k, v]) => pillx((ERRI[k] || '') + ' ' + v + ' ' + esc((ERRN[k] || k).toLowerCase()), NOJUST.includes(k) ? 'r' : 'a')).join(' ')}</div>` : ''}
    ${p.temas && p.temas.length ? `<div class="pf-row">${p.temas.map(t => `<span class="pill a">⚠️ ${esc(t)}</span>`).join(' ')}</div>` : ''}</div>`;
}
const perfilCampos = (rec, nota) => `<div class="row2"><div class="fld"><label>¿Es recontratable?</label><select id="pf-rec"><option value="">— sin evaluar todavía —</option>${['Sí', 'Con reservas', 'No'].map(v => `<option ${rec === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div><div class="fld"><label>Por qué (obligatorio si no es «Sí»)</label><input id="pf-nota" value="${esc(nota || '')}" placeholder="Desempeño, conducta, adeudos…"></div></div>`;

/* dentro de "Registrar baja" */
async function bajaPerfilPanel(c) {
  const box = $('bj-perfil'); if (!box) return; box.innerHTML = '<div class="loading">Armando el perfil del promotor…</div>';
  try { const p = await perfilCalc(c.usuario_fieldwy); if (BJ.sel !== c) return; box.innerHTML = sect('Perfil del promotor', '🧑‍💼') + perfilHTML(p) + perfilCampos('', ''); } catch (e) { box.innerHTML = ''; }
}
async function perfilGuardarDeModal(c, fecha) {   // se llama después de registrar la baja; si no eligió recontratable, queda pendiente en la lista de bajas
  const rec = $('pf-rec') && $('pf-rec').value; if (!rec) return;
  try { await API.guardarPerfilBaja({ p_usuario: c.usuario_fieldwy, p_fecha: fecha, p_resumen: await perfilCalc(c.usuario_fieldwy), p_recontratable: rec, p_nota: limpia($('pf-nota').value) || null }); }
  catch (e) { toast('La baja se guardó, pero el perfil no: ' + (e.message || e) + ' (complétalo desde Bajas y encuesta → Perfil)'); }
}

/* desde la lista de bajas */
async function perfilAbrir(id) {
  const b = BJ.lista.find(x => x.id === id); if (!b) return; const prev = PF.lista.get(b.usuario + '|' + b.fecha); let p = prev ? prev.resumen : null;
  $('modal').innerHTML = `<div class="mbox" style="width:min(680px,96vw)" role="dialog" aria-modal="true"><h3>🧑‍💼 Perfil del promotor</h3><div class="who">${esc(b.nombre)} · ${esc(b.usuario)} · baja ${fdate(b.fecha)} · ${esc(b.motivo)}</div><div id="pf-cuerpo"><div class="loading">Armando el perfil…</div></div></div>`; $('modal').hidden = false;
  try { if (!p || !p.veredicto) p = await perfilCalc(b.usuario); } catch (e) { }
  $('pf-cuerpo').innerHTML = (p ? perfilHTML(p) : '<div class="warn">No se pudo armar el resumen.</div>') + (prev ? `<p class="note">Evaluación guardada el ${fdate(String(prev.en).slice(0, 10))}. El resumen es la foto de ese momento.</p>` : '') +
    (can('bajas', 'editar') || can('bajas', 'crear') ? perfilCampos(prev && prev.recontratable, prev && prev.nota) : '') + `<div class="mfoot"><button class="btn" onclick="cerrarM()">Cerrar</button>${can('bajas', 'editar') || can('bajas', 'crear') ? `<button class="btn primary" onclick="perfilGuardar(${id})">Guardar</button>` : ''}</div>`;
}
async function perfilGuardar(id) {
  const b = BJ.lista.find(x => x.id === id); const rec = $('pf-rec').value; if (!rec) { toast('Elige si es recontratable'); return; }
  try { const res = (PF.lista.get(b.usuario + '|' + b.fecha) || {}).resumen; await API.guardarPerfilBaja({ p_usuario: b.usuario, p_fecha: b.fecha, p_resumen: (res && res.veredicto) ? res : await perfilCalc(b.usuario), p_recontratable: rec, p_nota: limpia($('pf-nota').value) || null }); toast('Perfil guardado'); cerrarM(); vBajas(); }
  catch (e) { toast(e.message || e); }
}

/* >>> 07h_identidad.js */
/* ====================================================================== IDENTIDAD DEL CANDIDATO: RFC / CURP (primeras posiciones) Y VENTANA DE CONFIRMACIÓN ======================================================================
   Del nombre y la fecha de nacimiento se pueden calcular las primeras posiciones: RFC = 10 caracteres (4 letras + AAMMDD) y CURP = 16 (4 letras + AAMMDD + sexo + estado + 3 consonantes).
   La homoclave del RFC (3) y los 2 últimos caracteres de la CURP los asignan el SAT y RENAPO: se completan a mano. El NSS siempre es manual. */
const PART_NOM = /^(DE|DEL|LA|LAS|LOS|LE|LES|Y|MC|MAC|VON|VAN|SAN|SANTA)$/;
const PALABRAS_MALAS = new Set('BUEI BUEY CACA CACO CAGA CAGO CAKA CAKO COGE COGI COJA COJE COJI COJO CULO FETO GUEY JOTO KACA KACO KAGA KAGO KAKA KAKO KOGE KOGI KOJA KOJE KOJI KOJO KULO LILO LOCA LOCO LOKA LOKO MAME MAMO MEAR MEAS MEON MIAR MION MOCO MOKO MULA MULO NACA NACO PEDA PEDO PENE PIPI PITO POPO PUTA PUTO QULO RATA ROBA ROBE ROBO RUIN SENO TETA VACA VAGA VAGO VAKA VUEI VUEY WUEI WUEY'.split(' '));
const ESTADOS_NAC = [['AS', 'Aguascalientes'], ['BC', 'Baja California'], ['BS', 'Baja California Sur'], ['CC', 'Campeche'], ['CL', 'Coahuila'], ['CM', 'Colima'], ['CS', 'Chiapas'], ['CH', 'Chihuahua'], ['DF', 'Ciudad de México'], ['DG', 'Durango'], ['GT', 'Guanajuato'], ['GR', 'Guerrero'], ['HG', 'Hidalgo'], ['JC', 'Jalisco'], ['MC', 'Estado de México'], ['MN', 'Michoacán'], ['MS', 'Morelos'], ['NT', 'Nayarit'], ['NL', 'Nuevo León'], ['OC', 'Oaxaca'], ['PL', 'Puebla'], ['QT', 'Querétaro'], ['QR', 'Quintana Roo'], ['SP', 'San Luis Potosí'], ['SL', 'Sinaloa'], ['SR', 'Sonora'], ['TC', 'Tabasco'], ['TS', 'Tamaulipas'], ['TL', 'Tlaxcala'], ['VZ', 'Veracruz'], ['YN', 'Yucatán'], ['ZS', 'Zacatecas'], ['NE', 'Nacido en el extranjero']];
const ESTADOS_CIVIL = ['Soltero(a)', 'Casado(a)', 'Unión libre', 'Divorciado(a)', 'Viudo(a)'];
function idLimpia(s) {
  const t = String(s || '').toUpperCase().replace(/Ñ/g, '\u0001').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\u0001/g, 'X').replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
  const w = t.split(' ').filter(Boolean); while (w.length > 1 && PART_NOM.test(w[0])) w.shift(); return w.join(' ');
}
function idNombre(s) { const w = idLimpia(s).split(' '); return w.length > 1 && /^(JOSE|MARIA|MA|J)$/.test(w[0]) ? w.slice(1).join(' ') : w.join(' '); }
const VOCALES = 'AEIOU';
function idLetras(nombre, ap, am, curp) {
  const a = idLimpia(ap), m = idLimpia(am), n = idNombre(nombre); if (!a || !n) return '';
  let v = ''; for (const ch of a.slice(1)) if (VOCALES.includes(ch)) { v = ch; break; }
  let w = a[0] + (v || 'X') + (m ? m[0] : 'X') + n[0];
  if (PALABRAS_MALAS.has(w)) w = curp ? w[0] + 'X' + w.slice(2) : w.slice(0, 3) + 'X';
  return w;
}
const idAAMMDD = f => f && /^\d{4}-\d{2}-\d{2}$/.test(f) ? f.slice(2, 4) + f.slice(5, 7) + f.slice(8, 10) : '';
function rfcBase(nombre, ap, am, fnac) { const l = idLetras(nombre, ap, am, false), d = idAAMMDD(fnac); return l && d ? l + d : ''; }
function curpBase(nombre, ap, am, fnac, genero, estado) {
  const l = idLetras(nombre, ap, am, true), d = idAAMMDD(fnac); if (!l || !d || !genero || !estado) return '';
  const cons = s => { for (const ch of String(s || '').slice(1)) if (/[A-Z]/.test(ch) && !VOCALES.includes(ch)) return ch; return 'X'; };
  return l + d + (genero === 'Hombre' ? 'H' : 'M') + estado + cons(idLimpia(ap)) + cons(idLimpia(am)) + cons(idNombre(nombre));
}
/* separa "JUAN CARLOS PEREZ DE LA CRUZ" en nombre, paterno y materno (apellidos compuestos con partículas) */
function splitNombre(full) {
  const t = String(full || '').trim().replace(/\s+/g, ' ').split(' ').filter(Boolean); if (t.length < 2) return { n: t.join(' '), ap: '', am: '' };
  const toma = () => { let b = [t.pop()]; while (t.length > 1 && PART_NOM.test(t[t.length - 1].toUpperCase())) b.unshift(t.pop()); return b.join(' '); };
  if (t.length === 2) return { n: t[0], ap: t[1], am: '' };
  const am = toma(), ap = toma(); return { n: t.join(' '), ap, am };
}

/* campos de la ventana de confirmación (mismos que pide Fieldway para crear el usuario) */
function identidadCampos(p, pre) {
  const req = (id, lbl, html) => `<div class="fld"><label>${lbl}</label>${html}</div>`, v = k => esc((p && p[k]) || '');
  return `<div class="row2">${req(pre + 'nom', 'Nombre(s) *', `<input id="${pre}nom" value="${v('nombre_pila')}" autocomplete="off">`)}${req(pre + 'ap', 'Apellido paterno *', `<input id="${pre}ap" value="${v('apellido_p')}" autocomplete="off">`)}</div>
    <div class="row2">${req(pre + 'am', 'Apellido materno', `<input id="${pre}am" value="${v('apellido_m')}" autocomplete="off">`)}${req(pre + 'mail', 'Correo electrónico', `<input id="${pre}mail" type="email" value="${v('correo')}" autocomplete="off">`)}</div>
    <div class="row2">${req(pre + 'fn', 'Fecha de nacimiento *', `<input id="${pre}fn" type="date" value="${v('fecha_nacimiento')}" max="${addD(HOY, -16 * 365)}" oninput="idRfcAuto('${pre}')">`)}${req(pre + 'tel', 'Teléfono de contacto * (10 dígitos)', `<input id="${pre}tel" inputmode="numeric" value="${v('telefono')}" autocomplete="off">`)}</div>
    <div class="row2">${req(pre + 'gen', 'Género *', `<select id="${pre}gen"><option value="">— elige —</option>${['Hombre', 'Mujer'].map(g => `<option ${p && p.genero === g ? 'selected' : ''}>${g}</option>`).join('')}</select>`)}${req(pre + 'ec', 'Estado civil *', `<select id="${pre}ec"><option value="">— elige —</option>${ESTADOS_CIVIL.map(g => `<option ${p && p.estado_civil === g ? 'selected' : ''}>${g}</option>`).join('')}</select>`)}</div>
    ${req(pre + 'rfc', 'RFC (13 caracteres)', `<div class="rfc-row"><input id="${pre}rfc" maxlength="13" style="text-transform:uppercase" value="${v('rfc')}" autocomplete="off" placeholder="Genera la base y completa la homoclave"><button type="button" class="btn sm" onclick="idRfcGenerar('${pre}')">⚙️ Generar base (10)</button></div><small class="muted">La base sale del nombre y la fecha de nacimiento. La homoclave (3 últimos caracteres) se consulta en el SAT y se escribe a mano.</small>`)}`;
}
function idRfcGenerar(pre) {
  const g = k => limpia($(pre + k).value), base = rfcBase(g('nom'), g('ap'), g('am'), $(pre + 'fn').value);
  if (!base) { toast('Para generar el RFC captura nombre, apellido paterno y fecha de nacimiento'); return; }
  const cur = $(pre + 'rfc').value.toUpperCase(); $(pre + 'rfc').value = base + (cur.length > 10 ? cur.slice(10) : ''); $(pre + 'rfc').focus();
}
function idRfcAuto(pre) { const r = $(pre + 'rfc'); if (r && !r.value) { const b = rfcBase(limpia($(pre + 'nom').value), limpia($(pre + 'ap').value), limpia($(pre + 'am').value), $(pre + 'fn').value); if (b) r.placeholder = 'Base sugerida: ' + b + ' + homoclave'; } }
function idLeer(pre) {
  const g = k => limpia($(pre + k).value);
  return { nombre_pila: g('nom'), apellido_p: g('ap'), apellido_m: g('am') || null, correo: g('mail') || null, fecha_nacimiento: $(pre + 'fn').value || null, telefono: g('tel').replace(/\D/g, ''), genero: $(pre + 'gen').value, estado_civil: $(pre + 'ec').value, rfc: g('rfc').toUpperCase() || null };
}
function idErrores(d) {
  const e = []; if (!d.nombre_pila) e.push('Falta el nombre.'); if (!d.apellido_p) e.push('Falta el apellido paterno.'); if (!d.fecha_nacimiento) e.push('Falta la fecha de nacimiento.');
  if (!d.genero) e.push('Elige el género.'); if (!d.estado_civil) e.push('Elige el estado civil.'); if (d.telefono.length !== 10) e.push('El teléfono debe tener 10 dígitos.');
  if (d.correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.correo)) e.push('El correo no es válido.'); if (d.rfc && !/^[A-ZÑ&]{4}\d{6}[A-Z0-9]{3}$/.test(d.rfc)) e.push('El RFC debe tener 13 caracteres: 4 letras, 6 dígitos y la homoclave.');
  return e;
}

/* >>> 08_demo_reportes.js */
/* ----- datos de ejemplo para reportes, ingresos y movimientos (todo ficticio) ----- */
(function () {
  const rnd = (() => { let s = 11; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  let cache = null;
  const monday = d => { const x = new Date(d + 'T12:00:00'); const k = (x.getDay() + 6) % 7; x.setDate(x.getDate() - k); return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()); };
  const NW = 13;
  function build() {
    const tiendas = Object.values(S.cat.tiendas); const m0 = monday(HOY);
    const ventana = Array.from({ length: NW }, (_, k) => ({ w: '26-S' + (28 + k), ini: addD(m0, -7 * (NW - 1 - k)) }));
    const sa = Array.from({ length: 40 }, (_, k) => ({ w: '26-S' + pad(k + 1), ini: addD(m0, -7 * (39 - k)) }));
    const f0 = addD(HOY, -93), nd = 94, nCd = diffD(HOY, ventana[0].ini) + 1;
    const meses = []; for (let i = 3; i >= 0; i--) { const d = new Date(HOY + 'T12:00:00'); d.setDate(1); d.setMonth(d.getMonth() - i); meses.push(d.getFullYear() + '-' + pad(d.getMonth() + 1)); }
    const tien = tiendas.map(t => {
      const ps = t.posiciones, cuota = ps * 6;
      const sem = ventana.map(w => [0, 0, cuota, ps * 9, 0, 0, 0, 0, w.ini]);
      const chk = ventana.map(() => { const d = ri(4, 13), c = Math.round(d * (0.8 + rnd() * 0.2)), pr = ri(0, 3); const e = Array.from({ length: 9 }, () => ri(0, 2)); e[0] = c; return [ri(1, 3), d, c, pr, 0, ...e]; });
      let cd = ''; for (let q = 0; q < nCd; q++) cd += rnd() < 0.84 ? String(ri(1, ps + 1)) : '0';
      if (t.idpdv % 7 === 0) cd = cd.slice(0, nCd - 5) + '00000'; if (t.idpdv % 5 === 0) cd = cd.slice(0, nCd - 4) + '0000'; if (t.idpdv % 6 === 0) cd = cd.slice(0, nCd - 3) + '000';
      let dias = ''; for (let i = 0; i < nd; i++) dias += rnd() < 0.8 ? 'C' : '0'; dias = dias.slice(0, nd - nCd % 7) ;
      const tail = cd.match(/0+$/); const ra0 = tail ? tail[0].length : 0;
      const pen = meses.map((m, k) => { const act = k === meses.length - 1; const mx = act ? ra0 : ri(0, 6); const e = mx >= 5 ? 2 : mx >= 3 ? 1 : 0;
        return { m, e, pa: mx >= 3 ? `${ri(1, 20)} al ${ri(21, 28)} ${MESN[+m.slice(5) - 1]}.` : null, dr: mx >= 3 ? mx : 0, mx, pm: mx >= 2 ? `${ri(1, 10)} al ${ri(11, 20)} ${MESN[+m.slice(5) - 1]}.` : null, ds: ri(mx, mx + 5), ul: addD(HOY, -ra0 - 1), uf: act ? addD(HOY, -ra0 - 1) : null, ue: act ? (rnd() < 0.85 ? 'Cumple Original' : 'Abierto') : null, ra: act ? ra0 : 0, hoy: act ? ['A', 'E', '0', '0'][ri(0, 3)] : null, rs: mx >= 2 ? [[mx, addD(HOY, -mx), addD(HOY, -1)]] : [], act }; });
      return { idpdv: t.idpdv, semanas: sem, chk: { s: chk, cd }, dias, hc_sem: sa.map(() => ri(1, 3)), pen };
    });
    const nom = ['Ana Solís', 'Luis Ortega', 'María Cruz', 'José Reyes', 'Daniela Ruiz', 'Carlos Mora', 'Paola Estrada', 'Jorge Lara', 'Valeria Núñez', 'Diego Gil', 'Karla Vega', 'Miguel Soto', 'Fátima Luna', 'Ricardo Salas', 'Brenda Morales'];
    const hc = Array.from({ length: 70 }, (_, i) => { const t = tiendas[i % tiendas.length]; const dsc = i % 9 === 0 ? ri(2, 12) : i % 5 === 0 ? 1 : 0; const aus = i % 11 === 0; const alta = i % 4 === 0 ? ri(1, 27) : ri(30, 900); return { usuario: 'DEMO' + (100 + i), nombre: nom[i % 15] + ' ' + (i + 1), fecha_alta: addD(HOY, -alta), baja_final: i % 6 === 0 ? addD(HOY, -ri(200, 600)) : null, estatus_modelo: 'Activo', tipo_ingreso: i % 6 === 0 ? 'Reingreso' : 'Nuevo', empresa: ['Benber SS', 'Revelor', 'Doma Legal'][i % 3], ultimo_check: addD(HOY, -dsc), ultimo_idpdv: t.idpdv, ausencia_dias: aus ? 5 : null, ausencia_regreso: aus ? addD(HOY, 2) : null, ausencia_motivo: aus ? 'Vacaciones' : null, rol: i % 8 === 0 ? 'Cubre descansos' : 'Promotor' }; });
    const uc = hc.map(h => ({ usuario: h.usuario, fecha: h.ultimo_check, idpdv: h.ultimo_idpdv, rol: h.rol, hora_in: '09:' + pad(ri(0, 55)) + ':00', hora_out: '18:' + pad(ri(0, 50)) + ':00', estatus_check: rnd() < 0.8 ? 'Cumple' : 'Error Comida', validacion: 'Cumple' }));
    return { meta: { ventana, cd_desde: ventana[0].ini, ultima_fecha: HOY, dias_desde: f0, dias_n: nd, hoy: HOY, estatus_check: [], semanas_anio: sa, generado: 'datos de ejemplo' }, tiendas: tien, hc, uc, bajas: [] };
  }
  Demo.reporte = async function () { if (!cache) cache = build(); return cache; };
  Demo.movs = async function () {
    const t = Object.values(S.cat.tiendas), ing = [], baj = [];
    for (let d = -100; d <= 0; d++) { const f = addD(HOY, d); for (let k = 0; k < ri(6, 14); k++) { const x = t[ri(0, t.length - 1)]; ing.push({ f, idpdv: x.idpdv, rec: ri(1, 8), fu: ri(1, 9) }); } for (let k = 0; k < ri(6, 15); k++) { const x = t[ri(0, t.length - 1)]; baj.push({ f, idpdv: x.idpdv, mot: ['Motivos personales', 'Abandono de trabajo', 'Renuncia voluntaria', 'Mejor oferta laboral (telefonía)', 'Malas prácticas'][ri(0, 4)], u: 'D' + k }); } }
    return { ing, baj };
  };
  Demo.checks = async function (desde, hasta) {
    const out = []; const tiendas = Object.values(S.cat.tiendas).slice(0, 30); let k = 0;
    for (let d = 0; d < 7; d++) { const f = addD(desde, d); if (f > HOY || f > hasta) continue; tiendas.forEach(t => { for (let n = 0; n < 2; n++) { k++; const r = rnd(); const est = r < 0.78 ? 'Cumple' : r < 0.84 ? 'Error Comida' : r < 0.9 ? 'Check Out Fuera Ventana' : r < 0.94 ? 'Tiempo Incompleto' : r < 0.97 ? 'Check In Fuera Rango' : 'Equipo Duplicado'; const v = est === 'Cumple' ? 'Cumple' : (rnd() < 0.5 && !/Rango|Duplicado/.test(est) ? 'Cumple Productividad' : 'No Cumple'); const reg = v === 'Cumple Productividad' ? ri(1, 4) : (rnd() < 0.4 ? ri(0, 3) : 0);
      out.push({ id: 'k' + k + f, semana: '', fecha: f, usuario: 'DEMO' + (100 + (k % 60)), nombre: ['Ana Solís', 'Luis Ortega', 'María Cruz', 'José Reyes'][k % 4] + ' ' + (k % 60), idpdv: t.idpdv, rol: 'Promotor', hora_in: '09:' + pad(ri(0, 59)) + ':10', hora_com_in: '13:' + pad(ri(0, 30)) + ':00', hora_com_out: '14:' + pad(ri(0, 30)) + ':00', hora_out: '18:' + pad(ri(0, 59)) + ':00', tiempo_ub: est === 'Tiempo Incompleto' ? ri(300, 470) : ri(480, 560), tiempo_com: ri(10, 60), rango_in: est === 'Check In Fuera Rango' ? 'Fuera de Rango' : 'Dentro de Rango', rango_out: 'Dentro de Rango', equipo_dup: est === 'Equipo Duplicado', estatus_check: est, validacion: v, estatus_final: v, registros: reg, temm: Math.min(reg, 1), porta: reg > 1 ? 1 : 0, pospago: 0, prepago: Math.max(0, reg - 1), check_tel: 0 }); } }); }
    return out;
  };

  /* ----- bajas / encuesta (demo, en memoria) ----- */
  const DB = { lista: null, colab: null };
  const iniBajas = () => {
    if (DB.lista) return; const t = Object.values(S.cat.tiendas), nom = ['Ana Solís', 'Luis Ortega', 'María Cruz', 'José Reyes', 'Daniela Ruiz', 'Carlos Mora', 'Paola Estrada', 'Jorge Lara'], mot = ['Motivos personales', 'Abandono de trabajo', 'Renuncia voluntaria', 'Malas prácticas', 'Baja productividad'];
    DB.colab = Array.from({ length: 60 }, (_, i) => ({ usuario_fieldwy: 'DEMO' + (300 + i), nombre: nom[i % 8] + ' ' + (i + 1), empresa: ['Benber SS', 'Revelor'][i % 2], idpdv: t[i % t.length].idpdv, estatus: 'Activo', fecha_ingreso: addD(HOY, -ri(20, 600)) }));
    DB.lista = Array.from({ length: 24 }, (_, i) => { const c = DB.colab[i]; c.estatus = 'Baja'; return { id: i + 1, usuario: c.usuario_fieldwy, nombre: c.nombre, empresa: c.empresa, fecha: addD(HOY, -ri(0, 60)), ultimo: null, motivo: mot[i % 5], marca: null, adeudo: i % 7 === 0 ? 350 : 0, finq: ['Sin iniciar', 'Calculado', 'Pagado'][i % 3], idpdv: c.idpdv, com: '', enc: i % 4 === 0 }; });
  };
  Demo.buscarColab = async q => { iniBajas(); q = String(q || '').toLowerCase(); return DB.colab.filter(c => (c.nombre + c.usuario_fieldwy).toLowerCase().includes(q)).slice(0, 15); };
  Demo.bajasPrevias = async u => { iniBajas(); return DB.lista.filter(b => b.usuario === u && b.fecha >= addD(HOY, -45)).map(b => ({ id: b.id, fecha_baja: b.fecha, motivo: b.motivo })); };
  Demo.bajasLista = async desde => { iniBajas(); return DB.lista.filter(b => !desde || b.fecha >= desde).slice().sort((a, b) => b.fecha.localeCompare(a.fecha)); };
  Demo.registrarBaja = async d => { iniBajas(); const c = DB.colab.find(x => x.usuario_fieldwy === d.usuario); if (c) c.estatus = 'Baja'; const id = DB.lista.length + 1; DB.lista.push({ id, usuario: d.usuario, nombre: c ? c.nombre : d.usuario, empresa: c && c.empresa, fecha: d.fecha, ultimo: d.ultimo, motivo: d.motivo, marca: d.marca, adeudo: d.adeudo || 0, finq: 'Sin iniciar', idpdv: d.idpdv, com: d.comentarios, enc: !!d.enc }); return id; };
  Demo.guardarEncuesta = async () => { };
  Demo.actualizarFiniquito = async () => { };
  Demo.anularBaja = async b => { iniBajas(); DB.lista = DB.lista.filter(x => x.id !== b.id); const c = DB.colab.find(x => x.usuario_fieldwy === b.usuario); if (c) c.estatus = 'Activo'; };

  /* ----- altas / expedientes (demo) ----- */
  const DA = { c: null, e: null };
  const iniAltas = () => { if (DA.c) return; const t = Object.values(S.cat.tiendas), nom = ['Rosa Vidal', 'Iván Rojas', 'Elena Pozos', 'Raúl Mena', 'Sofía Díaz', 'Omar Ceja'];
    DA.c = nom.map((n, i) => ({ id: 'AC' + i, nombre: n + ' ' + (i + 1), telefono: '55123456' + (10 + i), idpdv: t[(i * 5) % t.length].idpdv, fecha_programada: addD(HOY, -i * 2), reclutador_id: 1, usuario_fieldwy: null }));
    DA.e = Array.from({ length: 14 }, (_, i) => ({ id: i + 1, usuario_fieldwy: 'DEMO' + (500 + (i >> 1)), tipo: ['Expediente', 'Datos bancarios', 'CSF'][i % 3], fecha_limite: addD(HOY, (i % 6) - 3), estatus: 'Pendiente', colaboradores: { nombre: nom[(i >> 1) % 6] + ' ' + ((i >> 1) + 1), fecha_ingreso: addD(HOY, -7 + (i % 6) - 3), idpdv: t[(i * 3) % t.length].idpdv, empresa: 'Benber SS', estatus: 'Activo' } })); };
  Demo.altasPend = async () => { iniAltas(); return DA.c.filter(c => !c.usuario_fieldwy); };
  Demo.altasUltimas = async () => { iniAltas(); return []; };
  Demo.empresas = async () => ['Benber SS', 'Revelor', 'Doma Legal'];
  Demo.registrarAlta = async d => { iniAltas(); const c = DA.c.find(x => x.id === d.candidato); if (c) c.usuario_fieldwy = d.usuario; };
  Demo.expedientes = async () => { iniAltas(); return DA.e.filter(x => x.estatus === 'Pendiente'); };
  Demo.marcarDoc = async id => { iniAltas(); const x = DA.e.find(e => e.id === id); if (x) x.estatus = 'Recibido'; };

  const DD = { docs: {} };
  Demo.altasDia = async () => { iniAltas(); return DA.c.slice(0, 3).map((c, i) => ({ usuario_fieldwy: 'DEMO9' + i, nombre: c.nombre, empresa: 'Benber SS', idpdv: c.idpdv, fecha_ingreso: HOY, creado_en: new Date().toISOString(), tipo_ingreso: 'Nuevo', usuario_creado_en: i === 0 ? new Date().toISOString() : null, datos_sensibles: [{ curp: 'ABCD010203HDFXXX0' + i, rfc: 'ABCD0102039' + i + '1', nss: '1234567890' + i, correo: 'demo' + i + '@mail.com', telefono: '551234567' + i }] })); };
  Demo.marcarUsuarioCreado = async () => { };
  Demo.docsDe = async u => Object.values(DD.docs[u] || {});
  Demo.guardarDoc = async (u, tipo, url) => { (DD.docs[u] = DD.docs[u] || {})[tipo] = { usuario_fieldwy: u, tipo, enlace_url: url, estatus: 'Cargado' }; };
  Demo.validarDoc = async (u, tipo, est, nota) => { DD.docs[u][tipo].estatus = est; DD.docs[u][tipo].nota = nota; };
  Demo.cerrarPendientes = async () => { };
})();

/* >>> 99_init.js */
/* ====================================================================== arranque ====================================================================== */
async function entrar() {
  try {
    S.me = await API.me(); S.cat = await API.catalogos();
    $('login').hidden = true; $('app').hidden = false;
    $('u-nombre').textContent = S.me.nombre; $('u-rol').textContent = NIVEL[S.me.rol] || S.me.rol;
    const alc = S.me.permisos.alertas; $('u-alc').textContent = S.me.rol === 'rh' && S.me.rrhh ? 'Estados de ' + S.me.rrhh : alc && alc.alcance === 'todo' ? 'Acceso general' : alc ? 'Alcance: ' + alc.alcance : '';
    [S.alertas, S.vigentes] = await Promise.all([can('alertas', 'ver') ? API.alertas() : [], can('ausencias', 'ver') ? API.vigentes() : []]);
    const primera = VISTAS.find(v => !v.soon && can(v.mod, 'ver')); S.view = primera ? primera.k : 'bandeja';
    nav(); render();
    vacInsignia();
    API.generado().then(g => { S.gen = g; fbPintar(); }).catch(() => { });
  } catch (e) { await API.logout(); mostrarLogin(e.message || String(e)); }
}
function mostrarLogin(msg) { $('app').hidden = true; $('login').hidden = false; $('lg-msg').textContent = msg || ''; $('lg-u').focus(); }
(async function () {
  ['sb-logo', 'tb-logo'].forEach(i => $(i).src = img('logo_gb')); $('lg-mascot').src = img('mochila');
  $('u-salir').onclick = () => API.logout().then(() => mostrarLogin());
  $('tb-menu').onclick = () => $('sidebar').classList.toggle('open');
  $('lg-form').onsubmit = async e => { e.preventDefault(); $('lg-msg').textContent = ''; const b = $('lg-btn'); b.disabled = true; b.textContent = 'Entrando…'; try { await API.login($('lg-u').value, $('lg-p').value); await entrar(); } catch (x) { $('lg-msg').textContent = x.message; } b.disabled = false; b.textContent = 'Entrar'; };
  if (DEMO) { await entrar(); return; }
  try { if (await API.init()) await entrar(); else mostrarLogin(); } catch (e) { mostrarLogin('No se pudo conectar: ' + e.message); }
})();

