import os
from crewai import Agent, Task, Crew, Process, LLM
from .tools import search_visual_memory, inspect_screenshot_detail
from .auditor import get_default_llm


def create_incident_investigator_crew(query: str = "error logs, tracebacks, and terminal crashes", llm: LLM | None = None) -> Crew:
    """Builds a collaborative 3-agent CrewAI pipeline for automated system incident triage and post-mortem generation."""
    active_llm = llm or get_default_llm()

    # 1. Systems Telemetry & Log Analyst
    telemetry_analyst = Agent(
        role="Senior SRE Telemetry Analyst",
        goal="Search Shelf visual memory for technical error screenshots, stack traces, Grafana metrics, and terminal logs to extract precise error signatures.",
        backstory=(
            "You are a battle-tested site reliability engineer. You can read terminal screenshots, Docker error dumps, "
            "Nginx 50x timeout logs, and Python tracebacks at a glance, extracting exact error codes, timestamps, and impacted services."
        ),
        tools=[search_visual_memory, inspect_screenshot_detail],
        llm=active_llm,
        verbose=True,
    )

    # 2. Principal Root-Cause Diagnostician
    diagnostician = Agent(
        role="Principal Systems Debugger",
        goal="Correlate extracted telemetry across screenshots, reconstruct the failure timeline, and pinpoint the exact underlying root cause.",
        backstory=(
            "You specialize in distributed systems post-mortems. You understand race conditions, connection pool exhaustion, "
            "reverse-proxy gateway timeouts, and database deadlock scenarios. You deduce the root cause from fragmented log screenshots."
        ),
        llm=active_llm,
        verbose=True,
    )

    # 3. Infrastructure Remediation Engineer
    remediation_engineer = Agent(
        role="Infrastructure Remediation Specialist",
        goal="Produce actionable terminal commands, configuration patches, and preventative regression tests to resolve the issue permanently.",
        backstory=(
            "You write clean, copy-pasteable bash/docker commands and configuration diffs (e.g. nginx.conf, docker-compose.yml, postgresql.conf) "
            "that solve technical incidents with zero unintended side effects."
        ),
        llm=active_llm,
        verbose=True,
    )

    # Define Tasks
    task_telemetry = Task(
        description=(
            f"1. Search visual memory for system incidents related to: '{query}'.\n"
            "2. Identify screenshots containing terminal errors, stack traces, server logs, or monitoring alerts.\n"
            "3. If an error is cut off, call 'Inspect Screenshot Detail' using its Image ID.\n"
            "4. Extract: Timestamps, Error Code/Message, Service/Component, Host/Port, and Image ID."
        ),
        expected_output="Structured breakdown of extracted technical error telemetry and affected services.",
        agent=telemetry_analyst,
    )

    task_diagnosis = Task(
        description=(
            "1. Analyze the telemetry extracted by the SRE analyst.\n"
            "2. Correlate timestamps and error cascades (e.g. did a database connection pool starvation cause upstream Nginx 504 timeouts?).\n"
            "3. Formulate the definitive technical root cause explaining why the failure occurred."
        ),
        expected_output="Technical root-cause diagnosis with causal chain analysis.",
        agent=diagnostician,
    )

    task_remediation = Task(
        description=(
            "1. Generate an Incident Post-Mortem in structured Markdown.\n"
            "2. Include sections:\n"
            "   - **Incident Summary & Impact**\n"
            "   - **Root Cause Analysis (RCA)**\n"
            "   - **Immediate Mitigation (Copy-pasteable Bash / Docker CLI commands)**\n"
            "   - **Long-Term Preventative Patch (Config changes or code updates)**\n"
            "   - **Source Evidence (Citing exact Image IDs from Shelf)**"
        ),
        expected_output="Complete, actionable Markdown Incident Post-Mortem with copy-pasteable commands and Image ID citations.",
        agent=remediation_engineer,
    )

    return Crew(
        agents=[telemetry_analyst, diagnostician, remediation_engineer],
        tasks=[task_telemetry, task_diagnosis, task_remediation],
        process=Process.sequential,
        verbose=True,
    )
