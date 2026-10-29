import os
import threading
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

from . import queue
from .ask import llamaindex_answer
from .config import SHOTS, THUMBS, WATCH_DIR
from .ingest import accept_bytes, accept_path, get_store, process_shot, reembed_all
from .metrics import snapshot
from .retrieve import search


def _drain() -> None:
    while True:
        job = queue.dequeue(timeout=2)
        if not job:
            continue
        try:
            process_shot(job["id"])
        except Exception:
            continue


def _scan_watch() -> None:
    folder = Path(WATCH_DIR)
    if not folder.exists():
        return
    for path in sorted(folder.iterdir()):
        if path.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}:
            try:
                accept_path(path, process=True)
            except Exception:
                continue


@asynccontextmanager
async def lifespan(_app: FastAPI):
    get_store()
    if os.getenv("SHELF_SKIP_WATCH") != "1":
        threading.Thread(target=_drain, daemon=True).start()
        threading.Thread(target=_scan_watch, daemon=True).start()
        folder = Path(WATCH_DIR)
        if folder.exists():
            observer = Observer()
            observer.schedule(WatchHandler(), str(folder), recursive=False)
            observer.daemon = True
            observer.start()
    yield


app = FastAPI(title="Shelf", lifespan=lifespan)
_web_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
_web_origins.extend(origin.strip() for origin in os.getenv("SHELF_WEB_ORIGIN", "").split(",") if origin.strip())
app.add_middleware(
    CORSMiddleware,
    allow_origins=_web_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/files", StaticFiles(directory=SHOTS), name="files")
app.mount("/thumbs", StaticFiles(directory=THUMBS), name="thumbs")


class AskBody(BaseModel):
    question: str


class WatchHandler(FileSystemEventHandler):
    def on_created(self, event):
        if event.is_directory:
            return
        path = Path(event.src_path)
        if path.suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp"}:
            return
        try:
            accept_path(path)
        except Exception:
            return


@app.get("/v1/health")
def health() -> dict:
    return {"ok": True}


@app.get("/v1/shots")
def shots(q: str = "", mode: str = "hybrid_rerank") -> dict:
    rows = search(get_store(), q, mode=mode) if q else get_store().list_shots()
    for row in rows:
        row.pop("text_embedding", None)
        row.pop("image_embedding", None)
    return {"shots": rows}


@app.post("/v1/shots")
async def upload(file: UploadFile = File(...), sync: bool = False) -> dict:
    data = await file.read()
    row = accept_bytes(data, file.filename or "shot.png", process=not sync)
    if sync:
        row = process_shot(row["id"])
        row["duplicate"] = False
    return row


@app.post("/v1/shots/{shot_id}/process")
def process(shot_id: str, provider: str = "ollama") -> dict:
    try:
        return process_shot(shot_id, provider=provider)
    except KeyError as exc:
        raise HTTPException(404, "Unknown screenshot") from exc


@app.post("/v1/jobs/next")
def next_job() -> dict:
    job = queue.dequeue(timeout=1)
    if not job:
        return {"job": None}
    row = process_shot(job["id"])
    return {"job": job, "shot": row}


@app.post("/v1/ask")
def ask(body: AskBody) -> dict:
    hits = search(get_store(), body.question, mode="hybrid_rerank", limit=5)
    return llamaindex_answer(body.question, hits)


@app.post("/v1/reembed")
def reembed() -> dict:
    return {"count": reembed_all()}


@app.get("/v1/metrics")
def metrics() -> dict:
    return snapshot(queue.depth())
