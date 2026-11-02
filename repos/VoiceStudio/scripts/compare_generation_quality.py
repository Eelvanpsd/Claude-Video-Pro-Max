"""Offline TTS quality sweep using installed models; writes only to a new directory.

Exports the same marked waveform at 16/24/32 bits for each sampling/effects
condition. Measurements describe signal health, not perceptual quality.
"""
import argparse
import json
import os
from pathlib import Path
import sys
import time


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--engines', nargs='+', default=['omnivoice'])
    parser.add_argument('--output', required=True)
    parser.add_argument('--text', default='The morning sunlight filled the quiet room. Today, we begin a new adventure.')
    parser.add_argument('--steps', nargs='+', type=int, default=[16, 32, 64])
    parser.add_argument('--seed', type=int, default=42)
    parser.add_argument('--ref-audio')
    parser.add_argument('--ref-text')
    args = parser.parse_args()
    if bool(args.ref_audio) != bool(args.ref_text):
        parser.error('--ref-audio and --ref-text must be supplied together')
    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=False)
    os.environ['HF_HUB_OFFLINE'] = '1'
    os.environ['TRANSFORMERS_OFFLINE'] = '1'
    root = Path(__file__).resolve().parents[1]
    sys.path[:0] = [str(root), str(root / 'backend')]
    # Configure the same installed cache as the app before importing Hub.
    from core import config  # noqa: F401
    from core.prefs import _load
    # Settings persists sidecar locations; restore only those paths, never
    # network/provider credentials or preferences that could disable offline.
    for key, value in _load().items():
        if key.startswith('env.OMNIVOICE_') and key.endswith('_DIR') and isinstance(value, str):
            os.environ.setdefault(key.removeprefix('env.'), value)
    import numpy as np
    import soundfile as sf
    import torch
    from services import tts_backend
    from services.generation_audio import save_generation_wav
    from services.audio_quality import analyze_audio
    from services.watermark import mark_synthetic
    from api.routers.generation import _run_backend_inference, _apply_effect_chain

    results = []
    sampling_engines = {'omnivoice', 'omnivoice-subprocess', 'voxcpm2', 'dots-tts', 'supertonic3'}
    for engine_id in args.engines:
        backend = None
        try:
            cls = tts_backend.get_backend_class(engine_id)
            available, reason = cls.is_available()
            if not available:
                raise RuntimeError(reason)
            backend = cls()
            load_start = time.monotonic()
            backend.ensure_ready()
            load_seconds = round(time.monotonic() - load_start, 2)
            modes = ['tts'] + (['clone'] if args.ref_audio and backend.supports_cloning else [])
            steps_to_try = args.steps if engine_id in sampling_engines else [16]
            if engine_id == 'supertonic3':
                steps_to_try = sorted(set(max(5, min(12, n)) for n in steps_to_try))
            for mode in modes:
                for steps in steps_to_try:
                    started = time.monotonic()
                    raw = _run_backend_inference(
                        backend, args.text, 'English', args.ref_audio if mode == 'clone' else None,
                        args.ref_text if mode == 'clone' else None, None, None,
                        steps, 2.0, 1.0, True, True, args.seed, 'raw',
                    )
                    generation_seconds = round(time.monotonic() - started, 2)
                    rate = backend.sample_rate
                    for preset in ['broadcast', 'raw']:
                        wave = _apply_effect_chain(raw.clone(), rate, preset,
                            skip_mastering=getattr(backend, 'applies_own_mastering', False))
                        wave = mark_synthetic(wave, rate, context='quality-comparison')
                        for bits in [16, 24, 32]:
                            path = output / f'{engine_id}-{mode}-{steps}-{preset}-{bits}.wav'
                            save_generation_wav(path, wave, rate, bits)
                            samples, _ = sf.read(path)
                            info = sf.info(path)
                            row = dict(file=path.name, engine=engine_id, mode=mode, steps=steps,
                                effects=preset, bits=bits, subtype=info.subtype, sample_rate=rate,
                                channels=info.channels, duration=round(info.duration, 3), bytes=path.stat().st_size,
                                generation_seconds=generation_seconds, load_seconds=load_seconds,
                                finite=bool(np.isfinite(samples).all()),
                                peak_dbfs=round(float(20*np.log10(max(np.max(np.abs(samples)), 1e-12))), 3),
                                analysis=analyze_audio(path).model_dump())
                            results.append(row)
                    print(json.dumps(dict(engine=engine_id,mode=mode,steps=steps,seconds=generation_seconds)), flush=True)
        except Exception as exc:
            results.append(dict(engine=engine_id, error=f'{type(exc).__name__}: {exc}'))
            print(json.dumps(results[-1]), flush=True)
        finally:
            if backend is not None:
                backend.unload()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            (output / 'results.json').write_text(json.dumps(dict(text=args.text, seed=args.seed,
                reference_used=bool(args.ref_audio), results=results), indent=2) + '\n', encoding='utf-8')
    return 1 if any('error' in row for row in results) else 0


if __name__ == '__main__':
    raise SystemExit(main())
