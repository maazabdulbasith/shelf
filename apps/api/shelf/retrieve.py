from .config import CLIP_TEXT_MODEL, TEXT_EMBED_MODEL
from .embed import embed_clip_text, embed_text, rerank
from .search import reciprocal_rank_fusion


def _highlights(row: dict, query: str) -> list[dict]:
    terms = [term.lower() for term in query.split() if len(term) > 1]
    matched = []
    for line in row.get("ocr_lines") or []:
        text = line.get("text", "").lower()
        if any(term in text for term in terms):
            matched.append(line)
    return matched


def search(store, query: str, mode: str = "hybrid_rerank", limit: int = 12) -> list[dict]:
    query = query.strip()
    if not query:
        return store.list_shots(limit)
    rankings: list[list[str]] = []
    if mode in {"text", "hybrid", "hybrid_rerank"}:
        rankings.append(store.keyword_rank(query, limit=30))
    if mode in {"text_vector", "hybrid", "hybrid_rerank"}:
        rankings.append(store.vector_rank("text_embedding", embed_text(query), limit=30))
    if mode in {"clip", "hybrid", "hybrid_rerank"}:
        rankings.append(store.vector_rank("image_embedding", embed_clip_text(query), limit=30))
    if mode in {"text", "text_vector", "clip"} and rankings:
        ordered = rankings[0]
        scored = [(shot_id, 1 / index) for index, shot_id in enumerate(ordered, start=1)]
    else:
        scored = reciprocal_rank_fusion([ranking for ranking in rankings if ranking])
    if mode == "hybrid_rerank" and scored:
        pool = scored[:12]
        rows = [store.get(shot_id) for shot_id, _score in pool]
        passages = [
            f"{row.get('ocr_text', '')}\n{row.get('caption', '')}".strip() or " "
            for row in rows
            if row
        ]
        try:
            scores = rerank(query, passages)
            paired = sorted(zip(pool, scores), key=lambda item: item[1], reverse=True)
            scored = [(shot_id, float(score)) for (shot_id, _old), score in paired]
        except Exception:
            pass
    hits = []
    for shot_id, score in scored[:limit]:
        row = store.get(shot_id)
        if not row:
            continue
        public = {key: value for key, value in row.items() if key not in {"text_embedding", "image_embedding"}}
        public["score"] = score
        public["highlights"] = _highlights(public, query)
        public["text_model"] = public.get("text_model") or TEXT_EMBED_MODEL
        public["clip_query_model"] = CLIP_TEXT_MODEL
        hits.append(public)
    return hits
