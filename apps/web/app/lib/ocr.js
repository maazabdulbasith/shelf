// Client-Side OCR & Vision Engine for Shelf

function resizeImageForOcr(dataUrl, maxDim = 1200) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width <= maxDim && height <= maxDim) {
        resolve(dataUrl);
        return;
      }
      if (width > height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function loadTesseractScript() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      resolve(null);
      return;
    }
    if (window.Tesseract) {
      resolve(window.Tesseract);
      return;
    }
    const existing = document.getElementById("tesseract-cdn-script");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.Tesseract));
      return;
    }
    const script = document.createElement("script");
    script.id = "tesseract-cdn-script";
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    script.onload = () => resolve(window.Tesseract);
    script.onerror = () => reject(new Error("Could not load Tesseract OCR"));
    document.head.appendChild(script);
  });
}

export async function runOcrOnImage(dataUrl, filename = "") {
  // 1. Try serverless AI OCR endpoint first (Gemini 2.5 Flash)
  try {
    const customKey =
      typeof window !== "undefined"
        ? localStorage.getItem("shelf_gemini_api_key")
        : null;
    const headers = { "Content-Type": "application/json" };
    if (customKey) {
      headers["x-gemini-key"] = customKey;
    }

    const res = await fetch("/v1/ocr", {
      method: "POST",
      headers,
      body: JSON.stringify({ image: dataUrl, filename }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.ok && data.text) {
        return {
          text: data.text,
          caption: data.caption,
          kind: data.kind,
          action: data.action,
          engine: "gemini-flash",
        };
      }
    }
  } catch (err) {
    console.warn("Serverless OCR unavailable, falling back to local Tesseract WASM:", err);
  }

  // 2. Client-Side WebAssembly OCR fallback (Tesseract.js)
  try {
    const Tesseract = await loadTesseractScript();
    if (!Tesseract) throw new Error("No Tesseract available");

    const optimizedDataUrl = await resizeImageForOcr(dataUrl, 1200);
    const result = await Tesseract.recognize(optimizedDataUrl, "eng");
    const extractedText = (result?.data?.text || "").trim();

    return {
      text: extractedText,
      caption: extractedText
        ? `Screenshot containing: ${extractedText.slice(0, 80).replace(/\s+/g, " ")}…`
        : `Screenshot: ${filename}`,
      kind: "photo",
      action: null,
      engine: "tesseract-wasm",
    };
  } catch (err) {
    console.error("Local OCR error:", err);
    return {
      text: filename.toLowerCase().replace(/[-_.]/g, " "),
      caption: `Screenshot: ${filename}`,
      kind: "photo",
      action: null,
      engine: "none",
    };
  }
}
