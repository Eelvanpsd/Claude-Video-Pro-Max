// Camera smoothness, "the wall is never seen whole before the reveal", and the judgement frames.
//   node tools/camcheck.mjs [--reveal 31.1] [--fps 24]          (run from anywhere; LIB found from this file)
// Samples the page's camera (window.CAM) at 4× the frame rate and writes out/camcheck.csv:
//   t, x, y, zoom, roll, screen speed (px/frame of the frame content), its acceleration and jerk,
//   the share of the board's width and area in frame, and whether the board's left/right edges are in frame.
// Fails (exit 1) when, before --reveal:
//   - more than 60 % of the board's width, or 40 % of its area, is in frame, or
//   - both the left and the right board edges are in frame at once, or
//   - more than 10 % of the right zone (scene.right_zone: prints, cards, notes, verdict, end card) is in frame;
// when, inside a judgement window (scene.judge[name].t0 … t1), any part of its box leaves the frame or dips into
// the subtitle strip (bottom 15 %);
// and anywhere when the frame-content velocity jumps between consecutive samples by more than
// max(6 px/frame, 30 % of the speed) outside a declared impact shake (scene.cam.shakes).
import path from 'path'; import fs from 'fs'; import { fileURLToPath } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), DEMO = path.resolve(HERE, '..');
const LIB = process.env.LIB || path.resolve(DEMO, '../../..');
const { openDemo, closeServer } = await import(path.join(LIB, 'core/render/page.mjs'));
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const FPS = +opt('--fps', 24);
const { browser, page } = await openDemo(DEMO, { w: 1920, h: 1080 });
const res = await page.evaluate(({ FPS }) => {
  const W = 1920, H = 1080, dur = window.DUR, rows = [], step = 1 / (FPS * 4);
  const corners = [[0, 0], [W, 0], [W, H], [0, H]];
  for (let t = 0; t <= dur + 1e-9; t += step) {
    const c = window.CAM(t), wc = corners.map(p => window.TOWORLD(p, t)), xs = wc.map(p => p[0]), ys = wc.map(p => p[1]);
    rows.push({ t, x: c.x, y: c.y, zoom: c.zoom, roll: c.roll, dx: c.dx, dy: c.dy, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) });
  }
  return { rows };
}, { FPS });
// screen-space motion, in px per frame: pan of the frame centre, zoom as the speed of the frame
// corners moving out/in (half-diagonal 1101 px × d ln z), roll as corner speed (1101 px × d roll)
{
  const R = res.rows, dt = 1 / (FPS * 4);
  for (let i = 0; i < R.length; i++) {
    const a = R[Math.max(0, i - 1)], b = R[Math.min(R.length - 1, i + 1)], h = (b.t - a.t) || dt, z = R[i].zoom;
    const vx = ((b.x - a.x) * z + (b.dx - a.dx)) / h / FPS, vy = ((b.y - a.y) * z + (b.dy - a.dy)) / h / FPS;
    const vz = Math.log(b.zoom / a.zoom) / h / FPS * 1101, vr = (b.roll - a.roll) * Math.PI / 180 / h / FPS * 1101;
    Object.assign(R[i], { vx, vy, vz, vr, v: Math.hypot(vx, vy) + Math.abs(vz) + Math.abs(vr) });
  }
}
const scene = JSON.parse(fs.readFileSync(path.join(DEMO, 'scenes/film.json'), 'utf8'));
const B = scene.board, reveal = +opt('--reveal', scene.reveal ?? scene.dur), shakes = scene.cam.shakes || [];
const rows = res.rows; let bad = 0; const notes = [];
for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  const vx0 = Math.max(0, r.x0), vx1 = Math.min(B.w, r.x1), vy0 = Math.max(0, r.y0), vy1 = Math.min(B.h, r.y1);
  r.wfrac = Math.max(0, vx1 - vx0) / B.w; r.afrac = r.wfrac * Math.max(0, vy1 - vy0) / B.h;
  r.left = r.x0 <= 0 && r.x1 >= 0; r.right = r.x0 <= B.w && r.x1 >= B.w;
  if (i > 0) { const p = rows[i - 1]; r.a = Math.hypot(r.vx - p.vx, r.vy - p.vy, r.vz - p.vz, r.vr - p.vr) * 4; } else r.a = 0;   // px/frame per frame
  r.j = i > 0 ? Math.abs(r.a - rows[i - 1].a) * 4 : 0;
  r.shake = shakes.some(s => r.t >= s.t - .01 && r.t <= s.t + 1.2);
  const RZ = scene.right_zone;
  r.rz = RZ ? Math.max(0, Math.min(RZ[2], r.x1) - Math.max(RZ[0], r.x0)) * Math.max(0, Math.min(RZ[3], r.y1) - Math.max(RZ[1], r.y0)) / ((RZ[2] - RZ[0]) * (RZ[3] - RZ[1])) : 0;
  if (r.t < reveal - 1e-6) {
    if (r.rz > .10) { bad++; if (notes.length < 40) notes.push(`t=${r.t.toFixed(3)} ${(r.rz * 100).toFixed(1)}% of the right zone in frame before the reveal`); }
    if (r.wfrac > .60 || r.afrac > .40) { bad++; if (notes.length < 40) notes.push(`t=${r.t.toFixed(3)} board width ${(r.wfrac * 100).toFixed(1)}% / area ${(r.afrac * 100).toFixed(1)}% in frame before the reveal`); }
    if (r.left && r.right) { bad++; if (notes.length < 40) notes.push(`t=${r.t.toFixed(3)} both board edges in frame before the reveal`); }
  }
}
// a velocity discontinuity shows as a one-sample spike in acceleration, an acceleration
// discontinuity as a spike in jerk: compare each sample with its neighbourhood
const med = (arr) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
for (let i = 6; i < rows.length - 6; i++) {
  const r = rows[i]; if (r.shake) continue;
  const nb = rows.slice(i - 6, i + 7).filter((_, k) => k !== 6);
  const ma = med(nb.map(q => q.a)), mj = med(nb.map(q => q.j));
  if (r.a > Math.max(2.5, 4 * ma)) { bad++; if (notes.length < 40) notes.push(`t=${r.t.toFixed(3)} velocity jump: acceleration ${r.a.toFixed(2)} px/frame² vs ${ma.toFixed(2)} around it`); }
  if (r.j > Math.max(4, 6 * mj)) { bad++; if (notes.length < 40) notes.push(`t=${r.t.toFixed(3)} acceleration jump: jerk ${r.j.toFixed(2)} vs ${mj.toFixed(2)} around it`); }
}
// judgement frames: the whole box in frame and above the subtitle strip for the whole window; how still the camera is
const judge = scene.judge || {}, jrep = [];
for (const [name, J] of Object.entries(judge)) {
  const win = rows.filter(r => r.t >= J.t0 - 1e-6 && r.t <= J.t1 + 1e-6); let worst = Infinity, vmax = 0;
  for (const r of win) {
    const m = Math.min(J.box[0] - r.x0, r.x1 - J.box[2], J.box[1] - r.y0, (r.y0 + .85 * (r.y1 - r.y0)) - J.box[3]) * r.zoom;   // screen px
    worst = Math.min(worst, m); vmax = Math.max(vmax, r.v);
    if (m < 0) { bad++; if (notes.length < 40) notes.push(`t=${r.t.toFixed(3)} judgement frame "${name}" cut by ${(-m).toFixed(0)} px`); }
  }
  jrep.push(`${name.padEnd(11)} ${J.t0.toFixed(2)}–${J.t1.toFixed(2)} s  hold ${(J.t1 - J.t0).toFixed(2)} s  frame ${(1920 / J.z).toFixed(0)} board px wide  min margin ${worst.toFixed(0)} px  max speed ${vmax.toFixed(1)} px/frame`);
}
const pre = rows.filter(r => r.t < reveal);
const maxW = Math.max(...pre.map(r => r.wfrac)), maxA = Math.max(...pre.map(r => r.afrac));
const after = rows.filter(r => r.t >= reveal), endW = after.length ? Math.max(...after.map(r => r.wfrac)) : 0;
const firstWhole = rows.find(r => r.left && r.right);
fs.mkdirSync(path.join(DEMO, 'out'), { recursive: true });
fs.writeFileSync(path.join(DEMO, 'out/camcheck.csv'), 't,x,y,zoom,roll,dx,dy,v,a,j,wfrac,afrac,left,right\n' + rows.map(r => [r.t.toFixed(4), r.x.toFixed(2), r.y.toFixed(2), r.zoom.toFixed(5), r.roll.toFixed(4), r.dx.toFixed(3), r.dy.toFixed(3), r.v.toFixed(3), r.a.toFixed(3), r.j.toFixed(3), r.wfrac.toFixed(4), r.afrac.toFixed(4), +r.left, +r.right].join(',')).join('\n'));
console.log(`samples ${rows.length} · reveal at ${reveal}s · before it: max ${(maxW * 100).toFixed(1)}% of the board width, ${(maxA * 100).toFixed(1)}% of its area in frame`);
console.log(`whole board (both edges) first in frame at ${firstWhole ? firstWhole.t.toFixed(2) + ' s' : 'never'} · after the reveal up to ${(endW * 100).toFixed(1)}% of the width`);
const pk = rows.reduce((m, r) => r.v > m.v ? r : m, rows[0]), wk = pre.reduce((m, r) => r.wfrac > m.wfrac ? r : m, pre[0]);
const maxRZ = Math.max(...pre.map(r => r.rz));
console.log(`before the reveal: at most ${(maxRZ * 100).toFixed(1)}% of the right zone in frame`);
for (const l of jrep) console.log('judgement ' + l);
console.log(`peak frame-content speed ${pk.v.toFixed(1)} px/frame at ${pk.t.toFixed(2)} s · widest framing before the reveal at ${wk.t.toFixed(2)} s`);
for (const n of notes) console.log('  BAD ' + n);
console.log(bad ? `camcheck: ${bad} problems` : 'camcheck: OK');
await browser.close(); closeServer();
process.exit(bad ? 1 : 0);
