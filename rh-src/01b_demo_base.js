/* ---------- datos de ejemplo (todo ficticio; escribe solo en memoria) ---------- */
const Demo = (() => {
  const nombres = ['Ana Karen Solís', 'Luis Ángel Ortega', 'María Fernanda Cruz', 'José Manuel Reyes', 'Daniela Ruiz Peña', 'Carlos Iván Mora', 'Paola Estrada', 'Jorge Alberto Lara', 'Valeria Núñez', 'Diego Armando Gil', 'Karla Itzel Vega', 'Miguel Ángel Soto', 'Fátima Luna', 'Ricardo Salas', 'Brenda Morales', 'Héctor Duarte', 'Itzel Aguirre', 'Omar Castañeda', 'Lucía Montes', 'Andrés Cabrera', 'Nancy Palacios', 'Emilio Rangel', 'Sofía Barrera', 'Raúl Meza'];
  const est = [['Puebla', 'SUR', 'Coordinador RH Sur 1'], ['Veracruz', 'SUR', 'Coordinador RH Sur 2'], ['Guanajuato', 'OCCIDENTE', 'Coordinador RH Occidente'], ['Nuevo León', 'NORTE', 'Coordinador RH Norte'], ['Ciudad de México', 'CENTRO', 'Coordinador RH Centro']];
  const cad = ['Coppel', 'Elektra', 'Suburbia', 'Cimaco'];
  const tiendas = {}; let id = 1000;
  const tien = []; for (let i = 0; i < 40; i++) { const e = est[i % 5]; const t = { idpdv: id + i, nombre: (cad[i % 4]).toUpperCase() + ' ' + ['CENTRO', 'PLAZA SOL', 'NORTE', 'REFORMA', 'ALAMEDA', 'LAS TORRES', 'CANADA', 'AZTECAS'][i % 8] + ' ' + (i + 1), cadena: cad[i % 4], estado: e[0], region: e[1], gerente: 'Gerente Demo', supervisor: 'Supervisor ' + (i % 7 + 1), rrhh: e[2], posiciones: 1 + ((id + i) % 2), zona_rrhh: ['ZONA RH DEMO 1', 'ZONA RH DEMO 2', 'ZONA RH DEMO 3'][i % 3] }; tiendas[t.idpdv] = t; tien.push(t); }
  const mkAus = (u, k) => { const m = ['Permiso especial', 'Vacaciones', 'Incapacidad (IMSS)', 'Tema médico (particular)']; return Array.from({ length: k }, (_, j) => ({ motivo: m[(u + j) % 4], fecha_inicio: addD(HOY, -(8 + j * 21 + u % 9)), dias: 1 + (u + j) % 5, fecha_regreso: addD(HOY, -(8 + j * 21 + u % 9) + 1 + (u + j) % 5) })); };
  let alertas = nombres.map((n, i) => { const dias = [2, 2, 3, 2, 4, 6, 2, 3, 9, 2, 5, 2, 3, 2, 12, 2, 4, 3, 2, 7, 2, 3, 2, 5][i]; const t = tien[(i * 7) % 40]; return { id: i + 1, usuario: 'DEMO' + String(100 + i), nombre: n, ultimo: addD(HOY, -dias), dias, idpdv: t.idpdv, empresa: ['Benber SS', 'Revelor', 'Doma Legal', 'Atmosphera'][i % 4], ingreso: addD(HOY, -(30 + i * 37)), aus: mkAus(i, i % 4 === 0 ? 3 : i % 3) }; });
  let vigentes = [['Vacaciones', 6, 3], ['Incapacidad (IMSS)', 10, 5], ['Permiso especial', 3, 1], ['Tema médico (particular)', 4, 2], ['Vacaciones', 12, 8], ['Incapacidad (IMSS)', 20, 9], ['Permiso especial', 2, 1]].map((v, i) => ({ id: 500 + i, usuario: 'DEMO' + (300 + i), nombre: ['Pedro Lozano', 'Gabriela Ibarra', 'Mónica Téllez', 'Saúl Cervantes', 'Teresa Pineda', 'Víctor Maya', 'Elena Ochoa'][i], motivo: v[0], inicio: addD(HOY, -v[2]), dias: v[1], regreso: addD(HOY, v[1] - v[2]), idpdv: tien[(i * 5) % 40].idpdv }));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  return {
    async init() { return true; }, async login() { }, async logout() { location.href = location.pathname; },
    async me() { return { id: 'demo', nombre: 'Usuario de ejemplo', rol: 'rh', rrhh: 'Coordinador RH Sur 1', zona: null, permisos: Object.fromEntries(['alertas', 'ausencias', 'bajas', 'colaboradores', 'posibles_ingresos', 'expedientes', 'reportes', 'exportar_csv', 'exportar_foto', 'alta_revision', 'datos_sensibles'].map(m => [m, { ver: true, crear: true, editar: true, borrar: false, alcance: 'estado' }])) }; },
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

