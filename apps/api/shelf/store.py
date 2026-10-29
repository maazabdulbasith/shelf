import json
import math
from typing import Protocol


def _cosine(left: list[float], right: list[float]) -> float:
    if not left or not right or len(left) != len(right):
        return -1.0
    dot = sum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(sum(a * a for a in left))
    right_norm = math.sqrt(sum(b * b for b in right))
    if left_norm == 0 or right_norm == 0:
        return -1.0
    return dot / (left_norm * right_norm)


class Store(Protocol):
    def get_by_hash(self, digest: str) -> dict | None: ...
    def upsert(self, row: dict) -> dict: ...
    def get(self, shot_id: str) -> dict | None: ...
    def list_shots(self, limit: int = 200) -> list[dict]: ...
    def keyword_rank(self, query: str, limit: int = 20) -> list[str]: ...
    def vector_rank(self, column: str, vector: list[float], limit: int = 20) -> list[str]: ...
    def all_ids(self) -> list[str]: ...


class MemoryStore:
    def __init__(self) -> None:
        self.rows: dict[str, dict] = {}

    def get_by_hash(self, digest: str) -> dict | None:
        for row in self.rows.values():
            if row["content_hash"] == digest:
                return row
        return None

    def upsert(self, row: dict) -> dict:
        self.rows[row["id"]] = row
        return row

    def get(self, shot_id: str) -> dict | None:
        return self.rows.get(shot_id)

    def list_shots(self, limit: int = 200) -> list[dict]:
        rows = sorted(self.rows.values(), key=lambda row: row["created_at"], reverse=True)
        return rows[:limit]

    def keyword_rank(self, query: str, limit: int = 20) -> list[str]:
        terms = [term.lower() for term in query.split() if term.strip()]
        scored = []
        for row in self.rows.values():
            haystack = f"{row.get('ocr_text', '')} {row.get('caption', '')}".lower()
            score = sum(haystack.count(term) for term in terms)
            if score:
                scored.append((score, row["id"]))
        scored.sort(reverse=True)
        return [shot_id for _score, shot_id in scored[:limit]]

    def vector_rank(self, column: str, vector: list[float], limit: int = 20) -> list[str]:
        scored = []
        for row in self.rows.values():
            current = row.get(column)
            if not current:
                continue
            scored.append((_cosine(vector, current), row["id"]))
        scored.sort(reverse=True)
        return [shot_id for score, shot_id in scored[:limit] if score > -1]

    def all_ids(self) -> list[str]:
        return list(self.rows.keys())


SCHEMA = """
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS screenshots (
  id text PRIMARY KEY,
  content_hash text UNIQUE NOT NULL,
  filename text NOT NULL,
  created_at timestamptz NOT NULL,
  status text NOT NULL,
  ocr_text text NOT NULL DEFAULT '',
  ocr_lines jsonb NOT NULL DEFAULT '[]',
  caption text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT '',
  actions jsonb NOT NULL DEFAULT '[]',
  text_embedding vector(384),
  image_embedding vector(512),
  search_document tsvector,
  text_model text NOT NULL DEFAULT '',
  clip_model text NOT NULL DEFAULT '',
  prompt_version text NOT NULL DEFAULT '',
  index_version text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS screenshots_search ON screenshots USING gin (search_document);
CREATE INDEX IF NOT EXISTS screenshots_text_hnsw ON screenshots USING hnsw (text_embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS screenshots_image_hnsw ON screenshots USING hnsw (image_embedding vector_cosine_ops);
"""


class PostgresStore:
    def __init__(self, dsn: str) -> None:
        import psycopg

        self.dsn = dsn
        with psycopg.connect(dsn) as conn:
            conn.execute(SCHEMA)
            conn.commit()

    def _connect(self):
        import psycopg
        from psycopg.rows import dict_row

        return psycopg.connect(self.dsn, row_factory=dict_row)

    def get_by_hash(self, digest: str) -> dict | None:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM screenshots WHERE content_hash = %s", (digest,)).fetchone()
        return self._public(row) if row else None

    def upsert(self, row: dict) -> dict:
        text_vector = self._vector(row.get("text_embedding"))
        image_vector = self._vector(row.get("image_embedding"))
        document = f"{row.get('ocr_text', '')} {row.get('caption', '')}"
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO screenshots (
                  id, content_hash, filename, created_at, status, ocr_text, ocr_lines,
                  caption, kind, actions, text_embedding, image_embedding, search_document,
                  text_model, clip_model, prompt_version, index_version
                ) VALUES (
                  %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s::jsonb,
                  %s::vector, %s::vector, to_tsvector('english', %s),
                  %s, %s, %s, %s
                )
                ON CONFLICT (id) DO UPDATE SET
                  status = EXCLUDED.status,
                  ocr_text = EXCLUDED.ocr_text,
                  ocr_lines = EXCLUDED.ocr_lines,
                  caption = EXCLUDED.caption,
                  kind = EXCLUDED.kind,
                  actions = EXCLUDED.actions,
                  text_embedding = EXCLUDED.text_embedding,
                  image_embedding = EXCLUDED.image_embedding,
                  search_document = EXCLUDED.search_document,
                  text_model = EXCLUDED.text_model,
                  clip_model = EXCLUDED.clip_model,
                  prompt_version = EXCLUDED.prompt_version,
                  index_version = EXCLUDED.index_version
                """,
                (
                    row["id"],
                    row["content_hash"],
                    row["filename"],
                    row["created_at"],
                    row["status"],
                    row.get("ocr_text", ""),
                    json.dumps(row.get("ocr_lines", [])),
                    row.get("caption", ""),
                    row.get("kind", ""),
                    json.dumps(row.get("actions", [])),
                    text_vector,
                    image_vector,
                    document,
                    row.get("text_model", ""),
                    row.get("clip_model", ""),
                    row.get("prompt_version", ""),
                    row.get("index_version", ""),
                ),
            )
            conn.commit()
        return row

    def get(self, shot_id: str) -> dict | None:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM screenshots WHERE id = %s", (shot_id,)).fetchone()
        return self._public(row) if row else None

    def list_shots(self, limit: int = 200) -> list[dict]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM screenshots ORDER BY created_at DESC LIMIT %s", (limit,)
            ).fetchall()
        return [self._public(row) for row in rows]

    def keyword_rank(self, query: str, limit: int = 20) -> list[str]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT id FROM screenshots
                WHERE search_document @@ plainto_tsquery('english', %s)
                ORDER BY ts_rank(search_document, plainto_tsquery('english', %s)) DESC
                LIMIT %s
                """,
                (query, query, limit),
            ).fetchall()
        return [row["id"] for row in rows]

    def vector_rank(self, column: str, vector: list[float], limit: int = 20) -> list[str]:
        if column not in {"text_embedding", "image_embedding"}:
            raise ValueError(column)
        literal = self._vector(vector)
        with self._connect() as conn:
            rows = conn.execute(
                f"""
                SELECT id FROM screenshots
                WHERE {column} IS NOT NULL
                ORDER BY {column} <=> %s::vector
                LIMIT %s
                """,
                (literal, limit),
            ).fetchall()
        return [row["id"] for row in rows]

    def all_ids(self) -> list[str]:
        with self._connect() as conn:
            rows = conn.execute("SELECT id FROM screenshots").fetchall()
        return [row["id"] for row in rows]

    def _vector(self, values: list[float] | None) -> str | None:
        if not values:
            return None
        return "[" + ",".join(f"{value:.7f}" for value in values) + "]"

    def _public(self, row: dict) -> dict:
        public = dict(row)
        public.pop("text_embedding", None)
        public.pop("image_embedding", None)
        public.pop("search_document", None)
        if isinstance(public.get("ocr_lines"), str):
            public["ocr_lines"] = json.loads(public["ocr_lines"])
        if isinstance(public.get("actions"), str):
            public["actions"] = json.loads(public["actions"])
        if public.get("created_at") is not None:
            public["created_at"] = public["created_at"].isoformat()
        return public
