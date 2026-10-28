// Subtitle single-line check, measured in the page with the real fonts (Noto Sans SC 500 34 px for the Chinese
// line, Barlow Condensed 400 30 px for the English line, nowrap): every line must fit the safe width on one line.
// usage (from the library root): node <demo>/tools/subcheck.mjs <demo>     exit 1 if any line is too wide
import path from 'path';
const LIB = process.env.LIB || path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../..');
const { openDemo, closeServer } = await import(path.join(LIB, 'core/render/page.mjs'));
const dir = path.resolve(process.argv[2] || '.');
const { browser, page } = await openDemo(dir);
const r = await page.evaluate(() => window.SUBCHECK);
await browser.close(); closeServer();
console.log(`safe width ${r.safe}px (zh: Noto Sans SC 500 34px, en: Barlow Condensed 400 30px, both one line)`);
for (const c of r.cues) console.log(`${c.ok ? 'OK  ' : 'WIDE'} ${c.id.padEnd(3)} zh ${String(c.wz).padStart(4)}px  en ${String(c.we).padStart(4)}px   ${c.zh} | ${c.en}`);
console.log(r.ok ? 'all subtitle lines fit on one line' : 'some lines are too wide');
process.exit(r.ok ? 0 : 1);
