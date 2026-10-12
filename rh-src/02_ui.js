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
