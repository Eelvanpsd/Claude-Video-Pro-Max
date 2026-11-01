# real-sfx — Clipwing/skills › skills/real-sfx

> Source (vendored): [`repos/real-sfx`](../../repos/real-sfx) (only the `skills/real-sfx` folder of the Clipwing repo) · License: **MIT** scripts; bundled `uisfx` code MIT, sounds CC0 (per the skill's README — the Clipwing repo itself has no top-level LICENSE) · Verdict: ✅ **Adopt the placement/level/verify ideas; library mode only (`--ui library`)**

## What it is
A large Claude Code skill (Alexander Korbanov, Clipwing) that sound-designs a finished motion video with **real
recorded sounds from your own library**: it finds the moments (from the project's cue list, a HyperFrames timeline,
a screen recording or the picture itself), picks and processes recordings, places them on the exact frame at the level
the author's own sounds had, keeps music and voice, removes a baked-in synthesized layer instead of doubling it, and
returns a new MP4 + a separate SFX WAV + a cue report + a self-critique scoreboard. ~45 Python scripts, a 189-check
self-test, and `tests/resound.py` (strip pro sound design from finished videos, let a fresh agent re-sound them, compare in numbers).

## How to run
```bash
# needs Python 3.9+, ffmpeg with drawtext + rubberband (macOS: brew install ffmpeg-full)
python scripts/setup.py init --library main="$HOME/SFX/cc0" --index      # our own CC0 library (no --uisfx)
python scripts/setup.py check
python scripts/look.py out/video.mp4 --out work/look                       # frames + spectrogram of the native sound
python scripts/from_cues.py cues.json --video out/video.mp4 --out work/cues.json --ui library
python scripts/mix.py work/cues.json --out result/video_sfx.mp4 --voice-safe --plan   # then without --plan
python scripts/verify.py ... ; python scripts/critique.py result/video_sfx_resolved_cues.json result/video_sfx_sfx_track.wav
python scripts/search.py --role chime --says "bell|chime" --max-dur 1.2 --sheet work/chimes.png --paths
python tests/selftest.py
```

## Video-quality techniques
| Area | What | Where |
|---|---|---|
| **Typed cue list → real sounds** | A `cues.json` of `{t, type}` (whoosh, wipe, click, pop, bell, paper …) is the best source of moments; each type routes to a library role | `scripts/from_cues.py`, `references/typed-cues.md` |
| **Place by audible start / arrival** | A sound with an 85 ms quiet lead-in is placed by where it becomes audible; hits/chimes by "arrival" (first 60 ms within 6 dB of the peak) | `scripts/mix.py` header, SKILL.md › Build |
| **Voice-safe mixing** | `--voice-safe` (depths light / normal / deep) keeps SFX out of the speech band; `--duck` when music carries | `scripts/mix.py`, `scripts/masking.py` |
| **Tonal fit** | A pitched sound (chime, bell, glass) is shifted ≤ 2 semitones (+ cents, 2.5 total) onto the notes of the music bed | `scripts/tonal.py` |
| **Mono check** | A sound whose channels cancel vanishes on a phone speaker; mix plays its louder channel | `scripts/mix.py` (`--no-mono-fix`) |
| **Clusters** | Same-type events < 25 ms apart fuse into one; runs faster than 14/s are thinned | `from_cues.py` `--fuse`, `--max-rate` |
| **Bed level** | A steady, dark real ambience at **−54 dBFS** (blind ladder −56/−50/−44/−36: −56 chosen every time, −44+ "loud", none "empty"); ripple ≤ 4 dB | `scripts/bed.py` |
| SFX-reel numbers | 9 finished reels: gap between gestures 0.5–1.2 s (median 0.7), longest hole median 2.5 s, quietest tenth ~24 dB under the loudest 250 ms, 0 % digital silence in 7 of 9 | SKILL.md › Small-sound layer, Bed |
| Pick by looking | Candidate sheets (waveform + spectrogram per id); "library names lie" — check tags before using a fallback sound | `scripts/search.py`, `scripts/sheet.py`, `references/listening.md` |
| **Cheap human ears** | Blind A/B page of versions + the critique's 5 listen-list moments, one tap per verdict, works on a phone (`serve --lan`) | `scripts/listen_page.py` |
| Taste memory | `taste.py ban ID`; next video starts from your taste | `scripts/taste.py` |

## Free vs paid
Free and local. YAMNet tags (`listen.py install --yes`) are optional and local.

## Adopt
1. ✅ **Our existing SFX stay real CC0**; take the placement rules: place by audible start, chimes by arrival,
   fuse < 25 ms, never > 14 sounds/s → QUALITY-CHECKLIST › Audio.
2. ✅ **Mono check** and **voice-safe band** on every SFX → QUALITY-CHECKLIST › Audio.
3. ✅ **Bed level ≈ −54 dBFS** as a sanity bound for the "barely audible" music bed (ours is music, not ambience — tune by ear, but never above ~−44).
4. 💡 Export our Remotion SFX events as `cues.json` and run `mix.py --ui library --plan` + `critique.py` as an audit.
5. 💡 `listen_page.py` blind A/B for level decisions (e.g. v2 vs v3 SFX mix).

## Skip
- **`uisfx` pack** (`--uisfx`, `--ui auto`): the skill itself says those 78 sounds are synthesized — forbidden for us. Always `--ui library`.
- `texture.py` small-sound layer: for SFX-only films; ours is narration-first.
- `ui_events.py` / screencast tooling: not our genre.
