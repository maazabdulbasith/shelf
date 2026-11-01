"use client";

import { useState } from "react";
import { keepsText, runAction } from "../lib/actions";
import { thumbUrl } from "../lib/api";

function transitionName(id) {
  const safe = String(id).replace(/[^a-zA-Z0-9_-]/g, "");
  return safe ? `card-${safe}` : undefined;
}

export default function ShotCard({ shot, active, onDelete, onClick }) {
  const [copied, setCopied] = useState("");
  const [broken, setBroken] = useState(false);
  const actions = (shot.actions || []).slice(0, 3);

  function onAction(action, e) {
    e?.stopPropagation();
    if (action.kind === "delete_shot") {
      onDelete?.(shot.id);
      return;
    }
    runAction(action);
    if (!keepsText(action)) return;
    setCopied(action.value);
    window.setTimeout(() => setCopied(""), 1400);
  }

  const imageSrc = shot.src || thumbUrl(shot.id);

  return (
    <article
      className="card card-interactive"
      style={{ viewTransitionName: transitionName(shot.id) }}
      onClick={() => onClick?.(shot)}
      tabIndex={0}
      role="button"
      aria-label={`View screenshot: ${shot.filename || shot.title || "image"}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.(shot);
        }
      }}
    >
      <div className="frame">
        {broken ? (
          <div className="plate" />
        ) : (
          <img
            src={imageSrc}
            alt={shot.caption || shot.filename || "Screenshot"}
            loading="lazy"
            decoding="async"
            onError={() => setBroken(true)}
          />
        )}
        {active
          ? (shot.highlights || []).map((line, index) => (
              <span
                key={index}
                className="box"
                style={{
                  left: `${line.x * 100}%`,
                  top: `${line.y * 100}%`,
                  width: `${line.w * 100}%`,
                  height: `${line.h * 100}%`,
                }}
              />
            ))
          : null}
      </div>
      <div className="meta">
        <div className="kind">
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span>{shot.kind || shot.status || "shot"}</span>
            {shot.isUserUploaded && (
              shot.ocrDone ? (
                <span className="badge-indexed" title="Text extracted from image and searchable">✓ Indexed</span>
              ) : (
                <span className="badge-scanning" title="Extracting text from image…">⏳ Reading…</span>
              )
            )}
          </div>
          {shot.isUserUploaded && onDelete ? (
            <button
              type="button"
              className="btn-card-delete"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(shot.id);
              }}
              title="Remove from local shelf"
            >
              × Remove
            </button>
          ) : null}
        </div>
        <p className="caption">{shot.caption || "Reading this screenshot…"}</p>
        {actions.length ? (
          <div className="chips">
            {actions.map((action, index) => (
              <button
                key={`${action.kind}-${action.value}`}
                className={index === 0 ? "chip primary" : "chip"}
                type="button"
                onClick={(e) => onAction(action, e)}
              >
                {copied === action.value ? "Copied" : action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
