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
  const nom = ((AL.fases || []).find(x => x.usuario === usuario) || {}).nombre || ((AL.ult || []).find(x => x.usuario_fieldwy === usuario) || {}).nombre || (((EXP.lista || []).find(x => x.usuario_fieldwy === usuario) || {}).colaboradores || {}).nombre || usuario;
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
