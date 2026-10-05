// GB Saurio en 3D: un dinosaurio armado con figuras simples (sin modelos externos).
import * as THREE from "three";

const caja = document.getElementById("mascota");
const W = caja.clientWidth, H = caja.clientHeight;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(W, H);
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
caja.appendChild(renderer.domElement);

const escena = new THREE.Scene();
const camara = new THREE.PerspectiveCamera(32, W / H, 0.1, 100);
camara.position.set(0, 1.5, 6.4);
camara.lookAt(0, 1.05, 0);

escena.add(new THREE.HemisphereLight(0xffffff, 0x3a5a40, 1.4));
const sol = new THREE.DirectionalLight(0xffffff, 1.6);
sol.position.set(3, 5, 4);
sol.castShadow = true;
escena.add(sol);

// ---------- materiales ----------
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...extra });
const verde = mat(0x2fae66), verdeOsc = mat(0x1f8a4f), panza = mat(0xc9f0c0);
const naranja = mat(0xffa53a), blanco = mat(0xffffff, { roughness: 0.2 }), negro = mat(0x111111, { roughness: 0.2 });
const rosa = mat(0xe86a7a);

const esfera = (r, m, sx = 1, sy = 1, sz = 1) => {
  const o = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 24), m);
  o.scale.set(sx, sy, sz); o.castShadow = true; return o;
};

// ---------- cuerpo ----------
const saurio = new THREE.Group();
escena.add(saurio);

const cuerpo = new THREE.Group();
cuerpo.position.y = 0.95;
saurio.add(cuerpo);
cuerpo.add(esfera(0.62, verde, 1, 1.1, 0.95));
const barriga = esfera(0.5, panza, 0.85, 1.0, 0.6);
barriga.position.set(0, -0.05, 0.3);
cuerpo.add(barriga);

// espinas en la espalda
for (let i = 0; i < 5; i++) {
  const e = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.3, 4), naranja);
  const a = -0.2 + i * 0.42;
  e.position.set(0, 0.55 * Math.cos(a) + 0.05, -0.55 * Math.sin(a) - 0.05);
  e.rotation.x = -a;
  cuerpo.add(e);
}

// cola: segmentos que se mueven en onda
const cola = [];
let padre = cuerpo;
for (let i = 0; i < 6; i++) {
  const seg = new THREE.Group();
  seg.position.set(0, i === 0 ? -0.3 : -0.04, i === 0 ? -0.5 : -0.24);
  const r = 0.32 - i * 0.045;
  seg.add(esfera(r, verde, 1, 0.9, 1.2));
  if (i % 2 === 0) {
    const p = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 4), naranja);
    p.position.y = r * 0.9;
    seg.add(p);
  }
  padre.add(seg);
  cola.push(seg);
  padre = seg;
}

// patas
const patas = [];
for (const lado of [-1, 1]) {
  const p = new THREE.Group();
  p.position.set(0.32 * lado, -0.5, 0.05);
  const muslo = esfera(0.22, verdeOsc, 1, 1.3, 1);
  muslo.position.y = -0.1;
  const pie = esfera(0.17, verdeOsc, 1.1, 0.55, 1.5);
  pie.position.set(0, -0.36, 0.1);
  p.add(muslo, pie);
  cuerpo.add(p);
  patas.push(p);
}

// bracitos
const brazos = [];
for (const lado of [-1, 1]) {
  const b = new THREE.Group();
  b.position.set(0.42 * lado, 0.15, 0.35);
  const br = esfera(0.08, verdeOsc, 1, 2.2, 1);
  br.position.y = -0.12;
  b.add(br);
  b.rotation.x = -0.6;
  cuerpo.add(b);
  brazos.push(b);
}

// ---------- cabeza ----------
const cuello = new THREE.Group();
cuello.position.set(0, 0.55, 0.25);
cuerpo.add(cuello);
const cabeza = new THREE.Group();
cabeza.position.set(0, 0.45, 0.12);
cuello.add(cabeza);
cabeza.add(esfera(0.46, verde, 1, 0.9, 1));
const hocico = esfera(0.32, verde, 0.95, 0.6, 1.35);
hocico.position.set(0, -0.1, 0.4);
cabeza.add(hocico);
for (const lado of [-1, 1]) {
  const n = esfera(0.03, verdeOsc);
  n.position.set(0.1 * lado, 0.0, 0.82);
  cabeza.add(n);
}
// mandíbula (se abre al hablar)
const mandibula = new THREE.Group();
mandibula.position.set(0, -0.24, 0.2);
cabeza.add(mandibula);
const quijada = esfera(0.28, panza, 0.9, 0.32, 1.3);
quijada.position.set(0, -0.02, 0.25);
const lengua = esfera(0.12, rosa, 1, 0.3, 1.1);
lengua.position.set(0, 0.04, 0.3);
mandibula.add(quijada, lengua);

// ojos con pupila y párpado
const ojos = [], parpados = [];
for (const lado of [-1, 1]) {
  const o = new THREE.Group();
  o.position.set(0.24 * lado, 0.2, 0.24);
  o.add(esfera(0.12, blanco));
  const pupila = esfera(0.065, negro);
  pupila.position.z = 0.075;
  const brillo = esfera(0.02, blanco);
  brillo.position.set(0.025, 0.03, 0.13);
  o.add(pupila, brillo);
  const parp = esfera(0.125, verde, 1, 1, 1);
  parp.scale.y = 0.01;
  parp.position.y = 0.05;
  o.add(parp);
  cabeza.add(o);
  ojos.push(pupila);
  parpados.push(parp);
}
// cachetes
for (const lado of [-1, 1]) {
  const c = esfera(0.06, mat(0xff8f9c, { transparent: true, opacity: 0.6 }), 1, 0.6, 0.3);
  c.position.set(0.3 * lado, -0.08, 0.38);
  cabeza.add(c);
}

// sombra en el piso
const sombra = new THREE.Mesh(new THREE.CircleGeometry(0.75, 32),
  new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18 }));
sombra.rotation.x = -Math.PI / 2;
sombra.position.y = 0.01;
escena.add(sombra);

saurio.rotation.y = -0.85;

// ---------- comportamiento ----------
let estado = "idle", desde = performance.now(), hablarHasta = 0;
let mirarX = 0, mirarY = 0;

window.addEventListener("pointermove", (e) => {
  const r = caja.getBoundingClientRect();
  mirarX = THREE.MathUtils.clamp((e.clientX - (r.left + r.width / 2)) / 300, -1, 1);
  mirarY = THREE.MathUtils.clamp((e.clientY - (r.top + r.height * 0.35)) / 300, -1, 1);
});

window.saurio = {
  estado(s) {
    estado = s; desde = performance.now();
    if (s === "hablando") hablarHasta = desde + 1800;
  },
  saludar() { this.estado("feliz"); },
};

const reloj = new THREE.Clock();
function cuadro() {
  const t = reloj.getElapsedTime();
  const dt = (performance.now() - desde) / 1000;

  // respiración y cola
  cuerpo.scale.set(1, 1 + Math.sin(t * 2) * 0.015, 1);
  cola.forEach((s, i) => { s.rotation.y = Math.sin(t * 2.2 - i * 0.6) * 0.18; s.rotation.x = 0.08; });

  // mirada que sigue al mouse
  cabeza.rotation.y = THREE.MathUtils.lerp(cabeza.rotation.y, mirarX * 0.6 + 0.5, 0.08);
  cabeza.rotation.x = THREE.MathUtils.lerp(cabeza.rotation.x, mirarY * 0.3, 0.08);
  ojos.forEach((o) => { o.position.x = mirarX * 0.025; o.position.y = -mirarY * 0.02; });

  // parpadeo
  const cerrado = (t % 4.3) > 4.15;
  parpados.forEach((p) => { p.scale.y = THREE.MathUtils.lerp(p.scale.y, cerrado ? 1 : 0.01, 0.5); });

  let salto = 0, giro = 0, inclinacion = 0;
  brazos.forEach((b) => { b.rotation.z = 0; b.rotation.x = -0.6; });

  switch (estado) {
    case "pensando":
      inclinacion = Math.sin(t * 3) * 0.12;
      salto = Math.abs(Math.sin(t * 4)) * 0.04;
      brazos[1].rotation.x = -1.8; // mano en la barbilla
      break;
    case "escuchando":
      inclinacion = 0.25;
      cuello.rotation.x = Math.sin(t * 1.5) * 0.08;
      break;
    case "feliz":
      salto = Math.max(0, Math.sin(dt * 9)) * 0.35;
      giro = dt < 1 ? dt * Math.PI * 2 : 0;
      brazos.forEach((b, i) => { b.rotation.z = Math.sin(t * 18) * 0.5 * (i ? 1 : -1); b.rotation.x = -2.2; });
      if (dt > 1.6) estado = "idle";
      break;
    case "alerta":
      salto = Math.max(0, Math.sin(dt * 12)) * 0.25;
      brazos[1].rotation.x = -2.6;
      brazos[1].rotation.z = Math.sin(t * 14) * 0.4;
      if (dt > 2.2) estado = "idle";
      break;
  }
  if (estado !== "escuchando") cuello.rotation.x = THREE.MathUtils.lerp(cuello.rotation.x, 0, 0.1);

  // boca: se mueve mientras habla
  const hablando = performance.now() < hablarHasta;
  mandibula.rotation.x = hablando ? Math.abs(Math.sin(t * 14)) * 0.35 : THREE.MathUtils.lerp(mandibula.rotation.x, 0, 0.2);
  if (estado === "hablando" && !hablando) estado = "idle";

  saurio.position.y = salto;
  saurio.rotation.y = -0.85 + giro;
  cabeza.rotation.z = inclinacion;
  sombra.scale.setScalar(1 - salto * 0.8);
  patas.forEach((p, i) => { p.rotation.x = salto > 0.02 ? (i ? 0.3 : -0.3) : 0; });

  renderer.render(escena, camara);
  requestAnimationFrame(cuadro);
}
cuadro();
