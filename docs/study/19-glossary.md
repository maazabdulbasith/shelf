# 19. Glossary

- **Bi-encoder.** Encodes the query and the document separately. Fast. Used for the first-pass vector search.
- **CLIP.** A pair of encoders that put images and text in one vector space.
- **Content hash.** SHA-256 of the file bytes. Shelf's identity for a screenshot.
- **Cosine similarity.** Compares the angle between two vectors.
- **Cross-encoder.** Scores a query and a passage together. Slower. Used to rerank.
- **Embedding.** A list of numbers that represents text or an image.
- **Golden set.** Synthetic inputs with expected answers, safe to commit and run in CI.
- **HNSW.** A graph index for approximate nearest neighbor search.
- **Idempotent.** Doing the operation twice has the same effect as doing it once.
- **IVFFlat.** A clustered approximate vector index.
- **LangGraph.** A stateful graph of steps with conditional edges.
- **LlamaIndex.** A retrieval and query-engine library.
- **OCR.** Optical character recognition. Text and boxes from an image.
- **ONNX Runtime.** A runner for models exported to the ONNX format.
- **pgvector.** A Postgres extension that stores and indexes vectors.
- **Prompt injection.** Untrusted text that tries to replace the instruction.
- **RAG.** Retrieval-augmented generation. Answer from retrieved evidence.
- **Recall@k.** How often the right item is in the top k.
- **MRR.** Mean reciprocal rank. Higher when the right item is nearer the top.
- **RRF.** Reciprocal rank fusion. Merges ranked lists without shared score scales.
- **tsvector.** Postgres full-text representation of a document.
- **VLM.** Vision-language model. Reads an image and text.

## Self-check
Cover the list. For CLIP, RRF, and prompt injection, say one sentence about what Shelf does with each.

## What we built
The measured golden run is in `eval/reports/ablation.json`. Hybrid recall@5 was 1.0 and MRR was 0.9028. Hybrid plus rerank kept recall at 1.0 and dropped MRR to 0.8708. Ask refused the injection screenshot. Qdrant and pgvector both scored text-vector recall@5 of 1.0 on the 10 text queries (`eval/reports/qdrant.json`). Gemini was not configured. Golden captions came from the scripted labeler (`eval/reports/providers.json`, 4 of 8 kind labels matched). `moondream:1.8b` is installed. A cold caption of the black golden image took about 17 seconds, and a warm repeat took about 0.7 seconds. Rows already on the wall have not been reprocessed, and `llama3.2` is not installed. Ask quotes retrieved OCR. Live `/v1/metrics` on the first real screenshots showed OCR around 14 seconds per image on CPU, which is why that work stays on the queue. Windows Application Control blocked the `mmh3` DLL that FastEmbed imports. Search uses the pure-Python MurmurHash3 stand-in in `mmh3_compat.py`.
