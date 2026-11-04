export const API = process.env.NEXT_PUBLIC_API_URL || "";

export function thumbUrl(id) {
  if (!id) return "/thumbs/default.png";
  if (String(id).startsWith("data:") || String(id).startsWith("http")) {
    return id;
  }
  const clean = String(id).replace(/\.(png|jpg|jpeg|webp)$/i, "");
  return `${API}/thumbs/${clean}.png`;
}

export async function fetchShots(query, signal, options = {}) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (options.includeColorEval) params.set("include_color_eval", "1");
  const qs = params.toString();
  const url = qs ? `${API}/v1/shots?${qs}` : `${API}/v1/shots`;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("shots");
  const body = await response.json();
  return body.shots || [];
}

export async function uploadShot(file) {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${API}/v1/shots?sync=true`, { method: "POST", body: form });
  if (!response.ok) throw new Error("upload");
  return response.json();
}

export async function askShelf(question) {
  const response = await fetch(`${API}/v1/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!response.ok) throw new Error("ask");
  return response.json();
}

export async function runAutoGPT(goal, maxSteps = 4) {
  const response = await fetch(`${API}/v1/autogpt/investigate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ goal, max_steps: maxSteps }),
  });
  if (!response.ok) throw new Error("autogpt");
  return response.json();
}

export async function runExpenseCrew(query = "receipts and invoices") {
  const response = await fetch(`${API}/v1/crews/expense-audit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) throw new Error("expense_crew");
  return response.json();
}

export async function runIncidentCrew(query = "nginx error logs and stack traces") {
  const response = await fetch(`${API}/v1/crews/incident-triage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) throw new Error("incident_crew");
  return response.json();
}
