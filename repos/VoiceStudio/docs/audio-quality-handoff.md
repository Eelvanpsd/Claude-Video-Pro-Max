# Electron audio-quality investigation handoff

Updated 2026-09-28. **The original perceptual regression is not established.**
The owner redirected the work toward normal-to-highest-precision generation
and cloning across supported TTS engines. PR #2406 now includes quality
controls, deterministic export precision, and lossless float transport for
OmniVoice/VoxCPM2 sidecars. See [Audio quality](audio-quality.md) for controls,
engine coverage, and validation. Private recordings remain outside Git.

## Report and sample mapping

WittingMouse reports that the same saved voice sounds more padded/reverberant
after moving from Tauri to Electron. Similarity of saved voice IDs alone does
not establish identical generation requests or processing.

| Supplied file | Reported version | WAV format | Duration | Bytes | Loudness |
| --- | --- | --- | ---: | ---: | ---: |
| `4619c980.wav` | approximately OmniVoice 0.2.7, reporter uncertain | mono 24 kHz, 32-bit float | 7.64 s | 733,520 | -18.5 LUFS |
| `3ff95c1d.wav` | VoiceStudio 0.5.3 | mono 24 kHz, 16-bit PCM | 7.57 s | 363,404 | -19.2 LUFS |
| `voicestudio-43577f3a.wav` | VoiceStudio 0.5.6 | mono 24 kHz, 16-bit PCM | 7.73 s | 371,084 | -18.5 LUFS |

All are uncompressed WAVs. At 24 kHz mono, 16-bit samples carry 384 kbps and
32-bit samples carry 768 kbps, excluding headers. This explains the approximate
file-size ratio, not the reported perceptual difference. In particular, both
0.5.3 and 0.5.6 supplied files are 16-bit. A conversion bug or earlier processing
remains possible; do not dismiss the report or assume that increasing bit depth
is the fix. No controlled listening verdict has been recorded.

## Completed investigations and limits

- Isolated source trees at v0.5.3 (`135ccd09`) and v0.5.6 (`3915a62c`), using
  the same interpreter, installed checkpoint, MPS/float16, reference/transcript,
  seed 42, 16 steps, guidance 2, denoise and model postprocessing enabled,
  produced byte-identical raw waveforms within each language condition.
  This tests source behavior, **not both packaged installers or the reporter's
  original environment**. The reference was the repository UK narrator sample.
- English raw SHA-256: `43dbb2f0513c63514257b3614ed70cfdf2c9c108176316f7897ab6e67e6e299f`.
  Auto/None raw SHA-256: `70c5edf9ff88907aa3cbfe38a8f3c66a9629898cd62196237918dfa2f6743f37`.
  Each contained 98,880 samples. Language conditions differed from each other.
- Legacy Auto omitted `language`, allowing the saved profile language to be
  inherited. Electron sends explicit `Auto`. This is a request-level candidate,
  not an established cause. Do not silently reverse documented Auto semantics.
- The DSP source was unchanged between these tags. The pinned pedalboard
  versions differed (0.9.24 vs 0.9.20); applying the mastering/broadcast chain
  under both versions to the three supplied WAVs yielded identical hashes per
  input on this Mac. This does not exclude other environment differences.
- A separate sidecar PCM round-trip measured 75.92 dB signal-to-error ratio
  and maximum sample error 0.00004977; this was not an end-to-end reproduction.

Checkpoint used throughout:
`k2-fsa/OmniVoice`, revision `c5fdb5ccb189668d56333f77ba2629f4cd7535f4`.

## Supplied isolated bit-depth comparison

One new waveform was generated on MPS, seed 42, 16 steps, explicit English,
guidance 2, denoise and model postprocessing enabled, without a voice reference.
Mastering, broadcast effects, peak normalization to -2 dBFS, and
`mark_synthetic` were applied **once before splitting the exports**.
The same float samples were written using SoundFile `PCM_16` and `FLOAT`.
There was no resampling, independent normalization, or added dither.

Text:

> The morning sunlight filled the quiet room. A gentle breeze moved through
> the trees, while distant voices echoed across the garden. Listen closely
> to the warmth of the voice and the quiet spaces between each word.

| Measurement | Result |
| --- | ---: |
| Channels / sample rate | mono / 24,000 Hz |
| Samples / duration | 315,840 / 13.16 s |
| 16-bit WAV bytes | 631,724 |
| 32-bit float WAV bytes | 1,263,440 |
| Float peak | -1.9838 dBFS |
| Conversion-error RMS | -95.078 dBFS |
| Signal-to-quantization-error ratio | 75.882 dB |
| Maximum absolute sample difference | 0.0000305171 |

The shared pre-export float waveform SHA-256 was
`5b63f4057f1fa0d21bf4db338fa618ef412ed22646b73515f002bed93c3c311e`.
Neither export clipped. These measurements describe numerical differences,
not a listening result or proof that bit depth is irrelevant in every pipeline.

Reproduce export isolation with an existing **provenance-marked float master**
that has not already been quantized to 16-bit. Run in a new output directory:

```python
import numpy as np
import soundfile as sf

samples, sr = sf.read('marked-float-master.wav', dtype='float32')
assert sf.info('marked-float-master.wav').subtype == 'FLOAT'
assert sr == 24000 and samples.ndim == 1
assert np.isfinite(samples).all() and np.max(np.abs(samples)) < 1
sf.write('sample-16bit.wav', samples, sr, subtype='PCM_16')
sf.write('sample-32bit-float.wav', samples, sr, subtype='FLOAT')
a, _ = sf.read('sample-16bit.wav', dtype='float64')
b, _ = sf.read('sample-32bit-float.wav', dtype='float64')
error_rms = np.sqrt(np.mean((b - a) ** 2))
print('error RMS dBFS:', 20 * np.log10(error_rms))
print('signal/error dB:', 20 * np.log10(np.sqrt(np.mean(b ** 2)) / error_rms))
```

Converting the old 16-bit sample to float cannot restore lost information.
Use identical player settings and playback volume; disable automatic loudness
adjustment, EQ, enhancement, and spatial audio for the comparison.

## Supplied higher-quality candidate, not a controlled A/B

A second generation used the same text, seed 42, explicit English, guidance 2,
**32 steps**, denoise and model postprocessing enabled. The preceding float
sample and its text were supplied as the cloning reference to retain a similar
voice. No mastering compressor or broadcast effects were added; processing was
peak normalization and `mark_synthetic` only. Export: mono 24 kHz, 32-bit float,
12.93 seconds, peak -2.0343 dBFS, no clipping.

This changes steps, reference conditioning, and effects together. It cannot
identify which change helps, and no perceptual improvement has been confirmed.
The reference already contains earlier processing; it is not a dry studio source.
Do not ship these settings as a proven fix based on this sample alone.

## Files and code available to the next machine

The supplied archive was checked locally: its six WAVs and two JSON files
match the export measurements above. The archive did not contain the original
voice reference or transcript for the three historical outputs. Its directory
labels include `20260929`; those labels do not establish the experiment date.
The WAVs are **local only**, not attached to this PR. Transfer privately if
needed; obtain permission before publishing any reporter recordings.

- Source Mac Downloads: `VoiceStudio-bit-depth-comparison-20260929/` contains
  `sample-16bit.wav`, `sample-32bit-float.wav`, and `comparison.json`.
- Source Mac Downloads: `VoiceStudio-clean-quality-20260929/` contains
  `clean-32step-float.wav` and `settings.json`.
- Original three supplied WAVs are in that Mac's Downloads folder.
- Temporary one-off generation harnesses on that Mac:
  `/tmp/voicestudio-bit-depth-ab.py` and `/tmp/voicestudio-clean-quality.py`.
  They contain machine-specific paths and are not repository dependencies.
- Separately pushed branch `fix/desktop-packs-audio-quality-polish`, commit
  `30c814a0`, contains `scripts/compare_generation_quality.py`,
  `scripts/compare_release_clone.py`, and the earlier
  `docs/audio-feedback-tasklist.md`. The release-comparison script remains on that branch; the generation-quality
  script is now maintained in this PR.
  Inspect them with `git show 30c814a0:scripts/compare_release_clone.py` after
  fetching that branch. Use an installed checkpoint and offline mode; do not
  assume `/tmp` artifacts or the original developer's cache exist elsewhere.
- Advisory audio-quality warnings from that branch (#2375) are now included.
  They describe signal issues, not voice similarity or perceived quality.

## Next-machine task list and acceptance criteria

1. Obtain original reference WAV/transcript, generated text, model revision,
   seed, exact request payload, effects/export settings, and each installation's
   OS, device and dependency versions. Keep private recordings out of Git.
2. Record matched-level blind listening judgments for the export-only pair.
   If there is a repeatable difference, test the same float master through the
   **actual old and current export paths**, checking clipping, scale, rounding,
   sample-rate/channel metadata, player decoding and intermediary formats.
3. Reproduce with matched inputs in both application environments. Capture raw
   model output, output after each DSP stage, stored WAV, and downloaded/exported
   WAV. Compare explicit English first, then investigate Auto/profile inheritance.
4. For quality tuning, hold reference and seed fixed; change one variable at a
   time: 16 vs 32 steps, effects off/on, denoise off/on, export subtype. Use several
   seeds and voices. Measure intelligibility and ask listeners about similarity,
   naturalness and reverberation; DSP warning counts are not quality scores.
5. Add a fail-before/pass-after regression test at the demonstrated failing
   processing/export seam, then implement the smallest supported fix. Preserve
   `mark_synthetic`, existing voices, local-first behavior and explicit downloads.
6. Validate user-visible behavior on macOS, Windows and Linux. Run model-free
   tests with `HF_HUB_OFFLINE=1` and an empty `HF_HUB_CACHE`; run generation
   experiments separately against explicitly installed checkpoints.

Do not restore removed Tauri build/runtime paths to the maintained repository.
Use isolated historical installations/source trees only for comparison. Do not
close the regression based solely on larger files, fewer warnings, or a single
new generation sounding different.
