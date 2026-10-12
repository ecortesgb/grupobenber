/* ====================================================================== MOTIVOS DE AUSENCIA ======================================================================
   Actuales: ausencias vigentes y captura de una nueva buscando a cualquier persona del HC (sin necesitar una posible baja).
   Histórico: cualquier ausencia del periodo elegido arriba, vigente o no. Resumen: motivos, comparativo semanal, promotores con más ausencias y vista por supervisor / gerente.
   El sistema considera las ausencias vigentes para no generar posibles bajas incorrectas. */
const AU = { tab: 'actuales', lista: [], rng: null };
const AU_MI = { 'Vacaciones': '🏖️', 'Incapacidad (IMSS)': '🏥', 'Permiso especial': '📝', 'Tema médico (particular)': '🩺', 'No localizado': '❓' };
Real.ausHist = async function (d, h) {
  const r = await todo(() => sb.from('ausencias').select('id,usuario_fieldwy,motivo,fecha_inicio,dias,fecha_regreso,comentarios,idpdv,colaboradores(nombre,idpdv)').lt('fecha_inicio', addD(h, 1)).gt('fecha_regreso', d).neq('motivo', 'Descanso').order('fecha_inicio', { ascending: false }));
  return r.map(a => ({ id: a.id, usuario: a.usuario_fieldwy, nombre: a.colaboradores?.nombre || a.usuario_fieldwy, motivo: a.motivo, inicio: a.fecha_inicio, dias: a.dias, regreso: a.fecha_regreso, idpdv: a.idpdv || a.colaboradores?.idpdv, comentarios: a.comentarios }));
};
Real.ausNueva = async function (d) { return Real.finRpc('registrar_ausencia', { p_usuario: d.usuario, p_motivo: d.motivo, p_inicio: d.inicio, p_dias: d.dias, p_comentarios: d.comentarios || null }); };
Demo.ausHist = async function (d, h) {
  const t = Object.values(S.cat.tiendas), mots = ['Vacaciones', 'Incapacidad (IMSS)', 'Permiso especial', 'Tema médico (particular)', 'No localizado'], out = [];
  for (let i = 0; i < 90; i++) { const ini = addD(HOY, -((i * 7) % 85)), dias = 1 + (i % 9), x = t[i % t.length]; out.push({ id: 'h' + i, usuario: 'DEMO' + (100 + (i % 40)), nombre: 'Promotor Demo ' + (i % 40), motivo: mots[i % 5], inicio: ini, dias, regreso: addD(ini, dias), idpdv: x.idpdv, comentarios: '' }); }
  return out.filter(a => a.inicio <= h && a.regreso > d).concat((S.vigentes || []).filter(v => v.inicio <= h && v.regreso > d));
};
Demo.ausNueva = async function (d) { const c = (await Demo.buscarColab(d.usuario))[0] || {}; await Demo.registrarAusencia({ id: 0, usuario: d.usuario, nombre: c.nombre || d.usuario, idpdv: c.idpdv }, d); };

async function asegurarAus(d, h) {
  d = d < '2023-12-01' ? '2023-12-01' : d; h = h > addD(HOY, 400) ? addD(HOY, 400) : h;
  const w8 = addD(HOY, -63); if (d > w8) d = w8;             // el comparativo semanal usa las últimas 9 semanas
  if (AU.rng && d >= AU.rng[0] && h <= AU.rng[1]) return;
  const nd = AU.rng ? (d < AU.rng[0] ? d : AU.rng[0]) : d, nh = AU.rng ? (h > AU.rng[1] ? h : AU.rng[1]) : h;
  AU.lista = await API.ausHist(nd, nh); AU.rng = [nd, nh];
}
const enPeriodoAus = (a, r) => a.inicio <= r.hasta && a.regreso > r.desde;
async function vAusencias() {
  $('content').innerHTML = cab('Motivos de ausencia', 'Registra ausencias de cualquier persona del HC, consulta las anteriores y mira qué motivos y qué zonas concentran más ausentismo.', 'mochila') + '<div class="loading">Cargando…</div>';
  const r = rangoLibre();
  try { if (AU.tab === 'actuales') S.vigentes = await API.vigentes(); await asegurarAus(r.desde, r.hasta); } catch (e) { $('content').innerHTML += `<div class="warn">No se pudo cargar: ${esc(e.message || e)}</div>`; return; }
  const ok = a => okT(tienda(a.idpdv) || null) || (!tienda(a.idpdv) && !Object.values(FL).some(Boolean));
  let h = cab('Motivos de ausencia', 'Registra ausencias de cualquier persona del HC, consulta las anteriores y mira qué motivos y qué zonas concentran más ausentismo.', 'mochila');
  const vig = S.vigentes.map(v => ({ ...v, faltan: diffD(v.regreso, HOY), t: tienda(v.idpdv) || {} })).filter(ok);
  const T = [['actuales', '🩺 Actuales', vig.length], ['historico', '📜 Histórico', null], ['resumen', '📊 Resumen gráfico', null]];
  h += `<div class="tools" data-nocap>${T.map(([k, n, c]) => `<button class="chip ${AU.tab === k ? 'on' : ''}" onclick="AU.tab='${k}';vAusencias()">${n}${c != null ? ' (' + c + ')' : ''}</button>`).join('')}${can('ausencias', 'crear') ? '<button class="btn primary" onclick="ausNueva()">➕ Nueva ausencia</button>' : ''}</div>`;
  TB = {};
  const mots = [...new Set(AU.lista.map(a => a.motivo).concat(S.vigentes.map(a => a.motivo)))].sort();
  const colsBase = (xs) => [{ h: 'Usuario', t: 1, v: x => x.usuario, w: 112 }, { h: 'Promotor', t: 1, v: x => x.nombre, w: 210, r: x => `<b>${esc(x.nombre)}</b>` }, { h: 'Motivo', t: 1, v: x => x.motivo, r: x => `<span class="pill b">${AU_MI[x.motivo] || ''} ${esc(x.motivo)}</span>` },
    { h: 'Inicio', v: x => x.inicio, r: x => fdate(x.inicio) }, { h: 'Días', v: x => x.dias }, { h: 'Regresa', v: x => x.regreso, r: x => fdate(x.regreso) }];
  const loc = [{ h: 'Tienda', t: 1, v: x => x.t.nombre || '' }, { h: 'Estado', t: 1, v: x => x.t.estado }, { h: 'Supervisor', t: 1, v: x => x.t.supervisor }, { h: 'Gerente', t: 1, v: x => x.t.gerente }, { h: 'Gerencia RR.HH.', t: 1, v: x => x.t.zona_rrhh }, { h: 'RR.HH.', t: 1, v: x => x.t.rrhh }, { h: 'Comentarios', t: 1, v: x => x.comentarios || '', w: 220 }];
  const filtroMot = `<div class="tools" data-nocap><span>Motivo:</span><select onchange="S.f.mot=this.value;vAusencias()"><option value="">Todos</option>${mots.map(m => `<option ${S.f.mot === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></div>`;
  if (AU.tab === 'actuales') {
    const rows = vig.filter(v => !S.f.mot || v.motivo === S.f.mot).sort((a, b) => a.faltan - b.faltan), porMot = {}; rows.forEach(x => porMot[x.motivo] = (porMot[x.motivo] || 0) + 1);
    h += `<div class="kpis"><div class="kpi"><div class="l">🩺 Vigentes</div><div class="v">${fmt(rows.length)}</div><div class="s">hoy</div></div>${Object.entries(porMot).map(([m, c]) => `<div class="kpi"><div class="l">${AU_MI[m] || ''} ${esc(m)}</div><div class="v">${c}</div></div>`).join('')}<div class="kpi"><div class="l">⏰ Regresan en ≤ 3 días</div><div class="v" style="color:var(--orange-n)">${rows.filter(x => x.faltan <= 3).length}</div></div></div>` + filtroMot +
      tbl('t-aus-a', [...colsBase(), { h: 'Faltan', v: x => x.faltan, r: x => `<span class="pill ${x.faltan <= 0 ? 'r' : x.faltan <= 3 ? 'a' : 'x'}">${x.faltan <= 0 ? '⏰ hoy' : x.faltan + ' d'}</span>` }, ...loc], rows, { fix: 2, search: 1, csv: 1, png: 1, file: 'ausencias_vigentes', titulo: 'Ausencias vigentes', sort: 6, dir: 1, maxh: '65vh' });
  } else {
    const base = AU.lista.map(a => ({ ...a, t: tienda(a.idpdv) || {} })).filter(ok).filter(a => enPeriodoAus(a, r) && (!S.f.mot || a.motivo === S.f.mot));
    if (AU.tab === 'historico') h += `<div class="kpis"><div class="kpi"><div class="l">Ausencias del periodo</div><div class="v">${fmt(base.length)}</div><div class="s">${fmt(new Set(base.map(a => a.usuario)).size)} promotores · ${fmt(base.reduce((s, a) => s + a.dias, 0))} días</div></div></div>` + filtroMot +
      tbl('t-aus-h', [...colsBase(), { h: 'Estatus', t: 1, v: x => x.regreso > HOY && x.inicio <= HOY ? 'Vigente' : x.inicio > HOY ? 'Programada' : 'Concluida', r: x => x.regreso > HOY && x.inicio <= HOY ? pillx('Vigente', 'a') : x.inicio > HOY ? pillx('Programada', 'b') : pillx('Concluida', 'x') }, ...loc], base, { fix: 2, search: 1, csv: 1, png: 1, file: 'ausencias_historico', titulo: 'Histórico de ausencias · ' + (r.desde === r.hasta ? fdate(r.desde) : fdate(r.desde) + ' al ' + fdate(r.hasta)), sort: 3, dir: -1, maxh: '65vh', lim: 600 });
    else h += ausResumenHTML(base, ok, r);
  }
  $('content').innerHTML = h; drawAll();
}
function ausResumenHTML(base, ok, r) {
  const por = (xs, kf) => { const m = new Map(); xs.forEach(x => { const k = kf(x); const o = m.get(k) || { n: 0, d: 0, u: new Set() }; o.n++; o.d += x.dias; o.u.add(x.usuario); m.set(k, o); }); return m; };
  const mot = por(base, a => a.motivo), COL = { 'Vacaciones': C.bl, 'Incapacidad (IMSS)': C.rd, 'Permiso especial': C.am, 'Tema médico (particular)': C.pu, 'No localizado': C.dk };
  let h = `<div class="kpis"><div class="kpi"><div class="l">Ausencias</div><div class="v">${fmt(base.length)}</div><div class="s">${esc(r.desde === r.hasta ? fdate(r.desde) : fdate(r.desde) + ' al ' + fdate(r.hasta))}</div></div><div class="kpi"><div class="l">Promotores con ausencia</div><div class="v">${fmt(new Set(base.map(a => a.usuario)).size)}</div></div><div class="kpi"><div class="l">Días de ausencia</div><div class="v">${fmt(base.reduce((s, a) => s + a.dias, 0))}</div></div></div>`;
  // comparativo semanal: ausencias que iniciaron en cada una de las últimas 9 semanas
  const sems = []; for (let k = 8; k >= 0; k--) { const l = addD(lunesDe(HOY), -7 * k); sems.push({ l, f: addD(l, 6) }); }
  const todas = AU.lista.map(a => ({ ...a, t: tienda(a.idpdv) || {} })).filter(ok).filter(a => !S.f.mot || a.motivo === S.f.mot), motsAll = [...new Set(todas.map(a => a.motivo))].sort();
  h += `<div class="grid g2"><div class="card"><h3>📈 Comparativo semanal · ausencias que iniciaron</h3><p class="note">Últimas 9 semanas, por motivo.</p>${legend(motsAll.map(m => [m, COL[m] || C.gy]))}${chart(sems.map(s => fdate(s.l).slice(0, 5)), motsAll.map(m => ({ n: m, c: COL[m] || C.gy, v: sems.map(s => todas.filter(a => a.motivo === m && a.inicio >= s.l && a.inicio <= s.f).length) })), { bars: 1, stack: 1, vals: 1, h: 300, ticks: 16 })}</div>
    <div class="card"><h3>🧩 Motivos del periodo</h3>${donut([...mot].sort((a, b) => b[1].n - a[1].n).map(([k, o]) => ({ n: (AU_MI[k] || '') + ' ' + k, v: o.n, c: COL[k] || C.gy })), { sub: 'ausencias' })}</div></div>`;
  const tp = por(base, a => a.usuario + '|' + a.nombre), top = [...tp].sort((a, b) => b[1].n - a[1].n || b[1].d - a[1].d).slice(0, 12);
  h += `<div class="grid g2"><div class="card"><h3>🧍 Promotores con más ausencias</h3>${hbars(top.map(([k, o]) => ({ n: k.split('|')[1], v: o.n, c: C.am, s: o.d + ' días' })), C.am)}</div>`;
  const ps = por(base, a => a.t.supervisor || 'Sin supervisor'), tsup = [...ps].sort((a, b) => b[1].n - a[1].n).slice(0, 12);
  h += `<div class="card"><h3>🧭 Supervisores con más ausentismo</h3>${hbars(tsup.map(([k, o]) => ({ n: k, v: o.n, c: C.rd, s: o.u.size + ' promotores · ' + o.d + ' d' })), C.rd)}</div></div>`;
  const pg = por(base, a => a.t.gerente || 'Sin gerente'), tg = [...pg].sort((a, b) => b[1].n - a[1].n).slice(0, 12), pt = por(base, a => a.t.cadena || 'Sin cadena');
  h += `<div class="grid g2"><div class="card"><h3>🧑‍💼 Por gerente</h3>${hbars(tg.map(([k, o]) => ({ n: k, v: o.n, c: C.bl, s: o.u.size + ' promotores' })), C.bl)}</div><div class="card"><h3>🔗 Por cadena</h3>${hbars([...pt].sort((a, b) => b[1].n - a[1].n).map(([k, o]) => ({ n: k, v: o.n, c: C.te, s: o.d + ' d' })), C.te)}</div></div>`;
  return h;
}

/* ---- nueva ausencia de cualquier persona del HC ---- */
function ausNueva(pre) {
  AU.sel = pre || null;
  $('modal').innerHTML = `<div class="mbox" style="width:min(560px,96vw)" role="dialog" aria-modal="true"><h3>🩺 Nueva ausencia</h3>
    <div class="fld"><label>Colaborador (usuario Fieldway o nombre)</label><input id="an-q" autocomplete="off" placeholder="Escribe al menos 3 letras…" oninput="ausBuscar(this.value)"></div><div id="an-res"></div><div id="an-sel"></div>
    <div id="an-resto" hidden><div class="fld"><label>Motivo</label><select id="an-mot">${(S.cat.motAus || []).map(m => `<option>${esc(m)}</option>`).join('')}</select></div>
      <div class="row2"><div class="fld"><label>Primer día de ausencia</label><input type="date" id="an-ini" value="${HOY}"></div><div class="fld"><label>Días</label><input type="number" id="an-dias" min="1" max="365" value="1"></div></div>
      <div class="note" id="an-reg"></div><div class="fld"><label>Comentarios (folio de incapacidad, quién avisó…)</label><textarea id="an-com"></textarea></div></div>
    <div class="warn" id="an-warn" hidden></div><div class="mfoot"><button class="btn" onclick="cerrarM()">Cancelar</button><button class="btn primary" id="an-ok" disabled>Guardar ausencia</button></div></div>`;
  $('modal').hidden = false; $('modal').onclick = e => { if (e.target.id === 'modal') cerrarM(); };
  const calc = () => { const ini = $('an-ini').value, d = +$('an-dias').value; $('an-reg').textContent = ini && d ? `Regresa el ${fdate(addD(ini, d))} (${d} día${d > 1 ? 's' : ''} desde el ${fdate(ini)}).` : ''; };
  $('an-ini').oninput = calc; $('an-dias').oninput = calc; calc(); $('an-ok').onclick = ausGuardar;
  if (pre) ausElegir(pre); else setTimeout(() => $('an-q').focus(), 50);
}
function ausBuscar(q) {
  clearTimeout(AU.tm); const r = $('an-res'); if (limpiaQ(q).length < 3) { r.innerHTML = ''; return; }
  AU.tm = setTimeout(async () => {
    try { AU.res = await API.buscarColab(q); } catch (e) { r.innerHTML = `<div class="warn">${esc(e.message || e)}</div>`; return; }
    r.innerHTML = AU.res.length ? `<div class="bj-list">${AU.res.map((c, i) => { const t = tienda(c.idpdv) || {}; return `<div class="bj-it ${c.estatus === 'Baja' ? 'off' : ''}" onclick="ausElegir(AU.res[${i}])"><b>${esc(c.nombre)}</b><span>${esc(c.usuario_fieldwy)}</span><span>${esc(t.nombre || 'Sin tienda')}</span>${c.estatus === 'Baja' ? '<span class="pill r">Baja</span>' : '<span></span>'}</div>`; }).join('')}</div>` : '<p class="muted">Sin coincidencias.</p>';
  }, 280);
}
function ausElegir(c) {
  if (c.estatus === 'Baja') { toast('Esta persona está en baja: no se le registran ausencias'); return; }
  AU.sel = c; const t = tienda(c.idpdv) || {}; $('an-res').innerHTML = ''; $('an-q').value = '';
  $('an-sel').innerHTML = `<div class="bj-card"><div><b>${esc(c.nombre)}</b><br><small>${esc(c.usuario_fieldwy)} · ${esc(c.empresa || 'sin razón social')}</small></div><div><b>${esc(t.nombre || 'Sin tienda')}</b><br><small>${esc([t.cadena, t.estado, t.supervisor].filter(Boolean).join(' · '))}</small></div><button class="rsv" onclick="AU.sel=null;$('an-sel').innerHTML='';$('an-resto').hidden=true;$('an-ok').disabled=true">Cambiar</button></div>`;
  $('an-resto').hidden = false; $('an-ok').disabled = false;
}
async function ausGuardar() {
  const c = AU.sel; if (!c) return; const w = $('an-warn'), b = $('an-ok'); b.disabled = true; b.textContent = 'Guardando…';
  try { await API.ausNueva({ usuario: c.usuario_fieldwy, motivo: $('an-mot').value, inicio: $('an-ini').value, dias: +$('an-dias').value, comentarios: $('an-com').value }); cerrarM(); toast('Ausencia registrada: ' + c.nombre); AU.rng = null; S.alertas = (S.alertas || []).filter(x => x.usuario !== c.usuario_fieldwy); nav(); vAusencias(); }
  catch (e) { b.disabled = false; b.textContent = 'Guardar ausencia'; w.hidden = false; w.textContent = 'No se pudo guardar: ' + (e.message || e); }
}
