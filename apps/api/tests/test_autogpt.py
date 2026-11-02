from unittest.mock import patch
import pytest
from datetime import datetime, timezone

from shelf.autogpt import AutoGPTVisualInvestigator, run_autonomous_investigation
from shelf.store import MemoryStore
from shelf.ingest import set_store


@pytest.fixture(autouse=True)
def setup_memory_store():
    store = MemoryStore()
    now = datetime.now(timezone.utc).isoformat()
    store.upsert(
        {
            "id": "shot-flight-01",
            "content_hash": "hash-flight-01",
            "created_at": now,
            "filename": "emirates_ticket.png",
            "ocr_text": "Emirates Flight EK-565\nFrom: BLR Bengaluru To: DXB Dubai\nDate: 14 Dec 2026\nSeat: 18A\nBooking Ref: 7X89KL",
            "caption": "Emirates boarding pass for Bengaluru to Dubai on 14 Dec 2026.",
            "kind": "ticket",
            "entities": ["Emirates", "Dubai", "EK-565", "14 Dec 2026"],
        }
    )
    store.upsert(
        {
            "id": "shot-hotel-01",
            "content_hash": "hash-hotel-01",
            "created_at": now,
            "filename": "marriott_dubai.png",
            "ocr_text": "JW Marriott Marquis Hotel Dubai\nCheck-in: 14 Dec 2026, Check-out: 18 Dec 2026\nTotal Paid: AED 2,450.00",
            "caption": "Hotel reservation confirmation for JW Marriott Marquis Dubai.",
            "kind": "receipt",
            "entities": ["JW Marriott", "Dubai", "AED 2,450.00"],
        }
    )
    set_store(store)
    yield store


def test_autogpt_step_reasoning_and_tool_dispatch():
    mock_hits = [
        {
            "id": "shot-flight-01",
            "filename": "emirates_ticket.png",
            "caption": "Emirates boarding pass to Dubai.",
            "ocr_text": "Emirates Flight EK-565 Date: 14 Dec 2026",
            "entities": ["Emirates", "Dubai"],
            "score": 0.95,
        }
    ]

    with patch("shelf.crews.tools.search", return_value=mock_hits):
        investigator = AutoGPTVisualInvestigator(max_steps=2)
        # Run test with mock responses: Step 1 searches memory, Step 2 finishes
        responses = [
            '{"thought": "Need flight ticket", "reasoning": "Verify destination", "plan": ["Search flight"], "criticism": "Check dates", "action": "search_visual_memory", "action_input": {"query": "Dubai flight"}}',
            '{"thought": "Found flight EK-565 to Dubai on 14 Dec", "reasoning": "Flight is verified", "plan": [], "criticism": "Need hotel details next", "action": "finish_goal", "action_input": {"final_report": "Flight EK-565 confirmed to Dubai on 14 Dec (Image ID: shot-flight-01)."}}'
        ]
        
        with patch.object(investigator, "_call_llm", side_effect=responses):
            result = investigator.run("Verify travel bookings to Dubai")

            assert result.completed is True
            assert result.steps_taken == 2
            assert "Flight EK-565 confirmed" in result.final_report
            assert len(result.trace) == 2
            assert result.trace[0].action == "search_visual_memory"
            assert "shot-flight-01" in result.trace[0].observation
            assert result.trace[1].action == "finish_goal"


def test_autogpt_inspect_detail_dispatch():
    investigator = AutoGPTVisualInvestigator(max_steps=2)
    responses = [
        '{"thought": "Need full text of hotel", "reasoning": "Extract AED amount", "plan": [], "criticism": "", "action": "inspect_screenshot_detail", "action_input": {"shot_id": "shot-hotel-01"}}',
        '{"thought": "Hotel total is AED 2,450.00", "reasoning": "Goal satisfied", "plan": [], "criticism": "", "action": "finish_goal", "action_input": {"final_report": "JW Marriott reservation verified for AED 2,450.00."}}'
    ]

    with patch.object(investigator, "_call_llm", side_effect=responses):
        result = investigator.run("How much did the Dubai hotel cost?")
        assert result.completed is True
        assert "AED 2,450.00" in result.trace[0].observation
        assert "JW Marriott" in result.final_report


def test_autogpt_max_steps_cap():
    investigator = AutoGPTVisualInvestigator(max_steps=1)
    # Never sends finish_goal
    responses = [
        '{"thought": "Still searching", "reasoning": "Need more data", "plan": ["Step A"], "criticism": "Slow progress", "action": "search_visual_memory", "action_input": {"query": "anything"}}'
    ]
    with patch.object(investigator, "_call_llm", side_effect=responses):
        result = investigator.run("Infinite loop goal")
        assert result.steps_taken == 1
        assert "maximum allotted steps" in result.final_report
