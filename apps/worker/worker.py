import time

from shelf.ingest import process_shot
from shelf.queue import dequeue


def main() -> None:
    while True:
        job = dequeue(timeout=2)
        if not job:
            time.sleep(0.2)
            continue
        process_shot(job["id"])


if __name__ == "__main__":
    main()
