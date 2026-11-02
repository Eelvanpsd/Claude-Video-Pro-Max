"""IndexTTS2 emotion controls reach both classic and streaming /generate.

All tests use an in-memory TTS adapter. No model downloads or GPU are needed:
the IndexTTS2 sidecar's priority / strength behavior is covered separately in
tests/backend/services/test_indextts_sidecar.py.
"""
import json
import os
import uuid
import wave
from typing import ClassVar

import pytest
import torch

os.environ.setdefault("OMNIVOICE_MODEL", "test")
os.environ.setdefault("OMNIVOICE_DISABLE_FILE_LOG", "1")


@pytest.fixture()
def client():
    """Return a loopback HTTP client without loading speech models."""
    from fastapi.testclient import TestClient
    from main import app

    return TestClient(app, client=("127.0.0.1", 50000))


@pytest.fixture()
def engine(monkeypatch):
    """Register a fake emotion-capable backend and capture forwarded kwargs."""
    from services import tts_backend

    class EmotionEngine(tts_backend.TTSBackend):
        id = "emotion-clone-test"
        display_name = "IndexTTS emotion test adapter"
        supports_emotion = True
        supports_cloning = True
        gpu_compat = ("cpu",)
        calls: ClassVar[list] = []

        @classmethod
        def is_available(cls):
            """Report a local stub that is immediately ready for generation."""
            return True, "ready"

        @property
        def sample_rate(self):
            """Match the 24 kHz output of the test waveform."""
            return 24000

        @property
        def supported_languages(self):
            """Permit synthetic multilingual requests without model downloads."""
            return ["multi"]

        def generate(self, text, **kw):
            """Record emotion options and return a fixed test WAV tensor."""
            type(self).calls.append((text, kw))
            return torch.zeros(1, 2400)

    monkeypatch.setitem(tts_backend._REGISTRY, EmotionEngine.id, EmotionEngine)
    yield EmotionEngine
    EmotionEngine.calls.clear()


def test_text_emotion_reaches_cloned_speech_without_leaking_to_other_options(client, engine):
    """Pass prose and intensity unchanged through classic synthesis."""
    res = client.post("/generate", data={
        "text": "I never forgot that day.",
        "engine": engine.id,
        "emo_text": "quietly relieved, slightly trembling",
        "emo_alpha": "0.45",
    })
    assert res.status_code == 200, res.text
    assert res.headers.get("content-type") == "audio/wav"
    assert len(engine.calls) == 1
    kw = engine.calls[0][1]
    assert kw["emo_text"] == "quietly relieved, slightly trembling"
    assert kw["emo_alpha"] == 0.45
    assert "emo_vector" not in kw


def test_eight_weights_reach_the_engine_as_numbers(client, engine):
    """Serialize all eight numbers without adding text emotion fields."""
    weights = [0.8, 0, 0.1, 0, 0, 0.2, 0, 0]
    res = client.post("/generate", data={
        "text": "Expressive sentence", "engine": engine.id,
        "emo_vector": json.dumps(weights),
    })
    assert res.status_code == 200, res.text
    assert engine.calls[0][1]["emo_vector"] == weights
    assert "emo_text" not in engine.calls[0][1]
    assert "emo_alpha" not in engine.calls[0][1]


@pytest.mark.parametrize("payload", [
    {"emo_vector": "[1,2]"},
    {"emo_vector": "[true,0,0,0,0,0,0,0]"},
    {"emo_vector": "[1.1,0,0,0,0,0,0,0]"},
    # math.isfinite(10 ** 399) raises OverflowError unless bounds run first.
    {"emo_vector": "[" + "9" * 400 + ",0,0,0,0,0,0,0]"},
    {"emo_vector": "[-" + "9" * 400 + ",0,0,0,0,0,0,0]"},
    {"emo_vector": "[-0.1,0,0,0,0,0,0,0]"},
    {"emo_vector": '["a",0,0,0,0,0,0,0]'},
    {"emo_vector": "[NaN,0,0,0,0,0,0,0]"},
    {"emo_vector": "{broken"},
    {"emo_text": "sad", "emo_vector": json.dumps([0] * 8)},
    {"emo_alpha": "0.7"},
    {"emo_text": "sad", "emo_alpha": "1.5"},
    {"emo_text": "sad", "emo_alpha": "NaN"},
    {"emo_text": "a" * 501},
])
def test_bad_emotion_is_rejected_before_model_load(client, engine, payload):
    """Reject malformed, conflicting or huge inputs before GPU inference."""
    res = client.post("/generate", data={
        "text": "Request rejected", "engine": engine.id, **payload,
    })
    assert res.status_code == 422, res.text
    assert engine.calls == []


def test_unsupported_engine_refuses_emotion_instead_of_ignoring_it(client, engine, monkeypatch):
    """Return HTTP 422 instead of silently losing the requested delivery."""
    from services import tts_backend

    class PlainEngine(engine):
        id = "plain-emotion-test"
        supports_emotion = False
        calls: ClassVar[list] = []

    monkeypatch.setitem(tts_backend._REGISTRY, PlainEngine.id, PlainEngine)
    res = client.post("/generate", data={
        "text": "No emotion", "engine": PlainEngine.id,
        "emo_text": "very angry",
    })
    assert res.status_code == 422, res.text
    assert "does not support" in res.json()["detail"]
    assert PlainEngine.calls == []


def test_omitting_emotion_keeps_the_original_backend_contract(client, engine):
    """Keep neutral generation backwards compatible with legacy adapters."""
    res = client.post("/generate", data={"text": "Neutral", "engine": engine.id})
    assert res.status_code == 200
    kw = engine.calls[0][1]
    assert "emo_text" not in kw and "emo_vector" not in kw and "emo_alpha" not in kw


@pytest.mark.parametrize("stream,chunked", [(True, False), (True, True), (False, False)])
def test_emotion_reaches_every_generation_path(client, engine, stream, chunked):
    """Carry emotion through single-shot, streamed and multi-chunk rendering."""
    text = (
        "First sentence is read. Second sentence follows. Third sentence ends."
        if chunked else "One short line."
    )
    res = client.post("/generate", data={
        "text": text, "engine": engine.id,
        "emo_text": "a soft, melancholy delivery", "emo_alpha": "0.35",
        "stream": str(stream).lower(),
        "max_chunk_chars": "28" if chunked else "800",
    })
    assert res.status_code == 200, res.text[:1000]
    if stream:
        events = [json.loads(row) for row in res.text.splitlines()]
        assert events[-1]["type"] == "done"
    if chunked:
        assert len(engine.calls) > 1
    for _, kwargs in engine.calls:
        assert kwargs["emo_text"] == "a soft, melancholy delivery"
        assert kwargs["emo_alpha"] == 0.35


def test_emotion_is_passed_when_cloning_a_saved_voice(client, engine):
    """Apply per-take emotion while honoring the saved timbre reference."""
    from core.config import VOICES_DIR
    from core.db import db_conn

    pid = "em-" + uuid.uuid4().hex[:8]
    os.makedirs(VOICES_DIR, exist_ok=True)
    filename = pid + ".wav"
    path = os.path.join(VOICES_DIR, filename)
    with wave.open(path, "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(24000)
        out.writeframes(b"\\x01\\x00" * 12000)
    with db_conn() as conn:
        conn.execute(
            "INSERT INTO voice_profiles (id, name, kind, ref_audio_path, ref_text, created_at) "
            "VALUES (?, 'Test speaker', 'clone', ?, 'Reference text', 1)",
            (pid, filename),
        )
    try:
        res = client.post("/generate", data={
            "text": "This is a happy line", "engine": engine.id,
            "profile_id": pid, "emo_vector": json.dumps([1, 0, 0, 0, 0, 0, 0, 0]),
        })
        assert res.status_code == 200, res.text
        assert engine.calls and engine.calls[-1][1]["emo_vector"][0] == 1
        assert engine.calls[-1][1]["ref_audio"] == path
    finally:
        with db_conn() as conn:
            conn.execute("DELETE FROM generation_history WHERE profile_id=?", (pid,))
            conn.execute("DELETE FROM voice_profiles WHERE id=?", (pid,))
        os.remove(path)
