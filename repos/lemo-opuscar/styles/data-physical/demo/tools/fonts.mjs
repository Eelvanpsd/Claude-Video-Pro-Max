// 字体子集：从 timeline.js 收集画面与字幕用到的字，经 Google Fonts CSS2 API 下载 OFL 字体子集到 fonts/，写 fonts.css
// usage: node tools/fonts.mjs <demo>
import fs from 'fs'; import path from 'path'; import { pathToFileURL } from 'url'; import { execFileSync } from 'child_process';
const dir = path.resolve(process.argv[2] || '.');
const { VO, LABELS } = await import(pathToFileURL(path.join(dir, 'timeline.js')));
const base = ' 0123456789.,:+-=×÷·–—→%()/ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz，。：（）';
const chars = [...new Set([...base, ...Object.values(LABELS).join(''), ...VO.map(v => v.zh + v.text).join(''), ...'太阳能风电年份'])].join('');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
const fams = [['Noto Sans SC', '400;500', 'NotoSC'], ['Noto Serif SC', '600', 'NotoSerifSC'], ['Inter', '200;300;400;500', 'Inter'], ['JetBrains Mono', '400;500', 'JBMono']];
fs.mkdirSync(path.join(dir, 'fonts'), { recursive: true });
let css = '';
for (const [fam, w, name] of fams) {
  const url = `https://fonts.googleapis.com/css2?family=${fam.replace(/ /g, '+')}:wght@${w}&text=${encodeURIComponent(chars)}`;
  const r = await fetch(url, { headers: { 'User-Agent': UA } }); if (!r.ok) throw new Error(`${fam}: ${r.status}`);
  const t = await r.text(); let i = 0;
  for (const blk of t.match(/@font-face\s*{[^}]*}/g)) {
    const wt = /font-weight:\s*(\d+)/.exec(blk)[1], src = /url\((.*?)\)/.exec(blk)[1], fn = `${name}-${wt}-${i++}.woff2`;
    fs.writeFileSync(path.join(dir, 'fonts', fn), Buffer.from(await (await fetch(src)).arrayBuffer()));
    css += `@font-face{font-family:'${name}';font-weight:${wt};font-display:block;src:url(fonts/${fn}) format('woff2')}\n`;
  }
}
fs.writeFileSync(path.join(dir, 'fonts.css'), css);
console.log(`fonts: ${chars.length} characters, ${css.split('\n').length - 1} faces`);
