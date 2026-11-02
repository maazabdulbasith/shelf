from .auditor import create_expense_auditor_crew
from .investigator import create_incident_investigator_crew


def run_expense_audit(query: str = "receipts, invoices, and bills") -> dict:
    """Executes the autonomous 3-agent Expense Auditor Crew and returns structured results."""
    crew = create_expense_auditor_crew(query=query)
    result = crew.kickoff()
    return {
        "crew": "expense_auditor",
        "query": query,
        "result": str(result),
    }


def run_incident_triage(query: str = "error logs and terminal crashes") -> dict:
    """Executes the autonomous 3-agent Incident Investigator Crew and returns structured results."""
    crew = create_incident_investigator_crew(query=query)
    result = crew.kickoff()
    return {
        "crew": "incident_investigator",
        "query": query,
        "result": str(result),
    }


__all__ = [
    "create_expense_auditor_crew",
    "create_incident_investigator_crew",
    "run_expense_audit",
    "run_incident_triage",
]
