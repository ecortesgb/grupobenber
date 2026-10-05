// GB Saurio en 3D, armado según la hoja de referencia (character reference sheet):
// dinosaurio naranja, gorra azul con "M", camisa blanca con logo GB, pantalón negro con cinturón.
// Todo se construye con figuras simples: no necesita archivos de modelo.
import * as THREE from "three";

const caja = document.getElementById("mascota");
const W = caja.clientWidth, H = caja.clientHeight;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(W, H);
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
caja.appendChild(renderer.domElement);

const escena = new THREE.Scene();
const camara = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
camara.position.set(0, 3.1, 7.9);
camara.lookAt(0, 1.35, 0);

escena.add(new THREE.HemisphereLight(0xffffff, 0x8a6a4a, 1.5));
const sol = new THREE.DirectionalLight(0xffffff, 2.2);
sol.position.set(2.5, 4, 5);
escena.add(sol);
const contra = new THREE.DirectionalLight(0xffe2c0, 0.8);
contra.position.set(-3, 2, -3);
escena.add(contra);

// ---------- texturas generadas en código ----------
function texturaCanvas(w, h, dibujar) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  dibujar(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
// relieve de escamas para la piel
const escamas = texturaCanvas(256, 256, (g, w, h) => {
  g.fillStyle = "#808080"; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 16) for (let x = (y / 16) % 2 ? 8 : 0; x < w; x += 16) {
    const gr = g.createRadialGradient(x, y, 1, x, y, 8);
    gr.addColorStop(0, "#d0d0d0"); gr.addColorStop(1, "#606060");
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, 7.5, 0, Math.PI * 2); g.fill();
  }
});
escamas.colorSpace = THREE.NoColorSpace;
escamas.wrapS = escamas.wrapT = THREE.RepeatWrapping;
escamas.repeat.set(3, 3);

const texM = texturaCanvas(256, 128, (g, w, h) => {
  g.fillStyle = "#ffffff"; g.font = "bold 120px Arial Rounded MT Bold, Arial, sans-serif";
  g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("M", w / 2, h / 2 + 6);
});
const texGB = texturaCanvas(128, 128, (g, w, h) => {
  g.fillStyle = "#f28a1d"; g.beginPath(); g.arc(64, 64, 62, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "#ffffff"; g.lineWidth = 6; g.beginPath(); g.arc(64, 64, 50, 0, Math.PI * 2); g.stroke();
  g.fillStyle = "#ffffff"; g.font = "bold 50px Arial, sans-serif";
  g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("GB", 64, 68);
});

// ---------- materiales ----------
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });
const piel = mat(0xf5891f, { roughness: 0.75, bumpMap: escamas, bumpScale: 0.6 });
const pielOsc = mat(0xe0741a, { roughness: 0.8 });
const camisa = mat(0xf4f3ef, { roughness: 0.85 });
const pantalon = mat(0x18181b, { roughness: 0.8 });
const cinto = mat(0x0c0c0c, { roughness: 0.4 });
const hebilla = mat(0xb8a27a, { metalness: 0.8, roughness: 0.3 });
const gorra = mat(0x1d6fc4, { roughness: 0.7 });
const blanco = mat(0xffffff, { roughness: 0.15 });
const iris = mat(0x6b3a1c, { roughness: 0.2 });
const negro = mat(0x0a0a0a, { roughness: 0.1 });
const boca = mat(0x5a1414, { roughness: 0.6 });
const lenguaM = mat(0xe8616c);

function malla(geo, m, pos, escala) {
  const o = new THREE.Mesh(geo, m);
  if (pos) o.position.set(...pos);
  if (escala) o.scale.set(...escala);
  return o;
}
const esf = (r, m, pos, esc) => malla(new THREE.SphereGeometry(r, 40, 28), m, pos, esc);
const cap = (r, largo, m, pos) => malla(new THREE.CapsuleGeometry(r, largo, 8, 20), m, pos);

const saurio = new THREE.Group();
escena.add(saurio);

// ---------- piernas, pies y pantalón ----------
for (const lado of [-1, 1]) {
  const pierna = malla(new THREE.CylinderGeometry(0.2, 0.22, 0.55, 24), pantalon, [0.24 * lado, 0.45, 0]);
  const dobladillo = malla(new THREE.TorusGeometry(0.215, 0.035, 10, 28), pantalon, [0.24 * lado, 0.2, 0]);
  dobladillo.rotation.x = Math.PI / 2;
  const pie = esf(0.2, piel, [0.25 * lado, 0.09, 0.08], [1.1, 0.55, 1.45]);
  saurio.add(pierna, dobladillo, pie);
  for (let d = -1; d <= 1; d++) {
    saurio.add(esf(0.065, pielOsc, [0.25 * lado + d * 0.1, 0.06, 0.34], [1, 0.8, 1]));
  }
}
// cadera y cinturón
saurio.add(esf(0.5, pantalon, [0, 0.85, 0], [1.08, 0.55, 0.88]));
const cinturon = malla(new THREE.CylinderGeometry(0.535, 0.54, 0.09, 40, 1, true), cinto, [0, 1.0, 0], [1, 1, 0.82]);
saurio.add(cinturon);
saurio.add(malla(new THREE.BoxGeometry(0.13, 0.1, 0.03), hebilla, [0, 1.0, 0.45]));
saurio.add(malla(new THREE.BoxGeometry(0.07, 0.05, 0.035), cinto, [0, 1.0, 0.455]));

// ---------- torso con camisa ----------
const torso = esf(0.55, camisa, [0, 1.3, 0], [1, 0.72, 0.82]);
saurio.add(torso);
// botones
for (let i = 0; i < 3; i++) saurio.add(esf(0.018, mat(0xdddddd), [0, 1.52 - i * 0.16, 0.445 - i * 0.004]));
// cuello de la camisa
for (const lado of [-1, 1]) {
  const solapa = malla(new THREE.BoxGeometry(0.2, 0.03, 0.14), camisa, [0.1 * lado, 1.66, 0.25]);
  solapa.rotation.set(-0.5, 0, -0.5 * lado);
  saurio.add(solapa);
}
// logo GB en el pecho
const logo = malla(new THREE.CircleGeometry(0.085, 32), new THREE.MeshStandardMaterial({ map: texGB, roughness: 0.5 }),
  [0.24, 1.42, 0.425]);
logo.rotation.y = 0.45;
saurio.add(logo);

// ---------- cola (sale de atrás y sube en curva) ----------
const cola = [];
let padre = saurio;
for (let i = 0; i < 7; i++) {
  const seg = new THREE.Group();
  if (i === 0) seg.position.set(0.1, 0.75, -0.42);
  else seg.position.set(0.06, 0.03 + i * 0.012, -0.17);
  seg.add(esf(0.24 - i * 0.03, piel, null, [1, 0.85, 1.25]));
  padre.add(seg);
  cola.push(seg);
  padre = seg;
}

// ---------- brazos (con codo para poder posar) ----------
function brazo(lado) {
  const hombro = new THREE.Group();
  hombro.position.set(0.5 * lado, 1.5, 0);
  const manga = malla(new THREE.CylinderGeometry(0.15, 0.17, 0.26, 20), camisa, [0, -0.08, 0]);
  const arriba = cap(0.1, 0.18, piel, [0, -0.22, 0]);
  const codo = new THREE.Group();
  codo.position.y = -0.36;
  const ante = cap(0.095, 0.16, piel, [0, -0.12, 0]);
  const mano = new THREE.Group();
  mano.position.y = -0.3;
  mano.add(esf(0.12, piel, null, [1, 0.9, 0.75]));
  const pulgar = cap(0.04, 0.08, piel, [-0.1 * lado, 0.02, 0.06]);
  pulgar.rotation.z = 0.6 * lado;
  mano.add(pulgar);
  const indice = cap(0.035, 0.12, piel, [0, -0.13, 0.04]);
  indice.visible = false; // solo se ve al señalar
  mano.add(indice);
  codo.add(ante, mano);
  hombro.add(manga, arriba, codo);
  saurio.add(hombro);
  return { hombro, codo, mano, pulgar, indice, lado };
}
const brazoDer = brazo(-1); // brazo derecho del personaje (a la izquierda de la pantalla)
const brazoIzq = brazo(1);

// ---------- cuello y cabeza ----------
const cuello = new THREE.Group();
cuello.position.set(0, 1.62, 0.02);
saurio.add(cuello);
cuello.add(cap(0.2, 0.12, piel, [0, 0.08, 0]));
const cabeza = new THREE.Group();
cabeza.position.set(0, 0.5, 0.06);
cabeza.scale.setScalar(1.28);
cuello.add(cabeza);

cabeza.add(esf(0.5, piel, [0, 0.08, -0.04], [1, 0.95, 0.95]));       // cráneo
cabeza.add(esf(0.44, piel, [0, -0.12, 0.2], [1.05, 0.62, 0.85]));    // hocico ancho
// fosas nasales
for (const lado of [-1, 1]) cabeza.add(esf(0.03, mat(0x7a3a0c), [0.09 * lado, 0.04, 0.55], [1, 0.6, 1]));
// protuberancias de la nuca
for (const [x, y, z] of [[0, 0.0, -0.5], [0.22, -0.05, -0.43], [-0.22, -0.05, -0.43], [0, -0.25, -0.42]]) {
  cabeza.add(esf(0.055, pielOsc, [x, y, z]));
}

// boca sonriente (se abre al hablar)
const bocaGrupo = new THREE.Group();
bocaGrupo.position.set(0, -0.19, 0.42);
cabeza.add(bocaGrupo);
const interior = esf(0.25, boca, [0, -0.04, 0], [1.3, 0.6, 0.5]);
const lengua = esf(0.15, lenguaM, [0, -0.1, 0.05], [1.2, 0.4, 0.8]);
const dientes = esf(0.2, blanco, [0, 0.03, 0.06], [1.15, 0.15, 0.5]);
const labioSup = esf(0.28, piel, [0, 0.1, -0.02], [1.3, 0.3, 0.5]);
bocaGrupo.add(interior, lengua, dientes, labioSup);
const mandibula = new THREE.Group();
mandibula.position.set(0, -0.06, -0.05);
mandibula.add(esf(0.27, piel, [0, -0.1, 0.0], [1.2, 0.36, 0.55]));
bocaGrupo.add(mandibula);

// ojos grandes cafés
const ojos = [], parpados = [];
for (const lado of [-1, 1]) {
  const o = new THREE.Group();
  o.position.set(0.2 * lado, 0.13, 0.36);
  o.rotation.y = 0.25 * lado;
  o.add(esf(0.13, blanco, null, [1, 1.15, 0.7]));
  const pupila = new THREE.Group();
  pupila.add(esf(0.075, iris, [0, 0, 0.065], [1, 1.1, 0.5]));
  pupila.add(esf(0.042, negro, [0, 0, 0.09], [1, 1.1, 0.4]));
  pupila.add(esf(0.017, blanco, [0.025, 0.035, 0.105]));
  o.add(pupila);
  const parp = esf(0.135, piel, [0, 0.02, 0], [1.02, 1.2, 0.75]);
  parp.scale.y = 0.01;
  o.add(parp);
  cabeza.add(o);
  ojos.push(pupila);
  parpados.push(parp);
}

// gorra azul con "M" y visera
const gorraG = new THREE.Group();
gorraG.position.set(0, 0.26, -0.06);
gorraG.rotation.x = -0.1;
cabeza.add(gorraG);
gorraG.add(malla(new THREE.SphereGeometry(0.53, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), gorra, [0, 0.02, 0], [1, 0.82, 1]));
const ribete = malla(new THREE.TorusGeometry(0.525, 0.025, 8, 48), gorra, [0, 0.02, 0]);
ribete.rotation.x = Math.PI / 2;
gorraG.add(ribete);
const visera = malla(new THREE.CylinderGeometry(0.46, 0.46, 0.04, 40, 1, false, -Math.PI / 2, Math.PI), mat(0x155ea8, { roughness: 0.7 }), [0, 0.05, 0.28], [0.95, 1, 1.25]);
visera.rotation.x = 0.12;
gorraG.add(visera);
gorraG.add(esf(0.045, gorra, [0, 0.45, 0]));
const letraM = malla(new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshStandardMaterial({ map: texM, transparent: true, roughness: 0.6 }),
  [0, 0.24, 0.47]);
letraM.rotation.x = -0.45;
gorraG.add(letraM);

// sombra en el piso
const sombra = malla(new THREE.CircleGeometry(0.7, 32),
  new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.16 }), [0, 0.005, 0.05]);
sombra.rotation.x = -Math.PI / 2;
escena.add(sombra);

const GIRO_BASE = -0.45;
saurio.rotation.y = GIRO_BASE;

// ---------- poses de brazos (inspiradas en la hoja de referencia) ----------
// valores: [hombro.x (adelante -), hombro.z, codo.x, codo.z]
const POSES = {
  reposo:   { der: [0.05, -0.12, -0.25, 0], izq: [0.05, 0.12, -0.25, 0] },
  pulgar:   { der: [-0.55, -0.25, -1.9, 0.2], izq: [0.05, 0.12, -0.25, 0] },       // 👍 feliz
  barbilla: { der: [-0.75, 0.45, -2.1, 0.3], izq: [-0.35, -0.15, -1.2, 0] },        // 🤔 pensando
  oreja:    { der: [-0.7, -2.3, 0, -1.4], izq: [0.05, 0.12, -0.25, 0] },           // 👂 escuchando
  senalar:  { der: [-1.35, -0.45, -0.1, 0], izq: [-0.2, 0.25, -1.0, 0] },           // 👉 alerta
  saludo:   { der: [0.05, -0.12, -0.25, 0], izq: [-0.2, 2.5, -0.4, 0] },            // 👋 hola
};
let poseActual = "reposo";
function aplicarPose(b, v, k, t) {
  b.hombro.rotation.x = THREE.MathUtils.lerp(b.hombro.rotation.x, v[0], k);
  b.hombro.rotation.z = THREE.MathUtils.lerp(b.hombro.rotation.z, v[1], k);
  b.codo.rotation.x = THREE.MathUtils.lerp(b.codo.rotation.x, v[2], k);
  b.codo.rotation.z = THREE.MathUtils.lerp(b.codo.rotation.z, v[3], k);
}

// ---------- comportamiento ----------
let estado = "idle", desde = performance.now(), hablarHasta = 0;
let mirarX = 0, mirarY = 0;

window.addEventListener("pointermove", (e) => {
  const r = caja.getBoundingClientRect();
  mirarX = THREE.MathUtils.clamp((e.clientX - (r.left + r.width / 2)) / 300, -1, 1);
  mirarY = THREE.MathUtils.clamp((e.clientY - (r.top + r.height * 0.3)) / 300, -1, 1);
});

window.saurio = {
  estado(s) {
    estado = s; desde = performance.now();
    if (s === "hablando") hablarHasta = desde + 1800;
  },
  saludar() { estado = "saludo"; desde = performance.now(); },
};

const reloj = new THREE.Clock();
function cuadro() {
  const t = reloj.getElapsedTime();
  const dt = (performance.now() - desde) / 1000;

  // respiración y cola
  torso.scale.y = 0.72 + Math.sin(t * 2) * 0.008;
  cola.forEach((s, i) => { s.rotation.y = Math.sin(t * 2 - i * 0.5) * 0.12 + 0.12; s.rotation.x = -0.12; });

  // mirada que sigue al mouse
  cabeza.rotation.y = THREE.MathUtils.lerp(cabeza.rotation.y, mirarX * 0.5 - GIRO_BASE * 0.6, 0.08);
  cabeza.rotation.x = THREE.MathUtils.lerp(cabeza.rotation.x, mirarY * 0.25, 0.08);
  ojos.forEach((o) => { o.position.x = mirarX * 0.03; o.position.y = -mirarY * 0.025; });

  // parpadeo
  const cerrado = (t % 4.3) > 4.15;
  parpados.forEach((p) => { p.scale.y = THREE.MathUtils.lerp(p.scale.y, cerrado ? 1.2 : 0.01, 0.5); });

  let salto = 0, inclinacion = 0, cejasArriba = 0, bocaAbierta = 0.22;
  brazoDer.indice.visible = false;

  switch (estado) {
    case "pensando":
      poseActual = "barbilla";
      inclinacion = 0.12 + Math.sin(t * 2) * 0.04;
      cejasArriba = 0.03;
      bocaAbierta = 0.05;
      break;
    case "escuchando":
      poseActual = "oreja";
      inclinacion = -0.15;
      cejasArriba = 0.04;
      break;
    case "feliz":
      poseActual = "pulgar";
      salto = Math.max(0, Math.sin(dt * 8)) * 0.18;
      bocaAbierta = 0.45;
      if (dt > 1.8) estado = "idle";
      break;
    case "alerta":
      poseActual = "senalar";
      brazoDer.indice.visible = true;
      salto = Math.max(0, Math.sin(dt * 10)) * 0.12;
      cejasArriba = 0.05;
      bocaAbierta = 0.25;
      if (dt > 2.5) estado = "idle";
      break;
    case "saludo":
      poseActual = "saludo";
      brazoIzq.codo.rotation.z = Math.sin(t * 12) * 0.5;
      bocaAbierta = 0.3;
      if (dt > 1.6) estado = "idle";
      break;
    default:
      poseActual = "reposo";
  }
  const k = 0.12;
  aplicarPose(brazoDer, POSES[poseActual].der, k);
  if (estado !== "saludo") aplicarPose(brazoIzq, POSES[poseActual].izq, k);
  else {
    const v = POSES.saludo.izq;
    brazoIzq.hombro.rotation.x = THREE.MathUtils.lerp(brazoIzq.hombro.rotation.x, v[0], k);
    brazoIzq.hombro.rotation.z = THREE.MathUtils.lerp(brazoIzq.hombro.rotation.z, v[1], k);
    brazoIzq.codo.rotation.x = THREE.MathUtils.lerp(brazoIzq.codo.rotation.x, v[2], k);
  }
  // pulgar arriba en la pose feliz
  brazoDer.pulgar.position.y = poseActual === "pulgar" ? 0.1 : 0.02;
  brazoDer.pulgar.rotation.z = poseActual === "pulgar" ? 0 : -0.6;

  // boca: se abre mientras habla
  const hablando = performance.now() < hablarHasta;
  const objetivo = hablando ? 0.12 + Math.abs(Math.sin(t * 13)) * 0.35 : bocaAbierta;
  mandibula.rotation.x = THREE.MathUtils.lerp(mandibula.rotation.x, objetivo, 0.35);
  if (estado === "hablando" && !hablando) estado = "idle";
  // ojos más abiertos cuando escucha o se sorprende
  ojos.forEach((o) => o.scale.setScalar(THREE.MathUtils.lerp(o.scale.x, 1 + cejasArriba * 3, 0.15)));

  saurio.position.y = salto;
  cabeza.rotation.z = THREE.MathUtils.lerp(cabeza.rotation.z, inclinacion, 0.1);
  sombra.scale.setScalar(1 - salto);

  renderer.render(escena, camara);
  requestAnimationFrame(cuadro);
}
cuadro();
