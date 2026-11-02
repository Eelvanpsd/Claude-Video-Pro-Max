"""Low disk warnings should lead to the storage controls that can resolve them."""

from types import SimpleNamespace


def test_low_disk_notification_links_storage(monkeypatch):
    from api.routers import system

    monkeypatch.setattr(system, "_has_hf_token", lambda: True)
    monkeypatch.setattr(system, "find_ffmpeg", lambda: "ffmpeg")
    monkeypatch.setattr(system, "get_best_device", lambda: "cpu")
    monkeypatch.setattr(
        system.shutil,
        "disk_usage",
        lambda _: SimpleNamespace(free=int(1.8 * 1024**3)),
    )

    notifications = system.system_notifications()["notifications"]
    warning = next(note for note in notifications if note["id"] == "disk-low")
    assert warning["action"] == {"type": "settings-tab", "target": "storage"}
