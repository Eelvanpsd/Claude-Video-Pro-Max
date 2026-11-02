"""Deterministic WAV encoding of the final, already provenance-marked take."""
import numpy as np
import torch

from services.audio_io import _describe_write_failure, _safe_soundfile_write

WAV_SUBTYPES = {16: "PCM_16", 24: "PCM_24", 32: "FLOAT"}


def save_generation_wav(path, audio: torch.Tensor, sample_rate: int, bits: int = 16) -> None:
    """Preserve the selected precision independently of the torchaudio backend.

    TorchCodec-backed torchaudio can ignore encoding/bit-depth arguments. Write
    the selected subtype explicitly with our audited SoundFile writer instead.
    This is encoding only: callers must pass through mark_synthetic first.
    """
    if bits not in WAV_SUBTYPES:
        raise ValueError("WAV precision must be 16, 24, or 32 bits")
    audio = audio.detach().cpu()
    if audio.ndim == 1:
        audio = audio.unsqueeze(0)
    if audio.ndim != 2 or not audio.numel():
        raise ValueError("Expected non-empty channel-first audio")
    if audio.dtype in (torch.int16, torch.int32):
        scale = 32768.0 if audio.dtype == torch.int16 else 2147483648.0
        audio = audio.to(torch.float32) / scale
    samples = audio.to(torch.float32).transpose(0, 1).contiguous().numpy().copy()
    if not np.isfinite(samples).all():
        raise ValueError("Audio contains non-finite samples")
    try:
        _safe_soundfile_write(path, samples, sample_rate, subtype=WAV_SUBTYPES[bits], format="WAV")
    except Exception as exc:
        raise _describe_write_failure(exc, path) from exc
