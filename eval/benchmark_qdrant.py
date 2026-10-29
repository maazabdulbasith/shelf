import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps" / "api"))

from shelf.config import QDRANT_URL  # noqa: E402
from shelf.embed import embed_text  # noqa: E402
from shelf.ingest import get_store  # noqa: E402
from shelf.retrieve import search  # noqa: E402


def main() -> None:
    import time

    from qdrant_client import QdrantClient
    from qdrant_client.models import Distance, PointStruct, VectorParams

    from shelf.hashing import content_hash

    store = get_store()
    rows = store.list_shots(limit=500)
    by_hash = {}
    for row in rows:
        by_hash.setdefault(row["content_hash"], row)
    client = QdrantClient(url=QDRANT_URL, check_compatibility=False)
    if client.collection_exists("shelf"):
        client.delete_collection("shelf")
    client.create_collection(
        collection_name="shelf",
        vectors_config=VectorParams(size=384, distance=Distance.COSINE),
    )
    points = []
    for index, row in enumerate(rows):
        if not row.get("ocr_text") and not row.get("caption"):
            continue
        vector = embed_text(f"{row.get('ocr_text', '')}\n{row.get('caption', '')}".strip() or " ")
        points.append(PointStruct(id=index + 1, vector=vector, payload={"shot_id": row["id"]}))
    if points:
        client.upsert("shelf", points)
    queries = json.loads((ROOT / "eval" / "queries.json").read_text(encoding="utf-8"))["queries"]
    text_queries = [item for item in queries if item["signal"] == "text"]
    qdrant_hits = 0
    pg_hits = 0
    started = time.perf_counter()
    for item in text_queries:
        expected = by_hash[content_hash((ROOT / "eval" / "golden" / item["expect"]).read_bytes())]
        vector = embed_text(item["query"])
        found = client.query_points(collection_name="shelf", query=vector, limit=5)
        ids = [point.payload["shot_id"] for point in found.points]
        qdrant_hits += int(expected["id"] in ids)
        shelf_ids = [hit["id"] for hit in search(store, item["query"], mode="text_vector", limit=5)]
        pg_hits += int(expected["id"] in shelf_ids)
    elapsed = time.perf_counter() - started
    count = len(text_queries) or 1
    report = {
        "text_queries": len(text_queries),
        "qdrant_recall_at_5": round(qdrant_hits / count, 4),
        "pgvector_text_recall_at_5": round(pg_hits / count, 4),
        "seconds": round(elapsed, 2),
        "points": len(points),
        "url": QDRANT_URL,
        "note": "Same bge vectors. Qdrant server 1.13.4, client 1.19.1, compatibility check disabled.",
    }
    path = ROOT / "eval" / "reports" / "qdrant.json"
    path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(report)


if __name__ == "__main__":
    main()
