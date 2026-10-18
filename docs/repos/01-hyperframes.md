# hyperframes — heygen-com/hyperframes

> Submodule: [`repos/hyperframes`](../../repos/hyperframes) · License: **Apache 2.0** · Verdict: ✅ **Adopt (code allowed with notice)**

## What it is
An open-source framework that turns **HTML + CSS + media + seekable animations into deterministic MP4s**. "Inspired by Remotion", but uses plain HTML with `data-*` timing attributes instead of React. Bun monorepo (`packages/`: `cli`, `core`, `engine`, `producer`, `studio`, `player`, `shader-transitions`, `lint`, `inspector`, `aws-lambda`, …). Headless Chrome (Puppeteer) seeks each frame; FFmpeg encodes. Animation adapters: GSAP (default), CSS, WAAPI, Lottie, Three.js, Anime.js, TypeGPU. Ships 21 agent skills (`skills/`) and a large block/component registry (`registry/`).

## How to run
```bash
npx hyperframes init my-video        # Node 22+, FFmpeg
npx hyperframes preview
npx hyperframes render --quality draft|looks|delivery
npx hyperframes add flash-through-white   # pull a catalog block
# agent dev loop (skills/hyperframes-cli/SKILL.md)
npx hyperframes lint && npx hyperframes check --snapshots && npx hyperframes snapshot --at 1.2,3.4
```

## Video-quality techniques
| Area | What | Where |
|---|---|---|
| Shader transitions | domain-warp, ridged-burn, whip-pan, sdf-iris, ripple-waves, gravitational-lens, cinematic-zoom, chromatic-split, glitch, swirl-vortex, thermal-distortion, flash-through-white, cross-warp-morph, light-leak | `packages/shader-transitions/src/shaders/registry.ts` |
| Transition grammar | Every composition uses transitions; every scene has entrances; **no exit animations except final scene — "the transition IS the exit"** | `skills/hyperframes-animation/transitions/overview.md`, `catalog.md` |
| Motion rules | 48 atomic rules (svg-path-draw, spring-pop-entrance, kinetic-beat-slam, depth-of-field-blur…) + 22 blueprints | `skills/hyperframes-animation/rules/`, `blueprints/` |
| Motion blur | Blur only snaps/whips/slams, 1–3 per piece, never on text being read | `skills/hyperframes-animation/references/motion-blur.md` |
| Hand-drawn look | `hw-boil` (seeded, quantised-time line boil), `stop-motion-cadence` (`floor(t*fps)/fps`), `svg-stroke-trace`, `grain-overlay`, `paper-collage-reveal`, `torn-paper-rip`, `ink-bleed-reveal`, `beat-accent`, 20+ `caption-*` | `registry/components/*` |
| Captions | Local transcription + subject matting (u2net_human_seg); QA: `check-timing.cjs` (drift tolerance 0.08 s), `check-occlusion.cjs`, `check-overflow.cjs`, `safe-zones.cjs` | `skills/embedded-captions/` |
| Audio | **Voice-band carve**: dip the music bed only in the frequency bands the voice occupies; FX chains via `data-fx-chain`; ducking | `skills/hyperframes-audio/scripts/carve.mjs`, `skills/media-use/scripts/audio-duck.mjs` |
| QA | Lint rules (captions, fonts, gsap, media); `animation-map.mjs` finds dead zones & stagger problems; `hyperframes keyframes` | `packages/lint/src/rules/*`, `skills/hyperframes-animation/scripts/animation-map.mjs` |

## Free vs paid
Engine, CLI, lint, registry: **free/local**. `skills/media-use` can route BGM/SFX/images/voices through the HeyGen CLI (free OAuth allowance; an API key bills credits). Local fallbacks: Kokoro TTS (`npx hyperframes tts`, 54 voices), Whisper, 19 bundled SFX.

## Adopt in a Remotion + SVG pipeline
1. **Port GLSL transitions** (sdf-iris, light-leak, whip-pan) to a Remotion `TransitionPresentation` using a WebGL canvas.
2. **Boil / stepped time** — seeded hash of `floor(frame/N)` maps 1:1 onto `useCurrentFrame()` → done in [`kit/remotion/LineBoil.tsx`](../../kit/remotion/LineBoil.tsx).
3. **Transition grammar as lint rules** for scene plans.
4. **Voice-band carve** for the music bed instead of broadband ducking.
5. **Caption QA** scripts (timing drift, overflow, safe zones).
