# Claude Video Pro Max

**A curated, annotated collection of eight open-source repos for raising AI-made video quality — plus a small kit of ready-to-use Remotion pieces distilled from them.**

Built while upgrading a production pipeline of vertical history shorts (Remotion 4 + hand-written SVG art + local Kokoro narration, no paid APIs, no AI images). Every repo here was cloned, read and judged for that kind of pipeline: what it is, how to run it, which techniques actually move quality, what is free vs paid, and what its license lets you do.

```bash
git clone https://github.com/Eelvanpsd/Claude-Video-Pro-Max.git   # everything included, no submodules
```

---

## The eight repos

| # | Repo | What it is | License | Free/local | Verdict | Deep dive |
|---|---|---|---|---|---|---|
| 1 | [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) | HTML → deterministic MP4 framework; 14 GLSL shader transitions, 48 motion rules, huge component registry | Apache 2.0 | ✅ | ✅ Adopt | [docs](docs/repos/01-hyperframes.md) |
| 2 | [feitangyuan/onetake](https://github.com/feitangyuan/onetake) | "One continuous take" promo-film skill; real shutter motion blur, measured QA | PolyForm Noncommercial | ✅ | 💡 Ideas only | [docs](docs/repos/02-onetake.md) |
| 3 | [pyang5166/gbro-collage-broll](https://github.com/pyang5166/gbro-collage-broll) | Paper-collage B-roll skill with three approval gates | MIT | ❌ Gemini + image_gen | ❌ Core rejected | [docs](docs/repos/03-gbro-collage-broll.md) |
| 4 | [JohnHeibel/ClaudeAnimationBase](https://github.com/JohnHeibel/ClaudeAnimationBase) | Hand-painted p5.js character animation kit + 461-line animation guide | MIT | ✅ | ✅ Adopt | [docs](docs/repos/04-ClaudeAnimationBase.md) |
| 5 | [lemomo-ai/lemo-opuscar](https://github.com/lemomo-ai/lemo-opuscar) | 43 code-made film styles, director/technique guides, mastering, ASR checks | MIT | ✅ | ✅ Adopt (best fit) | [docs](docs/repos/05-lemo-opuscar.md) |
| 6 | [hypit-ai/hypit](https://github.com/hypit-ai/hypit) | Agent video language: timing anchored to words, caption craft, labelled review grids | Modified Apache 2.0 | ✅ core | ✅ Adopt ideas | [docs](docs/repos/06-hypit.md) |
| 7 | [calesthio/OpenMontage](https://github.com/calesthio/OpenMontage) | Agentic production system: 13 pipelines, stage-director skills, post-render self-review | AGPLv3 | ✅ core | 💡 Ideas & thresholds | [docs](docs/repos/07-OpenMontage.md) |
| 8 | [yapaytu/reels-sistemi](https://github.com/yapaytu/reels-sistemi) | Small Turkish Reels skill: hook rules, word-anchored HTML scenes, mouth envelope, post caption/first comment | MIT | ✅ (voice aside) | 💡 Ideas only | [docs](docs/repos/08-reels-sistemi.md) |

Each repo is included **in full** under [`repos/`](repos) — a copy of the commit that was reviewed, with its own license intact. Upstream URLs and commits: [`repos/SOURCES.md`](repos/SOURCES.md).

## What's in here

```
repos/                    8 vendored repos (original code, original licenses) + SOURCES.md
docs/repos/01…08-*.md     per-repo deep dive: architecture, run commands, techniques with file paths, free vs paid, what to adopt
docs/COMPARISON.md        side-by-side matrix: license, engine, transitions, motion, captions, audio, QA
docs/ROADMAP.md           16 ideas ranked by quality gain per hour, with status
docs/QUALITY-CHECKLIST.md pre-delivery gate: every concrete number from all eight repos in one list
kit/                      MIT, standalone Remotion pieces + QA tool built from the ideas
```

## The kit

| | |
|---|---|
| [`kit/remotion/LineBoil.tsx`](kit/remotion/LineBoil.tsx) | Hand-drawn line boil — re-seeded turbulence every 3 frames, per-layer seeds |
| [`kit/remotion/PaperTear.tsx`](kit/remotion/PaperTear.tsx) | Torn-paper wipe for `@remotion/transitions` with fibrous rim and cast shadow |
| [`kit/remotion/SlamStamp.tsx`](kit/remotion/SlamStamp.tsx) | Dates/numbers that slam in like a seal: 2.4× → 1× in 0.1 s, bounce, jolt, tilt |
| [`kit/tools/contact-sheet.mjs`](kit/tools/contact-sheet.mjs) | Whole-video contact sheet or per-frame strip of a range, via ffmpeg |
| [`kit/tools/mouth-envelope.py`](kit/tools/mouth-envelope.py) | Per-frame mouth openness (0–1) from a voice file for talking characters |

```tsx
import { LineBoil } from "./kit/remotion/LineBoil";
import { paperTear } from "./kit/remotion/PaperTear";
import { SlamStamp } from "./kit/remotion/SlamStamp";

<svg viewBox="0 0 1080 1920"><LineBoil id="boil-king" seed={2}><King /></LineBoil></svg>
<TransitionSeries.Transition presentation={paperTear({ width: 1080, height: 1920, rim: true })} timing={linearTiming({ durationInFrames: 18 })} />
<SlamStamp from={4.2} style={{ fontSize: 150 }}>1453</SlamStamp>
```
```bash
node kit/tools/contact-sheet.mjs out/video.mp4 --every 1.5      # whole video
node kit/tools/contact-sheet.mjs out/video.mp4 --strip 12:12.8  # every frame of a transition
```

## Top 10 takeaways

1. **Tie every visual to a spoken word**, not to seconds — resolve named beats from whisper word times *(hypit, OpenMontage ±1 s rule, lemo cuecheck)*.
2. **Re-transcribe your final render** and compare to the script — catches silent or cut-off audio *(OpenMontage, lemo-opuscar)*.
3. **Master to −14 LUFS with two-pass loudnorm**, TP ≤ −1.5 dBTP *(lemo-opuscar, OpenMontage)*.
4. **Look at your video as a contact sheet** before calling it done *(ClaudeAnimationBase, hypit, gbro)*.
5. **The transition is the exit** — every scene enters, nothing fades out before a cut *(hyperframes)*.
6. **Something carries across every cut** *(onetake)*.
7. **Rest is required** — ≥ 25 % still frames and one quiet second beat constant motion *(onetake, lemo DIRECTOR)*.
8. **Hand-made feel = boil + imperfect edges**, on figures only, never on text *(ClaudeAnimationBase, hyperframes)*.
9. **Text must be readable**: ≥ chars ÷ 15 + 1.5 s on screen, inside the safe zone *(lemo readcheck, OpenMontage)*.
10. **Motion blur only where things snap**, never on text being read *(hyperframes, onetake)*.

## Licensing

- Code under `repos/` belongs to its authors and stays under **its own license** (see table). It is redistributed unmodified with each repo's own LICENSE; nothing is relicensed.
- **onetake** is non-commercial and **OpenMontage** is AGPLv3 — the kit re-implements *ideas* from them, it does not copy their code.
- **hypit**: own-organisation use is fine; no multi-tenant SaaS or commercial redistribution; keep its name/logo in its CLI and reports.
- Everything else in this repo (`docs/`, `kit/`, this README) is **MIT** — see [`LICENSE`](LICENSE).

---

### Türkçe özet

Video kalitesini yükseltmek için incelenen 8 açık kaynak repo: hepsinin tam içeriği `repos/` altında (kaynak ve commit listesi `repos/SOURCES.md`). Her biri için `docs/repos/` içinde detaylı analiz var (ne işe yarar, nasıl çalıştırılır, hangi teknikler kaliteyi artırır, ücretsiz mi ücretli mi, lisansı neye izin verir). `kit/` klasöründe bu repolardan çıkarılan, doğrudan kullanılabilir Remotion parçaları (çizgi titremesi, yırtık kâğıt geçişi, tarih "slam" efekti) ve ffmpeg kontrol aracı var. `docs/ROADMAP.md` sıradaki iyileştirmeleri, `docs/QUALITY-CHECKLIST.md` yayın öncesi kontrol listesini içeriyor.
