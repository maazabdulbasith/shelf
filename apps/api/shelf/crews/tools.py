from crewai.tools import tool
from ..ingest import get_store
from ..retrieve import search


@tool("Search Visual Memory")
def search_visual_memory(query: str) -> str:
    """Searches Shelf's personal screenshot database using hybrid vector RRF (Reciprocal Rank Fusion).
    Returns the top matching screenshots along with their OCR transcripts, captions, and image IDs.
    Args:
        query: Search term or description (e.g. 'uber receipt', 'nginx timeout error', 'boarding pass')
    """
    try:
        store = get_store()
        hits = search(store, query.strip(), mode="hybrid_rerank", limit=5)
        if not hits:
            return "No matching screenshots found in visual memory for query: " + query

        formatted_entries = []
        for i, hit in enumerate(hits, 1):
            shot_id = hit.get("id", "unknown")
            filename = hit.get("filename", "shot.png")
            caption = hit.get("caption", "No description available.")
            ocr_text = (hit.get("ocr_text") or "").strip()
            # truncate OCR if exceedingly long to stay within clean context budget
            if len(ocr_text) > 800:
                ocr_text = ocr_text[:800] + "... [truncated]"
            
            entities = ", ".join(hit.get("entities") or [])
            score = round(hit.get("score", 0.0), 3)

            entry = (
                f"--- [Match #{i}] ---\n"
                f"Image ID: {shot_id}\n"
                f"Filename: {filename}\n"
                f"Relevance Score: {score}\n"
                f"Scene Caption: {caption}\n"
                f"Extracted Entities: {entities or 'None'}\n"
                f"OCR Text Content:\n{ocr_text or '[No readable text on this image]'}\n"
            )
            formatted_entries.append(entry)

        return "\n".join(formatted_entries)
    except Exception as exc:
        return f"Error executing visual memory search: {str(exc)}"


@tool("Inspect Screenshot Detail")
def inspect_screenshot_detail(shot_id: str) -> str:
    """Retrieves full un-truncated OCR text, metadata, and detected bounding boxes for a specific screenshot by its ID.
    Args:
        shot_id: The unique identifier of the screenshot (e.g. 'shot-01', UUID)
    """
    try:
        store = get_store()
        row = store.get(shot_id.strip())
        if not row:
            return f"Screenshot with ID '{shot_id}' not found in visual memory."

        filename = row.get("filename", "")
        caption = row.get("caption", "")
        kind = row.get("kind", "other")
        ocr_text = row.get("ocr_text", "")
        entities = ", ".join(row.get("entities") or [])

        return (
            f"Screenshot Details for {shot_id}:\n"
            f"Filename: {filename}\n"
            f"Classified Category: {kind}\n"
            f"Caption: {caption}\n"
            f"Entities: {entities}\n"
            f"Full Raw OCR Text:\n{ocr_text}\n"
        )
    except Exception as exc:
        return f"Error inspecting screenshot {shot_id}: {str(exc)}"
