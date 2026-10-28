// 字幕单行检查：在页面里用真实字体量宽（中文 Noto Sans SC 500 36px，英文 Inter 400 27px，nowrap），每行都必须窄于安全宽度
// usage（库根目录）：node <demo>/tools/subcheck.mjs <demo>     有任何一行过宽就 exit 1
import path from 'path';
const LIB = process.env.LIB || path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../..');
const { openDemo, closeServer } = await import(path.join(LIB, 'core/render/page.mjs'));
const dir = path.resolve(process.argv[2] || '.');
const { browser, page } = await openDemo(dir);
const r = await page.evaluate(() => window.SUBCHECK);
await browser.close(); closeServer();
console.log(`safe width ${r.safe}px (Chinese: Noto Sans SC 500 36px, English: Inter 400 27px, both one line, nowrap)`);
for (const c of r.cues) console.log(`${c.ok ? 'OK  ' : 'WIDE'} ${c.id.padEnd(4)} zh ${String(c.wz).padStart(4)}px  en ${String(c.we).padStart(4)}px   ${c.zh} | ${c.en}`);
console.log(r.ok ? 'all subtitle lines fit on one line' : 'some lines are too wide');
process.exit(r.ok ? 0 : 1);
