// 用 KiCad 数据画电路板贴图：阻焊、铜皮、走线、焊盘、过孔、钻孔、丝印
// 输出 color / ORM（G=粗糙度 B=金属度）/ bump 三张画布，坐标 = PCB 毫米 × PPM
import * as THREE from 'three';

export function paintPCB(D, side, outline, box, PPM = 14) {
  const [x0, y0, x1, y1] = box, W = Math.ceil((x1 - x0) * PPM), H = Math.ceil((y1 - y0) * PPM);
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return [c, c.getContext('2d')]; };
  const [cc, c] = mk(), [rc, r] = mk(), [bc, b] = mk();
  const T = ctx => { ctx.setTransform(PPM, 0, 0, PPM, -x0 * PPM, -y0 * PPM); };
  for (const ctx of [c, r, b]) { T(ctx); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; }
  const MASK = '#0a3123', CU = '#134a35', GOLD = '#c8a456', SILK = '#e9e7df', HOLE = '#060606';
  const fillAll = (col, rr, bb) => { c.fillStyle = col; c.fillRect(x0, y0, x1 - x0, y1 - y0); r.fillStyle = rr; r.fillRect(x0, y0, x1 - x0, y1 - y0); b.fillStyle = bb; b.fillRect(x0, y0, x1 - x0, y1 - y0); };
  fillAll(MASK, 'rgb(0,150,0)', '#4d4d4d');
  // 板外轮廓裁切
  for (const ctx of [c, r, b]) { ctx.save(); ctx.beginPath(); outline.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.clip(); }
  // 铜皮 + 走线（在阻焊下面：颜色更亮、微凸）
  const poly = (ctx, pts) => { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); };
  for (const z of D.zones[side]) {
    poly(c, z); c.fillStyle = CU; c.fill();
    poly(b, z); b.fillStyle = '#707070'; b.fill();
  }
  for (const [ax, ay, bx, by, w] of D.tracks[side]) {
    for (const [ctx, col] of [[c, CU], [b, '#808080']]) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); }
  }
  // 丝印
  for (const s of D.silk[side]) {
    for (const [ctx, col] of [[c, SILK], [r, 'rgb(0,200,0)'], [b, '#b0b0b0']]) {
      ctx.strokeStyle = ctx.fillStyle = col; ctx.lineWidth = s.w; poly(ctx, s.pts); if (s.fill) ctx.fill(); else { ctx.beginPath(); s.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); }
    }
  }
  // 过孔（盖油：只见小环）
  for (const [x, y, d, dr] of D.vias) {
    c.fillStyle = '#1e6448'; c.beginPath(); c.arc(x, y, d / 2, 0, 7); c.fill();
    c.fillStyle = '#0a2219'; c.beginPath(); c.arc(x, y, dr / 2, 0, 7); c.fill();
    b.fillStyle = '#909090'; b.beginPath(); b.arc(x, y, d / 2, 0, 7); b.fill();
  }
  // 焊盘（露铜镀金）
  const padPath = (ctx, p) => {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(-p.rot * Math.PI / 180); ctx.beginPath();
    const w = p.w, h = p.h;
    if (p.shape === 'circle') ctx.arc(0, 0, w / 2, 0, 7);
    else if (p.shape === 'oval') { const rr = Math.min(w, h) / 2; ctx.roundRect(-w / 2, -h / 2, w, h, rr); }
    else if (p.shape === 'roundrect') ctx.roundRect(-w / 2, -h / 2, w, h, Math.min(w, h) * .25);
    else ctx.rect(-w / 2, -h / 2, w, h);
    ctx.restore();
  };
  for (const p of D.pads) {
    const onSide = p.lay === 'both' || p.lay === side;
    if (onSide && p.type !== 'np_thru_hole') {
      padPath(c, p); c.fillStyle = GOLD; c.fill();
      padPath(r, p); r.fillStyle = 'rgb(0,70,255)'; r.fill();
      padPath(b, p); b.fillStyle = '#c0c0c0'; b.fill();
    }
    if (p.drill > 0) {
      for (const [ctx, col] of [[c, HOLE], [r, 'rgb(0,255,0)'], [b, '#000']]) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(p.x, p.y, p.drill / 2, 0, 7); ctx.fill(); }
    }
  }
  // 板上安装孔（Ø5，铜柱从这里穿过）
  for (const h of D.pcb_holes) for (const [ctx, col] of [[c, HOLE], [r, 'rgb(0,255,0)'], [b, '#000']]) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(h.c[0], h.c[1], h.r, 0, 7); ctx.fill(); }
  for (const ctx of [c, r, b]) ctx.restore();
  const tex = (cv, srgb) => {
    const t = new THREE.CanvasTexture(cv); t.anisotropy = 8; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    // shape UV = (x, -y)；u = (x - x0)/W, v = (y1 - y)/H
    t.repeat.set(1 / (x1 - x0), 1 / (y1 - y0)); t.offset.set(-x0 / (x1 - x0), y1 / (y1 - y0));
    t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t;
  };
  return { map: tex(cc, true), orm: tex(rc, false), bump: tex(bc, false) };
}
