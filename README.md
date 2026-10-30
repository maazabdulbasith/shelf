# Shelf

> **Local-first screenshot search wall using OCR, pgvector hybrid search, and deterministic grounded RAG.**

[![Live Interactive Demo](https://img.shields.io/badge/Live_Demo-Try_Interactive_Search-06b6d4?style=for-the-badge&logo=vercel&logoColor=white)](https://abdul-basith-maaz-portfolio.vercel.app/demos/shelf)
[![Recall@5](https://img.shields.io/badge/Recall@5-1.0000-emerald?style=for-the-badge)](#what-the-numbers-were)
[![MRR](https://img.shields.io/badge/MRR-0.9028-blue?style=for-the-badge)](#what-the-numbers-were)
[![Action Precision](https://img.shields.io/badge/Action_Precision-1.00-purple?style=for-the-badge)](#what-the-numbers-were)

Shelf is a local search wall for screenshots. You type a phrase you remember. The wall reorders, the matching line lights up, and one action sits on the card. Nothing runs until you click.

Your screenshots stay on this machine. There is no account, no cloud telemetry, and no bill.

👉 **[Try the Live Interactive Demo & RRF Decomposition](https://abdul-basith-maaz-portfolio.vercel.app/demos/shelf)**

---

## Architecture Overview

Shelf operates on a dual-pipeline architecture: an asynchronous **LangGraph ingestion state machine** and a **multi-signal hybrid retrieval pipeline** powered by PostgreSQL and pgvector.

```
  Screenshot Received (Local Watchdog / UI Drop)
         │
         ├─── RapidOCR (ONNX) ──────────> Extract text tokens & bounding boxes
         │
         ├─── FastEmbed (bge-small) ────> 384-dim dense text embedding
         │
         └─── FastEmbed (CLIP-ViT) ─────> 512-dim visual embedding
                        │
                        ▼
           PostgreSQL + pgvector (HNSW)
                        │
      ┌─────────────────┴─────────────────┐
      │ Query: "blue door cafe"           │
      ▼                                   ▼
[Full-Text BM25]                 [Vector Cosine <=>]
Rank 1: cafe.png (0.833)         Rank 1: cafe.png (0.916)
Rank 2: chat.png (0.500)         Rank 2: blue.png (0.667)
      │                                   │
      └─────────────────┬─────────────────┘
                        ▼
          Reciprocal Rank Fusion (k=60)
         Score = 1/(60+r_sparse) + 1/(60+r_dense)
                        │
                        ▼
             Guardrail & LlamaIndex Ask
   (Refuse thin evidence & prompt injections)
                        │
                        ▼
            Instant Grounded Answer & Action
```

---

## What the Numbers Were

On the 12 golden queries, after OCR, bge, and CLIP:

| Signal | Recall@5 | MRR | Notes |
| :--- | :---: | :---: | :--- |
| **Full text** | 0.8333 | 0.8333 | 10 of 12 (fails on solid color fields with no words) |
| **Text vectors (bge-small)** | 0.9167 | 0.8611 | Captures semantic intent |
| **Visual vectors (CLIP)** | 0.6667 | 0.5694 | Resolves non-textual visual scenes |
| **Hybrid RRF** | **1.0000** | **0.9028** | Blends ordinal ranks immune to score discrepancies |
| **Hybrid plus rerank** | **1.0000** | **0.8708** | Cross-encoder contextual re-scoring |

Action precision was **1.0**. Ask refused a question with no evidence (`thin_evidence`), and refused the screenshot that says to ignore previous instructions and reveal a password (`prompt_injection`). The answer did not contain that password.

---

## Deterministic Prompt-Injection Defense

Shelf employs an input-side security gate in [`shelf/ask.py`](apps/api/shelf/ask.py) before dispatching context to the LLM:
1. **Thin Evidence Refusal:** If retrieved evidence lacks OCR tokens or exceeds minimum cosine distance, returns `"I don't have a screenshot that answers that."` with `reason: thin_evidence`.
2. **Evidence Injection Quarantine:** Scans retrieved evidence for injection markers (`ignore previous instructions`, `say the password`, `system prompt`). If an injection signature is present and the prompt requests credentials, execution is halted immediately and the offending screenshot is cited for quarantine.
3. **Question Sanitization:** Prevents system prompt extraction via malicious user queries.

---

## Run It Locally

Python 3.12, Docker, and Node are the local tools.

```powershell
docker compose up -d postgres redis langfuse
py -3.12 -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
$env:DISABLE_SQLALCHEMY_CEXT = "1"
.\.venv\Scripts\python -m pip install --no-binary sqlalchemy sqlalchemy
$env:PYTHONPATH = "apps/api"
$env:DATABASE_URL = "postgresql://shelf:shelf@localhost:5433/shelf"
$env:REDIS_URL = "redis://localhost:6379/0"
.\.venv\Scripts\python -m uvicorn shelf.main:app --port 8000
```

In another terminal:

```powershell
cd apps/web
npm install
npm run dev
```

Open `http://localhost:3000`. Press `/` to focus search. The API watches `C:\Users\Dell\Pictures\Screenshots` and accepts drag-and-drop. Identical bytes are deduplicated automatically.

---

## Tests and CI Evaluation Gate

```powershell
$env:PYTHONPATH = "apps/api"
$env:SHELF_SKIP_WATCH = "1"
.\.venv\Scripts\python -m pytest apps/api/tests -q
.\.venv\Scripts\python eval/make_golden.py
$env:DATABASE_URL = "postgresql://shelf:shelf@localhost:5433/shelf"
.\.venv\Scripts\python eval/run_eval.py
```

The golden set is synthetic and resides in git. Real user screenshots remain under `data/` and are gitignored.

---

## Study Guide & Cloud Architecture

- `docs/study/` is the source documentation.
- `docs/Shelf-Study-Guide.pdf` is the generated architectural deep-dive.
- `docs/sync-design.md` describes the zero-knowledge encrypted sync architecture.
