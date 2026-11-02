from unittest.mock import patch
import pytest
from datetime import datetime, timezone
from shelf.crews.tools import search_visual_memory, inspect_screenshot_detail
from shelf.crews.auditor import create_expense_auditor_crew
from shelf.crews.investigator import create_incident_investigator_crew
from shelf.store import MemoryStore
from shelf.ingest import set_store


@pytest.fixture(autouse=True)
def setup_memory_store():
    store = MemoryStore()
    now = datetime.now(timezone.utc).isoformat()
    store.upsert(
        {
            "id": "shot-receipt-01",
            "content_hash": "hash-01",
            "created_at": now,
            "filename": "uber_eats.png",
            "ocr_text": "Uber Eats Order #9482\nBurger King Indiranagar\nTotal: INR 450.00\nGST 5%: INR 22.50\nGrand Total: INR 472.50",
            "caption": "Food delivery receipt from Uber Eats for Burger King with GST breakdown.",
            "kind": "receipt",
            "entities": ["Uber Eats", "Burger King", "INR 472.50"],
        }
    )
    store.upsert(
        {
            "id": "shot-error-01",
            "content_hash": "hash-02",
            "created_at": now,
            "filename": "nginx_err.png",
            "ocr_text": "upstream timed out (110: Connection timed out) while reading response header from upstream\nserver: api.internal, request: POST /v1/ingest HTTP/1.1",
            "caption": "Nginx server log showing 504 upstream timeout on port 8000.",
            "kind": "error",
            "entities": ["504", "Nginx", "Connection timed out"],
        }
    )
    set_store(store)
    yield store


def test_visual_memory_search_tool():
    mock_hits = [
        {
            "id": "shot-receipt-01",
            "filename": "uber_eats.png",
            "caption": "Food delivery receipt from Uber Eats with GST.",
            "ocr_text": "Uber Eats Grand Total: INR 472.50",
            "entities": ["Uber Eats", "INR 472.50"],
            "score": 0.892,
        }
    ]
    with patch("shelf.crews.tools.search", return_value=mock_hits):
        output = search_visual_memory.run("Uber Eats")
        assert "shot-receipt-01" in output
        assert "INR 472.50" in output
        assert "Scene Caption" in output


def test_inspect_screenshot_detail_tool():
    detail = inspect_screenshot_detail.run("shot-error-01")
    assert "upstream timed out" in detail
    assert "Classified Category: error" in detail


def test_inspect_unknown_screenshot():
    res = inspect_screenshot_detail.run("non-existent-id")
    assert "not found" in res


def test_create_expense_crew_structure():
    crew = create_expense_auditor_crew(query="find receipts")
    assert len(crew.agents) == 3
    assert len(crew.tasks) == 3

    roles = [agent.role for agent in crew.agents]
    assert "Senior Financial Document Specialist" in roles
    assert "Corporate Tax Compliance & Policy Auditor" in roles
    assert "Executive Expense Controller" in roles


def test_create_incident_crew_structure():
    crew = create_incident_investigator_crew(query="nginx crashes")
    assert len(crew.agents) == 3
    assert len(crew.tasks) == 3

    roles = [agent.role for agent in crew.agents]
    assert "Senior SRE Telemetry Analyst" in roles
    assert "Principal Systems Debugger" in roles
    assert "Infrastructure Remediation Specialist" in roles
