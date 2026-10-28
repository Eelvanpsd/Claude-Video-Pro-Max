// timeline.js -> voice/lines.json (TTS input), timeline.json (mix.py, cuecheck), and, once voice/out/dur.json exists,
// cues.json (burned-in subtitles) + out/cues_srt.json (.srt). Each cue holds >= max(1.8 s, speech + 0.6 s) and never
// overlaps the next one or the end card. usage: node tools/export.mjs <demo_dir>     exit 1 on an overlap
import fs from 'fs'; import path from 'path'; import { pathToFileURL } from 'url';
const D = path.resolve(process.argv[2] || '.');
const { T, VO, GROW, CLOCK, BPM } = await import(pathToFileURL(path.join(D, 'timeline.js')).href);
const VOICE = 'bm_george';
const lines = VO.map(L => ({ id: L.id, text: L.say, voice: VOICE, speed: L.speed || 1, lang: 'en-gb', ...(L.asr ? { asr: L.asr } : {}) }));
fs.mkdirSync(path.join(D, 'voice'), { recursive: true }); fs.mkdirSync(path.join(D, 'out'), { recursive: true });
fs.writeFileSync(path.join(D, 'voice/lines.json'), JSON.stringify(lines, null, 1));
fs.writeFileSync(path.join(D, 'timeline.json'), JSON.stringify({ bpm: BPM, T, GROW, CLOCK, VO: VO.map(({ id, t }) => ({ id, t })) }, null, 1));
let dur;
try { dur = JSON.parse(fs.readFileSync(path.join(D, 'voice/out/dur.json'), 'utf8')); } catch { console.log('wrote voice/lines.json, timeline.json (no voice yet)'); process.exit(0); }
let bad = 0;
const cues = VO.map((L, i) => {
  const d = dur[L.id], t0 = +(L.t - 0.05).toFixed(3), hold = Math.max(1.8, d + 0.6);
  const next = VO[i + 1] ? VO[i + 1].t - 0.05 : T.end;
  const t1 = +Math.min(t0 + hold + 0.2, next - 0.04).toFixed(3);
  const ok = t0 + hold <= next - 0.04 + 1e-6;
  if (!ok) bad++;
  console.log(`${L.id.padEnd(4)} ${L.t.toFixed(2)}  speech ${d.toFixed(2)} -> ${(L.t + d).toFixed(2)}  cue ${t0.toFixed(2)}-${t1.toFixed(2)}  next ${next.toFixed(2)} ${ok ? 'ok' : 'OVERLAP'}`);
  return { id: L.id, t0, t1, zh: L.zh, en: L.en };
});
fs.writeFileSync(path.join(D, 'cues.json'), JSON.stringify(cues, null, 1));
fs.writeFileSync(path.join(D, 'out/cues_srt.json'), JSON.stringify(cues.map(c => ({ t0: c.t0, t1: c.t1, text: c.zh + '\n' + c.en })), null, 1));
if (bad) { console.error(bad + ' cue(s) overlap'); process.exitCode = 1; }
