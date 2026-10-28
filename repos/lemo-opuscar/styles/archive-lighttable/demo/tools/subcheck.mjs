// Subtitle single-line check, measured in the page with the real fonts (Noto Sans SC 500 36 px for the Chinese
// line, IBM Plex Sans 400 27 px for the English line; the page draws them with fillText, which never wraps).
// Every line must fit the safe width, and no cue may contain a line break inside a language.
// usage (from the library root): node <demo>/tools/subcheck.mjs <demo>     exit 1 if any line is too wide
import path from 'path';
const LIB = process.env.LIB || path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../..');
const { openDemo, closeServer } = await import(path.join(LIB, 'core/render/page.mjs'));
const dir = path.resolve(process.argv[2] || '.');
const SAFE = 1500;
const { browser, page } = await openDemo(dir);
const r = await page.evaluate((SAFE) => {
  const c = document.createElement('canvas').getContext('2d');
  const cues = window.SUBCHECK_CUES || [];
  const rows = cues.map(q => {
    c.font = '500 36px SC'; const wz = Math.round(c.measureText(q.zh).width);
    c.font = '400 27px PS'; const we = Math.round(c.measureText(q.en).width);
    const ok = wz <= SAFE && we <= SAFE && !/\n/.test(q.zh) && !/\n/.test(q.en);
    return { id: q.id, zh: q.zh, en: q.en, wz, we, ok };
  });
  return { n: rows.length, rows, ok: rows.length > 0 && rows.every(x => x.ok) };
}, SAFE);
await browser.close(); closeServer();
console.log(`safe width ${SAFE}px · ${r.n} cues (Chinese: Noto Sans SC 500 36px, English: IBM Plex Sans 400 27px, one line each)`);
for (const c of r.rows) console.log(`${c.ok ? 'OK  ' : 'WIDE'} ${c.id.padEnd(4)} zh ${String(c.wz).padStart(4)}px  en ${String(c.we).padStart(4)}px   ${c.zh} | ${c.en}`);
console.log(r.ok ? 'all subtitle lines fit on one line' : 'some lines are too wide (or no cues loaded)');
process.exit(r.ok ? 0 : 1);
