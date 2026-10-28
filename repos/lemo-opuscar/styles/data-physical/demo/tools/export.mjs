// timeline.js → voice/lines.json（TTS 用的念法 + 语音识别应听到的原文）；有 voice/out/dur.json 时再写 out/cues.json 并检查旁白不重叠
// usage: node tools/export.mjs <demo>
import fs from 'fs'; import path from 'path'; import { pathToFileURL } from 'url';
const dir = path.resolve(process.argv[2] || '.');
const TLM = await import(pathToFileURL(path.join(dir, 'timeline.js'))); const { VO, VOICE, DUR } = TLM;
fs.mkdirSync(path.join(dir, 'out'), { recursive: true });
fs.writeFileSync(path.join(dir, 'out/timeline.json'), JSON.stringify({ BPM: TLM.BPM, BEAT: TLM.BEAT, BAR: TLM.BAR, DUR, T: TLM.T, BUILD: TLM.BUILD, VO }, null, 1));
const SAY = { '2014': 'twenty fourteen', '2021': 'twenty twenty-one', '2025': 'twenty twenty-five' };
const say = s => s.replace(/\b(2014|2021|2025)\b/g, m => SAY[m]);
const lines = VO.map(v => ({ id: v.id, text: say(v.text), asr: v.text.replace(/,(?=\s)/g, ','), voice: VOICE.voice, speed: VOICE.speed, lang: VOICE.lang }));
fs.mkdirSync(path.join(dir, 'voice'), { recursive: true });
fs.writeFileSync(path.join(dir, 'voice/lines.json'), JSON.stringify(lines, null, 1));
const dj = path.join(dir, 'voice/out/dur.json');
if (fs.existsSync(dj)) {
  const dur = JSON.parse(fs.readFileSync(dj, 'utf8')); let bad = 0;
  const cues = VO.map((v, i) => ({ id: v.id, t0: v.t, t1: +(v.t + dur[v.id]).toFixed(3), zh: v.zh, en: v.text }));
  cues.forEach((c, i) => { const n = cues[i + 1]; if (n && c.t1 + .25 > n.t0) { console.error(`overlap: ${c.id} ends ${c.t1} > ${n.id} starts ${n.t0}`); bad++; } if (c.t1 > DUR - .5) { console.error(`${c.id} runs past the end`); bad++; } });
  fs.mkdirSync(path.join(dir, 'out'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'out/cues.json'), JSON.stringify(cues, null, 1));
  for (const c of cues) console.log(c.id, c.t0.toFixed(2), '→', c.t1.toFixed(2), `(${(c.t1 - c.t0).toFixed(2)} s)`);
  if (bad) process.exit(1);
}
