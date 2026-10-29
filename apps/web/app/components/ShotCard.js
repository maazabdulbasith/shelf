"use client";

import { useState } from "react";
import { keepsText, runAction } from "../lib/actions";
import { thumbUrl } from "../lib/api";

function transitionName(id) {
  const safe = String(id).replace(/[^a-zA-Z0-9_-]/g, "");
  return safe ? `card-${safe}` : undefined;
}

export default function ShotCard({ shot, active }) {
  const [copied, setCopied] = useState("");
  const [broken, setBroken] = useState(false);
  const actions = (shot.actions || []).slice(0, 3);

  function onAction(action) {
    runAction(action);
    if (!keepsText(action)) return;
    setCopied(action.value);
    window.setTimeout(() => setCopied(""), 1400);
  }

  return (
    <article className="card" style={{ viewTransitionName: transitionName(shot.id) }}>
      <div className="frame">
        {broken ? (
          <div className="plate" />
        ) : (
          <img
            src={thumbUrl(shot.id)}
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
        <div className="kind">{shot.kind || shot.status || "shot"}</div>
        <p className="caption">{shot.caption || "Reading this screenshot…"}</p>
        {actions.length ? (
          <div className="chips">
            {actions.map((action, index) => (
              <button
                key={`${action.kind}-${action.value}`}
                className={index === 0 ? "chip primary" : "chip"}
                type="button"
                onClick={() => onAction(action)}
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
