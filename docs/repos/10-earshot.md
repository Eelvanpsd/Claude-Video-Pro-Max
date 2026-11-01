# earshot — Leonxlnx/earshot

> Source (vendored): [`repos/earshot`](../../repos/earshot) · License: **MIT** · Verdict: ✅ **Adopt the "ears" (measure, describe, match, timeline, critique); skip forge/sfx/kit (synthesis)**

## What it is
"Ears for coding agents" (v0.4.0, Python ≥ 3.10, CPU). Turns sound into evidence an agent can reason about:
what a file sounds like in words, how well it fits a description, the best moment inside a long recording,
real vs code-synthesized, a second-by-second listening transcript of a film, an annotated PNG sheet, and a
scorecard against 7 professional launch films. CLI, Python API (`from earshot import api`) and an MCP server.
It also ships a **synthesis** side (`forge`, `fit`, a bank of 252 code-made sounds, `kit`) and a skill,
`skills/real-sound/`, that builds soundtracks only from real licensed recordings.

Models: CLAP `laion/larger_clap_general` + AudioSet tagger `MIT/ast-finetuned-audioset-10-10-0.4593`
(Hugging Face, downloaded once; `earshot/config.py`). Each CLI call loads them (~20–40 s); `measure`, `sfx`, `kit` load none.

## How to run
```bash
python -m venv .venv && .venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu
.venv/bin/pip install -e ".[mcp]"
earshot doctor --load
earshot measure out/video.mp4                       # LUFS, true peak, LRA, envelope, tempo — no models
earshot describe sfx/paper.wav                      # "sounds most like …" with z-scores
earshot match sfx/page.wav "a book page turning" --alts "paper crumple" "a whoosh"
earshot rank "a soft paper rustle" downloads/*.wav  # pick the best of many downloads
earshot find long_take.wav "a single page turn" --top 4   # trims inside a long recording
earshot realness sfx/*.wav                          # real recording vs code-synthesized
earshot timeline out/video.mp4 --video out/video.mp4 --cues cues.json   # events, sync to cuts/cue frames
earshot sheet out/video.mp4 -o out/sound-sheet.png  # frames + events + spectrogram + loudness for an agent to read
earshot critique out/video.mp4                      # scorecard vs the launch profile (see caveat below)
claude mcp add earshot --scope user -- /path/to/earshot/.venv/bin/python -m earshot mcp
```

## Video-quality techniques
| Area | What | Where |
|---|---|---|
| **Agent listening** | `describe`/`match`/`rank`/`find` give calibrated z-scores against a 322-description vocabulary, with a verdict (strong / plausible / weak) | `earshot/describe.py`, `match.py`, `search.py` |
| **Realness gate** | Flags code-synthesized sources (~92 % precision when firm) — proves "no synthetic SFX" on every file | `earshot/realness.py`, `docs/LIMITS.md` |
| **Sync check** | Offsets of hits to cuts / cue frames to the ms (median 0 ms, 96 % within a frame on their test film) | `earshot/timeline.py` |
| **Sound sheet** | One PNG: video frames, labelled events, spectrogram, waveform, loudness, sync markers | `earshot/sheet.py` |
| Launch-film profile | Measured on 7 films: start ≤ 0.48 s, −14.8 LUFS median, loudest 3 s only +2.3 LU over integrated, 1.2–1.7 salient hits/s, **not a hit on every cut**, 6 of 7 clip after AAC (don't copy) | `docs/launch-video-sound.md`, `earshot/data/launch_profile.json` |
| Placement numbers | Against the cut: tap −60 ms, knock −40, click −11, thump +30, whoosh peak +37, swell peak +42; min gaps ticks 66 ms, keys 87, pops 114; effects 3–10 dB over the music bed | README › launch preset |
| Own profile | `earshot profile REFS... -o p.json` — build the scorecard from our own reference videos instead | `earshot/profile.py` |
| real-sound skill | Licence audit, sourcing from Freesound/Mixkit, measured QA (clicks, masking, harshness, sync), master gate ±0.5 LU, ≤ −1.5 dBTP, credits | `skills/real-sound/` |

## Honest limits (from `docs/LIMITS.md`)
- Meters (LUFS, timing, clipping) are trustworthy; tags of events inside a busy mix are right only ~½ (exposed) to ~¼ (under music).
- The launch scorecard describes SaaS launch films — a narrated documentary short breaks its rules on purpose
  (music-led, flat arc). Use `measure`/`timeline`, or build our own profile from `docs/reference/`.

## Free vs paid
Free and local. Optional `llm` command uploads audio to Gemini with your own key — never needed.

## Adopt
1. ✅ **`realness` + `match` on every downloaded SFX** before it enters the library → QUALITY-CHECKLIST › Audio.
2. ✅ **`timeline --cues`** to prove chimes/paper/page-turns land on their word/label frames (≤ 1 frame).
3. ✅ **`sheet`** next to the video contact sheet in post-render QA.
4. 💡 `earshot profile` from our own reference videos, then `critique` against it.
5. 💡 MCP server so models stay loaded across many checks.

## Skip
- **`forge`, `fit`, `sfx`, `kit`**: they make sound in code — synthetic SFX are forbidden in the history pipeline.
- `critique` against the bundled launch profile as a pass/fail gate (wrong genre).
- `llm` (paid, uploads audio).
