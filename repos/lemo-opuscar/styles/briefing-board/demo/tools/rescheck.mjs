// Resolution check: for every frame (24 fps), every photo in frame must have at least one real photo
// pixel per screen pixel (ratio ≥ 1). A stretched span counts its stretch. Writes out/rescheck.csv.
//   node tools/rescheck.mjs [--fps 24]
import path from 'path'; import fs from 'fs'; import { fileURLToPath } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), DEMO = path.resolve(HERE, '..');
const LIB = process.env.LIB || path.resolve(DEMO, '../../..');
const { openDemo, closeServer } = await import(path.join(LIB, 'core/render/page.mjs'));
const args = process.argv.slice(2), FPS = +(args[args.indexOf('--fps') + 1] || 24) || 24;
const { browser, page } = await openDemo(DEMO, { w: 1920, h: 1080 });
const rows = await page.evaluate(({ FPS }) => { const r = []; for (let f = 0; f <= window.DUR * FPS; f++) { const t = f / FPS; for (const q of window.RESCHECK(t)) r.push({ t, ...q }); } return r; }, { FPS });
await browser.close(); closeServer();
const worst = {}; for (const r of rows) if (!worst[r.id] || r.ratio < worst[r.id].ratio) worst[r.id] = r;
fs.mkdirSync(path.join(DEMO, 'out'), { recursive: true });
fs.writeFileSync(path.join(DEMO, 'out/rescheck.csv'), 't,id,ratio,note\n' + rows.map(r => `${r.t.toFixed(3)},${r.id},${r.ratio.toFixed(3)},${r.note}`).join('\n'));
let bad = 0;
for (const [id, r] of Object.entries(worst).sort()) { const ok = r.ratio >= 1; bad += !ok; console.log(`${ok ? 'OK ' : 'BAD'} ${id.padEnd(14)} min ${r.ratio.toFixed(2)} photo px per screen px at ${r.t.toFixed(2)} s ${r.note}`); }
console.log(bad ? `rescheck: ${bad} photos upsampled` : `rescheck: OK (${Object.keys(worst).length} photos, every frame ≥ 1 photo px per screen px)`);
process.exit(bad ? 1 : 0);
