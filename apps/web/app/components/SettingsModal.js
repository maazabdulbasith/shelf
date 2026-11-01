"use client";

import { useEffect, useState } from "react";

export default function SettingsModal({ isOpen, onClose, onKeySaved }) {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("shelf_gemini_api_key") || "";
      setApiKey(stored);
      if (stored) {
        setTestResult({
          ok: true,
          msg: "Personal Gemini API Key currently active in this browser.",
        });
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleTestAndSave() {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      localStorage.removeItem("shelf_gemini_api_key");
      localStorage.removeItem("shelf_byok_active");
      setTestResult({
        ok: true,
        cleared: true,
        msg: "Personal key removed. Shelf will use on-device WASM OCR or server env.",
      });
      onKeySaved?.("");
      return;
    }

    setTesting(true);
    setTestResult(null);

    const t0 = performance.now();
    try {
      const res = await fetch("/v1/ocr", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-gemini-key": trimmed,
        },
        body: JSON.stringify({
          image:
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
          filename: "test-ping.png",
        }),
      });

      const t1 = performance.now();
      const latency = Math.round(t1 - t0);
      const data = await res.json();

      if (data.ok) {
        localStorage.setItem("shelf_gemini_api_key", trimmed);
        localStorage.setItem("shelf_byok_active", "true");
        setTestResult({
          ok: true,
          msg: `🟢 Connected! Gemini 2.5 Flash active (${latency}ms latency). Ready for fast multimodal indexing.`,
        });
        onKeySaved?.(trimmed);
      } else {
        setTestResult({
          ok: false,
          msg: "Could not authenticate with this API key. Please check that it is a valid Gemini API key from Google AI Studio.",
        });
      }
    } catch (err) {
      setTestResult({
        ok: false,
        msg: `Connection test failed: ${err.message}`,
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="shot-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="shot-modal-dialog"
        style={{ maxWidth: "560px", padding: "0" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shot-modal-header">
          <div className="shot-modal-title-group">
            <span className="shot-modal-kind-badge" style={{ color: "#34d399", background: "rgba(16, 185, 129, 0.15)", borderColor: "rgba(16, 185, 129, 0.3)" }}>
              AI Engine
            </span>
            <h3 className="shot-modal-title">Vision & Indexing Settings</h3>
          </div>
          <button
            type="button"
            className="shot-modal-close-btn"
            onClick={onClose}
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
          <div>
            <p style={{ margin: "0 0 12px", color: "#ded6c8", fontSize: "14px", lineHeight: "1.5" }}>
              Shelf supports <strong>dual-engine indexing</strong>. Connect your Google Gemini API key to unlock <strong>200ms multimodal vision</strong>, scene understanding (family, friends, food, nature), and instant OCR.
            </p>
          </div>

          {/* Engine Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div style={{
              padding: "12px",
              borderRadius: "12px",
              background: apiKey ? "rgba(16, 185, 129, 0.08)" : "rgba(243, 236, 223, 0.04)",
              border: `1px solid ${apiKey ? "rgba(16, 185, 129, 0.3)" : "rgba(243, 236, 223, 0.08)"}`
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                <span>🚀</span>
                <strong style={{ fontSize: "13px", color: apiKey ? "#6ee7b7" : "#ded6c8" }}>Gemini 2.5 Flash</strong>
              </div>
              <p style={{ margin: 0, fontSize: "11.5px", color: "#a19582", lineHeight: "1.4" }}>
                ~200ms speed. Extracts text + detects family, objects, food, locations & semantic tags.
              </p>
            </div>

            <div style={{
              padding: "12px",
              borderRadius: "12px",
              background: !apiKey ? "rgba(228, 177, 90, 0.08)" : "rgba(243, 236, 223, 0.04)",
              border: `1px solid ${!apiKey ? "rgba(228, 177, 90, 0.3)" : "rgba(243, 236, 223, 0.08)"}`
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                <span>🛡️</span>
                <strong style={{ fontSize: "13px", color: !apiKey ? "#fde68a" : "#ded6c8" }}>On-Device WASM</strong>
              </div>
              <p style={{ margin: 0, fontSize: "11.5px", color: "#a19582", lineHeight: "1.4" }}>
                100% on-device CPU. Zero cloud network. Extracts text from screenshots offline.
              </p>
            </div>
          </div>

          {/* API Key Input */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#a19582", fontWeight: "600" }}>
              Gemini API Key (Google AI Studio)
            </label>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <input
                type={showKey ? "text" : "password"}
                placeholder="AIzaSy..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                style={{
                  width: "100%",
                  padding: "11px 44px 11px 14px",
                  borderRadius: "10px",
                  background: "#0c0a08",
                  border: "1px solid rgba(243, 236, 223, 0.15)",
                  color: "#f3ecdf",
                  fontSize: "13.5px",
                  fontFamily: "monospace",
                }}
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                style={{
                  position: "absolute",
                  right: "10px",
                  background: "transparent",
                  border: "none",
                  color: "#a19582",
                  cursor: "pointer",
                  fontSize: "14px",
                  padding: "4px",
                }}
                title={showKey ? "Hide key" : "Show key"}
              >
                {showKey ? "👁️" : "🔒"}
              </button>
            </div>
            <span style={{ fontSize: "11px", color: "#78716c" }}>
              Stored strictly in your local browser storage. Never shared with other users.
            </span>
          </div>

          {/* Test Feedback */}
          {testResult && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                fontSize: "12.5px",
                lineHeight: "1.4",
                background: testResult.ok ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                border: `1px solid ${testResult.ok ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                color: testResult.ok ? "#6ee7b7" : "#fca5a5",
              }}
            >
              {testResult.msg}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "4px" }}>
            <button
              type="button"
              className="shot-modal-btn secondary"
              onClick={onClose}
              style={{ padding: "9px 16px" }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="shot-modal-btn primary"
              onClick={handleTestAndSave}
              disabled={testing}
              style={{ padding: "9px 20px" }}
            >
              {testing ? "Testing Connection…" : apiKey.trim() ? "Save & Activate AI Vision" : "Use On-Device Only"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
