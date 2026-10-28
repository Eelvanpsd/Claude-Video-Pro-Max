// Subtitle single-line check, measured in the page with the real fonts (Noto Sans SC 38 px for the Chinese line,
// Barlow Condensed 33 px for the English line, nowrap): every line must be narrower than the safe width.
// usage (from the library root): node <demo>/tools/subcheck.mjs <demo>     exit 1 if any line is too wide
import path from 'path';
const LIB = process.env.LIB || path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../..');
const { openDemo, closeServer } = await import(path.join(LIB, 'core/render/page.mjs'));
const dir = path.resolve(process.argv[2] || '.');
const { browser, page } = await openDemo(dir);
const r = await page.evaluate(() => window.SUBCHECK);
await browser.close(); closeServer();
console.log(`safe width ${r.safe}px (Chinese line: Noto Sans SC 500 38px, English line: Barlow Condensed 400 33px, both nowrap)`);
for (const c of r.cues) console.log(`${c.ok ? 'OK  ' : 'WIDE'} ${c.id.padEnd(4)} zh ${String(c.wz).padStart(4)}px  en ${String(c.we).padStart(4)}px   ${c.zh} | ${c.en}`);
console.log(r.ok ? 'all subtitle lines fit on one line' : 'some lines are too wide');
process.exit(r.ok ? 0 : 1);
