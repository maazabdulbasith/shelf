import sys
from pathlib import Path

from .config import CLIP_TEXT_MODEL, CLIP_VISION_MODEL, RERANK_MODEL, TEXT_EMBED_MODEL

_text = None
_clip_image = None
_clip_text = None
_reranker = None


def _as_list(vector) -> list[float]:
    return [float(value) for value in vector]


def _install_mmh3() -> None:
    if "mmh3" in sys.modules:
        return
    try:
        import mmh3  # noqa: F401
    except ImportError:
        from . import mmh3_compat

        sys.modules["mmh3"] = mmh3_compat


def embed_text(text: str) -> list[float]:
    global _text
    if _text is None:
        _install_mmh3()
        from fastembed import TextEmbedding

        _text = TextEmbedding(TEXT_EMBED_MODEL)
    return _as_list(next(_text.embed([text or " "])))


def embed_image(path: Path) -> list[float]:
    global _clip_image
    if _clip_image is None:
        _install_mmh3()
        from fastembed import ImageEmbedding

        _clip_image = ImageEmbedding(CLIP_VISION_MODEL)
    return _as_list(next(_clip_image.embed([str(path)])))


def embed_clip_text(text: str) -> list[float]:
    global _clip_text
    if _clip_text is None:
        _install_mmh3()
        from fastembed import TextEmbedding

        _clip_text = TextEmbedding(CLIP_TEXT_MODEL)
    return _as_list(next(_clip_text.embed([text or " "])))


def rerank(query: str, passages: list[str]) -> list[float]:
    global _reranker
    if not passages:
        return []
    if _reranker is None:
        _install_mmh3()
        from fastembed.rerank.cross_encoder import TextCrossEncoder

        _reranker = TextCrossEncoder(model_name=RERANK_MODEL)
    scores = list(_reranker.rerank(query, passages))
    if scores and hasattr(scores[0], "score"):
        return [float(item.score) for item in scores]
    return [float(score) for score in scores]
