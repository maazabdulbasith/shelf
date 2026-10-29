# 1. How Shelf fits together

## What this is
Shelf is a local search wall for screenshots. You type a phrase you remember. The wall reorders. The matching line is highlighted. One action sits on the card, and nothing happens until you click it.

## Why Shelf uses it
A screenshot is both a picture and a document. Some memories are words ("nginx error"). Some are pictures ("the rainy road"). One signal is not enough, so Shelf keeps three and fuses them.

## How it works
A drop or a folder watcher hashes the file. Redis queues the slow work. RapidOCR reads lines and boxes. A LangGraph ingest graph captions and classifies. FastEmbed writes a text vector and a CLIP image vector. Postgres stores the row, the boxes, a full-text column, and both vectors. A query runs full-text, text-vector, and CLIP search, fuses them with reciprocal rank fusion, then a cross-encoder reranks the top of the list. Ask mode cites the screenshots it used, or refuses.

## What you build
The modules live under `apps/api/shelf`: ingest, ocr, embed, retrieve, understand, ask, actions, providers, store, tracing. The worker drains the queue. The Next.js app is the wall.

## Must-knows
- The upload returns before the model finishes. Search still works on OCR alone.
- The model may suggest an action. Code checks it against a fixed list. A person clicks.
- Real screenshots stay in `data/` and never go into git.

## Interview questions
- Why split ingest from the request thread?
- Which query types fail if you only keep OCR?

## Self-check
Explain, without looking, which stage runs first when a new PNG appears, and which stage can be skipped when the OCR text is already long.
