# onetake — feitangyuan/onetake

> Submodule: [`repos/onetake`](../../repos/onetake) · License: **PolyForm Noncommercial 1.0.0** ("free for noncommercial use only") · Verdict: 💡 **Ideas only — do not copy code into monetised work**

## What it is
A Claude Agent Skill (`SKILL.md`) for 10–30 s product/launch/teaser motion films. Core idea: **"one continuous take"** — every beat boundary must *carry* something across. A film is one HTML composition where every value is a pure function of time (`window.__seek(t)`), built from a move library (`lib/motion.js` → `window.OM`). Python + Playwright/Chromium scripts render, probe and verify.

## How to run
```bash
git clone https://github.com/feitangyuan/onetake ~/.claude/skills/onetake
python3 scripts/stills.py comp.html --times 0.5,2,4          # review stills
python3 scripts/render.py comp.html --out draft.mp4 --sfx sfx.wav   # 1080p30, 180° shutter
python3 scripts/render.py comp.html --out final.mp4 --final         # 4K60
python3 scripts/verify_promo.py draft.mp4 --comp comp.html --shots …   # acceptance oracle
python3 scripts/probe.py comp.html                            # continuity report
node scripts/test_motion.js
```

## Video-quality techniques
| Area | What | Where |
|---|---|---|
| **Real motion blur** | Each moving frame = several seeks across an open shutter, averaged in **linear light**; held frames detected & skipped; sample count adapts to `window.__motion(t0,t1)` travel; never exposes across a hard cut | `scripts/render.py` |
| Move library | spring, ring, wordRise, letterDrop, maskRise, morphRect, iris, zoomThrough, gather, seal, staccato, impact, squash, keyed camera (whip/shake/lattice), swiftSpring, ripple, silk, seeded `rng` | `lib/motion.js`, `gallery/sheets/*.png` |
| **Measured QA** | cadence: shot-length CV ≥ 0.25 · rest: ≥ 25 % dead-still frames + one ≥ 1 s quiet stretch · audio peak ≤ −3 dBFS, no clipping · continuity carry score ≥ 0.5 · velocity > 80 px/frame fails without blur · declared ids stay in frame | `scripts/verify_promo.py` |
| Reference analysis | energy map, cuts, stillness, optical-flow t80, smear | `scripts/analyze_ref.py` |
| Sound | synthesised air/glass/wood/sub/bubble/wobble in one shared reverb, peak −8 dBFS; master −16 LUFS | `scripts/sfx_palette.py`, `references/sound.md` |
| Narration | Kokoro TTS + faster-whisper word times + subtitles | `scripts/vo_tools.py` |
| Looks | 8 colour tokens + 3 OFL fonts per look, subset & inlined | `scripts/look.py`, `looks/looks.json` |

## Free vs paid
Entirely local. No API keys.

## Adopt (re-implement, don't copy)
1. **Shutter motion blur** in Remotion: render N sub-frame samples and average in linear light — only for fast moves.
2. **verify legs** as a post-render QA script: shot-length CV, stillness ratio, peak/clipping, px/frame velocity cap.
3. **Carry boundaries**: something survives every scene change (`references/rhythm.md`, `scripts/probe.py`).
4. **Camera grammar**: key the subject ~0.1 s ahead, whip with expoInOut, hand-float + shake on landings.
5. **Hard rules**: no metronome cuts, rests are required, no confetti, deterministic seeded RNG.
