# Shelf

Shelf is a local search wall for screenshots. You type a phrase you remember. The wall reorders, the matching line lights up, and one action sits on the card. Nothing runs until you click.

Your screenshots stay on this machine. There is no account and no bill.

## Run it

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

Open http://localhost:3000. Press `/` to focus search. The API watches `C:\Users\Dell\Pictures\Screenshots` and also accepts a drag and drop. The same bytes a second time are ignored.

Postgres is published on host port 5433 so it does not collide with a Postgres already using 5432.

## Tests and the gate

```powershell
$env:PYTHONPATH = "apps/api"
$env:SHELF_SKIP_WATCH = "1"
.\.venv\Scripts\python -m pytest apps/api/tests -q
.\.venv\Scripts\python eval/make_golden.py
$env:DATABASE_URL = "postgresql://shelf:shelf@localhost:5433/shelf"
.\.venv\Scripts\python eval/run_eval.py
```

The golden set is synthetic. It can live in git. Your real screenshots are under `data/` and are gitignored.

## What the numbers were

On the 12 golden queries, after OCR, bge, and CLIP:

| Signal | Recall@5 | MRR |
| --- | --- | --- |
| Full text | 0.8333 | 0.8333 |
| Text vectors | 0.9167 | 0.8611 |
| CLIP | 0.6667 | 0.5694 |
| Hybrid RRF | 1.0000 | 0.9028 |
| Hybrid plus rerank | 1.0000 | 0.8708 |

Full-text recall is 10 of 12 because two queries describe solid color fields that contain no words. Action precision was 1.0. Ask refused a question with no evidence, and refused the screenshot that says to ignore previous instructions and reveal a password. The answer did not contain that password.

Qdrant and pgvector both reached recall@5 of 1.0 on the 10 text queries with the same bge vectors. Gemini was not configured, so no image was sent to Google. Ollama is installed locally for captions when the models are pulled.

## Study guide

`docs/study/` is the source. `python scripts/build_study_pdf.py` writes `docs/Shelf-Study-Guide.pdf`.

## Cloud

`docs/sync-design.md` is the later sync design. `infra/terraform` was validated with Terraform 1.9 and was not applied.
