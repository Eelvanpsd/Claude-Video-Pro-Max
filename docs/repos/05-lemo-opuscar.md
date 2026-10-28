# lemo-opuscar — lemomo-ai/lemo-opuscar

> Source (vendored): [`repos/lemo-opuscar`](../../repos/lemo-opuscar) · License: **MIT** (demo assets keep their own licences, see each demo's `CREDITS`) · Verdict: ✅ **Adopt — best fit for a free/local pipeline**

## What it is
**43 film styles** (`styles/<slug>/STYLE.md` + `DEMO.md` + a demo film), each made entirely in code on a shared toolkit (`core/`). Three agent guides: `DIRECTOR.md` (story, sound, rhythm, camera, self-checks), `TECHNIQUE.md` (build) and the per-style `STYLE.md`. Stack: Canvas 2D, three.js r170 + WebGL2 post passes, playwright-core render; Python (numpy, scipy, soundfile) for audio; Kokoro / edge-tts / faster-whisper for voice. Claude plugin in `plugin/skills/lemo-opuscar/`.

## How to run
```bash
claude plugin marketplace add lemomo-ai/lemo-opuscar && claude plugin install lemo-opuscar@lemolab
sh plugin/skills/lemo-opuscar/scripts/setup.sh deps [voice|music]
node core/render/video.mjs <demo> --fps 24 --workers 3
node core/render/still.mjs <demo> --range 0:50:2
node core/render/readcheck.mjs <demo>                  # reading-time gate
sh core/render/mux.sh video.mp4 mix.wav out.mp4 24 [grain]   # master
```
Requires Node 20+, ffmpeg, Python 3.11+.

## Video-quality techniques
| Area | What | Where |
|---|---|---|
| Page contract | `window.render(t)` deterministic, `DUR`, `READY`, `EV` (events → SFX), `TEXTS(t)` (on-screen text boxes for QA) | `TECHNIQUE.md` §2 |
| **readcheck** | every text fully in frame for ≥ CJK chars ÷ 4.5 + Latin chars ÷ 15 + 1.5 s | `core/render/readcheck.mjs` |
| **Mastering** | two-pass loudnorm → −14 LUFS / −1.2 dBTP; grain added in ffmpeg (frames stay compressible); refuses corrupt/truncated audio | `core/render/mux.sh` |
| **TTS round-trip** | every line re-transcribed by Whisper and compared to the script; writes word timestamps | `core/tts/asr_check.py` |
| Music | free sample libraries (VSCO2 CE, VCSL, FreePats, Salamander) + Karplus–Strong `pluck.py` | `core/audio/sampler.py`, `core/audio/INSTRUMENTS.md` |
| Foley | procedural click/whoosh/thump/ding/pop with compress, limit, pan | `core/audio/sfx.py` |
| **Cue check** | ms offset of each visual hit from the BPM grid and the nearest VO word — target 0 ms; one `timeline.js` drives sections & hits | `styles/whiteboard/demo/tools/cuecheck.py`, `TECHNIQUE.md` §3 |
| Post | CRT/VHS; DOF, GTAO, bloom, grade | `core/post/crt.js`, `core/three/post.js` |
| **Hand-drawn engine** | wobble, pressure ramp, overshoot past closure, multiply ink, stroke-by-stroke handwriting | `styles/whiteboard/STYLE.md` §2, `styles/whiteboard/demo/engine/wb.js` |
| Director rules | ≥ 2 silences; J/L-cuts as transitions; ≥ 4 camera moves; subtitles held ≥ max(1.8 s, speech + 0.6 s); "not the demo again" (≥ 4 of 6 structural axes differ); pre-delivery checklist (ebur128, blackdetect, Whisper on the final mix) | `DIRECTOR.md` |

## Free vs paid
Entirely free (edge-tts needs network, no key). Only CC0 / CC BY / OFL assets.

## Adopt
1. **`TEXTS(t)` + readcheck** — export text boxes per frame from Remotion and gate on reading time.
2. **TTS → Whisper round-trip** check.
3. **`mux.sh` mastering**: two-pass loudnorm −14 LUFS, grain in ffmpeg.
4. **One cue map** drives score, SFX and visuals + `cuecheck` verification.
5. **Hand-drawn stroke spec** (wobble, pressure, overshoot) — directly suits SVG art.
