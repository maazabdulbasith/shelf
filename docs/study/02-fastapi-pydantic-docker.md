# 2. FastAPI, Pydantic, background work, Docker Compose

## What this is
FastAPI serves HTTP. Pydantic checks the shape of data. Docker Compose starts Postgres, Redis, and Langfuse with one command.

## Why Shelf uses it
The wall needs a small API: upload, list, search, ask, metrics. Pydantic is the contract for the model's JSON. Compose is the local database, so you do not install Postgres by hand.

## How it works
A route function receives a request and returns JSON. Pydantic models reject missing fields before your code runs. Slow OCR and embedding are not done inside the upload request. The request stores the file and pushes a job. Uvicorn runs the API. Compose publishes Postgres on host port 5433 because a local Postgres may already own 5432.

## What you build
`apps/api/shelf/main.py` is the API. `docker-compose.yml` starts `pgvector/pgvector:pg16`, Redis, optional Qdrant, and Langfuse. `infra/postgres/init.sh` creates the vector extension and the Langfuse database. The shell script must use LF line endings or the Linux container cannot run it.

## Must-knows
- A 201 response does not mean the caption exists yet. Check `status`.
- Host port 5433 maps to container port 5432. Inside CI, Postgres is the only database, so the URL uses 5432.
- Do not put secrets in the image. Read them from the environment.

## Interview questions
- Why is the upload handler the wrong place for a vision model?
- What does a healthcheck buy you in Compose?

## Self-check
Write the URL the API on your laptop uses to reach the Compose Postgres, and the URL CI uses.
