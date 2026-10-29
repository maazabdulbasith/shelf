import json
from datetime import datetime, timezone
from pathlib import Path

from .config import LANGFUSE_HOST, LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, REPORTS


def trace(name: str, payload: dict) -> None:
    REPORTS.mkdir(parents=True, exist_ok=True)
    row = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "name": name,
        "payload": payload,
    }
    path = REPORTS / "traces.jsonl"
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(row) + "\n")
    if not (LANGFUSE_HOST and LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY):
        return
    try:
        from langfuse import Langfuse

        client = Langfuse(
            host=LANGFUSE_HOST,
            public_key=LANGFUSE_PUBLIC_KEY,
            secret_key=LANGFUSE_SECRET_KEY,
        )
        client.create_event(name=name, metadata={k: str(v)[:200] for k, v in payload.items()})
    except Exception:
        return


def trace_path() -> Path:
    return REPORTS / "traces.jsonl"
