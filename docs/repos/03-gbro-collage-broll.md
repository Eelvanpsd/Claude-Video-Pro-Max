# gbro-collage-broll — pyang5166/gbro-collage-broll

> Submodule: [`repos/gbro-collage-broll`](../../repos/gbro-collage-broll) · License: **MIT** · Verdict: ❌ **Core rejected** (needs paid Gemini video + AI image generation) — workflow & ffmpeg QA reusable

## What it is
A Codex/agent skill (`SKILL.md`, documented in Chinese) that turns a ~5 s voiceover line into a **halftone paper-collage "assemble-from-empty" B-roll** clip (9:16, 720×1280, 24 fps, silent) through three approval gates:
1. **Gate 1** – visual metaphor only (no generation)
2. **Gate 2** – a still from Codex `image_gen` + contact sheet
3. **Gate 3** – first/last-frame video interpolation with `gemini-omni-flash-preview` (`scripts/generate_video.py`, google-genai SDK)

## How to run
```bash
git clone https://github.com/pyang5166/gbro-collage-broll ~/.agents/skills/gbro-collage-broll
bash scripts/check_setup.sh
~/hyperframes-projects/.omni-venv/bin/python scripts/generate_video.py --batch omni-jobs.json --concurrency 3   # needs GEMINI_API_KEY (billed)
```

## Video-quality techniques
| Area | What | Where |
|---|---|---|
| Visual spec | JSON: style signature, colour field with semantic colour mapping, 3–6 separable paper groups, avoid list (no text/logos/UI) | `SKILL.md` Phase 2 |
| Assembly grammar | structure → subject/cards → connectors → action → result; pieces slide & snap in, no slow zoom/fade | `SKILL.md` |
| Colour semantics | e.g. orange/red = urgency, deep purple = memory | `SKILL.md` 色彩规则 |
| ffmpeg QA | empty first frame is solid colour (`color=c=0xHEX`); per-second contact sheet `fps=1,scale=270:480,tile=5x1`; end-frame vs approved still; strip audio `-an` | `SKILL.md` 视频 QA |
| Evals | 4 tests of gate behaviour | `evals/evals.json` |

## Free vs paid
**The core is paid AI** (`GEMINI_API_KEY`, Codex `image_gen`; legacy Veo script `scripts/generate_veo_first_last.py`). Only the ffmpeg QA and the gating workflow are free.

## Adopt
1. **Staged approval gates** (metaphor → still → motion) before expensive renders; in Remotion the "still" is `npx remotion still`.
2. **Visual-spec JSON** as a per-scene SVG brief.
3. **Assemble-from-empty** grammar + halftone/keyline/soft-shadow paper look rebuilt as SVG filters.
4. **Contact-sheet + end-frame QA** → see [`kit/tools/contact-sheet.mjs`](../../kit/tools/contact-sheet.mjs).
5. **Colour-field semantics** per scene mood.
