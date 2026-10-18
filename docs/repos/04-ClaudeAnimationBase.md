# ClaudeAnimationBase — JohnHeibel/ClaudeAnimationBase

> Submodule: [`repos/ClaudeAnimationBase`](../../repos/ClaudeAnimationBase) · License: **MIT** · Verdict: ✅ **Adopt**

## What it is
A small starter kit for **hand-painted character animation** (the "Clawd" mascot) in p5.js 2 + p5.brush (watercolour, ink, boiling lines), rendered through headless Chrome (puppeteer-core) + ffmpeg. The heart is `ANIMATION_GUIDE.md` (461 lines of rules, workflow and API).

| File | Role |
|---|---|
| `src/core.js` | paint, easing, springs, camera, glow, paper, grain |
| `src/clawd.js` | 31 emotions, key views, hats, emotes |
| `src/timeline.js` | shots + `brushWipe` |
| `render.mjs` | renderer (clip / frames / sheet / strip / crop) |
| `studio.html` | scrubber |

## How to run
```bash
npm install
node render.mjs --clip --out=out/video.mp4     # npm run video
npm run sheet                                   # contact sheet
node render.mjs --frames --workers=4 && node render.mjs --encode
# Linux: --soft-gl  or  --gpu-angle=gl-egl
```

## Video-quality techniques
| Area | What | Where |
|---|---|---|
| **Boil** | `BOIL = 12` reseeds/s; `boilSeed(key)` gives per-element seeds so one moving element doesn't re-jitter everything after it; `hash(i)` stable values; `onTwos` | `src/core.js:26` |
| Transitions | hand-painted `brushWipe(p)` — **cut under full cover at p = 0.5**; `iris`, `irisShape`; a transition at every seam | `src/timeline.js`, `src/core.js:118-127` |
| Motion helpers | `spring`, `ring`, `backOut`, `elasticOut`, `arcPt`, `jump`, `take`, `stroll`, `kf`; beat-locked `pulse`, `beatN` from `PROJECT.bpm` | `src/core.js` |
| Light | additive `glow()` so paint doesn't go muddy | `src/core.js` |
| **Self-review loop** | `--sheet=` contact sheets · `--strip=a:b` every frame of a range · `--crop=` / `--crop-at=` follow a world point through the camera · checklist: reads, timing (count frames per read), boil, contacts, transitions, no text, colour | `ANIMATION_GUIDE.md` §3, `render.mjs` |
| Timing doctrine | write the "reads" per shot with start/end; one read at a time; **"fast actions, slow meanings"** | `ANIMATION_GUIDE.md` §4 |

## Free vs paid
Entirely local. GPU recommended for watercolour fills.

## Adopt
1. **Per-element boil seeds** → [`kit/remotion/LineBoil.tsx`](../../kit/remotion/LineBoil.tsx).
2. **Cover-then-reveal wipe** with the cut at 50 % → idea behind [`kit/remotion/PaperTear.tsx`](../../kit/remotion/PaperTear.tsx).
3. **STORYBOARD.md "reads" format** for planning each shot.
4. **sheet / strip / crop-at review** → [`kit/tools/contact-sheet.mjs`](../../kit/tools/contact-sheet.mjs) (`--strip a:b`).
5. **Animation principles**: anticipation, avoid twinning, overlap, take/overshoot (`emotions()` in `src/clawd.js`).
