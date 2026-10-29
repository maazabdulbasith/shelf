import time
from collections import defaultdict

_values: dict[str, list[float]] = defaultdict(list)


def record(name: str, milliseconds: float) -> None:
    _values[name].append(milliseconds)
    if len(_values[name]) > 200:
        del _values[name][:-200]


def snapshot(queue_depth: int) -> dict:
    stages = {}
    for name, samples in _values.items():
        stages[name] = {
            "count": len(samples),
            "avg_ms": round(sum(samples) / len(samples), 2) if samples else 0,
        }
    return {"stages": stages, "queue_depth": queue_depth}


def timed(name: str):
    started = time.perf_counter()

    def finish() -> None:
        record(name, (time.perf_counter() - started) * 1000)

    return finish
