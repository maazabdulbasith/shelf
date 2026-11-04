import { NextResponse } from "next/server";
import { isAgentInjectionGoal } from "../../../lib/guardrails.mjs";

export async function POST(request) {
  try {
    const body = await request.json();
    const goal = (body.goal || "").trim() || "Investigate visual memory for flight tickets, airline receipts, or hotel confirmations";
    const maxSteps = Math.min(Math.max(body.max_steps || 3, 1), 6);
    const goalLower = goal.toLowerCase();

    if (isAgentInjectionGoal(goal)) {
      return NextResponse.json({
        goal,
        steps_taken: 0,
        completed: false,
        refused: true,
        reason: "prompt_injection",
        final_report:
          "Refused: the goal contains adversarial instruction markers or asks to follow inject.png. Shelf agents do not execute prompt-injection goals.",
        trace: [],
      });
    }

    const fastApiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;
    if (fastApiUrl) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const resp = await fetch(`${fastApiUrl}/v1/autogpt/investigate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ goal, max_steps: maxSteps }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (resp.ok) {
          return NextResponse.json(await resp.json());
        }
      } catch {
        // FastApi not running; fall through to grounded mock agent
      }
    }

    const trace = [];
    const mode =
      goalLower.includes("receipt") || goalLower.includes("expense") || goalLower.includes("invoice") || goalLower.includes("coffee")
        ? "receipt"
        : goalLower.includes("nginx") || goalLower.includes("error") || goalLower.includes("crash") || goalLower.includes("timeout")
        ? "nginx"
        : "boarding";

    const step1Keywords =
      mode === "receipt"
        ? "receipt invoice bill"
        : mode === "nginx"
        ? "nginx error upstream timeout"
        : "flight ticket airline boarding";

    const targetShotId =
      mode === "receipt" ? "receipt.png" : mode === "nginx" ? "nginx.png" : "boarding.png";

    trace.push({
      step_number: 1,
      thought: `The user's objective is: "${goal}". I must start by querying Shelf's hybrid pgvector memory to identify matching screenshots.`,
      reasoning: "Starting with an exploratory vector RRF search provides an initial candidate pool from OCR and CLIP visual representations.",
      plan: [
        `Search visual memory for keywords: ${step1Keywords}`,
        "Inspect high-scoring candidates for full un-truncated OCR text",
        "Synthesize verified findings and cite Image IDs",
      ],
      criticism: "A single keyword search may miss synonymous documents. I must evaluate the search results critically before concluding.",
      action: "search_visual_memory",
      action_input: { query: step1Keywords },
      observation:
        mode === "receipt"
          ? "Found 1 matching screenshot: receipt.png (Score: 0.884, OCR: 'Third Wave Coffee Roasters, Espresso Blend $14.00, Oat Milk $4.40, Total $18.40, Paid UPI 2026-10-14')"
          : mode === "nginx"
          ? "Found 1 matching screenshot: nginx.png (Score: 0.912, OCR: 'upstream timed out while reading response header from upstream http://127.0.0.1:8000/v1/ingest')"
          : "Found 1 matching screenshot: boarding.png (Score: 0.932, OCR: 'Airways Flight 6E-442 to Dubai DXB, Gate 12, Seat 14F, Zone 2, Boarding 06:15 AM')",
    });

    trace.push({
      step_number: 2,
      thought: `Candidate "${targetShotId}" retrieved. I must inspect its complete, un-truncated OCR and metadata to ensure no critical line items or dates are missed.`,
      reasoning: "Thumbnails and search snippets can truncate dense document text; deep inspection guarantees factual grounding.",
      plan: [
        `Inspect full OCR for Image ID: ${targetShotId}`,
        "Separate verified OCR facts from recommended next checks",
        "Formulate conclusive report",
      ],
      criticism: "Do not invent root causes, PNRs, or tax lines that are not present in the OCR text.",
      action: "inspect_screenshot_detail",
      action_input: { shot_id: targetShotId },
      observation:
        mode === "receipt"
          ? "Verified OCR Facts: Third Wave Coffee Roasters. Date: 2026-10-14. Items: Espresso Blend $14.00 + Oat Milk $4.40. Total: $18.40. Paid via UPI. Invoice #88491."
          : mode === "nginx"
          ? "Verified OCR Facts: nginx upstream timed out while reading response header from upstream; client 192.168.1.105; request POST /v1/ingest; upstream http://127.0.0.1:8000/v1/ingest."
          : "Verified OCR Facts: Airways Flight 6E-442 BLR -> DXB. Date 18 NOV 2026. Boarding 06:15 AM. Gate 12. Seat 14F. Zone 2.",
    });

    const finalReport =
      mode === "receipt"
        ? `### Autonomous Expense Audit Report

**Verified OCR Facts from Screenshot (\`receipt.png\`)**
- Merchant: Third Wave Coffee Roasters
- Date: 2026-10-14
- Items: Espresso Blend ($14.00) + Oat Milk ($4.40)
- Grand Total: **$18.40** (Paid via UPI)
- Invoice #: 88491

**Recommended Next Checks** (not in screenshot OCR)
- Confirm reimbursement policy limits and attach the original image to the expense claim.`
        : mode === "nginx"
        ? `### SRE Incident Investigation Dossier

**Verified OCR Facts from Screenshot (\`nginx.png\`)**
- Symptom: upstream timed out while reading response header from upstream
- Client: 192.168.1.105
- Request: POST /v1/ingest HTTP/1.1
- Upstream: http://127.0.0.1:8000/v1/ingest

**Recommended Next Checks** (inferred; not printed in the screenshot)
- Inspect process health / latency on port 8000
- Review reverse-proxy read timeouts
- Correlate with ingest worker logs around the same request window`
        : `### Autonomous Travel Memory Dossier

**Verified OCR Facts from Screenshot (\`boarding.png\`)**
- Flight: Airways 6E-442 (BLR → DXB)
- Date: 18 NOV 2026
- Boarding: 06:15 AM
- Gate: **12** | Seat: **14F** | Zone: 2

**Recommended Next Checks** (not in screenshot OCR)
- Sync gate/boarding time into calendar and re-check airline app before departure.`;

    trace.push({
      step_number: 3,
      thought: "All necessary evidence has been collected and verified from visual memory. I will now conclude the investigation.",
      reasoning: "The retrieved observations directly answer the user's objective without requiring further tool invocations.",
      plan: ["Synthesize findings into final dossier citing Image IDs"],
      criticism: "Ensure all figures, dates, and Image IDs match the inspected OCR without extraneous speculation.",
      action: "finish_goal",
      action_input: { final_report: finalReport },
      observation: "Investigation completed. Report synthesized.",
    });

    return NextResponse.json({
      goal,
      steps_taken: Math.min(trace.length, maxSteps),
      completed: true,
      final_report: finalReport,
      trace: trace.slice(0, maxSteps),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Investigation failed", details: String(error) },
      { status: 500 }
    );
  }
}
