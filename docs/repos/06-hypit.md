# hypit — hypit-ai/hypit

> Submodule: [`repos/hypit`](../../repos/hypit) · License: **Modified Apache 2.0** (no multi-tenant SaaS, no commercial redistribution, keep name/logo/copyright in CLI & reports; output belongs to you) · Verdict: ✅ **Adopt ideas; use the tool locally for own work**

## What it is
An agent-driven video authoring system ("a language and system for AI agents to create video", v0.3.1). Give it a reference video; the agent turns it into a **re-runnable workflow** — footage, captions, B-roll and effects **anchored to words instead of seconds**. Generation models are optional: captions, motion graphics and code-rendered visuals can compile into a finished video with no model call.

**Stack:** TypeScript 5.9, Node ≥ 22.15, pnpm monorepo (~85 packages). Not Remotion — its own **HtmlProgram** + Puppeteer/Chrome + FFmpeg (`packages/provider-html-local`). Studio editor on Vite; docs on VitePress. WhisperX as a local Python service; OpenCV/NumPy for image ops.

**Three source languages**
- `.svml` — author source (Script, components, Film)
- `.svs` — style "Recipes" in CSS-like syntax
- `.svrun` — run source: names build targets, reuses earlier results explicitly ("no implicit cache")

**Package layers:** core (`kernel`, `compiler`, `executor`, `runtime`…), time (`temporal`, `narrative-temporal`, `timeline`), script & captions (`script`, `caption`, `caption-fine`, `narrative-caption`), tracks (`visual-track`, `audio-track`, `film`), rendering (`html-program`, `html-video`), components (`ranking`, `comment-sticker`, `depth-stack`, `interview-emoji-reveal`), ~20 providers.

**Pipeline:** analyse reference (`hypit download`/`transcribe`/`media tiles`) → brief & treatment → script with semantic Selections/Moments → (optional, paid) generation → WhisperX alignment → anchors → absolute frame Windows/Instants → Visual/Audio/Caption tracks → Film → HtmlProgram → H.264 → review (snapshots, Studio, Comments).

## How to run
```bash
npx skills add hypit-ai/hypit -g
pnpm install --frozen-lockfile        # dev checkout; ./hypit launcher
hypit runtime use hypit.runtime.json
hypit plan build.svrun && hypit build build.svrun --follow
hypit get <build-id> --output final.video --to output/final.mp4
hypit studio --run runs/render.svrun --runtime ../../hypit.runtime.json
hypit snapshot --studio http://localhost:5191 --start-frame 240 --end-frame-exclusive 270 --step-frames 1 --grid 4x3 --cell 480 --to evidence/x
hypit estimate --text "..." --language en --pace normal
hypit media tiles reference.mp4 --start 8 --end 9 --every-frame --columns 4 --rows 3
```
`examples/complex-explainer/hypit.runtime.json` is **fully local** (only `html.local` + `media.local`).

## Video-quality techniques
| Area | What | Where |
|---|---|---|
| **Semantic timing** | Script marks Selections & Moments; a projection maps them to frames, so **when the VO changes, animations follow**; scenes get named beats `<webscene:Beat name="fail" at={…}/>` | `packages/narrative-temporal/README.md`, `examples/complex-explainer/productions/explainer/CRAFT-NOTES.md`, `.../shared/beats.js` |
| Frame-pure render | every frame from its number (`render(localFrame)`) → parallel workers, exact-frame review | `packages/html-program/README.md` |
| Motion | cubic ease-out, 10–12 frame fades, 12-frame phase cross-fades with `1.035→1` settles; "gentle push" 1.08→1; **"direct the change, not just the entrance"**, keep object identity through changes | `.../web-scenes/src/shared/scene.js`, `.../scenes/comparison/animation.js`, `packages/visual-track/README.md`, `skills/hypit/references/playbooks/craft/motion-graphics.md` |
| **Captions** | karaoke `current`/`trail`, `step`/`wipe`; cue entrance spring 4 frames from 0.75; lead/tail 4 frames that don't shift karaoke timing; `||` cue breaks; keep negation / article+noun / quantity+unit together; Dual Text `<CSS|see ess ess>` (display ≠ spoken); head-tracked placement | `packages/caption-fine/README.md`, `skills/hypit/references/playbooks/craft/captions.md`, `caption-tracking.md` |
| Audio | gain, frame fades, pitch-preserving rate; SFX on semantic Instants; music yields around names/numbers/punchlines; don't repeat an effect on every cut | `packages/audio-track/README.md`, `skills/hypit/references/playbooks/craft/sound-mix.md` |
| **Offline pacing** | CMUdict syllable estimator: EN slow 4.2 / normal 4.6 / fast 5.6 syll/s | `packages/speech-estimate` |
| QA | checklist (performance, coverage, semantic timing, layout, captions, geometry); **one-frame flashes at handoffs**; problem → owning file; frame grids labelled with frame & time; transcript-labelled reference tiles; Studio comments → `FEEDBACK.json`; "done means watched" | `skills/hypit/references/production/review.md`, `snapshots.md`, `studio.md` |
| Formats | ranking-listicle, talking-head, street-interview, two-person-podcast, short-drama, narration-led-demo, presenter-led-explainer | `skills/hypit/references/playbooks/formats/` |

## Free vs paid
**Paid:** hosted (`provider-hypihub`, `-tokendance`, `-pollo`, `-hiapi`, `-beatapi`, `-monid`), models (`seedance`, `gpt-image`, `nano-banana`, `seedream`, `wan`, `pixverse`, `grok-imagine`, `minimax-h3`), voice (`elevenlabs`, `fishaudio`, `mimo`), matting (`volcengine`). **Free/local:** html/media rendering, WhisperX, OpenCV, yt-dlp, browser-capture, fontsource, speech-estimate, Studio, all composition/caption/track packages.

## Adopt
1. **Word-anchored animation events** — named beats in the script, resolved from whisper word times, instead of hard-coded seconds.
2. **Labelled snapshot grids** + the review checklist (incl. one-frame flash check at scene handoffs).
3. **caption-fine parameters** — 4-frame spring at 0.75, lead/tail without timing shift, grouping rules.
4. **Offline duration estimator** to size scenes before TTS.
5. **Event-driven SFX** — one event plan drives both picture and sound.
6. Easing kit: cubic ease-out, 10–12 frame fades, slight overshoot settle.
