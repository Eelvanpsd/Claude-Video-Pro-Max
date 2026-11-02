"""Live NVIDIA statistics follow the adapter selected for CUDA."""

from types import SimpleNamespace
import pytest


@pytest.mark.parametrize('variable', ['ProgramW6432', 'ProgramFiles'])
def test_nvidia_smi_locator_finds_windows_non_dch_install(monkeypatch, variable):
    from core import nvidia_smi
    import sys

    monkeypatch.setattr(sys, 'platform', 'win32')
    monkeypatch.delenv('ProgramW6432', raising=False)
    monkeypatch.delenv('ProgramFiles', raising=False)
    monkeypatch.setenv(variable, 'D:/Program Files')
    executable = nvidia_smi.os.path.join('D:/Program Files', 'NVIDIA Corporation', 'NVSMI', 'nvidia-smi.exe')
    monkeypatch.setattr(nvidia_smi.shutil, 'which', lambda _: None)
    monkeypatch.setattr(nvidia_smi.os.path, 'isfile', lambda path: path == executable)
    assert nvidia_smi.find_nvidia_smi() == executable


def test_nvidia_smi_locator_prefers_path(monkeypatch):
    from core import nvidia_smi

    monkeypatch.setattr(nvidia_smi.shutil, 'which', lambda _: '/custom/nvidia-smi')
    assert nvidia_smi.find_nvidia_smi() == '/custom/nvidia-smi'


def test_nvidia_smi_locator_uses_wsl_fallback(monkeypatch):
    from core import nvidia_smi

    monkeypatch.setattr(nvidia_smi.shutil, "which", lambda _name: None)
    monkeypatch.setattr(
        nvidia_smi.os.path,
        "isfile",
        lambda path: path == "/usr/lib/wsl/lib/nvidia-smi",
    )
    assert nvidia_smi.find_nvidia_smi() == "/usr/lib/wsl/lib/nvidia-smi"


def test_live_stats_query_selected_gpu_uuid(monkeypatch):
    from api.routers import system

    selected = "GPU-cccccccc-dddd"
    calls = []
    monkeypatch.setenv("CUDA_VISIBLE_DEVICES", selected)
    monkeypatch.setattr(system, "find_nvidia_smi", lambda: "nvidia-smi")
    monkeypatch.setattr(
        system.subprocess,
        "run",
        lambda args, **_kwargs: (
            calls.append(args)
            or SimpleNamespace(returncode=0, stdout="42, 1024, 12288\n")
        ),
    )

    assert system._nvidia_live_stats() == (42.0, 1.0, 12.0)
    assert f"--id={selected}" in calls[0]
