from .agent import (
    AutoGPTVisualInvestigator,
    AutoGPTStep,
    AutoGPTResult,
)


def run_autonomous_investigation(goal: str, max_steps: int = 5) -> dict:
    """Executes the autonomous AutoGPT reasoning & tool loop for visual memory."""
    agent = AutoGPTVisualInvestigator(max_steps=max_steps)
    result = agent.run(goal)
    return result.model_dump()


__all__ = [
    "AutoGPTVisualInvestigator",
    "AutoGPTStep",
    "AutoGPTResult",
    "run_autonomous_investigation",
]
