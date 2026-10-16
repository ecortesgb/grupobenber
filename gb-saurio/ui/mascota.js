// GB Saurio animado por cuadros (los mismos 32 cuadros del Saurio del dashboard de RRHH, en sprites/cuadros/).
// Cada estado es una secuencia de cuadros; en ratos libres guiña, mira hacia tu cursor y da paseítos.
const caja = document.getElementById("mascota");
caja.innerHTML = `
  <div id="indicador" hidden></div>
  <img id="sprite" alt="GB Saurio" draggable="false">`;
const sprite = document.getElementById("sprite");
const indicador = document.getElementById("indicador");
const QUIETO = matchMedia("(prefers-reduced-motion: reduce)").matches;

// secuencia: [cuadros, ms por cuadro, repeticiones (0 = sin fin)]
const SEC = {
  habla:    [["frente", "quieto"], 170, 0],
  fiesta:   [["fiesta1", "fiesta2", "fiesta3", "fiesta4", "fiesta5", "fiesta6", "fiesta7", "fiesta8", "fiesta9"], 95, 2],
  piensa:   [["laptop", "escribe"], 330, 0],
  minuta:   [["escribe", "escribe", "laptop", "escribe"], 420, 0],
  alerta:   [["mira_arriba", "mira_arriba", "frente", "mira_arriba"], 300, 2],
  saluda:   [["saluda", "quieto", "saluda", "quieto", "saluda"], 260, 1],
  preocupa: [["mira_abajo", "mira_abajo", "mira_abajo", "frente"], 380, 2],
  colgado:  [["frente"], 1000, 0],
  guino:    [["guina", "guina", "frente"], 220, 1],
  mira_d:   [["mira_d", "mira_d", "mira_d", "frente"], 330, 1],
  mira_i:   [["mira_i", "mira_i", "mira_i", "frente"], 330, 1],
  arriba:   [["mira_arriba", "mira_arriba", "mira_arriba", "frente"], 300, 1],
};

// estado: [secuencia, efecto de cuerpo, indicador, ms antes de volver a idle (0 = se queda)]
const ESTADOS = {
  idle:        [null, "respira", "", 0],
  hablando:    ["habla", "", "", 1800],
  feliz:       ["fiesta", "brinca", "", 0],
  pensando:    ["piensa", "", "…", 0],
  escuchando:  ["minuta", "", "● REC", 0],
  alerta:      ["alerta", "brinca", "!", 0],
  saludo:      ["saluda", "", "", 0],
  preocupado:  ["preocupa", "tiembla", "", 0],
  arrastrando: ["colgado", "colgado", "", 0],  // al arrastrarlo se queda de frente y se mece colgado
};

// precarga: el cambio de cuadro debe ser instantáneo
const CUADROS = [...new Set(["frente", ...Object.values(SEC).flatMap((s) => s[0])])];
CUADROS.forEach((c) => { new Image().src = `sprites/cuadros/${c}.webp`; });

const s = { estado: "idle", turno: 0, ocupado: false, tVolver: null, tMicro: null, tMira: null, clics: [], mover: null };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const azar = (a) => a[Math.floor(Math.random() * a.length)];

function cuadro(nombre) {
  if (sprite.dataset.n !== nombre) {
    sprite.src = `sprites/cuadros/${nombre}.webp`;
    sprite.dataset.n = nombre;
  }
}

// Corre una secuencia; se corta sola si entra otra (cada una tiene su "turno").
async function correr(nombre, alTerminar) {
  const [cuadros, ms, reps] = SEC[nombre];
  const t = ++s.turno;
  if (QUIETO) { cuadro(cuadros[0]); return; }
  for (let r = 0; reps === 0 || r < reps; r++) {
    for (const c of cuadros) {
      if (t !== s.turno) return;
      cuadro(c);
      await espera(ms);
    }
  }
  if (t === s.turno) { cuadro("frente"); alTerminar && alTerminar(); }
}

function efecto(nombre) {
  caja.dataset.anim = nombre;
}

function poner(nombre) {
  const [sec, ef, ind, dura] = ESTADOS[nombre] || ESTADOS.idle;
  clearTimeout(s.tVolver);
  s.estado = nombre;
  s.ocupado = false;
  if (nombre !== s.previo) { sprite.classList.remove("pop"); void sprite.offsetWidth; sprite.classList.add("pop"); }
  s.previo = nombre;
  efecto(ef);
  indicador.textContent = ind;
  indicador.hidden = !ind;
  indicador.classList.toggle("rec", nombre === "escuchando");
  const volver = () => { if (s.estado === nombre) poner("idle"); };
  if (sec) {
    // secuencias finitas regresan a idle al terminar; las infinitas esperan a que Python cambie el estado
    correr(sec, SEC[sec][2] ? volver : null);
  } else {
    s.turno++;
    cuadro("frente");
  }
  if (dura) s.tVolver = setTimeout(volver, dura);
  if (nombre === "idle") microAnimar(); else clearTimeout(s.tMicro);
}

// ---------- ratos libres: guiño, mirar, paseíto ----------
const libre = () => s.estado === "idle" && !s.ocupado && !document.hidden && document.body.classList.contains("chica");

function microAnimar() {
  clearTimeout(s.tMicro);
  if (QUIETO) return;
  s.tMicro = setTimeout(() => {
    if (libre()) {
      const r = Math.random();
      if (r < 0.4) correr("guino");
      else if (r < 0.7) correr(azar(["mira_d", "mira_i"]));
      else if (r < 0.85) pasear();
      else correr("arriba");
    }
    if (s.estado === "idle") microAnimar();
  }, 5000 + Math.random() * 6000);
}

// Camina un poco a la izquierda y regresa a su lugar (mueve la ventana; siempre vuelve a donde estaba).
async function pasear() {
  if (!s.mover) return;
  s.ocupado = true;
  const t = ++s.turno;
  const sigue = () => t === s.turno && s.estado === "idle" && document.body.classList.contains("chica");
  let recorrido = 0, i = 0;
  // Cada paso dura 3 tics: cambia de pierna, el cuerpo sube a media zancada y se inclina hacia el pie que pisa.
  efecto("");
  const paso = async (dir) => {
    const zancada = Math.floor(i / 3), fase = (i % 3) / 3;
    i++;
    cuadro((dir < 0 ? ["camina_i1", "camina_i2"] : ["camina_d1", "camina_d2"])[zancada % 2]);
    const sube = Math.sin(fase * Math.PI) * 5;
    const inclina = (zancada % 2 ? 1 : -1) * 2.5 * Math.sin(fase * Math.PI);
    sprite.style.transform = `translateY(${-sube}px) rotate(${inclina}deg) scale(${1 + sube / 160}, ${1 - sube / 200})`;
    s.mover(dir * 4, 0);
    recorrido += dir * 4;
    await espera(60);
  };
  while (recorrido > -104 && sigue()) await paso(-1);
  if (sigue()) { cuadro("frente"); await espera(1500); }
  while (recorrido < 0 && sigue()) await paso(1);
  if (recorrido && s.estado !== "arrastrando") s.mover(-recorrido, 0); // si lo interrumpieron, regresa de golpe a su lugar
  sprite.style.transform = "";
  if (t === s.turno) { cuadro("frente"); efecto("respira"); }
  s.ocupado = false;
}

// ---------- seguir el cursor con la mirada (Python manda dónde está el mouse respecto a Saurio) ----------
function mirar(dx, dy) {
  if (!libre() || QUIETO) return;
  const ax = Math.abs(dx), ay = Math.abs(dy);
  s.turno++;
  cuadro(ax < 80 && ay < 80 ? "frente" : ay > ax * 0.9 ? (dy < 0 ? "mira_arriba" : "mira_abajo") : dx > 0 ? "mira_d" : "mira_i");
  clearTimeout(s.tMira);
  s.tMira = setTimeout(() => { if (libre()) cuadro("frente"); }, 1400);
}

// ---------- clic: saluda; cinco clics rápidos = cosquillas ----------
function saludar() {
  const ahora = Date.now();
  s.clics = s.clics.filter((c) => ahora - c < 2500).concat(ahora);
  if (s.clics.length >= 5) { s.clics = []; poner("feliz"); return; }
  poner("saludo");
}

window.saurio = {
  estado: poner,
  saludar,
  mirar,
  alMover(fn) { s.mover = fn; },
  pasear,
};
poner("idle");
