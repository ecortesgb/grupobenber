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
