// Cue grid check: every key action in timeline.js (HIT) must sit on a beat or half-beat of the 90 BPM grid,
// except the two deliberate breaths (suck, hush), which sit just before their downbeat by design.
// usage: node tools/cuecheck.mjs <demo_dir>
import path from 'path'; import { pathToFileURL } from 'url';
const D = path.resolve(process.argv[2] || '.');
const { HIT, BEAT } = await import(pathToFileURL(path.join(D, 'timeline.js')).href);
const OFF = new Set(['suck', 'hush']);
let bad = 0;
for (const [k, t] of Object.entries(HIT)) {
  const beats = t / BEAT, half = Math.round(beats * 2) / 2, err = Math.abs(beats - half) * BEAT * 1000;
  const ok = OFF.has(k) || err < 1;
  if (!ok) bad++;
  console.log(`${ok ? 'OK ' : 'OFF'} ${k.padEnd(12)} ${t.toFixed(3)} s  beat ${beats.toFixed(2)}${OFF.has(k) ? '  (breath, off-grid by design)' : `  error ${err.toFixed(1)} ms`}`);
}
console.log(bad ? `${bad} cues off the grid` : 'all cues on the beat grid');
process.exit(bad ? 1 : 0);
