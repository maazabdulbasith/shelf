export const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function thumbUrl(id) {
  return `${API}/thumbs/${id}.jpg`;
}

export async function fetchShots(query, signal) {
  const url = query ? `${API}/v1/shots?q=${encodeURIComponent(query)}` : `${API}/v1/shots`;
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
