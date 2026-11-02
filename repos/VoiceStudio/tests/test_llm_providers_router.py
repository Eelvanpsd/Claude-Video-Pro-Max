"""Router surface for /api/settings/llm-providers (v0.3.9 testing pass).

`tests/test_llm_providers.py` covers the registry service; these cover the
router handlers the UI calls — the /test probe's error classification
(kind: config/auth/not_found/rate_limit/network/error + latency_ms) and the
/models discovery endpoint, with the OpenAI client faked at the SDK boundary
(no network) and settings_store backed by in-memory dicts (house convention,
same as test_llm_providers.py — direct handler calls, no TestClient, so the
loopback auth guard isn't in play).
"""
from __future__ import annotations

import os
import sys
import types

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))

os.environ.setdefault("OMNIVOICE_MODEL", "test")
os.environ.setdefault("OMNIVOICE_DISABLE_FILE_LOG", "1")

_HAS_OPENAI = __import__("importlib").util.find_spec("openai") is not None
pytestmark = pytest.mark.skipif(not _HAS_OPENAI, reason="openai package not installed")


@pytest.fixture
def settings_mod(monkeypatch, clean_llm_env):
    """Router module with settings_store in-memory (no SQLite, no prefs I/O).

    clean_llm_env (conftest) clears the FULL provider env surface so probes
    resolve only the seeded in-memory state, not ambient/.env keys (#878).
    """
    from services import settings_store as ss

    text: dict[str, str] = {}
    secrets: dict[str, str] = {}
    monkeypatch.setattr(ss, "get_text", lambda k, default=None: text.get(k, default))
    monkeypatch.setattr(ss, "set_text", lambda k, v: text.__setitem__(k, v))
    monkeypatch.setattr(ss, "get_secret", lambda n: secrets.get(n))
    monkeypatch.setattr(ss, "set_secret", lambda n, v: secrets.__setitem__(n, v) if v else secrets.pop(n, None))
    monkeypatch.setattr(ss, "list_secret_names", lambda: list(secrets))
    import importlib
    return importlib.import_module("api.routers.settings")


def _fake_openai(monkeypatch, *, reply="ok", models=None, raise_exc=None):
    """Fake `openai.OpenAI` with canned chat/models behavior.

    Returns a list that captures each client's construction kwargs so a test can
    assert the interactive probes disable the SDK's automatic retries
    (max_retries=0) — the default 2 retries turned a 429 into a ~34s hang.
    """
    captured_kwargs: list[dict] = []

    class _Msg:
        def __init__(self, content):
            self.message = types.SimpleNamespace(content=content)

    class _FakeClient:
        def __init__(self, **kwargs):
            captured_kwargs.append(kwargs)
            self.chat = types.SimpleNamespace(
                completions=types.SimpleNamespace(create=self._create))
            self.models = types.SimpleNamespace(list=self._models)

        def _create(self, **kw):
            if raise_exc is not None:
                raise raise_exc
            return types.SimpleNamespace(choices=[_Msg(reply)])

        def _models(self, **kw):
            if raise_exc is not None:
                raise raise_exc
            return [types.SimpleNamespace(id=m) for m in (models or [])]

    import openai
    monkeypatch.setattr(openai, "OpenAI", _FakeClient)
    return captured_kwargs


def _configure_groq(settings_mod, key="gsk-test-123"):
    settings_mod.save_llm_provider(
        "groq", settings_mod._LLMProviderBody(api_key=key, make_active=True))


# ── list / save ─────────────────────────────────────────────────────────────

def test_list_never_leaks_keys(settings_mod):
    _configure_groq(settings_mod)
    body = settings_mod.list_llm_providers()
    assert body["active"] == "groq"
    groq = next(p for p in body["providers"] if p["id"] == "groq")
    assert groq["has_key"] is True and groq["configured"] is True
    assert "gsk-test-123" not in str(body)  # the key never round-trips


def test_connect_verifies_provider_before_enabling_engine(settings_mod, monkeypatch):
    from core import prefs
    from services import llm_providers
    prefs.set_("llm_backend", "off")
    settings_mod.save_llm_provider("ollama", settings_mod._LLMProviderBody(activate_if_unset=False))
    def probe(pid):
        assert pid == "ollama"
        assert prefs.get("llm_backend") == "off"
        assert llm_providers.stored_active_provider_id() is None
        return {"ok": True, "model": "llama3.1", "latency_ms": 5}
    monkeypatch.setattr(settings_mod, "test_llm_provider", probe)
    assert settings_mod.connect_llm_provider("ollama")["ok"] is True
    assert prefs.get("llm_backend") == "openai-compat"
    assert settings_mod.list_llm_providers()["engine_active"] == "openai-compat"


def test_failed_connect_does_not_enable_engine(settings_mod, monkeypatch):
    from core import prefs
    prefs.set_("llm_backend", "off")
    monkeypatch.setattr(settings_mod, "test_llm_provider", lambda pid: {"ok": False, "kind": "network"})
    assert settings_mod.connect_llm_provider("ollama") == {"ok": False, "kind": "network"}
    assert prefs.get("llm_backend") == "off"
    assert settings_mod.list_llm_providers()["active"] is None


def test_first_editor_save_cannot_auto_enable_cloud_before_verification(settings_mod):
    from core import prefs
    from services import llm_backend, llm_skills
    prefs.delete("llm_backend")
    settings_mod.save_llm_provider("groq", settings_mod._LLMProviderBody(
        api_key="gsk-test", activate_if_unset=False))
    assert llm_backend.active_backend_id() == "off"
    assert not llm_skills.resolve_skill("dub_translation").ready


def test_connect_pin_rejection_never_probes(settings_mod, monkeypatch):
    from fastapi import HTTPException
    monkeypatch.setenv("OMNIVOICE_LLM_BACKEND", "off")
    monkeypatch.setattr(settings_mod, "test_llm_provider", lambda pid: pytest.fail("blocked connection probed"))
    with pytest.raises(HTTPException) as err:
        settings_mod.connect_llm_provider("ollama")
    assert err.value.status_code == 409


def test_connect_does_not_activate_settings_edited_during_verification(settings_mod, monkeypatch):
    from core import prefs
    from services import llm_providers
    prefs.set_("llm_backend", "off")
    def probe(pid):
        llm_providers.save_overrides(pid, model="different-model")
        return {"ok": True, "model": "llama3.1"}
    monkeypatch.setattr(settings_mod, "test_llm_provider", probe)
    assert settings_mod.connect_llm_provider("ollama") == {"ok": False, "kind": "config"}
    assert prefs.get("llm_backend") == "off"


def test_explicit_activation_enables_llm_engine(settings_mod):
    from core import prefs
    prefs.set_("llm_backend", "off")
    _configure_groq(settings_mod)
    from services.llm_backend import active_backend_id
    assert active_backend_id() == "openai-compat"


def test_editor_save_can_preserve_empty_active_slot(settings_mod):
    settings_mod.save_llm_provider("ollama", settings_mod._LLMProviderBody(activate_if_unset=False))
    assert settings_mod.list_llm_providers()["active"] is None


def test_activation_rejects_incomplete_provider_without_changing_selection(settings_mod):
    from fastapi import HTTPException
    _configure_groq(settings_mod)
    with pytest.raises(HTTPException) as err:
        settings_mod.save_llm_provider("custom", settings_mod._LLMProviderBody(
            base_url="http://localhost:1234/v1", make_active=True))
    assert err.value.status_code == 400
    assert settings_mod.list_llm_providers()["active"] == "groq"


@pytest.mark.parametrize("pin,value", [("LLM_DEFAULT_PROVIDER", "groq"), ("OMNIVOICE_LLM_BACKEND", "off")])
def test_activation_honors_environment_pins(settings_mod, monkeypatch, pin, value):
    from fastapi import HTTPException
    monkeypatch.setenv(pin, value)
    with pytest.raises(HTTPException) as err:
        settings_mod.save_llm_provider("ollama", settings_mod._LLMProviderBody(make_active=True))
    assert err.value.status_code == 409


@pytest.mark.parametrize("reply", ["", "   ", "<think>reasoning only</think>"])
def test_probe_requires_usable_answer(settings_mod, monkeypatch, reply):
    _configure_groq(settings_mod)
    _fake_openai(monkeypatch, reply=reply)
    assert settings_mod.test_llm_provider("groq")["ok"] is False


def test_custom_models_can_be_fetched_before_selecting_model(settings_mod, monkeypatch):
    settings_mod.save_llm_provider("custom", settings_mod._LLMProviderBody(base_url="http://localhost:1234/v1"))
    clients = _fake_openai(monkeypatch, models=["chat-model"])
    assert settings_mod.test_llm_provider("custom")["kind"] == "config"
    assert clients == []
    assert settings_mod.list_llm_provider_models("custom")["models"] == ["chat-model"]


def test_engine_inventory_does_not_probe_lmstudio(settings_mod, monkeypatch):
    from services import llm_providers, llm_backend
    from api.routers.engines import _family_payload
    llm_providers.set_active_provider("lmstudio")
    monkeypatch.setattr(llm_providers, "discover_model", lambda p: pytest.fail("inventory probed a provider"))
    assert _family_payload("llm", llm_backend)["active_model"] == ""


def test_local_http_provider_setup_to_skill_completion(settings_mod, monkeypatch):
    """Exercise the real SDK transport across setup, probing and feature use."""
    import json
    import threading
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
    from services import llm_backend, llm_skills
    from core import prefs

    for name in ("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"):
        monkeypatch.delenv(name, raising=False)
    requests = []

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def respond(self, payload):
            raw = json.dumps(payload).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)

        def do_GET(self):
            requests.append((self.path, self.headers.get("Authorization"), None))
            self.respond({"object": "list", "data": [{"id": "local-chat", "object": "model", "created": 0, "owned_by": "local"}]})

        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            requests.append((self.path, self.headers.get("Authorization"), body))
            self.respond({"id": "test", "object": "chat.completion", "created": 0, "model": "local-chat",
                          "choices": [{"index": 0, "message": {"role": "assistant", "content": "Bonjour"}, "finish_reason": "stop"}]})

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    try:
        prefs.set_("llm_backend", "off")
        settings_mod.save_llm_provider("custom", settings_mod._LLMProviderBody(
            base_url=f"http://127.0.0.1:{server.server_port}/v1", api_key="local-test-key",
            activate_if_unset=False))
        assert requests == []
        assert settings_mod.list_llm_provider_models("custom")["models"] == ["local-chat"]
        settings_mod.save_llm_provider("custom", settings_mod._LLMProviderBody(model="local-chat", activate_if_unset=False))
        assert settings_mod.connect_llm_provider("custom")["ok"] is True
        backend = llm_skills.skill_backend("dub_translation")
        assert backend.id == "openai-compat"
        assert backend.chat(system="Translate to French", user="Hello") == "Bonjour"
        handle = llm_skills.resolve_skill_client("cinematic_translation")
        assert handle is not None and handle.model == "local-chat"
        result = handle.client.chat.completions.create(model=handle.model, messages=[{"role": "user", "content": "Hello"}])
        assert result.choices[0].message.content == "Bonjour"
        handle.client.close()
        assert llm_backend.active_backend_id() == "openai-compat"
        assert all(auth == "Bearer local-test-key" for _, auth, _ in requests)
        assert [path for path, _, _ in requests] == ["/v1/models"] + ["/v1/chat/completions"] * 3
        assert all(body["model"] == "local-chat" for _, _, body in requests if body)
    finally:
        server.shutdown()
        server.server_close()
        worker.join(timeout=5)


def test_unknown_provider_404s(settings_mod):
    from fastapi import HTTPException
    with pytest.raises(HTTPException):
        settings_mod.test_llm_provider("nope")
    with pytest.raises(HTTPException):
        settings_mod.list_llm_provider_models("nope")


# ── #963: explicit save claims the empty active slot (survives restart) ─────

def test_plain_save_activates_when_nothing_chosen(settings_mod):
    # Fresh store: the user saves Ollama WITHOUT clicking "use for
    # translation". Local providers are excluded from auto-select, so unless
    # the explicit save claims the empty slot the choice evaporates on
    # restart — the "Ollama works until I restart" bug.
    settings_mod.save_llm_provider(
        "ollama", settings_mod._LLMProviderBody(make_active=False))
    assert settings_mod.list_llm_providers()["active"] == "ollama"


def test_plain_save_never_steals_active(settings_mod):
    _configure_groq(settings_mod)  # explicit prior choice: groq
    settings_mod.save_llm_provider(
        "ollama", settings_mod._LLMProviderBody(make_active=False))
    assert settings_mod.list_llm_providers()["active"] == "groq"


def test_make_active_still_flips(settings_mod):
    _configure_groq(settings_mod)
    settings_mod.save_llm_provider(
        "ollama", settings_mod._LLMProviderBody(make_active=True))
    assert settings_mod.list_llm_providers()["active"] == "ollama"


def test_unconfigured_save_does_not_claim_active(settings_mod):
    # openai with no key isn't usable — a plain save of it must not make it
    # the (broken) active provider.
    settings_mod.save_llm_provider(
        "openai", settings_mod._LLMProviderBody(model="gpt-4o-mini", make_active=False))
    assert settings_mod.list_llm_providers()["active"] is None


# ── /test probe ─────────────────────────────────────────────────────────────

def test_probe_ok_includes_latency(settings_mod, monkeypatch):
    _configure_groq(settings_mod)
    _fake_openai(monkeypatch, reply="ok")
    body = settings_mod.test_llm_provider("groq")
    assert body["ok"] is True and body["reply"] == "ok"
    assert isinstance(body["latency_ms"], int) and body["latency_ms"] >= 0


def test_probe_unconfigured_is_kind_config(settings_mod):
    # openai: no key stored, env cleared → config guidance, no network attempt
    body = settings_mod.test_llm_provider("openai")
    assert body["ok"] is False and body["kind"] == "config"


@pytest.mark.parametrize("status,kind", [(401, "auth"), (403, "auth"), (429, "rate_limit"), (404, "not_found")])
def test_cli_bridge_http_failures_keep_their_classification(settings_mod, status, kind):
    from urllib.error import HTTPError
    assert settings_mod._classify_llm_error(HTTPError("http://127.0.0.1", status, "failed", {}, None)) == kind


@pytest.mark.parametrize("provider,read_timeout", [("ollama", 120), ("groq", 20)])
def test_probe_allows_local_cold_start_with_bounded_connection(settings_mod, monkeypatch, provider, read_timeout):
    import openai
    _configure_groq(settings_mod)
    def create(**kwargs):
        assert kwargs["timeout"].read == read_timeout
        assert kwargs["timeout"].connect == 5
        return types.SimpleNamespace(choices=[types.SimpleNamespace(message=types.SimpleNamespace(content="ok"))])
    monkeypatch.setattr(openai, "OpenAI", lambda **kwargs: types.SimpleNamespace(
        chat=types.SimpleNamespace(completions=types.SimpleNamespace(create=create))))
    assert settings_mod.test_llm_provider(provider)["ok"] is True


@pytest.mark.parametrize("exc_name,status,expected_kind", [
    ("AuthenticationError", 401, "auth"),
    ("NotFoundError", 404, "not_found"),
    ("RateLimitError", 429, "rate_limit"),
    ("APIConnectionError", None, "network"),
    ("ValueError", None, "error"),
])
def test_probe_classifies_failures(settings_mod, monkeypatch, exc_name, status, expected_kind):
    _configure_groq(settings_mod)
    exc = type(exc_name, (Exception,), {})()
    if status is not None:
        exc.status_code = status
    _fake_openai(monkeypatch, raise_exc=exc)
    body = settings_mod.test_llm_provider("groq")
    assert body["ok"] is False
    assert body["kind"] == expected_kind
    assert "latency_ms" in body


def test_probe_failure_detail_is_scrubbed(settings_mod, monkeypatch):
    _configure_groq(settings_mod)
    _fake_openai(monkeypatch, raise_exc=RuntimeError(
        "boom key=gsk-test-123 at /Users/someone/secret"))
    body = settings_mod.test_llm_provider("groq")
    assert body["ok"] is False
    assert body["detail"] == "The provider request failed. Try again."
    assert "gsk-test-123" not in repr(body)
    assert "/Users/someone" not in repr(body)


# ── /models discovery ───────────────────────────────────────────────────────

def test_models_lists_sorted_ids(settings_mod, monkeypatch):
    _configure_groq(settings_mod)
    _fake_openai(monkeypatch, models=["zeta", "alpha", "mid"])
    body = settings_mod.list_llm_provider_models("groq")
    assert body["ok"] is True
    assert body["models"] == ["alpha", "mid", "zeta"]


def test_models_unconfigured_is_kind_config(settings_mod):
    body = settings_mod.list_llm_provider_models("openai")
    assert body == {"ok": False, "kind": "config", "models": []}


def test_models_failure_is_classified(settings_mod, monkeypatch):
    _configure_groq(settings_mod)
    exc = type("AuthenticationError", (Exception,), {})()
    exc.status_code = 401
    _fake_openai(monkeypatch, raise_exc=exc)
    body = settings_mod.list_llm_provider_models("groq")
    assert body["ok"] is False and body["kind"] == "auth" and body["models"] == []
    assert body["detail"] == "Authentication failed. Check the provider API key."


def test_models_failure_omits_trace_path_and_secret(settings_mod, monkeypatch):
    _configure_groq(settings_mod)
    private = "Traceback: key=gsk-test-123 at /home/alice/provider.py"
    _fake_openai(monkeypatch, raise_exc=RuntimeError(private))
    body = settings_mod.list_llm_provider_models("groq")
    assert body["kind"] == "error"
    assert body["detail"] == "The provider request failed. Try again."
    assert private not in repr(body)


def test_models_not_truncated_under_cap(settings_mod, monkeypatch):
    _configure_groq(settings_mod)
    _fake_openai(monkeypatch, models=[f"m{i}" for i in range(5)])
    body = settings_mod.list_llm_provider_models("groq")
    assert body["ok"] is True and body["truncated"] is False and len(body["models"]) == 5


def test_models_truncated_over_cap(settings_mod, monkeypatch):
    # >200 model ids → capped + flagged so the UI can say "first 200 shown".
    _configure_groq(settings_mod)
    _fake_openai(monkeypatch, models=[f"m{i:03d}" for i in range(250)])
    body = settings_mod.list_llm_provider_models("groq")
    assert body["ok"] is True and body["truncated"] is True and len(body["models"]) == 200


# ── probes fail fast (no 34s hang on the SDK's default retry ladder) ─────────

def test_probe_disables_sdk_retries(settings_mod, monkeypatch):
    _configure_groq(settings_mod)
    captured = _fake_openai(monkeypatch, reply="ok")
    settings_mod.test_llm_provider("groq")
    assert captured and captured[-1].get("max_retries") == 0


def test_models_disables_sdk_retries(settings_mod, monkeypatch):
    _configure_groq(settings_mod)
    captured = _fake_openai(monkeypatch, models=["a"])
    settings_mod.list_llm_provider_models("groq")
    assert captured and captured[-1].get("max_retries") == 0


def test_connect_rejects_account_changed_during_probe(settings_mod, monkeypatch):
    from core import prefs
    from services import llm_providers
    prefs.set_("llm_backend", "off")
    account = ["verified-project"]
    monkeypatch.setattr(llm_providers, "resolve_account_id", lambda p: account[0])
    def probe(pid):
        account[0] = "unverified-project"
        return {"ok": True}
    monkeypatch.setattr(settings_mod, "test_llm_provider", probe)
    assert settings_mod.connect_llm_provider("ollama") == {"ok": False, "kind": "config"}
    assert prefs.get("llm_backend") == "off"


def test_unknown_provider_is_not_reported_as_environment_pin(settings_mod, monkeypatch):
    from fastapi import HTTPException
    monkeypatch.setenv("LLM_DEFAULT_PROVIDER", "ollama")
    with pytest.raises(HTTPException) as error:
        settings_mod.connect_llm_provider("missing-provider")
    assert error.value.status_code == 404
