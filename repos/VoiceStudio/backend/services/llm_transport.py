"""Provider SDK adapters. Importing the catalogue never imports cloud SDKs."""
from __future__ import annotations

import os
import atexit
from functools import lru_cache
from http.cookiejar import CookieJar, DefaultCookiePolicy
from types import SimpleNamespace


class _NoCookies(DefaultCookiePolicy):
    def set_ok(self, cookie, request):
        return False

    def return_ok(self, cookie, request):
        return False


def _is_loopback(host):
    from ipaddress import ip_address
    if host.lower() == "localhost":
        return True
    try:
        return ip_address(host).is_loopback
    except ValueError:
        return False


def _check_sdk_request(request):
    """Validate the effective URL after SDK environment/provider resolution."""
    if request.url.scheme == "https":
        return
    if request.url.scheme != "http" or not _is_loopback(request.url.host):
        raise ValueError("SDK provider requests require HTTPS outside localhost")


def _sdk_http_client():
    # Settings can update proxies without restarting the backend. Retire the
    # previous pool without closing responses still being streamed from it.
    keys = ("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY",
            "http_proxy", "https_proxy", "all_proxy", "no_proxy",
            "SSL_CERT_FILE", "SSL_CERT_DIR", "REQUEST_METHOD")
    return _sdk_http_client_for_env(tuple(os.environ.get(key) for key in keys))


@lru_cache(maxsize=1)
def _sdk_http_client_for_env(network_env):
    # A shared thread-safe pool also keeps streaming responses alive after
    # completion() returns. It carries no provider credentials of its own.
    import httpx
    class DirectLoopbackClient(httpx.Client):
        def _transport_for_url(self, url):
            # Route every loopback address directly, including 127/8 and ::1.
            # Preserve HTTPX's environment proxy/NO_PROXY routing elsewhere.
            if _is_loopback(url.host):
                return self._transport
            return super()._transport_for_url(url)

    client = DirectLoopbackClient(
        follow_redirects=False,
        cookies=CookieJar(policy=_NoCookies()),
        event_hooks={"request": [_check_sdk_request]},
    )
    atexit.register(client.close)
    return client


def _configure_sdk_http(litellm, model, kwargs):
    client = _sdk_http_client()
    # OpenAI-compatible SDK adapters use LiteLLM's documented shared session.
    litellm.client_session = client
    if model.split("/", 1)[0] in {"anthropic", "bedrock", "vertex_ai"}:
        # Native adapters accept HTTPHandler instead of an OpenAI SDK client.
        from litellm.llms.custom_httpx.http_handler import HTTPHandler
        kwargs["client"] = HTTPHandler(client=client)


def create_client(provider):
    from services import llm_providers as registry
    error = registry.credential_transport_error(provider)
    if error:
        raise ValueError(error)
    if provider.transport == "openai":
        from openai import OpenAI
        return OpenAI(api_key=registry.resolve_api_key(provider),
                      base_url=registry.resolve_base_url(provider), max_retries=0)
    if provider.transport == "cli":
        from services.llm_cli import completion
        create = lambda **kwargs: completion(provider, **kwargs)
    else:
        create = lambda **kwargs: sdk_completion(provider, **kwargs)
    return SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))


def sdk_completion(provider, **kwargs):
    # LiteLLM's remote pricing fetch and telemetry are unnecessary for inference.
    # Set before its lazy import; opening settings must never trigger either.
    os.environ["LITELLM_LOCAL_MODEL_COST_MAP"] = "True"
    os.environ["LITELLM_TELEMETRY"] = "False"
    import litellm
    from services import llm_providers as registry
    error = registry.credential_transport_error(provider)
    if error:
        raise ValueError(error)
    litellm.telemetry = False
    model = kwargs.pop("model")
    prefix = provider.sdk_provider
    if prefix and not model.startswith(prefix + "/"):
        model = prefix + "/" + model
    key = registry.resolve_api_key(provider)
    base = registry.resolve_base_url(provider)
    if key and key != "local":
        kwargs["aws_bearer_token_bedrock" if provider.id == "bedrock" else "api_key"] = key
    if base:
        kwargs["api_base"] = base
    if provider.id == "vertex":
        kwargs["vertex_project"] = registry.resolve_account_id(provider)
        kwargs["vertex_location"] = os.environ.get("VERTEXAI_LOCATION", "global")
    _configure_sdk_http(litellm, model, kwargs)
    kwargs.update(num_retries=0, drop_params=True)
    return litellm.completion(model=model, **kwargs)
