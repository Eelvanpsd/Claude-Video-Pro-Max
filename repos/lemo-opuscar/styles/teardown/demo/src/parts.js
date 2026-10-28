// 零件几何：圆角矩形放样（键帽、轴体外壳）、KiCad 轮廓挤出（定位板、电路板）
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// 圆角矩形一圈点（逆时针，固定点数，便于放样）
export function rrect(w, d, r, seg = 6) {
  r = Math.min(r, w / 2 - 1e-3, d / 2 - 1e-3);
  const pts = [], cs = [[w / 2 - r, d / 2 - r, 0], [-w / 2 + r, d / 2 - r, 1], [-w / 2 + r, -d / 2 + r, 2], [w / 2 - r, -d / 2 + r, 3]];
  for (const [cx, cz, q] of cs) for (let i = 0; i <= seg; i++) {
    const a = (q + i / seg) * Math.PI / 2; pts.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]);
  }
  return pts;
}

// 放样：rings = [{w,d,r,y,ox?,oz?}]，返回侧壁几何（平滑法线）
export function loft(rings, seg = 6, flip = false) {
  const R = rings.map(g => rrect(g.w, g.d, g.r, seg).map(([x, z]) => [x + (g.ox || 0), g.y, z + (g.oz || 0)]));
  const n = R[0].length, pos = [], idx = [];
  for (const ring of R) for (const p of ring) pos.push(...p);
  for (let j = 0; j < R.length - 1; j++) for (let i = 0; i < n; i++) {
    const a = j * n + i, b = j * n + (i + 1) % n, c = (j + 1) * n + i, e = (j + 1) * n + (i + 1) % n;
    if (!flip) idx.push(a, c, b, b, c, e); else idx.push(a, b, c, b, e, c);   // 默认外法线
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// 顶面（带球面凹槽）：从外圈向中心缩放的同心圈
export function dishedCap(top, dish, seg = 6, rings = 8) {
  const base = rrect(top.w, top.d, top.r, seg), n = base.length, pos = [], idx = [];
  for (let k = 0; k <= rings; k++) {
    const s = 1 - k / rings;
    for (const [x, z] of base) {
      const px = x * s, pz = z * s;
      const rr = Math.min(1, (px * px) / (top.w * top.w / 4) + (pz * pz) / (top.d * top.d / 4));
      pos.push(px + (top.ox || 0), top.y - dish * (1 - rr), pz + (top.oz || 0));
    }
  }
  for (let k = 0; k < rings; k++) for (let i = 0; i < n; i++) {
    const a = k * n + i, b = k * n + (i + 1) % n, c = (k + 1) * n + i, e = (k + 1) * n + (i + 1) % n;
    idx.push(a, c, b, b, c, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function flatCap(r, flipUp = true) {   // 平顶/平底（扇形）
  const pts = rrect(r.w, r.d, r.r, 6), pos = [r.ox || 0, r.y, r.oz || 0], idx = [];
  for (const [x, z] of pts) pos.push(x + (r.ox || 0), r.y, z + (r.oz || 0));
  const n = pts.length;
  for (let i = 0; i < n; i++) flipUp ? idx.push(0, 1 + (i + 1) % n, 1 + i) : idx.push(0, 1 + i, 1 + (i + 1) % n);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

const strip = g => { const o = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(o.attributes)) if (k !== 'position' && k !== 'normal') o.deleteAttribute(k); return o; };
const merge = gs => mergeGeometries(gs.map(strip));

// 键帽：W×D 底面（mm），H 高。均匀高度的球面凹槽外形（通用造型，不对应任何品牌）
export function keycapGeometry(W = 18.0, D = 18.0, H = 7.6) {
  const tw = W - 5.6, td = D - 5.2, wall = 1.2;
  const outer = [
    { w: W, d: D, r: 1.1, y: 0 },
    { w: W - .25, d: D - .25, r: 1.3, y: .9 },
    { w: (W + tw) / 2 + .35, d: (D + td) / 2 + .35, r: 2.0, y: H * .55 },
    { w: tw + .55, d: td + .55, r: 2.6, y: H - .32 },
    { w: tw, d: td, r: 2.5, y: H - .02 },
  ];
  const side = loft(outer, 6);
  const cap = dishedCap({ w: tw, d: td, r: 2.5, y: H - .02 }, .65, 6, 9);
  // 底沿 + 内腔 + 十字轴座
  const rim = loft([{ w: W, d: D, r: 1.1, y: 0 }, { w: W - 2 * wall, d: D - 2 * wall, r: .6, y: 0 }], 6, true);
  const inner = loft([{ w: W - 2 * wall, d: D - 2 * wall, r: .6, y: 0 }, { w: tw - .6, d: td - .6, r: 1.2, y: H - 1.4 }], 6, true);
  const ceil = flatCap({ w: tw - .6, d: td - .6, r: 1.2, y: H - 1.4 }, false);
  const stem = new THREE.CylinderGeometry(2.75, 2.75, H - 1.4 - .8, 24, 1, false); stem.translate(0, (H - 1.4 + .8) / 2, 0);
  const g = merge([side, cap, rim, inner, ceil, stem]);
  return mergeVertices(g, 1e-4);
}

// 十字轴体（通用规格：底座 14×14，上盖 15.6×15.6，PCB 面以上 11.6 mm 外壳 + 3.6 mm 轴心）
export function switchGeometries() {
  const bottom = merge([
    loft([{ w: 13.9, d: 13.9, r: .6, y: 0 }, { w: 13.9, d: 13.9, r: .6, y: 5.0 }], 3),
    flatCap({ w: 13.9, d: 13.9, r: .6, y: 0 }, false),
    (() => { const c = new THREE.CylinderGeometry(1.95, 1.95, 2.0, 20); c.translate(0, -1.0, 0); return c; })(),
  ]);
  const top = merge([
    loft([
      { w: 15.6, d: 15.6, r: .9, y: 5.0 }, { w: 15.6, d: 15.6, r: .9, y: 6.2 },
      { w: 15.0, d: 15.0, r: 1.2, y: 6.9 }, { w: 11.4, d: 13.4, r: 1.5, y: 11.3 }, { w: 11.0, d: 13.0, r: 1.3, y: 11.6 },
    ], 5),
    flatCap({ w: 11.0, d: 13.0, r: 1.3, y: 11.6 }, true),
    flatCap({ w: 15.6, d: 15.6, r: .9, y: 5.0 }, false),
  ]);
  const a = new THREE.BoxGeometry(4.1, 3.6, 1.17); a.translate(0, 11.6 + 1.8, 0);
  const b = new THREE.BoxGeometry(1.31, 3.6, 4.1); b.translate(0, 11.6 + 1.8, 0);
  const base = new THREE.BoxGeometry(6.4, .5, 5.6); base.translate(0, 11.6 + .25, 0);
  const stem = merge([a, b, base]);
  const pin = new THREE.CylinderGeometry(.75, .75, 3.3, 12); pin.translate(0, -1.65, 0);
  return { bottom: mergeVertices(bottom, 1e-4), top: mergeVertices(top, 1e-4), stem, pin };
}

// KiCad 轮廓 -> THREE.Shape（shape 平面坐标 = (x, -y_pcb)，网格 rotation.x = -π/2 后落到世界 X/Z）
// 去掉重复/过近的相邻点（零长边会让挤出侧面出现零法线 → 着色 NaN）
export function clean(poly, eps = .02) {
  const out = [];
  for (const p of poly) if (!out.length || Math.hypot(p[0] - out[out.length - 1][0], p[1] - out[out.length - 1][1]) > eps) out.push(p);
  while (out.length > 3 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) <= eps) out.pop();
  return out;
}
export function shapeFrom(outline, holes = [], circles = []) {
  const s = new THREE.Shape(clean(outline).map(([x, y]) => new THREE.Vector2(x, -y)));
  for (const h of holes) s.holes.push(new THREE.Path(clean(h).map(([x, y]) => new THREE.Vector2(x, -y))));
  for (const c of circles) { const p = new THREE.Path(); p.absarc(c.c[0], -c.c[1], c.r, 0, Math.PI * 2, true); s.holes.push(p); }
  return s;
}

// 多边形向内偏移（简单顶点法线偏移，适合平滑外形）
export function inset(poly, d) {
  const n = poly.length, out = [];
  let A = 0; for (let i = 0; i < n; i++) { const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % n]; A += x0 * y1 - x1 * y0; }
  const sgn = A > 0 ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const p = poly[(i - 1 + n) % n], c = poly[i], q = poly[(i + 1) % n];
    const e1 = norm([c[0] - p[0], c[1] - p[1]]), e2 = norm([q[0] - c[0], q[1] - c[1]]);
    const n1 = [-e1[1] * sgn, e1[0] * sgn], n2 = [-e2[1] * sgn, e2[0] * sgn];
    const m = norm([n1[0] + n2[0], n1[1] + n2[1]]); const k = 1 / Math.max(.4, m[0] * n1[0] + m[1] * n1[1]);
    out.push([c[0] + m[0] * d * k, c[1] + m[1] * d * k]);
  }
  return out;
}
const norm = v => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };

// 六角铜柱（对边 3.5 mm）
export function hexSpacer(len = 7.5, af = 3.5) {
  const r = af / Math.sqrt(3);
  const g = new THREE.CylinderGeometry(r, r, len, 6, 1, false); g.translate(0, len / 2, 0);
  return g.toNonIndexed();
}
// M2 盘头螺丝（头 Ø3.8×1.3 + 杆 Ø2×5）
export function screwGeometry() {
  const head = new THREE.CylinderGeometry(1.75, 1.9, 1.3, 28); head.translate(0, .65, 0);
  const dome = new THREE.SphereGeometry(1.75, 28, 6, 0, Math.PI * 2, 0, Math.PI * .22); dome.scale(1, .5, 1); dome.translate(0, 1.3 - .35, 0);
  const shank = new THREE.CylinderGeometry(1.0, 1.0, 5, 14); shank.translate(0, -2.5, 0);
  return merge([head, shank]);
}
