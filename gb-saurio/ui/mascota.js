// GB Saurio en 2D: usa las poses de cuerpo completo recortadas de las hojas de referencia (ui/sprites/).
// Cada estado muestra una pose; el movimiento es con animaciones CSS (respirar, brincar, mecerse).
const caja = document.getElementById("mascota");
caja.innerHTML = `
  <div id="indicador" hidden></div>
  <img id="sprite" alt="GB Saurio" draggable="false">`;
const sprite = document.getElementById("sprite");
const indicador = document.getElementById("indicador");

// estado: [imagen, animación, indicador, duración en ms (0 = se queda)]
const ESTADOS = {
  idle:        ["frente", "respira", "", 0],
  hablando:    ["frente", "habla", "", 1800],
  feliz:       ["frente", "brinca", "", 1600],
  pensando:    ["pensando", "medita", "…", 0],
  escuchando:  ["oreja", "medita", "● REC", 0],
  alerta:      ["sorprendido", "brinca", "!", 2600],
  saludo:      ["saludo", "mece", "", 1800],
  preocupado:  ["preocupado", "medita", "", 3000],
  arrastrando: ["lado", "", "", 0],
};

// precarga para que el cambio de pose sea instantáneo
Object.values(ESTADOS).forEach(([img]) => { new Image().src = `sprites/${img}.png`; });

let actual = null, temporizador = null;

function poner(nombre) {
  const [img, anim, ind, dura] = ESTADOS[nombre] || ESTADOS.idle;
  clearTimeout(temporizador);
  if (actual !== img) {
    sprite.src = `sprites/${img}.png`;
    sprite.classList.remove("pop"); void sprite.offsetWidth; sprite.classList.add("pop");
    actual = img;
  }
  caja.dataset.anim = anim;
  indicador.textContent = ind;
  indicador.hidden = !ind;
  indicador.classList.toggle("rec", nombre === "escuchando");
  if (dura) temporizador = setTimeout(() => poner("idle"), dura);
}

window.saurio = {
  estado: poner,
  saludar() { poner("saludo"); },
};
poner("idle");
