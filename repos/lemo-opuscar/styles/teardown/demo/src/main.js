// 《二十一键》 21 Keys, Opened — Exploded Teardown demo. render(t) draws one frame; everything is a function of t.
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { makePost } from '/core/three/post.js';
import { clamp, lerp, seg, ss, eio, track } from '/core/lib.js';
import { keycapGeometry, switchGeometries, shapeFrom, inset, hexSpacer, screwGeometry } from './parts.js';
import { paintPCB } from './pcbtex.js';
import { buildBackParts } from './comps.js';
import { initOverlay, drawOverlay, overlayTexts, subcheck } from './overlay.js';
import * as TL from './timeline.js';

const { T, DUR, OFF, UP, DOWN, UPDUR, DOWNDUR, WAVEUP, WAVEDOWN, GAP, GAP2, CAM } = TL;
const W = 1920, H = 1080;
const Q = new URLSearchParams(location.search);
const D = await (await fetch('data/pcb.json')).json();

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(2); renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .9;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('stage').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(26, W / H, 2.5, 3000);
const post = makePost(renderer, scene, camera, W, H, { ssaa: 2, ao: true, aoRadius: 4, aoThickness: 4, aoScale: 1.6, aoAmt: .7 });
post.bloom.strength = .3; post.bloom.radius = .5; post.bloom.threshold = 1.6;
post.vig.uniforms.amt.value = .32; post.vig.uniforms.contrast.value = .08; post.vig.uniforms.warm.value = .12;
{
  const c = document.createElement('canvas'); c.width = 1920; c.height = 1080; const g = c.getContext('2d');
  const gr = g.createRadialGradient(860, 470, 60, 940, 520, 1250);
  gr.addColorStop(0, '#34363a'); gr.addColorStop(.45, '#232528'); gr.addColorStop(1, '#0d0e10');
  g.fillStyle = gr; g.fillRect(0, 0, 1920, 1080);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; scene.background = t;
}
const hdr = await new RGBELoader().loadAsync('/core/assets/polyhaven/photo_studio_loft_hall_2k.hdr');
hdr.mapping = THREE.EquirectangularReflectionMapping;
scene.environment = new THREE.PMREMGenerator(renderer).fromEquirectangular(hdr).texture;
scene.environmentIntensity = .38; scene.environmentRotation = new THREE.Euler(0, 1.9, 0);
RectAreaLightUniformsLib.init();
const key = new THREE.DirectionalLight('#fff1e2', 1.55);
key.castShadow = true; key.shadow.mapSize.set(4096, 4096);
Object.assign(key.shadow.camera, { left: -150, right: 150, top: 150, bottom: -150, near: 40, far: 1000 });
key.shadow.bias = -.0003; key.shadow.normalBias = .12; key.shadow.radius = 5; key.shadow.blurSamples = 16;
scene.add(key, key.target);
const rim = new THREE.RectAreaLight('#dfe9ff', 4.5, 260, 70); scene.add(rim);
const top = new THREE.RectAreaLight('#ffffff', .45, 300, 300); scene.add(top);
const under = new THREE.RectAreaLight('#ffe9d2', 0, 170, 120); scene.add(under);   // practical fill inside the case for the dive
const sweep = new THREE.RectAreaLight('#ffffff', 0, 26, 220); scene.add(sweep);     // the light sweep across the keycaps
scene.add(new THREE.HemisphereLight('#c9d3e0', '#1a1712', .15));

// ---------- model: board x → world X, board y → world Z, height → world Y (mm) ----------
const bx = D.plate.outline.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [1e9, 1e9, -1e9, -1e9]);
const CX = (bx[0] + bx[2]) / 2, CZ = (bx[1] + bx[3]) / 2;
const root = new THREE.Group(); root.position.set(-CX, 0, -CZ); scene.add(root);
const P = (x, y, h) => new THREE.Vector3(x - CX, h, y - CZ);   // board coords → world
const L = {}; for (const k of TL.LAYERS) { L[k] = new THREE.Group(); root.add(L[k]); }
const BASE = 1.5, PLATE_TOP = BASE + 11.1, PCB_TOP = PLATE_TOP - 5.0;
const shadowy = m => { m.castShadow = true; m.receiveShadow = true; return m; };
const M = {
  pbt: new THREE.MeshPhysicalMaterial({ color: '#d9d4c9', roughness: .66, sheen: .25, sheenRoughness: .8, sheenColor: '#ffffff' }),
  pbtGrey: new THREE.MeshPhysicalMaterial({ color: '#686c73', roughness: .62, sheen: .2, sheenRoughness: .8 }),
  pbtAccent: new THREE.MeshPhysicalMaterial({ color: '#e0582c', roughness: .58, sheen: .2, sheenRoughness: .8 }),
  housingTop: new THREE.MeshPhysicalMaterial({ color: '#b9bcbf', roughness: .38, clearcoat: .3, clearcoatRoughness: .4 }),
  housingBot: new THREE.MeshStandardMaterial({ color: '#2f3135', roughness: .5 }),
  stem: new THREE.MeshPhysicalMaterial({ color: '#e0582c', roughness: .42, clearcoat: .2 }),
  pin: new THREE.MeshStandardMaterial({ color: '#d9b46a', roughness: .28, metalness: 1 }),
  plateTop: new THREE.MeshPhysicalMaterial({ color: '#0e0f10', roughness: .52, clearcoat: .18, clearcoatRoughness: .45 }),
  fr4Edge: new THREE.MeshStandardMaterial({ color: '#8a7e57', roughness: .8 }),
  caseMat: new THREE.MeshPhysicalMaterial({ color: '#4a4e55', roughness: .5, metalness: .8 }),
  brass: new THREE.MeshStandardMaterial({ color: '#c39a55', roughness: .4, metalness: 1 }),
  screw: new THREE.MeshStandardMaterial({ color: '#2a2b2e', roughness: .32, metalness: .9 }),
  rubber: new THREE.MeshStandardMaterial({ color: '#1b1b1c', roughness: .92 }),
  steel: new THREE.MeshStandardMaterial({ color: '#c9ccd0', roughness: .25, metalness: 1 }),
  plastic: new THREE.MeshStandardMaterial({ color: '#18191b', roughness: .55 }),
  led: new THREE.MeshStandardMaterial({ color: '#2a2a2a', emissive: '#ffb571', emissiveIntensity: 0, roughness: .3 }),
  socket: new THREE.MeshPhysicalMaterial({ color: '#141416', roughness: .45, clearcoat: .2 }),
  contact: new THREE.MeshStandardMaterial({ color: '#d8dade', roughness: .22, metalness: 1 }),
  pinGold: new THREE.MeshStandardMaterial({ color: '#d9b46a', roughness: .28, metalness: 1 }),
  ledBody: new THREE.MeshPhysicalMaterial({ color: '#efeee9', roughness: .35, clearcoat: .4 }),
  ceramic: new THREE.MeshStandardMaterial({ color: '#a8875e', roughness: .55 }),
  resistor: new THREE.MeshStandardMaterial({ color: '#1c1c1d', roughness: .5 }),
  mold: new THREE.MeshPhysicalMaterial({ color: '#1d1e20', roughness: .62, clearcoat: .05 }),
  dot: new THREE.MeshStandardMaterial({ color: '#2c2d30', roughness: .8 }),
  can: new THREE.MeshStandardMaterial({ color: '#c3c6ca', roughness: .3, metalness: 1 }),
  tact: new THREE.MeshStandardMaterial({ color: '#cfd1d4', roughness: .3, metalness: .9 }),
};
const invisible = new THREE.MeshBasicMaterial({ visible: false });

// case: the project's STEP, triangulated (tools/step2mesh.mjs)
{
  const buf = await (await fetch('data/case.bin')).arrayBuffer();
  const [nv, ni] = new Uint32Array(buf, 0, 2);
  const Pp = new Float32Array(buf, 8, nv * 3), N = new Float32Array(buf, 8 + nv * 12, nv * 3), I = new Uint32Array(buf, 8 + nv * 24, ni);
  const P2 = new Float32Array(nv * 3), N2 = new Float32Array(nv * 3);
  for (let i = 0; i < nv; i++) { P2[i*3] = Pp[i*3]; P2[i*3+1] = Pp[i*3+2]; P2[i*3+2] = Pp[i*3+1]; N2[i*3] = N[i*3]; N2[i*3+1] = N[i*3+2]; N2[i*3+2] = N[i*3+1]; }
  const I2 = new Uint32Array(ni); for (let i = 0; i < ni; i += 3) { I2[i] = I[i]; I2[i+1] = I[i+2]; I2[i+2] = I[i+1]; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P2, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N2, 3)); g.setIndex(new THREE.BufferAttribute(I2, 1));
  const m = shadowy(new THREE.Mesh(g, M.caseMat)); m.position.y = BASE; L.case.add(m);
}
function slab(shape, depth, capMat, sideMat, y) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 24 });
  const n = g.attributes.normal;   // zero normals left by tiny edges would shade as NaN; point them outward
  for (let i = 0; i < n.count; i++) if (Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) < .5) n.setXYZ(i, 1, 0, 0);
  const m = shadowy(new THREE.Mesh(g, [capMat, sideMat])); m.rotation.x = -Math.PI / 2; m.position.y = y; return m;
}
L.plate.add(slab(shapeFrom(D.plate.outline, D.plate.cutouts, D.plate.holes), 1.6, M.plateTop, M.fr4Edge, PLATE_TOP - 1.6));
const pcbOutline = inset(D.plate.outline, .4);
const pcbHoles = [...D.pcb_holes, ...D.pads.filter(p => p.type === 'np_thru_hole' && p.drill >= 1.8).map(p => ({ c: [p.x, p.y], r: p.drill / 2 }))];
let backAnchors;
{
  const box = [bx[0] - 1, bx[1] - 1, bx[2] + 1, bx[3] + 1];
  const shape = shapeFrom(pcbOutline, [], pcbHoles);
  L.pcb.add(slab(shape, 1.6, invisible, M.fr4Edge, PCB_TOP - 1.6));
  const capG = new THREE.ShapeGeometry(shape, 24);
  for (const side of ['F', 'B']) {
    const t = paintPCB(D, side, pcbOutline, box, side === 'B' ? 20 : 14);
    const mat = new THREE.MeshPhysicalMaterial({ map: t.map, roughnessMap: t.orm, metalnessMap: t.orm, roughness: 1, metalness: 1, bumpMap: t.bump, bumpScale: .9, clearcoat: .12, clearcoatRoughness: .5, side: side === 'F' ? THREE.FrontSide : THREE.BackSide });
    const m = shadowy(new THREE.Mesh(capG, mat)); m.rotation.x = -Math.PI / 2; m.position.y = side === 'F' ? PCB_TOP + .002 : PCB_TOP - 1.6 - .002; L.pcb.add(m);
  }
  const ledG = new THREE.BoxGeometry(3.2, .3, 2.8);
  for (const c of D.comps.filter(c => c.lib.startsWith('YS-SK6812'))) {
    const m = new THREE.Mesh(ledG, M.led); m.position.set(c.x, PCB_TOP - .1, c.y); m.rotation.y = c.rot * Math.PI / 180; L.pcb.add(m);
  }
  backAnchors = buildBackParts(D, L.pcb, PCB_TOP - 1.6, M);
}
{
  const sg = hexSpacer(7.5, 3.5), scr = screwGeometry();
  for (const h of D.plate.holes) {
    const s = shadowy(new THREE.Mesh(sg, M.brass)); s.position.set(h.c[0], BASE + 2.0, h.c[1]); s.rotation.y = .3; L.spacer.add(s);
    const t = shadowy(new THREE.Mesh(scr, M.screw)); t.position.set(h.c[0], PLATE_TOP, h.c[1]); L.screwT.add(t);
    const b = shadowy(new THREE.Mesh(scr, M.screw)); b.position.set(h.c[0], BASE, h.c[1]); b.rotation.x = Math.PI; L.screwB.add(b);
  }
  const fg = new THREE.CylinderGeometry(5, 5.4, BASE, 32); fg.translate(0, BASE / 2, 0);
  for (const [x, y] of [[-131, -17], [-12, -17], [-131, 36], [-30, 62]]) { const f = shadowy(new THREE.Mesh(fg, M.rubber)); f.position.set(x, 0, y); L.feet.add(f); }
}
const caps = [];
let accent = null;
{
  const S = switchGeometries(), cap1 = keycapGeometry(18.0, 18.0, 7.6), cap15 = keycapGeometry(27.5, 18.0, 7.6);
  const minX = Math.min(...D.switches.map(s => s.x));
  for (const s of D.switches) {
    const g = new THREE.Group(); g.position.set(s.x, PCB_TOP, s.y); g.rotation.y = s.rot * Math.PI / 180;
    g.add(shadowy(new THREE.Mesh(S.bottom, M.housingBot)), shadowy(new THREE.Mesh(S.top, M.housingTop)), shadowy(new THREE.Mesh(S.stem, M.stem)));
    // pins sit over the hot-swap socket holes of the footprint (local −2.54, 5.08 and 3.81, 2.54)
    for (const px of [[-2.54, 5.08], [3.81, 2.54]]) { const p = new THREE.Mesh(S.pin, M.pin); p.position.set(px[0], 0, px[1]); g.add(p); }
    L.sw.add(g);
    const outer = Math.abs(s.x - minX) < 1, thumb = s.y > 42;
    const mat = s.u > 1 ? M.pbtAccent : (outer || thumb) ? M.pbtGrey : M.pbt;
    const kc = shadowy(new THREE.Mesh(s.u > 1 ? cap15 : cap1, mat));
    const kg = new THREE.Group(); kg.position.set(s.x, PCB_TOP + 12.4, s.y); kg.rotation.y = s.rot * Math.PI / 180; kg.add(kc); L.cap.add(kg);
    const c = { g: kg, y0: kg.position.y, rank: Math.hypot(s.x - minX, s.y + 10), ref: s.ref, x: s.x, y: s.y };
    caps.push(c); if (s.u > 1) accent = c;
  }
  const rmax = Math.max(...caps.map(c => c.rank)); caps.forEach(c => c.rank /= rmax);
}
const floor = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.ShadowMaterial({ color: '#000000', opacity: .38 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

// ---------- motion ----------
const pop = x => 1 - Math.pow(1 - ss(x), 3);
function layerE(k, t, extra = 0) {
  const a = pop(seg(t, UP[k] + extra * WAVEUP, UP[k] + extra * WAVEUP + UPDUR));
  const d = eio(seg(t, DOWN[k] + extra * WAVEDOWN, DOWN[k] + extra * WAVEDOWN + DOWNDUR));
  return a * (1 - d);
}
const gapE = (G, k, t) => G.layers.includes(k) ? G.lift * eio(seg(t, G.open[0], G.open[1])) * (1 - eio(seg(t, G.close[0], G.close[1]))) : 0;
const FL = { case: 0, screwB: .3, spacer: .9, pcb: 1.6, plate: 2.3, screwT: 2.3, sw: 3.0, cap: 3.8 };
// float only while held apart and not during the macro stops (a moving subject at 30 mm reads as shake)
const floatAmt = t => 1 - seg(t, T.dive - .6, T.dive) + seg(t, T.pullOut, T.pullOut + .6);
const fl = (k, e, t) => e * e * 1.3 * Math.sin(t * 2.4 + FL[k]) * clamp(floatAmt(t));
const layerY = (k, t, extra = 0) => { const e = layerE(k, t, extra); return OFF[k] * e + gapE(GAP, k, t) + gapE(GAP2, k, t) + fl(k, e, t); };
function capLandT(c) { return DOWN.cap + c.rank * WAVEDOWN + DOWNDUR; }
function capY(c, t) {
  let y = c.y0 + layerY('cap', t, c.rank);
  const land = seg(t, capLandT(c), capLandT(c) + .45);
  if (land > 0 && land < 1) y -= 2.2 * Math.sin(land * Math.PI) * (1 - land);
  if (c === accent) { const k = seg(t, T.tap, T.tap + .36); if (k > 0 && k < 1) y -= 4.0 * (k < .22 ? ss(k / .22) : k < .45 ? 1 : 1 - ss((k - .45) / .55)); }   // one real 4 mm keystroke
  return y;
}

// ---------- camera: eye/target keys ----------
const keys = CAM.map(k => {
  const [t, mode] = k; let eye, tgt, fov, shift;
  if (mode === 'o') {
    const [, , az, el, dist, tg, f, s] = k; const A = az * Math.PI / 180, E = el * Math.PI / 180;
    tgt = P(...tg); eye = tgt.clone().add(new THREE.Vector3(dist * Math.cos(E) * Math.sin(A), dist * Math.sin(E), dist * Math.cos(E) * Math.cos(A))); fov = f; shift = s;
  } else { const [, , e, tg, f, s] = k; eye = P(...e); tgt = P(...tg); fov = f; shift = s; }
  return { t, v: [eye.x, eye.y, eye.z, tgt.x, tgt.y, tgt.z, fov, shift] };
});
// monotone cubic per component: no overshoot, so held keys really hold (Catmull-Rom overshot the macro stops)
const camTrack = track(keys.map(k => [k.t, k.v]));
const camAt = t => camTrack(t);
function setCamera(t) {
  const [ex, ey, ez, tx, ty, tz, fov, shift] = camAt(t);
  camera.position.set(ex, ey, ez); camera.fov = fov; camera.lookAt(tx, ty, tz);
  camera.setViewOffset(W, H, shift, 0, W, H); camera.updateProjectionMatrix();
  const dist = Math.hypot(ex - tx, ey - ty, ez - tz);
  post.dof.focus = dist; post.dof.aper = 760; post.dof.maxCoc = 14;
  const A = Math.atan2(ex - tx, ez - tz), la = A - .9;
  key.position.set(-160 * Math.cos(la) + 60, 330, 160 * Math.sin(la) + 160); key.target.position.set(0, 40, 0);
  rim.position.set(170 * Math.sin(A + 2.6), 120, 170 * Math.cos(A + 2.6)); rim.lookAt(0, 50, 0);
  top.position.set(0, 320, 0); top.lookAt(0, 0, 0);
}

// ---------- events for the mixer (window.EV) ----------
const EV = [];
EV.push({ t: T.tap, type: 'tap' }, { t: T.tap + .2, type: 'tapUp' }, { t: T.suck, type: 'suck' });
for (const k of ['sw', 'plate', 'pcb', 'spacer', 'case']) EV.push({ t: UP[k], type: 'launch', layer: k });
for (const c of caps) EV.push({ t: +(UP.cap + c.rank * WAVEUP).toFixed(3), type: 'capUp', pan: clamp((c.x - CX) / 80, -1, 1) });
for (const k of ['case', 'spacer', 'pcb', 'plate', 'sw']) EV.push({ t: DOWN[k] + DOWNDUR, type: 'land', layer: k });
for (const c of caps) EV.push({ t: +capLandT(c).toFixed(3), type: 'capLand', pan: clamp((c.x - CX) / 80, -1, 1) });
EV.push({ t: GAP.open[0], type: 'gap' }, { t: T.dive, type: 'dive' }, { t: T.swTravel, type: 'travel' }, { t: T.pullOut, type: 'pull' }, { t: T.card, type: 'card' });
EV.push({ t: T.chip, type: 'stop', n: 0 }, { t: T.led, type: 'stop', n: 1 }, { t: T.sw, type: 'stop', n: 2 }, { t: T.led + .3, type: 'ledOn' });
for (const [id, [t0]] of Object.entries(TL.LBL).filter(([k]) => k !== 'layers')) EV.push({ t: t0, type: id.startsWith('dim') ? 'dim' : 'label', id });
for (let i = 0; i < 6; i++) EV.push({ t: +(TL.LBL.layers.t0 + i * TL.LBL.layers.step).toFixed(3), type: 'label', id: 'layer' + i });
EV.sort((a, b) => a.t - b.t);
window.EV = EV; window.DUR = DUR;

// ---------- frame ----------
const world = (k, x, y, h, rank = .8) => {
  const off = k === 'cap' ? layerY('cap', curT, rank) : k ? L[k].position.y : 0;
  return P(x, y, h + off);
};
let curT = 0;
await initOverlay();
window.render = t => {
  curT = t;
  for (const k of TL.LAYERS) if (k !== 'cap' && k !== 'feet') L[k].position.y = layerY(k, t);
  for (const c of caps) c.g.position.y = capY(c, t);
  M.led.emissiveIntensity = 2.4 * clamp(layerE('pcb', t) * 1.4) + 3.0 * seg(t, T.led + .3, T.led + .8) * (1 - seg(t, T.swTravel, T.swTravel + .6));
  under.intensity = 2.6 * seg(t, T.dive - .4, T.dive + .9) * (1 - seg(t, T.swTravel, T.swTravel + .8));
  under.position.copy(P(-72, 30, 34)); under.lookAt(P(-72, 30, 120));
  // the opening light sweep: a narrow softbox gliding over the keycaps from right to left
  const sw = seg(t, 0, 4.2);
  sweep.intensity = 3.2 * Math.sin(Math.PI * clamp(sw)) ** .7;
  sweep.position.copy(P(lerp(15, -160, ss(sw)), 30, 100)); sweep.lookAt(P(lerp(5, -150, ss(sw)), 20, 20));
  setCamera(t);
  post.composer.render();
  drawOverlay(t, camera, { world, anchors: backAnchors, root, W, H });
};
window.TEXTS = () => overlayTexts();
window.DBG = t => ({ cam: camAt(t).map(v => +v.toFixed(1)), sw: +layerY('sw', t).toFixed(1), cap: +layerY('cap', t, .5).toFixed(1), pcb: +layerY('pcb', t).toFixed(1), CX, CZ });
await document.fonts.ready;
window.SUBCHECK = subcheck();
window.render(Number(Q.get('t') || 0));
window.READY = true;
