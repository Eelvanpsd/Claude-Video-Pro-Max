// 《地图上还写着海》 The Map Still Says Sea — Satellite Briefing demo.
// render(t) is a pure function of t: camera from keyframes, plates and scans from the timeline,
// annotations through the one camera (engine.project).
import { clamp, lerp, seg, ss, eio, eo, ei } from '/core/lib.js';
import { Engine, makeCamera, project, unproject } from './engine.js';
import { C, text, measure, hair, pathLL, brackets, tick, readout, subtitle, SUB, beginTexts, endTexts } from './overlay.js';
import { T, RINGS, REWIND, VO, BEAT } from './timeline.js';

const W = 1920, H = 1080;
const gl = new Engine(document.getElementById('gl'));
const cv = document.getElementById('ov'), ctx = cv.getContext('2d');
const Q = new URLSearchParams(location.search);

const load = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('image ' + src)); i.src = src; });
const json = src => fetch(src).then(r => { if (!r.ok) throw new Error(src); return r.json(); });
let P, V, DURS = {};
const BB = {};   // plate name -> bbox

// ------------------------------------------------------------------ places (lon/lat); measured ones come from vectors.json
const G = {
  aral: [59.75, 45.15],
  north: [60.72, 46.48],
  landing: [60.27, 44.94],      // wind-streaked salt crust of the dry eastern basin (2025)
  // Kok-Aral dike traced on the 2025 Landsat plate: NW arm, corner, east arm
  dam: [[60.750, 46.120], [60.788, 46.087], [60.865, 46.088]],
};
const DAM_MID = () => [60.805, 46.118];

// ------------------------------------------------------------------ camera
// keyframes: t, target lon/lat, distance d (km, log-interpolated), tilt, heading, lens shift sx, sy
function camKeys() {
  const mu = V.points.muynak, ed = V.points.edge, land = G.landing, dm = DAM_MID();
  const mid = [(mu[0] + ed[0]) / 2, (mu[1] + ed[1]) / 2];
  return [
    { t: 0.0, ll: [58.6, 41.9], d: 4300, tilt: 57, hd: 12, sx: 0, sy: 10 },
    { t: T.dive0, ll: [59.3, 42.8], d: 3800, tilt: 55, hd: 21, sx: 0, sy: 0, e: 'lin' },
    { t: T.dive0 + 1.6, ll: [60.1, 44.55], d: 1000, tilt: 22, hd: 8, sx: 0, sy: 20, e: 'i' },
    { t: T.touch, ll: [60.92, 45.05], d: 160, tilt: 0, hd: 0, sx: 0, sy: 0, e: 'o' },             // inside the printed map, its east coast in frame
    { t: T.rewind, ll: land, d: 46, tilt: 0, hd: 0, sx: 0, sy: 0, e: 'o' },                         // settling onto the salt
    { t: T.y1977 - 0.05, ll: G.aral, d: 980, tilt: 0, hd: 0, sx: -190, sy: 10, e: 'o' },
    { t: T.y2025, ll: [59.68, 44.98], d: 600, tilt: 0, hd: -15, sx: -190, sy: 10, e: 'acc' },         // a slow orbit that speeds up with the rings...
    { t: T.y2025 + 0.3, ll: [59.67, 44.975], d: 588, tilt: 0, hd: -15.7, sx: -190, sy: 10, e: 'o' },  // ...and brakes with the stop
    { t: T.push0, ll: mu, d: 520, tilt: 0, hd: -12, sx: 0, sy: 0, e: 'io' },                         // the hold pans the old port to the centre while the reticle locks on it
    { t: T.arrive, ll: mu, d: 92, tilt: 0, hd: 0, sx: 0, sy: 0, e: 'ioE' },                        // a pure push on the port: it stays at the centre
    { t: T.range0, ll: [mu[0] + .02, mu[1] + .01], d: 80, tilt: 0, hd: -2, sx: -640, sy: 60, e: 'io' },    // then slides left to give the line room
    { t: T.rangeEnd, ll: ed, d: 104, tilt: 0, hd: 0, sx: 60, sy: -110, e: 'track' },               // the camera chases the tip to the sea
    { t: T.sil2, ll: mid, d: 245, tilt: 0, hd: 0, sx: 40, sy: -40, e: 'io' },                       // then shows the whole distance
    { t: T.whip, ll: [mid[0] * .75 + ed[0] * .25, mid[1] * .75 + ed[1] * .25], d: 205, tilt: 0, hd: 1.5, sx: 40, sy: -40, e: 'lin' },
    { t: T.north, ll: dm, d: 44, tilt: 0, hd: 0, sx: -120, sy: 30, e: 'whip' },
    { t: T.n2009, ll: [dm[0] + .012, dm[1] + .02], d: 31, tilt: 0, hd: 4, sx: -120, sy: 30, e: 'o2' },  // push in while the water grows
    { t: T.pull, ll: [dm[0] + .03, dm[1] + .035], d: 24, tilt: 0, hd: 7, sx: -120, sy: 30, e: 'lin' },
    { t: T.pull + 2.2, ll: G.north, d: 700, tilt: 8, hd: 4, sx: 0, sy: 0, e: 'i' },
    { t: T.end, ll: [61.2, 44.6], d: 8800, tilt: 50, hd: 22, sx: 0, sy: 60, e: 'oL' },
    { t: T.dur, ll: [50.5, 42.6], d: 11500, tilt: 56, hd: 33, sx: 0, sy: 60, e: 'lin' },
  ];
}
const EASE = { io: eio, i: t => t * t * (2.2 - 1.2 * t), o: eo, lin: t => t, whip: t => ss(ss(t)), acc: t => 0.45 * t + 0.55 * Math.pow(t, 2.8), oL: t => 0.6 * eo(t) + 0.4 * t, track: eio, ss, ioE: t => eio(Math.pow(t, 0.7)), o2: t => 1 - (1 - t) * (1 - t) };
let KEYS;
function camAt(t) {
  let i = 0; while (i < KEYS.length - 2 && t > KEYS[i + 1].t) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const u = (EASE[b.e] || eio)(seg(t, a.t, b.t));
  const lg = Math.exp(lerp(Math.log(a.d), Math.log(b.d), u));
  // during big zooms, move the target in step with the log-scale so the ground does not skate
  const k = Math.abs(Math.log(b.d / a.d)) > 1.2 ? zoomFollow(a.d, b.d, lg) : u;
  return {
    lon: lerp(a.ll[0], b.ll[0], k), lat: lerp(a.ll[1], b.ll[1], k), d: lg,
    tilt: lerp(a.tilt, b.tilt, u), heading: lerp(a.hd, b.hd, u), sx: lerp(a.sx, b.sx, u), sy: lerp(a.sy, b.sy, u), fov: 30,
  };
}
function zoomFollow(d0, d1, d) {   // fraction of the pan done, proportional to the inverse scale change
  const s0 = 1 / d0, s1 = 1 / d1, s = 1 / d;
  return clamp((s - s0) / (s1 - s0));
}

// ------------------------------------------------------------------ time on the ground: which year each plate shows
const YEARS = [1977, 1989, 2000, 2009, 2014, 2025];
function regionState(t) {
  // returns { A, B, scan (lat), dir, glow, printYear, printScan }
  const N = 47.4, S = 42.9;
  if (t < T.rewind) return { A: 2025, B: 2025, scan: -90, dir: 1, glow: 0 };
  for (const r of REWIND) {
    if (t >= r.t0 && t < r.t1) {   // upward scan: the older year is painted from the south
      const u = ss(seg(t, r.t0, r.t1));
      return { A: r.from, B: r.to, scan: lerp(S, N, u), dir: -1, glow: 0.9 };
    }
  }
  if (t < RINGS[0].t - RINGS[0].sweep) return { A: 1977, B: 1977, scan: -90, dir: 1, glow: 0 };
  for (let i = 1; i < RINGS.length; i++) {
    const r = RINGS[i], t0 = r.t - r.sweep;
    if (t >= t0 && t < r.t) {
      const u = seg(t, t0, r.t);
      return { A: RINGS[i - 1].year, B: r.year, scan: lerp(47.25, 43.25, u), dir: 1, glow: 1, print: r.year };
    }
    if (t < t0) return { A: RINGS[i - 1].year, B: RINGS[i - 1].year, scan: -90, dir: 1, glow: 0 };
  }
  return { A: 2025, B: 2025, scan: -90, dir: 1, glow: 0 };
}
// ring printing: lat of the scan for year y at time t (rings appear north of it), or null if not printed yet
function ringScan(y, t) {
  if (y === 1977) {   // the first ring is traced once the rewind lands
    if (t < T.y1977) return null;
    return lerp(47.25, 43.25, eo(seg(t, T.y1977, T.y1977 + 0.5)));
  }
  const r = RINGS.find(r => r.year === y); if (!r) return null;
  if (t < r.t - r.sweep) return null;
  return lerp(47.25, 43.25, seg(t, r.t - r.sweep, r.t));
}

// ------------------------------------------------------------------ loading
async function init() {
  [P, V] = await Promise.all([json('assets/plates/plates.json'), json('assets/vectors.json')]);
  CUES = await json('cues.json');
  V.points.edge = V.points.edge_mu2025 || V.points.edge_r2025;
  const names = ['world', 'ca', ...YEARS.map(y => 'r' + y), 'la2025', 'mu2025', 'ko2001', 'ko2009', 'ko2025'];
  const DRAFT = Q.has('draft');   // look tests before every plate exists: stand-ins instead of failing
  const sub = n => DRAFT && !P[n] ? (n.startsWith('ko') ? 'r2025' : n.startsWith('r') ? 'r2025' : 'la2025') : n;
  const imgs = await Promise.all(names.map(n => load(`assets/plates/${sub(n)}.jpg`)));
  names.forEach((n, i) => { gl.upload(n, imgs[i]); BB[n] = P[sub(n)].plate; });
  const masks = ['ko2001', 'ko2009', 'ko2025', 'r2025'];
  const mimgs = await Promise.all(masks.map(n => load(`assets/plates/${sub(n)}_w.png`)));
  masks.forEach((n, i) => gl.upload(n + '_w', mimgs[i], { mip: true }));
  const [mf, gr] = await Promise.all([load('assets/plates/mapfield.png'), load('assets/plates/ko_grow.png')]);
  gl.upload('mapfield', mf, { mip: true }); gl.upload('ko_grow', gr, { mip: false });
  if (DRAFT) for (const y of YEARS) if (!V.area[y]) { V.area[y] = V.area[2025]; V.rings[y] = V.rings[2025]; }
  KEYS = camKeys();
  await Promise.all(['300 112px BC', '400 33px BC', '500 30px BC', '400 16px PM', '500 16px PM', '500 38px SC', '400 20px SC', '600 60px SS'].map(f => document.fonts.load(f, '咸海地图上还写着1977')));
  subCheck();
  window.EV = events();
  window.READY = true;
}

// ------------------------------------------------------------------ subtitles: every line must fit on ONE line
let CUES = [];   // from cues.json (tools/export.mjs): the same intervals as the .srt
function subCheck() {
  const rep = CUES.map(c => {
    const wz = measure(ctx, c.zh, SUB.fontZh, SUB.trackZh), we = measure(ctx, c.en, SUB.fontEn, SUB.trackEn);
    return { id: c.id, zh: c.zh, en: c.en, wz: Math.round(wz), we: Math.round(we), ok: wz <= SUB.safe && we <= SUB.safe && !/\n/.test(c.zh + c.en) };
  });
  window.SUBCHECK = { safe: SUB.safe, cues: rep, ok: rep.every(r => r.ok) };
  if (!window.SUBCHECK.ok) throw new Error('subtitle line too wide: ' + JSON.stringify(rep.filter(r => !r.ok)));
}

// ------------------------------------------------------------------ the frame
const fmt = n => Math.round(n).toLocaleString('en-US');
function areaPct(y) { return 100 * V.area[String(y)].km2 / V.base_km2; }   // measured water / 68,000 km² (USGS)

function render(t) {
  t = clamp(t, 0, T.dur - 1e-4);
  beginTexts();
  const cp = camAt(t);
  // whip pan: blur along the screen motion
  let blur = 0, bdir = [1, 0];
  if (t > T.whip - 0.05 && t < T.north + 0.1) {
    const a = camAt(t - 1 / 48), b = camAt(t + 1 / 48);
    const ca = makeCamera(cp, W, H);
    const pa = project(ca, a.lat, a.lon), pb = project(ca, b.lat, b.lon);
    const dx = pa[0] - pb[0], dy = pa[1] - pb[1], m = Math.hypot(dx, dy);
    blur = Math.min(260, m * 0.9); bdir = m > 0 ? [dx / m, dy / m] : [1, 0];
  }
  const cam = makeCamera(cp, W, H);
  const rs = regionState(t);
  // detail plate per section
  let det = null, scan4 = -90, dir4 = 1, glow4 = 0, grow = -1;
  const alt = cam.alt;
  const dA = k => clamp(1 - (Math.log(alt) - Math.log(k)) / Math.log(2.2));   // fade detail in below altitude k
  if (t < T.rewind + 0.6) det = { A: 'la2025', a: dA(160) };
  else if (t > T.y2025 && t < T.whip + 0.3) det = { A: 'mu2025', a: dA(300) };
  else if (t >= T.whip + 0.3 && t < T.pull + 3) {
    // the 2009 water grows outward from the 2001 shore, reaching the dam on the beat of the 2009 ring
    det = { A: 'ko2001', B: 'ko2009', a: dA(260), grow: 'ko_grow' };
    grow = t < T.n2001 + 0.1 ? 0 : 0.003 + 0.997 * ss(seg(t, T.n2001 + 0.1, T.n2009));
    if (t >= T.n2009) { det.A = 'ko2009'; det.grow = null; grow = -1; }
    // before the pull-back reveals the region plate (2025), the north plate quietly becomes 2025 too
    if (t >= T.pull - 0.6) { det.A = 'ko2009'; det.B = 'ko2025'; scan4 = lerp(46.6, 45.7, ss(seg(t, T.pull - 0.6, T.pull + 0.4))); }
    if (t >= T.pull + 0.4) { det.A = 'ko2025'; det.B = 'ko2025'; scan4 = -90; }
  }
  const grey = t < T.grey0 ? 0 : t < T.pull + 1.2 ? ss(seg(t, T.grey0, T.touch - 0.3)) : 1 - ss(seg(t, T.pull + 1.2, T.end - 0.4));
  const waterCol = ss(seg(t, T.n2009 - 0.2, T.n2009 + 0.9));
  const shade = 1 - ss(seg(alt, 600, 2500)) * 0 - ss(seg(Math.log(alt), Math.log(2500), Math.log(500)));
  gl.draw({
    cam,
    slots: {
      ca: { tex: 'ca', bbox: BB.ca, a: 1 },
      regA: { tex: 'r' + rs.A, bbox: BB['r' + rs.A], a: 1, mask: 'r2025_w' },
      regB: { tex: 'r' + rs.B, bbox: BB['r' + rs.B], a: 1, mask: 'r2025_w' },
      detA: det ? { tex: det.A, bbox: BB[det.A], a: det.a, mask: det.A.startsWith('ko') ? det.A + '_w' : null, grow: det.grow || null } : null,
      detB: det && det.B ? { tex: det.B, bbox: BB[det.B], a: det.a, mask: det.B + '_w' } : null,
    },
    scan2: rs.scan, scanDir2: rs.dir, glow2: rs.glow, scan4, scanDir4: 1, glow4, grow,
    ...mapState(t, cam), mapBox: P.mapfield.plate,
    contrast: 1 + 0.12 * ss(seg(t, T.rewind, T.y1977)) + 0.2 * ss(seg(t, T.push0, T.arrive)) * (1 - ss(seg(t, T.whip, T.north))),
    grey, waterCol, shade: clamp(shade), expo: 1, blur, blurVec: bdir,
    clarity: 0.35 + 0.6 * ss(seg(Math.log(alt), Math.log(400), Math.log(60))) + 0.25 * ss(seg(t, T.push0, T.arrive)) * (1 - ss(seg(t, T.whip, T.north))), detail: 0.8 + 0.6 * ss(seg(Math.log(alt), Math.log(400), Math.log(60))),
    dim: 0.38 * ss(seg(t, T.end, T.end + 0.8)),
  });

  ctx.clearRect(0, 0, W, H);
  drawMap(t, cam);
  drawRings(t, cam);
  drawMuynak(t, cam);
  drawNorth(t, cam);
  drawRelabel(t, cam);
  drawHud(t, cam);
  drawReadouts(t, cam);
  drawSubs(t);
  drawEnd(t, cam);
  return endTexts();
}

// ------------------------------------------------------------------ map layer (the claim)
// A printed atlas page lies over the imagery: at orbit only its blue sea; as we fall, the whole page
// (paper, waterlines, coast, graticule, rivers, serif names). At touchdown a scan bar sweeps it off.
const MAP_LABEL = [60.42, 45.17];
const WIPE = { t0: T.touch - 0.04, t1: T.touch + 0.30 };
function wipeLat(t, cam) {
  if (t < WIPE.t0) return 90;
  const top = unproject(cam, W / 2, -40), bot = unproject(cam, W / 2, H + 40);
  const n = top ? top[0] : 47, s_ = bot ? bot[0] : 43;
  return t >= WIPE.t1 ? -90 : lerp(n, s_, ei(seg(t, WIPE.t0, WIPE.t1)) * .35 + seg(t, WIPE.t0, WIPE.t1) * .65);
}
function mapState(t, cam) {
  const on = ss(seg(t, T.mapOn, T.mapOn + 0.25));
  const page = ss(seg(Math.log(cam.alt), Math.log(1500), Math.log(520)));
  const alive = t < WIPE.t1 ? 1 : 0;
  return { map: page * alive * on, mapSea: on * alive * (0.62 + 0.3 * page), mapWipe: wipeLat(t, cam) };
}
function drawMap(t, cam) {
  const on = ss(seg(t, T.mapOn, T.mapOn + 0.25));
  if (on <= 0 || t > T.y1977 + 1) return;
  const ms = mapState(t, cam);
  const page = ms.map;
  // everything printed on the page goes with the scan; the sea's name stays behind over the sand
  const wl = ms.mapWipe;
  let clipY = -1e4;
  if (wl < 89) { const p = project(cam, Math.max(-89, wl), cam.tgt.lon); clipY = wl < -89 ? H + 1e4 : p[1]; }
  ctx.save();
  ctx.beginPath(); ctx.rect(0, clipY, W, H + 2e4); ctx.clip();
  // rivers (ink blue) and their names, towns
  const ink = 'rgba(46,92,150,1)';
  if (page > 0.01 && V.rivers) {
    hair(ctx, () => { for (const k in V.rivers) for (const l of V.rivers[k]) pathLL(ctx, cam, l); }, { w: 1.6, col: ink, alpha: page * 0.85, halo: 0 });
  }
  // town dots (no names: the only lettering on this page is the sea's own name)
  for (const [lo, la] of [[61.67, 46.79], [59.03, 43.77]]) {
    const [x, y, vis] = project(cam, la, lo);
    if (!vis) continue;
    ctx.save(); ctx.globalAlpha = page; ctx.fillStyle = '#3A2E26'; ctx.beginPath(); ctx.arc(x, y, 5, 0, 6.2832); ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = '#3A2E26'; ctx.beginPath(); ctx.arc(x, y, 9, 0, 6.2832); ctx.stroke(); ctx.restore();
  }
  ctx.restore();
  // the sea's name, in the map's serif: it outlives the page and floats over the sand until the rewind
  const la = on * (1 - ss(seg(t, T.rewind, T.rewind + 0.4)));
  let [x, y, vis] = project(cam, MAP_LABEL[1], MAP_LABEL[0]);
  const pinU = ss(seg(t, T.touch - 0.4, T.touch + 0.45));   // the name drifts to the centre and outlives the page
  x = lerp(x, W / 2, pinU); y = lerp(y, H / 2 - 40, pinU); vis = vis || pinU > 0.5;
  if (vis && la > 0) {
    const sz = lerp(46, 150, ss(seg(Math.log(4500 / cam.alt), 0, Math.log(4500 / 150))));
    const over = t >= WIPE.t0 + 0.12;          // over the sand: pale ink with a dark halo; on the page: map ink
    const col = over ? C.mapInk : '#1F3F6B';
    text(ctx, '咸 海', x, y, { font: `600 ${Math.round(sz)}px SS`, col, align: 'center', track: Math.round(sz * 0.12), alpha: la, halo: over || page < 0.5 ? 10 : 0, id: 'map-name' });
    text(ctx, '地图 · 约 68,000 km²', x, y + sz * 0.42 + 28, { font: `500 ${Math.round(lerp(22, 30, sz / 150))}px SC`, col, align: 'center', track: 1, alpha: la * ss(seg(t, T.mapOn + 0.3, T.mapOn + 0.6)), halo: over || page < 0.5 ? 6 : 0, id: 'map-claim' });
  }
}

// ------------------------------------------------------------------ the rings (signature shot)
const lc = document.createElement('canvas'); lc.width = W; lc.height = H; const lx = lc.getContext('2d');
function lostBand(cam, yPrev, yNew) {   // the water lost between two rings, as a filled band (offscreen)
  lx.clearRect(0, 0, W, H);
  lx.globalCompositeOperation = 'source-over'; lx.fillStyle = '#fff';
  lx.beginPath(); for (const l of V.rings[yPrev]) pathLL(lx, cam, l, { close: true }); lx.fill('evenodd');
  lx.globalCompositeOperation = 'destination-out';
  lx.beginPath(); for (const l of V.rings[yNew]) pathLL(lx, cam, l, { close: true }); lx.fill('evenodd');
  lx.globalCompositeOperation = 'source-over';
  return lc;
}
function focusMask(t, cam) {   // the analyst dims everything outside the old sea while the rings are read
  const a = 0.42 * ss(seg(t, T.y1977 - 0.3, T.y1977 + 0.4)) * (1 - ss(seg(t, T.push0, T.push0 + 1.0)));
  if (a <= 0.003) return;
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H);
  for (const r of V.historic) pathLL(ctx, cam, r, { close: true });
  ctx.fillStyle = `rgba(3,6,9,${a})`; ctx.fill('evenodd');
  hair(ctx, () => { for (const r of V.historic) pathLL(ctx, cam, r, { close: true }); }, { w: 1.2, col: C.mapLine, alpha: a * 1.6, dash: [6, 7], halo: 0 });
  ctx.restore();
}
const LONG = {};
function longest(y) { if (!(y in LONG)) LONG[y] = (V.rings[y] || []).reduce((m, l) => (l.length > (m ? m.length : 0) ? l : m), null); return LONG[y]; }
function drawRings(t, cam) {
  if (t < T.y1977 - 0.3) return;
  focusMask(t, cam);
  // the band each step takes away flashes, then stays as a faint layer
  for (let i = 1; i < RINGS.length; i++) {
    const r = RINGS[i], ag = t - r.t;
    if (ag < 0 || t > T.whip) continue;
    const fa = (0.30 * Math.exp(-ag * 3.2) + 0.05) * (1 - ss(seg(t, T.push0 + 0.4, T.push0 + 1.4)));
    if (fa < 0.004) continue;
    ctx.save(); ctx.globalAlpha = fa; ctx.drawImage(lostBand(cam, RINGS[i - 1].year, r.year), 0, 0); ctx.restore();
  }
  const fadeNorth = 1 - 0.85 * ss(seg(t, T.whip - 0.2, T.north));
  const back = ss(seg(t, T.pull + 0.8, T.pull + 2.4));
  const mDim = 1 - 0.72 * ss(seg(t, T.push0 + 0.3, T.push0 + 1.3)) * (1 - ss(seg(t, T.whip - 0.2, T.north)));   // at Muynak only the 1977 shore speaks
  const global = clamp(fadeNorth + back * 0.85) * mDim * (1 - ss(seg(t, T.end - 0.2, T.end + 0.6))) * (1 - ss(seg(Math.log(cam.alt), Math.log(900), Math.log(2200))));
  const printed = YEARS.filter(y => ringScan(y, t) !== null);
  const newest = printed[printed.length - 1];
  for (const y of printed) {
    const sl = ringScan(y, t);
    const age = t - (RINGS.find(r => r.year === y).t);
    const isNew = y === newest && t < T.y2025 + 0.9;
    const a = (isNew ? 1 : 0.78) * global;
    const flash = (age >= 0 ? Math.exp(-age * 5) : 0) + (y === 2025 && t > T.y2025 + 0.5 && t < T.push0 + 0.5 ? 0.35 * (0.5 + 0.5 * Math.sin((t - T.y2025) * Math.PI * 2 / (BEAT * 2))) : 0);
    hair(ctx, () => { for (const l of V.rings[y]) pathLL(ctx, cam, l, { keep: (lo, la) => la > sl }); },
      { w: isNew ? 2.6 + 2.0 * flash : 1.7, alpha: a, col: C.ink, halo: 3.4, haloCol: 'rgba(3,6,8,.62)' });
  }
  // the analyst traces the newest shore: a bright comet runs along its longest outline after it lands
  if (newest && t < T.push0 + 0.6) {
    const r = RINGS.find(r => r.year === newest), ag = t - r.t;
    const L = longest(newest);
    if (ag > 0.1 && L) {
      const u = ((ag - 0.1) / 1.6) % 1, n = L.length, i0 = Math.floor(u * n), len = Math.max(6, Math.floor(n * 0.07));
      const seg2 = []; for (let k = 0; k < len; k++) seg2.push(L[(i0 + k) % n]);
      const ca = 0.95 * Math.min(1, ag * 3) * (1 - ss(seg(t, T.push0, T.push0 + 0.6)));
      hair(ctx, () => pathLL(ctx, cam, seg2), { w: 4.2, alpha: ca * global, col: '#FFFFFF', halo: 6, haloCol: 'rgba(200,225,255,.25)', cap: 'round' });
    }
  }
  // transect across the eastern basin: ticks where each ring crosses it, year labels along it
  const ta = global * ss(seg(t, T.y1977 + 0.2, T.y1977 + 0.7)) * (1 - ss(seg(t, T.push0 + 0.3, T.push0 + 1.2)) * 0.9);
  if (ta > 0.01) {
    printed.forEach((y, i) => {
      const c = V.cross[y]; if (!c) return;
      const [x, yy] = project(cam, c[1], c[0]);
      const ag = t - (RINGS.find(r => r.year === y).t);
      const la = ta * ss(seg(ag, 0, 0.18));
      const up = i % 2 === 0, L = 30 + (i % 4 >= 2 ? 26 : 0);
      hair(ctx, () => { ctx.moveTo(x, yy); ctx.lineTo(x, yy + (up ? -L : L)); }, { w: 1.2, alpha: la * 0.85, halo: 2 });
      text(ctx, String(y), x, yy + (up ? -L - 8 : L + 24), { font: '500 24px PM', align: 'center', alpha: la * (y === newest ? 1 : 0.85), halo: 7, id: 'ring-' + y });
    });
  }
}

// ------------------------------------------------------------------ Muynak and the range line
let SHORE77 = null;
function shore77() {   // the 1977 shoreline within 40 km of the old port, as measured on the Landsat mosaic
  if (SHORE77) return SHORE77;
  const mu = V.points.muynak, k = 111.32 * Math.cos(45 * Math.PI / 180);
  const d = p => Math.hypot((p[0] - mu[0]) * k, (p[1] - mu[1]) * 110.57);
  let best = null;
  V.rings['1977'].forEach((L, i) => L.forEach((p, j) => { const v = d(p); if (!best || v < best.v) best = { v, i, j }; }));
  const L = V.rings['1977'][best.i];
  let a = best.j, b = best.j;
  while (a > 0 && d(L[a - 1]) < 40) a--;
  while (b < L.length - 1 && d(L[b + 1]) < 40) b++;
  const dense = [];   // resample so the line can be drawn on from the port outwards
  for (let q = a; q < b; q++) for (let s = 0; s < 6; s++) dense.push([lerp(L[q][0], L[q + 1][0], s / 6), lerp(L[q][1], L[q + 1][1], s / 6)]);
  dense.push(L[b]);
  const c = (best.j - a) * 6;
  let lab = dense[Math.min(dense.length - 1, c + 30)];          // the label sits on the shore north-east of the port
  for (let q = c; q < dense.length; q++) if (d(dense[q]) > 12) { lab = dense[q]; break; }
  SHORE77 = { pts: dense, c, lab };
  return SHORE77;
}
function drawPortLock(t, cam) {
  if (t < T.portLock - BEAT || t > T.arrive + 0.8) return;
  const mu = V.points.muynak;
  const [px, py] = project(cam, mu[1], mu[0]);
  const lockU = eo(seg(t, T.portLock - 0.5, T.portLock));
  const wander = [px + 150 * Math.cos(t * 4.1) * (1 - lockU), py - 90 * Math.sin(t * 3.3) * (1 - lockU)];
  const r = lerp(140, 62, lockU) + 10 * Math.exp(-Math.max(0, t - T.portLock) * 9) - 26 * ss(seg(t, T.arrive - 0.4, T.arrive + 0.2));
  const a = ss(seg(t, T.portLock - BEAT, T.portLock - BEAT + 0.2)) * (1 - ss(seg(t, T.arrive + 0.2, T.arrive + 0.8)));
  brackets(ctx, wander[0] - r, wander[1] - r, wander[0] + r, wander[1] + r, { len: 20, alpha: a, w: 2.2 });
  tick(ctx, wander[0], wander[1], 6, { alpha: a * lockU, w: 2 });
}
function drawShore77(t, cam) {
  if (t < T.shore77 - 0.1 || t > T.north + 0.4) return;
  const S = shore77();
  // the water of 1977 that is gone today, as a faint wash: the port sat at its edge
  const wa = 0.13 * ss(seg(t, T.shore77 + 0.2, T.shore77 + 0.8)) * (1 - ss(seg(t, T.whip, T.whip + 0.3)));
  if (wa > 0.003) { ctx.save(); ctx.globalAlpha = wa; ctx.drawImage(lostBand(cam, 1977, 2025), 0, 0); ctx.restore(); }
  const g = eo(seg(t, T.shore77, T.shore77 + 0.6));
  const a = 1 - ss(seg(t, T.whip, T.whip + 0.3));
  const n = S.pts.length, lo = Math.max(0, Math.floor(S.c - S.c * g)), hi = Math.min(n, Math.ceil(S.c + (n - S.c) * g));
  if (hi - lo >= 2) hair(ctx, () => pathLL(ctx, cam, S.pts.slice(lo, hi)), { w: 2.4, alpha: a, halo: 4, haloCol: 'rgba(3,6,8,.6)', dash: [10, 6] });
  const la = ss(seg(t, T.shore77 + 0.3, T.shore77 + 0.55)) * a;
  if (la > 0) {
    const [x, y] = project(cam, S.lab[1], S.lab[0]);
    hair(ctx, () => { ctx.moveTo(x, y); ctx.lineTo(x + 26, y - 30); ctx.lineTo(x + 46, y - 30); }, { w: 1.3, alpha: la });
    text(ctx, '1977 年岸线', x + 52, y - 21, { font: '500 28px SC', alpha: la, track: 1, id: 'shore77' });
  }
}
function drawMuynak(t, cam) {
  drawPortLock(t, cam);
  if (t < T.push0 || t > T.north + 0.4) return;
  const mu = V.points.muynak, ed = V.points.edge;
  const [mx, my] = project(cam, mu[1], mu[0]);
  // the analyst's focus while we push in and land: everything away from the port is dimmed
  const fa = 0.5 * ss(seg(t, T.push0, T.push0 + 0.6)) * (1 - ss(seg(t, T.range0, T.range0 + 0.6)));
  if (fa > 0.005) {
    const g = ctx.createRadialGradient(mx, my, 160, mx, my, 760);
    g.addColorStop(0, 'rgba(3,6,9,0)'); g.addColorStop(1, `rgba(3,6,9,${fa})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  drawShore77(t, cam);
  const [ex, ey] = project(cam, ed[1], ed[0]);
  // the analyst's focus: a corridor around the measurement stays lit, the rest of the sea floor is dimmed
  const va = 0.34 * ss(seg(t, T.range0, T.range0 + 0.5)) * (1 - ss(seg(t, T.whip - 0.1, T.whip + 0.3)));
  if (va > 0.005) {   // the corridor opens with the line: from the port to the tip
    const gg = eio(seg(t, T.range0, T.rangeEnd));
    const [ex, ey] = project(cam, lerp(mu[1], ed[1], gg), lerp(mu[0], ed[0], gg));
    const kmpx = cam.alt / cam.F, r = 26 / kmpx;               // 26 km either side of the line
    const dx = ex - mx, dy = ey - my, L = Math.hypot(dx, dy) || 1, nx = -dy / L * r, ny = dx / L * r;
    const ang = Math.atan2(dy, dx);
    ctx.save(); ctx.beginPath(); ctx.rect(-50, -50, W + 100, H + 100);
    ctx.moveTo(mx + nx, my + ny); ctx.lineTo(ex + nx, ey + ny);
    ctx.arc(ex, ey, r, ang + Math.PI / 2, ang - Math.PI / 2, true);
    ctx.lineTo(mx - nx, my - ny);
    ctx.arc(mx, my, r, ang - Math.PI / 2, ang + Math.PI / 2, true);
    ctx.closePath();
    ctx.filter = 'blur(40px)'; ctx.fillStyle = `rgba(3,6,9,${va})`; ctx.fill('evenodd'); ctx.restore();
  }
  const a = ss(seg(t, T.muynak - 0.05, T.muynak + 0.25)) * (1 - ss(seg(t, T.whip, T.whip + 0.3)));
  if (a <= 0) return;
  // port marker + label
  hair(ctx, () => { ctx.arc(mx, my, 11, 0, 6.2832); }, { w: 2, alpha: a, halo: 4 });
  tick(ctx, mx, my, 4, { alpha: a, w: 2 });
  hair(ctx, () => { ctx.moveTo(mx + 12, my + 9); ctx.lineTo(mx + 46, my + 40); ctx.lineTo(mx + 70, my + 40); }, { w: 1.4, alpha: a * 0.9 });
  text(ctx, '莫伊纳克', mx + 76, my + 52, { font: '500 42px SC', alpha: a, track: 2, id: 'muynak' });
  text(ctx, '旧渔港', mx + 79, my + 90, { font: '400 26px SC', alpha: a * 0.9, track: 2, id: 'muynak-port' });
  if (t < T.range0) return;
  // the range line grows from the old port; the camera chases its tip
  const g = eio(seg(t, T.range0, T.rangeEnd));
  const lon = lerp(mu[0], ed[0], g), lat = lerp(mu[1], ed[1], g);
  const [tx, ty] = project(cam, lat, lon);
  const la = ss(seg(t, T.range0, T.range0 + 0.15)) * (1 - ss(seg(t, T.whip, T.whip + 0.25)));
  hair(ctx, () => { ctx.moveTo(mx, my); ctx.lineTo(tx, ty); }, { w: 4, alpha: la, halo: 6, haloCol: 'rgba(3,6,8,.7)', cap: 'round' });
  // ticks every 10 km (long every 50 km), each with a small number
  const D = V.points.dist_km, n = Math.floor(D * g / 10);
  const dx = tx - mx, dy = ty - my, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  for (let i = 1; i <= n; i++) {
    const f = (i * 10) / D;
    const [x, y] = project(cam, lerp(mu[1], ed[1], f), lerp(mu[0], ed[0], f));
    const k = i % 5 === 0 ? 16 : 9;
    hair(ctx, () => { ctx.moveTo(x - nx * k, y - ny * k); ctx.lineTo(x + nx * k, y + ny * k); }, { w: 2, alpha: la, halo: 3 });
    if (i % 5 === 0) text(ctx, String(i * 10), x + nx * 30, y + ny * 30 + 8, { font: '500 22px PM', align: 'center', alpha: la * 0.9, halo: 6 });
  }
  // after the reading lands, a glint travels the line from the port to the sea, again and again
  if (t > T.rangeEnd) {
    for (let k = 0; k < 3; k++) {
      const u = ((t - T.rangeEnd) / 0.9 + k / 3) % 1;
      const [gx, gy] = project(cam, lerp(mu[1], ed[1], u), lerp(mu[0], ed[0], u));
      ctx.save(); ctx.globalAlpha = la * 0.9 * Math.sin(Math.PI * u);
      const gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, 20); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gr; ctx.fillRect(gx - 20, gy - 20, 40, 40); ctx.restore();
    }
  }
  // tip reticle with the distance rolling beside it
  const pop = 1 + 0.25 * Math.exp(-Math.max(0, t - T.rangeEnd) * 8) * (t >= T.rangeEnd ? 1 : 0);
  const rr = 18 * pop;
  brackets(ctx, tx - rr, ty - rr, tx + rr, ty + rr, { len: 8, w: 2, alpha: la });
  const km = Math.round(D * g), tipA = la * (1 - ss(seg(t, T.rangeEnd + 0.6, T.rangeEnd + 1.2)));
  text(ctx, km + ' km', tx - 28, ty + 54, { font: '500 44px BC', align: 'right', alpha: tipA, halo: 10, col: C.ink, id: 'tip-km', rep: V.points.dist_txt + ' km' });
  // the destination is marked first, then the line reaches it
  const ea = ss(seg(t, T.rangeEnd - 2 * BEAT, T.rangeEnd - 2 * BEAT + 0.25)) * (1 - ss(seg(t, T.whip, T.whip + 0.25)));
  if (ea > 0) {
    const land = ss(seg(t, T.rangeEnd - 0.1, T.rangeEnd + 0.25));
    hair(ctx, () => { ctx.arc(ex, ey, 10 + 28 * (1 - land), 0, 6.2832); }, { w: 2, alpha: ea, halo: 4 });
    text(ctx, '今天的海边', ex - 24, ey - 34, { font: '500 34px SC', alpha: ea, align: 'right', track: 2, id: 'edge' });
  }
}

// ------------------------------------------------------------------ north: the dam and the rings that grow back
function drawNorth(t, cam) {
  if (t < T.north - 0.1) return;
  const out = 1 - ss(seg(t, T.end - 0.3, T.end + 0.4));
  const g = ss(seg(t, T.north + 0.05, T.dam));
  // dense polyline along the dike so it can be drawn on progressively
  const pts = []; for (let i = 0; i < G.dam.length - 1; i++) for (let k = 0; k < 20; k++) { const u = k / 20; pts.push([lerp(G.dam[i][0], G.dam[i + 1][0], u), lerp(G.dam[i][1], G.dam[i + 1][1], u)]); }
  pts.push(G.dam[G.dam.length - 1]);
  const da = out * (1 - 0.4 * ss(seg(t, T.pull + 0.5, T.pull + 2)));
  hair(ctx, () => pathLL(ctx, cam, pts, { frac: g }), { w: 3.0, alpha: da, cap: 'round' });
  const la = ss(seg(t, T.dam - 0.1, T.dam + 0.3)) * out * (1 - ss(seg(t, T.pull + 0.6, T.pull + 1.4)));
  if (la > 0) {
    let [x, y] = project(cam, G.dam[2][1], (G.dam[1][0] + G.dam[2][0]) / 2);
    x = clamp(x, 80, W - 640); y = clamp(y, 140, H - 300);   // the label stays in frame while the camera pushes in
    hair(ctx, () => { ctx.moveTo(x, y + 6); ctx.lineTo(x + 30, y + 64); ctx.lineTo(x + 60, y + 64); }, { w: 1.1, alpha: la });
    text(ctx, '科卡拉尔大坝', x + 66, y + 78, { font: '500 42px SC', alpha: la, track: 2, id: 'dam' });
    text(ctx, '2005 年建成 · 长 13 km', x + 68, y + 118, { font: '400 26px SC', alpha: la * 0.9, track: 1, id: 'dam-note' });
  }
  // rings 2001 (inner) -> 2009 (outer)
  const ra = out * (1 - 0.5 * ss(seg(t, T.pull + 0.6, T.pull + 2)));
  const s01 = ss(seg(t, T.n2001 - 0.3, T.n2001 + 0.2));
  if (s01 > 0 && V.north['2001']) hair(ctx, () => { for (const l of V.north['2001']) pathLL(ctx, cam, l); }, { w: t < T.n2009 ? 1.8 : 1.15, alpha: ra * s01 * (t < T.n2009 ? 1 : 0.62), halo: 2.6 });
  if (t >= T.n2009 && V.north['2009']) {      // the new shore is stamped when the water reaches it
    const fl = Math.exp(-Math.max(0, t - T.n2009) * 5);
    hair(ctx, () => { for (const l of V.north['2009']) pathLL(ctx, cam, l); }, { w: 1.8 + 1.6 * fl, alpha: ra * ss(seg(t, T.n2009, T.n2009 + 0.08)), halo: 2.6 });
    // and a light runs along it while the narrator speaks
    const L = (V.north['2009'] || []).reduce((m, l) => (l.length > (m ? m.length : 0) ? l : m), null);
    const ag = t - T.n2009;
    if (L && ag > 0.15 && t < T.pull + 0.6) {
      const u = ((ag - 0.15) / 1.8) % 1, n = L.length, i0 = Math.floor(u * n), len = Math.max(6, Math.floor(n * 0.06));
      const seg2 = []; for (let k = 0; k < len; k++) seg2.push(L[(i0 + k) % n]);
      hair(ctx, () => pathLL(ctx, cam, seg2), { w: 4.2, alpha: ra * 0.9 * Math.min(1, ag * 3) * (1 - ss(seg(t, T.pull, T.pull + 0.6))), col: '#FFFFFF', halo: 6, haloCol: 'rgba(200,225,255,.25)', cap: 'round' });
    }
  }
  for (const [y, k] of [[2001, 'n01'], [2009, 'n09']]) {
    const c = V.ncross && V.ncross[y]; if (!c) continue;
    const at = y === 2001 ? T.n2001 : T.n2009;
    const a2 = ss(seg(t, at, at + 0.2)) * out * (1 - ss(seg(t, T.pull + 0.4, T.pull + 1.2)));
    const [x, yy] = project(cam, c[1], c[0]);
    tick(ctx, x, yy, 5, { alpha: a2 });
    text(ctx, String(y), x + 9, yy - 12, { font: '500 24px PM', alpha: a2, halo: 7, id: 'nring-' + y });
  }
}

// ------------------------------------------------------------------ the label moves to the only sea left
function drawRelabel(t, cam) {
  const a = ss(seg(t, T.relabel - 0.5, T.relabel - 0.2)) * (1 - ss(seg(t, T.end - 0.3, T.end + 0.1)));
  if (a <= 0) return;
  const u = eio(seg(t, T.relabel - 0.2, T.relabel + BEAT));
  const from = [59.75, 45.15], to = G.north;
  const [x, y, vis] = project(cam, lerp(from[1], to[1], u), lerp(from[0], to[0], u));
  if (!vis) return;
  const pin = Math.exp(-Math.max(0, t - T.relabel - BEAT) * 6) * (t > T.relabel + BEAT ? 1 : 0);
  text(ctx, '咸 海', x, y, { font: `600 ${Math.round(54 + 10 * pin)}px SS`, col: C.mapInk, align: 'center', track: 6, alpha: a, halo: 10, id: 'map-name-2' });
}

// ------------------------------------------------------------------ instruments: lock, altitude, scale, credit
function drawHud(t, cam) {
  const hudA = 1 - ss(seg(t, T.end - 0.2, T.end + 0.3));
  // lock brackets (opening): search, then lock on the sea
  if (t < T.dive0 + 2.3) {
    const [ax, ay, vis] = project(cam, 45.15, 59.75);
    const lockU = eo(seg(t, T.lock - 0.25, T.lock));
    const wander = [ax + 210 * Math.cos(t * 3.1) * (1 - lockU), ay - 120 * Math.sin(t * 2.3) * (1 - lockU)];
    const r = lerp(150, 84, lockU) + 10 * Math.exp(-Math.max(0, t - T.lock) * 9);
    const a = ss(seg(t, 0, 0.15)) * (1 - ss(seg(t, T.dive0 + 1.95, T.dive0 + 2.3)));
    if (vis) {
      brackets(ctx, wander[0] - r, wander[1] - r, wander[0] + r, wander[1] + r, { len: 24, alpha: a, w: 2 });
      tick(ctx, wander[0], wander[1], 7, { alpha: a * lockU });
      const ca = a * ss(seg(t, T.lock, T.lock + 0.2));
      text(ctx, '北纬 45°  东经 60°', wander[0] - r, wander[1] - r - 14, { font: '400 24px SC', alpha: ca * 0.92, halo: 6, id: 'coords' });
    }
  }
  // altitude
  const altTxt = cam.alt > 100 ? fmt(Math.round(cam.alt / 10) * 10) : fmt(cam.alt);
  const aa = hudA * ss(seg(t, 0.1, 0.4));
  text(ctx, '高度', W - 236, 60, { font: '400 22px SC', alpha: aa * 0.8, halo: 5, id: 'alt-label' });
  text(ctx, altTxt + ' km', W - 56, 60, { font: '400 22px PM', alpha: aa * 0.88, align: 'right', halo: 5 });
  // scale bar (bottom right), when looking straight down
  const sa = hudA * ss(seg(t, T.dive0 + 2.4, T.touch)) * (1 - ss(seg(t, T.pull + 2.4, T.pull + 3.2)));
  if (sa > 0) {
    const kmpx = cam.alt / cam.F;
    const nice = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500];
    let km = nice[0]; for (const n of nice) if (n / kmpx <= 240) km = n;
    const L = km / kmpx, x1 = W - 56, x0 = x1 - L, y = 1000;
    hair(ctx, () => { ctx.moveTo(x0, y - 6); ctx.lineTo(x0, y); ctx.lineTo(x1, y); ctx.lineTo(x1, y - 6); }, { w: 1.2, alpha: sa * 0.8, halo: 2 });
    text(ctx, km + ' km', x1, y - 12, { font: '400 20px PM', align: 'right', alpha: sa * 0.8, halo: 5 });
  }
  // imagery credit (always legible: 17 px)
  text(ctx, '影像 Landsat · USGS/NASA  Blue Marble · NASA', W - 56, 1048, { font: '400 20px PM', align: 'right', alpha: 0.78 * ss(seg(t, 0, 0.3)), halo: 5, track: 0.2, id: 'credit' });
}

// ------------------------------------------------------------------ readouts: one per screen
function drawReadouts(t, cam) {
  // rewind: the year runs backwards
  if (t >= T.rewind - 0.05 && t < T.y1977) {
    let y = 2025;
    for (const r of REWIND) if (t >= (r.t0 + r.t1) / 2) y = r.to;
    const a = ss(seg(t, T.rewind - 0.05, T.rewind + 0.1));
    text(ctx, String(y), 1380, 520, { font: '300 112px BC', alpha: a, halo: 12, col: C.ink });
  }
  // rings: share of the 1960 sea still under water, measured on each Landsat mosaic
  if (t >= T.y1977 - 0.05 && t < T.push0 + 1.0) {
    const a = ss(seg(t, T.y1977 - 0.05, T.y1977 + 0.15)) * (1 - ss(seg(t, T.push0 + 0.2, T.push0 + 1.0)));
    // while a year is being scanned in, its year shows and the value rolls dimmed; it lands bright with the stamp
    let pct = areaPct(1977), yr = 1977, rolling = false;
    for (let i = 1; i < RINGS.length; i++) {
      const r = RINGS[i];
      if (t >= r.t - r.sweep) { const u = eo(seg(t, r.t - r.sweep, r.t)); pct = lerp(areaPct(RINGS[i - 1].year), areaPct(r.year), u); yr = r.year; rolling = t < r.t; }
    }
    const val = Math.round(pct) + '%';
    text(ctx, String(yr), 1382, 398, { font: '400 34px PM', alpha: a * (rolling ? 0.55 : 0.92), halo: 6 });
    readout(ctx, 1380, 540, { label: '还在水下的部分', value: val, alpha: a, id: 'rings', note: '地图上的海 = 100% · Landsat 测算', rep: Math.round(areaPct(2025)) + '%', dim: rolling ? 0.38 : 1 });
  }
  // Muynak distance
  if (t >= T.range0 - 0.1 && t < T.whip + 0.2) {   // the reading counts up with the line and lands with it
    const a = ss(seg(t, T.range0 - 0.1, T.range0 + 0.15)) * (1 - ss(seg(t, T.whip - 0.05, T.whip + 0.2)));
    const g = eio(seg(t, T.range0, T.rangeEnd));
    const val = t >= T.rangeEnd ? V.points.dist_txt : String(Math.round(V.points.dist_km * g));
    const pop = Math.exp(-Math.max(0, t - T.rangeEnd) * 7) * (t >= T.rangeEnd ? 1 : 0);
    readout(ctx, 1380, 330, { label: '旧港口到今天的海边', value: val, unit: 'km', alpha: a, id: 'dist', note: '2025 年 Landsat 影像实测', rep: V.points.dist_txt, size: Math.round(112 * (1 + 0.08 * pop)) });
  }
  // north: area back
  if (t >= T.n2009 - 0.02 && t < T.pull + 1.6) {
    const a = ss(seg(t, T.n2009 - 0.02, T.n2009 + 0.2)) * (1 - ss(seg(t, T.pull + 1.0, T.pull + 1.6)));
    readout(ctx, 1380, 560, { label: '北咸海水面', value: '+37%', alpha: a, id: 'north', note: '2001→2009 · 世界银行' });
  }
}

function drawSubs(t) {
  for (const c of CUES) {
    if (t < c.t0 || t > c.t1) continue;
    const a = ss(seg(t, c.t0, c.t0 + 0.12)) * (1 - ss(seg(t, c.t1 - 0.12, c.t1)));
    subtitle(ctx, c.zh, c.en, a, c.id);
  }
}

// ------------------------------------------------------------------ end card: the lock brackets open into the frame
function drawEnd(t, cam) {
  if (t < T.end - 0.1) return;
  const u = eo(seg(t, T.end, T.end + 0.7));
  const [ax, ay] = project(cam, 46.48, 60.72);
  const br = 14 * seg(t, T.end + 0.7, T.dur);
  const X0 = lerp(ax - 40, 150, u) - br, Y0 = lerp(ay - 40, 330, u) - br, X1 = lerp(ax + 40, 1010, u) + br, Y1 = lerp(ay + 40, 760, u) + br;
  brackets(ctx, X0, Y0, X1, Y1, { len: 30, alpha: ss(seg(t, T.end - 0.1, T.end + 0.1)) });
  // one last satellite pass: a soft band of light sweeps down the frame behind the card
  const pu = seg(t, T.end + 0.9, T.dur - 0.2);
  if (pu > 0 && pu < 1) {
    const yb = lerp(-120, H + 120, ss(pu));
    const g = ctx.createLinearGradient(0, yb - 120, 0, yb + 6);
    g.addColorStop(0, 'rgba(220,235,255,0)'); g.addColorStop(0.92, 'rgba(220,235,255,.10)'); g.addColorStop(1, 'rgba(240,248,255,.32)');
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = g; ctx.fillRect(0, yb - 120, W, 126); ctx.restore();
  }
  const a1 = ss(seg(t, T.end + 0.12, T.end + 0.32)), a2 = ss(seg(t, T.end + 0.2, T.end + 0.4)), a3 = ss(seg(t, T.end + 0.28, T.end + 0.48));
  text(ctx, '地图上还写着海', 210, 470, { font: '600 84px SS', col: C.mapInk, track: 8, alpha: a1, halo: 14, id: 'title' });
  text(ctx, 'The Map Still Says Sea', 214, 532, { font: '400 36px BC', track: 2, alpha: a2, halo: 8, id: 'title-en' });
  hair(ctx, () => { ctx.moveTo(214, 572); ctx.lineTo(214 + 600 * a2, 572); }, { w: 1, alpha: a2 * 0.6, halo: 0 });
  const sw = text(ctx, 'SATELLITE BRIEFING', 214, 628, { font: '500 24px PM', track: 3, alpha: a3, halo: 6, id: 'style' });
  text(ctx, '·  卫星简报', 214 + sw + 14, 628, { font: '500 24px SC', track: 3, alpha: a3, halo: 6, id: 'style-cn' });
  text(ctx, 'LemoLab × Claude Opus 5.5', 214, 676, { font: '400 22px PM', track: 2, alpha: a3 * 0.85, halo: 6, id: 'sign' });
}

// ------------------------------------------------------------------ sound and cue events (exported by events.mjs)
function events() {
  const E = [];
  const ev = (t, type, o = {}) => E.push({ t: +t.toFixed(4), type, ...o });
  ev(0, 'orbit_bed'); ev(0.12, 'servo'); ev(T.lock, 'lock'); ev(T.lock + 0.15, 'coords');
  ev(T.mapOn, 'map_on'); ev(T.dive0, 'dive', { to: T.touch }); ev(T.grey0, 'drain_colour');
  ev(T.touch, 'touch'); ev(T.touch + 0.02, 'map_drain'); ev(T.touch, 'silence', { to: T.rewind });
  ev(T.rewind, 'rewind', { to: T.y1977 });
  for (const r of REWIND) ev(r.t0, 'scan_up', { dur: r.t1 - r.t0 });
  ev(T.y1977, 'ring', { year: 1977, i: 0 });
  RINGS.slice(1).forEach((r, i) => { ev(r.t - r.sweep, 'scan_down', { dur: r.sweep }); ev(r.t, 'ring', { year: r.year, i: i + 1 }); });
  ev(T.y2025, 'stop');
  ev(T.portLock - BEAT, 'servo'); ev(T.portLock, 'lock2');
  ev(T.push0, 'push', { to: T.arrive }); ev(T.horn, 'horn'); ev(T.muynak, 'label'); ev(T.shore77, 'shore', { dur: 0.6 });
  ev(T.range0, 'range', { to: T.rangeEnd, km: V.points.dist_km }); ev(T.rangeEnd - 2 * BEAT, 'mark'); ev(T.rangeEnd, 'range_end');
  ev(T.sil2, 'silence', { to: T.water }); ev(T.water, 'water_in');
  ev(T.whip, 'whip', { to: T.north }); ev(T.north, 'dam_draw', { to: T.dam }); ev(T.dam, 'dam');
  ev(T.n2001, 'nring', { year: 2001 }); ev(T.n2009 - 0.55, 'scan_down', { dur: 0.55 }); ev(T.n2009, 'nring', { year: 2009 });
  ev(T.pull, 'pull', { to: T.end }); ev(T.relabel - 0.2, 'slide'); ev(T.relabel + BEAT, 'pin');
  ev(T.end, 'end'); ev(T.end + 0.6, 'lock_echo'); ev(T.end + 0.9, 'pass', { to: T.dur - 0.2 });
  for (const L of VO) ev(L.t, 'vo', { id: L.id });
  return E;
}

window.DUR = T.dur;
window.render = t => { render(t); };
window.TEXTS = t => render(t);
init().catch(e => { console.error(e); throw e; });
