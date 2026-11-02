# Comparison matrix

| | hyperframes | onetake | gbro-collage-broll | ClaudeAnimationBase | lemo-opuscar | hypit | OpenMontage |
|---|---|---|---|---|---|---|---|
| **Author** | heygen-com | feitangyuan | pyang5166 | JohnHeibel | lemomo-ai | hypit-ai | calesthio |
| **License** | Apache 2.0 | PolyForm NC 1.0 | MIT | MIT | MIT | Modified Apache 2.0 | AGPLv3 |
| **Copy code into a monetised project?** | ✅ (keep notice) | ❌ | ✅ | ✅ | ✅ | ⚠️ own use OK, no SaaS / resale | ⚠️ only if your project becomes AGPL |
| **Render engine** | HTML + Puppeteer + FFmpeg | HTML + Playwright | Gemini video (paid) | p5.js + Puppeteer | Canvas2D / three.js + Playwright | HtmlProgram + Puppeteer | Remotion / HyperFrames / FFmpeg |
| **Language** | TS (Bun) | JS + Python | Python | JS | JS + Python | TS (pnpm) | Python + TS |
| **Fully free / local?** | ✅ (HeyGen optional) | ✅ | ❌ | ✅ | ✅ | ✅ core; providers paid | ✅ core; providers paid |
| **Agent skill included** | 21 skills | SKILL.md | SKILL.md | ANIMATION_GUIDE.md | Claude plugin | skill + ~60 refs | AGENT_GUIDE + stage directors |
| **Transitions** | ⭐⭐⭐ 14 GLSL + CSS catalog | ⭐⭐ iris, zoomThrough, whip | ⭐ snap-in assembly | ⭐⭐ brushWipe, iris | ⭐⭐ J/L-cuts, post passes | ⭐ fades | ⭐ cross-fades |
| **Motion** | ⭐⭐⭐ 48 rules, 22 blueprints | ⭐⭐⭐ move library, real motion blur | ⭐ | ⭐⭐⭐ springs, boil, principles | ⭐⭐⭐ 43 styles, stroke engine | ⭐⭐ semantic beats | ⭐⭐ scene types |
| **Captions** | ⭐⭐⭐ 20+ components + QA | ⭐ | – | – (no text) | ⭐⭐ readcheck | ⭐⭐⭐ caption-fine | ⭐⭐ word pages |
| **Audio** | ⭐⭐⭐ voice-band carve | ⭐⭐ synth SFX palette | – | – | ⭐⭐⭐ two-pass loudnorm, samplers | ⭐⭐ event SFX | ⭐⭐⭐ sidechain + loudnorm |
| **QA / self-review** | ⭐⭐ lint, animation-map | ⭐⭐⭐ measured verify legs | ⭐⭐ contact sheets | ⭐⭐⭐ sheet/strip/crop | ⭐⭐⭐ readcheck, ASR, cuecheck | ⭐⭐⭐ labelled grids, checklist | ⭐⭐⭐ post-render + plan lint |
| **Best single takeaway** | Shader transitions | Shutter motion blur + measured QA | Approval gates | Boil + review loop | Mastering + reading-time gate | Word-anchored timing | Post-render whisper check |

## Fit for a "Remotion + hand-written SVG, no paid APIs, no AI images" pipeline

1. **lemo-opuscar** — MIT, fully local, whiteboard stroke engine, mastering, ASR round-trip.
2. **ClaudeAnimationBase** — MIT, hand-drawn doctrine, boil, review loop.
3. **hyperframes** — Apache, biggest transition/caption/component library to port.
4. **hypit** — semantic (word-anchored) timing and caption craft.
5. **OpenMontage** — QA thresholds and production checklists (ideas only, AGPL).
6. **onetake** — motion blur and measured QA (ideas only, non-commercial).
7. **gbro-collage-broll** — paid core; workflow ideas only.
8. **reels-sistemi** (MIT, not in the matrix — small skill) — hook rules, post package, mouth envelope; engine skipped.
9. **openverse** — CC0 sound-effect sourcing through the public API (step before any SFX work).
10. **earshot** — measured listening: realness, match, sync timeline, sound sheet (synthesis side skipped).
11. **real-sfx** — placement, level and verification rules for real library SFX (library mode only).
12. **VoiceStudio** — voice-side ideas (room-tone pauses, forced word alignment, signal checks); default engine non-commercial.
13. **mlx-audio** — the library our Kokoro narration already runs on; adds TTS word timestamps, forced alignment, VAD.
14. **chatterbox** — expressive cloning TTS with delivery controls; benchmark only (watermarked, no preset voices).
15. **motionmaxxing** — measured motion numbers, 12 eases, cut anatomy and render gates (sound/imagegen side skipped).

## Sound repos (9–11)

| | openverse | earshot | real-sfx |
|---|---|---|---|
| **Author** | WordPress | Leon Lin | Alexander Korbanov (Clipwing) |
| **License** | MIT (media: own CC licences) | MIT | MIT scripts; uisfx sounds CC0 |
| **Role** | Find & license-check recordings | Listen / measure / critique | Place, level, mix, verify |
| **Language** | Python (Django) + Vue | Python (torch, CLAP, AST) | Python + ffmpeg |
| **Fully free / local?** | ✅ hosted API, free key optional | ✅ CPU (Gemini `llm` optional, paid) | ✅ |
| **Agent skill included** | – | `skills/earshot`, `skills/real-sound` + MCP | SKILL.md + 7 references |
| **Synthesis?** | none | ⚠️ `forge`/`sfx`/`kit` make sound in code | ⚠️ bundled uisfx is synthesized (opt-out `--ui library`) |
| **Best single takeaway** | `license=cc0` at the source + attribution manifest | `realness` + `timeline --cues` sync proof | Audible-start placement + voice-safe + mono check |

## Voice repos (12–14)

| | VoiceStudio | mlx-audio | chatterbox |
|---|---|---|---|
| **Author** | Palash Debnath (debpalash) / Yupcha Softwares | Prince Canuma (Blaizzy) | Resemble AI |
| **License** | AGPL-3.0 app; `omnivoice/` Apache-2.0; default weights CC-BY-NC | MIT; models own licences (Kokoro Apache-2.0) | MIT code; model cards own terms |
| **Role** | Generate / clone / design / dub voices; transcribe with word timing | Runtime library: TTS, STT, alignment, VAD, enhancement | TTS + voice conversion models (Turbo, Nano, Multilingual V3) |
| **Language** | Python (FastAPI, uv) + TypeScript (Electron, Bun) | Python (MLX) + Swift sibling | Python (PyTorch, Gradio demos) |
| **Fully free / local?** | ✅ CPU/MPS/CUDA; paid commercial licence only for closed-source embedding | ✅ Apple Silicon only | ✅ CUDA/CPU/MPS (also via mlx-audio) |
| **Agent skill included** | `skills/` (voicestudio, voicestudio-maintainer) + MCP at `/mcp` | – (CLI, Python API, OpenAI-compatible server) | – (examples + Gradio apps) |
| **Synthesis?** | Voice is TTS by design (our narration already is: Kokoro); no SFX synthesis | TTS by design (Kokoro = our narrator); music generation available but off-limits | TTS by design; Perth watermark on every output |
| **Best single takeaway** | Room-tone pause fill + WhisperX ±10–30 ms word alignment | Kokoro `start_ts`/`end_ts`: word times straight from the TTS | `exaggeration` ↔ `cfg_weight` pacing trade-off; watermark detector for QA |

## Motion repo (15)

| | motionmaxxing |
|---|---|
| **Author** | Tejas Makwana |
| **License** | Apache-2.0 (bundled GSAP: GreenSock Standard licence; three.js MIT) |
| **Render engine** | HTML + headless Chrome (CDP) + ffmpeg |
| **Language** | JS (Node 22) + Python (stdlib) |
| **Fully free / local?** | ✅ core; ElevenLabs sound and Codex imagegen paid/optional |
| **Agent skill included** | SKILL.md + 13 references + taste layer |
| **Motion** | ⭐⭐⭐ 4,288 measured moves, 12 fitted eases, stagger/overshoot stats |
| **Transitions** | ⭐⭐⭐ cut anatomy, carried-object match cuts, effect-becomes-scene |
| **QA / self-review** | ⭐⭐⭐ look.py (G0/G2/G3), lint.mjs (G5), blind review page |
| **Best single takeaway** | Land decelerates (softLand ~12 f), leave accelerates (accelExit ~13 f); move, don't fade |
