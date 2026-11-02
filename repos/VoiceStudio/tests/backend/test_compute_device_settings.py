"""Tests for the compute-device override endpoints (Settings → Performance).

Covers the API contract of GET/PUT /api/settings/compute-device:
  - GET reports the resolved pick, what this process applied, and the host's
    available families (the UI renders only those + Auto).
  - PUT persists a valid pick to prefs.json and echoes the new state with
    restart_required=True (caps are immutable per process).
  - PUT rejects unknown values and accelerators this host doesn't have —
    a silent no-op pick would read as "the setting doesn't work".
  - An OMNIVOICE_DEVICE env pin is reported (env_pinned) and wins over PUT.
"""
from __future__ import annotations

import sys
from types import SimpleNamespace

import pytest


@pytest.fixture
def fresh_app(monkeypatch, tmp_path):
    """Same isolation pattern as tests/backend/test_perf_settings.py."""
    monkeypatch.setenv("OMNIVOICE_DATA_DIR", str(tmp_path))
    monkeypatch.delenv("OMNIVOICE_DEVICE", raising=False)
    monkeypatch.delenv("CUDA_VISIBLE_DEVICES", raising=False)
    monkeypatch.delenv("HF_TOKEN", raising=False)
    monkeypatch.delenv("HUGGING_FACE_HUB_TOKEN", raising=False)

    for mod in list(sys.modules):
        if (
            mod == "core" or mod.startswith("core.")
            or mod == "services" or mod.startswith("services.")
            or mod == "api" or mod.startswith("api.")
        ):
            del sys.modules[mod]

    from core import db as _db
    _db.init_db()

    from fastapi import FastAPI
    from api.routers import settings as settings_router

    app = FastAPI()
    app.include_router(settings_router.router)
    return app


def _client(app):
    from fastapi.testclient import TestClient
    return TestClient(app, client=("127.0.0.1", 12345))


def test_get_reports_state_and_families(fresh_app):
    c = _client(fresh_app)
    r = c.get("/api/settings/compute-device")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["value"] in body["choices"]
    assert "cpu" in body["available_families"]  # invariant: cpu always present
    assert body["effective_family"] in body["available_families"]
    assert isinstance(body["env_pinned"], bool)


def test_put_persists_and_flags_restart(fresh_app):
    c = _client(fresh_app)
    r = c.put("/api/settings/compute-device", json={"value": "cpu"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["value"] == "cpu"
    # Caps are cached per process: the pick applies at next start, and the
    # endpoint must say so instead of pretending it already did.
    assert body["restart_required"] is True

    from core import prefs
    assert prefs.resolve("compute_device", default="auto") == "cpu"

    # auto round-trips back
    r = c.put("/api/settings/compute-device", json={"value": "auto"})
    assert r.status_code == 200
    assert r.json()["value"] == "auto"


def test_put_rejects_unknown_and_unavailable_values(fresh_app):
    c = _client(fresh_app)
    r = c.put("/api/settings/compute-device", json={"value": "quantum"})
    assert r.status_code == 400
    assert "Valid:" in r.json()["detail"]

    # Find an accelerator this host does NOT have (CI hosts are cpu-only,
    # but don't assume — pick from the full choice list minus available).
    state = c.get("/api/settings/compute-device").json()
    missing = [
        f for f in state["choices"]
        if f not in ("auto", "cpu") and f not in state["available_families"]
    ]
    if missing:
        r = c.put("/api/settings/compute-device", json={"value": missing[0]})
        assert r.status_code == 400
        assert "not available" in r.json()["detail"]


def test_env_pin_is_reported_and_wins(fresh_app, monkeypatch):
    monkeypatch.setenv("OMNIVOICE_DEVICE", "cpu")
    c = _client(fresh_app)
    state = c.get("/api/settings/compute-device").json()
    assert state["env_pinned"] is True
    assert state["value"] == "cpu"

    # A PUT still persists (for after the pin is removed) but the resolved
    # value stays the env's — the UI disables the control and shows the pin.
    r = c.put("/api/settings/compute-device", json={"value": "auto"})
    assert r.status_code == 200
    assert r.json()["value"] == "cpu"


def test_auto_summary_reports_registered_npu(fresh_app, monkeypatch):
    from core import device_caps
    monkeypatch.setattr(device_caps, 'detect_host_caps', lambda: device_caps.HostCaps(
        family='npu', available_families=('npu', 'cpu'),
    ))
    body = _client(fresh_app).get('/api/settings/compute-device').json()
    assert body['auto_family'] == body['effective_family'] == 'npu'
    # Detection does not globally opt unrelated engines into NPU execution.
    assert 'npu' not in body['choices']


def test_cuda_device_selection_persists_stable_uuid_for_next_restart(fresh_app, monkeypatch):
    from api.routers import settings as settings_router

    monkeypatch.setattr(settings_router, "find_nvidia_smi", lambda: "nvidia-smi")
    monkeypatch.setattr(
        settings_router.subprocess,
        "run",
        lambda *_args, **_kwargs: SimpleNamespace(
            returncode=0,
            stdout=(
                "0, GPU-aaaaaaaa-bbbb, NVIDIA GeForce RTX 3060\n"
                "1, GPU-cccccccc-dddd, NVIDIA GeForce RTX 4070\n"
            ),
        ),
    )
    c = _client(fresh_app)
    state = c.get("/api/settings/cuda-device").json()
    assert state["value"] == state["applied"] == "auto"
    assert [device["index"] for device in state["devices"]] == [0, 1]

    selected = "GPU-cccccccc-dddd"
    saved = c.put("/api/settings/cuda-device", json={"value": selected})
    assert saved.status_code == 200, saved.text
    assert saved.json()["value"] == selected
    assert saved.json()["applied"] == "auto"
    assert saved.json()["restart_required"] is True

    from core import prefs
    assert prefs.get("env.CUDA_VISIBLE_DEVICES") == selected

    cleared = c.put("/api/settings/cuda-device", json={"value": "auto"})
    assert cleared.status_code == 200
    assert prefs.get("env.CUDA_VISIBLE_DEVICES") is None


@pytest.mark.parametrize('value', ['auto', 'GPU-not-present', ''])
def test_generic_env_setter_cannot_bypass_cuda_validation(fresh_app, monkeypatch, value):
    import asyncio
    import os
    from fastapi import HTTPException
    from api.routers.system import set_env_var
    from core import prefs

    monkeypatch.setenv('CUDA_VISIBLE_DEVICES', 'GPU-running')
    prefs.set_('env.CUDA_VISIBLE_DEVICES', 'GPU-saved')
    with pytest.raises(HTTPException) as error:
        asyncio.run(set_env_var({'key': 'CUDA_VISIBLE_DEVICES', 'value': value}))
    assert error.value.status_code == 400
    assert os.environ['CUDA_VISIBLE_DEVICES'] == 'GPU-running'
    assert prefs.get('env.CUDA_VISIBLE_DEVICES') == 'GPU-saved'


def test_cuda_device_rejects_unknown_adapter(fresh_app, monkeypatch):
    from api.routers import settings as settings_router

    monkeypatch.setattr(settings_router, "_cuda_devices", lambda: [])
    response = _client(fresh_app).put(
        "/api/settings/cuda-device", json={"value": "GPU-not-present"}
    )
    assert response.status_code == 400


def test_cuda_device_selection_uses_wsl_nvidia_smi(fresh_app, monkeypatch):
    from api.routers import settings as settings_router

    monkeypatch.setattr(
        settings_router, "find_nvidia_smi", lambda: "/usr/lib/wsl/lib/nvidia-smi"
    )
    calls = []
    monkeypatch.setattr(
        settings_router.subprocess,
        "run",
        lambda args, **_kwargs: (
            calls.append(args)
            or SimpleNamespace(
                returncode=0,
                stdout="0, GPU-aaaaaaaa-bbbb, NVIDIA GeForce RTX 3060\n",
            )
        ),
    )
    state = _client(fresh_app).get("/api/settings/cuda-device").json()
    assert state["devices"][0]["value"] == "GPU-aaaaaaaa-bbbb"
    assert calls[0][0] == "/usr/lib/wsl/lib/nvidia-smi"


@pytest.mark.parametrize('override, expected', [('1', '1'), ('', 'disabled')])
def test_external_cuda_visibility_pin_wins_over_saved_choice(fresh_app, monkeypatch, override, expected):
    from api.routers import settings as settings_router
    from core import prefs

    monkeypatch.setattr(settings_router, "_cuda_devices", lambda: [])
    monkeypatch.setattr(prefs, "is_env_shadowed", lambda key: key == "CUDA_VISIBLE_DEVICES")
    monkeypatch.setenv("CUDA_VISIBLE_DEVICES", override)
    state = _client(fresh_app).get("/api/settings/cuda-device").json()
    assert state["value"] == state["applied"] == expected
    assert state["restart_required"] is False
    assert state["env_pinned"] is True
