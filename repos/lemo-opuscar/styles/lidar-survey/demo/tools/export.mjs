// timeline.js -> voice/lines.json (TTS input), timeline.json (for mix.py and cuecheck), cues.json + out/cues_srt.json
// usage: node tools/export.mjs <demo_dir>     (exit 1 if a subtitle would overlap the next one)
import fs from 'fs'; import path from 'path'; import { pathToFileURL } from 'url';
const D = path.resolve(process.argv[2] || '.');
const { T, VO, BPM, PEEL_STEPS } = await import(pathToFileURL(path.join(D, 'timeline.js')).href);
const VOICE = 'bm_george';
const lines = VO.map(L => ({ id: L.id, text: L.say, voice: VOICE, speed: L.speed || 1.0, lang: 'en-gb', ...(L.asr ? { asr: L.asr } : {}) }));
fs.mkdirSync(path.join(D, 'voice'), { recursive: true }); fs.mkdirSync(path.join(D, 'out'), { recursive: true });
fs.writeFileSync(path.join(D, 'voice/lines.json'), JSON.stringify(lines, null, 1));
fs.writeFileSync(path.join(D, 'timeline.json'), JSON.stringify({ bpm: BPM, T, PEEL_STEPS, VO: VO.map(({ id, t }) => ({ id, t })) }, null, 1));
console.log('wrote voice/lines.json and timeline.json');
// subtitles from the real voice durations: each holds >= max(1.8, speech + 0.6) and never overlaps the next
try {
  const dur = JSON.parse(fs.readFileSync(path.join(D, 'voice/out/dur.json'), 'utf8'));
  let bad = 0;
  const cues = VO.map((L, i) => {
    const t0 = +(L.t - 0.05).toFixed(3), hold = Math.max(1.8, dur[L.id] + 0.6);
    const next = VO[i + 1] ? VO[i + 1].t - 0.05 - 0.04 : T.dur - 0.1;
    const end = t0 + hold, ok = end <= next + 1e-6;
    if (!ok) bad++;
    console.log(`${L.id.padEnd(4)} ${L.t.toFixed(2)} speech ${dur[L.id].toFixed(2)} -> ${(L.t + dur[L.id]).toFixed(2)}  cue to ${end.toFixed(2)}  next ${next.toFixed(2)} ${ok ? 'ok' : 'OVERLAP'}`);
    return { id: L.id, t0, t1: +Math.min(Math.max(end, t0 + hold) + 0.25, next).toFixed(3), zh: L.zh, en: L.en };
  });
  fs.writeFileSync(path.join(D, 'cues.json'), JSON.stringify(cues, null, 1));
  fs.writeFileSync(path.join(D, 'out/cues_srt.json'), JSON.stringify(cues.map(c => ({ t0: c.t0, t1: c.t1, text: c.zh + '\n' + c.en })), null, 1));
  if (bad) { console.error(bad + ' cue(s) overlap'); process.exitCode = 1; }
} catch (e) { if (e.code !== 'ENOENT') throw e; }
