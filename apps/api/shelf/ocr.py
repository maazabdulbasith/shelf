from pathlib import Path

from PIL import Image


_engine = None


def read_lines(path: Path) -> list[dict]:
    global _engine
    from rapidocr_onnxruntime import RapidOCR

    image = Image.open(path).convert("RGB")
    width, height = image.size
    if _engine is None:
        _engine = RapidOCR()
    result, _elapsed = _engine(str(path))
    lines = []
    for item in result or []:
        box, text, score = item
        xs = [point[0] for point in box]
        ys = [point[1] for point in box]
        left, top = min(xs), min(ys)
        right, bottom = max(xs), max(ys)
        lines.append(
            {
                "text": str(text).strip(),
                "confidence": float(score),
                "x": left / width,
                "y": top / height,
                "w": (right - left) / width,
                "h": (bottom - top) / height,
            }
        )
    lines = [line for line in lines if line["text"]]
    lines.sort(key=lambda line: (round(line["y"], 2), line["x"]))
    return lines


def text_from_lines(lines: list[dict]) -> str:
    """Join boxes on the same row with spaces, and rows with newlines."""
    rows: list[list[dict]] = []
    for line in lines:
        if rows and abs(line["y"] - rows[-1][0]["y"]) < 0.03:
            rows[-1].append(line)
        else:
            rows.append([line])
    return "\n".join(" ".join(line["text"] for line in row) for row in rows)
