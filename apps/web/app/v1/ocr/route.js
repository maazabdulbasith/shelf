import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { image, filename } = await request.json();

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    // Secure Server-Side Authorization:
    // 1. process.env.GEMINI_API_KEY (Encrypted server environment variable on Vercel)
    // 2. Or optional client BYOK header (only if visitor provides their own key in their browser)
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

    const prompt = `Analyze this image or screenshot thoroughly for visual and multimodal search.
1. 'text': Extract all visible text, UI labels, headers, words, and numbers accurately. If the image has no visible text (like a personal photo), return an empty string "".
2. 'caption': Provide a clear, natural 1-to-2 sentence description explaining what is visually depicted (e.g. "A family group photo with several people posing outdoors", "A code editor showing Python functions", "A receipt from a grocery store").
3. 'tags': Provide 12 to 18 lowercase search tags covering:
   - People & subjects: e.g. "family", "group", "people", "friends", "couple", "portrait", "selfie", "crowd", "team", "children", "parents"
   - Activity & setting: e.g. "outdoors", "nature", "party", "gathering", "celebration", "food", "dinner", "office", "travel"
   - Visual style: e.g. "photo", "screenshot", "dashboard", "chat", "code", "document", "receipt"
   - Synonyms: include both broad and specific concepts.
4. 'kind': Best category ('family', 'group', 'portrait', 'dashboard', 'chat', 'code', 'receipt', 'document', 'food', 'nature', 'screenshot', 'photo').
5. 'action': If there is a prominent link, code snippet, email, address, or ID, propose 1 actionable item in 'action' with 'label' and 'value', else null.

Respond strictly in JSON format matching this schema:
{
  "text": "all extracted visible text or empty string",
  "caption": "rich description of what is depicted in the image",
  "tags": ["family", "group", "people", "friends", "outdoors", "gathering"],
  "kind": "group",
  "action": null
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
        maxOutputTokens: 500,
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
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      kind: parsed.kind || "photo",
      action: parsed.action || null,
    });
  } catch (err) {
    console.error("OCR Route error:", err);
    return NextResponse.json({ ok: false, fallback: true, error: String(err) });
  }
}
