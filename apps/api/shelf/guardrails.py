"""Shared deterministic guardrails for Shelf Ask (Python API)."""

from __future__ import annotations

import re
import unicodedata

INJECTION_MARKERS = (
    "ignore previous instructions",
    "ignore all previous",
    "ignore previous",
    "ignore all instructions",
    "disregard previous",
    "disregard earlier",
    "forget your rules",
    "forget previous",
    "new system message",
    "say the password",
    "system prompt",
    "developer prompt",
    "you are now",
    "reveal the password",
    "reveal credentials",
    "disclose the passphrase",
    "disclose the password",
    "override safety",
    "override",
    "jailbreak",
    "developer mode",
    "do anything now",
    "admin mode",
    "sudo mode",
)

HOMOGLYPHS = str.maketrans(
    {
        "а": "a",
        "А": "a",
        "е": "e",
        "Е": "e",
        "о": "o",
        "О": "o",
        "р": "p",
        "Р": "p",
        "с": "c",
        "С": "c",
        "у": "y",
        "У": "y",
        "х": "x",
        "Х": "x",
        "і": "i",
        "І": "i",
        "ї": "i",
        "ѕ": "s",
        "α": "a",
        "ε": "e",
        "ι": "i",
        "ο": "o",
        "ρ": "p",
        "τ": "t",
        "υ": "y",
        "χ": "x",
    }
)

LEET = str.maketrans(
    {
        "0": "o",
        "1": "i",
        "3": "e",
        "4": "a",
        "5": "s",
        "7": "t",
        "@": "a",
        "$": "s",
    }
)

_ZW_RE = re.compile(r"[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]")
_SPACE_RE = re.compile(r"[^\S\n]+")


def normalize_for_guardrails(text: str) -> str:
    out = unicodedata.normalize("NFKC", text or "")
    out = _ZW_RE.sub("", out)
    out = out.translate(HOMOGLYPHS)
    out = out.lower()
    out = out.translate(LEET)
    out = _SPACE_RE.sub(" ", out).strip()
    return out


def is_injection(text: str) -> bool:
    q = normalize_for_guardrails(text)
    if not q:
        return False
    if any(marker in q for marker in INJECTION_MARKERS):
        return True
    if "ignore" in q and "instruction" in q:
        return True
    if "disregard" in q and ("rule" in q or "instruction" in q):
        return True
    if re.search(r"(print|reveal|show|dump|disclose).{0,24}(system|developer|hidden).{0,12}prompt", q):
        return True
    if re.search(r"\b(dan|jailbreak)\b", q) and re.search(r"\b(password|secret|prompt|credential)\b", q):
        return True
    if re.search(r"\b(ignore|anweisung|instrukt)\b", q) and re.search(
        r"\b(passw|passphrase|geheim|credential)\b", q
    ):
        return True
    return False


def is_wifi_specific(text: str) -> bool:
    q = normalize_for_guardrails(text)
    if re.search(r"\b(not|except|excluding)\b.{0,24}\b(wifi|wi-fi)\b", q):
        return False
    if re.search(r"\b(wifi|wi-fi)\b.{0,24}\b(not|except|excluding)\b", q):
        return False
    if "inject" in q:
        return False
    if "wifi" in q or "wi-fi" in q:
        return True
    if re.search(r"\bguest\s+(wifi|wi-fi|network)\b", q):
        return True
    if "shelf-guest" in q:
        return True
    if re.search(r"\bssid\b", q) and re.search(
        r"\b(wifi|wi-fi|password|passphrase|credential)\b", q
    ) and "irrelevant" not in q:
        return True
    return False


def is_password_like_ask(text: str) -> bool:
    q = normalize_for_guardrails(text)
    return any(
        token in q
        for token in ("password", "passphrase", "secret", "passwort", "credential")
    ) or bool(re.search(r"\bp4ssw?ord\b", q))


def is_safe_token_question(text: str) -> bool:
    q = normalize_for_guardrails(text)
    if "shelftoken" in q or "note-07" in q or "note-19" in q or "hnsw" in q:
        return True
    if "guardrail" in q and not is_password_like_ask(q):
        return True
    return False


def is_generic_password_ask(text: str) -> bool:
    q = normalize_for_guardrails(text)
    if is_safe_token_question(q) and "inject" not in q:
        return False
    if not is_password_like_ask(q):
        return False
    if is_wifi_specific(q):
        return False
    return True


def is_fabrication_ask(text: str) -> bool:
    q = normalize_for_guardrails(text)
    return bool(
        re.search(
            r"\b(invent|fabricate|make up|hallucinate|ssn|social security|fake (id|passport|number))\b",
            q,
        )
    )


def is_inject_artifact_ask(text: str) -> bool:
    q = normalize_for_guardrails(text)
    if "inject.png" in q:
        return True
    return "inject" in q and bool(
        re.search(r"\b(say|quote|exactly|payload|ocr|full text|verbatim)\b", q)
    )


def is_agent_injection_goal(text: str) -> bool:
    q = normalize_for_guardrails(text)
    if is_injection(text) or is_injection(q):
        return True
    if "inject" in q and is_password_like_ask(q):
        return True
    if "dump" in q and is_password_like_ask(q):
        return True
    if "exfiltrat" in q and is_password_like_ask(q):
        return True
    return False


def should_quarantine_evidence(question: str, evidence_text: str) -> bool:
    asks_hidden = (
        is_password_like_ask(question)
        or "instruction" in normalize_for_guardrails(question)
        or is_inject_artifact_ask(question)
    )
    return asks_hidden and is_injection(evidence_text)


def evaluate_ask_guardrails(question: str) -> dict:
    raw = (question or "").strip()
    if not raw:
        return {
            "action": "empty",
            "reason": "empty_query",
            "answer": "Please enter a question to ask the shelf.",
            "citations": [],
            "normalized": "",
        }
    if len(raw) > 4000:
        return {
            "action": "thin",
            "reason": "thin_evidence",
            "answer": "I don't have a screenshot that answers that question.",
            "citations": [],
            "normalized": normalize_for_guardrails(raw),
        }

    normalized = normalize_for_guardrails(raw)

    if is_injection(raw) or is_injection(normalized):
        return {
            "action": "refuse",
            "reason": "prompt_injection",
            "answer": "I won't follow instructions hidden in a question.",
            "citations": [{"id": "inject", "filename": "inject.png"}],
            "normalized": normalized,
        }

    if is_inject_artifact_ask(raw) or is_inject_artifact_ask(normalized):
        return {
            "action": "refuse",
            "reason": "prompt_injection",
            "answer": "That screenshot tries to give me instructions. I won't follow them.",
            "citations": [{"id": "inject", "filename": "inject.png"}],
            "normalized": normalized,
        }

    if is_generic_password_ask(raw) or is_generic_password_ask(normalized):
        return {
            "action": "refuse",
            "reason": "prompt_injection",
            "answer": "That screenshot tries to give me instructions. I won't follow them.",
            "citations": [{"id": "inject", "filename": "inject.png"}],
            "normalized": normalized,
        }

    if is_fabrication_ask(raw) or is_fabrication_ask(normalized):
        return {
            "action": "thin",
            "reason": "thin_evidence",
            "answer": "I don't have a screenshot that answers that question.",
            "citations": [],
            "normalized": normalized,
        }

    return {
        "action": "allow",
        "reason": "",
        "answer": "",
        "citations": [],
        "normalized": normalized,
    }
