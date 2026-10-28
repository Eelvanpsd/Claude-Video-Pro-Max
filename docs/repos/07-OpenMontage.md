# OpenMontage — calesthio/OpenMontage

> Source (vendored): [`repos/OpenMontage`](../../repos/OpenMontage) · License: **AGPLv3** · Verdict: 💡 **Ideas & thresholds — copying code makes your project AGPL**

## What it is
"The first open-source, agentic video production system." No code orchestrator: the AI coding assistant orchestrates, steered by `AGENT_GUIDE.md` (48 KB of routing rules).

| Part | Where |
|---|---|
| **13 pipelines** (animated-explainer, animation, cinematic, documentary-montage, talking-head, clip-factory, screen-demo, podcast-repurpose, localization-dub, hybrid, avatar-spokesperson, character-animation, framework-smoke). Each: research → proposal → script → scene_plan → assets → edit → compose (→ publish), with budget & revision caps | `pipeline_defs/*.yaml` |
| **Stage-director skills** (one per stage per pipeline) + meta (`reviewer`, `checkpoint-protocol`, `taste-direction`, `voice-performance-director`) + creative (`short-form`, `typography`, `sound-design`, `storytelling`) + 91 knowledge packs | `skills/pipelines/*/`, `skills/meta/`, `skills/creative/`, `.agents/skills/` |
| **Tool registry** — Python `BaseTool` subclasses; `discover()`, `support_envelope()`, `provider_menu()`; 7-dimension provider scoring | `tools/`, `tools/tool_registry.py` |
| **Style playbooks** (clean-professional, flat-motion-graphics, minimalist-diagram, premium-minimalist, anime-ghibli): palette, type scale, pacing rules, allowed transitions, music volume, quality rules | `styles/*.yaml` |
| **remotion-composer** — one data-driven `Explainer` composition dispatching on `cut.type` | `remotion-composer/src/Explainer.tsx`, `SCENE_TYPES.md` |
| **Backlot** — live local storyboard board (SSE, watches `projects/`), approval gates, replay | `backlot/` |

## How to run
```bash
git clone https://github.com/calesthio/OpenMontage.git && cd OpenMontage && make setup   # Python 3.10+, FFmpeg, Node 18+
# then prompt your agent: "Make a 60-second animated explainer about how neural networks learn"
python -m backlot open [project-id]
make demo     # zero-key demos
```

## Video-quality techniques
| Area | What | Where |
|---|---|---|
| **Post-render self-review** | (1) ffprobe gate: video + audio stream exist, duration ±5 %, size > 0 · (2) frames at each cut midpoint (`frame_sampler.py`: interval/count/timestamps/scene_guided) · (3) **re-transcribe the render** with faster-whisper: 0 words = silent; < 80 % of script words = truncated; last word must match · (4) structured report | `skills/core/remotion.md` §Post-Render, `skills/pipelines/explainer/compose-director.md` Step 6, `tools/analysis/frame_sampler.py`, `tools/analysis/transcriber.py` |
| Pre-render validator | missing assets, narration longer than video, music shorter than video, overlapping/out-of-order cuts | `tools/analysis/composition_validator.py` |
| Other QA | `volumedetect` at timestamps, caption-occlusion & transition checks; ebur128 "where the music gets interesting" | `tools/analysis/visual_qa.py`, `tools/analysis/audio_energy.py` |
| **Plan scoring** | slideshow-risk (6 dims, 0–5; ≥ 4 fails: repetition, decorative visuals, weak motion, missing `shot_intent`, > 60 % text cards, unsupported cinematic claims); generic-phrase lint; no silent downgrade motion→stills; **every narration cue has a visual landmark within ±1 s** | `lib/slideshow_risk.py`, `lib/variation_checker.py`, `lib/delivery_promise.py`, `lib/verify_scene_pacing.py` |
| Reviewer protocol | critical / suggestion / nitpick / investigation; every critical needs a `proposed_fix`; max 2 revision rounds; captions must not just repeat on-screen text | `skills/meta/reviewer.md` |
| Captions | word pages (default 6 words); active word highlight + glow, past full colour, upcoming 60 % alpha; spring page entrance; `pageBreakAfter` on clause boundaries; limits: vertical 3–4 words / 20 chars, horizontal 6–8 words / 42 chars, 0.5–5 s per cue, end ~200 ms after last word | `remotion-composer/src/components/CaptionOverlay.tsx`, `skills/core/subtitle-sync.md` |
| **Audio** | ducking via `sidechaincompress` (threshold 0.02, ratio 9, attack 200 ms, release 500 ms) then `loudnorm=I=-14..-16:LRA=11:TP=-1.5`; music 18–20 dB under dialogue; whooshes start 10–20 ms *before* the visual, last 400–500 ms | `tools/audio/audio_mixer.py`, `skills/creative/sound-design.md` |
| Pacing & type | hook in first 1–2 s; text on screen within 0.5 s; visual change every 1–3 s; no static hold > 3 s; vertical safe zone 900×1400 centred; 13 chars/s dwell; easeOutCubic, no linear; 4–6 s per scene; charts ≥ 4 s | `skills/creative/short-form.md`, `skills/creative/typography.md`, `skills/core/remotion.md` |

## Free vs paid
**Free/local:** Piper TTS, faster-whisper/WhisperX, FFmpeg, Remotion, HyperFrames, Archive.org/NASA/Wikimedia footage, Pexels/Pixabay/Unsplash (free keys), local GPU video models (Wan, LTX, CogVideo), Backlot. **Paid:** fal, Atlas, Kling, Veo/Sora/Runway/Seedance, Suno, ElevenLabs, OpenAI/Google TTS & images, HeyGen avatars.

## Adopt (re-implement; AGPL)
1. **Post-render QA**: ffprobe gate + midpoint frames + whisper re-transcription vs script (≥ 80 % coverage, last-word match) + volumedetect.
2. **Cue ↔ visual-landmark assertion** (±1 s) against whisper word times.
3. **Pre-render props validator**.
4. **One-pass ducking + loudnorm −14 LUFS / TP −1.5**.
5. **Word-highlight caption pages** with clause breaks.
6. **Slideshow-risk lint** on the scene plan (`shot_intent` per scene, cap text cards).
7. **Style playbook YAML** — `styles/minimalist-diagram.yaml` (SVG path draw-in) is the closest to an SVG look.
8. **Reviewer format** with mandatory proposed fix, 2-round cap.
