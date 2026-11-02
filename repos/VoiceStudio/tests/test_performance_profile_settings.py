"""Pack installation can persist a global policy before engines are available."""
from unittest.mock import Mock

import pytest
from fastapi import HTTPException

import importlib


@pytest.fixture(autouse=True)
def current_modules():
    global batch, settings, job_store, prefs
    batch = importlib.import_module("api.routers.batch")
    settings = importlib.import_module("api.routers.settings")
    job_store = importlib.import_module("core.job_store")
    prefs = importlib.import_module("core.prefs")


@pytest.fixture
def empty_profile(monkeypatch, tmp_path):
    monkeypatch.setattr(prefs, "_PREFS_PATH", str(tmp_path / "prefs.json"))
    monkeypatch.setattr(settings, "_performance_profile_state", lambda: {
        "global": prefs.get("performance_profile", {}).get("global", "balanced"),
        "applicable_families": [],
    })
    monkeypatch.setattr(job_store, "list_jobs", lambda **_kwargs: [])
    monkeypatch.setattr(batch, "list_batch_jobs", lambda **_kwargs: [])
    activate = Mock(return_value={})
    monkeypatch.setattr(settings, "activate_performance_tier", activate)
    return activate


@pytest.mark.parametrize("tier", ["fast", "balanced", "quality", "max", "auto"])
def test_global_pack_policy_can_be_saved_without_applicable_engines(empty_profile, tier):
    prefs.set_("performance_profile", {"global": "balanced", "asr": "quality"})
    result = settings.set_performance_profile(settings._PerformanceProfileBody(tier=tier))
    assert result["global"] == tier
    assert prefs.get("performance_profile") == {"global": tier}
    empty_profile.assert_called_once_with(tier, None)


def test_unsupported_family_still_rejected(empty_profile):
    with pytest.raises(HTTPException) as error:
        settings.set_performance_profile(settings._PerformanceProfileBody(tier="fast", family="tts"))
    assert error.value.status_code == 409
    assert prefs.get("performance_profile") is None
    empty_profile.assert_not_called()


def test_auto_is_global_only(empty_profile):
    with pytest.raises(HTTPException) as error:
        settings.set_performance_profile(settings._PerformanceProfileBody(tier="auto", family="tts"))
    assert error.value.status_code == 400
    empty_profile.assert_not_called()


@pytest.mark.parametrize("source", ["generation", "batch"])
def test_global_pack_policy_still_blocks_active_jobs(empty_profile, monkeypatch, source):
    module, name = (job_store, "list_jobs") if source == "generation" else (batch, "list_batch_jobs")
    monkeypatch.setattr(module, name, lambda **_kwargs: [{"status": "running"}])
    with pytest.raises(HTTPException) as error:
        settings.set_performance_profile(settings._PerformanceProfileBody(tier="fast"))
    assert error.value.status_code == 409
    assert "jobs to finish" in error.value.detail
    assert prefs.get("performance_profile") is None
    empty_profile.assert_not_called()
