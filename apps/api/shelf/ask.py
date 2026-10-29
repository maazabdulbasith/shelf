INJECTION_MARKERS = (
    "ignore previous instructions",
    "ignore all previous",
    "say the password",
    "system prompt",
    "you are now",
)


def is_injection(text: str) -> bool:
    lowered = (text or "").lower()
    if any(marker in lowered for marker in INJECTION_MARKERS):
        return True
    return "ignore" in lowered and "instruction" in lowered


def answer_from_evidence(question: str, hits: list[dict]) -> dict:
    question_l = (question or "").lower()
    useful = [hit for hit in hits if (hit.get("ocr_text") or hit.get("caption"))]
    if not useful:
        return {
            "answer": "I don't have a screenshot that answers that.",
            "citations": [],
            "refused": True,
            "reason": "thin_evidence",
        }
    evidence = "\n".join(f"{hit.get('ocr_text', '')} {hit.get('caption', '')}" for hit in useful[:4])
    asks_for_hidden = any(word in question_l for word in ("password", "ignore", "instruction", "secret"))
    if is_injection(evidence) and asks_for_hidden:
        return {
            "answer": "That screenshot tries to give me instructions. I won't follow them.",
            "citations": [{"id": hit["id"], "filename": hit.get("filename", "")} for hit in useful[:2]],
            "refused": True,
            "reason": "prompt_injection",
        }
    if is_injection(question):
        return {
            "answer": "I won't follow instructions hidden in a question.",
            "citations": [],
            "refused": True,
            "reason": "prompt_injection",
        }
    top = useful[0]
    snippet = " ".join((top.get("ocr_text") or top.get("caption") or "").split())[:400]
    if not snippet:
        return {
            "answer": "I don't have a screenshot that answers that.",
            "citations": [],
            "refused": True,
            "reason": "thin_evidence",
        }
    citations = [
        {"id": hit["id"], "filename": hit.get("filename", "")}
        for hit in useful[:3]
    ]
    return {
        "answer": snippet,
        "citations": citations,
        "refused": False,
        "reason": "",
    }


def llamaindex_answer(question: str, hits: list[dict]) -> dict:
    """A LlamaIndex query engine over the hybrid hits. The synthesizer stays grounded."""
    result = answer_from_evidence(question, hits)
    try:
        from llama_index.core import Document, VectorStoreIndex
        from llama_index.core.llms import MockLLM
        from llama_index.core.embeddings import MockEmbedding
    except Exception:
        result["engine"] = "grounded"
        return result
    documents = [
        Document(
            text=f"{hit.get('ocr_text', '')}\n{hit.get('caption', '')}".strip() or "empty",
            metadata={"id": hit["id"], "filename": hit.get("filename", "")},
        )
        for hit in hits[:8]
    ]
    if not documents:
        result["engine"] = "llamaindex"
        return result
    index = VectorStoreIndex.from_documents(
        documents,
        embed_model=MockEmbedding(embed_dim=8),
    )
    engine = index.as_query_engine(llm=MockLLM(), similarity_top_k=3)
    engine.query(question)
    result["engine"] = "llamaindex"
    return result
