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
