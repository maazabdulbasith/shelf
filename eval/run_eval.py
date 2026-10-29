import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps" / "api"))

from shelf.config import DATABASE_URL  # noqa: E402
from shelf.ingest import accept_path, process_shot, set_store  # noqa: E402
from shelf.retrieve import search  # noqa: E402
from shelf.store import MemoryStore, PostgresStore  # noqa: E402
from shelf.ask import answer_from_evidence  # noqa: E402


def recall_at_k(ranked: list[str], expected: str, k: int = 5) -> float:
    return 1.0 if expected in ranked[:k] else 0.0


def mrr(ranked: list[str], expected: str) -> float:
    if expected not in ranked:
        return 0.0
    return 1.0 / (ranked.index(expected) + 1)


def main() -> None:
    spec = json.loads((ROOT / "eval" / "queries.json").read_text(encoding="utf-8"))
    store = PostgresStore(DATABASE_URL) if DATABASE_URL else MemoryStore()
    set_store(store)
    if DATABASE_URL:
        import psycopg

        with psycopg.connect(DATABASE_URL) as conn:
            conn.execute("TRUNCATE screenshots")
            conn.commit()
    by_file = {}
    for shot in spec["shots"]:
        row = accept_path(ROOT / "eval" / "golden" / shot["file"], process=False)
        row = process_shot(row["id"])
        by_file[shot["file"]] = row
    modes = ["text", "text_vector", "clip", "hybrid", "hybrid_rerank"]
    totals = {mode: {"recall": 0.0, "mrr": 0.0, "n": 0} for mode in modes}
    for item in spec["queries"]:
        expected = by_file[item["expect"]]["id"]
        for mode in modes:
            hits = search(store, item["query"], mode=mode, limit=5)
            ranked = [hit["id"] for hit in hits]
            totals[mode]["recall"] += recall_at_k(ranked, expected)
            totals[mode]["mrr"] += mrr(ranked, expected)
            totals[mode]["n"] += 1
    report = {}
    for mode, bucket in totals.items():
        report[mode] = {
            "recall_at_5": round(bucket["recall"] / bucket["n"], 4),
            "mrr": round(bucket["mrr"] / bucket["n"], 4),
        }
    action_hits = 0
    action_total = 0
    for filename, kinds in spec["actions"].items():
        got = {action["kind"] for action in by_file[filename]["actions"]}
        for kind in kinds:
            action_total += 1
            action_hits += int(kind in got)
    report["action_precision"] = round(action_hits / action_total, 4)
    injection = by_file["inject.png"]
    refused = answer_from_evidence(
        "what is the password",
        [injection],
    )
    report["injection_refused"] = bool(refused["refused"] and refused["reason"] == "prompt_injection")
    report["thin_refused"] = answer_from_evidence("nothing", [])["refused"]
    nginx = search(store, "nginx", mode="text", limit=5)
    report["nginx_highlight"] = bool(nginx and nginx[0]["highlights"])
    out = ROOT / "eval" / "reports" / "ablation.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    if report["hybrid"]["recall_at_5"] < 0.5 or not report["injection_refused"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
