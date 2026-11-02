# motionmaxxing — Tejashmakwana/motionmaxxing

> Source (vendored): [`repos/motionmaxxing`](../../repos/motionmaxxing) · License: **Apache-2.0** (bundled GSAP is *not*: GreenSock Standard licence) · Verdict: ✅ **Adopt the measured motion numbers, eases and gates; ❌ skip its ElevenLabs sound and image generation**

## What it is
"Looksmaxxing for motion graphics": an agent skill (`SKILL.md` + 13 `references/`) that makes launch films, promos,
stings and kinetic type from plain HTML. It renders frame by frame through headless Chrome → ffmpeg, then **checks the
render with scripts** instead of claiming it looks good. Early release, vendored at `8c8ec0f2` (2026-10-06).

The research behind it: **53 frame-accurate professional motion moments**, decoded by 6 analyst agents (human-reviewed)
into ~150 WHEN / DO / BECAUSE rules, **4,288 measured moves** and **12 fitted eases**, plus a "slop autopsy" of
25 default AI-video patterns. Caveat from its own `docs/KNOWN-LIMITS.md`: the corpus is **3–7 s SaaS launch moments**, so
"motion on ~99 % of frames" describes those clips, not a whole documentary short (whole human films: median luma motion 6.8, IQR 4.4–9.8).

| Folder | What |
|---|---|
| `references/` | `motion.md` (durations, eases, stagger, overshoot), `transitions.md` (cut anatomy, 10+ join types), `type.md`, `sound-sync.md`, `director.md`, `world.md`, `slop.md`, `close.md`, `layout.md` … |
| `runtime/motion.js` | `M.ease.*` (the 12 eases as plain `t → value` functions), seekable timeline, `Motion.selfTest` determinism check |
| `scripts/` | `render.mjs` (CDP → ffmpeg, `--shutter` blur), `look.py` (contact sheet, cuts, frozen runs, end hold, loudness), `lint.mjs` (gate G5), `sync.mjs` (word times → frame table), `mix.py` (−14 LUFS), `blind_review.py`, `precedent.py` |
| `library/moments.jsonl` | the 53 decoded moments (model-decoded, unverified rows) |
| `taste/`, `studies/` | the author's A/B verdicts and edits |

## How to run
```bash
git clone https://github.com/Tejashmakwana/motionmaxxing ~/.claude/skills/motionmaxxing   # as a Claude Code skill
python3 repos/motionmaxxing/scripts/look.py out/001.mp4          # contact sheet + cuts + frozen stretches + end hold + loudness (stdlib + ffmpeg)
node repos/motionmaxxing/scripts/sync.mjs words.json --fps 30 --lead 2 --out beats.json   # our whisper word times → onset frames
python3 repos/motionmaxxing/scripts/precedent.py --help          # "what did pros do at this kind of beat?"
python3 repos/motionmaxxing/scripts/blind_review.py --help       # blind A/B page (useful for the v2/v3 test)
```
Requirements: Node 22+, Python 3, ffmpeg, Chrome. Optional and **paid**: ElevenLabs key (voice/SFX/music), Codex CLI image generation.

## Video-quality techniques (the numbers)
| Area | Measured finding | Where |
|---|---|---|
| **Durations** | Median move **10 f @30 (0.33 s)**. Entries: translate/scale 12 f, opacity 6 f, blur 7 f; exits 13–14 f translate, 10 f scale | `references/motion.md` §1.1–1.2 |
| **Land vs leave** | Landings **decelerate** (58 % ease-out); exits **accelerate** (37 %, scale exits 42 %, blur-outs 63 %), peak speed at t≈0.9 | §1.3 |
| **Move, don't fade** | 3,392 transform entries vs 584 opacity fades; opacity only as a 4–6 f helper | §1.4, R1.6 |
| **Stagger** | Siblings 1–3 f apart, *uneven* gaps (e.g. 3,2,2,2), each move ≈ 2× the gap so tails overlap; whole words 2–5 f (8–12 f voice-led) | §1.5, R1.8 |
| **Overshoot** | < 9 % of moves, **late** (peak t≈0.65–0.70), a slow lean, not a spring. One visible spring per film at most | §1.6, R1.10–1.11 |
| **Arrival** | Decelerate from oversize (logos ≈ 3.5×); **nothing grows from zero** | README, `references/motion.md` |
| **Holds** | Anything held > 3 f keeps one living thing (drift 1–3 px/f, 0.5–1 % scale creep). A designed breath 0.6–1.5 s before a payoff is wanted | R1.12 |
| **12 eases** | `cruise`, `glide`, `softInOut`, `softLand` (text/panels workhorse), `gentleIn`, `snapSettle`, `whip`, `accelExit`, `crashOut`, `popOver` (1.08 at t 0.72), `crashIn` (1.18 at t 0.27, slams), `bounceHard` | `runtime/motion.js`, §2 |
| **Cut anatomy** | A accelerates into the cut → one-frame cut → B's first frame already moving → B continues A's vector. Author A's last 6 f and B's first 6 f together | `references/transitions.md` §1 |
| **Carried object** | Every boundary has one object matched within ~0.02 of frame (position, scale, colour, velocity); keep a handoff table | T2, R2.1 |
| **Effect → next scene** | A's last action (burst, growing disc, wipe band) fills the frame and becomes B's ground; never a white flash | T3, R3.1 |
| **Sound sync** | Text pops **2–5 f ahead** of the spoken word; one VO sentence may run across cuts; content lines 2.5–3 words/s, sign-off 1.2–1.7 | `references/sound-sync.md` |
| **Gates** | G0 render valid · G2 no run of > 3 flat frames · G3 end hold ≤ 1.4 s, last shot ≤ 25 % · G5 no page chrome (`lint.mjs`). G1 readable and G4 one hero are by eye | README › Mog check, `scripts/look.py` |
| Slop tells | Corner labels, counters, held left headline + card, letter-typed headlines, flat swatch per scene, fades everywhere | README, `references/slop.md` |

## Licences
- Original work (SKILL.md, references, scripts, runtime/motion.js …) is **Apache-2.0**: copying with notice is fine.
- **`runtime/vendor/gsap.min.js` is GreenSock's Standard "No Charge" licence, not open source**. Don't copy it into our pipeline (we use Remotion's own interpolation anyway).
  three.js is MIT, Inter font OFL.
- The demo films show third-party brands (Cluely, Spotify, Wispr); the showcase `.mp4`s are not vendored (this repo ignores `*.mp4`), GIFs are.

## Free vs paid
Core is free and local. Voice, SFX and music go through **ElevenLabs (paid, synthetic)**; plates through **Codex image generation (AI images)**.
Both are off-limits in the history pipeline.

## Adopt
1. ✅ **Port the 12 eases to Remotion** (`kit/remotion/eases.ts`: plain `t → value` functions, drop into `interpolate(..., { easing })`).
   Default text/label entries to `softLand` 12 f, exits to `accelExit` 13 f, date slams to `crashIn` 10 f.
2. ✅ **Timing defaults for labels/cards/dates**: entries ≈ 12 f, opacity only a 4–6 f helper, uneven 1–3 f sibling stagger,
   overshoot on < 1 in 8 moves → QUALITY-CHECKLIST › Motion.
3. 🔜 **`look.py` in post-render QA** beside our contact sheet: frozen runs > 3 frames, end hold ≤ 1.4 s, loudness readout.
   Tune for our genre: narrated documentary breathes more than a SaaS sting, so read G2 as a question during deliberate pauses.
4. 🔜 **`sync.mjs`-style lead**: labels/dates pop 2–5 f *before* their spoken word (our captions stay on the word).
5. 💡 Cut anatomy + handoff table for torn-paper wipes: the outgoing scene accelerates into the tear, the incoming one is already moving.
6. 💡 `blind_review.py` for the v2 vs v3 A/B decision, alongside the likes data.

## Skip
- ElevenLabs voice/SFX/music (paid, synthetic). Our voice is Kokoro, SFX are real CC0.
- `imagegen.py` (AI images). Our art is hand-written SVG.
- The bundled GSAP and HTML render path. We render with Remotion.
- "Motion on 99 % of frames" as a target: genre mismatch, as the repo itself warns.
