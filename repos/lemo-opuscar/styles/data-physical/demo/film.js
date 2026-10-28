// 《两条螺旋》Two Spirals — Data Physicalization 数据实物化 demo
// render(t)：相机关键帧 → 叠片 → 景深 → 2D 叠层（读数、判定、计数器、字幕、落版）；EV 给混音；TEXTS 给 readcheck；SUBCHECK 给字幕单行检查
import * as THREE from 'three';
import { makePost } from '/core/three/post.js';
import { clamp, seg, eo, eio, ss, lerp, track } from '/core/lib.js';
import { YEARS, SOLAR, WIND, fmt } from './data.js';
import { DUR, BEAT, BAR, q, BUILD, T, VO, LABELS } from './timeline.js';
import { buildSet, PAIRS, N, th, rS, rW, topY, DISC_H, TH, SW, SD, NEW25, LAND25, EVENTS, landed } from './set.js';

const W = 1920, H = 1080;
const BG = new THREE.Color('#c4beb4');
const INK = '#1c1d20', INK2 = 'rgba(28,29,32,.64)', ACC = '#d4521c';

await Promise.all(['500 30px NotoSC', '400 21px NotoSC', '600 80px NotoSerifSC', '200 150px Inter', '300 46px Inter', '400 26px Inter', '500 24px JBMono', '400 24px JBMono'].map(f => document.fonts.load(f)));
await document.fonts.ready;

const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(2); renderer.setSize(W, H);
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('stage').appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = BG.clone(); scene.fog = new THREE.Fog(BG.clone(), 30, 64);
const camera = new THREE.PerspectiveCamera(22, W / H, .05, 80);
const post = makePost(renderer, scene, camera, W, H, { ssaa: 2, ao: true, aoRadius: .12, aoThickness: .4, aoScale: 1.6, aoAmt: .75 });
post.bloom.strength = .08; post.bloom.threshold = 1.6;
post.vig.uniforms.amt.value = .28; post.vig.uniforms.warm.value = .22; post.vig.uniforms.contrast.value = .18;
const set = await buildSet(scene, renderer);

// ———————————————————— 镜头：一镜到底（柱面坐标关键帧） ————————————————————
// [相机方位, 半径, 高度, 目标方位, 目标半径, 目标高度, 焦点方位, 焦点半径, 焦点高度, 光圈]
const P = PAIRS, mid = (a, b) => (a + b) / 2;
const top = (i, k = 'sol') => topY(P[i][k]);
const H24 = DISC_H + P[10].sol.n * TH;
const CAMK = [
  // S1 2014 一对：从侧面看风电与太阳能并排；慢慢绕
  [0.0, [th(0) + .56, 2.95, .42, th(0) + .06, 2.05, .22, th(0), 2.15, .2, 24]],
  [q(1, 0), [th(0) + .74, 3.6, .74, th(0) + .10, 2.0, .30, th(0), 2.15, .3, 18]],
  [q(2, 2), [th(0) + .66, 3.65, .78, th(0) + .08, 2.05, .30, th(0), 2.15, .3, 18]],
  // S2 推近太阳能一摞的侧边：一片 = 10 GW，黄铜 = 100 GW
  [q(3, 1), [th(0) + .30, 2.95, .34, th(0) - .05, 2.3, .2, th(0), 2.25, .22, 28]],
  [q(3, 3), [th(0) + .26, 2.92, .31, th(0) - .06, 2.3, .2, th(0), 2.25, .22, 28]],
  // S3 沿螺旋横移：2015 → 2020 一对一对叠起
  [q(4, 1), [th(1) + .05, 4.0, .95, th(1) - .45, 2.0, .45, th(1), 2.2, .5, 18]],
  [q(5, 2), [th(3) + .05, 4.2, 1.15, th(3) - .45, 2.0, .6, th(3), 2.2, .65, 18]],
  [q(6, 3), [th(5) + .02, 4.35, 1.35, th(5) - .45, 2.0, .75, th(5), 2.2, .8, 17]],
  // S4 交汇：2020、2021 两对完整同框，停稳再判定
  [q(7, 2), [mid(th(6), th(7)) - .03, 6.6, 3.1, mid(th(6), th(7)), 1.95, .78, mid(th(6), th(7)), 2.1, .7, 10]],
  [q(9, 0), [mid(th(6), th(7)) + .03, 6.5, 3.05, mid(th(6), th(7)) + .02, 1.95, .78, mid(th(6), th(7)), 2.1, .7, 10]],
  // 快速沿螺旋追到 2025（2022–2024 在途中叠起）
  [q(9, 3), [th(9) + .05, 4.6, 2.4, th(9) + .45, 2.4, 1.6, th(10), 2.5, 1.8, 16]],
  // S5 2025：当年新增从画外一片片落下，机位跟着摞顶升高
  [q(10, 1), [th(11) - .36, 4.35, H24 + .42, th(11) + .17, rS(11), H24 - .2, th(11), rS(11), H24, 22]],
  [q(11, 3), [th(11) - .42, 4.6, top(11) + .48, th(11) + .17, rS(11), top(11) - .16, th(11), rS(11), top(11), 22]],
  // S6 摇臂拉远到近顶视：两圈合成一张表盘，圆片落在中心
  [q(13, 2), [.15, 6.6, 19.6, .15 - 1.571, 2.05, .2, 0, 0, .2, 6]],
  [DUR, [.02, 6.8, 20.0, .02 - 1.571, 2.05, .2, 0, 0, .2, 6]],
];
const CAM = track(CAMK);
const cyl = (a, r, y) => new THREE.Vector3(r * Math.sin(a), y, r * Math.cos(a));
const fwd = new THREE.Vector3();
function setCamera(t) {
  const c = CAM(t);
  camera.position.copy(cyl(c[0], c[1], c[2])); camera.lookAt(cyl(c[3], c[4], c[5])); camera.updateMatrixWorld();
  camera.getWorldDirection(fwd);
  post.dof.focus = Math.max(.2, cyl(c[6], c[7], c[8]).sub(camera.position).dot(fwd)); post.dof.aper = c[9]; post.dof.maxCoc = 16;
  return c;
}
const proj = v => { const p = v.clone().project(camera); return [(p.x + 1) / 2 * W, (1 - p.y) / 2 * H, p.z]; };
const stackTop = (s, t) => new THREE.Vector3(s.x, DISC_H + landed(s, t) * TH, s.z);

// ———————————————————— 2D 叠层 ————————————————————
const ov = document.getElementById('ov'), g = ov.getContext('2d');
let TXT = [], REPORT = true;
function text(id, s, x, y, font, color, a = 1, align = 'left', report = s) {
  if (a <= .01) return 0;
  g.globalAlpha = a; g.font = font; g.fillStyle = color; g.textAlign = align; g.fillText(s, x, y);
  const w = g.measureText(s).width, sz = parseFloat(font.split(' ')[1]);
  const x0 = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
  if (REPORT && a > .5) TXT.push({ id, text: report, x0, y0: y - sz, x1: x0 + w, y1: y + sz * .25 });
  g.globalAlpha = 1; return w;
}
const width = (s, font) => { g.font = font; return g.measureText(s).width; };
function line(pts, a, color = INK, w = 1.4) { if (a <= .01) return; g.globalAlpha = a; g.strokeStyle = color; g.lineWidth = w; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); g.globalAlpha = 1; }
function dot(x, y, a, color = INK, r = 3.2) { if (a <= .01) return; g.globalAlpha = a; g.fillStyle = color; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; }
function plate(x, y, w, h, a) { if (a <= .01) return; g.globalAlpha = a * .84; g.fillStyle = '#efebe4'; g.beginPath(); g.roundRect(x, y, w, h, 4); g.fill(); g.globalAlpha = 1; }
function verdict(id, s, a) { if (a <= .01) return; const x = 120, y = 232, w = width(s, '500 46px NotoSC'); plate(x - 24, y - 64, w + 48, 96, a); line([[x, y + 18], [x + w * eo(a), y + 18]], a, ACC, 2); text(id, s, x, y, '500 46px NotoSC', ACC, a); }
function swatch(x, y, kind, a) { if (a <= .01) return; g.globalAlpha = a; g.fillStyle = kind === 'sol' ? '#a9adb2' : '#eef3f5'; g.strokeStyle = INK; g.lineWidth = 1; g.fillRect(x, y - 15, 15, 15); g.strokeRect(x + .5, y - 14.5, 14, 14); g.globalAlpha = 1; }

// 一对的两个读数：排成一列（数值大的在上），引线各自连回摞顶
function pairLabels(p, t, a, side, id, minY = 430) {
  const fV = '300 50px Inter', fU = '500 22px JBMono', k = eo(a);
  const items = [p.wind, p.sol].map(s => { const [ax, ay] = proj(stackTop(s, t)); return { s, ax, ay, val: fmt(s.v) }; }).sort((u, v) => v.s.v - u.s.v);
  const tw = Math.max(...items.map(it => width(it.val, fV))) + 10 + width('GW', fU);
  let cx = side < 0 ? Math.min(...items.map(it => it.ax)) - 70 - tw : Math.max(...items.map(it => it.ax)) + 70;
  cx = clamp(cx, 80, W - 80 - tw);
  const y0 = clamp(Math.min(...items.map(it => it.ay)) - 120, minY, 760);
  items.forEach((it, j) => {
    const ey = y0 + j * 128, lx = side < 0 ? cx + tw + 8 : cx - 8;
    plate(cx - 14, ey - 104, tw + 28, 112, a);
    dot(it.ax, it.ay, a); line([[it.ax, it.ay], [lerp(it.ax, lx, k), lerp(it.ay, ey - 34, k)]], a * .8);
    const wv = text(id + it.s.kind + 'v', it.val, cx, ey - 14, fV, INK, a);
    text(id + it.s.kind + 'u', 'GW', cx + wv + 10, ey - 14, fU, INK2, a);
    swatch(cx, ey - 74, it.s.kind, a);
    text(id + it.s.kind + 't', `${p.year} ${it.s.kind === 'sol' ? LABELS.solar : LABELS.wind}`, cx + 24, ey - 72, '500 24px NotoSC', INK2, a);
  });
}
// 一摞的读数：圆点钉在摞顶，引线向 side（-1 左 / +1 右）上方伸出
function stackLabel(s, t, a, side, lift = 96, id = '') {
  const [ax, ay] = proj(stackTop(s, t)); const k = eo(a);
  const tag = s.kind === 'sol' ? LABELS.solar : LABELS.wind, val = fmt(s.v);
  const fV = '300 50px Inter', fU = '500 22px JBMono', fT = '500 24px NotoSC';
  const wv = width(val, fV), wu = width('GW', fU), tw = wv + 10 + wu;
  let ex = ax + side * 34 * k, ey = ay - lift * k;
  if (side < 0) ex = Math.max(ex, 70 + tw); else ex = Math.min(ex, W - 70 - tw);
  ey = Math.max(ey, 150);
  const x0 = side < 0 ? ex - tw : ex;
  plate(x0 - 14, ey - 104, tw + 28, 112, a);
  dot(ax, ay, a); line([[ax, ay], [ex, ey], [side < 0 ? x0 - 6 : ex + tw + 6, ey]], a);
  text(id + 'v', val, x0, ey - 14, fV, INK, a);
  text(id + 'u', 'GW', x0 + wv + 10, ey - 14, fU, INK2, a);
  swatch(x0, ey - 74, s.kind, a);
  text(id + 't', `${s.year} ${tag}`, x0 + 24, ey - 72, fT, INK2, a);
  return [x0, ey - 100, x0 + tw, ey];
}

let CUES = null;
try { const r = await fetch('out/cues.json'); if (r.ok) CUES = await r.json(); } catch (e) {}
if (!CUES) CUES = VO.map((v, i) => ({ id: v.id, t0: v.t, t1: v.t + 2.8, zh: v.zh, en: v.text }));
const FZ = '500 36px NotoSC', FE = '400 27px Inter', SUB_X = 120, SUB_SAFE = 1100;
function subtitles(t) {
  for (const c of CUES) {
    const t1 = Math.max(c.t1 + .6, c.t0 + 1.8), a = seg(t, c.t0 - .08, c.t0 + .1) * (1 - seg(t, t1 - .12, t1));
    if (a <= .01) continue;
    const wz = width(c.zh, FZ), we = width(c.en, FE), w = Math.max(wz, we);
    g.globalAlpha = a * .78; const gr = g.createLinearGradient(SUB_X - 40, 0, SUB_X + w + 120, 0);
    gr.addColorStop(0, 'rgba(236,232,224,.92)'); gr.addColorStop(.75, 'rgba(236,232,224,.75)'); gr.addColorStop(1, 'rgba(236,232,224,0)');
    g.fillStyle = gr; g.fillRect(SUB_X - 40, 922, w + 160, 112); g.globalAlpha = 1;
    line([[SUB_X - 18, 934], [SUB_X - 18, 1020]], a, INK, 2);
    const save = REPORT; REPORT = false;
    text('sz', c.zh, SUB_X, 970, FZ, INK, a); text('se', c.en, SUB_X, 1010, FE, INK2, a);
    REPORT = save;
  }
}
window.SUBCHECK = (() => { const cues = CUES.map(c => { const wz = Math.round(width(c.zh, FZ)), we = Math.round(width(c.en, FE)); return { id: c.id, zh: c.zh, en: c.en, wz, we, ok: wz <= SUB_SAFE && we <= SUB_SAFE }; }); return { safe: SUB_SAFE, cues, ok: cues.every(c => c.ok) }; })();

function overlay(t) {
  g.clearRect(0, 0, W, H); TXT = [];
  // ① 2014：风电、太阳能两个读数并排停稳，再给判定
  {
    const a = seg(t, T.hold14[0], T.hold14[0] + .35) * (1 - seg(t, q(3, 0) - .3, q(3, 0)));
    if (a > .01) {
      pairLabels(P[0], t, a, -1, 'p14');
    }
    verdict('v14', LABELS.verdict14, seg(t, T.verdict14, T.verdict14 + .3) * (1 - seg(t, q(3, 1) + .3, q(3, 1) + .55)));
  }
  // ② 推近：一片 = 10 GW，黄铜 = 100 GW（方括号卡在片的侧边上）
  {
    const a = seg(t, T.unit[0] + .1, T.unit[0] + .25) * (1 - seg(t, T.unit[1] + .1, T.unit[1] + .3));
    if (a > .01) {
      const s = P[0].sol, edge = (k, side) => { const y = DISC_H + TH * k; const tx = Math.cos(s.a), tz = -Math.sin(s.a), rx = Math.sin(s.a), rz = Math.cos(s.a);
        return proj(new THREE.Vector3(s.x + tx * side * SW / 2 + rx * SD / 2, y, s.z + tz * side * SW / 2 + rz * SD / 2)); };
      const br = (k0, k1, lab, id, dy) => {
        const A = edge(k0, -1), B = edge(k1, -1); const x = Math.min(A[0], B[0]) - 26;
        line([[x + 12, A[1]], [x, A[1]], [x, B[1]], [x + 12, B[1]]], a, INK, 1.6);
        line([[x, (A[1] + B[1]) / 2], [x - 60, (A[1] + B[1]) / 2 + dy]], a, INK, 1.2);
        const ww = width(lab, '500 42px NotoSC'), tx = Math.max(x - 70, 110 + ww), ty = (A[1] + B[1]) / 2 + dy + 14;
        plate(tx - ww - 18, ty - 46, ww + 36, 62, a);
        text(id, lab, tx, ty, '500 42px NotoSC', INK, a, 'right');
      };
      br(5, 6, LABELS.unit1, 'u1', 40); br(9, 10, LABELS.unit2, 'u2', -50);
    }
  }
  // ③ 交汇：2020 与 2021 两对、四个读数同框停稳 ≥ 2.5 s，然后判定
  {
    const a = seg(t, T.hold21[0], T.hold21[0] + .35) * (1 - seg(t, q(9, 0) + .2, q(9, 0) + .5));
    if (a > .01) {
      pairLabels(P[6], t, a, -1, 'p20'); pairLabels(P[7], t, a, 1, 'p21');
    }
    const v = seg(t, T.verdict21, T.verdict21 + .3) * (1 - seg(t, q(10, 0) + .45, q(10, 0) + .7));
    verdict('v21', LABELS.verdict21, v);
  }
  // ④ 2025：计数器按落下的片数滚动；报告给 readcheck 的是落定值
  {
    const a = seg(t, q(10, 0) + .85, q(10, 0) + 1.15) * (1 - seg(t, T.crane - .2, T.crane + .12));
    if (a > .01) {
      const s = P[11].sol, nl = clamp(landed(s, t) - P[10].sol.n, 0, NEW25);
      const val = nl >= NEW25 ? s.v : P[10].sol.v + (s.v - P[10].sol.v) * nl / NEW25;
      const ty = DISC_H + (P[10].sol.n + nl) * TH;
      let mx = -1e9, my = 0;
      for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const tx = Math.cos(s.a), tz = -Math.sin(s.a), rx = Math.sin(s.a), rz = Math.cos(s.a);
        const pp = proj(new THREE.Vector3(s.x + tx * u * SW / 2 + rx * v * SD / 2, ty, s.z + tz * u * SW / 2 + rz * v * SD / 2)); if (pp[0] > mx) { mx = pp[0]; my = pp[1]; } }
      const bx = clamp(mx + 96, 0, 1290), by = clamp(my + 40, 280, 820);
      line([[mx + 14, my], [bx - 22, my]], a * .9, ACC, 1.6); dot(mx + 14, my, a, ACC, 3.6);
      text('l25', LABELS.c25, bx, by - 150, '500 32px NotoSC', INK, a);
      const w = text('n25', fmt(val), bx - 6, by - 12, '200 150px Inter', ACC, a, 'left', fmt(s.v));
      text('g25', 'GW', bx + w + 10, by - 16, '500 34px JBMono', ACC, a);
      text('d25', LABELS.add25, bx, by + 46, '500 28px NotoSC', INK2, a * seg(t, T.drop25 + .3, T.drop25 + .7));
    }
  }
  // ⑤ 表盘：圆片落定后的说明（数字刻在圆片上）；出处一直挂在右下
  {
    const a = seg(t, T.puck + .15, T.puck + .5);
    if (a > .01) {
      const [px, py] = proj(new THREE.Vector3(0, DISC_H + .075, 0)), x = 120, y = 300, w = width(LABELS.puck, '500 40px NotoSC');
      line([[x + w + 18, y - 14], [x + w + 18 + (px - .64 * 0 - x - w - 18) * eo(a) - 0, y - 14 + (py - y + 14) * eo(a)]], a, ACC, 1.6);
      dot(px, py, a * seg(t, T.puck + .4, T.puck + .6), ACC, 4);
      text('pk', LABELS.puck, x, y, '500 40px NotoSC', ACC, a);
    }
    const sa = seg(t, T.crane + .6, T.crane + 1);
    text('src', LABELS.source, W - 90, 78, '400 21px NotoSC', INK2, sa, 'right');
  }
  // ⑥ 落版卡
  {
    const a = seg(t, T.end - 1.45, T.end - 1.1), b = seg(t, T.end - 1.3, T.end - .95), c = seg(t, T.end - 1.0, T.end - .65);
    const x = 120, y = 560, r = v => 16 * (1 - eo(v));
    text('t1', LABELS.title, x, y + r(a), '600 84px NotoSerifSC', INK, a);
    text('t2', LABELS.titleEn, x + 2, y + 58 + r(a), '300 36px Inter', INK2, a);
    line([[x, y + 100], [x + 360 * eo(b), y + 100]], b, INK, 1.2);
    text('t3', LABELS.style, x, y + 142, '400 21px JBMono', INK2, b);
    text('t4', LABELS.sign, x, y + 180, '500 22px JBMono', INK, c);
  }
  subtitles(t);
}

// ———————————————————— 帧 ————————————————————
const PUCK_YAW = Math.PI / 2 + .30;
window.DUR = DUR;
window.render = t => {
  set.update(t, PUCK_YAW);
  setCamera(t);
  post.composer.render();
  overlay(t);
};
window.TEXTS = t => { window.render(t); return TXT; };
// 声音事件：叠片、黄铜刻度、落片、判定、抽空、圆片、落版、镜头大动作
const EV = [...EVENTS,
  { t: T.verdict14, type: 'verdict', v: .7 }, { t: T.suck, type: 'suck', d: T.verdict21 - T.suck }, { t: T.verdict21, type: 'turn' },
  { t: T.suck2, type: 'suck', d: T.puck - T.suck2 }, { t: T.puck, type: 'puck' }, { t: T.end - 1.25, type: 'end' },
  { t: q(3, 0), type: 'whoosh', d: .9, v: .4 }, { t: q(4, 0), type: 'whoosh', d: 1.0, v: .5 }, { t: q(9, 0) + .3, type: 'whoosh', d: 1.6, v: .8 },
  { t: T.crane, type: 'whoosh', d: 3.2, v: .7 }, { t: T.drop25 + NEW25 * T.dropStep + .42, type: 'land25' },
].sort((a, b) => a.t - b.t);
window.EV = EV;
window.render(0);
window.READY = true;
