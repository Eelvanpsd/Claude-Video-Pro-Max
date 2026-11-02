"""Text completion via Electron's existing repair/translation agent runner."""
from __future__ import annotations

import json
import os
import urllib.request
from types import SimpleNamespace
from urllib.parse import urlsplit


def executable(agent: str) -> bool:
    # Electron owns discovery (including Windows npm shims) and process lifetime.
    try:
        return agent in json.loads(os.environ.get("VOICESTUDIO_LLM_AGENTS", "[]"))
    except (ValueError, TypeError):
        return False


def completion(provider, *, model, messages, timeout=120, stream=False, **_):
    base = os.environ.get("VOICESTUDIO_LLM_AGENT_URL", "")
    token = os.environ.get("VOICESTUDIO_LLM_AGENT_TOKEN", "")
    url = urlsplit(base)
    if url.scheme != "http" or url.hostname != "127.0.0.1" or not token:
        raise RuntimeError("CLI providers require the running Electron desktop.")
    seconds = float(getattr(timeout, "read", timeout) or 120)
    payload = {"agent": provider.sdk_provider, "model": model, "messages": messages,
               "timeoutMs": min(600_000, max(1_000, int(seconds * 1000)))}
    request = urllib.request.Request(base + "/complete", data=json.dumps(payload).encode(),
        headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
    # Never send the local capability to an ambient proxy or follow redirects.
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args, **kwargs):
            return None
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    with opener.open(request, timeout=seconds + 2) as response:
        body = json.loads(response.read(1_000_001))
    text = body.get("text")
    if not isinstance(text, str) or not text.strip():
        raise ValueError("The CLI returned no usable answer.")
    if stream:
        return iter([SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content=text))])])
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=text))])
