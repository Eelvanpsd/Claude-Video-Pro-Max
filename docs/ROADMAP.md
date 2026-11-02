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
| 17 | Mouth envelope for talking characters (95th-pct normalised, breath floor) | Lip-sync without phonemes | S | reels-sistemi `genlik.py` | ✅ `mouth-envelope.py` |
| 18 | Hook wording rules + hook-first post caption, comment prompt, 3:4 cover crop | Stop-scroll & reach | S | reels-sistemi SKILL.md | ✅ checklist |
| 19 | **CC0 SFX sourcing via Openverse API** (`license=cc0`, short duration, manifest with creator + landing URL) | Bigger, licence-safe SFX library | S | openverse | 🔜 |
| 20 | **`earshot realness` + `match` gate** on every new SFX file | Proves "no synthetic SFX", right sound for the label | S | earshot | 🔜 |
| 21 | **Sync proof**: `earshot timeline --cues` — every chime/paper/page-turn within 1 frame of its word/label | Sound tied to the word, measured | S | earshot, real-sfx | 🔜 |
| 22 | Place SFX by audible start (chimes by arrival), fuse < 25 ms, mono check | Tighter hits, no phone-speaker dropouts | S | real-sfx `mix.py` | 💡 |
| 23 | Sound sheet PNG beside the contact sheet in post-render QA | Agent can "see" the mix | S | earshot `sheet` | 💡 |
| 24 | Own reference profile from `docs/reference/` videos → `earshot critique` against it | Genre-correct audio scorecard | M | earshot `profile` | 💡 |
| 25 | Blind A/B listen page for mix-level decisions | Real ears, one tap | S | real-sfx `listen_page.py` | 💡 |
| 26 | **Room-tone pause fill** — sentence gaps get the take's own noise floor (40 ms fades), not digital silence | Seamless pauses under a faint bed | S | VoiceStudio `audio_dsp.py` | 🔜 |
| 27 | Narration signal check: long silence, volume jumps, clipping, empty/NaN samples, with timestamps | Catches broken TTS takes before render | S | VoiceStudio `audio_quality.py` | 💡 |
| 28 | WhisperX forced alignment (±10–30 ms) as a second pass when caption words drift | Tighter word-synced captions | M | VoiceStudio `whisperx` engine | 💡 |
| 29 | Pronunciation lexicon for historical names before TTS | Fewer mispronounced names | S | VoiceStudio `pronunciation.py` | 💡 |
| 30 | **Kokoro word timestamps** (`start_ts`/`end_ts` from predicted durations) as the primary word clock; mlx-whisper as cross-check, flag > 1 frame disagreement | Exact word sync, one less model pass | S | mlx-audio `kokoro/pipeline.py` | 🔜 |
| 31 | Upgrade `.venv-tts` mlx-audio 0.5.8 → 0.6.x with a waveform/duration diff on one video before re-voicing | Fixes + new tools, no surprise voice change | S | mlx-audio | 🔜 |
| 32 | Qwen3-ForcedAligner (script → audio) as tie-breaker for disputed word times | No misheard-word drift | S | mlx-audio `qwen3_asr` | 💡 |
| 33 | Silero VAD pause audit: measured pauses vs tiered-pause plan; no unplanned silence > 1.5 s | Pacing as designed | S | mlx-audio `vad/silero_vad` | 💡 |
| 34 | DeepFilterNet / SAM-Audio cleanup of real CC0 SFX recordings | Cleaner real SFX, still real | M | mlx-audio `sts` | 💡 |
