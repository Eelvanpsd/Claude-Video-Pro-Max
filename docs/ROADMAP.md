# Adoption roadmap

Ranked by expected quality gain per hour of work, for a Remotion + SVG pipeline.
Status: ✅ shipped in [`kit/`](../kit) · 🔜 next · 💡 later.

| # | Idea | Gain | Effort | Source | Status |
|---|---|---|---|---|---|
| 1 | Line boil on figures/props | Hand-made feel | S | ClaudeAnimationBase, hyperframes | ✅ `LineBoil.tsx` |
| 2 | Torn-paper rim wipe | Tactile transitions | S | hyperframes, ClaudeAnimationBase | ✅ `PaperTear.tsx` |
| 3 | Slammed date stamps | Punch on key facts | S | hyperframes, onetake | ✅ `SlamStamp.tsx` |
| 4 | Contact sheet / strip QA | Catch clipping, empty frames | S | ClaudeAnimationBase, gbro | ✅ `contact-sheet.mjs` |
| 5 | **Post-render whisper check** — re-transcribe the final mix, ≥ 80 % script coverage, last word matches | Catches cut-off / silent audio | S | OpenMontage, lemo-opuscar | 🔜 |
| 6 | **Two-pass loudnorm** −14 LUFS / TP −1.2…−1.5, grain in ffmpeg | Consistent loudness on TikTok/IG | S | lemo-opuscar, OpenMontage | 🔜 |
| 7 | **Reading-time gate** — every on-screen text visible ≥ Latin chars ÷ 15 + 1.5 s, fully in frame | No unreadable labels | M | lemo-opuscar `readcheck` | 🔜 |
| 8 | **Cue ↔ visual landmark** within ±1 s of the spoken word | Every visual tied to the word | M | OpenMontage, hypit, lemo-opuscar `cuecheck` | 🔜 |
| 9 | Camera rest during holds (≥ 25 % still frames, one ≥ 1 s rest) | Calmer, more cinematic | S | onetake `verify_promo.py`, lemo DIRECTOR | 💡 |
| 10 | Motion blur on fast moves only (sub-frame average, linear light; > 80 px/frame) | Smoother whips & slams | M | onetake, hyperframes | 💡 |
| 11 | WebGL shader transitions (light-leak, sdf-iris, whip-pan) | Variety | M | hyperframes | 💡 |
| 12 | Voice-band carve for the music bed | Music audible without masking voice | M | hyperframes `carve.mjs` | 💡 |
| 13 | Caption-fine params: 4-frame spring from 0.75, clause-aware grouping, keep quantity+unit together | Better caption reads | S | hypit, OpenMontage | 💡 |
| 14 | Slideshow-risk lint on scene plans (> 60 % text cards fails, `shot_intent` per scene) | Fewer static scenes | S | OpenMontage | 💡 |
| 15 | Character blink & breath, anticipation, overlap | Life in figures | M | ClaudeAnimationBase | 💡 |
| 16 | Offline duration estimate (EN 4.6 syll/s) before TTS | Faster scripting | S | hypit `speech-estimate` | 💡 |
