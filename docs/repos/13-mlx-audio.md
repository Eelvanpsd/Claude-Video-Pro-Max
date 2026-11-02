# mlx-audio — Blaizzy/mlx-audio

> Source (vendored): [`repos/mlx-audio`](../../repos/mlx-audio) · License: **MIT** (code; each model keeps its own licence) · Verdict: ✅ **Adopt: already our narration runtime. Upgrade it and use more of it**

## What it is
Apple's MLX framework applied to audio, by Prince Canuma (v0.6.3 at the vendored commit `65b6a39b`, 2026-11-01).
It is one Python package with a CLI, a Python API, an OpenAI-compatible server (+ web UI), quantisation/conversion,
and a Swift sibling (`mlx-audio-swift`). It covers:

- **TTS (~30 models):** Kokoro-82M (54 voices, the one we use), KittenTTS, Qwen3-TTS (voice design), OmniVoice,
  VoxCPM2 (48 kHz), Chatterbox, CSM, Dia, Spark, Soprano, MeloTTS, Voxtral TTS, Higgs Audio, Fish Drama 3, Ming, MOSS-TTS …
- **STT (~30):** Whisper (large-v3-turbo), Parakeet, Qwen3-ASR, **Qwen3-ForcedAligner** (word alignment), Voxtral,
  Nemotron, VibeVoice-ASR, Canary, Moonshine, MMS, Granite …
- **VAD / diarization:** Silero VAD, Sortformer, Nemotron diarization, Smart Turn.
- **Speech-to-speech:** DeepFilterNet 1/2/3, MossFormer2 SE (48 kHz), NemotronLabs RE-USE (restoration), SAM-Audio
  (text-guided source separation), DialogueSidon, Mel-RoFormer.
- **Music:** MiniMax Music 3 (generative; not for us).

**Already in our pipeline:** `HistoryAnimation/.venv-tts` has `mlx-audio 0.5.8`. `tools/kokoro_tts.py` calls
`load_model("mlx-community/Kokoro-82M-bf16")` → `model.generate(text, voice="am_michael", speed, lang_code="a")`.
`.venv-align` uses the separate `mlx-whisper` package.

## How to run
```bash
pip install -U mlx-audio misaki[en]                   # Apple Silicon, Python ≥ 3.10; ffmpeg only for non-WAV output
mlx_audio.tts.generate --model mlx-community/Kokoro-82M-bf16 --voice am_michael --lang_code a --speed 1.0 \
    --text $'First sentence.\nSecond sentence.' --join_audio --output_path out/
# word alignment of our own narration against the script (no transcription errors possible)
mlx_audio.stt.generate --model mlx-community/Qwen3-ForcedAligner-0.6B-8bit --audio narration.wav --text "$(cat script.txt)" --output-path out/
# speech regions → measured pauses
python -c 'from mlx_audio.vad import load; print(load("mlx-community/silero-vad").get_speech_timestamps("narration.wav", return_seconds=True))'
mlx_audio.server --port 8000                         # POST /v1/audio/speech, /v1/audio/transcriptions (OpenAI format)
```

## Video-quality techniques
| Area | What | Where |
|---|---|---|
| **Free word timings from TTS** | Kokoro's pipeline turns the model's predicted phoneme durations into per-token `start_ts` / `end_ts` (frames ÷ 40 → s). We get word times for every sentence **without running Whisper at all**, exact to the audio we generated | `mlx_audio/tts/models/kokoro/pipeline.py` (`join_timestamps`) |
| **Forced alignment** | Qwen3-ForcedAligner aligns a *known* script to audio word by word. Better than ASR timestamps for narration, because the words are given | `mlx_audio/stt/models/qwen3_asr/README.md` |
| **Silero VAD** | Speech/non-speech timestamps. Measure real pause lengths (tiered 0.7 s+ pauses) and trim leading/trailing silence | `mlx_audio/vad/models/silero_vad/`, `docs/models/vad/index.md` |
| Speech enhancement | DeepFilterNet / MossFormer2 (48 kHz) noise suppression; useful to clean *real* recorded SFX before use, not the TTS voice | `mlx_audio/sts/models/deepfilternet`, `mossformer2_se` |
| Source separation | SAM-Audio extracts a described sound from a recording (e.g. isolate a page turn from a noisy CC0 take) | `mlx_audio/sts/models/sam_audio` |
| Quantised Kokoro | 8/6/4-bit and MXFP4 variants; `python -m mlx_audio.convert` | README › Quantization |
| `--join_audio` / streaming | One file from multi-line text instead of `audio_000.wav…`; stream while generating | README › Quick Start |
| OpenAI-compatible server | Keep models warm for batch re-voicing of all 64 scripts | `mlx_audio/server.py` |

## Licences
- Library code: **MIT**.
- Models keep their own terms: **Kokoro-82M is Apache-2.0** (fine for monetised videos). Check every other model card
  before publishing its output. Several are non-commercial (e.g. OmniVoice weights CC-BY-NC, see [12-VoiceStudio](12-VoiceStudio.md)).
- MiniMax Music 3 and the TTS voice cloners generate content: music generation and AI voice clones are outside the house rules.

## Free vs paid
Entirely free and local on Apple Silicon. Models download once from Hugging Face.

## Adopt
1. ✅ **Upgrade `.venv-tts` 0.5.8 → 0.6.x**, then re-render one known video and diff the waveform/duration before re-voicing everything.
   Same model and voice, so the sound should not change. Verify that, don't assume it.
2. 🔜 **Use Kokoro's own `start_ts`/`end_ts`** as the primary word clock for captions and word-synced visuals.
   Keep the mlx-whisper alignment as a cross-check (flag words that disagree by > 1 frame).
3. 💡 **Qwen3-ForcedAligner** as the second opinion when the two disagree: it aligns the known script, so no misheard words.
4. 💡 **Silero VAD** in post-render QA: measured pause lengths vs the tiered-pause plan, no unintended silence > 1.5 s.
5. 💡 DeepFilterNet / SAM-Audio to clean or isolate real CC0 SFX recordings (the sound stays real, only the noise goes).

## Skip
- Other TTS models and voice cloning: the narrator is fixed (Kokoro `am_michael`).
- MiniMax Music 3: AI-generated music. The bed must be real CC0 music.
- Web UI: the CLI/API is enough for the pipeline.
