from pathlib import Path

from PIL import Image, ImageDraw

from shelf.ingest import accept_bytes, set_store
from shelf.store import MemoryStore


def test_duplicate_upload_is_ignored(tmp_path, monkeypatch):
    monkeypatch.setattr("shelf.ingest.SHOTS", tmp_path)
    monkeypatch.setattr("shelf.ingest.THUMBS", tmp_path)
    set_store(MemoryStore())
    image = Image.new("RGB", (80, 40), "white")
    ImageDraw.Draw(image).text((4, 8), "hello", fill="black")
    path = tmp_path / "one.png"
    image.save(path)
    data = path.read_bytes()
    first = accept_bytes(data, "one.png", process=False)
    second = accept_bytes(data, "one.png", process=False)
    assert first["duplicate"] is False
    assert second["duplicate"] is True
    assert second["id"] == first["id"]
    stored = [path for path in tmp_path.glob("*.png") if path.name != "one.png"]
    assert len(stored) == 1
