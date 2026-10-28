// Marks layer: anchored labels, dimension lines on the object, bilingual subtitles, end card.
// Every label hangs on a 3D point projected each frame; every number on screen is in FACTS.md.
import * as THREE from 'three';
import { clamp, seg, ss, eo } from '/core/lib.js';
import * as TL from './timeline.js';

const { T, LBL, VO } = TL;
const cv = document.getElementById('ov'), g = cv.getContext('2d');
const SANS = '"NotoSC", sans-serif', MONO = '"JBMono", "NotoSC", monospace', LAT = '"Inter", "NotoSC", sans-serif';
const INK = '#f1efe9', DIM = 'rgba(241,239,233,.62)', ACC = '#ff6b3d', LINE = 'rgba(241,239,233,.75)';
const BASE = 1.5, PLATE_TOP = BASE + 11.1, PCB_TOP = PLATE_TOP - 5.0;
const SUB = { zh: `500 38px ${SANS}`, en: `400 29px ${LAT}`, safe: 1500 };

let CUES = null, texts = [];
export async function initOverlay() {
  try { CUES = await (await fetch('cues.json')).json(); }
  catch { CUES = VO.map((v, i) => ({ id: v.id, t0: v.t - .05, t1: Math.min(v.t + 2.6, VO[i + 1] ? VO[i + 1].t - .1 : T.card), zh: v.zh, en: v.en })); }
}
export const overlayTexts = () => texts;
export function subcheck() {
  const out = []; let ok = true;
  for (const v of VO) {
    g.font = SUB.zh; const wz = Math.round(g.measureText(v.zh).width);
    g.font = SUB.en; const we = Math.round(g.measureText(v.en).width);
    const good = wz <= SUB.safe && we <= SUB.safe; ok = ok && good;
    out.push({ id: v.id, zh: v.zh, en: v.en, wz, we, ok: good });
  }
  return { safe: SUB.safe, ok, cues: out };
}

const v3 = new THREE.Vector3();
let CAM, Wd, Hd;
const proj = v => { v3.copy(v).project(CAM); return [(v3.x + 1) / 2 * Wd, (1 - v3.y) / 2 * Hd, v3.z]; };
const fade = (t, a, d = .3) => ss(seg(t, a, a + d));

// one label: anchor dot + leader (diagonal then horizontal) + index / name / spec
function label(t, o) {
  const { t0, t1, a, lx, ly, idx, name, spec, id, align = 'left' } = o;
  const dl = eo(seg(t, t0, t0 + .38)), tx = fade(t, t0 + .18, .32), out = 1 - fade(t, t1 - .3, .3);
  if (dl <= 0 || out <= 0) return;
  const [ax, ay] = a, dir = align === 'left' ? 1 : -1, ex = lx - dir * 34;
  g.globalAlpha = out;
  g.fillStyle = INK; g.beginPath(); g.arc(ax, ay, 3.2, 0, 7); g.fill();
  g.strokeStyle = 'rgba(241,239,233,.35)'; g.lineWidth = 1; g.beginPath(); g.arc(ax, ay, 3.2 + 6 * dl, 0, 7); g.stroke();
  const s1 = Math.hypot(ex - ax, ly - ay), s2 = Math.abs(lx - dir * 14 - ex), len = (s1 + s2) * dl;
  g.strokeStyle = LINE; g.lineWidth = 1.3; g.beginPath(); g.moveTo(ax, ay);
  if (len <= s1) g.lineTo(ax + (ex - ax) * len / s1, ay + (ly - ay) * len / s1);
  else { g.lineTo(ex, ly); g.lineTo(ex + dir * (len - s1), ly); }
  g.stroke();
  if (tx <= 0) return;
  g.globalAlpha = out * tx; const dx = (1 - tx) * 10 * dir;
  g.textAlign = align; g.textBaseline = 'alphabetic';
  const nx = align === 'left' ? lx + (idx ? 34 : 0) : lx;
  if (idx) { g.fillStyle = ACC; g.font = `500 15px ${MONO}`; g.fillText(idx, lx + dx, ly - 6); }
  g.fillStyle = INK; g.font = `500 30px ${SANS}`; g.fillText(name, nx + dx, ly + 4);
  let w = g.measureText(name).width;
  if (spec) { g.fillStyle = DIM; g.font = `400 17px ${MONO}`; g.fillText(spec, nx + dx, ly + 30); w = Math.max(w, g.measureText(spec).width); }
  g.textAlign = 'left';
  if (tx > .99 && out > .99) {
    const x0 = align === 'left' ? lx : lx - w - 4, x1 = align === 'left' ? nx + w + 4 : lx;
    texts.push({ id, text: name + (spec ? ' ' + spec : ''), x0: Math.max(0, x0), y0: ly - 26, x1: Math.min(Wd, x1), y1: ly + (spec ? 36 : 12) });
  }
}

// dimension line between two 3D points, offset already applied by the caller; ext = [[from, to], …] extension lines
function dimension(t, o) {
  const { t0, t1, A, B, ext = [], text, id, sub } = o;
  const k = eo(seg(t, t0, t0 + .55)), out = 1 - fade(t, t1 - .3, .3);
  if (k <= 0 || out <= 0) return;
  const a = proj(A), b = proj(B), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  g.globalAlpha = out; g.strokeStyle = ACC; g.lineWidth = 1.4;
  for (const [p, q] of ext) { const p1 = proj(p), q1 = proj(q); g.beginPath(); g.moveTo(p1[0], p1[1]); g.lineTo(p1[0] + (q1[0] - p1[0]) * k, p1[1] + (q1[1] - p1[1]) * k); g.stroke(); }
  g.beginPath(); g.moveTo(mx + (a[0] - mx) * k, my + (a[1] - my) * k); g.lineTo(mx + (b[0] - mx) * k, my + (b[1] - my) * k); g.stroke();
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  for (const p of [a, b]) { g.save(); g.translate(p[0], p[1]); g.rotate(ang - Math.PI / 4); g.beginPath(); g.moveTo(-6 * k, 0); g.lineTo(6 * k, 0); g.stroke(); g.restore(); }
  const tA = fade(t, t0 + .35, .3); if (tA <= 0) return;
  // text sits on the side of the line away from the object, never upside down
  let ra = ang; if (ra > Math.PI / 2) ra -= Math.PI; if (ra < -Math.PI / 2) ra += Math.PI;
  g.save(); g.translate(mx, my); g.rotate(ra); g.globalAlpha = out * tA; g.textAlign = 'center';
  g.font = `500 22px ${MONO}`; const w = g.measureText(text).width;
  g.fillStyle = 'rgba(14,15,17,.72)'; g.fillRect(-w / 2 - 8, -34, w + 16, 30);
  g.fillStyle = INK; g.fillText(text, 0, -11);
  if (sub) { g.font = `400 16px ${SANS}`; g.fillStyle = DIM; g.fillText(sub, 0, -42); }
  g.restore(); g.textAlign = 'left';
  if (tA > .99 && out > .99) texts.push({ id, text: (sub ? sub + ' ' : '') + text, x0: mx - w / 2 - 30, y0: my - 64, x1: mx + w / 2 + 30, y1: my + 30 });
}

const LAYER_LABELS = [
  { id: 'cap', k: 'cap', a: [-28.5, 22.0, PCB_TOP + 12.4 + 6.9], name: '键帽', spec: '1u ×20 · 1.5u ×1' },
  { id: 'sw', k: 'sw', a: [-25.6, 30.5, PCB_TOP + 9.0], name: '机械轴体', spec: '十字轴 · ×21' },
  { id: 'plate', k: 'plate', a: [-4.3, 24.0, PLATE_TOP], name: '定位板', spec: 'FR-4 · 1.6 mm' },
  { id: 'pcb', k: 'pcb', a: [-5.0, 8.0, PCB_TOP], name: '电路板', spec: '双层 · 1.6 mm' },
  { id: 'spacer', k: 'spacer', a: [-41.3, 38.1, BASE + 2.0 + 4.5], name: '铜柱', spec: 'M2 × 7.5 mm ×4' },
  { id: 'case', k: 'case', a: [-2.3, 18.0, BASE + 6.0], name: '外壳', spec: '底厚 2.0 mm' },
];

export function drawOverlay(t, cam, ctx) {
  CAM = cam; Wd = ctx.W; Hd = ctx.H; texts = [];
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, Wd, Hd);
  const { world, anchors } = ctx;
  // 1 · six layers, right-hand column
  const LL = LBL.layers;
  if (t > LL.t0 - .05 && t < LL.t1 + .1) {
    const pts = LAYER_LABELS.map(o => proj(world(o.k, ...o.a)));
    const ys = pts.map(p => p[1]);
    for (let it = 0; it < 4; it++) for (let i = 1; i < ys.length; i++) if (ys[i] - ys[i - 1] < 76) { const m = (ys[i] + ys[i - 1]) / 2; ys[i - 1] = m - 38; ys[i] = m + 38; }
    LAYER_LABELS.forEach((o, i) => label(t, { id: o.id, t0: LL.t0 + i * LL.step, t1: LL.t1, a: pts[i], lx: 1408, ly: ys[i], idx: String(i + 1).padStart(2, '0'), name: o.name, spec: o.spec }));
  }
  // 2 · the three macro stops: the leader lands on the part itself
  const wp = obj => { const v = new THREE.Vector3(); obj.getWorldPosition(v); return v; };
  if (t > LBL.chip[0] - .05 && t < LBL.flash[1] + .1) {
    const c = wp(anchors.chip); c.y -= .95; const a = proj(c);
    label(t, { id: 'chip', t0: LBL.chip[0], t1: LBL.chip[1], a, lx: a[0] + 330, ly: a[1] - 210, name: '主控 RP2040', spec: '7 × 7 mm' });
    const f = wp(anchors.flash); f.y -= 1.9; const b2 = proj(f);
    label(t, { id: 'flash', t0: LBL.flash[0], t1: LBL.flash[1], a: b2, lx: b2[0] + 190, ly: b2[1] - 70, name: '闪存 16 MB', spec: '' });
  }
  if (t > LBL.led[0] - .05 && t < LBL.led[1] + .1) {
    const c = wp(anchors.led); c.y -= 1.0; const a = proj(c);
    label(t, { id: 'led', t0: LBL.led[0], t1: LBL.led[1], a, lx: a[0] - 250, ly: a[1] - 170, name: '灯珠 ×23', spec: '反贴', align: 'right' });
  }
  if (t > LBL.sw[0] - .05 && t < LBL.sw[1] + .1) {
    const a = proj(world('sw', -59.373, 42.545, PCB_TOP - 2.0));   // SW9's first pin (footprint rotation 180°)
    label(t, { id: 'sw', t0: LBL.sw[0], t1: LBL.sw[1], a, lx: a[0] + 330, ly: a[1] + 95, name: '热插拔 ×21', spec: '' });
  }
  // 3 · dimensions drawn on the assembled object (case bounding box from the STEP; key pitch from KiCad)
  if (t > LBL.dimP[0] - .05 && t < LBL.dimW[1] + .1) {
    const W0 = -140.61, W1 = -2.26, D0 = -26.31, D1 = 71.31, H0 = BASE, H1 = BASE + 11.1;
    const F = D1 + 9, R = W1 + 9;
    dimension(t, { id: 'dimW', t0: LBL.dimW[0], t1: LBL.dimW[1], A: world(null, W0, F, .2), B: world(null, W1, F, .2), ext: [[world(null, W0, 44, .2), world(null, W0, F + 3, .2)], [world(null, W1, 41, .2), world(null, W1, F + 3, .2)]], text: '138.4 mm' });
    dimension(t, { id: 'dimD', t0: LBL.dimD[0], t1: LBL.dimD[1], A: world(null, R, D0, .2), B: world(null, R, D1, .2), ext: [[world(null, -14, D0, .2), world(null, R + 3, D0, .2)], [world(null, -18, D1, .2), world(null, R + 3, D1, .2)]], text: '97.6 mm' });
    dimension(t, { id: 'dimH', t0: LBL.dimH[0], t1: LBL.dimH[1], A: world(null, R + 2, -26.31 + 4, H0), B: world(null, R + 2, -26.31 + 4, H1), ext: [[world(null, W1, -22.3, H1), world(null, R + 5, -22.3, H1)]], text: '11.1 mm' });
    const ht = PCB_TOP + 12.4 + 7.6 + 1.5, back = -7.144 - 9.6, off = -7.144 - 16;
    dimension(t, { id: 'dimP', t0: LBL.dimP[0], t1: LBL.dimP[1], A: world('cap', -128.588, off, ht, .05), B: world('cap', -109.537, off, ht, .2), ext: [[world('cap', -128.588, back, ht, .05), world('cap', -128.588, off - 3, ht, .05)], [world('cap', -109.537, back, ht, .2), world('cap', -109.537, off - 3, ht, .2)]], text: '19.05 mm', sub: '键距' });
  }
  // 4 · subtitles: Chinese line above, English line below, one line each
  const NOSUB = new URLSearchParams(location.search).has('nosub');   // poster and gallery frame only
  for (const c of NOSUB ? [] : CUES) {
    if (t < c.t0 || t > c.t1) continue;
    const k = Math.min(fade(t, c.t0, .12), 1 - fade(t, c.t1 - .12, .12));
    g.globalAlpha = k; g.textAlign = 'center'; g.shadowColor = 'rgba(0,0,0,.75)'; g.shadowBlur = 14;
    g.fillStyle = INK; g.font = SUB.zh; g.fillText(c.zh, Wd / 2, 974);
    g.fillStyle = 'rgba(241,239,233,.86)'; g.font = SUB.en; g.fillText(c.en, Wd / 2, 1018);
    g.shadowBlur = 0; g.textAlign = 'left';
  }
  // 5 · end card
  const k0 = T.card;
  if (t > k0) {
    const items = [
      { id: 'cardT', font: `500 92px ${SANS}`, col: INK, text: '二十一键', y: 470, d: .1 },
      { id: 'cardE', font: `300 36px ${LAT}`, col: INK, text: '21 Keys, Opened', y: 528, d: .25 },
      { id: 'cardS', font: `400 17px ${MONO}`, col: DIM, text: '产品拆解 · EXPLODED TEARDOWN', y: 600, d: .45 },
      { id: 'cardC', font: `400 15px ${MONO}`, col: DIM, text: 'CAD：foostan/crkbd · CC BY 4.0', y: 632, d: .55 },
      { id: 'cardL', font: `500 18px ${MONO}`, col: INK, text: 'LemoLab × Claude Opus 5.5', y: 700, d: .75 },
    ];
    g.globalAlpha = fade(t, k0, .5); g.fillStyle = ACC; g.fillRect(150, 378, 46 * eo(seg(t, k0, k0 + .6)), 4);
    for (const it of items) {
      const a = fade(t, k0 + it.d, .45); if (a <= 0) continue;
      g.globalAlpha = a; g.font = it.font; g.fillStyle = it.col; g.fillText(it.text, 150, it.y + (1 - a) * 10);
      if (a > .99) texts.push({ id: it.id, text: it.text, x0: 150, y0: it.y - 80, x1: 150 + g.measureText(it.text).width, y1: it.y + 12 });
    }
  }
  g.globalAlpha = 1;
}
