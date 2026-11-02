"""Locate NVIDIA's management CLI consistently, including its WSL path."""

from __future__ import annotations

import os
import shutil
import sys

_WSL_NVIDIA_SMI = "/usr/lib/wsl/lib/nvidia-smi"


def find_nvidia_smi() -> str | None:
    executable = shutil.which("nvidia-smi")
    if executable:
        return executable
    if sys.platform == 'win32':
        # Older/non-DCH drivers keep NVSMI outside PATH. Prefer the native
        # 64-bit Program Files directory when running a 32-bit Python host.
        for root in (os.environ.get('ProgramW6432'), os.environ.get('ProgramFiles'), r'C:\Program Files'):
            if root:
                candidate = os.path.join(root, 'NVIDIA Corporation', 'NVSMI', 'nvidia-smi.exe')
                if os.path.isfile(candidate):
                    return candidate
    return _WSL_NVIDIA_SMI if os.path.isfile(_WSL_NVIDIA_SMI) else None
