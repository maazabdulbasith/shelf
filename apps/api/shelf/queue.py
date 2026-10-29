import json
from collections import deque

from .config import REDIS_URL

_memory: deque[str] = deque()


def enqueue(job: dict) -> None:
    raw = json.dumps(job)
    if REDIS_URL:
        try:
            import redis

            redis.Redis.from_url(REDIS_URL).rpush("shelf:ingest", raw)
            return
        except Exception:
            pass
    _memory.append(raw)


def dequeue(timeout: int = 1) -> dict | None:
    if REDIS_URL:
        try:
            import redis

            item = redis.Redis.from_url(REDIS_URL).blpop("shelf:ingest", timeout=timeout)
            if item:
                return json.loads(item[1])
        except Exception:
            pass
    if not _memory:
        return None
    return json.loads(_memory.popleft())


def depth() -> int:
    if REDIS_URL:
        try:
            import redis

            return int(redis.Redis.from_url(REDIS_URL).llen("shelf:ingest"))
        except Exception:
            pass
    return len(_memory)
