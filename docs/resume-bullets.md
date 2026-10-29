# Resume bullets

These match what actually ran.

- Built Shelf, a local-first screenshot search app that finds images from a remembered phrase by fusing OCR full-text, bge text vectors, and CLIP image vectors in pgvector with reciprocal rank fusion and cross-encoder reranking. On a 12-query synthetic set, hybrid recall@5 was 1.0 and MRR was 0.9028. Full-text alone was 0.8333 because two queries had no text in the image.
- Orchestrated a LangGraph ingest pipeline (OCR, a conditional caption step, and Pydantic-validated extraction that falls back to a scripted labeler when no model is running) and a LlamaIndex Ask mode that cites the screenshots it used and refuses when evidence is thin or a screenshot tries to inject instructions. The injection case refused and did not return the password. The measured golden run used the scripted labeler. `moondream:1.8b` is installed locally; those rows have not been reprocessed, and `llama3.2` is not installed. Ask quotes retrieved OCR and does not call a text model. Gemini was left unset, so no image was sent to Google.
- Gated releases on a synthetic golden set (recall@5, MRR, action precision 1.0, injection refusal) in keyless CI, with model and index versions on every row and local JSONL traces plus an optional self-hosted Langfuse sink.
