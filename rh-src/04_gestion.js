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
  { k: 'vacantes', ic: '🏬', n: 'Vacantes', mod: 'vacantes', f: vVacantes, per: true },
  { k: 'sep', n: 'Gestión', sep: true },
  { k: 'ingresos', ic: '🧑‍💼', n: 'Posibles ingresos', mod: 'posibles_ingresos', f: vIngresos, per: 'libre' },
  { k: 'altas', ic: '🆕', n: 'Altas', mod: 'colaboradores', f: vAltas },
  { k: 'expedientes', ic: '🗂️', n: 'Expedientes', mod: 'expedientes', f: vExpedientes },
  { k: 'bandeja', ic: '🚨', n: 'Posibles bajas', mod: 'alertas', f: vBandeja },
  { k: 'vigentes', ic: '🩺', n: 'Motivos de ausencia', mod: 'ausencias', f: vAusencias, per: 'libre' },
  { k: 'bajas', ic: '📤', n: 'Bajas y encuesta', mod: 'bajas', f: vBajas, per: 'libre' },
  { k: 'finiquitos', ic: '🧾', n: 'Finiquitos', mod: 'finiquitos', f: vFiniquitos },
  { k: 'nomina', ic: '💵', n: 'Nómina', mod: 'nomina', f: vNomina, sinFiltros: true },
  { k: 'sueldos', ic: '💳', n: 'Sueldos y bancarios', mod: 'sueldos', f: vSueldos, sinFiltros: true, oculto: true },
  { k: 'usuarios', ic: '👤', n: 'Usuarios y acceso', mod: 'usuarios', f: vUsuarios, sinFiltros: true },
  { k: 'auditoria', ic: '🧾', n: 'Auditoría', mod: 'auditoria', f: vAuditoria, sinFiltros: true }
];

function nav() {
  $('nav').innerHTML = VISTAS.filter(v => !v.oculto && (v.sep || can(v.mod, 'ver'))).map(v => v.sep ? `<div class="nav-sep">${v.n}</div>` : `<div class="nav-item ${v.k === S.view ? 'active' : ''} ${v.soon ? 'off' : ''}" ${v.soon ? '' : `onclick="ir('${v.k}')"`}><span class="ic">${v.ic}</span>${v.n}${v.soon ? '<span class="soon">pronto</span>' : ''}${v.k === 'vacantes' && S.vacBadge ? `<span class="nav-badge" title="Compromisos de cobertura vencidos o que vencen en 3 días">${S.vacBadge}</span>` : ''}</div>`).join('');
}
function ir(k) { S.view = k; $('sidebar').classList.remove('open'); nav(); render(); window.scrollTo(0, 0); }
function render() { const v = VISTAS.find(x => x.k === S.view); if (typeof exportClases === 'function') exportClases(); if (typeof fbPintar === 'function') fbPintar(); if (v && v.f) v.f(); }
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
  else {
    const gs = new Map(); f.slice(0, 300).forEach(a => { const k = (tienda(a.idpdv) || {}).supervisor || 'Sin supervisor'; if (!gs.has(k)) gs.set(k, []); gs.get(k).push(a); });
    h += `<div id="baj-lista" class="err-dia">${[...gs].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'es')).map(([sup, xs]) => `<div class="err-sup"><h4>🧭 ${esc(sup)} <small>${xs.length} caso${xs.length === 1 ? '' : 's'}</small></h4><div class="list"><div class="al head"><span>Promotor</span><span>Tienda</span><span>Sin check</span><span>Último check</span><span>Últimos 90 días</span><span></span></div>${xs.map(filaAlerta).join('')}</div></div>`).join('')}</div>${f.length > 300 ? '<p class="muted">Mostrando 300; usa los filtros para acotar.</p>' : ''}`;
  }
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
  if (tipo === 'baja') { bajaNueva({ usuario_fieldwy: a.usuario, nombre: a.nombre, idpdv: a.idpdv, empresa: a.empresa, estatus: 'Activo', ultimo: a.ultimo }); return; }
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

