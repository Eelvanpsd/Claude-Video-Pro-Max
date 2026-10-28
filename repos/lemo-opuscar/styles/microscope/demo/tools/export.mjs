// timeline.js -> voice/lines.json (TTS input), timeline.json (mix.py, cuecheck), cues.json + out/cues_srt.json (subtitles).
// Also checks that every number in the script equals the measurement it reports.
// usage: node tools/export.mjs <demo_dir>
import fs from 'fs'; import path from 'path'; import { pathToFileURL } from 'url';
const D = path.resolve(process.argv[2] || '.');
const { T, VO, BPM, DUR, NUM } = await import(pathToFileURL(path.join(D, 'timeline.js')).href);
const P = JSON.parse(fs.readFileSync(path.join(D, 'assets/plates/plates.json'), 'utf8'));
const NU = JSON.parse(fs.readFileSync(path.join(D, 'assets/plates/nucleus.json'), 'utf8'));
const want = {
  tissue_mm: (P.tissue.length_um / 1000).toFixed(1), A: (100 * P.rois.A.share).toFixed(1), B: (100 * P.rois.B.share).toFixed(1),
  ratio: (P.rois.B.share / P.rois.A.share).toFixed(1), dist_mm: (P.ab_dist_um / 1000).toFixed(1), nucleus_um: NU.d_um.toFixed(1),
};
let bad = 0;
for (const k in want) if (want[k] !== NUM[k]) { console.error(`script says ${k} = ${NUM[k]}, measured ${want[k]}`); bad++; }
if (bad) process.exit(1);
console.log('script numbers match the measurements:', JSON.stringify(want));
const lines = VO.map(L => ({ id: L.id, text: L.say, voice: 'af_heart', speed: L.speed || 0.95, lang: 'en-us', ...(L.asr ? { asr: L.asr } : {}) }));
fs.mkdirSync(path.join(D, 'voice'), { recursive: true }); fs.mkdirSync(path.join(D, 'out'), { recursive: true });
fs.writeFileSync(path.join(D, 'voice/lines.json'), JSON.stringify(lines, null, 1));
fs.writeFileSync(path.join(D, 'timeline.json'), JSON.stringify({ bpm: BPM, dur: DUR, T, VO: VO.map(({ id, t }) => ({ id, t })) }, null, 1));
console.log('wrote voice/lines.json and timeline.json');
// subtitles from the real voice durations: each holds >= max(1.8, speech + 0.6) and never overlaps the next
try {
  const dur = JSON.parse(fs.readFileSync(path.join(D, 'voice/out/dur.json'), 'utf8'));
  let over = 0;
  const cues = VO.map((L, i) => {
    const t0 = +(L.t - 0.05).toFixed(3), hold = Math.max(1.8, dur[L.id] + 0.6);
    const next = VO[i + 1] ? VO[i + 1].t - 0.05 - 0.04 : DUR - 0.3;
    const t1 = +Math.min(t0 + hold + 0.25, next).toFixed(3);
    const ok = t0 + hold <= next + 1e-6;
    if (!ok) over++;
    console.log(`${L.id} ${L.t.toFixed(2)} speech ${dur[L.id].toFixed(2)} -> ${(L.t + dur[L.id]).toFixed(2)}  cue ${t0}-${t1}  next ${next.toFixed(2)} ${ok ? 'ok' : 'OVERLAP'}`);
    return { id: L.id, t0, t1, zh: L.zh, en: L.en };
  });
  fs.writeFileSync(path.join(D, 'cues.json'), JSON.stringify(cues, null, 1));
  fs.writeFileSync(path.join(D, 'out/cues_srt.json'), JSON.stringify(cues.map(c => ({ t0: c.t0, t1: c.t1, text: c.zh + '\n' + c.en })), null, 1));
  if (over) { console.error(over + ' cue(s) overlap'); process.exitCode = 1; }
} catch (e) { if (e.code !== 'ENOENT') throw e; }
