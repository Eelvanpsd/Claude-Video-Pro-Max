// 实物：胡桃木表盘、两圈实物柱（太阳能 = 拉丝铝片，风电 = 亚克力片，两者每 100 GW 都夹一片黄铜）、最后落下的黄铜圆片
// 每一片的位置都是时间的纯函数：任意帧可单独渲染
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { clamp, seg, eo, ei, hash, lerp } from '/core/lib.js';
import { YEARS, SOLAR, WIND, GW_PER_SHEET, BRASS_EVERY } from './data.js';
import { BUILD, BUILD_LEN, T, BEAT } from './timeline.js';

export const R = 3.35, DISC_H = .11, TH = .0125, SW = .5, SD = .42;
export const STEP = .4817, TH25 = .70;
export const N = YEARS.length;
export const th = i => TH25 - (N - 1 - i) * STEP;
export const rS = i => 2.25 + .03 * i, rW = i => rS(i) - .6;
const n = v => Math.round(v / GW_PER_SHEET);
export const PAIRS = YEARS.map((year, i) => {
  const a = th(i), mk = (r, v, kind) => ({ kind, i, year, v, n: n(v), r, a, x: r * Math.sin(a), z: r * Math.cos(a) });
  return { year, i, a, sol: mk(rS(i), SOLAR[i], 'sol'), wind: mk(rW(i), WIND[i], 'wind') };
});
export const topY = s => DISC_H + s.n * TH;
const P25 = PAIRS[N - 1], P24 = PAIRS[N - 2];
export const NEW25 = P25.sol.n - P24.sol.n;
export const FALL25 = .42;
export const LAND25 = T.drop25 + (NEW25 - 1) * T.dropStep + FALL25;

// —— 叠片时间表 ——
function buildLen(y) { return y === 2014 ? BUILD_LEN[2014] : y === 2021 ? BUILD_LEN[2021] : y >= 2022 ? BUILD_LEN.fast : BUILD_LEN.def; }
export const SHEETS = [], EVENTS = [];
for (const p of PAIRS) {
  const L = buildLen(p.year);
  for (const s of [p.wind, p.sol]) {
    const b = BUILD[p.year] + (s.kind === 'sol' ? BEAT * .5 : 0);
    const nBase = s === P25.sol ? P24.sol.n : s.n;
    s.b = b; s.L = L;
    EVENTS.push({ t: +b.toFixed(3), type: 'riffle', mat: s.kind, d: +L.toFixed(3), n: nBase, year: p.year });
    for (let k = 0; k < s.n; k++) {
      const brass = (k + 1) % BRASS_EVERY === 0;
      let t0, land, mode;
      if (k < nBase) { land = b + L * Math.pow((k + 1) / nBase, .85); t0 = land - .11; mode = 'c'; }
      else { const j = k - nBase; t0 = T.drop25 + j * T.dropStep; land = t0 + FALL25; mode = 'd'; EVENTS.push({ t: +land.toFixed(3), type: 'drop', j, brass }); }
      if (brass) EVENTS.push({ t: +land.toFixed(3), type: 'brass', mat: s.kind, h: (k + 1) / BRASS_EVERY, year: p.year });
      SHEETS.push({ s, k, brass, t0, land, mode,
        jt: (hash(s.i * 1000 + k + (s.kind === 'wind' ? 500 : 0)) - .5) * .007, jr: (hash(s.i * 1000 + k + .5) - .5) * .007,
        ja: (hash(s.i * 777 + k * 3.1 + (s.kind === 'wind' ? 9 : 0)) - .5) * .016, shade: .9 + hash(s.i * 91 + k * 1.7) * .14 });
    }
  }
}
// 当前（时间 t）某一摞落定了多少片
export function landed(s, t) { let c = 0; for (const sh of SHEETS) if (sh.s === s && sh.land <= t) c++; return c; }

export async function buildSet(scene, renderer) {
  const hdr = await new RGBELoader().loadAsync('/core/assets/polyhaven/photo_studio_loft_hall_2k.hdr');
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = hdr; scene.environmentIntensity = .8; scene.environmentRotation = new THREE.Euler(0, 1.2, 0);

  // 暖色低角度主光（长影）+ 冷色轮廓光（让远景的铝和亚克力从胡桃木里分出来）+ 顶部柔光
  const key = new THREE.DirectionalLight('#fff1dc', 3.1);
  key.position.set(-6.2, 4.4, 1.6); key.castShadow = true; key.shadow.mapSize.set(4096, 4096);
  Object.assign(key.shadow.camera, { left: -4.6, right: 4.6, top: 4.6, bottom: -4.6, near: .5, far: 20 });
  key.shadow.bias = -.00012; key.shadow.normalBias = .004; key.shadow.radius = 3;
  const rim = new THREE.DirectionalLight('#b9d2ff', 2.1); rim.position.set(5.5, 3.2, -5.5);
  const rim2 = new THREE.DirectionalLight('#c6dbff', 1.2); rim2.position.set(4.5, 2.6, 6.0);
  const topL = new THREE.DirectionalLight('#eef2f8', .5); topL.position.set(1.5, 8, 3);
  scene.add(key, key.target, rim, rim2, topL);

  const TL = new THREE.TextureLoader();
  const tex = async (u, srgb) => { const t = await TL.loadAsync(u); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 16; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  const [wD, wN, wR] = await Promise.all([tex('/core/assets/polyhaven/walnut_diff.jpg', true), tex('/core/assets/polyhaven/walnut_nor.jpg'), tex('/core/assets/polyhaven/walnut_rough.jpg')]);
  for (const t of [wD, wN, wR]) t.repeat.set(1.6, 1.6);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: '#bfb8ad', roughness: .94 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const walnut = new THREE.MeshStandardMaterial({ map: wD, normalMap: wN, roughnessMap: wR, roughness: 1, color: '#a88d78', normalScale: new THREE.Vector2(.6, .6) });
  const walnutSide = walnut.clone(); walnutSide.map = wD.clone(); walnutSide.map.repeat.set(8, .25); walnutSide.map.needsUpdate = true;
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(R, R, DISC_H, 200, 1), [walnutSide, walnut, walnut]);
  disc.position.y = DISC_H / 2; disc.castShadow = disc.receiveShadow = true; scene.add(disc);
  const rimRing = new THREE.Mesh(new THREE.TorusGeometry(R, .006, 8, 256), new THREE.MeshStandardMaterial({ color: '#d8d8d6', metalness: 1, roughness: .25 }));
  rimRing.rotation.x = Math.PI / 2; rimRing.position.y = DISC_H; scene.add(rimRing);

  // 盘面镶嵌（白蜡木色）：外圈刻度、两条螺旋轨迹、年份
  {
    const C = 4096, c = document.createElement('canvas'); c.width = c.height = C;
    const x = c.getContext('2d'), px = v => (v / R + 1) / 2 * C;
    x.strokeStyle = x.fillStyle = '#fff';
    for (let a = 0; a < 180; a++) {
      const ang = a / 180 * Math.PI * 2, r0 = R - .07, r1 = R - (a % 15 === 0 ? .2 : .12);
      x.lineWidth = a % 15 === 0 ? 5 : 2.5; x.beginPath();
      x.moveTo(px(r0 * Math.sin(ang)), px(r0 * Math.cos(ang))); x.lineTo(px(r1 * Math.sin(ang)), px(r1 * Math.cos(ang))); x.stroke();
    }
    x.lineWidth = 3; x.beginPath(); x.arc(C / 2, C / 2, (R - .26) / R * C / 2, 0, Math.PI * 2); x.stroke();
    for (const [rf, dash] of [[rS, [16, 14]], [rW, [4, 12]]]) {
      x.lineWidth = 3; x.setLineDash(dash); x.beginPath();
      for (let q = 0; q <= 240; q++) { const f = q / 240 * (N - 1), a = TH25 - (N - 1 - f) * STEP, r = lerp(rf(Math.floor(f)), rf(Math.ceil(f)), f % 1); const X = px(r * Math.sin(a)), Z = px(r * Math.cos(a)); q ? x.lineTo(X, Z) : x.moveTo(X, Z); }
      x.stroke();
    }
    x.setLineDash([]);
    x.font = `500 ${Math.round(.15 / R * C / 2)}px JBMono`; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (const p of PAIRS) { const rr = p.sol.r + SD / 2 + .2; x.save(); x.translate(px(rr * Math.sin(p.a)), px(rr * Math.cos(p.a))); x.rotate(-p.a); x.fillText(String(p.year), 0, 0); x.restore(); }
    const t = new THREE.CanvasTexture(c); t.anisotropy = 16;
    const inlay = new THREE.Mesh(new THREE.CircleGeometry(R, 200), new THREE.MeshStandardMaterial({ color: '#efe4cf', alphaMap: t, transparent: true, roughness: .55, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false }));
    inlay.rotation.x = -Math.PI / 2; inlay.position.y = DISC_H + .0005; inlay.receiveShadow = true; scene.add(inlay);
  }

  // —— 片 ——
  const geo = new THREE.BoxGeometry(SW, TH * .985, SD);
  const alu = new THREE.MeshStandardMaterial({ color: '#c8ccd1', metalness: 1, roughness: .27 });
  const brass = new THREE.MeshStandardMaterial({ color: '#d2b07a', metalness: 1, roughness: .27 });
  // 风电：乳白亚克力（半透、清漆面），一眼和金属分开
  const acrylic = new THREE.MeshPhysicalMaterial({ color: '#9fd3d6', roughness: .22, metalness: 0, clearcoat: 1, clearcoatRoughness: .06,
    transmission: .72, thickness: .5, ior: 1.49, attenuationColor: new THREE.Color('#5fb3b8'), attenuationDistance: .45, specularIntensity: 1 });
  const groups = { alu: [], brass: [], acr: [] };
  for (const sh of SHEETS) { const g = sh.brass ? 'brass' : sh.s.kind === 'sol' ? 'alu' : 'acr'; sh.g = g; sh.idx = groups[g].length; groups[g].push(sh); }
  const meshes = {};
  for (const [g, mat] of [['alu', alu], ['brass', brass], ['acr', acrylic]]) {
    const m = new THREE.InstancedMesh(geo, mat, groups[g].length); m.castShadow = m.receiveShadow = true; m.frustumCulled = false;
    for (const sh of groups[g]) { const v = g === 'acr' ? .97 + (sh.shade - .97) * .3 : sh.shade; m.setColorAt(sh.idx, new THREE.Color(v, v, v)); }
    m.instanceColor.needsUpdate = true; scene.add(m); meshes[g] = m;
  }

  // —— 最后一件实物：黄铜圆片，面上刻比值 ——
  const PR = .64, PH = .075;
  const pc = document.createElement('canvas'); pc.width = pc.height = 1024; const px2 = pc.getContext('2d');
  px2.fillStyle = '#fff'; px2.fillRect(0, 0, 1024, 1024);
  px2.strokeStyle = px2.fillStyle = '#3b2a12';
  px2.lineWidth = 5; px2.beginPath(); px2.arc(512, 512, 470, 0, Math.PI * 2); px2.stroke();
  px2.lineWidth = 2; px2.beginPath(); px2.arc(512, 512, 446, 0, Math.PI * 2); px2.stroke();
  for (let a = 0; a < 120; a++) { const ang = a / 120 * Math.PI * 2, r0 = 446, r1 = a % 10 === 0 ? 410 : 428; px2.lineWidth = a % 10 === 0 ? 4 : 2; px2.beginPath(); px2.moveTo(512 + r0 * Math.sin(ang), 512 + r0 * Math.cos(ang)); px2.lineTo(512 + r1 * Math.sin(ang), 512 + r1 * Math.cos(ang)); px2.stroke(); }
  px2.textAlign = 'center'; px2.textBaseline = 'alphabetic';
  px2.font = '300 250px Inter'; px2.fillText('×' + (SOLAR[N - 1] / WIND[N - 1]).toFixed(2), 512, 600);
  px2.font = '500 54px NotoSC'; px2.fillText('太阳能 ÷ 风电', 512, 720);
  px2.font = '500 52px JBMono'; px2.fillText('2025', 512, 330);
  const ptex = new THREE.CanvasTexture(pc); ptex.colorSpace = THREE.SRGBColorSpace; ptex.anisotropy = 16;
  const brassTop = new THREE.MeshStandardMaterial({ color: '#dcbd86', map: ptex, metalness: 1, roughness: .26 });
  const puck = new THREE.Mesh(new THREE.CylinderGeometry(PR, PR, PH, 160), [brass, brassTop, brass]);
  puck.castShadow = puck.receiveShadow = true; scene.add(puck);

  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), ONE = new THREE.Vector3(1, 1, 1), ZERO = new THREE.Vector3(0, 0, 0);
  function pose(sh, t) {
    const { s, k } = sh;
    if (t < sh.t0) { M4.compose(P.set(0, -5, 0), Q.identity(), ZERO); return M4; }
    let y = DISC_H + TH * (k + .5), yaw = s.a + sh.ja, dt = 0, tilt = 0;
    if (sh.mode === 'c') { const u = seg(t, sh.t0, sh.land); y += .12 * (1 - eo(u)); }
    else {
      const u = seg(t, sh.t0, sh.land), f = Math.pow(1 - u, 5), j = k;
      y += 1.0 * f; yaw += (hash(j * 13.7) > .5 ? 1 : -1) * (.35 + hash(j * 2.9) * .25) * f; dt = (hash(j * 3.3) - .5) * .05 * f; tilt = (hash(j * 5.1) - .5) * .12 * f;
    }
    const tx = Math.cos(s.a), tz = -Math.sin(s.a), rx = Math.sin(s.a), rz = Math.cos(s.a);
    P.set(s.x + tx * (sh.jt + dt) + rx * sh.jr, y, s.z + tz * (sh.jt + dt) + rz * sh.jr);
    Q.setFromEuler(E.set(tilt, yaw, tilt * .6, 'YXZ')); M4.compose(P, Q, ONE); return M4;
  }
  function update(t, puckYaw) {
    for (const sh of SHEETS) meshes[sh.g].setMatrixAt(sh.idx, pose(sh, t));
    for (const g in meshes) meshes[g].instanceMatrix.needsUpdate = true;
    // 圆片：从画外落下（重力），落定后一次很小的回弹
    const t0 = T.puck - .5, u = seg(t, t0, T.puck);
    puck.visible = t > t0;
    let y = DISC_H + PH / 2 + 2.6 * (1 - u * u);
    if (t > T.puck) { const b = t - T.puck; y += .012 * Math.exp(-b * 9) * Math.abs(Math.sin(b * 26)); }
    puck.position.set(0, y, 0); puck.rotation.set(0, puckYaw + (1 - eo(u)) * .9, 0);
  }
  return { update, key, rim };
}
