"""Best-effort native-crash traceback diagnostics for backend processes."""
from __future__ import annotations

import faulthandler
import os
import sys
from typing import IO, Optional

_OPT_OUT_VARIABLE = "OMNIVOICE_DISABLE_FAULTHANDLER"
_AFFIRMATIVE = {"1", "on", "true", "yes"}


def _was_opted_out() -> bool:
    raw = os.getenv(_OPT_OUT_VARIABLE)
    return raw is not None and raw.strip().casefold() in _AFFIRMATIVE


def enable_fault_handler(stderr: Optional[IO[str]] = None) -> bool:
    """Request process-wide fatal tracebacks as a best-effort startup aid.

    A supplied stream remains owned by the caller and must outlive the process;
    the runtime retains its descriptor for signal-time writes.
    """
    if _was_opted_out():
        return False
    destination = stderr if stderr is not None else sys.stderr
    try:
        faulthandler.enable(file=destination, all_threads=True)
    except Exception:
        return False
    return True
