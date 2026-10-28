# kit — ready-to-use pieces

Small, standalone, MIT-licensed implementations of ideas collected from the repos in [`../repos`](../repos).
Written from scratch for **Remotion 4** (React) + hand-written SVG art. No paid APIs, no AI images.

| File | What | Inspired by |
|---|---|---|
| [`remotion/LineBoil.tsx`](remotion/LineBoil.tsx) | Hand-drawn "line boil": feTurbulence + feDisplacementMap re-seeded every N frames, per-layer seed offsets | ClaudeAnimationBase `boilSeed`, hyperframes `hw-boil` |
| [`remotion/PaperTear.tsx`](remotion/PaperTear.tsx) | Torn-paper wipe for `@remotion/transitions`, optional fibrous paper rim + cast shadow | hyperframes `torn-paper-rip`, ClaudeAnimationBase `brushWipe` |
| [`remotion/SlamStamp.tsx`](remotion/SlamStamp.tsx) | Date/number "slam": 2.4x → 1x in 0.1 s, damped bounce, jolt, tilt | hyperframes `kinetic-beat-slam`, onetake `impact`/`seal` |
| [`tools/contact-sheet.mjs`](tools/contact-sheet.mjs) | ffmpeg contact sheet / per-frame strip of a render for visual QA | ClaudeAnimationBase `--sheet/--strip`, gbro ffmpeg QA |
| [`tools/mouth-envelope.py`](tools/mouth-envelope.py) | Per-frame mouth openness for talking characters: 95th-percentile normalised, breath floor | reels-sistemi `genlik.py` |

```bash
npm i remotion @remotion/transitions
node kit/tools/contact-sheet.mjs out/video.mp4 --every 1.5
node kit/tools/contact-sheet.mjs out/video.mp4 --strip 12.0:12.8
python3 kit/tools/mouth-envelope.py voice.wav mouth.json --fps 30
```

Production use: these four pieces are the **"v3 look"** of a vertical history-shorts channel
(1080×1920, Kokoro narration, SVG art) — line boil on figures/props only, rim tear on every scene change,
slammed date stamps. Render cost increase was negligible.
