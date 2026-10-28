// timeline.js -> voice/lines.json (TTS input), timeline.json (for mix.py and cuecheck)
// usage: node tools/export.mjs <demo_dir> [DIST]
import fs from 'fs'; import path from 'path'; import { pathToFileURL } from 'url';
const D = path.resolve(process.argv[2] || '.');
const { T, VO, RINGS, REWIND, BPM } = await import(pathToFileURL(path.join(D, 'timeline.js')).href);
const V = JSON.parse(fs.readFileSync(path.join(D, 'assets/vectors.json'), 'utf8'));
const dist = V.points.dist_say || 'DIST';
const lines = VO.map(L => ({ id: L.id, text: L.say.replace('DIST', dist), voice: 'bf_emma', speed: L.speed || 0.9, lang: 'en-gb', ...(L.asr ? { asr: L.asr.replace('DIST', V.points.dist_txt) } : {}) }));
for (const L of lines) if (/DIST/.test(L.text)) throw new Error('distance not measured yet: run tools/vectors.py');
fs.mkdirSync(path.join(D, 'voice'), { recursive: true }); fs.mkdirSync(path.join(D, 'out'), { recursive: true });
fs.writeFileSync(path.join(D, 'voice/lines.json'), JSON.stringify(lines, null, 1));
fs.writeFileSync(path.join(D, 'timeline.json'), JSON.stringify({ bpm: BPM, T, RINGS, REWIND, VO: VO.map(({ id, t }) => ({ id, t })) }, null, 1));
console.log('wrote voice/lines.json and timeline.json');
// subtitles from the real voice durations: each holds >= max(1.8, speech + 0.6) and never overlaps the next.
// cues.json is the single source for the burned-in strip (film.js) and the .srt (zh line above, en line below)
try {
  const dur = JSON.parse(fs.readFileSync(path.join(D, 'voice/out/dur.json'), 'utf8'));
  const DIST = V.points.dist_txt;
  const cues = VO.map((L, i) => {
    const t0 = +(L.t - 0.05).toFixed(3), hold = Math.max(1.8, dur[L.id] + 0.6);
    const next = VO[i + 1] ? VO[i + 1].t - 0.05 - 0.04 : T.end - 0.05;
    return { id: L.id, t0, t1: +Math.min(t0 + hold + 0.15, next).toFixed(3), zh: L.zh.replace('DIST', DIST), en: L.en.replace('DIST', DIST) };
  });
  fs.writeFileSync(path.join(D, 'cues.json'), JSON.stringify(cues, null, 1));
  fs.writeFileSync(path.join(D, 'out/cues_srt.json'), JSON.stringify(cues.map(c => ({ t0: c.t0, t1: c.t1, text: c.zh + '\n' + c.en })), null, 1));
  let bad = 0;
  VO.forEach((L, i) => {
    const d = dur[L.id], hold = Math.max(1.8, d + 0.6), end = L.t - 0.05 + hold, next = VO[i + 1] ? VO[i + 1].t - 0.05 : T.end;
    const ok = end <= next - 0.04;
    if (!ok) bad++;
    console.log(`${L.id} ${L.t.toFixed(2)} speech ${d.toFixed(2)} -> ${(L.t + d).toFixed(2)}  cue to ${end.toFixed(2)}  next ${next.toFixed(2)} ${ok ? 'ok' : 'OVERLAP'}`);
  });
  if (bad) { console.error(bad + ' cue(s) overlap'); process.exitCode = 1; }
} catch (e) { if (e.code !== 'ENOENT') throw e; }
