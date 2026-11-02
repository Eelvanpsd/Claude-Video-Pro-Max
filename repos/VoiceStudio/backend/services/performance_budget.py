"""Deterministic, advisory working-memory plans; never loads or downloads models.

Estimates include runtime headroom, not checkpoint download size. They are not
minimum hardware requirements. Generation-time pressure checks remain authoritative.
"""
from __future__ import annotations

from dataclasses import dataclass
import os

TIERS = ("fast", "balanced", "quality", "max")
PRIORITY = ("tts", "asr", "translation", "dictation", "diarisation", "llm")


@dataclass(frozen=True)
class Candidate:
    engine: str
    model: str
    rank: int
    ram: float
    vram: float = 0
    label: str | None = None

    def selection(self) -> dict:
        return {"engine": self.engine, "model": self.model, "label": self.label}


def hardware_snapshot() -> dict:
    from core.device_caps import detect_host_caps
    from services.memory_budget import available_memory

    caps = detect_host_caps()
    memory = available_memory()
    return {
        "device": caps.family,
        "ram_gb": memory.get("ram_total_gb"),
        # MPS shares RAM; counting its reported VRAM again invents capacity.
        "vram_gb": caps.vram_gb if caps.family in {"cuda", "rocm", "xpu"} else None,
        "cpu_threads": os.cpu_count() or 1,
        "probe_ok": caps.probe_ok,
    }


def recommended_tier(hardware: dict) -> str:
    # Usable totals are commonly 31.8/15.8/11.9 GiB on nominal 32/16/12 GB
    # devices. Round for tier classification, never for the allocation budget.
    ram = round(hardware.get("ram_gb") or 0)
    vram = round(hardware.get("vram_gb") or 0)
    threads = hardware.get("cpu_threads") or 1
    if not hardware.get("probe_ok", True) or not ram:
        return "fast"
    if hardware.get("device") == "mps":
        return "max" if ram >= 32 else "quality" if ram >= 16 else "balanced" if ram >= 8 else "fast"
    if vram >= 12 and ram >= 24:
        return "max"
    if vram >= 8 and ram >= 16:
        return "quality"
    if vram >= 4 and ram >= 12:
        return "balanced"
    # CPU-only machines retain every setting. Auto favors a practical latency.
    return "quality" if ram >= 32 and threads >= 16 else "balanced" if ram >= 16 and threads >= 8 else "fast"


def make_plan(choice: str, hardware: dict, inventory: dict[str, list[Candidate]],
              fixed: dict[str, Candidate] | None = None,
              overrides: dict[str, str] | None = None,
              current: dict[str, Candidate] | None = None) -> dict:
    """Reserve fixed/custom engines first, then spend the shared budget TTS-first.

    Stable total-memory budgets avoid oscillating Auto as our own models load.
    The OS/app reserve is intentionally separate from per-engine estimates.
    If nothing fits we keep the current engine (no forced unload/disable).
    """
    resolved = recommended_tier(hardware) if choice == "auto" else choice
    if resolved not in TIERS:
        resolved = "balanced"
    ram = float(hardware.get("ram_gb") or 0)
    gpu = float(hardware.get("vram_gb") or 0)
    known = ram > 0 and hardware.get("probe_ok", True)
    # Unknown dedicated VRAM must not disable CPU-only candidates.
    remaining_ram = max(0, ram - max(4, ram * .2))
    remaining_gpu = max(0, gpu - max(1, gpu * .15))
    budgets = {"ram_gb": round(remaining_ram, 1), "vram_gb": round(remaining_gpu, 1)}
    fixed = fixed or {}
    overrides = overrides or {}
    current = current or {}
    plans = {}
    for candidate in fixed.values():
        remaining_ram -= candidate.ram
        remaining_gpu -= candidate.vram
    for family in PRIORITY:
        tier = overrides.get(family, resolved)
        if tier not in TIERS:
            tier = resolved
        effort = TIERS.index(tier) + 1
        # Quality and Max use the strongest affordable model. Max additionally
        # increases decoding/sampling effort; do not strand Auto/Quality on
        # Tiny merely because the next installed model is the top-ranked one.
        desired = 4 if effort >= 3 else effort
        candidates = sorted(inventory.get(family, []), key=lambda c: (c.rank, c.model))
        entry = {"tier": tier, "selection": None, "reason": "installed"}
        if family in fixed:
            entry.update(selection=fixed[family].selection(), reason="kept")
        elif candidates and known:
            preferred = [c for c in candidates if c.rank <= desired] or candidates[:1]
            fits = [c for c in preferred if c.ram <= remaining_ram and c.vram <= remaining_gpu]
            if fits:
                candidate = fits[-1]
                remaining_ram -= candidate.ram
                remaining_gpu -= candidate.vram
                entry.update(selection=candidate.selection(),
                             reason="memory" if candidate != preferred[-1] else
                             "installed" if candidate.rank < desired else "fits")
                # Keep TTS sampling effort at the requested tier. Supporting
                # decoders follow the affordable model, leaving TTS headroom.
                if family != "tts":
                    entry["tier"] = TIERS[min(effort, candidate.rank) - 1]
                entry["estimated_ram_gb"] = candidate.ram
                entry["estimated_vram_gb"] = candidate.vram
            else:
                entry["reason"] = "memory"
        elif not known:
            entry["reason"] = "unknown"
        if entry["selection"] is None and family in current:
            # A retained engine still occupies memory. In particular, a TTS
            # that cannot fit must not give its budget away to secondary tools.
            remaining_ram -= current[family].ram
            remaining_gpu -= current[family].vram
        plans[family] = entry
    return {"resolved": resolved, "hardware": hardware, "budget": budgets,
            "families": plans, "estimated": True,
            "status": "unknown" if not known else
            "limited" if any(p["reason"] == "memory" and p["selection"] is None
                             for p in plans.values()) else
            "adjusted" if any(p["reason"] != "fits" for f, p in plans.items()
                              if f != "llm") else "fits"}
