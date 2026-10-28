// out/cues.json → 双语字幕条目（中文一行 + 英文一行），时长与画面上烧进去的一致：≥ max(1.8 s, 语音 + 0.6 s)
import fs from 'fs'; import path from 'path';
const dir = path.resolve(process.argv[2] || '.');
const cues = JSON.parse(fs.readFileSync(path.join(dir, 'out/cues.json'), 'utf8'));
console.log(JSON.stringify(cues.map(c => ({ t0: c.t0, t1: +Math.max(c.t1 + .6, c.t0 + 1.8).toFixed(3), text: `${c.zh}\n${c.en}` })), null, 1));
