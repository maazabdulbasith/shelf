import re

ALLOWED = {
    "open_map",
    "open_link",
    "copy_text",
    "copy_command",
    "call",
    "add_to_calendar",
}

URL = re.compile(r"https?://[^\s<>'\"]+")
PHONE = re.compile(r"(?:\+\d{1,3}[\s-]?)?(?:\(?\d{3}\)?[\s-]?)\d{3}[\s-]?\d{4}")
DATE = re.compile(
    r"\b(?:\d{4}-\d{2}-\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,\s*\d{4})?)\b",
    re.I,
)
COMMAND = re.compile(
    r"^(?:sudo\s+)?(?:npm|pnpm|yarn|pip|python|python3|docker|git|kubectl|curl|systemctl)\b.+$",
    re.I,
)
ADDRESS = re.compile(
    r"\b\d{1,5}\s+[A-Z][A-Za-z0-9.'\- ]{2,40}\s(?:Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Drive|Dr|Boulevard|Blvd)\b"
)


def extract(text: str) -> list[dict]:
    found: list[dict] = []
    for url in URL.findall(text or ""):
        found.append({"kind": "open_link", "label": "Open link", "value": url.rstrip(".,)")})
    for phone in PHONE.findall(text or ""):
        found.append({"kind": "call", "label": "Call", "value": phone.strip()})
    for date in DATE.findall(text or ""):
        found.append({"kind": "add_to_calendar", "label": "Add date", "value": date})
    for line in (text or "").splitlines():
        line = line.strip()
        if COMMAND.match(line):
            found.append({"kind": "copy_command", "label": "Copy command", "value": line})
    for address in ADDRESS.findall(text or ""):
        found.append({"kind": "open_map", "label": "Open in Maps", "value": address})
    if not found and (text or "").strip():
        snippet = " ".join(text.split())[:180]
        found.append({"kind": "copy_text", "label": "Copy text", "value": snippet})
    return validate(found)


def validate(actions: list[dict]) -> list[dict]:
    kept = []
    seen = set()
    for action in actions or []:
        kind = action.get("kind")
        value = str(action.get("value") or "").strip()
        if kind not in ALLOWED or not value:
            continue
        key = (kind, value)
        if key in seen:
            continue
        seen.add(key)
        kept.append(
            {
                "kind": kind,
                "label": action.get("label") or kind.replace("_", " "),
                "value": value[:500],
            }
        )
    return kept
