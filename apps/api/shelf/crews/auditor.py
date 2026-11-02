import os
from crewai import Agent, Task, Crew, Process, LLM
from .tools import search_visual_memory, inspect_screenshot_detail


def get_default_llm() -> LLM:
    """Initializes the standard Gemini LLM for CrewAI agents."""
    api_key = os.getenv("GEMINI_API_KEY")
    model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")
    if not model_name.startswith("gemini/"):
        model_name = f"gemini/{model_name}"
    return LLM(
        model=model_name,
        api_key=api_key,
        temperature=0.2,
    )


def create_expense_auditor_crew(query: str = "receipts, invoices, and bills", llm: LLM | None = None) -> Crew:
    """Builds a collaborative 3-agent CrewAI pipeline for autonomous visual expense reconciliation."""
    active_llm = llm or get_default_llm()

    # 1. Visual Financial Extraction Agent
    extractor = Agent(
        role="Senior Financial Document Specialist",
        goal="Search Shelf visual memory and extract structured monetary transactions from receipts, invoices, and payment screenshots.",
        backstory=(
            "You are an expert accountant specializing in forensic document extraction. You parse noisy, "
            "partially occluded OCR text from physical receipts, POS terminals, and digital checkout confirmations "
            "with zero hallucination."
        ),
        tools=[search_visual_memory, inspect_screenshot_detail],
        llm=active_llm,
        verbose=True,
    )

    # 2. Tax Compliance & Policy Auditor Agent
    auditor = Agent(
        role="Corporate Tax Compliance & Policy Auditor",
        goal="Audit extracted line items for arithmetic consistency, tax identification numbers, VAT/GST breakdown, and corporate deduction policies.",
        backstory=(
            "You are a meticulous auditor with deep knowledge of international corporate expense standards. "
            "You cross-examine line items, verify that subtotal + tax equals total, flag duplicate receipts, and categorize "
            "expenditures into standard accounting buckets (Travel, Software, Dining, Hardware, Office)."
        ),
        llm=active_llm,
        verbose=True,
    )

    # 3. Ledger & Reimbursement Controller Agent
    controller = Agent(
        role="Executive Expense Controller",
        goal="Synthesize the audited financial data into a clean, executive-ready Markdown ledger with verified totals and exact source citations.",
        backstory=(
            "You compile final financial briefings for CFOs and finance departments. Your reports are concise, mathematically "
            "sound, and cite the exact Image IDs of every verified receipt so human reviewers can verify proof of payment in 1 click."
        ),
        llm=active_llm,
        verbose=True,
    )

    # Define Tasks
    task_extraction = Task(
        description=(
            f"1. Use 'Search Visual Memory' with relevant keywords derived from: '{query}'.\n"
            "2. Identify all screenshots that contain financial receipts, invoices, tickets, or bills.\n"
            "3. If a receipt text looks incomplete, call 'Inspect Screenshot Detail' with the Image ID.\n"
            "4. Extract: Vendor Name, Transaction Date, Currency, Subtotal, Tax/VAT, Total Amount, and Image ID."
        ),
        expected_output="Structured list of extracted financial transactions with Image IDs.",
        agent=extractor,
    )

    task_audit = Task(
        description=(
            "1. Review the extracted transactions from the extractor.\n"
            "2. Verify arithmetic correctness (subtotal + tax = total).\n"
            "3. Categorize each item into an accounting classification (e.g., SaaS / Subscriptions, Ground Travel, Meals, Office Supplies).\n"
            "4. Flag any anomalies (e.g. missing VAT registration numbers, duplicate charges, or handwritten modifications)."
        ),
        expected_output="Audited transaction list with category tags and any compliance warning notes.",
        agent=auditor,
    )

    task_reporting = Task(
        description=(
            "1. Compile the audited transactions into a professional Markdown expense report.\n"
            "2. Include an executive summary stating: Total Expenses, Total Tax Paid, and Number of Receipts Audited.\n"
            "3. Format transactions in a clean Markdown table: | Date | Vendor | Category | Tax | Total | Source Image ID |\n"
            "4. Add a 'Compliance Notes' section for any flagged anomalies or receipts lacking formal tax invoices."
        ),
        expected_output="A finalized, executive-ready Markdown expense report with source Image ID citations.",
        agent=controller,
    )

    return Crew(
        agents=[extractor, auditor, controller],
        tasks=[task_extraction, task_audit, task_reporting],
        process=Process.sequential,
        verbose=True,
    )
