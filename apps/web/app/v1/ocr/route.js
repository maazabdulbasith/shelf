import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { image, filename } = await request.json();

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const clientKey = request.headers.get("x-gemini-key");
    const apiKey = process.env.GEMINI_API_KEY || clientKey;

    if (!apiKey) {
      return NextResponse.json({ ok: false, fallback: true, reason: "no_api_key" });
    }

    // Extract base64 and mime type from data URL
    let base64Data = image;
    let mimeType = "image/png";

    if (image.startsWith("data:")) {
      const match = image.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      }
    }

    const prompt = `Perform OCR on this screenshot. Extract all visible text, UI labels, headers, words, and numbers accurately into the 'text' field.
Provide a clear 1-sentence caption describing the screenshot in 'caption'.
Select the most accurate category in 'kind' ('dashboard', 'chat', 'code', 'menu', 'receipt', 'ticket', 'document', 'photo').
If the screenshot contains a prominent link, code snippet, email, address, or ID, propose 1 actionable item in 'action' with 'label' and 'value'.
Respond strictly in JSON format matching this schema:
{
  "text": "all extracted text from the image",
  "caption": "one sentence describing the screenshot",
  "kind": "dashboard",
  "action": { "label": "Copy Link", "value": "https://..." }
}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const payload = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Gemini OCR error:", errText);
      return NextResponse.json({ ok: false, fallback: true });
    }

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      return NextResponse.json({ ok: false, fallback: true });
    }

    const cleaned = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return NextResponse.json({
      ok: true,
      text: parsed.text || "",
      caption: parsed.caption || `Screenshot: ${filename || "Image"}`,
      kind: parsed.kind || "photo",
      action: parsed.action || null,
    });
  } catch (err) {
    console.error("OCR Route error:", err);
    return NextResponse.json({ ok: false, fallback: true, error: String(err) });
  }
}
