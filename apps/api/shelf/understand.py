from typing import TypedDict

from langgraph.graph import END, StateGraph

from .actions import extract, validate
from .providers import understand


class IngestState(TypedDict, total=False):
    ocr_text: str
    image_path: str
    provider: str
    kind: str
    caption: str
    actions: list
    prompt_version: str
    provider_used: str


def _caption_needed(state: IngestState) -> str:
    if len(state.get("ocr_text", "").split()) >= 12:
        return "extract"
    return "caption"


def _caption(state: IngestState) -> IngestState:
    result = understand(state.get("ocr_text", ""), state.get("image_path"), state.get("provider", "scripted"))
    return {
        "kind": result["kind"],
        "caption": result["caption"],
        "actions": result["suggested_actions"],
        "prompt_version": result["prompt_version"],
        "provider_used": result["provider"],
    }


def _extract(state: IngestState) -> IngestState:
    if not state.get("caption"):
        result = understand(state.get("ocr_text", ""), None, "scripted")
        state = {**state, "kind": result["kind"], "caption": result["caption"], "provider_used": "scripted"}
    actions = validate(extract(state.get("ocr_text", "")) + state.get("actions", []))
    return {
        "kind": state.get("kind", "other"),
        "caption": state.get("caption", ""),
        "actions": actions,
        "prompt_version": state.get("prompt_version") or understand("")["prompt_version"],
        "provider_used": state.get("provider_used", "scripted"),
    }


def build_graph():
    graph = StateGraph(IngestState)
    graph.add_node("caption", _caption)
    graph.add_node("extract", _extract)
    graph.set_conditional_entry_point(_caption_needed, {"caption": "caption", "extract": "extract"})
    graph.add_edge("caption", "extract")
    graph.add_edge("extract", END)
    return graph.compile()


GRAPH = build_graph()


def run_understand(ocr_text: str, image_path: str, provider: str = "scripted") -> dict:
    return GRAPH.invoke({"ocr_text": ocr_text, "image_path": image_path, "provider": provider})
