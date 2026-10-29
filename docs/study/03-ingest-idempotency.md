# 3. Ingest and idempotency

## What this is
Idempotent ingest means the same file can arrive twice and be stored once. A content hash is the identity of the bytes, not the filename.

## Why Shelf uses it
The watcher and a drag-and-drop can both see the same PNG. A retry after a crash can deliver the same job again. You do not want two cards for one picture.

## How it works
SHA-256 of the file bytes is the `content_hash`. Before saving, Shelf looks up that hash. If it exists, the upload returns the old row and sets `duplicate`. If it does not, Shelf writes the file, a thumbnail, and a queued row, then pushes `{id}` onto a Redis list. The worker pops jobs. If Redis is down, an in-process deque is the fallback so local tests still run.

## What you build
`hashing.py`, `queue.py`, and `ingest.accept_bytes`. The watcher uses `watchdog` on `C:\Users\Dell\Pictures\Screenshots`.

## Must-knows
- A renamed file has the same hash. A re-saved file with one extra pixel does not.
- The queue holds ids, not image bytes. The bytes are already on disk.
- A crash after the row is saved and before the job finishes is safe: the hash is already recorded, and process can be run again.

## Interview questions
- Why is the filename a bad primary key for uploads?
- What is the difference between at-least-once delivery and exactly-once effect?

## Self-check
Drop the same PNG twice. You should see one file on disk and `duplicate: true` on the second response.
