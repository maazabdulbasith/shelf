import uuid
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image

from . import embed, queue
from .actions import extract
from .config import (
    CLIP_TEXT_MODEL,
    CLIP_VISION_MODEL,
    INDEX_VERSION,
    SHOTS,
    TEXT_EMBED_MODEL,
    THUMBS,
)
from .hashing import content_hash
from .metrics import timed
from .ocr import read_lines, text_from_lines
from .store import MemoryStore, PostgresStore
from .tracing import trace
from .understand import run_understand

_store: MemoryStore | PostgresStore | None = None


def get_store():
    global _store
    if _store is None:
        from .config import DATABASE_URL

        _store = PostgresStore(DATABASE_URL) if DATABASE_URL else MemoryStore()
    return _store


def set_store(store) -> None:
    global _store
    _store = store


def _thumb(source: Path, shot_id: str) -> None:
    image = Image.open(source).convert("RGB")
    image.thumbnail((640, 640))
    image.save(THUMBS / f"{shot_id}.jpg", quality=80)


def accept_bytes(data: bytes, filename: str, process: bool = True) -> dict:
    digest = content_hash(data)
    store = get_store()
    existing = store.get_by_hash(digest)
    if existing:
        found = dict(existing)
        found["duplicate"] = True
        return found
    shot_id = uuid.uuid4().hex[:12]
    suffix = Path(filename).suffix.lower() or ".png"
    if suffix not in {".png", ".jpg", ".jpeg", ".webp"}:
        suffix = ".png"
    path = SHOTS / f"{shot_id}{suffix}"
    path.write_bytes(data)
    _thumb(path, shot_id)
    row = {
        "id": shot_id,
        "content_hash": digest,
        "filename": path.name,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "queued",
        "ocr_text": "",
        "ocr_lines": [],
        "caption": "",
        "kind": "",
        "actions": [],
        "text_embedding": None,
        "image_embedding": None,
        "text_model": "",
        "clip_model": "",
        "prompt_version": "",
        "index_version": INDEX_VERSION,
        "duplicate": False,
    }
    store.upsert(row)
    if process:
        queue.enqueue({"id": shot_id})
    return row


def accept_path(path: Path, process: bool = True) -> dict:
    return accept_bytes(path.read_bytes(), path.name, process=process)


def process_shot(shot_id: str, provider: str = "ollama") -> dict:
    store = get_store()
    row = store.get(shot_id)
    if row is None:
        raise KeyError(shot_id)
    path = SHOTS / row["filename"]
    row["status"] = "processing"
    store.upsert({**row, "text_embedding": None, "image_embedding": None})
    done = timed("ocr")
    lines = read_lines(path)
    done()
    ocr_text = text_from_lines(lines)
    done = timed("understand")
    understood = run_understand(ocr_text, str(path), provider=provider)
    done()
    actions = understood.get("actions") or extract(ocr_text)
    done = timed("embed")
    text_vector = embed.embed_text(f"{ocr_text}\n{understood.get('caption', '')}".strip() or " ")
    image_vector = embed.embed_image(path)
    done()
    row.update(
        {
            "status": "ready",
            "ocr_text": ocr_text,
            "ocr_lines": lines,
            "caption": understood.get("caption", ""),
            "kind": understood.get("kind", ""),
            "actions": actions,
            "text_embedding": text_vector,
            "image_embedding": image_vector,
            "text_model": TEXT_EMBED_MODEL,
            "clip_model": CLIP_VISION_MODEL,
            "prompt_version": understood.get("prompt_version", ""),
            "index_version": INDEX_VERSION,
        }
    )
    store.upsert(row)
    trace(
        "ingest",
        {
            "id": shot_id,
            "kind": row["kind"],
            "provider": understood.get("provider_used", provider),
            "index_version": INDEX_VERSION,
            "prompt_version": row["prompt_version"],
            "clip_text_model": CLIP_TEXT_MODEL,
        },
    )
    return store.get(shot_id) or row


def reembed_all() -> int:
    count = 0
    store = get_store()
    for shot_id in store.all_ids():
        process_shot(shot_id)
        count += 1
    return count
