// Chat, pendientes y comunicación con Python (QWebChannel).
const $ = (id) => document.getElementById(id);
const panel = $("panel"), mensajes = $("mensajes"), entrada = $("entrada"), globo = $("globo");
let puente = null, grande = false, tGlobo = null;

// ---------- utilidades ----------
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function formato(texto) {
  // Markdown mínimo: bloques de código, `código`, **negritas**
  return esc(texto)
    .replace(/```[\w-]*\n?([\s\S]*?)```/g, (_, c) => `<pre><code>${c}</code></pre>`)
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>");
}
function agregar(texto, quien) {
  const d = document.createElement("div");
  d.className = "msg " + quien;
  d.innerHTML = quien === "yo" ? esc(texto) : formato(texto);
  mensajes.appendChild(d);
  mensajes.scrollTop = mensajes.scrollHeight;
}
function decir(texto, ms) {
  // globo estilo Benber: el texto aparece letra por letra
  const corto = texto.length > 140 ? texto.slice(0, 137) + "… (clic para ver)" : texto;
  globo.innerHTML = "<span></span><i></i>";
  const span = globo.firstChild;
  globo.hidden = false;
  clearTimeout(tGlobo);
  let n = 0;
  const escribir = () => {
    span.textContent = corto.slice(0, ++n);
    if (n < corto.length) tGlobo = setTimeout(escribir, 14);
    else tGlobo = setTimeout(() => (globo.hidden = true), ms || Math.min(8000, 2400 + corto.length * 50));
  };
  escribir();
}
function expandir(si) {
  grande = si;
  panel.hidden = !si;
  document.body.classList.toggle("chica", !si);
  puente && puente.expandir(si);
  if (si) { globo.hidden = true; setTimeout(() => entrada.focus(), 50); puente && puente.pedirPendientes(); }
}

// ---------- arrastrar la mascota (mueve la ventana) / clic para abrir ----------
const mascota = $("mascota");
let arrastre = null;
mascota.addEventListener("pointerdown", (e) => {
  arrastre = { x: e.screenX, y: e.screenY, movido: 0 };
  mascota.setPointerCapture(e.pointerId);
});
mascota.addEventListener("pointermove", (e) => {
  if (!arrastre) return;
  const dx = e.screenX - arrastre.x, dy = e.screenY - arrastre.y;
  if (dx || dy) {
    arrastre.movido += Math.abs(dx) + Math.abs(dy);
    arrastre.x = e.screenX; arrastre.y = e.screenY;
    if (arrastre.movido > 4) {
      if (!arrastre.avisado) { window.saurio.estado("arrastrando"); arrastre.avisado = true; }
      puente && puente.mover(dx, dy);
    }
  }
});
mascota.addEventListener("pointerup", () => {
  if (arrastre && arrastre.movido <= 4 && window.saurio.actual === "diciendo") puente && puente.callar(); // clic = cállate
  else if (arrastre && arrastre.movido <= 4) { window.saurio.saludar(); expandir(!grande); }
  else if (arrastre) window.saurio.estado("idle");
  arrastre = null;
});
globo.addEventListener("click", () => expandir(true));

// ---------- minimizar a un circulito y volver ----------
let minimizado = false;
function minimizar(si) {
  minimizado = si;
  document.body.classList.toggle("minimizado", si);
  $("mini").hidden = !si;
  $("mini").classList.remove("aviso");
  if (si) { panel.hidden = true; grande = false; globo.hidden = true; document.body.classList.remove("chica"); }
  else { document.body.classList.add("chica"); }
  puente && puente.minimizar(si);
  if (!si) { window.saurio.estado("saludo"); setTimeout(() => decir("¡Aquí sigo!"), 300); }
}
$("minimizar").addEventListener("click", (e) => { e.stopPropagation(); minimizar(true); });
$("mini").addEventListener("click", () => minimizar(false));
$("cerrar").addEventListener("click", () => expandir(false));
$("cerrar").title = "Cerrar el chat";

// ---------- chat ----------
function enviar(texto) {
  texto = texto.trim();
  if (!texto) return;
  agregar(texto, "yo");
  puente && puente.enviar(texto);
}
$("forma").addEventListener("submit", (e) => { e.preventDefault(); enviar(entrada.value); entrada.value = ""; });
entrada.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("forma").requestSubmit(); }
});
document.querySelectorAll("[data-pregunta]").forEach((b) =>
  b.addEventListener("click", () => enviar(b.dataset.pregunta)));
$("btnReunion").addEventListener("click", () => puente && puente.reunion());
$("btnDeshacer").addEventListener("click", () => puente && puente.deshacer());

// ---------- voz ----------
const hablarle = () => puente && puente.escuchar();
$("mic").addEventListener("click", hablarle);
$("hablale").addEventListener("click", (e) => { e.stopPropagation(); hablarle(); });
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.code === "Space") { e.preventDefault(); hablarle(); }
});
let conVoz = false;
try { conVoz = localStorage.getItem("gbsVoz") === "1"; } catch (_) { /* sin almacenamiento */ }
function ponerVoz(si) {
  conVoz = si;
  $("voz").textContent = si ? "🔊" : "🔇";
  $("voz").setAttribute("aria-pressed", si);
  $("voz").title = si ? "Contesta hablando (clic para silenciar)" : "Contestar también hablando";
  try { localStorage.setItem("gbsVoz", si ? "1" : "0"); } catch (_) { /* sin almacenamiento */ }
  puente && puente.responderConVoz(si);
}
$("voz").addEventListener("click", () => ponerVoz(!conVoz));
function microfono(si) {
  $("mic").classList.toggle("grabando", si);
  $("hablale").classList.toggle("grabando", si);
  if (si && !grande && !minimizado) decir("¿Sí? Te escucho…", 3000);
  if (si && minimizado) { $("mini").classList.remove("aviso"); void $("mini").offsetWidth; $("mini").classList.add("aviso"); }
}

// ---------- plan de organización ----------
$("aplicar").addEventListener("click", () => { $("planCaja").hidden = true; puente.aplicarPlan(); });
$("descartar").addEventListener("click", () => { $("planCaja").hidden = true; puente.descartarPlan(); });
function mostrarPlan(json) {
  const p = JSON.parse(json);
  const nombre = (r) => r.split(/[\\/]/).pop();
  const items = p.movimientos.slice(0, 40).map((m) =>
    `<li>${esc(nombre(m.origen))} → <b>${esc(nombre(m.carpeta_destino))}</b></li>`).join("");
  const extra = p.movimientos.length > 40 ? `<li>…y ${p.movimientos.length - 40} más</li>` : "";
  $("planTexto").innerHTML = `<b>Plan propuesto</b> (${p.movimientos.length} archivos). ${esc(p.motivo)}<ul>${items}${extra}</ul>
    <small>No se mueve nada hasta que presiones Aplicar. Se puede deshacer.</small>`;
  $("planCaja").hidden = false;
  if (!grande) expandir(true);
}

// ---------- pendientes ----------
document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("activa", x === t));
  $("vistaChat").hidden = t.dataset.tab !== "chat";
  $("vistaPend").hidden = t.dataset.tab !== "pend";
}));
function pintarPendientes(json) {
  const lista = JSON.parse(json);
  $("nPend").textContent = lista.length ? `(${lista.length})` : "";
  $("listaPend").innerHTML = lista.length ? "" : "<li>Sin pendientes abiertos 🎉</li>";
  for (const p of lista) {
    const li = document.createElement("li");
    if (p.vencido) li.className = "vencido";
    const fecha = p.fecha_compromiso ? p.fecha_compromiso.split("-").reverse().join("/") : "sin fecha";
    li.innerHTML = `<input type="checkbox" title="Marcar como hecho">
      <div><div>${esc(p.titulo)}</div>
      <div class="meta">${fecha} · ${esc(p.prioridad)}${p.vencido ? " · VENCIDO" : ""}${p.origen !== "chat" ? " · " + esc(p.origen) : ""}</div></div>`;
    li.querySelector("input").addEventListener("change", () => puente.completarPendiente(p.id));
    $("listaPend").appendChild(li);
  }
}
$("excel").addEventListener("click", () => puente && puente.exportarExcel());

// ---------- conexión con Python ----------
function conectar(p) {
  puente = p;
  p.respuesta.connect((t) => { agregar(t, "el"); if (minimizado) $("mini").classList.add("aviso"); else if (!grande) decir(t); });
  p.estado.connect((s) => window.saurio && window.saurio.estado(s));
  p.cursor.connect((dx, dy) => window.saurio && window.saurio.mirar(dx, dy));
  window.saurio && window.saurio.alMover((dx, dy) => p.mover(dx, dy));
  p.oido.connect((t) => agregar(t, "yo"));
  p.microfono.connect(microfono);
  ponerVoz(conVoz);
  p.plan.connect(mostrarPlan);
  p.pendientes.connect(pintarPendientes);
  p.aviso.connect((t) => {
    if (t.startsWith("Escuchando")) $("btnReunion").classList.add("grabando");
    if (t.startsWith("Reunión detenida") || t.startsWith("No pude abrir")) $("btnReunion").classList.remove("grabando");
    if (!t.startsWith("Transcribiendo…") || grande) agregar(t, "aviso");
    if (minimizado) { $("mini").classList.remove("aviso"); void $("mini").offsetWidth; $("mini").classList.add("aviso"); $("mini").title = t; }
    else if (!grande) decir(t);
  });
  p.pedirPendientes();
  setTimeout(() => decir("¡Hola Elías! Haz clic en mí para platicar."), 800);
}
document.body.classList.add("chica");
if (window.qt && window.QWebChannel) {
  new QWebChannel(qt.webChannelTransport, (canal) => conectar(canal.objects.puente));
} else {
  decir("Vista previa sin Python (abre GB Saurio con iniciar.bat).", 60000);
}
// para pruebas y para la consola de depuración
window.gbsUI = { decir, expandir, agregar, pintarPendientes, minimizar };
