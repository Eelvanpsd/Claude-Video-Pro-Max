# Quality checklist — numbers collected from all eight repos

Use as a pre-delivery gate. Source in brackets.

## Hook & pacing
- [ ] Hook in the first 1–2 s; text on screen within 0.5 s *(OpenMontage short-form)*
- [ ] Hook names the viewer's stake/loss or a big **real** number; no news voice, no "in this video…", no greeting; never reuse an old hook verbatim *(reels-sistemi)*
- [ ] Frame 0 is never empty — audio may start a few frames late *(reels-sistemi)*
- [ ] A visual change every 1–3 s; no static hold > 3 s *(OpenMontage)*
- [ ] …but rests exist: ≥ 25 % dead-still frames and one ≥ 1 s quiet stretch *(onetake)* — balance the two
- [ ] Shot lengths vary: coefficient of variation ≥ 0.25, no metronome cuts *(onetake)*
- [ ] ≥ 2 silences, ≥ 4 camera moves *(lemo-opuscar DIRECTOR)*
- [ ] "Fast actions, slow meanings"; one read at a time *(ClaudeAnimationBase)*
- [ ] Every narration cue has a visual landmark within ±1 s *(OpenMontage)*; target 0 ms *(lemo cuecheck)*

## Motion & transitions
- [ ] Every scene has an entrance; the transition is the exit *(hyperframes)*
- [ ] Something carries across each scene boundary *(onetake)*
- [ ] easeOutCubic for entrances; never linear *(OpenMontage, hypit)*
- [ ] No one-frame flashes at handoffs *(hypit review)*
- [ ] Motion blur only on snaps/whips/slams, 1–3 per piece, never on text being read *(hyperframes)*; > 80 px/frame needs blur *(onetake)*
- [ ] Seeded, deterministic randomness *(onetake, ClaudeAnimationBase)*

## Text & captions
- [ ] Vertical: 3–4 words / ≤ 20 chars per cue; horizontal 6–8 words / ≤ 42 chars *(OpenMontage)*
- [ ] Cue 0.5–5 s, ends ~200 ms after its last word *(OpenMontage)*
- [ ] Reading time ≥ Latin chars ÷ 15 + 1.5 s (CJK ÷ 4.5) *(lemo readcheck)*; ≥ max(1.8 s, speech + 0.6 s) *(lemo DIRECTOR)*
- [ ] Keep negation, article+noun, quantity+unit together *(hypit)*
- [ ] Vertical safe zone ≈ 900×1400 centred *(OpenMontage typography)*
- [ ] Captions do not just repeat on-screen text *(OpenMontage reviewer)*
- [ ] Caption timing drift ≤ 0.08 s *(hyperframes check-timing)*

## Audio
- [ ] Integrated loudness −14 LUFS for social (two-pass), true peak ≤ −1.2…−1.5 dBTP *(lemo-opuscar, OpenMontage)*
- [ ] Music 18–20 dB under dialogue; ducks around names/numbers/punchlines *(OpenMontage, hypit)*
- [ ] Whoosh starts 10–20 ms *before* the visual, 400–500 ms long *(OpenMontage)*
- [ ] Don't repeat the same effect on every cut *(hypit)*
- [ ] No clipping; SFX peaks ≈ −8 dBFS *(onetake)*

## Publishing
- [ ] Caption line 1 = the hook (it is what shows before "more"); then title, a comment prompt, 3–5 tags; no money/earnings promises *(reels-sistemi)*
- [ ] Cover: hook text + subject inside the middle 1440 px — the IG profile grid crops to 3:4 *(reels-sistemi)*
- [ ] First comment repeats the keyword and asks a question *(reels-sistemi)*

## Post-render verification
- [ ] ffprobe: video + audio streams, duration within ±5 %, size > 0 *(OpenMontage)*
- [ ] Re-transcribe the final mix: ≥ 80 % script words, last word matches *(OpenMontage, lemo asr_check)*
- [ ] blackdetect + ebur128 on the master *(lemo DIRECTOR)*
- [ ] Contact sheet of the whole video + per-frame strips of each transition *(ClaudeAnimationBase, kit/tools/contact-sheet.mjs)*
- [ ] "Done means watched" — watch it once end to end *(hypit)*
