"""A damaged source must fail with an actionable error before FFmpeg runs."""
from __future__ import annotations

import asyncio
import errno
import io
import json
from types import SimpleNamespace
from pathlib import Path

import pytest



def test_zeroed_header_is_rejected_without_invoking_ffmpeg(tmp_path):
    from core import failure
    from services.ffmpeg_utils import validate_media_source
    source = tmp_path / "original.mkv"
    source.write_bytes(b"\0" * 4096 + b"remaining data")

    with pytest.raises(failure.InvalidMediaFileError, match="damaged or incomplete"):
        validate_media_source(str(source))


def test_valid_media_header_is_left_for_ffmpeg_to_probe(tmp_path):
    from services.ffmpeg_utils import validate_media_source
    source = tmp_path / "original.mkv"
    source.write_bytes(bytes.fromhex("1a45dfa3") + b"matroska payload")
    validate_media_source(str(source))


def test_ffmpeg_unreadable_container_gets_the_same_guidance(tmp_path, monkeypatch):
    from core import failure
    from services.ffmpeg_utils import raise_for_audio_extract_failure
    source = tmp_path / "original.mkv"
    source.write_bytes(b"nonzero but damaged header")
    monkeypatch.setattr("services.ffmpeg_utils.has_audio_stream", lambda _: None)

    with pytest.raises(failure.InvalidMediaFileError):
        raise_for_audio_extract_failure(
            b"EBML header parsing failed\nError opening input: Invalid data found when processing input",
            str(source),
        )


def test_zeroed_source_emits_actionable_extract_failure(tmp_path, monkeypatch):
    from services import dub_pipeline
    job_dir = tmp_path / "job"
    job_dir.mkdir()
    source = job_dir / "original.mkv"
    source.write_bytes(b"\0" * 4096 + b"remaining data")
    monkeypatch.setattr(dub_pipeline, "find_ffmpeg", lambda: "ffmpeg")
    monkeypatch.setattr(dub_pipeline, "DUB_DIR", str(tmp_path))

    async def collect():
        return [event async for event in dub_pipeline.ingest_pipeline(
            "corrupt_source", str(job_dir), {"kind": "file", "path": str(source)}
        )]

    events = [json.loads(event.removeprefix("data: ")) for event in asyncio.run(collect())]
    error = next(event for event in events if event["type"] == "error")
    assert error["stage"] == "extract"
    assert error["docs_topic"] == "INVALID_MEDIA_FILE"
    assert "fresh copy" in error["hint"].lower()
    assert "FFmpeg exited" not in error["reason"]
    assert not source.exists(), "discard the failed job copy so retries do not fill the disk"


def test_failed_copy_cleanup_never_removes_external_source(tmp_path, monkeypatch):
    from services import dub_pipeline
    job_dir = tmp_path / "dub_jobs" / "job"
    job_dir.mkdir(parents=True)
    original = tmp_path / "original.mkv"
    original.write_bytes(b"\0" * 4096)
    monkeypatch.setattr(dub_pipeline, "DUB_DIR", str(job_dir.parent))

    dub_pipeline._discard_invalid_source_copy(str(job_dir), str(original))

    assert original.exists()


def test_upload_disk_full_removes_partial_copy(tmp_path, monkeypatch):
    from fastapi import HTTPException, UploadFile
    from api.routers import dub_core

    job_dir = tmp_path / "job"
    monkeypatch.setattr(dub_core, "_safe_job_dir", lambda _: str(job_dir))
    monkeypatch.setattr(dub_core.shutil, "disk_usage", lambda _: SimpleNamespace(free=10**12))

    def interrupted_copy(source, target, length):
        target.write(source.read(2))
        raise OSError(errno.ENOSPC, "No space left on device")

    monkeypatch.setattr(dub_core.shutil, "copyfileobj", interrupted_copy)
    upload = UploadFile(file=io.BytesIO(b"test media"), filename="clip.mkv", size=10)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(dub_core.dub_upload(
            video=upload, job_id="job", input_type="video", source_lang=None,
        ))

    assert exc.value.status_code == 507
    assert "disk space" in exc.value.detail["message"].lower()
    assert exc.value.detail["docs_topic"] == "AUDIO_IO_FAILED"
    assert not (job_dir / "original.mkv").exists()


def test_upload_checks_free_space_before_copy(tmp_path, monkeypatch):
    from fastapi import HTTPException, UploadFile
    from api.routers import dub_core

    job_dir = tmp_path / "job"
    monkeypatch.setattr(dub_core, "_safe_job_dir", lambda _: str(job_dir))
    monkeypatch.setattr(dub_core.shutil, "disk_usage", lambda _: SimpleNamespace(free=4))
    upload = UploadFile(file=io.BytesIO(b"test media"), filename="clip.mkv", size=10)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(dub_core.dub_upload(
            video=upload, job_id="job", input_type="video", source_lang=None,
        ))

    assert exc.value.status_code == 507
    assert exc.value.detail["code"] == "dub_upload_disk_full"
    assert not (job_dir / "original.mkv").exists()


def test_duplicate_upload_cannot_touch_existing_job(tmp_path, monkeypatch):
    from fastapi import HTTPException, UploadFile
    from api.routers import dub_core
    job_dir = tmp_path / "job"
    job_dir.mkdir()
    original = job_dir / "original.mkv"
    original.write_bytes(b"completed source")
    monkeypatch.setattr(dub_core, "_safe_job_dir", lambda _: str(job_dir))
    monkeypatch.setattr(dub_core.shutil, "disk_usage", lambda _: SimpleNamespace(free=10**12))
    def broken_copy(source, target, length):
        target.write(b"partial")
        raise OSError(errno.ENOSPC, "full")
    monkeypatch.setattr(dub_core.shutil, "copyfileobj", broken_copy)
    upload = UploadFile(file=io.BytesIO(b"replacement"), filename="clip.mkv", size=11)
    with pytest.raises(HTTPException) as error:
        asyncio.run(dub_core.dub_upload(video=upload, job_id="job", input_type="video", source_lang=None))
    assert original.read_bytes() == b"completed source"
    assert error.value.status_code == 409


def test_small_upload_does_not_require_one_gib_reserve(tmp_path, monkeypatch):
    from fastapi import UploadFile
    from api.routers import dub_core
    job_dir = tmp_path / "job"
    monkeypatch.setattr(dub_core, "_safe_job_dir", lambda _: str(job_dir))
    monkeypatch.setattr(dub_core.shutil, "disk_usage", lambda _: SimpleNamespace(free=1024**2))
    async def add_task(*args):
        pass
    monkeypatch.setattr(dub_core.task_manager, "add_task", add_task)
    upload = UploadFile(file=io.BytesIO(b"test media"), filename="clip.wav", size=10)
    response = asyncio.run(dub_core.dub_upload(video=upload, job_id="job", input_type="audio", source_lang=None))
    assert response.status_code == 202
    assert (job_dir / "original.wav").read_bytes() == b"test media"


@pytest.mark.parametrize("cancelled", [False, True])
def test_failed_extraction_removes_partial_working_audio(tmp_path, monkeypatch, cancelled):
    from services import dub_pipeline
    job_dir = tmp_path / "job"
    job_dir.mkdir()
    source = tmp_path / "original.wav"
    source.write_bytes(b"valid source bytes")
    monkeypatch.setattr(dub_pipeline, "find_ffmpeg", lambda: "ffmpeg")
    monkeypatch.setattr(dub_pipeline, "require_audio_stream", lambda _: None)
    async def fail_extract(cmd):
        Path(cmd[-2]).write_bytes(b"partial output")
        if cancelled:
            raise asyncio.CancelledError()
        raise OSError(errno.ENOSPC, "No space left")
    monkeypatch.setattr(dub_pipeline, "run_proc_factory", lambda _: fail_extract)
    async def collect():
        return [event async for event in dub_pipeline.ingest_pipeline(
            "extract_failure", str(job_dir), {"kind": "file", "path": str(source), "input_type": "audio"})]
    if cancelled:
        with pytest.raises(asyncio.CancelledError):
            asyncio.run(collect())
    else:
        asyncio.run(collect())
    assert source.read_bytes() == b"valid source bytes"
    assert not list(job_dir.glob("*.wav"))


@pytest.mark.parametrize("fail_before_launch", [True, False])
def test_failed_reingest_preserves_completed_audio(tmp_path, monkeypatch, fail_before_launch):
    from services import dub_pipeline
    job_dir = tmp_path / "job"
    job_dir.mkdir()
    source = tmp_path / "original.wav"
    source.write_bytes(b"valid source bytes")
    for name in ("audio.wav", "audio_hq.wav"):
        (job_dir / name).write_bytes(b"completed audio")
    monkeypatch.setattr(dub_pipeline, "find_ffmpeg", lambda: "ffmpeg")
    def validate(_):
        if fail_before_launch:
            raise ValueError("invalid source")
    monkeypatch.setattr(dub_pipeline, "validate_media_source", validate)
    monkeypatch.setattr(dub_pipeline, "require_audio_stream", lambda _: None)
    async def fail_extract(cmd):
        Path(cmd[-2]).write_bytes(b"partial output")
        raise OSError(errno.ENOSPC, "No space left")
    monkeypatch.setattr(dub_pipeline, "run_proc_factory", lambda _: fail_extract)
    async def collect():
        return [event async for event in dub_pipeline.ingest_pipeline(
            "reingest", str(job_dir), {"kind": "file", "path": str(source), "input_type": "audio"})]
    asyncio.run(collect())
    assert {p.name: p.read_bytes() for p in job_dir.iterdir()} == {
        "audio.wav": b"completed audio", "audio_hq.wav": b"completed audio"}


def test_cancelled_upload_waits_for_writer_before_cleanup(tmp_path, monkeypatch):
    import threading
    from fastapi import UploadFile
    from api.routers import dub_core
    job_dir = tmp_path / "job"
    started, release = threading.Event(), threading.Event()
    upload = UploadFile(file=io.BytesIO(b"test media"), filename="clip.wav", size=10)
    monkeypatch.setattr(dub_core, "_safe_job_dir", lambda _: str(job_dir))
    monkeypatch.setattr(dub_core.shutil, "disk_usage", lambda _: SimpleNamespace(free=1024**2))
    def copy(source, target, length):
        target.write(source.read(2))
        started.set()
        assert release.wait(5)
        target.write(source.read())
    monkeypatch.setattr(dub_core.shutil, "copyfileobj", copy)
    async def run():
        waiting = asyncio.Event()
        shield = asyncio.shield
        calls = 0
        def observed(future):
            nonlocal calls
            calls += 1
            if calls == 2: waiting.set()
            return shield(future)
        monkeypatch.setattr(asyncio, "shield", observed)
        task = asyncio.create_task(dub_core.dub_upload(video=upload, job_id="job", input_type="audio", source_lang=None))
        try:
            assert await asyncio.to_thread(started.wait, 3)
            task.cancel()
            await asyncio.wait_for(waiting.wait(), 3)
            assert not upload.file.closed
            task.cancel()
        finally:
            release.set()
        with pytest.raises(asyncio.CancelledError): await task
    asyncio.run(run())
    assert upload.file.closed
    assert not job_dir.exists()


def test_invalid_media_log_omits_source_path(tmp_path, monkeypatch, caplog):
    from core import failure
    from services import ffmpeg_utils
    source = tmp_path / "private-recording.mkv"
    monkeypatch.setattr(ffmpeg_utils, "has_audio_stream", lambda _: None)
    with caplog.at_level("INFO"), pytest.raises(failure.InvalidMediaFileError):
        ffmpeg_utils.raise_for_audio_extract_failure(
            f"EBML header parsing failed: {source}", str(source))
    assert str(source) not in caplog.text
    assert "private-recording" not in caplog.text
