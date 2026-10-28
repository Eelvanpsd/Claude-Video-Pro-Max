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
