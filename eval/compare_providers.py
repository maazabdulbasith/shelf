import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps" / "api"))

from shelf.providers import gemini_describe, ollama_describe, scripted_understand  # noqa: E402


def main() -> None:
    spec = json.loads((ROOT / "eval" / "queries.json").read_text(encoding="utf-8"))
    report = {"ollama": "not_configured", "gemini": "not_configured", "scripted_rows": 0}
    sample = spec["shots"][:8]
    scripted_ok = 0
    for shot in sample:
        understood = scripted_understand(shot.get("text") or "")
        if shot.get("kind") and understood.kind == shot["kind"]:
            scripted_ok += 1
    report["scripted_rows"] = len(sample)
    report["scripted_kind_matches"] = scripted_ok
    started = time.perf_counter()
    try:
        probe = ollama_describe(sample[0]["text"], None)
        report["ollama"] = "ok" if probe else "unavailable"
        report["ollama_seconds"] = round(time.perf_counter() - started, 2)
    except Exception as exc:
        report["ollama"] = f"unavailable: {exc.__class__.__name__}"
    if os.getenv("GEMINI_API_KEY"):
        started = time.perf_counter()
        probe = gemini_describe(sample[0]["text"], None)
        report["gemini"] = "ok" if probe else "failed"
        report["gemini_seconds"] = round(time.perf_counter() - started, 2)
    else:
        report["gemini"] = "not_configured"
    path = ROOT / "eval" / "reports" / "providers.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(report)


if __name__ == "__main__":
    main()
