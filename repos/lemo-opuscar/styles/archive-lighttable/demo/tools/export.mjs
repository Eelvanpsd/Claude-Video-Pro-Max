// Timeline -> out/timeline.json (for mix.py and the checks) and out/cues.json + out/cues_srt.json (subtitles).
// Reads voice/out/dur.json and voice/out/words.json (written by tts.py and asr_check.py).
// usage: node tools/export.mjs <demo_dir>     exits 1 if two voice lines overlap or a cue is shorter than 1.8 s
import fs from 'fs'; import path from 'path'; import { pathToFileURL } from 'url';
const D = path.resolve(process.argv[2] || '.');
const TL = await import(pathToFileURL(path.join(D, 'timeline.js')).href);
const dur = JSON.parse(fs.readFileSync(path.join(D, 'voice/out/dur.json'), 'utf8'));
const words = JSON.parse(fs.readFileSync(path.join(D, 'voice/out/words.json'), 'utf8'));
let bad = 0;
const voice = TL.VOICE.map(v => ({ ...v, dur: dur[v.id], t1: +(v.t + dur[v.id]).toFixed(3) }));
voice.forEach((v, i) => { if (i && v.t < voice[i - 1].t1 + 0.15) { console.error(`voice overlap: ${voice[i - 1].id} ends ${voice[i - 1].t1}, ${v.id} starts ${v.t}`); bad = 1; } });
const V = Object.fromEntries(voice.map(v => [v.id, v]));
const cues = TL.SUBS.map(s => {
  const v = V[s.line]; let t0 = v.t;
  if (s.from) { const w = words[s.line].find(w => w[0].toLowerCase().replace(/[^a-z0-9]/g, '') === s.from.toLowerCase()); if (!w) throw new Error(`word ${s.from} not in ${s.line}`); t0 = v.t + w[1] - 0.05; }
  return { id: s.id, line: s.line, zh: s.zh, en: s.en, t0: +t0.toFixed(3) };
});
cues.forEach((c, i) => {
  const nx = cues[i + 1], v = V[c.line];
  c.t1 = nx && nx.line === c.line ? nx.t0 : +(v.t1 + 0.6).toFixed(3);
  if (nx && c.t1 > nx.t0 - 0.04) c.t1 = +(nx.t0 - 0.04).toFixed(3);
  if (c.t1 - c.t0 < 1.8) { console.error(`cue ${c.id} only ${(c.t1 - c.t0).toFixed(2)} s`); bad = 1; }
});
fs.mkdirSync(path.join(D, 'out'), { recursive: true });
fs.writeFileSync(path.join(D, 'out/cues.json'), JSON.stringify(cues, null, 1));
fs.writeFileSync(path.join(D, 'out/cues_srt.json'), JSON.stringify(cues.map(c => ({ t0: c.t0, t1: c.t1, text: `${c.zh}\n${c.en}` })), null, 1));
fs.writeFileSync(path.join(D, 'out/timeline.json'), JSON.stringify({ dur: TL.DUR, bpm: TL.BPM, beat: TL.BEAT, hit: TL.HIT, voice }, null, 1));
for (const c of cues) console.log(c.id.padEnd(4), c.t0.toFixed(2), '→', c.t1.toFixed(2), `(${(c.t1 - c.t0).toFixed(2)} s)`, c.zh, '|', c.en);
process.exit(bad);
