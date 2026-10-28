// 《林下的田》 The Fields Under the Forest — LiDAR Survey library demo.
// One continuous camera over 0.74 km² of forest in Ashford, Connecticut (USGS 3DEP 2016 points, NAIP 2016 photo).
// render(t) is deterministic: every frame can be drawn alone.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { T, VO, CAM, PEEL_STEPS, BEAT } from './timeline.js';

const W = 1920, H = 1080, SS = 2, DUR = T.dur;
const Q = new URLSearchParams(location.search);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const ss = t => t * t * (3 - 2 * t);
const eio = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const eo = t => 1 - Math.pow(1 - t, 3);
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const lin = h => new THREE.Vector3(...hex(h).map(c => Math.pow(c, 2.2)));

// ---------------- palette ----------------
const C = {
  bg: '#05080a', fog: '#0a1013',
  vLow: '#1f3f35', vMid: '#5c9a7a', vHigh: '#e2f3dc', gpt: '#c8b38c',
  clay: '#bdb5a6', shade: '#26303a', scan: '#d4fff0', amber: '#ffb347', forest: '#83c495',
  ink: '#eef3f1', dim: '#a9b8b3', faint: '#7f908b',
};

const [facts, PROF, cues, pbuf, gbuf, cbuf] = await Promise.all([
  fetch('data/facts.json').then(r => r.json()),
  fetch('data/profile_C.json').then(r => r.json()),
  fetch('cues.json').then(r => r.ok ? r.json() : null).catch(() => null),
  fetch('assets/raw/build/points.bin').then(r => r.arrayBuffer()),
  fetch('assets/raw/build/ground.bin').then(r => r.arrayBuffer()),
  fetch('assets/raw/build/canopy.bin').then(r => r.arrayBuffer()),
]);
const naip = await new THREE.TextureLoader().loadAsync('assets/raw/build/naip.jpg');
naip.colorSpace = THREE.SRGBColorSpace; naip.anisotropy = 8;
const q = facts.quant, PR = facts.profile;

// ---------------- renderer ----------------
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(SS); renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
renderer.setClearColor(new THREE.Color().setRGB(...hex(C.bg).map(c => Math.pow(c, 2.2))), 1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, W / H, 1, 5000);
camera.rotation.order = 'YXZ';

const U = {   // shared uniforms
  uF1: { value: -1e4 }, uF2: { value: -1e4 }, uCut: { value: 99 }, uT: { value: 0 }, uPx: { value: SS }, uProj: { value: 1 },
  uW: { value: 0 }, uGhost: { value: 0 }, uPhoto: { value: 1 }, uGround: { value: 1 },
  uFog: { value: lin(C.fog) }, uBg: { value: lin(C.bg) }, uScan: { value: lin(C.scan) }, uAmber: { value: lin(C.amber) },
  uSecP: { value: new THREE.Vector2(PR.centre[0], PR.centre[1]) }, uSecD: { value: new THREE.Vector2(PR.dir[0], PR.dir[1]) }, uSec: { value: 0 },
};
// survey extent: the forest west of the modern lane and houses (x < 235 m)
const EXT = /* glsl */`
  float extent(vec2 en){
    float e = smoothstep(240.0, 190.0, en.x) * smoothstep(-372.0, -320.0, en.x) * smoothstep(-500.0, -440.0, en.y) * smoothstep(500.0, 440.0, en.y);
    return e;
  }`;

// ---------------- points ----------------
const N = new Uint32Array(pbuf, 0, 1)[0];
let o = 4;
const ppos = new Uint16Array(pbuf, o, N * 3); o += N * 6;
const phag = new Uint8Array(pbuf, o, N); o += N;
const pcls = new Uint8Array(pbuf, o, N); o += N;
const pint = new Uint8Array(pbuf, o, N); o += N;
const prnd = new Uint8Array(pbuf, o, N);
const pg = new THREE.BufferGeometry();
pg.setAttribute('position', new THREE.Uint16BufferAttribute(ppos, 3));
pg.setAttribute('hag', new THREE.Uint8BufferAttribute(phag, 1));
pg.setAttribute('cls', new THREE.Uint8BufferAttribute(pcls, 1));
pg.setAttribute('inten', new THREE.Uint8BufferAttribute(pint, 1, true));
pg.setAttribute('rnd', new THREE.Uint8BufferAttribute(prnd, 1, true));
const pointVS = (ghost) => /* glsl */`
  attribute float hag, cls, inten, rnd;
  uniform vec3 uOff, uSc, cLow, cMid, cHigh, cG, uFog, uScan;
  uniform float uF1, uF2, uCut, uPx, uProj, uGhost, uT;
  varying vec3 vCol;
  ${EXT}
  void main(){
    vec3 L = position * uSc + uOff;                  // east, north, up
    float h = hag / 8.0;
    bool veg = cls > 0.5 && cls < 1.5;
    float lift = 0.0, k = 1.0, hot = 0.0;
    k *= step(0.0, uF1 - L.x);                       // points exist behind the first scan line only
    hot += exp(-max(uF1 - L.x, 0.0) / 6.0) * step(0.0, uF1 - L.x) * step(uF1, 400.0);
    if (veg) {
      float above = h - uCut;                         // the cutting plane peels the canopy from the top
      lift = max(above, 0.0) * 2.2 + max(above, 0.0) * max(above, 0.0) * 0.35;
      k *= 1.0 - smoothstep(0.0, 5.0, above);
      hot += exp(-abs(above) / 0.7) * step(uCut, 40.0) * 0.9 * smoothstep(1.5, 5.0, h);
      ${ghost ? 'k = uGhost * (1.0 - smoothstep(0.0, 4.0, h - uCut)) * smoothstep(1.0, 3.0, h);' : 'k *= 1.0 - uGhost;'}
    } else {
      k *= 1.0 - smoothstep(-2.0, 10.0, uF2 - L.x) * ${ghost ? '1.0' : '1.0'};   // ground returns give way to the surface
      ${ghost ? 'k = 0.0;' : ''}
    }
    float ex = extent(L.xy);
    if (veg) k = mix(${ghost ? '0.0' : '1.0'} * step(0.0, uF1 - L.x), k, ex); else k = mix(step(0.0, uF1 - L.x), k, ex);
    vec3 P = vec3(L.x, L.z + lift, -L.y);
    vec4 mv = modelViewMatrix * vec4(P, 1.0);
    gl_Position = projectionMatrix * mv;
    float dist = -mv.z;
    gl_PointSize = clamp((veg ? ${ghost ? '.22' : '.15'} : .20) * uProj / dist, ${ghost ? '1.6' : '1.0'} * uPx, 5.0 * uPx) * k * (1.0 + 0.8 * hot);
    if (k < .02) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vec3 c;
    if (veg) {
      float u = clamp(h / 28.0, 0.0, 1.0);
      c = u < .45 ? mix(cLow, cMid, u / .45) : mix(cMid, cHigh, (u - .45) / .55);
      c *= mix(.55, 1.2, inten);
    } else c = cG * mix(.6, 1.15, inten);
    c = mix(c, uScan * 1.8, clamp(hot, 0.0, 1.0));
    if (veg) c = mix(c, uScan * 1.3, smoothstep(0.0, 3.0, h - uCut) * step(uCut, 40.0) * smoothstep(1.5, 5.0, h));   // lifted returns glow as they go
    ${ghost ? 'c = uScan * (0.07 + 0.09 * inten);' : 'c *= mix(.45, 1.0, ex);'}
    float fog = 1.0 - exp(-dist / 1600.0);
    vCol = mix(c, uFog, fog * .7);
  }`;
const pointFS = /* glsl */`
  varying vec3 vCol;
  void main(){ vec2 p = gl_PointCoord * 2.0 - 1.0; float r2 = dot(p, p); if (r2 > 1.0) discard; gl_FragColor = vec4(vCol * (1.0 - .3 * r2), 1.0); }`;
const pUni = () => ({ ...U, uOff: { value: new THREE.Vector3(q.OX, q.OY, q.OZ) }, uSc: { value: new THREE.Vector3(q.SXY, q.SXY, q.SZ) },
  cLow: { value: lin(C.vLow) }, cMid: { value: lin(C.vMid) }, cHigh: { value: lin(C.vHigh) }, cG: { value: lin(C.gpt) } });
const pmat = new THREE.ShaderMaterial({ uniforms: pUni(), vertexShader: pointVS(false), fragmentShader: pointFS });
const gmat = new THREE.ShaderMaterial({ uniforms: pUni(), vertexShader: pointVS(true), fragmentShader: pointFS,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
const points = new THREE.Points(pg, pmat); points.frustumCulled = false; scene.add(points);
const ghost = new THREE.Points(pg, gmat); ghost.frustumCulled = false; ghost.renderOrder = 5; scene.add(ghost);

// ---------------- ground surface (DTM 0.5 m, local relief x3) ----------------
const [GW, GH] = new Uint32Array(gbuf, 0, 2);
const [GX0, GY0, RES, OZ, SZ] = new Float32Array(gbuf, 8, 5);
o = 28;
const zc = new Uint16Array(gbuf.slice(o, o + GW * GH * 2)); o += GW * GH * 2;
const nq = new Int8Array(gbuf, o, GW * GH * 3); o += GW * GH * 3;
const lt = new Uint8Array(gbuf, o, GW * GH * 4);
const gridMesh = (gw, gh, x0, y0, res, zarr, oz, sz) => {
  const pos = new Float32Array(gw * gh * 3);
  for (let j = 0, v = 0; j < gh; j++) for (let i = 0; i < gw; i++, v++) {
    pos[v * 3] = x0 + i * res; pos[v * 3 + 1] = oz + zarr[v] * sz; pos[v * 3 + 2] = -(y0 + j * res);
  }
  const idx = new Uint32Array((gw - 1) * (gh - 1) * 6);
  for (let j = 0, k = 0; j < gh - 1; j++) for (let i = 0; i < gw - 1; i++) {
    const a = j * gw + i, b = a + 1, c = a + gw, d = c + 1;
    idx[k++] = a; idx[k++] = b; idx[k++] = d; idx[k++] = a; idx[k++] = d; idx[k++] = c;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
};
const zAt = (x, y) => {   // display-surface height at local (east, north)
  const i = clamp((x - GX0) / RES, 0, GW - 1.001), j = clamp((y - GY0) / RES, 0, GH - 1.001);
  const i0 = Math.floor(i), j0 = Math.floor(j), fx = i - i0, fy = j - j0;
  const g = (a, b) => OZ + zc[b * GW + a] * SZ;
  return lerp(lerp(g(i0, j0), g(i0 + 1, j0), fx), lerp(g(i0, j0 + 1), g(i0 + 1, j0 + 1), fx), fy);
};
const gg = gridMesh(GW, GH, GX0, GY0, RES, zc, OZ, SZ);
gg.setAttribute('nrm', new THREE.Int8BufferAttribute(nq, 3, true));
gg.setAttribute('lt', new THREE.Uint8BufferAttribute(lt, 4, true));
const SUN = new THREE.Vector3(Math.sin(-45 * Math.PI / 180) * Math.cos(26 * Math.PI / 180), Math.sin(26 * Math.PI / 180), -Math.cos(-45 * Math.PI / 180) * Math.cos(26 * Math.PI / 180)).normalize();
const gmesh = new THREE.Mesh(gg, new THREE.ShaderMaterial({
  uniforms: { ...U, uSun: { value: SUN }, cClay: { value: lin(C.clay) }, cShade: { value: lin(C.shade) } },
  vertexShader: /* glsl */`
    attribute vec3 nrm; attribute vec4 lt;
    varying vec3 vN, vW; varying vec4 vL; varying float vDist;
    void main(){ vN = nrm; vL = lt; vW = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vDist = -mv.z; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: /* glsl */`
    uniform vec3 uSun, cClay, cShade, uFog, uBg, uScan, uAmber; uniform vec2 uSecP, uSecD;
    uniform float uF2, uW, uSec, uT, uGround;
    varying vec3 vN, vW; varying vec4 vL; varying float vDist;
    ${EXT}
    void main(){
      vec2 en = vec2(vW.x, -vW.z);
      float behind = uF2 - en.x;
      if (behind < 0.0) discard;
      float ext = extent(en);
      if (ext < .005) discard;
      vec3 n = normalize(vN);
      float ao = vL.x, wd = vL.y * 6.0, wv = vL.z, lr = (vL.w - .5) * 2.0;
      float ndl = max(dot(n, uSun), 0.0);
      vec3 col = cClay * (1.25 * ndl + .22 * (.4 + .6 * ao)) + cShade * .25 * (1.0 - ndl);
      col *= .88 + .5 * lr;                               // relief enhancement on crests
      col *= .55 + .45 * ao;
      // survey contours every 2 m, stronger every 10 m
      float cy = vW.y / 2.0, cw = fwidth(cy);
      float ct = 1.0 - smoothstep(cw * .6, cw * 1.6, min(fract(cy), 1.0 - fract(cy)));
      float c10 = 1.0 - smoothstep(cw * .2, cw * 1.0, min(fract(vW.y / 10.0), 1.0 - fract(vW.y / 10.0)) * 5.0);
      col = mix(col, col * .72, ct * .35 * smoothstep(900.0, 250.0, vDist)) ;
      col = mix(col, col * .62, c10 * .5);
      // condensing behind the second scan: a bright seam, then the surface fills in
      float fill = smoothstep(2.0, 60.0, behind);
      col = mix(uScan * .12, col, fill);
      col += uScan * 1.6 * exp(-behind / 0.9);
      // walls: amber on the crest, lit in order along the network
      float on = smoothstep(uW - .002, uW - .03, wv) * step(.001, uW);
      float head = exp(-abs(uW - wv) / .006) * step(wv, uW) * step(.001, uW) * (1.0 - step(1.0, uW));
      float px = fwidth(en.x) + fwidth(en.y);                 // keep the crest line a hairline at any distance
      float line = 1.0 - smoothstep(.15 + px * .5, .55 + px * 1.2, wd);
      col = mix(col, uAmber * 1.05, line * on * .75);
      col += uAmber * (line * head * 1.8 + smoothstep(4.0, .5, wd) * on * .06);
      // section plane through one wall
      vec2 r = en - uSecP; float al = dot(r, uSecD), pe = dot(r, vec2(-uSecD.y, uSecD.x));
      float sec = uSec * exp(-abs(al) / .22) * smoothstep(16.0, 13.0, abs(pe));
      col += uAmber * sec * 2.2;
      float fog = 1.0 - exp(-vDist / 1500.0);
      col = mix(col, uFog, fog * .75);
      col = mix(uBg, col, ext * uGround);
      gl_FragColor = vec4(col, 1.0);
    }`,
}));
gmesh.frustumCulled = false; scene.add(gmesh);

// ---------------- the photo on the canopy surface ----------------
const [CW, CH] = new Uint32Array(cbuf, 0, 2);
const [CX0, CY0, CRES] = new Float32Array(cbuf, 8, 5);
const czc = new Uint16Array(cbuf.slice(28, 28 + CW * CH * 2));
const cg = gridMesh(CW, CH, CX0, CY0, CRES, czc, OZ, SZ);
const photo = new THREE.Mesh(cg, new THREE.ShaderMaterial({
  uniforms: { ...U, tPhoto: { value: naip }, uBox: { value: new THREE.Vector4(GX0, GY0, GX0 + (GW - 1) * RES, GY0 + (GH - 1) * RES) } },
  vertexShader: `varying vec3 vW; varying float vDist; void main(){ vW = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vDist = -mv.z; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tPhoto; uniform vec4 uBox; uniform vec3 uScan, uBg; uniform float uF1, uPhoto;
    varying vec3 vW; varying float vDist;
    void main(){
      vec2 en = vec2(vW.x, -vW.z);
      float ahead = en.x - uF1;
      if (ahead < 0.0 || uPhoto < .01) discard;
      vec2 uv = vec2((en.x - uBox.x) / (uBox.z - uBox.x), (en.y - uBox.y) / (uBox.w - uBox.y));
      vec3 c = texture2D(tPhoto, uv).rgb;
      c = pow(c, vec3(2.2)) * 1.15;
      c += uScan * 2.4 * exp(-ahead / 1.8) * step(uF1, 400.0);
      gl_FragColor = vec4(mix(uBg, c, uPhoto), 1.0);
    }`,
}));
photo.frustumCulled = false; scene.add(photo);

// ---------------- post ----------------
const composer = new EffectComposer(renderer);
composer.setPixelRatio(SS); composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), .5, .45, .96));
composer.addPass(new OutputPass());
composer.addPass(new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uV: { value: .34 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uV; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 p = vUv - .5; p.x *= 1.5; c.rgb *= 1.0 - uV * smoothstep(.3, .95, length(p)); gl_FragColor = c; }`,
}));

// ---------------- camera ----------------
// Catmull-Rom through the keys over time (non-uniform), every component; heading unwrapped
function camAt(t) {
  const K = CAM; let i = 0;
  while (i < K.length - 2 && t > K[i + 1][0]) i++;
  const k0 = K[Math.max(0, i - 1)], k1 = K[i], k2 = K[i + 1], k3 = K[Math.min(K.length - 1, i + 2)];
  const u = clamp((t - k1[0]) / (k2[0] - k1[0]), 0, 1);
  const out = [];
  for (let c = 1; c < 8; c++) {
    const p0 = k0[c], p1 = k1[c], p2 = k2[c], p3 = k3[c];
    const d1 = k2[0] - k1[0];
    const m1 = (p2 - p0) / Math.max(1e-6, k2[0] - k0[0]) * d1, m2 = (p3 - p1) / Math.max(1e-6, k3[0] - k1[0]) * d1;
    const u2 = u * u, u3 = u2 * u;
    out.push((2 * u3 - 3 * u2 + 1) * p1 + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2 + (u3 - u2) * m2);
  }
  return { tx: out[0], ty: out[1], tz: out[2], dist: out[3], head: out[4], pitch: out[5], fov: out[6] };
}
function placeCamera(t) {
  const c = camAt(t);
  const h = c.head * Math.PI / 180, p = c.pitch * Math.PI / 180;
  const f = new THREE.Vector3(Math.sin(h) * Math.cos(p), -Math.sin(p), -Math.cos(h) * Math.cos(p));
  camera.position.set(c.tx, c.ty, c.tz).addScaledVector(f, -c.dist);
  camera.rotation.set(-p, -h, 0, 'YXZ');
  camera.fov = c.fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  return c;
}

// ---------------- state of the medium over time ----------------
const F1 = t => lerp(-420, 300, eio(seg(t, T.scan1, T.scan1End))) + (t >= T.scan1End ? 1e4 : 0);
const F2 = t => t < T.turn ? -1e4 : lerp(-140, 260, ss(seg(t, T.turn, T.turnEnd + .3))) + (t >= T.turnEnd + 1.2 ? 1e4 : 0);
function cutAt(t) {
  if (t < T.peel - BEAT) return 99;
  if (t < T.peel) return lerp(40, PEEL_STEPS[0], eo(seg(t, T.peel - BEAT, T.peel)));
  const k = Math.min(PEEL_STEPS.length - 2, Math.floor((t - T.peel) / BEAT));
  const u = eo(seg(t - T.peel - k * BEAT, 0, BEAT * .55));
  const v = lerp(PEEL_STEPS[k], PEEL_STEPS[k + 1], u);
  if (t >= T.ghost) return lerp(-6, 33, ss(seg(t, T.ghost, T.closed + 1.2)));   // the forest grows back
  return t >= T.peelEnd ? lerp(0, -6, seg(t, T.peelEnd, T.peelEnd + .4)) : v;
}

// ---------------- overlay ----------------
const ov = document.getElementById('ov'), g2 = ov.getContext('2d');
const SANS = '"Noto Sans SC"', MONO = '"Plex Mono"', COND = '"Barlow Condensed"';
await Promise.all([`400 30px ${SANS}`, `500 30px ${SANS}`, `300 120px ${COND}`, `400 30px ${COND}`, `500 30px ${COND}`, `400 20px ${MONO}`, `500 20px ${MONO}`]
  .map(f => document.fonts.load(f, '林下的田 0123 abc')));
const TXT = [];   // texts registered this frame, for readcheck
const proj = (x, y, z) => { const p = new THREE.Vector3(x, y, z).project(camera); return { x: (p.x * .5 + .5) * W, y: (-p.y * .5 + .5) * H, ok: p.z < 1 }; };
const projEN = (e, n, up = 0) => proj(e, zAt(e, n) + up, -n);
const fmt = (n, d = 0) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
function text(id, s, x, y, font, col, a = 1, align = 'left', reg = true, shadow = true) {
  if (a <= 0.002) return 0;
  g2.save(); g2.globalAlpha = a; g2.font = font; g2.fillStyle = col; g2.textAlign = align; g2.textBaseline = 'alphabetic';
  if (shadow) { g2.shadowColor = 'rgba(0,0,0,.7)'; g2.shadowBlur = 8; }
  g2.fillText(s, x, y); const m = g2.measureText(s); g2.restore();
  const w = m.width, x0 = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
  if (reg && a > .35) TXT.push({ id, text: s, x0, y0: y - m.actualBoundingBoxAscent, x1: x0 + w, y1: y + m.actualBoundingBoxDescent });
  return w;
}
function line(pts, col, w, a = 1, halo = true) {
  if (a <= 0) return;
  g2.save(); g2.lineCap = 'round'; g2.lineJoin = 'round';
  if (halo) { g2.globalAlpha = a * .55; g2.strokeStyle = '#000'; g2.lineWidth = w + 3; g2.beginPath(); pts.forEach((p, i) => i ? g2.lineTo(p.x, p.y) : g2.moveTo(p.x, p.y)); g2.stroke(); }
  g2.globalAlpha = a; g2.strokeStyle = col; g2.lineWidth = w; g2.beginPath(); pts.forEach((p, i) => i ? g2.lineTo(p.x, p.y) : g2.moveTo(p.x, p.y)); g2.stroke(); g2.restore();
}
function plate(x, y, r, a) {   // soft dark plate behind text
  if (a <= 0) return;
  const gr = g2.createRadialGradient(x, y, 10, x, y, r);
  gr.addColorStop(0, `rgba(3,6,7,${.72 * a})`); gr.addColorStop(1, 'rgba(3,6,7,0)');
  g2.fillStyle = gr; g2.fillRect(x - r, y - r, 2 * r, 2 * r);
}
// a reading in the right third: label above, number, source line below
function reading(id, t, t0, t1, x, y, label, value, unit, src, roll = null) {
  const a = seg(t, t0, t0 + .35) * (1 - seg(t, t1 - .35, t1));
  if (a <= 0) return;
  plate(x + 160, y - 30, 380, a);
  text(id + 'L', label, x, y - 112, `500 30px ${SANS}`, C.ink, a);
  let shown = value;
  if (roll) { const u = eo(seg(t, roll[0], roll[1])); shown = roll[2](u); }
  const pop = 1 + .05 * Math.sin(Math.PI * seg(t, roll ? roll[1] : t0 + .2, (roll ? roll[1] : t0 + .2) + .3));
  g2.save(); g2.translate(x, y); g2.scale(pop, pop);
  const w = text(id + 'V', shown, 0, 0, `300 124px ${COND}`, C.amber, a, 'left', false);
  text(id + 'U', unit, w + 10, 0, `400 44px ${COND}`, C.amber, a, 'left', false);
  g2.restore();
  // readcheck sees the landing value from the first frame (a rolling counter reports where it lands)
  g2.font = `300 124px ${COND}`; const wv = g2.measureText(value).width;
  if (a > .35) TXT.push({ id: id + 'V', text: value + ' ' + unit, x0: x, y0: y - 95, x1: x + wv + 60, y1: y + 4 });
  if (src) text(id + 'S', src, x, y + 46, `400 21px ${MONO}`, C.dim, a);
}

// subtitles: transcript strip bottom-left, Chinese line above, English line below, one line each
const SUBS = cues || VO.map((L, i) => ({ id: L.id, t0: L.t - .05, t1: (VO[i + 1] ? VO[i + 1].t - .1 : T.dur - .2), zh: L.zh, en: L.en }));
const SUBX = 96, SUBZ = 968, SUBE = 1010;
function subtitles(t) {
  for (const c of SUBS) {
    if (t < c.t0 || t > c.t1) continue;
    const a = seg(t, c.t0, c.t0 + .12) * (1 - seg(t, c.t1 - .12, c.t1));
    g2.save(); g2.globalAlpha = a;
    const gr = g2.createLinearGradient(SUBX - 30, 0, SUBX + 1100, 0);
    gr.addColorStop(0, 'rgba(4,7,8,.62)'); gr.addColorStop(1, 'rgba(4,7,8,0)');
    g2.fillStyle = gr; g2.fillRect(SUBX - 30, SUBZ - 46, 1130, 116);
    g2.fillStyle = C.ink; g2.fillRect(SUBX - 18, SUBZ - 36, 2, 92);
    g2.restore();
    text('sub_' + c.id + 'z', c.zh, SUBX, SUBZ, `500 36px ${SANS}`, C.ink, a, 'left', false);
    text('sub_' + c.id + 'e', c.en, SUBX, SUBE, `400 30px ${COND}`, C.dim, a, 'left', false);
  }
}
window.SUBCHECK = (() => {
  const safe = 1100; const out = [];
  for (const c of SUBS) {
    g2.font = `500 36px ${SANS}`; const wz = Math.ceil(g2.measureText(c.zh).width);
    g2.font = `400 30px ${COND}`; const we = Math.ceil(g2.measureText(c.en).width);
    out.push({ id: c.id, zh: c.zh, en: c.en, wz, we, ok: wz <= safe && we <= safe });
  }
  return { safe, cues: out, ok: out.every(c => c.ok) };
})();

function drawOverlay(t, cut, cam) {
  g2.clearRect(0, 0, W, H); TXT.length = 0;
  // ---- instruments, top left (place, coordinates, source) ----
  const ia = seg(t, .2, .8) * (1 - seg(t, T.end - .2, T.end + .3));
  plate(260, 70, 420, ia * .8);
  text('i1', '美国 康涅狄格州 阿什福德', 72, 82, `500 26px ${SANS}`, C.ink, ia);
  text('i2', `41.8875°N  72.1960°W  ·  ${facts.area_km2} km²`, 72, 116, `400 20px ${MONO}`, C.dim, ia);
  const ib = t < T.scan1 + .5 ? 'NAIP 航拍 · 2016-07-24' : `USGS 3DEP 2016 · ${fmt(facts.points)} 个回波`;
  const ibA = ia * (t < T.scan1 + .5 ? 1 - seg(t, T.scan1 + .2, T.scan1 + .5) : seg(t, T.scan1 + .5, T.scan1 + .8));
  text(t < T.scan1 + .5 ? 'i3a' : 'i3b', ib, 72, 146, `400 20px ${MONO}`, C.dim, ibA);
  if (t > T.turn + .8 && t < T.end) text('i4', `地形起伏 ×${facts.exag}（局部）`, 72, 176, `400 20px ${MONO}`, C.faint, ia * seg(t, T.turn + .8, T.turn + 1.2));

  // ---- opening label on the photo ----
  {
    const a = seg(t, .6, 1.0) * (1 - seg(t, 3.9, 4.3));
    const p = projEN(-60, 40, 30);
    if (a > 0) { text('photo', '2016 年 7 月 · 夏季航拍', p.x, p.y, `500 34px ${SANS}`, C.ink, a, 'center'); }
  }
  // ---- scan line label ----
  if (t > T.scan1 && t < T.scan1End + .2) {
    const fx = F1(t), a = seg(t, T.scan1, T.scan1 + .3) * (1 - seg(t, T.scan1End - .2, T.scan1End + .1));
    const p = projEN(fx, -60, 40);
    text('scanlbl', '激光扫描 ▸', p.x + 14, p.y, `500 24px ${SANS}`, C.scan, a, 'left', false);
  }
  // ---- reading 0: ground returns ----
  reading('r0', t, T.r0, T.r0Off, 1240, 560, '打到地面的回波', `${facts.ground_share}`, '%', `${fmt(facts.ground)} / ${fmt(facts.points)}`);

  // ---- height ruler during the peel ----
  {
    const a = seg(t, T.peel - BEAT, T.peel - BEAT + .3) * (1 - seg(t, T.peelEnd + .3, T.peelEnd + .7));
    if (a > 0) {
      const x = 1780, y0 = 760, y1 = 300, hm = 30;
      line([{ x, y: y0 }, { x, y: y1 }], C.ink, 1.5, a * .8);
      for (let m = 0; m <= hm; m += 2) {
        const y = lerp(y0, y1, m / hm), big = m % 10 === 0;
        line([{ x: x - (big ? 14 : 7), y }, { x, y }], C.ink, 1.2, a * (big ? .9 : .5), false);
        if (big) text('rul' + m, `${m} m`, x - 22, y + 7, `400 20px ${MONO}`, C.dim, a, 'right');
      }
      const cv = clamp(cut, 0, hm), yc = lerp(y0, y1, cv / hm);
      line([{ x: x - 40, y: yc }, { x: x + 26, y: yc }], C.scan, 2.5, a);
      // the canopy's height distribution, filled where the returns are still there
      const hist = facts.veg_hag_hist, mx = Math.max(...hist.slice(8));
      g2.save(); g2.globalAlpha = a * .8;
      for (let i = 8; i < Math.min(hist.length, hm * 4); i++) {
        const hh = i / 4, y = lerp(y0, y1, hh / hm), wv = hist[i] / mx * 70;
        g2.fillStyle = hh > cv ? 'rgba(212,255,240,.18)' : 'rgba(131,196,149,.85)';
        g2.fillRect(x + 6, y - 1.6, wv, 1.6);
      }
      g2.restore();
      text('rulL', '树冠高度', x + 4, y1 - 30, `500 24px ${SANS}`, C.ink, a, 'center');
    }
  }
  // ---- reading 1: wall length (anchored to the network) ----
  reading('r1', t, T.r1, T.r1Off, 1210, 600, '已描出的石墙', (facts.walls_total_m / 1000).toFixed(1), 'km',
    `${facts.walls_count} 段 · 判读后吸附到墙脊`, [T.r1, T.r1Land, u => (u * facts.walls_total_m / 1000).toFixed(1)]);
  // ---- section: leader + inset graph of the real ground returns ----
  drawSection(t);
  // ---- history: two bars ----
  drawHistory(t);
  // ---- end card ----
  drawEnd(t);
  subtitles(t);
}

function drawSection(t) {
  const a = seg(t, T.r2 - .3, T.r2 + .1) * (1 - seg(t, T.r2Off - .35, T.r2Off));
  if (a <= 0 || !PROF) return;
  const pc = projEN(PR.centre[0], PR.centre[1], 0.4);
  // inset: x = offset across the wall (m), y = height above the shoulders (m), vertical x5
  const gx = 1080, gy = 660, sx = 48, sy = 260;    // px per m
  const panelA = a * seg(t, T.r2, T.r2 + .4);
  plate(gx + 300, gy - 60, 520, a);
  line([{ x: pc.x, y: pc.y }, { x: gx - 40, y: gy - 40 }], C.amber, 1.5, a * .9);
  g2.save(); g2.globalAlpha = panelA; g2.fillStyle = 'rgba(232,226,214,.55)';
  for (const [ox, oz] of PROF.pts) { const x = gx + (ox + 7) * sx, y = gy - oz * sy; if (y > gy - 260 && y < gy + 40) g2.fillRect(x - 1.3, y - 1.3, 2.6, 2.6); }
  g2.restore();
  const med = PROF.bins.map((b, i) => ({ x: gx + (b + 7) * sx, y: gy - (PROF.median[i] ?? 0) * sy }));
  const grow = eo(seg(t, T.r2, T.r2 + .6));
  line(med.slice(0, Math.max(2, Math.round(med.length * grow))), C.amber, 3, panelA);
  line([{ x: gx, y: gy }, { x: gx + 14 * sx, y: gy }], C.dim, 1, panelA * .7, false);
  for (let m = -6; m <= 6; m += 2) { const x = gx + (m + 7) * sx; line([{ x, y: gy }, { x, y: gy + 6 }], C.dim, 1, panelA * .7, false); }
  text('secax', '−6 m        0        +6 m', gx + 7 * sx, gy + 30, `400 18px ${MONO}`, C.faint, panelA, 'center');
  // dimensions: height at the crest, width at half height
  const hpx = PR.height * sy, crest = gx + (PROF.bins[PROF.median.indexOf(Math.max(...PROF.median.filter(v => v !== null)))] + 7) * sx;
  const da = a * seg(t, T.r2 + .5, T.r2 + .8);
  line([{ x: crest + 150, y: gy }, { x: crest + 150, y: gy - hpx }], C.ink, 1.5, da);
  line([{ x: crest + 142, y: gy - hpx }, { x: crest + 158, y: gy - hpx }], C.ink, 1.5, da, false);
  text('sech', `${PR.height.toFixed(2)} m`, crest + 166, gy - hpx / 2 + 8, `500 30px ${COND}`, C.ink, da);
  const yh = gy - hpx / 2, half = PR.width_half / 2 * sx;
  line([{ x: crest - half, y: yh }, { x: crest + half, y: yh }], C.ink, 1.5, da);
  text('secw', `${PR.width_half.toFixed(1)} m`, crest - half - 10, yh + 8, `500 30px ${COND}`, C.ink, da, 'right');
  text('secL', '石墙剖面 · 地面回波', gx, gy - 236, `500 30px ${SANS}`, C.ink, a);
  text('secS', `${fmt(PR.n)} 个地面点 · 垂直 ×5`, gx, gy + 66, `400 20px ${MONO}`, C.dim, a);
}
function drawHistory(t) {
  const a1 = seg(t, T.card1, T.card1 + .35) * (1 - seg(t, T.cardsOff - .35, T.cardsOff));
  const a2 = seg(t, T.card2, T.card2 + .35) * (1 - seg(t, T.cardsOff - .35, T.cardsOff));
  if (a1 <= 0) return;
  const x = 1150, full = 600, y1 = 470, y2 = 650;
  plate(x + 320, 560, 560, a1);
  text('hT', '阿什福德全镇 · 约 100 km²', x, 360, `500 26px ${SANS}`, C.dim, a1);
  const bar = (y, val, col, a, grow, id, yr, lbl) => {
    g2.save(); g2.globalAlpha = a * .35; g2.fillStyle = '#9aa7a3'; g2.fillRect(x, y, full, 14); g2.restore();
    g2.save(); g2.globalAlpha = a; g2.fillStyle = col; g2.fillRect(x, y, full * val / 100 * grow, 14); g2.restore();
    text(id + 'y', yr, x, y - 22, `300 64px ${COND}`, col, a);
    text(id + 'l', lbl, x + 150, y - 26, `500 30px ${SANS}`, C.ink, a);
  };
  bar(y1, 67.3, C.amber, a1, eo(seg(t, T.card1, T.card1 + .8)), 'h1', '1870', '67.3 km² 开垦为农田');
  if (a2 > 0) bar(y2, 80.2, C.forest, a2, eo(seg(t, T.card2, T.card2 + .8)), 'h2', '2006', '80.2 km² 为森林');
  text('hS', 'Johnson & Ouimet 2014 · 1870 年农业普查 · 2006 年土地覆盖', x, 730, `400 19px ${MONO}`, C.faint, a1);
}
function drawEnd(t) {
  const a = seg(t, T.end, T.end + .6);
  if (a <= 0) return;
  const x = 150, y = 470;
  g2.save(); const lg = g2.createLinearGradient(0, 0, 1100, 0); lg.addColorStop(0, `rgba(3,6,7,${.7 * a})`); lg.addColorStop(1, 'rgba(3,6,7,0)');
  g2.fillStyle = lg; g2.fillRect(0, 0, 1100, H); g2.restore();
  text('e1', '林下的田', x, y, `500 76px ${SANS}`, C.ink, a);
  text('e2', 'The Fields Under the Forest', x, y + 56, `400 38px ${COND}`, C.dim, a);
  g2.save(); g2.globalAlpha = a; g2.fillStyle = C.amber; g2.fillRect(x, y + 88, 64 * eo(seg(t, T.end + .2, T.end + .9)) + 1, 2); g2.restore();
  text('e3', 'LIDAR SURVEY · 点云测绘', x, y + 132, `400 22px ${MONO}`, C.dim, a);
  text('e4', 'LemoLab × Claude Opus 5.5', x, y + 168, `400 22px ${MONO}`, C.dim, a * seg(t, T.end + .4, T.end + 1.0));
}

// ---------------- events for the mixer ----------------
const EV = [];
VO.forEach(L => EV.push({ t: L.t, type: 'vo', id: L.id }));
EV.push({ t: T.scan1, type: 'scan', to: T.scan1End });
EV.push({ t: T.r0, type: 'land' });
PEEL_STEPS.forEach((h, i) => { if (i) EV.push({ t: T.peel + (i - 1) * BEAT, type: 'layer', i, h }); });
EV.push({ t: T.sil, type: 'silence', to: T.turn });
EV.push({ t: T.turn, type: 'impact', to: T.turnEnd });
EV.push({ t: T.r1, type: 'roll', to: T.r1Land }); EV.push({ t: T.r1Land, type: 'land' });
EV.push({ t: T.sec, type: 'section' }); EV.push({ t: T.r2, type: 'land' });
EV.push({ t: T.card1, type: 'bar' }); EV.push({ t: T.card2, type: 'bar' });
EV.push({ t: T.ghost, type: 'canopy', to: T.closed }); EV.push({ t: T.end, type: 'end' });
window.EV = EV;

// ---------------- render ----------------
window.DUR = DUR;
window.camAt = camAt;
let lastT = 0;
window.render = t => {
  lastT = t;
  const cam = placeCamera(t);
  const f1 = Q.get('f1') ? +Q.get('f1') : F1(t), f2 = F2(t), cut = cutAt(t);
  U.uF1.value = t < T.scan1 ? -1e4 + 1 : f1; U.uF2.value = f2; U.uCut.value = cut; U.uT.value = t;
  if (t < T.scan1) U.uF1.value = -1000;
  U.uProj.value = (H * SS / 2) / Math.tan(camera.fov * Math.PI / 360);
  U.uW.value = ss(seg(t, T.walls, T.wallsEnd)) * 1.003;
  U.uSec.value = seg(t, T.sec, T.sec + .4) * (1 - seg(t, T.r2Off - .3, T.r2Off + .2));
  U.uGhost.value = ss(seg(t, T.ghost, T.ghost + .8));
  U.uPhoto.value = t < T.scan1End + .1 ? 1 : 0;
  ghost.visible = t > T.ghost;
  U.uGround.value = (1 - .22 * ss(seg(t, T.crane, T.card1)) * (1 - ss(seg(t, T.cardsOff, T.cardsOff + 1)))) * (1 - .5 * ss(seg(t, T.ghost, T.closed)));
  photo.visible = t < T.scan1End + .1;
  composer.render();
  drawOverlay(t, cut, cam);
};
window.TEXTS = t => { if (Math.abs(t - lastT) > 1e-6) window.render(t); return TXT.slice(); };
await document.fonts.ready;
window.render(0);
window.READY = true;
