"use client";

import { useEffect, useState } from "react";
import { thumbUrl } from "../lib/api";

async function getPngBlob(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to convert image to PNG blob"));
      }, "image/png");
    };
    img.onerror = () => reject(new Error("Failed to load image for blob conversion"));
    img.src = src;
  });
}

export default function ShotModal({ shot, allShots = [], onClose, onSelectShot }) {
  const [copyStatus, setCopyStatus] = useState("");
  const [shareStatus, setShareStatus] = useState("");
  const [copyTextStatus, setCopyTextStatus] = useState("");
  const [isSharing, setIsSharing] = useState(false);

  const currentIndex = allShots.findIndex((s) => s.id === shot.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex !== -1 && currentIndex < allShots.length - 1;

  const imageSrc = shot.src || thumbUrl(shot.id);

  // Keyboard navigation: Escape to close, Left/Right for prev/next
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft" && hasPrev) {
        onSelectShot(allShots[currentIndex - 1]);
      } else if (e.key === "ArrowRight" && hasNext) {
        onSelectShot(allShots[currentIndex + 1]);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentIndex, hasPrev, hasNext, allShots, onClose, onSelectShot]);

  // Lock background scroll when modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // 1. Copy image directly to OS clipboard (pasteable anywhere: WhatsApp, Slack, Docs, Figma)
  async function handleCopyImage() {
    setCopyStatus("Copying…");
    try {
      if (!navigator.clipboard?.write) {
        throw new Error("Async Clipboard API not supported");
      }
      const blob = await getPngBlob(imageSrc);
      const item = new ClipboardItem({ "image/png": blob });
      await navigator.clipboard.write([item]);
      setCopyStatus("✓ Image Copied!");
      setTimeout(() => setCopyStatus(""), 2400);
    } catch (err) {
      console.warn("Direct image clipboard copy failed, falling back to URL copy:", err);
      try {
        await navigator.clipboard.writeText(imageSrc);
        setCopyStatus("✓ Image URL Copied");
      } catch {
        setCopyStatus("Copy not supported");
      }
      setTimeout(() => setCopyStatus(""), 2400);
    }
  }

  // 2. Share image to other apps (WhatsApp, Telegram, Slack, AirDrop, Nearby Share)
  async function handleShareImage() {
    setIsSharing(true);
    setShareStatus("Opening Share…");
    try {
      const blob = await getPngBlob(imageSrc);
      const filename = shot.filename || `${shot.title || "screenshot"}.png`;
      const file = new File([blob], filename, { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: shot.title || shot.filename || "Screenshot from Shelf",
          text: shot.caption || "Shared from Shelf",
        });
        setShareStatus("✓ Shared");
      } else if (navigator.share) {
        await navigator.share({
          title: shot.title || shot.filename || "Screenshot from Shelf",
          text: shot.caption || "Shared from Shelf",
          url: window.location.href,
        });
        setShareStatus("✓ Shared");
      } else {
        // Fallback for browsers without Web Share API: trigger download
        handleDownload();
        setShareStatus("✓ Downloaded");
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Share error:", err);
        setShareStatus("Share failed");
      } else {
        setShareStatus("");
      }
    } finally {
      setIsSharing(false);
      setTimeout(() => setShareStatus(""), 2400);
    }
  }

  // 3. Copy extracted OCR text
  async function handleCopyText() {
    if (!shot.text) return;
    try {
      await navigator.clipboard.writeText(shot.text);
      setCopyTextStatus("✓ Text Copied!");
      setTimeout(() => setCopyTextStatus(""), 2400);
    } catch {
      setCopyTextStatus("Failed to copy");
      setTimeout(() => setCopyTextStatus(""), 2400);
    }
  }

  // 4. Download image file
  function handleDownload() {
    const a = document.createElement("a");
    a.href = imageSrc;
    a.download = shot.filename || `${shot.title || "screenshot"}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <div className="shot-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="shot-modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header Bar */}
        <div className="shot-modal-header">
          <div className="shot-modal-title-group">
            <span className="shot-modal-kind-badge">{shot.kind || shot.status || "Screenshot"}</span>
            <h3 className="shot-modal-title">{shot.filename || shot.title || "Screenshot"}</h3>
            {shot.ocrDone ? (
              <span className="badge-indexed" title="Text extracted and indexed">✓ Indexed</span>
            ) : shot.isUserUploaded ? (
              <span className="badge-scanning" title="Extracting text…">⏳ Reading…</span>
            ) : null}
          </div>

          <button
            type="button"
            className="shot-modal-close-btn"
            onClick={onClose}
            aria-label="Close viewer"
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="shot-modal-content">
          {/* Main Image Stage */}
          <div className="shot-modal-image-stage">
            {hasPrev && (
              <button
                type="button"
                className="shot-modal-nav-btn prev"
                onClick={() => onSelectShot(allShots[currentIndex - 1])}
                title="Previous screenshot (Left Arrow)"
              >
                ‹
              </button>
            )}

            <div className="shot-modal-image-wrapper">
              <img
                src={imageSrc}
                alt={shot.caption || shot.filename || "Screenshot preview"}
                className="shot-modal-img"
              />
            </div>

            {hasNext && (
              <button
                type="button"
                className="shot-modal-nav-btn next"
                onClick={() => onSelectShot(allShots[currentIndex + 1])}
                title="Next screenshot (Right Arrow)"
              >
                ›
              </button>
            )}
          </div>

          {/* Sidebar / Metadata & Actions */}
          <div className="shot-modal-sidebar">
            {/* Quick Action Buttons */}
            <div className="shot-modal-actions-box">
              <button
                type="button"
                className="shot-modal-btn primary"
                onClick={handleCopyImage}
                title="Copy full image directly to clipboard to paste anywhere (Ctrl+V)"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                </svg>
                <span>{copyStatus || "Copy Image to Clipboard"}</span>
              </button>

              <button
                type="button"
                className="shot-modal-btn share"
                onClick={handleShareImage}
                disabled={isSharing}
                title="Share this screenshot to WhatsApp, Telegram, Slack, or other apps"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" x2="12" y1="2" y2="15" />
                </svg>
                <span>{shareStatus || "Share to Other Apps"}</span>
              </button>

              <div className="shot-modal-btn-row">
                {shot.text ? (
                  <button
                    type="button"
                    className="shot-modal-btn secondary"
                    onClick={handleCopyText}
                    title="Copy all extracted OCR text"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="4 7 4 4 20 4 20 7" />
                      <line x1="9" x2="15" y1="20" y2="20" />
                      <line x1="12" x2="12" y1="4" y2="20" />
                    </svg>
                    <span>{copyTextStatus || "Copy Text"}</span>
                  </button>
                ) : null}

                <button
                  type="button"
                  className="shot-modal-btn secondary"
                  onClick={handleDownload}
                  title="Download image file"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" x2="12" y1="15" y2="3" />
                  </svg>
                  <span>Download</span>
                </button>
              </div>
            </div>

            {/* Description & Caption */}
            <div className="shot-modal-section">
              <h4>Caption</h4>
              <p className="shot-modal-caption">
                {shot.caption || "No caption generated yet."}
              </p>
            </div>

            {/* Extracted Text (OCR) */}
            <div className="shot-modal-section">
              <div className="shot-modal-section-header">
                <h4>Extracted Text (OCR)</h4>
                {shot.ocrEngine ? (
                  <span className="shot-modal-engine-badge">{shot.ocrEngine}</span>
                ) : null}
              </div>
              <div className="shot-modal-text-transcript">
                {shot.text ? (
                  <pre>{shot.text}</pre>
                ) : (
                  <p className="shot-modal-empty-text">No text extracted from this image.</p>
                )}
              </div>
            </div>

            {/* Suggested Actions if any */}
            {(shot.actions || []).length > 0 && (
              <div className="shot-modal-section">
                <h4>Suggested Actions</h4>
                <div className="chips">
                  {shot.actions.map((act, i) => (
                    <button
                      key={i}
                      type="button"
                      className="chip primary"
                      onClick={() => {
                        if (act.value) {
                          navigator.clipboard?.writeText(act.value);
                          setCopyTextStatus(`✓ Copied ${act.label}`);
                          setTimeout(() => setCopyTextStatus(""), 2000);
                        }
                      }}
                    >
                      {act.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
