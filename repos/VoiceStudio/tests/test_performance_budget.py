"""Offline capacity planning, shared memory and priority regressions."""
import pytest

from services.performance_budget import Candidate, make_plan, recommended_tier


def host(ram=32, gpu=16, device="cuda", threads=16):
    return {"ram_gb": ram, "vram_gb": gpu, "device": device,
            "cpu_threads": threads, "probe_ok": True}


def inventory():
    return {
        "tts": [Candidate("kittentts", "kitten", 1, .5), Candidate("omnivoice", "omni", 4, 8, 6)],
        "asr": [Candidate("faster-whisper", "tiny", 1, .6, .6),
                Candidate("faster-whisper", "small", 2, 1.5, 1.5),
                Candidate("faster-whisper", "large", 4, 4, 5)],
        "dictation": [Candidate("sherpa", "tiny", 1, .7), Candidate("sherpa", "parakeet", 4, 3)],
    }


@pytest.mark.parametrize("hardware,tier", [
    (host(32, 24), "max"), (host(16, 8), "quality"),
    (host(16, 4), "balanced"), (host(8, 0, "cpu", 4), "fast"),
    (host(16, 0, "cpu", 8), "balanced"), (host(32, 0, "cpu", 16), "quality"),
    (host(16, None, "mps"), "quality"), (host(32, None, "mps"), "max"),
    (host(31.8, None, "mps"), "max"), (host(31.8, 11.9), "max"),
    (host(None, None, "cpu"), "fast"),
])
def test_auto_recommends_a_practical_tier(hardware, tier):
    assert recommended_tier(hardware) == tier


def test_max_reserves_tts_before_asr_and_keeps_cpu_dictation_strong():
    plan = make_plan("max", host(32, 8), inventory())
    rows = plan["families"]
    assert rows["tts"]["selection"]["engine"] == "omnivoice"
    assert rows["tts"]["tier"] == "max"
    assert rows["asr"]["selection"]["model"] == "tiny"
    assert rows["asr"]["reason"] == "memory"
    assert rows["dictation"]["selection"]["model"] == "parakeet"


def test_max_upgrades_both_speech_models_when_they_fit():
    rows = make_plan("max", host(), inventory())["families"]
    assert rows["asr"]["selection"]["model"] == "large"
    assert rows["dictation"]["selection"]["model"] == "parakeet"


def test_fast_to_max_changes_models_not_just_slider_labels():
    low = make_plan("fast", host(), inventory())["families"]
    high = make_plan("max", host(), inventory())["families"]
    assert low["tts"]["selection"]["model"] == "kitten"
    assert high["tts"]["selection"]["model"] == "omni"
    assert low["dictation"]["selection"]["model"] == "tiny"
    assert high["dictation"]["selection"]["model"] == "parakeet"


def test_auto_is_resolved_and_never_enters_decoder_tier():
    plan = make_plan("auto", host(), inventory())
    assert plan["resolved"] == "max"
    assert all(row["tier"] != "auto" for row in plan["families"].values())


def test_unknown_hardware_does_not_claim_fit_or_switch_models():
    plan = make_plan("max", host(None, None), inventory())
    assert plan["status"] == "unknown"
    assert all(row["selection"] is None for row in plan["families"].values())


def test_pinned_engine_reserves_memory_before_managed_engines():
    pinned = Candidate("custom", "custom", 4, 8, 6)
    plan = make_plan("max", host(32, 8), inventory(), {"tts": pinned})
    assert plan["families"]["tts"]["reason"] == "kept"
    assert plan["families"]["asr"]["selection"]["model"] == "tiny"


def test_missing_model_is_distinct_from_memory_limit():
    plan = make_plan("max", host(), {"dictation": inventory()["dictation"][:1]})
    assert plan["families"]["dictation"]["selection"]["model"] == "tiny"
    assert plan["families"]["dictation"]["reason"] == "installed"


def test_retained_tts_still_consumes_budget_when_nothing_fits():
    current = {"tts": Candidate("custom", "custom", 4, 8, 6)}
    # Kitten fits, so remove it to simulate a cloning-only workflow.
    models = inventory()
    models["tts"] = models["tts"][1:]
    plan = make_plan("max", host(8, 4), models, current=current)
    assert plan["families"]["tts"]["selection"] is None
    assert plan["families"]["asr"]["selection"] is None
    assert plan["families"]["tts"]["reason"] == "memory"
    assert plan["status"] == "limited"


def test_unified_memory_has_one_budget():
    models = {"tts": [Candidate("omnivoice", "omni", 4, 8)],
              "asr": [Candidate("whisper", "large", 4, 5)]}
    plan = make_plan("max", host(16, None, "mps"), models)
    assert plan["budget"] == {"ram_gb": 12, "vram_gb": 0}
    assert plan["families"]["tts"]["selection"] is not None
    assert plan["families"]["asr"]["selection"] is None


def test_override_is_part_of_shared_plan():
    plan = make_plan("max", host(), inventory(), overrides={"asr": "fast"})
    assert plan["families"]["asr"]["selection"]["model"] == "tiny"
    assert plan["families"]["tts"]["tier"] == "max"


@pytest.mark.parametrize("device", ["xpu", "cuda", "rocm"])
def test_unknown_vram_keeps_cpu_candidates_available(device):
    rows = make_plan("max", host(32, 0, device), inventory())["families"]
    assert rows["tts"]["selection"]["engine"] == "kittentts"
    assert rows["dictation"]["selection"]["model"] == "parakeet"
    assert rows["asr"]["selection"] is None
