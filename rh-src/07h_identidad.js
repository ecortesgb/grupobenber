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
    ${req(pre + 'rfc', 'RFC (13 caracteres)', `<div class="rfc-row"><input id="${pre}rfc" maxlength="13" style="text-transform:uppercase" value="${v('rfc')}" autocomplete="off" placeholder="Base de 10 o completo de 13"><button type="button" class="btn sm" onclick="idRfcGenerar('${pre}')">⚙️ Generar base (10)</button></div><small class="muted">La base (10 caracteres) sale del nombre y la fecha de nacimiento. La homoclave (3 últimos) es opcional: si la tienes, agrégala.</small>`)}`;
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
  if (d.correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.correo)) e.push('El correo no es válido.'); if (d.rfc && !/^[A-ZÑ&]{4}\d{6}([A-Z0-9]{3})?$/.test(d.rfc)) e.push('El RFC debe tener 10 caracteres (base) o 13 con la homoclave.');
  return e;
}
