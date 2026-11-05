/* Portal de Comisiones — Grupo Benber.
   Lee las tablas com_* de Supabase (las sube publicar_comisiones.py). Quién ve qué lo decide la base (RLS):
   admin y dirección ven todo, gerente y supervisor su estructura, nómina lo que se paga. */
'use strict';
const CFG = window.RH_CONFIG;
const $ = s => document.querySelector(s);
const esc = v => String(v == null ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dinero = v => '$' + Number(v || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const entero = v => Number(v || 0).toLocaleString('es-MX');
const pct = v => v == null ? '' : (Number(v) * 100).toFixed(1) + '%';
const fecha = v => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
const ROLES = { admin: 'Administrador', direccion: 'Dirección', gerente: 'Gerente', supervisor: 'Supervisor', nomina: 'Nómina' };
const CUOTAS = { final: 'Final (proforma)', original: 'Original Telefónica', benber: 'Benber (agencia)' };
const ESTADOS_SEM = { previo: ['Previo', 'b-am'], final: ['Final', 'b-az'], pagada: ['Pagada', 'b-ok'] };
const ESTADOS_ACL = ['Pendiente', 'Enviada', 'Resuelta', 'Rechazada'];
const CLASE_ACL = { Pendiente: 'b-am', Enviada: 'b-az', Resuelta: 'b-ok', Rechazada: 'b-no' };
const GRUPO_CLASE = { 'Pagada': 'b-ok', 'Pagable en $0': 'b-am', 'No pagada': 'b-no', 'No impactada': 'b-az', 'Otra semana': 'b-gr', 'Sin actividad': 'b-gr' };

let sb, YO = null, SEMANAS = [], SEM = null, DATOS = {};

function setEstado(t, err) { const e = $('#estado'); e.textContent = t || ''; e.className = 'estado' + (err ? ' err' : ''); }
const ver = id => ['login', 'sinAcceso', 'portal'].forEach(x => $('#' + x).classList.toggle('oculto', x !== id));
const es = (...r) => YO && r.includes(YO.rol);

/* ---------- datos ---------- */
async function todo(tabla, select, filtros = {}) {
  const out = [];
  for (let i = 0; ; i += 1000) {
    let q = sb.from(tabla).select(select).range(i, i + 999);
    for (const [k, v] of Object.entries(filtros)) q = q.eq(k, v);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    out.push(...data);
    if (data.length < 1000) return out;
  }
}
async function cargar(clave) {          // cada conjunto se baja una sola vez por semana
  if (DATOS[clave]) return DATOS[clave];
  const s = { semana: SEM.semana };
  setEstado('Cargando ' + clave + '...');
  const q = {
    promotores: () => todo('com_promotores', '*', s),
    lineas: () => todo('com_lineas', '*', s),
    tiendas: () => todo('com_tiendas', '*', s),
    operativos: () => todo('com_operativos', '*', s),
    aclaraciones: () => todo('com_aclaraciones', '*', s),
  }[clave];
  DATOS[clave] = await q();
  setEstado('');
  return DATOS[clave];
}

/* ---------- tabla genérica: búsqueda, filtros, orden, páginas, Excel ---------- */
function tabla({ cols, filas, filtros = [], nota = '', exportar = null, extra = '', alPintar = null }) {
  const st = { page: 0, col: null, dir: 1, q: '', f: {} };
  const p = document.createElement('div');
  const opts = k => [...new Set(filas.map(f => f[k]).filter(v => v != null && v !== ''))].sort((a, b) => String(a).localeCompare(String(b), 'es'));
  p.innerHTML = `<div class="toolbar"><input type="search" placeholder="Buscar...">
      ${filtros.map(k => `<select data-f="${k}"><option value="">${esc(cols.find(c => c.k === k)?.t || k)}: todos</option>${opts(k).map(v => `<option>${esc(v)}</option>`).join('')}</select>`).join('')}
      ${extra}${exportar ? '<button class="xls">Descargar Excel</button>' : ''}<span class="info"></span></div>
    ${nota ? `<p class="note">${nota}</p>` : ''}
    <div class="tablewrap"><table><thead><tr>${cols.map((c, i) => `<th data-i="${i}">${esc(c.t)}<span></span></th>`).join('')}</tr></thead><tbody></tbody></table></div>
    <div class="pager"><button class="prev">&larr;</button><span class="pg"></span><button class="next">&rarr;</button></div>`;
  const tb = p.querySelector('tbody');
  const lista = () => {
    let r = filas;
    for (const [k, v] of Object.entries(st.f)) if (v) r = r.filter(f => String(f[k]) === v);
    if (st.q) r = r.filter(f => cols.some(c => f[c.k] != null && String(f[c.k]).toLowerCase().includes(st.q)));
    if (st.col != null) { const k = cols[st.col].k, d = st.dir; r = r.slice().sort((a, b) => { const x = a[k] ?? '', y = b[k] ?? ''; return (typeof x === 'number' && typeof y === 'number') ? (x - y) * d : String(x).localeCompare(String(y), 'es') * d; }); }
    return r;
  };
  const celda = (c, f) => {
    const v = f[c.k];
    if (c.html) return c.html(f);
    if (v == null || v === '') return '';
    if (c.tipo === '$') return dinero(v);
    if (c.tipo === '%') return pct(v);
    if (c.tipo === 'n') return entero(v);
    if (c.tipo === 'f') return fecha(v);
    return esc(v);
  };
  function draw() {
    const r = lista(), np = Math.max(1, Math.ceil(r.length / 50)); if (st.page >= np) st.page = np - 1;
    tb.innerHTML = r.slice(st.page * 50, st.page * 50 + 50).map(f => `<tr>${cols.map(c => `<td class="${['$', '%', 'n'].includes(c.tipo) ? 'num' : ''}" title="${c.tipo ? '' : esc(f[c.k])}">${celda(c, f)}</td>`).join('')}</tr>`).join('');
    p.querySelector('.info').textContent = entero(r.length) + ' filas';
    p.querySelector('.pg').textContent = `Página ${st.page + 1} de ${np}`;
    p.querySelector('.prev').disabled = st.page <= 0; p.querySelector('.next').disabled = st.page >= np - 1;
    p.querySelectorAll('th span').forEach((s, i) => s.textContent = st.col === i ? (st.dir === 1 ? ' ▲' : ' ▼') : '');
    if (alPintar) alPintar(tb, r.slice(st.page * 50, st.page * 50 + 50));
  }
  p.querySelector('input[type=search]').oninput = e => { st.q = e.target.value.toLowerCase(); st.page = 0; draw(); };
  p.querySelectorAll('select[data-f]').forEach(s => s.onchange = () => { st.f[s.dataset.f] = s.value; st.page = 0; draw(); });
  p.querySelectorAll('th').forEach(th => th.onclick = () => { const i = +th.dataset.i; if (st.col === i) st.dir *= -1; else { st.col = i; st.dir = 1; } draw(); });
  p.querySelector('.prev').onclick = () => { st.page--; draw(); };
  p.querySelector('.next').onclick = () => { st.page++; draw(); };
  if (exportar) p.querySelector('.xls').onclick = () => excel(exportar, cols.filter(c => !c.soloPantalla), lista());
  p.filtradas = lista; p.redibujar = draw;
  draw(); return p;
}
function excel(nombre, cols, filas) {
  const ws = XLSX.utils.aoa_to_sheet([cols.map(c => c.t), ...filas.map(f => cols.map(c => { const v = f[c.k]; return c.tipo === 'f' ? fecha(v) : (v ?? ''); }))]);
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Datos');
  XLSX.writeFile(wb, `${nombre} - ${SEM.semana}.xlsx`);
}

/* ---------- pestañas ---------- */
const PESTANAS = [
  { id: 'resumen', t: 'Resumen', roles: ['admin', 'direccion', 'gerente', 'supervisor', 'nomina'], fn: pResumen },
  { id: 'promotores', t: 'Promotores', roles: ['admin', 'direccion', 'gerente', 'supervisor', 'nomina'], fn: pPromotores },
  { id: 'lineas', t: 'Líneas (DN)', roles: ['admin', 'direccion', 'gerente', 'supervisor'], fn: pLineas },
  { id: 'tiendas', t: 'Tiendas y cuota', roles: ['admin', 'direccion', 'gerente', 'supervisor'], fn: pTiendas },
  { id: 'aclaraciones', t: 'Aclaraciones', roles: ['admin', 'direccion', 'gerente', 'supervisor'], fn: pAclaraciones },
  { id: 'operativos', t: 'Operativos', roles: ['admin', 'direccion', 'gerente', 'supervisor', 'nomina'], fn: pOperativos },
  { id: 'nomina', t: 'Nómina', roles: ['admin', 'direccion', 'nomina'], fn: pNomina },
];
let activa = 'resumen';
function pintarTabs() {
  const tabs = $('#tabs'); tabs.innerHTML = '';
  PESTANAS.filter(p => es(...p.roles)).forEach(p => {
    const b = document.createElement('button'); b.textContent = p.t; b.classList.toggle('active', p.id === activa);
    b.onclick = () => abrirTab(p.id); tabs.appendChild(b);
  });
}
async function abrirTab(id) {
  activa = id; pintarTabs();
  const cont = $('#panels'); cont.innerHTML = '<div class="panel vacio">Cargando...</div>';
  try { const el = await PESTANAS.find(p => p.id === id).fn(); cont.innerHTML = ''; el.classList.add('panel'); cont.appendChild(el); }
  catch (e) { cont.innerHTML = `<div class="panel vacio mal">${esc(e.message)}</div>`; setEstado(''); }
}

async function pResumen() {
  const pr = await cargar('promotores'), op = await cargar('operativos');
  const t = SEM.totales || {}, alcance = es('admin', 'direccion', 'nomina') ? 'toda la operación' : (YO.rol === 'gerente' ? YO.gerente : YO.supervisor);
  const comProm = pr.reduce((a, f) => a + (f.comision || 0), 0);
  const conPago = new Set(pr.filter(f => f.comision > 0).map(f => f.usuario_fw)).size;
  const oper = op.filter(f => f.nivel !== 'piso').reduce((a, f) => a + (f.comision || 0), 0);
  let acl = [];
  if (!es('nomina')) acl = await cargar('aclaraciones');
  const pend = acl.filter(a => a.estado === 'Pendiente' || a.estado === 'Enviada');
  const cards = [
    ['Comisión promotores', dinero(comProm), `${entero(conPago)} promotores con pago · ${esc(alcance)}`, 'nar'],
    ['Operativos', dinero(oper), 'supervisores, gerentes y subdirección', 'nar'],
  ];
  if (!es('nomina')) {
    const est = pend.reduce((a, x) => a + (x.monto || 0), 0), por = {};
    pend.forEach(a => por[a.estado] = (por[a.estado] || 0) + 1);
    cards.push(['Aclaraciones abiertas', entero(pend.length), Object.entries(por).map(([e, n]) => `${entero(n)} ${e.toLowerCase()}s`).join(' · ') + (est > 0 ? ` · ≈ ${dinero(est)}` : ''), pend.length ? 'ambar' : 'ok']);
  }
  $('#cards').innerHTML = cards.map(([l, v, s, c]) => `<div class="card"><div class="lbl">${l}</div><div class="val ${c}">${v}</div><div class="sub">${s}</div></div>`).join('');
  const d = document.createElement('div');
  let html = `<p class="note" style="margin-top:0">Semana ${esc(SEM.semana)} · ${esc(SEM.rango)} · calculada con cuota <b>${esc(CUOTAS[SEM.cuota])}</b> · publicada ${fecha(SEM.publicado_en)} ${(SEM.publicado_en || '').slice(11, 16)}</p>`;
  if (es('admin', 'direccion') && t.por_cuota) {
    const fin = t.por_cuota.final || 0;
    html += `<h3>Comisión de promotores con cada cuota</h3><div class="tablewrap" style="max-height:none"><table><thead><tr><th>Cuota</th><th>Total</th><th>vs final</th></tr></thead><tbody>
      ${Object.entries(t.por_cuota).map(([m, v]) => `<tr${m === SEM.cuota ? ' style="font-weight:700"' : ''}><td>${CUOTAS[m]}${m === SEM.cuota ? ' ← usada' : ''}</td><td class="num">${dinero(v)}</td><td class="num">${m === 'final' ? '' : `<span class="${v - fin < 0 ? 'mal' : 'ambar'}">${dinero(v - fin)}</span>`}</td></tr>`).join('')}
      </tbody></table></div>
      <p class="note">${t.proforma_mayor || 0} tiendas con cuota de proforma mayor a la oficial de Telefónica (ver Tiendas y cuota).${Object.keys(t.excepciones_cuota || {}).length ? ` ${Object.keys(t.excepciones_cuota).length} tiendas con cuota distinta a la general.` : ''}</p>`;
  }
  if (SEM.estado === 'previo') html += `<p class="note ambar">Semana en PREVIO: los montos pueden cambiar hasta que se marque como Final.</p>`;
  d.innerHTML = html; return d;
}

async function pPromotores() {
  const pr = await cargar('promotores');
  const puedeDetalle = !es('nomina');
  const t = tabla({
    filas: pr, filtros: ['gerente', 'supervisor'], exportar: 'Promotores',
    extra: `<button class="pdfTodos">Imprimir estados de cuenta (filtrados)</button>`,
    nota: 'Una fila por promotor y tienda. "Estado de cuenta" abre la impresión; elige "Guardar como PDF" para mandarlo por WhatsApp o correo.',
    cols: [
      { k: 'promotor', t: 'Promotor' }, { k: 'usuario_fw', t: 'Usuario FW' }, { k: 'tienda', t: 'Tienda' }, { k: 'idpdv', t: 'IDPDV' },
      { k: 'gerente', t: 'Gerente' }, { k: 'supervisor', t: 'Supervisor' },
      { k: 'altas', t: 'Altas', tipo: 'n' }, { k: 'altas_nat', t: 'Altas nat.', tipo: 'n' }, { k: 'temm', t: 'Temm', tipo: 'n' }, { k: 'temm_nat', t: 'Temm nat.', tipo: 'n' },
      { k: 'cuota_total', t: 'Cuota tienda', tipo: 'n' }, { k: 'alcance_total', t: '% Alcance', tipo: '%' }, { k: 'cuota_temm', t: 'Cuota Temm', tipo: 'n' }, { k: 'alcance_temm', t: '% Alcance Temm', tipo: '%' },
      { k: 'comision_temm', t: 'Com. Temm', tipo: '$' }, { k: 'comision_prepago', t: 'Com. Prepago', tipo: '$' }, { k: 'comision', t: 'Comisión', tipo: '$' },
      { k: '_pdf', t: '', soloPantalla: true, html: f => f.usuario_fw && f.usuario_fw !== 'NO REGISTRO' ? `<button class="mini" data-u="${esc(f.usuario_fw)}">Estado de cuenta</button>` : '' },
    ],
    alPintar: tb => tb.querySelectorAll('button[data-u]').forEach(b => b.onclick = () => imprimir([b.dataset.u], puedeDetalle)),
  });
  t.querySelector('.pdfTodos').onclick = () => {
    const us = [...new Set(t.filtradas().map(f => f.usuario_fw).filter(u => u && u !== 'NO REGISTRO'))];
    if (us.length > 300 && !confirm(`Son ${us.length} estados de cuenta. ¿Continuar?`)) return;
    imprimir(us, puedeDetalle);
  };
  return t;
}

async function imprimir(usuarios, conDetalle) {
  const pr = await cargar('promotores'), li = conDetalle ? await cargar('lineas') : [];
  const logo = window.GB_LOGO || '';
  const hojas = usuarios.map(u => {
    const filas = pr.filter(f => f.usuario_fw === u), nombre = filas[0]?.promotor || u;
    const total = filas.reduce((a, f) => a + (f.comision || 0), 0);
    const lineas = li.filter(l => l.usuario_fw === u).sort((a, b) => String(a.fecha_alta || '').localeCompare(String(b.fecha_alta || '')));
    return `<div class="hoja"><div class="enc"><img src="${logo}"><div><h2>Estado de cuenta de comisiones</h2>
        <div>Semana ${esc(SEM.semana)} · ${esc(SEM.rango)}${SEM.estado === 'previo' ? ' · PREVIO (puede cambiar)' : ''}</div></div></div>
      <div><b>${esc(nombre)}</b> · Usuario ${esc(u)}</div>
      <h3>Por tienda</h3><table><thead><tr><th>Tienda</th><th>Altas</th><th>Altas nat.</th><th>Temm</th><th>Cuota tienda</th><th>% Alcance</th><th>% Alcance Temm</th><th>Com. Temm</th><th>Com. Prepago</th><th>Comisión</th></tr></thead><tbody>
      ${filas.map(f => `<tr><td>${esc(f.tienda)}</td><td>${entero(f.altas)}</td><td>${entero(f.altas_nat)}</td><td>${entero(f.temm)}</td><td>${entero(f.cuota_total)}</td><td>${pct(f.alcance_total)}</td><td>${pct(f.alcance_temm)}</td><td>${dinero(f.comision_temm)}</td><td>${dinero(f.comision_prepago)}</td><td>${dinero(f.comision)}</td></tr>`).join('')}
      </tbody></table>
      <div class="total">Total a pagar: ${dinero(total)}</div>
      ${conDetalle ? `<h3>Detalle de líneas (${lineas.length})</h3><table><thead><tr><th>DN</th><th>Tienda</th><th>Fecha registro</th><th>Fecha alta</th><th>Producto</th><th>Estatus</th><th>Motivo</th><th>Comisión</th></tr></thead><tbody>
        ${lineas.map(l => `<tr><td>${esc(l.dn)}</td><td>${esc(l.tienda)}</td><td>${fecha(l.fecha_registro)}</td><td>${fecha(l.fecha_alta)}</td><td>${esc(l.producto)}</td><td>${esc(l.estatus)}</td><td>${esc(l.motivo || '')}</td><td>${dinero(l.comision)}</td></tr>`).join('')}
        </tbody></table>` : ''}
      <div class="pie">Para cualquier aclaración comunícate con tu supervisor antes del cierre de pago. Grupo Benber.</div></div>`;
  });
  $('#imprimir').innerHTML = hojas.join('');
  setTimeout(() => window.print(), 300);
}

async function pLineas() {
  const li = await cargar('lineas');
  const acl = await cargar('aclaraciones'), yaAcl = new Set(acl.map(a => String(a.dn)));
  const t = tabla({
    filas: li, filtros: ['grupo', 'estatus', 'gerente', 'supervisor', 'cadena'], exportar: 'Lineas',
    nota: '"Habría pagado" es una estimación de lo que la línea pagaría si Telefónica la hubiera validado.',
    cols: [
      { k: 'dn', t: 'DN' }, { k: 'tienda', t: 'Tienda' }, { k: 'idpdv', t: 'IDPDV' }, { k: 'promotor', t: 'Promotor' }, { k: 'usuario_fw', t: 'Usuario FW' },
      { k: 'gerente', t: 'Gerente' }, { k: 'supervisor', t: 'Supervisor' }, { k: 'cadena', t: 'Cadena' },
      { k: 'grupo', t: 'Grupo', html: f => f.grupo ? `<span class="badge ${GRUPO_CLASE[f.grupo] || 'b-gr'}">${esc(f.grupo)}</span>` : '' },
      { k: 'estatus', t: 'Estatus' }, { k: 'motivo', t: 'Motivo' }, { k: 'producto', t: 'Producto' },
      { k: 'fecha_registro', t: 'Fecha registro', tipo: 'f' }, { k: 'fecha_alta', t: 'Fecha alta', tipo: 'f' }, { k: 'monto', t: 'Monto alta', tipo: '$' },
      { k: 'comision', t: 'Comisión', tipo: '$' }, { k: 'potencial', t: 'Habría pagado', tipo: '$' },
      { k: '_acl', t: '', soloPantalla: true, html: f => f.dn == null ? '' : yaAcl.has(String(f.dn)) ? '<span class="badge b-az">En aclaración</span>' : `<button class="mini" data-dn="${esc(f.dn)}">Aclarar</button>` },
    ],
    alPintar: tb => tb.querySelectorAll('button[data-dn]').forEach(b => b.onclick = async () => {
      const f = li.find(x => String(x.dn) === b.dataset.dn);
      const nota = prompt(`Aclaración del DN ${f.dn} (${f.tienda}). Escribe el motivo:`, f.motivo || '');
      if (nota === null) return;
      const fila = { semana: SEM.semana, dn: f.dn, idpdv: f.idpdv, gerente: f.gerente, supervisor: f.supervisor, motivo: f.motivo || f.estatus, monto: f.potencial, nota, estado: 'Pendiente' };
      const { error } = await sb.from('com_aclaraciones').insert(fila);
      if (error) { setEstado(error.message, true); return; }
      acl.push(fila); yaAcl.add(String(f.dn)); t.redibujar(); setEstado('Aclaración registrada');
    }),
  });
  return t;
}

async function pTiendas() {
  const ti = (await cargar('tiendas')).map(f => Object.assign({}, f.datos || {}, f));
  return tabla({
    filas: ti, filtros: ['gerente', 'supervisor', 'cadena'], exportar: 'Tiendas',
    nota: 'Altas contra registros y contra la proforma de Telefónica, y las tres cuotas. "Proforma > original": Telefónica pagó con una cuota más alta que la oficial; revisar para aclaración.',
    cols: [
      { k: 'idpdv', t: 'IDPDV' }, { k: 'tienda', t: 'Tienda' }, { k: 'cadena', t: 'Cadena' }, { k: 'gerente', t: 'Gerente' }, { k: 'supervisor', t: 'Supervisor' },
      { k: 'RegistrosTotales', t: 'Registros', tipo: 'n' }, { k: 'AltasTotales', t: 'Altas', tipo: 'n' }, { k: 'AltasProforma', t: 'Altas proforma', tipo: 'n' },
      { k: 'DifProforma', t: 'Dif. vs proforma', tipo: 'n' }, { k: 'AltasNaturales', t: 'Altas nat.', tipo: 'n' },
      { k: 'ModoCuota', t: 'Cuota usada' }, { k: 'CuotaTotalBenber', t: 'Cuota usada (total)', tipo: 'n' },
      { k: 'CuotaTotalOriginal', t: 'Cuota original', tipo: 'n' }, { k: 'CuotaTotalAgencia', t: 'Cuota Benber', tipo: 'n' }, { k: 'CuotaTotalProforma', t: 'Cuota proforma', tipo: 'n' },
      { k: 'CuotaTemmBenber', t: 'Temm usada', tipo: 'n' }, { k: 'CuotaTemmOriginal', t: 'Temm original', tipo: 'n' }, { k: 'CuotaTemmAgencia', t: 'Temm Benber', tipo: 'n' }, { k: 'CuotaTemmProforma', t: 'Temm proforma', tipo: 'n' },
      { k: 'ProformaMayor', t: 'Proforma > original', html: f => f.ProformaMayor ? '<span class="badge b-no">Sí</span>' : '' },
      { k: 'AlcanceTotalBenber', t: '% Alcance', tipo: '%' }, { k: 'AlcanceTemmBenber', t: '% Alcance Temm', tipo: '%' },
      { k: 'Comision final', t: 'Com. cuota final', tipo: '$' }, { k: 'Comision original', t: 'Com. cuota original', tipo: '$' }, { k: 'Comision benber', t: 'Com. cuota Benber', tipo: '$' },
      { k: 'Observaciones', t: 'Observaciones' },
    ],
  });
}

async function pAclaraciones() {
  const acl = await cargar('aclaraciones'), admin = es('admin');
  const ti = Object.fromEntries((await cargar('tiendas')).map(t => [t.idpdv, t.tienda]));
  acl.forEach(a => a.tienda = ti[a.idpdv] || '');
  const t = tabla({
    filas: acl, filtros: ['estado', 'motivo', 'gerente', 'supervisor'], exportar: 'Aclaraciones',
    nota: admin ? 'Cambia el estado o la nota y se guarda al momento. "Descargar Excel" baja lo filtrado para enviarlo a Telefónica.'
      : 'Líneas en aclaración con Telefónica. Para levantar una nueva, ve a Líneas (DN) y usa "Aclarar".',
    cols: [
      { k: 'dn', t: 'DN' }, { k: 'idpdv', t: 'IDPDV' }, { k: 'tienda', t: 'Tienda' }, { k: 'gerente', t: 'Gerente' }, { k: 'supervisor', t: 'Supervisor' },
      { k: 'motivo', t: 'Motivo' }, { k: 'monto', t: 'Monto estimado', tipo: '$', html: f => f.monto ? dinero(f.monto) : '' },
      { k: 'estado', t: 'Estado', html: f => admin ? `<select data-e="${esc(f.dn)}">${ESTADOS_ACL.map(e => `<option${e === f.estado ? ' selected' : ''}>${e}</option>`).join('')}</select>` : `<span class="badge ${CLASE_ACL[f.estado]}">${esc(f.estado)}</span>` },
      { k: 'nota', t: 'Nota', html: f => admin ? `<input data-n="${esc(f.dn)}" value="${esc(f.nota)}" style="width:260px">` : esc(f.nota) },
      { k: 'actualizado_en', t: 'Actualizado', tipo: 'f' },
    ],
    alPintar: tb => {
      if (!admin) return;
      const guardar = async (dn, cambio) => {
        const { error } = await sb.from('com_aclaraciones').update(Object.assign(cambio, { actualizado_en: new Date().toISOString() })).eq('semana', SEM.semana).eq('dn', dn);
        if (error) return setEstado(error.message, true);
        Object.assign(acl.find(a => String(a.dn) === String(dn)), cambio); setEstado('Guardado');
      };
      tb.querySelectorAll('select[data-e]').forEach(s => s.onchange = () => guardar(s.dataset.e, { estado: s.value }));
      tb.querySelectorAll('input[data-n]').forEach(i => i.onchange = () => guardar(i.dataset.n, { nota: i.value }));
    },
  });
  return t;
}

async function pOperativos() {
  const op = (await cargar('operativos')).filter(f => f.nivel !== 'piso').map(f => Object.assign({}, f.datos || {}, f));
  return tabla({
    filas: op, filtros: ['nivel', 'gerente'], exportar: 'Operativos',
    cols: [
      { k: 'nivel', t: 'Nivel' }, { k: 'nombre', t: 'Nombre' }, { k: 'gerente', t: 'Gerente' },
      { k: 'Altas Totales Naturales', t: 'Altas nat.', tipo: 'n' }, { k: 'Cuota Total Sem', t: 'Cuota', tipo: 'n' }, { k: '% Alcance Total', t: '% Alcance', tipo: '%' },
      { k: '% Alcance Temm', t: '% Alcance Temm', tipo: '%' }, { k: '% Alcance Porta', t: '% Alcance Porta', tipo: '%' },
      { k: 'Candado Comision', t: 'Candado', html: f => f['Candado Comision'] ? `<span class="badge ${/^NO/i.test(f['Candado Comision']) ? 'b-no' : 'b-ok'}">${esc(f['Candado Comision'])}</span>` : '' },
      { k: 'Comision General', t: 'Com. general', tipo: '$' }, { k: 'Comision Temm', t: 'Com. Temm', tipo: '$' }, { k: 'Comision Porta', t: 'Com. Porta', tipo: '$' },
      { k: 'comision', t: 'Comisión final', tipo: '$' },
    ],
  });
}

async function pNomina() {
  const pr = await cargar('promotores'), op = await cargar('operativos');
  const m = new Map();
  pr.filter(f => f.usuario_fw && f.usuario_fw !== 'NO REGISTRO').forEach(f => {
    const k = 'P|' + f.usuario_fw, x = m.get(k) || { tipo: 'Promotor', nombre: f.promotor, usuario_fw: f.usuario_fw, gerente: f.gerente, supervisor: f.supervisor, tiendas: 0, comision: 0 };
    x.tiendas++; x.comision += f.comision || 0; m.set(k, x);
  });
  op.filter(f => f.nivel !== 'piso').forEach(f => m.set('O|' + f.nivel + f.nombre, { tipo: f.nivel[0].toUpperCase() + f.nivel.slice(1), nombre: f.nombre, usuario_fw: '', gerente: f.gerente, supervisor: f.supervisor, tiendas: null, comision: f.comision || 0 }));
  const filas = [...m.values()].map(x => Object.assign(x, { comision: Math.round(x.comision * 100) / 100 }));
  const total = filas.reduce((a, f) => a + f.comision, 0);
  const t = tabla({
    filas, filtros: ['tipo', 'gerente'], exportar: 'Nomina comisiones',
    nota: `Monto a pagar por persona (suma de todas sus tiendas). Total ${dinero(total)}.` + (SEM.estado === 'previo' ? ' <b class="ambar">La semana sigue en PREVIO.</b>' : ''),
    cols: [{ k: 'tipo', t: 'Tipo' }, { k: 'nombre', t: 'Nombre' }, { k: 'usuario_fw', t: 'Usuario FW' }, { k: 'gerente', t: 'Gerente' }, { k: 'supervisor', t: 'Supervisor' },
      { k: 'tiendas', t: 'Tiendas', tipo: 'n' }, { k: 'comision', t: 'A pagar', tipo: '$' }],
  });
  return t;
}

/* ---------- arranque ---------- */
async function elegirSemana(s) {
  SEM = SEMANAS.find(x => x.semana === s); DATOS = {};
  try { localStorage.setItem('gb_com_portal_semana', s); } catch (e) { }
  const [t, c] = ESTADOS_SEM[SEM.estado];
  $('#semInfo').innerHTML = `${esc(SEM.rango)} · <span class="badge ${c}">${t}</span> · cuota ${esc(CUOTAS[SEM.cuota])}`;
  $('#estadoSem').value = SEM.estado;
  $('#sub').textContent = `Semana ${SEM.semana} · ${SEM.rango}`;
  $('#cards').innerHTML = '';
  await abrirTab(PESTANAS.find(p => p.id === activa && es(...p.roles)) ? activa : 'resumen');
}

async function entrar() {
  const { data: { user } } = await sb.auth.getUser();
  const { data: yo, error: e1 } = await sb.rpc('com_yo');      // admin de RH GB = admin aquí; los demás según com_accesos
  if (e1) throw new Error(e1.message);
  const acc = yo && yo.rol ? yo : null;
  $('#usuario').innerHTML = `<span>${esc(yo?.nombre || user.email.split('@')[0])}${acc ? ' · ' + ROLES[acc.rol] : ''}</span><button id="salir">Salir</button>`;
  $('#salir').onclick = async () => { await sb.auth.signOut(); location.reload(); };
  if (!acc) return ver('sinAcceso');
  YO = acc; ver('portal');
  $('#admEstado').classList.toggle('oculto', YO.rol !== 'admin');
  const { data, error } = await sb.from('com_semanas').select('*').order('semana', { ascending: false });
  if (error) return setEstado(error.message, true);
  SEMANAS = data;
  if (!SEMANAS.length) { $('#panels').innerHTML = '<div class="panel vacio">Todavía no hay semanas publicadas.</div>'; return; }
  $('#semana').innerHTML = SEMANAS.map(s => `<option value="${esc(s.semana)}">${esc(s.semana)} · ${esc(s.rango)}</option>`).join('');
  let g = null; try { g = localStorage.getItem('gb_com_portal_semana'); } catch (e) { }
  const ini = SEMANAS.some(s => s.semana === g) ? g : SEMANAS[0].semana;
  $('#semana').value = ini;
  $('#semana').onchange = e => elegirSemana(e.target.value);
  $('#estadoSem').onchange = async e => {
    const nuevo = e.target.value;
    if (!confirm(`¿Marcar la semana ${SEM.semana} como ${ESTADOS_SEM[nuevo][0]}?`)) { e.target.value = SEM.estado; return; }
    const { error } = await sb.from('com_semanas').update({ estado: nuevo }).eq('semana', SEM.semana);
    if (error) { setEstado(error.message, true); e.target.value = SEM.estado; return; }
    SEM.estado = nuevo; elegirSemana(SEM.semana);
  };
  await elegirSemana(ini);
}

(async () => {
  $('#logo').src = window.GB_LOGO || '';
  sb = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: true, autoRefreshToken: true } });
  $('#fLogin').onsubmit = async e => {
    e.preventDefault(); $('#lErr').textContent = '';
    const u = $('#lUser').value, email = u.includes('@') ? u : u.trim().toLowerCase() + CFG.dominio;
    const { error } = await sb.auth.signInWithPassword({ email, password: $('#lPass').value });
    if (error) { $('#lErr').textContent = 'Usuario o contraseña incorrectos'; return; }
    $('#lPass').value = ''; entrar().catch(x => setEstado(x.message, true));
  };
  const { data } = await sb.auth.getSession();
  if (data.session) entrar().catch(x => setEstado(x.message, true)); else ver('login');
})();
