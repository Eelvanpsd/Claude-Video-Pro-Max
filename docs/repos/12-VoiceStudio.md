# VoiceStudio — debpalash/VoiceStudio

> Source (vendored): [`repos/VoiceStudio`](../../repos/VoiceStudio) · License: **AGPL-3.0-only** (app) · Verdict: 💡 **Ideas + optional local tool; ❌ not the narration engine for monetised videos (default weights are non-commercial)**

## What it is
A local "AI voice studio": an Electron desktop/web app (`electron/`) over a FastAPI backend (`backend/`, port 3900)
for voice cloning, voice design from a text description, video dubbing, audiobook/long-form narration,
dictation and transcription, with phone apps, Docker images and an MCP server. One UI over ~20 TTS engines
and ~10 ASR engines (`docs/engines/README.md`, `docs/feature-catalog.md`); the app asks before downloading a model.

- **Default TTS:** VoiceStudio = k2-fsa/OmniVoice (bundled `omnivoice/` package, Apache-2.0 code;
  **weights CC-BY-NC**, about 2.3 GB). Others: CosyVoice 3, IndexTTS 2.5 (graded emotion), VoxCPM2 (48 kHz),
  KittenTTS, Supertonic-3, PocketTTS, dots.tts, MOSS-TTS, GPT-SoVITS, Sherpa-ONNX, and **MLX-Audio, which
  wraps Kokoro-82M** (`docs/engines/mlx-audio.md`) on Apple Silicon.
- **Default ASR:** WhisperX (faster-whisper + wav2vec2 forced alignment); also mlx-whisper (auto-picked on
  Apple Silicon), faster-whisper, Parakeet, Moonshine, FunASR, sherpa-onnx (live), whisper.cpp.
- Pinned commit: `1a29929c` (2026-11-02). The `omnivoice-gallery` submodule was not vendored (empty upstream link).

## How to run
```bash
curl -fsSL https://voicestudio.sh/install | sh        # desktop app (macOS/Linux); asks before any model download
# from source
cd repos/VoiceStudio && bun run dev                   # installs JS + Python deps, launches Electron
bun run setup:api                                     # rebuild only the Python env (uv)
# headless, once the backend runs on :3900
curl http://127.0.0.1:3900/.well-known/voicestudio-speech
python -m backend.speech_client transcribe narration.wav
claude mcp add --transport http voicestudio http://127.0.0.1:3900/mcp   # tools: generate_speech, clone_voice, design_voice, transcribe …
OMNIVOICE_MCP_OUTPUT_MODE=files OMNIVOICE_MCP_BASE_PATH=$PWD/audio     # keep WAVs out of agent context
```

## Video-quality techniques
| Area | What | Where |
|---|---|---|
| **Pause markers** | `[pause]` (350 ms), `[pause 500ms]`, `[pause 1.5s]` up to 10 s, rendered as stitched silence, so they work on every engine. Text normalisation and the chunker never touch `[…]` spans | `docs/expressive-speech.md`, `backend/services/text_normalization.py`, `chunked_tts.py` |
| **Room-tone pause fill** | Pauses filled with noise shaped like the take's own quiet background (40 ms fades) instead of digital zero, so the floor doesn't drop out at every pause. No model, reproducible | `backend/services/audio_dsp.py`, `OMNIVOICE_PAUSE_FILL=room_tone` |
| **Word timing** | WhisperX wav2vec2 alignment snaps words to **±10–30 ms**, against ±100–300 ms for plain Whisper timestamps. ~20 aligner languages (English included) | `docs/engines/whisperx.md` |
| **Signal check** | "Check audio" flags long silence, sudden volume changes, clipping, empty audio and invalid samples, each with a timestamp | `backend/services/audio_quality.py`, `docs/audio-quality.md` |
| Voice leveling | Optional chain: gentle mastering → slow phrase-level leveler (pauses not pulled up) → light EQ → look-ahead limiter above −1 dBFS | `backend/services/audio_dsp.py` |
| Export precision | 16/24/32-bit float WAV, kept separate from model sampling steps (8–64 on OmniVoice/VoxCPM2) | `docs/audio-quality.md` |
| Pronunciation dictionary | Per-word lexicon applied before TTS (names, places) | `backend/services/pronunciation.py` |
| Expressive tags | `[laughter]`, `[sigh]`, `[breath]` (engine-dependent); unknown tags are **read aloud**, not stripped | `docs/expressive-speech.md` |
| Dubbing | Translate + re-voice timed to the original, multi-speaker with diarization | `docs/electron-dubbing.md`, `docs/dubbing/` |
| Licence registry | 63 model records with licence, commercial-use review state and evidence; CI gate | `backend/config/model_licenses.json`, `docs/licensing/model-inventory.md` |

## Licences: read before using output
- **App code is AGPL-3.0.** Using the app, and publishing what it outputs, does not make our project AGPL.
  Copying its code into something offered to others over a network does.
- **Default OmniVoice weights are CC-BY-NC**, and the audio tokenizer adds Higgs Audio / Llama community terms.
  NLLB (dubbing translation) and Llama-OuteTTS are non-commercial too. **Don't use any of these on monetised videos.**
- The inventory marks **no** model as commercially cleared (`commercial_use: true` on none). Check each model's own card.
  Kokoro-82M is Apache-2.0 upstream, the same model we already run via `.venv-tts`.
- An **invisible AudioSeal watermark is on by default** (`backend/services/watermark.py`); expect it in any take.

## Free vs paid
Free and local (CPU works, just slower). Paid: a commercial licence for closed-source embedding and "Pro" features.
Optional remote LLM / OpenAI-compatible providers use your own keys and are never needed.

## Adopt
1. 💡 **Room-tone pause fill**: re-implement the idea (not the AGPL code) for our tiered sentence pauses.
   Fill the 0.7 s+ gaps with the take's own noise floor so the bed doesn't sit on dead digital silence.
2. 💡 **WhisperX forced alignment** as an optional second pass for caption word times when mlx-whisper drifts
   (CPU on Apple Silicon is fine for a 75 s narration). Compare against the current `.venv-align` times first.
3. 💡 **Signal-check list** (long silence, volume jumps, clipping, empty/NaN samples) → QUALITY-CHECKLIST › Audio.
4. 💡 Pronunciation lexicon for historical names before Kokoro (e.g. a JSON map fed through our TTS step).
5. 💡 MCP `transcribe` as a local round-trip check if the app is already running.

## Skip
- **Default OmniVoice / any non-commercial engine** for published narration: licence, and our voice is fixed (Kokoro `am_michael`).
- Voice cloning of real people (consent) and dubbing via NLLB (non-commercial).
- ElevenLabs-style tags: unknown tags are spoken aloud.
- Installing the full app just for one feature: the ideas above are a few dozen lines each.
