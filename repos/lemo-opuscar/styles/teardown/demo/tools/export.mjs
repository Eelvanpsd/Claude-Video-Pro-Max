// timeline.js -> voice/lines.json (Kokoro input); after TTS, cues.json (burned-in subtitles) + out/cues_srt.json (.srt)
// usage: node tools/export.mjs <demo_dir>
// Each cue holds >= max(1.8 s, speech + 0.6 s) and never overlaps the next line or the end card.
import fs from 'fs'; import path from 'path'; import { pathToFileURL } from 'url';
const D = path.resolve(process.argv[2] || '.');
const { VO, T, BPM } = await import(pathToFileURL(path.join(D, 'src/timeline.js')).href);
const VOICE = 'am_michael', SPEED = .95;
fs.mkdirSync(path.join(D, 'voice'), { recursive: true }); fs.mkdirSync(path.join(D, 'out'), { recursive: true });
fs.writeFileSync(path.join(D, 'voice/lines.json'), JSON.stringify(VO.map(v => ({ id: v.id, text: v.say, voice: VOICE, speed: v.speed || SPEED, lang: 'en-us', ...(v.asr ? { asr: v.asr } : {}) })), null, 1));
fs.writeFileSync(path.join(D, 'timeline.json'), JSON.stringify({ BPM, T, VO: VO.map(({ id, t }) => ({ id, t })) }, null, 1));
let dur; try { dur = JSON.parse(fs.readFileSync(path.join(D, 'voice/out/dur.json'), 'utf8')); } catch { console.log('wrote voice/lines.json (no durations yet)'); process.exit(0); }
let bad = 0;
const cues = VO.map((v, i) => {
  const t0 = +(v.t - .05).toFixed(3), need = Math.max(1.8, dur[v.id] + .6);
  const limit = (VO[i + 1] ? VO[i + 1].t - .05 : T.card) - .04;
  const t1 = +Math.min(t0 + need + .25, limit).toFixed(3);
  const ok = t0 + need <= limit; if (!ok) bad++;
  console.log(`${v.id} ${v.t.toFixed(2)} speech ${dur[v.id].toFixed(2)} ends ${(v.t + dur[v.id]).toFixed(2)} cue ${t0}-${t1} ${ok ? 'ok' : 'OVERLAP'}`);
  return { id: v.id, t0, t1, zh: v.zh, en: v.en };
});
fs.writeFileSync(path.join(D, 'cues.json'), JSON.stringify(cues, null, 1));
fs.writeFileSync(path.join(D, 'out/cues_srt.json'), JSON.stringify(cues.map(c => ({ t0: c.t0, t1: c.t1, text: c.zh + '\n' + c.en })), null, 1));
if (bad) { console.error(bad + ' cue(s) too short for their speech'); process.exit(1); }
