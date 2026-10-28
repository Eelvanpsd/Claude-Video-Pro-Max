// Subtitle check: one line per language, measured with the real fonts in the page.
//   node tools/subcheck.mjs [path/to/film.srt]
// 1. In the page (window.SUBCHECK): the Chinese and the English line of every cue are measured with
//    the burned-in fonts (white-space: nowrap; nothing ever wraps) and must be narrower than the safe width.
// 2. In the .srt: every cue has exactly two lines, Chinese first, English second, and no line wraps.
// 3. Timing (DIRECTOR.md §7): every cue ≥ 1.8 s, and ≥ its spoken part + 0.6 s (from scenes/film.json).
import path from 'path'; import fs from 'fs'; import { fileURLToPath } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), DEMO = path.resolve(HERE, '..');
const LIB = process.env.LIB || path.resolve(DEMO, '../../..');
const { openDemo, closeServer } = await import(path.join(LIB, 'core/render/page.mjs'));
const { browser, page } = await openDemo(DEMO, { w: 1920, h: 1080 });
const rows = await page.evaluate(() => window.SUBCHECK());
await browser.close(); closeServer();
let bad = 0;
for (const r of rows) {
  const ok = r.ok; if (!ok) bad++;
  console.log(`${ok ? 'OK ' : 'BAD'} #${String(r.i + 1).padStart(2)}  zh ${String(r.wz).padStart(4)} px  en ${String(r.we).padStart(4)} px  (safe ${r.safe})  ${r.zh} | ${r.en}`);
}
const scene = JSON.parse(fs.readFileSync(path.join(DEMO, 'scenes/film.json'), 'utf8'));
for (const [i, s] of (scene.subs || []).entries()) {
  const d = s.t1 - s.t0, need = Math.max(1.8, (s.speech || 0) + .6);
  if (d + 1e-6 < need) { bad++; console.log(`BAD #${i + 1} on screen ${d.toFixed(2)} s, needs ${need.toFixed(2)} s`); }
}
const srt = process.argv[2] || path.join(DEMO, 'out/film.srt');
if (fs.existsSync(srt)) {
  const blocks = fs.readFileSync(srt, 'utf8').trim().split(/\r?\n\r?\n/);
  for (const b of blocks) {
    const L = b.split(/\r?\n/), text = L.slice(2);
    const han = s => /\p{Script=Han}/u.test(s);
    if (text.length !== 2 || !han(text[0]) || han(text[1])) { bad++; console.log(`BAD srt cue ${L[0]}: expected 2 lines (Chinese, then English), got ${JSON.stringify(text)}`); }
  }
  console.log(`srt: ${blocks.length} cues checked (${srt})`);
} else console.log(`srt not found yet: ${srt}`);
console.log(bad ? `subcheck: ${bad} problems` : `subcheck: OK (${rows.length} cues, each language on one line)`);
process.exit(bad ? 1 : 0);
