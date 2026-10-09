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
function decir(texto, ms = 7000) {
  const corto = texto.length > 140 ? texto.slice(0, 137) + "… (clic para ver)" : texto;
  globo.textContent = corto;
  globo.hidden = false;
  clearTimeout(tGlobo);
  tGlobo = setTimeout(() => (globo.hidden = true), ms);
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
  if (arrastre && arrastre.movido <= 4) { window.saurio.saludar(); expandir(!grande); }
  else if (arrastre) window.saurio.estado("idle");
  arrastre = null;
});
globo.addEventListener("click", () => expandir(true));
$("cerrar").addEventListener("click", () => expandir(false));

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
  p.respuesta.connect((t) => { agregar(t, "el"); if (!grande) decir(t); });
  p.estado.connect((s) => window.saurio && window.saurio.estado(s));
  p.plan.connect(mostrarPlan);
  p.pendientes.connect(pintarPendientes);
  p.aviso.connect((t) => {
    if (t.startsWith("Escuchando")) $("btnReunion").classList.add("grabando");
    if (t.startsWith("Reunión detenida") || t.startsWith("No pude abrir")) $("btnReunion").classList.remove("grabando");
    if (!t.startsWith("Transcribiendo…") || grande) agregar(t, "aviso");
    if (!grande) decir(t);
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
