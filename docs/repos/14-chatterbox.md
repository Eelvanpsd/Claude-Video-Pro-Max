# Chatterbox — resemble-ai/chatterbox

> Source (vendored): [`repos/chatterbox`](../../repos/chatterbox) · License: **MIT** (code) · Verdict: 💡 **Benchmark candidate only; ❌ not a narrator swap (cloning-first, watermarked, torch/CUDA-first)**

## What it is
Resemble AI's open-source TTS family (package `chatterbox-tts` 0.1.7, vendored at `5de7a54a`, 2026-07-21).
It is a small PyTorch codebase (`src/chatterbox/`, 66 files): a Llama-style text→speech-token model (`models/t3`),
an S3 speech tokenizer, a flow-matching token→mel decoder plus HiFi-GAN vocoder (`models/s3gen`) and a speaker encoder.

| Model | Size | Languages | Notes |
|---|---|---|---|
| **Chatterbox-Turbo** | 350M | English | One-step distilled decoder (was 10), native tags `[laugh]`, `[chuckle]`, `[cough]` … |
| **Chatterbox-Nano** | 110M | English | Turbo architecture, CPU-friendly (≈ 3× realtime on 8 cores) |
| **Multilingual V3** | 500M | 23 (incl. Turkish) | Better speaker similarity, fewer hallucinations than V2 |
| Single Language Pack | 500M each | zh, es-MX, es-ES, pt-BR, pt-PT, hi | Dialect finetunes |
| Chatterbox (original) | 500M | English | `exaggeration` + `cfg_weight` controls |

Entry points: `tts.py` (`ChatterboxTTS`), `tts_turbo.py` (`ChatterboxTurboTTS`, `nano=True`), `mtl_tts.py`,
`vc.py` (voice conversion), Gradio apps `gradio_tts_app.py`, `gradio_tts_turbo_app.py`, `multilingual_app.py`.

## How to run
```bash
pip install chatterbox-tts                 # pins torch 2.6, transformers, diffusers, gradio; tested on Python 3.11 / Linux
python example_for_mac.py                  # Apple Silicon: device="mps" + patched torch.load(map_location)
```
```python
from chatterbox.tts import ChatterboxTTS
model = ChatterboxTTS.from_pretrained(device="mps")
wav = model.generate("In 1453 the walls of Constantinople fell.",
                     audio_prompt_path="ref_10s.wav",   # zero-shot voice from a reference clip
                     exaggeration=0.5, cfg_weight=0.5)  # defaults; dramatic: exaggeration≈0.7, cfg_weight≈0.3
```
Without torch: **mlx-audio already ships Chatterbox** (`mlx-community/chatterbox-fp16`, multilingual v3), see [13-mlx-audio](13-mlx-audio.md).
That is the simpler route on our Macs if we ever A/B it.

## Video-quality techniques
| Area | What | Where |
|---|---|---|
| **Delivery controls** | `exaggeration` (emotion intensity, 0.5 default) and `cfg_weight` (pacing/adherence). Higher exaggeration speeds speech up; lower cfg_weight (~0.3) slows it back down | `src/chatterbox/tts.py` `generate()`, README › Tips |
| Sampling knobs | `temperature` 0.8, `repetition_penalty` 1.2, `min_p` 0.05, `top_p` 1.0: lower temperature for steadier documentary reads | `tts.py`, `tts_turbo.py` |
| Reference loudness | Turbo normalises the reference clip to −27 LUFS (pyloudnorm) before conditioning, so voice level doesn't depend on the prompt | `tts_turbo.py` `norm_loudness()` |
| Accent control | Reference clip language must match `language_id`, else accent leaks; `cfg_weight=0` mitigates | README › Tips |
| Paralinguistic tags | `[laugh]`, `[chuckle]`, `[cough]` on Turbo/Nano | README |
| **Perth watermark** | Every output gets an imperceptible neural watermark (survives MP3/editing); `perth.PerthImplicitWatermarker().get_watermark()` detects it | `tts.py:271`, `vc.py:103`, README |

## Licences
- Code **MIT**. Model cards on Hugging Face (`ResembleAI/*`) carry their own terms. Check each before publishing.
- **Every file is watermarked** by design (Perth). That is fine legally, but platforms or viewers detecting "AI voice" is a real effect. Our Kokoro output carries no watermark.
- Voice cloning from a reference clip: only with the speaker's consent. Never clone real people's voices.

## Free vs paid
Free and local. Resemble's hosted API is the paid upsell, never needed.

## Fit for the history pipeline
- The narrator is fixed (Kokoro `am_michael`, owner-approved). Chatterbox has **no preset voices**: it needs a reference clip,
  so using it means cloning *some* voice, which is a new narrator decision for the owner, not a tooling choice.
- Kokoro 82M on MLX is faster and deterministic per sentence. Chatterbox samples (temperature), so takes vary and need seeding/QC.

## Adopt
1. 💡 **A/B only if the owner ever wants a more expressive narrator**: render one script through mlx-audio's Chatterbox
   (consented reference voice, `exaggeration` 0.5 vs 0.7, `cfg_weight` 0.3–0.5) next to Kokoro, then judge by ear and by likes.
2. 💡 **Perth detector as a QA probe**: run `get_watermark()` on every final mix to prove no watermarked third-party TTS slipped in.
3. 💡 Turkish is in Multilingual V3: an option for a future Turkish channel (same licence/consent checks).

## Skip
- Swapping the narrator or cloning any voice without the owner's explicit decision.
- `[laugh]`/`[cough]` tags: wrong register for documentary narration.
- The torch/Gradio install on our Macs: use mlx-audio's port if testing at all.
