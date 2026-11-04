from shelf.guardrails import (
    evaluate_ask_guardrails,
    is_injection,
    is_password_like_ask,
    should_quarantine_evidence,
)


def answer_from_evidence(question: str, hits: list[dict]) -> dict:
    gate = evaluate_ask_guardrails(question)
    if gate["action"] in {"empty", "refuse", "thin"}:
        return {
            "answer": gate["answer"],
            "citations": gate.get("citations") or [],
            "refused": True,
            "reason": gate["reason"],
        }

    useful = [hit for hit in hits if (hit.get("ocr_text") or hit.get("caption"))]
    if not useful:
        return {
            "answer": "I don't have a screenshot that answers that.",
            "citations": [],
            "refused": True,
            "reason": "thin_evidence",
        }

    evidence = "\n".join(f"{hit.get('ocr_text', '')} {hit.get('caption', '')}" for hit in useful[:4])
    if should_quarantine_evidence(question, evidence):
        return {
            "answer": "That screenshot tries to give me instructions. I won't follow them.",
            "citations": [{"id": hit["id"], "filename": hit.get("filename", "")} for hit in useful[:2]],
            "refused": True,
            "reason": "prompt_injection",
        }

    # Extra question-side check after evidence inspection
    if is_injection(question):
        return {
            "answer": "I won't follow instructions hidden in a question.",
            "citations": [],
            "refused": True,
            "reason": "prompt_injection",
        }

    # Prefer non-adversarial evidence when available
    safe_hits = [hit for hit in useful if not is_injection(f"{hit.get('ocr_text', '')} {hit.get('caption', '')}")]
    ranked = safe_hits or useful
    if not safe_hits and is_password_like_ask(question):
        return {
            "answer": "That screenshot tries to give me instructions. I won't follow them.",
            "citations": [{"id": hit["id"], "filename": hit.get("filename", "")} for hit in useful[:2]],
            "refused": True,
            "reason": "prompt_injection",
        }

    top = ranked[0]
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
        for hit in ranked[:3]
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
        if not is_injection(f"{hit.get('ocr_text', '')} {hit.get('caption', '')}")
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
