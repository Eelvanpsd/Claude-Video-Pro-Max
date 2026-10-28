# reels-sistemi — yapaytu/reels-sistemi

> Submodule: [`repos/reels-sistemi`](../../repos/reels-sistemi) · License: **MIT** · Verdict: 💡 **Ideas only — three pieces adopted, engine skipped**

## What it is
A small (~300 lines) Turkish-language Claude Code skill + tools for 30–40 s Reels/TikTok/Shorts: hook and script
rules → voice-over → whisper word times → one HTML page per video that draws itself from a frame number →
Playwright screenshots every frame → ffmpeg MP4. Also writes the post caption, first comment and a
comment-keyword → DM text. Style: white background, thick black boxes, hard shadow, one accent colour, "stamp" labels.

## How to run
```bash
npm install && npx playwright install chromium
python3 araclar/kirp.py voice.mp3 ses-kisa.wav             # shorten breath gaps (> 0.18 s → 0.14 s)
python3 araclar/kelimeler.py ses-kisa.wav kelimeler.js     # word times (mlx-whisper / faster-whisper / whisper)
python3 araclar/genlik.py ses-kisa.wav agiz.js             # mouth openness per frame
node araclar/kaydet.mjs reel.html reel.mp4 --ses ses-kisa.wav
```

## Video-quality techniques
| Area | What | Where |
|---|---|---|
| **Hook rules** | First sentence = viewer's current situation/loss, or a big *real* number; no news voice, no meta "this video…", no greeting; don't reuse an old hook verbatim — same pattern, bigger promise | `.claude/skills/reels-sistemi/SKILL.md` §1 |
| Word-anchored scenes | `an("word", n)` → frame the word is spoken; n-th occurrence must be counted (common bug: repeated short words) | `araclar/sablon.html` |
| **Mouth envelope** | RMS per frame, normalised to the 95th percentile, floor 0.08, gain 1.1 | `araclar/genlik.py` |
| Breath trimming | Silences > 0.18 s cut to 0.14 s with 6 ms fades | `araclar/kirp.py` |
| Frame 0 | Audio starts at frame 6 so the first frame is never empty | `sablon.html` `ILK`, `kaydet.mjs -itsoffset` |
| Safe zone | Text 90 px from sides, 200 px top, 420 px bottom; min font 34 px | SKILL.md §3 |
| **Post package** | Caption line 1 = hook (visible before "more"), short list, CTA, 3–5 tags, no money promises; first comment repeats keyword + asks a question; cover text inside the middle 1440 px (IG grid crops to 3:4) | SKILL.md §5 |
| QA | One still per sentence; SFX ≥ 12 dB under voice | SKILL.md §4 |

## Free vs paid
Local and free except the voice (own voice or a TTS service such as ElevenLabs).

## Adopt
1. ✅ **Mouth envelope** → [`kit/tools/mouth-envelope.py`](../../kit/tools/mouth-envelope.py).
2. ✅ **Hook wording rules** → [QUALITY-CHECKLIST](../QUALITY-CHECKLIST.md) › Hook & pacing.
3. ✅ **Post package** (hook-first caption, comment prompt, 3:4 cover crop) → QUALITY-CHECKLIST › Publishing.

## Skip
- Playwright-screenshot render: slower and lossier (JPEG per frame) than Remotion.
- `kirp.py` breath trimming: fights documentary pacing that relies on deliberate pauses.
- Comment → DM funnel: only useful when there is a link or product to send.
