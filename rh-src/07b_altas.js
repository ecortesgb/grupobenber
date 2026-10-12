/* ====================================================================== ALTAS (nuevo ingreso) Y EXPEDIENTES ======================================================================
   Alta: sale de un candidato que "Ingresó" (precargado) o se captura directa. Crea el colaborador, el movimiento de alta, guarda los datos sensibles
   (tabla aparte: solo RH y administración, nunca en reportes) y abre los pendientes de Expediente, Datos bancarios y CSF a 7 días.
   Expedientes: semáforo de pendientes por colaborador; cada responsable ve los de su estado. */
const AL = { pend: null, ult: null, fases: [], emp: [], pre: null, tab: '', cs: null };
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
  try { return await q('usuario_fieldwy,nombre,empresa,idpdv,fecha_ingreso,tipo_ingreso,estatus,fase'); } catch (e) { return await q('usuario_fieldwy,nombre,empresa,idpdv,fecha_ingreso,estatus'); } // antes de correr schema_v08 no existe tipo_ingreso
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

/* ----- ALTAS por fases -----
   1 · Usuario Fieldway: nómina copia los datos del ingreso confirmado, escribe el usuario Fieldway y guarda (sin sueldo): la persona ya queda como ACTIVA en el HC.
   2 · Datos personales (RH)  3 · Datos bancarios (RH, se pueden omitir por ahora)  4 · Expediente (documentos).  Se puede capturar por fases o todo junto.
   Quien revisa aprueba o declina (con comentario) lo capturado y los documentos; lo declinado regresa a RH con un botón para corregir. Completo = todo aprobado. Siempre se puede regresar de fase. */
Real.altasFases = async function () { const { data, error } = await sb.rpc('altas_pendientes'); if (error) throw error; return data || []; };
Real.sensiblesDe = async function (u) { const { data, error } = await sb.from('datos_sensibles').select('*').eq('usuario_fieldwy', u).maybeSingle(); if (error) throw error; return data; };
Real.altaRegistrar = async function (a) { return Real.finRpc('alta_registrar', a); };
Real.altaCompletar = async function (a) { return Real.finRpc('alta_completar', a); };
Real.altaRegresar = async function (u, m) { return Real.finRpc('alta_regresar', { p_usuario: u, p_motivo: m }); };
Real.altaRevisar = async function (u, concepto, ap, com) { return Real.finRpc('alta_revisar', { p_usuario: u, p_concepto: concepto, p_aprobar: ap, p_comentario: com || null }); };
Real.perfilDe = async function (u) { const { data, error } = await sb.from('baja_perfil').select('*').eq('usuario_fieldwy', u).order('fecha_baja', { ascending: false }).limit(1); if (error) throw error; return (data || [])[0] || null; };
const DEMO_FASES = [];
Demo.altasFases = async () => DEMO_FASES.slice(); Demo.sensiblesDe = async () => ({ nombre_pila: 'JUAN', apellido_p: 'PEREZ', apellido_m: 'LOPEZ', fecha_nacimiento: '1995-03-14', genero: 'Hombre', curp: 'PELJ950314HJCRPN09', nss: '12345678901', talla: 'M', infonavit: false }); Demo.perfilDe = async () => null;
Demo.altaRegistrar = async a => { const c = (typeof DA !== 'undefined' && DA.c) ? DA.c.find(x => x.id === a.p_candidato) : null; if (c) c.usuario_fieldwy = a.p_usuario; DEMO_FASES.push({ usuario: String(a.p_usuario).toUpperCase(), nombre: c ? c.nombre : 'ALTA DIRECTA', empresa: a.p_empresa, idpdv: a.p_idpdv || (c && c.idpdv), fecha_ingreso: HOY, fase: 'Datos personales', bancarios_omitidos: false, curp_ok: false, nss_ok: false, talla_ok: false, infonavit_ok: false, banc_ok: false, expediente_ok: false, rev_personales: null, rev_bancarios: null }); return { usuario: a.p_usuario }; };
Demo.altaCompletar = async a => { const f = DEMO_FASES.find(x => x.usuario === a.p_usuario); const v = a.p_sens || {}; if (v.curp) f.curp_ok = true; if (v.nss) f.nss_ok = true; if (v.talla) f.talla_ok = true; if (v.infonavit != null && v.infonavit !== '') f.infonavit_ok = true; if (a.p_banc && a.p_banc.clabe) { f.banc_ok = true; f.rev_bancarios = 'Pendiente de revisión'; } if (a.p_omitir_banc) f.bancarios_omitidos = true;
  const pers = f.curp_ok && f.nss_ok && f.talla_ok && f.infonavit_ok; if (pers && !f.rev_personales) f.rev_personales = 'Pendiente de revisión'; if (f.fase === 'Datos personales' && pers) f.fase = 'Datos bancarios'; if (f.fase === 'Datos bancarios' && (f.banc_ok || f.bancarios_omitidos)) f.fase = 'Expediente';
  const faltan = []; if (!f.curp_ok) faltan.push('CURP'); if (!f.nss_ok) faltan.push('NSS'); if (!f.talla_ok) faltan.push('talla'); if (!f.infonavit_ok) faltan.push('Infonavit (sí/no)'); if (!f.banc_ok && !f.bancarios_omitidos) faltan.push('datos bancarios (captúralos u omítelos)'); return { fase: f.fase, faltan }; };
Demo.altaRegresar = async u => { const f = DEMO_FASES.find(x => x.usuario === u); f.fase = { 'Expediente': 'Datos bancarios', 'Datos bancarios': 'Datos personales' }[f.fase] || f.fase; return f.fase; };
Demo.altaRevisar = async (u, c, ap, com) => { const f = DEMO_FASES.find(x => x.usuario === u); const k = c === 'Datos personales' ? 'personales' : 'bancarios'; f['rev_' + k] = ap ? 'Aprobado' : 'Declinado'; f['com_' + k] = com; if (!ap) f.fase = c; return f.fase; };

const AL_TABS = [['usuario', '1 · Usuario Fieldway'], ['datos', '2 · Datos personales'], ['banc', '3 · Datos bancarios'], ['exp', '4 · Expediente'], ['rev', '🔎 Por revisar'], ['hist', '📜 Altas recientes']];
const FASEC = { 'Datos personales': ['a', '🟠 Datos personales'], 'Datos bancarios': ['a', '🟡 Datos bancarios'], 'Expediente': ['b', '🔵 Expediente'], 'Completo': ['g', '🟢 Completo'] };
const puedeUsuario = () => can('colaboradores', 'crear');   // nómina, analista y administrador
const faltanDe = f => [!f.curp_ok && 'CURP', !f.nss_ok && 'NSS', !f.talla_ok && 'Talla', !f.infonavit_ok && 'Infonavit', !f.banc_ok && !f.bancarios_omitidos && 'Bancarios'].filter(Boolean);
const revPill = (est, com) => est === 'Aprobado' ? pillx('✔ Aprobado', 'g') : est === 'Declinado' ? `${pillx('✖ Declinado', 'r')}${com ? `<br><small class="muted">${esc(com)}</small>` : ''}` : est ? pillx('En revisión', 'b') : '<span class="muted">—</span>';
async function vAltas() {
  $('content').innerHTML = cab('Altas · nuevo ingreso', 'Cada ingreso pasa por fases: usuario Fieldway, datos personales, datos bancarios y expediente. Quien revisa aprueba o declina lo capturado; RH corrige lo declinado. La persona ya es activa en el HC desde que tiene usuario.', 'mochila') + '<div class="loading">Cargando…</div>';
  try { [AL.pend, AL.fases, AL.ult] = await Promise.all([API.altasPend(), API.altasFases(), API.altasUltimas()]); } catch (e) { $('content').innerHTML += `<div class="warn">No se pudo cargar: ${esc(e.message || e)}</div>`; return; }
  AL.tab = AL.tab || (puedeUsuario() ? 'usuario' : 'datos');
  const ok = x => okT(tienda(x.idpdv) || null) || (!tienda(x.idpdv) && !Object.values(FL).some(Boolean));
  const pend = AL.pend.filter(ok), fas = AL.fases.filter(ok), enP = fas.filter(f => f.fase === 'Datos personales'), enB = fas.filter(f => f.fase === 'Datos bancarios'), enE = fas.filter(f => f.fase === 'Expediente'), ult = AL.ult.filter(ok);
  const porRev = fas.filter(f => f.rev_personales === 'Pendiente de revisión' || f.rev_bancarios === 'Pendiente de revisión'), declin = fas.filter(f => f.rev_personales === 'Declinado' || f.rev_bancarios === 'Declinado');
  const n = { usuario: pend.length, datos: enP.length, banc: enB.length, exp: enE.length, rev: porRev.length, hist: ult.length };
  let h = cab('Altas · nuevo ingreso', 'Cada ingreso pasa por fases: usuario Fieldway, datos personales, datos bancarios y expediente. Quien revisa aprueba o declina lo capturado; RH corrige lo declinado. La persona ya es activa en el HC desde que tiene usuario.', 'mochila');
  h += `<div class="kpis">${kp('Esperan usuario Fieldway', fmt(n.usuario), 'ingresos confirmados', n.usuario ? C.rd : C.gr, "AL.tab='usuario';vAltas()", '1️⃣')}${kp('Datos personales', fmt(n.datos), 'por capturar', n.datos ? C.am : C.gr, "AL.tab='datos';vAltas()", '2️⃣')}${kp('Datos bancarios', fmt(n.banc), 'por capturar u omitir', n.banc ? C.am : C.gr, "AL.tab='banc';vAltas()", '3️⃣')}${kp('Expediente', fmt(n.exp), 'documentos por aprobar', C.bl, "AL.tab='exp';vAltas()", '4️⃣')}${kp('Por revisar', fmt(n.rev), 'capturas esperando revisión', n.rev ? C.am : C.gr, "AL.tab='rev';vAltas()", '🔎')}${kp('Declinados', fmt(declin.length), 'RH debe corregirlos', declin.length ? C.rd : C.gr, null, '✖️')}</div>`;
  h += `<div class="tools">${AL_TABS.map(([k, t]) => `<button class="chip ${AL.tab === k ? 'on' : ''}" onclick="AL.tab='${k}';vAltas()">${t} (${n[k]})</button>`).join('')}${puedeUsuario() ? '<button class="btn primary" onclick="altaUsuario()">➕ Alta sin candidato</button>' : ''}</div>`;
  TB = {};
  const loc = [{ h: 'Tienda', t: 1, v: c => (tienda(c.idpdv) || {}).nombre || '' }, { h: 'Cadena', t: 1, v: c => (tienda(c.idpdv) || {}).cadena }, { h: 'Estado', t: 1, v: c => (tienda(c.idpdv) || {}).estado }, { h: 'Supervisor', t: 1, v: c => (tienda(c.idpdv) || {}).supervisor }, { h: 'RR.HH.', t: 1, v: c => (tienda(c.idpdv) || {}).rrhh }];
  const base = [{ h: 'Ingreso', v: c => c.fecha_ingreso, r: c => fdate(c.fecha_ingreso), w: 90 }, { h: 'Usuario', t: 1, v: c => c.usuario, w: 130, r: c => `<b>${esc(c.usuario)}</b>` }, { h: 'Colaborador', t: 1, v: c => c.nombre, w: 220, r: c => `<b>${esc(c.nombre)}</b>` }];
  const editaDatos = can('datos_sensibles', 'editar') || can('datos_sensibles', 'crear');
  const corregir = (c, concepto) => editaDatos ? `<button class="rsv" onclick="altaCompletar('${c.usuario}')">${(concepto === 'p' ? c.rev_personales : c.rev_bancarios) === 'Declinado' ? '✏️ Corregir' : 'Completar ›'}</button>` : '';
  if (AL.tab === 'usuario') h += sect('Ingresos confirmados que esperan su usuario Fieldway', '1️⃣') + `<p class="note">Salen de Posibles ingresos al confirmar que ingresaron. Quien genera usuarios copia los datos, escribe el usuario Fieldway y guarda: la persona pasa al HC como activa y RH la ve pendiente de datos personales.</p>` +
    tbl('t-alp', [{ h: 'Fecha de ingreso', v: c => c.fecha_programada, r: c => fdate(c.fecha_programada) + (c.hora_ingreso ? ' ' + hh5(c.hora_ingreso) : ''), w: 120 }, { h: 'Candidato', t: 1, v: c => c.nombre, w: 230, r: c => `<b>${esc(c.nombre)}</b>` }, { h: 'Teléfono', t: 1, v: c => c.telefono }, ...loc,
      { h: '', v: () => '', r: c => puedeUsuario() ? `<button class="rsv" onclick="altaUsuario('${c.id}')">Generar usuario ›</button>` : '<span class="muted">Lo genera nómina</span>' }], pend, { fix: 2, search: 1, csv: 1, png: 1, file: 'altas_esperan_usuario', titulo: 'Ingresos que esperan usuario Fieldway', sort: 0, dir: -1, maxh: '60vh' });
  else if (AL.tab === 'datos') h += sect('Datos personales por capturar', '2️⃣') + `<p class="note">CURP, NSS, talla e Infonavit (sí/no). Puedes guardar con lo que tengas y seguir después, o capturar también los datos bancarios en la misma ventana. Lo declinado por quien revisa aparece aquí con su comentario.</p>` +
    tbl('t-ald2', [...base, { h: 'Falta', t: 1, v: c => faltanDe(c).length, r: c => faltanDe(c).filter(x => x !== 'Bancarios').map(x => pillx(x, 'a')).join(' ') || pillx('Completo', 'g') }, { h: 'Revisión', t: 1, v: c => c.rev_personales || '', r: c => revPill(c.rev_personales, c.com_personales) }, { h: 'Razón social', t: 1, v: c => c.empresa }, ...loc, { h: '', v: () => '', r: c => corregir(c, 'p') }], enP, { fix: 3, search: 1, csv: 1, png: 1, file: 'altas_datos_personales', titulo: 'Altas · datos personales', sort: 0, dir: 1, maxh: '60vh' });
  else if (AL.tab === 'banc') h += sect('Datos bancarios por capturar', '3️⃣') + `<p class="note">Banco, titular y CLABE. Se pueden omitir por ahora (se completan después desde Expedientes). Sin CLABE no pasa a Completo.</p>` +
    tbl('t-ald3', [...base, { h: 'Bancarios', t: 1, v: c => c.banc_ok ? 1 : 0, r: c => c.banc_ok ? pillx('✔ Capturados', 'g') : pillx(c.bancarios_omitidos ? 'Omitidos' : 'Faltan', 'a') }, { h: 'Revisión', t: 1, v: c => c.rev_bancarios || '', r: c => revPill(c.rev_bancarios, c.com_bancarios) }, ...loc, { h: '', v: () => '', r: c => corregir(c, 'b') }], enB, { fix: 3, search: 1, csv: 1, png: 1, file: 'altas_datos_bancarios', titulo: 'Altas · datos bancarios', sort: 0, dir: 1, maxh: '60vh' });
  else if (AL.tab === 'exp') h += sect('En expediente', '4️⃣') + `<p class="note">Los documentos se cargan y aprueban en <b>Expedientes</b> (quien revisa aprueba o declina cada documento con comentario). Con todo aprobado y la CLABE capturada, sale de Altas y queda Completo.</p>` +
    tbl('t-alx', [...base, { h: 'Documentos', t: 1, v: c => c.expediente_ok ? 1 : 0, r: c => c.expediente_ok ? pillx('✔ Aprobados', 'g') : pillx('Pendientes', 'a') }, { h: 'Datos personales', t: 1, v: c => c.rev_personales || '', r: c => revPill(c.rev_personales, c.com_personales) }, { h: 'Datos bancarios', t: 1, v: c => c.banc_ok ? 1 : 0, r: c => c.banc_ok ? revPill(c.rev_bancarios, c.com_bancarios) : pillx(c.bancarios_omitidos ? 'Omitidos: faltan' : 'Faltan', 'r') }, ...loc,
      { h: '', v: () => '', r: c => `${can('expedientes', 'ver') ? `<button class="rsv" onclick="expedienteAbrir('${c.usuario}')">Expediente ›</button>` : ''} ${(c.rev_personales === 'Declinado' || (c.banc_ok === false && editaDatos)) && editaDatos ? `<button class="rsv" onclick="altaCompletar('${c.usuario}')">✏️ Corregir datos</button>` : ''} ${can('colaboradores', 'editar') ? `<button class="rsv" onclick="altaRegresar('${c.usuario}')">↩ Regresar de fase</button>` : ''}` }], enE, { fix: 3, search: 1, csv: 1, png: 1, file: 'altas_en_expediente', titulo: 'Altas en expediente', sort: 0, dir: 1, maxh: '60vh' });
  else if (AL.tab === 'rev') h += sect('Por revisar', '🔎') + `<p class="note">Capturas esperando que alguien las apruebe o declare. Al declinar se escribe el motivo: RH lo ve y corrige. Los documentos se revisan en Expedientes.</p>` +
    tbl('t-alr', [...base, { h: 'Fase', t: 1, v: c => c.fase, r: c => pillx(FASEC[c.fase][1], FASEC[c.fase][0]) }, { h: 'Datos personales', t: 1, v: c => c.rev_personales || '', r: c => revPill(c.rev_personales, c.com_personales) }, { h: 'Datos bancarios', t: 1, v: c => c.rev_bancarios || '', r: c => revPill(c.rev_bancarios, c.com_bancarios) }, ...loc,
      { h: '', v: () => '', r: c => `<button class="rsv" onclick="altaRevisar('${c.usuario}')">${can('alta_revision', 'editar') ? '🔎 Revisar ›' : '👁 Ver ›'}</button>` }], porRev, { fix: 3, search: 1, csv: 1, png: 1, file: 'altas_por_revisar', titulo: 'Altas por revisar', sort: 0, dir: 1, maxh: '60vh' });
  else h += sect('Altas recientes', '📜') + tbl('t-alu', [{ h: 'Ingreso', v: c => c.fecha_ingreso, r: c => fdate(c.fecha_ingreso), w: 96 }, { h: 'Usuario', t: 1, v: c => c.usuario_fieldwy, w: 130 }, { h: 'Colaborador', t: 1, v: c => c.nombre, r: c => `<b>${esc(c.nombre)}</b>` },
      { h: 'Fase', t: 1, v: c => c.fase || 'Completo', r: c => { const f = FASEC[c.fase || 'Completo']; return pillx(f[1], f[0]); } }, { h: 'Tipo', t: 1, v: c => c.tipo_ingreso || 'Nuevo' }, { h: 'Razón social', t: 1, v: c => c.empresa }, ...loc,
      ...(can('expedientes', 'ver') ? [{ h: '', v: () => '', r: c => `<button class="rsv" onclick="expedienteAbrir('${c.usuario_fieldwy}')">Expediente ›</button>` }] : [])], ult, { fix: 3, search: 1, csv: 1, png: 1, file: 'altas_recientes', titulo: 'Altas recientes', sort: 0, dir: -1, maxh: '60vh' });
  $('content').innerHTML = h; drawAll();
}
function tiendaOpts() { return Object.values(S.cat.tiendas).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es')).map(t => `<option value="${t.idpdv} · ${esc(t.nombre)} (${esc(t.cadena || '')} · ${esc(t.estado || '')})"></option>`).join(''); }

/* ---- fase 1: generar el usuario Fieldway (solo copiar datos y guardar; el sueldo lo define nómina después) ---- */
let AL_REC = null;
async function altaAvisoRec() {   // reingresos: si el usuario quedó como "No recontratable" o "Con reservas", se avisa antes de darlo de alta
  const u = mayus(limpia(($('au-us') || {}).value)), box = $('au-rec'); AL_REC = null; if (!box) return; box.innerHTML = ''; if (u.length < 6) return;
  try { const p = await API.perfilDe(u); if (!p) return; AL_REC = p; const r = PF_REC[p.recontratable];
    box.innerHTML = `<div class="${p.recontratable === 'Sí' ? 'note' : 'warn'}">${r[1]} Este usuario ya tuvo una baja el ${fdate(p.fecha_baja)}: <b>${p.recontratable === 'Sí' ? 'recontratable' : p.recontratable === 'No' ? 'NO recontratable' : 'recontratable con reservas'}</b>${p.nota ? ' · ' + esc(p.nota) : ''}${p.resumen && p.resumen.veredicto ? ` · desempeño: ${esc(p.resumen.veredicto)}` : ''}.</div>`; } catch (e) { }
}
const copiaBtn = t => `<button type="button" class="rsv" onclick="navigator.clipboard.writeText('${esc(String(t || '')).replace(/'/g, "\\'")}').then(()=>toast('Copiado'))" title="Copiar">📋</button>`;
async function altaUsuario(candId) {
  const c = candId ? AL.pend.find(x => x.id === candId) : null; AL.pre = c; let d = null;
  if (!AL.emp.length) { try { AL.emp = await API.empresas(); } catch (e) { } }
  if (c) { try { d = await API.datosCandidato(candId); } catch (e) { } if (!d) { toast('Este ingreso no tiene sus datos de identidad: confírmalos en Posibles ingresos'); return; } }
  const t = c ? tienda(c.idpdv) : null;
  const fila = (k, v) => `<tr><td class="t"><b>${k}</b></td><td class="t">${esc(v || '—')}</td><td>${v ? copiaBtn(v) : ''}</td></tr>`;
  const datos = c ? `<div class="tw"><table class="dt"><tbody>${fila('Nombre(s)', d.nombre_pila)}${fila('Apellido paterno', d.apellido_p)}${fila('Apellido materno', d.apellido_m)}${fila('Correo', d.correo)}${fila('Fecha de nacimiento', d.fecha_nacimiento && fdate(d.fecha_nacimiento))}${fila('Género', d.genero)}${fila('Estado civil', d.estado_civil)}${fila('RFC', d.rfc)}${fila('Teléfono', d.telefono)}${fila('Tienda', t ? c.idpdv + ' · ' + t.nombre : '')}${fila('Fecha de ingreso', fdate(c.fecha_programada) + (c.hora_ingreso ? ' ' + hh5(c.hora_ingreso) : ''))}</tbody></table></div>` :
    `<div class="note">Alta sin candidato: captura los mismos datos que pide Fieldway.</div>${identidadCampos(null, 'au-')}<div class="row2"><div class="fld"><label>Fecha de ingreso *</label><input type="date" id="au-f" value="${HOY}"></div><div class="fld"><label>Tienda *</label><input id="au-t" list="al-tl" placeholder="Escribe IDPDV o nombre…"><datalist id="al-tl">${tiendaOpts()}</datalist></div></div>`;
  $('modal').innerHTML = `<div class="mbox wide" style="width:min(860px,96vw);max-height:92vh;overflow:auto" role="dialog" aria-modal="true"><h3>1️⃣ Generar usuario Fieldway</h3>${c ? `<div class="who">${esc(c.nombre)} · ingresó el ${fdate(c.fecha_programada)}</div>` : ''}${datos}
    <div class="row2"><div class="fld"><label>Usuario Fieldway *</label><input id="au-us" autocomplete="off" style="text-transform:uppercase" placeholder="Ej. ABCD010203XYZ" onchange="altaAvisoRec()"></div><div class="fld"><label>Razón social (opcional)</label><input id="au-emp" list="au-el" placeholder="Ej. Benber SS"><datalist id="au-el">${AL.emp.map(e => `<option value="${esc(e)}">`).join('')}</datalist></div></div>
    <div id="au-rec"></div><div class="row2"><div class="fld"><label>¿Es reingreso?</label><select id="au-tipo"><option value="">No, es nuevo</option><option>Reingreso</option></select></div><div></div></div>
    <div class="note">Al guardar, la persona queda <b>activa en el HC</b> y RH la ve pendiente de datos personales. El sueldo lo define nómina después. Reingreso: usa el <b>mismo usuario Fieldway</b> que tenía (debe estar en baja); solo si no está cargado a la agencia, crea uno nuevo con <b>GB</b> al final.</div>
    <div class="warn" id="au-warn" hidden></div><div class="mfoot"><button class="btn" onclick="cerrarM()">Cancelar</button><button class="btn primary" id="au-ok">Guardar usuario</button></div></div>`;
  $('modal').hidden = false; $('modal').onclick = e => { if (e.target.id === 'modal') cerrarM(); };
  $('au-ok').onclick = () => altaUsuarioGuardar(candId);
}
async function altaUsuarioGuardar(candId) {
  const g = id => { const e = $('au-' + id); return e ? limpia(e.value) : ''; }, w = $('au-warn'), us = mayus(g('us')), e = [];
  let datos = null, fecha = null, idp = null;
  if (!candId) { datos = idLeer('au-'); e.push(...idErrores(datos)); fecha = g('f'); idp = parseInt(g('t'), 10); if (!fecha) e.push('Falta la fecha de ingreso.'); if (!idp || !tienda(idp)) e.push('Elige una tienda de la lista (empieza con su IDPDV).'); }
  if (!us) e.push('Falta el usuario Fieldway.');
  if (e.length) { w.hidden = false; w.innerHTML = e.map(esc).join('<br>'); return; }
  if (AL_REC && AL_REC.recontratable !== 'Sí' && AL_REC.usuario_fieldwy === us && !confirm('Este usuario quedó como ' + (AL_REC.recontratable === 'No' ? 'NO recontratable' : 'recontratable con reservas') + (AL_REC.nota ? ' (' + AL_REC.nota + ')' : '') + '.\n¿Confirmas que quieres darlo de alta?')) return;
  $('au-ok').disabled = true;
  try {
    const r = await API.altaRegistrar({ p_candidato: candId || null, p_datos: datos, p_fecha: fecha, p_idpdv: idp, p_usuario: us, p_empresa: g('emp') || null, p_tipo_sueldo: null, p_sueldo: null, p_monto_infonavit: null, p_asegurado: null, p_tipo: $('au-tipo').value || null });
    cerrarM(); toast('Usuario ' + us + ' guardado: ya es activo en el HC y RH lo ve pendiente de datos personales' + (r && r.nota ? ' · ' + r.nota : '')); AL.tab = 'datos'; vAltas();
  } catch (x) { $('au-ok').disabled = false; w.hidden = false; w.textContent = 'No se pudo guardar: ' + (x.message || x); }
}

/* ---- fases 2 y 3: datos personales y bancarios (RH), por separado o juntos ---- */
async function altaCompletar(usuario) {
  const f = AL.fases.find(x => x.usuario === usuario) || {}; let s = null; try { s = await API.sensiblesDe(usuario); } catch (e) { toast('No se pudieron leer sus datos: ' + (e.message || e)); return; } s = s || {};
  const v = k => esc(s[k] == null ? '' : s[k]), nombreFull = [s.nombre_pila, s.apellido_p, s.apellido_m].filter(Boolean).join(' ') || f.nombre || '';
  const aviso = (est, com, t) => est === 'Declinado' ? `<div class="warn"><b>${t} declinados:</b> ${esc(com || 'sin comentario')}. Corrige y guarda para mandarlos otra vez a revisión.</div>` : '';
  $('modal').innerHTML = `<div class="mbox wide" style="width:min(820px,96vw);max-height:92vh;overflow:auto" role="dialog" aria-modal="true"><h3>Datos personales y bancarios</h3><div class="who">${esc(f.nombre || nombreFull)} · ${esc(usuario)}</div>
    ${aviso(f.rev_personales, f.com_personales, 'Datos personales')}${aviso(f.rev_bancarios, f.com_bancarios, 'Datos bancarios')}
    <div class="note">${faltanDe(f).length ? 'Falta: <b>' + faltanDe(f).join(', ') + '</b>.' : 'Tiene todo lo necesario.'} Puedes guardar con lo que tengas y completar después.</div>
    ${sect('2️⃣ Datos personales', '🧾')}
    <div class="fld"><label>CURP (18 caracteres)</label><div class="rfc-row"><input id="ac-curp" maxlength="18" style="text-transform:uppercase" value="${v('curp')}" autocomplete="off"><select id="ac-edo" title="Estado de nacimiento (solo para generar la base)"><option value="">Estado de nacimiento…</option>${ESTADOS_NAC.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select><button type="button" class="btn sm" onclick="altaCurpBase()">⚙️ Generar base (16)</button></div><small class="muted">La base sale del nombre, fecha de nacimiento, género y estado. Los 2 últimos caracteres (diferenciador y dígito verificador) los da RENAPO: se escriben a mano.</small></div>
    <div class="row2"><div class="fld"><label>NSS (11 dígitos)</label><input id="ac-nss" inputmode="numeric" maxlength="11" value="${v('nss')}"><small class="muted">Si no se obtiene de la página del IMSS, captúralo a mano.</small></div>
      <div class="fld"><label>Talla de uniforme</label><select id="ac-talla"><option value="">— elige —</option>${TALLAS.map(t => `<option ${s.talla === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div></div>
    <div class="row2"><div class="fld"><label>¿Tiene crédito Infonavit?</label><select id="ac-inf"><option value="">— elige —</option><option value="true" ${s.infonavit === true ? 'selected' : ''}>Sí</option><option value="false" ${s.infonavit === false ? 'selected' : ''}>No</option></select><small class="muted">El monto lo asigna nómina.</small></div>
      <div class="fld"><label>Contacto y teléfono de emergencia</label><input id="ac-emer" value="${v('contacto_emergencia')}" placeholder="Nombre y teléfono"></div></div>
    ${sect('3️⃣ Datos bancarios', '💳')}${f.banc_ok && f.rev_bancarios !== 'Declinado' ? '<div class="note">Ya tiene datos bancarios capturados. Para corregirlos usa Expedientes → Datos bancarios.</div>' : `<div class="row2"><div class="fld"><label>Banco</label><input id="ac-banco"></div><div class="fld"><label>Titular de la cuenta</label><input id="ac-titu" value="${esc(nombreFull)}"></div></div>
    <div class="row2"><div class="fld"><label>CLABE (18 dígitos)</label><input id="ac-clabe" inputmode="numeric" maxlength="18"></div><div class="fld"><label>Número de cuenta (si aplica)</label><input id="ac-cta"></div></div>
    <div class="fld"><label>Número de tarjeta (si aplica)</label><input id="ac-tarj" inputmode="numeric" maxlength="16"></div><label class="chk"><input type="checkbox" id="ac-omit" ${f.bancarios_omitidos ? 'checked' : ''}> Omitir los datos bancarios por ahora (quedan pendientes y se completan desde Expedientes)</label>`}
    <div class="warn" id="ac-warn" hidden></div><div class="mfoot"><button class="btn" onclick="cerrarM()">Cancelar</button><button class="btn primary" id="ac-ok">Guardar</button></div></div>`;
  $('modal').hidden = false; $('modal').onclick = e => { if (e.target.id === 'modal') cerrarM(); }; AL.cs = s;
  $('ac-ok').onclick = () => altaCompletarGuardar(usuario, f);
}
function altaCurpBase() {
  const s = AL.cs || {}, b = curpBase(s.nombre_pila, s.apellido_p, s.apellido_m, s.fecha_nacimiento, s.genero, $('ac-edo').value);
  if (!b) { toast('Para generar la base se necesitan nombre, apellidos, fecha de nacimiento, género y el estado de nacimiento'); return; }
  const cur = $('ac-curp').value.toUpperCase(); $('ac-curp').value = b + (cur.length > 16 ? cur.slice(16) : ''); $('ac-curp').focus();
}
async function altaCompletarGuardar(usuario, f) {
  const g = id => { const e = $('ac-' + id); return e ? limpia(e.value) : ''; }, w = $('ac-warn'), e = [], curp = mayus(g('curp')), nss = digs(g('nss')), clabe = digs(g('clabe'));
  if (curp && !V.curp(curp)) e.push('La CURP debe tener 18 caracteres con formato válido (la base se genera y se completa a mano).'); if (nss && !V.nss(nss)) e.push('El NSS debe tener 11 dígitos.'); if (clabe && !V.clabe(clabe)) e.push('La CLABE no es válida (18 dígitos con dígito verificador correcto).');
  if (e.length) { w.hidden = false; w.innerHTML = e.map(esc).join('<br>'); return; }
  const sens = { curp, nss, talla: g('talla'), infonavit: $('ac-inf').value, contacto_emergencia: g('emer') }; Object.keys(sens).forEach(k => { if (sens[k] === '') delete sens[k]; });
  const hayB = !!$('ac-banco'), banc = hayB ? { banco: g('banco'), titular: g('titu'), clabe, cuenta: digs(g('cta')), tarjeta: digs(g('tarj')) } : {}; const tieneB = hayB && [banc.banco, banc.clabe, banc.cuenta, banc.tarjeta].some(x => x);
  if (tieneB && !clabe) { w.hidden = false; w.textContent = 'Para guardar datos bancarios escribe la CLABE (o márcalos como omitidos).'; return; }
  $('ac-ok').disabled = true;
  try {
    const r = await API.altaCompletar({ p_usuario: usuario, p_sens: sens, p_banc: tieneB ? banc : {}, p_omitir_banc: !tieneB && !!($('ac-omit') && $('ac-omit').checked) });
    cerrarM(); toast(r.faltan && r.faltan.length ? 'Guardado. Todavía falta: ' + r.faltan.join(', ') : 'Guardado: pasa a la siguiente fase (' + r.fase + ')'); vAltas();
  } catch (x) { $('ac-ok').disabled = false; w.hidden = false; w.textContent = 'No se pudo guardar: ' + (x.message || x); }
}
async function altaRegresar(usuario) {
  const m = prompt('¿Por qué se regresa a la fase anterior? (mínimo 5 caracteres)', ''); if (m === null) return; if (limpia(m).length < 5) { toast('Escribe el motivo'); return; }
  try { const a = await API.altaRegresar(usuario, limpia(m)); toast('Regresó a ' + a); vAltas(); } catch (e) { toast(e.message || e); }
}

/* ---- revisión: aprobar o declinar lo capturado (con comentario) ---- */
async function altaRevisar(usuario) {
  const f = AL.fases.find(x => x.usuario === usuario) || {}; let s = {}, bd = null; try { s = (await API.sensiblesDe(usuario)) || {}; } catch (e) { } try { bd = await API.bancariosDe(usuario); } catch (e) { }
  const edita = can('alta_revision', 'editar'), fila = (k, v) => `<tr><td class="t"><b>${k}</b></td><td class="t">${esc(v == null || v === '' ? '—' : v)}</td></tr>`;
  const bloque = (concepto, est, com, tabla, k) => `<div class="enc-d" style="margin:10px 0"><b>${concepto}</b> ${revPill(est, com)}<div class="tw"><table class="dt"><tbody>${tabla}</tbody></table></div>
    ${edita && est === 'Pendiente de revisión' ? `<div class="fld"><label>Comentario (obligatorio si se declina)</label><input id="rv-${k}" placeholder="Qué está mal y qué debe corregir RH"></div><div class="tools"><button class="btn primary" onclick="altaRevisarOk('${usuario}','${concepto}',true,'${k}')">✔ Aprobar</button><button class="btn danger" onclick="altaRevisarOk('${usuario}','${concepto}',false,'${k}')">✖ Declinar</button></div>` : ''}</div>`;
  const d = (bd && bd.d) || {};
  $('modal').innerHTML = `<div class="mbox wide" style="width:min(760px,96vw);max-height:92vh;overflow:auto" role="dialog" aria-modal="true"><h3>🔎 Revisión del alta</h3><div class="who">${esc(f.nombre || usuario)} · ${esc(usuario)} · fase ${esc(f.fase || '')}</div>
    ${f.rev_personales ? bloque('Datos personales', f.rev_personales, f.com_personales, fila('CURP', s.curp) + fila('NSS', s.nss) + fila('RFC', s.rfc) + fila('Talla', s.talla) + fila('Infonavit', s.infonavit == null ? '' : s.infonavit ? 'Sí' : 'No') + fila('Contacto de emergencia', s.contacto_emergencia) + fila('Correo', s.correo) + fila('Teléfono', s.telefono), 'p') : '<p class="muted">Los datos personales todavía no están completos.</p>'}
    ${f.rev_bancarios ? bloque('Datos bancarios', f.rev_bancarios, f.com_bancarios, fila('Banco', d.banco) + fila('Titular', d.titular) + fila('CLABE', d.clabe) + fila('Cuenta', d.cuenta) + fila('Tarjeta', d.tarjeta), 'b') : '<p class="muted">Los datos bancarios todavía no están capturados.</p>'}
    <div class="note">Los documentos del expediente se revisan en Expedientes. ${can('expedientes', 'ver') ? `<button class="rsv" onclick="cerrarM();expedienteAbrir('${usuario}')">Abrir expediente ›</button>` : ''}</div><div class="mfoot"><button class="btn" onclick="cerrarM()">Cerrar</button></div></div>`;
  $('modal').hidden = false; $('modal').onclick = e => { if (e.target.id === 'modal') cerrarM(); };
}
async function altaRevisarOk(usuario, concepto, ap, k) {
  const com = limpia(($('rv-' + k) || {}).value); if (!ap && com.length < 5) { toast('Escribe por qué se declina (mínimo 5 caracteres)'); return; }
  try { await API.altaRevisar(usuario, concepto, ap, com); toast(ap ? concepto + ' aprobados' : concepto + ' declinados: RH verá tu comentario'); cerrarM(); vAltas(); } catch (e) { toast(e.message || e); }
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
  h += await bancFaltanHTML();
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

/* ----- checklist del expediente: ver 07d_expedientes.js (almacén temporal + revisión) ----- */
