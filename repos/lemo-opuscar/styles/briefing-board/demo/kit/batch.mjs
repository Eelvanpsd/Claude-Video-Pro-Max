// Batch renderer: every scene JSON → PNG, in one browser.
//   node kit/batch.mjs scenes/stills/*.json [--out stills/] [--t 12.5]
// Each scene may set "size": [w, h] (default 1920×1080), "t" (time to render; default: everything
// revealed) and "out" (file name, default <scene name>.png). A still usually "extends" the film's
// world (scenes/film.json) and sets only its own camera, so one world feeds the film, the stills,
// thumbnails and social cards. Run from anywhere; LIB (the library root) is found from this file.
import path from 'path'; import fs from 'fs'; import { fileURLToPath } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), DEMO = path.resolve(HERE, '..');
const LIB = process.env.LIB || path.resolve(DEMO, '../../..');
const { openDemo, closeServer } = await import(path.join(LIB, 'core/render/page.mjs'));
const args = process.argv.slice(2);
const take = k => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : null; };
const outDir = path.resolve(DEMO, take('--out') || 'stills'), tOver = take('--t');
const scenes = args.map(a => path.resolve(process.cwd(), a));
if (!scenes.length) { console.error('usage: node kit/batch.mjs <scene.json> … [--out dir] [--t sec]'); process.exit(2); }
fs.mkdirSync(outDir, { recursive: true });
const { browser, page } = await openDemo(DEMO, { w: 1920, h: 1080 });
for (const f of scenes) {
  const rel = path.relative(DEMO, f).split(path.sep).join('/');
  const spec = JSON.parse(fs.readFileSync(f, 'utf8'));
  const [w, h] = spec.size || [1920, 1080];
  await page.setViewportSize({ width: w, height: h });
  const info = await page.evaluate(u => window.loadScene(u), rel);
  const t = tOver != null ? +tOver : info.t;
  await page.evaluate(t => window.render(t), t);
  const out = path.join(outDir, spec.out || path.basename(f, '.json') + '.png');
  await page.screenshot({ path: out, type: out.endsWith('.jpg') ? 'jpeg' : 'png', ...(out.endsWith('.jpg') ? { quality: 92 } : {}) });
  console.log(out, `${w}x${h}`, 't=' + t);
}
await browser.close(); closeServer();
