"use client";

import { useState } from "react";
import { runAutoGPT, runExpenseCrew, runIncidentCrew, askShelf, thumbUrl } from "../lib/api";

const PRESETS = {
  autogpt: [
    { label: "✈️ Find Dubai boarding pass & gate", query: "Investigate visual memory for flight tickets, airline receipts, or hotel confirmations" },
    { label: "🧾 Audit coffee & dining receipts", query: "Investigate visual memory for coffee receipts, dining bills, and VAT breakdown" },
    { label: "🚨 Triage Nginx 504 gateway timeout", query: "Investigate terminal crashes, 504 errors, and Nginx timeout logs" },
    { label: "🐳 Find Docker & database commands", query: "Search for Docker compose commands and postgres container setups" }
  ],
  crew_expense: [
    { label: "☕ Audit Third Wave Coffee receipt", query: "Third Wave Coffee receipt and UPI invoice" },
    { label: "📊 Reconcile all food & travel bills", query: "receipts, invoices, and payment confirmations" },
    { label: "💳 Verify tax & VAT line items", query: "tax breakdown, subtotal, and VAT numbers" }
  ],
  crew_incident: [
    { label: "💥 Triage Nginx upstream timeout", query: "nginx error 504 upstream timed out port 8000" },
    { label: "🐍 Diagnose Python traceback", query: "python traceback, exception, and crash logs" },
    { label: "⚙️ Audit Docker container failure", query: "docker compose container exit and timeout logs" }
  ],
  ask: [
    { label: "📶 What was the wifi password?", query: "What was the wifi password?" },
    { label: "🚪 Where is the team meeting?", query: "Where is the team meeting scheduled?" },
    { label: "🏢 Where is the Bengaluru office?", query: "What is the address of the Bengaluru office?" }
  ]
};

export default function AgentStudio({ isOpen, onToggle }) {
  const [activeTab, setActiveTab] = useState("autogpt"); // autogpt | crew_expense | crew_incident | ask
  const [prompt, setPrompt] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [resultData, setResultData] = useState(null);
  const [copied, setCopied] = useState(false);

  async function handleExecute(queryOverride) {
    const text = (queryOverride || prompt || "").trim();
    if (!text && !queryOverride) return;
    setIsRunning(true);
    setResultData(null);
    setCopied(false);

    try {
      if (activeTab === "autogpt") {
        setStatusMessage("AutoGPT: Formulating initial thought & plan…");
        const res = await runAutoGPT(text, 3);
        setResultData({ type: "autogpt", data: res });
      } else if (activeTab === "crew_expense") {
        setStatusMessage("CrewAI: Dispatching 3-agent expense auditing crew…");
        const res = await runExpenseCrew(text);
        setResultData({ type: "crew_expense", data: res });
      } else if (activeTab === "crew_incident") {
        setStatusMessage("CrewAI: Dispatching SRE Incident Triage Crew…");
        const res = await runIncidentCrew(text);
        setResultData({ type: "crew_incident", data: res });
      } else {
        setStatusMessage("LangGraph: Querying visual memory with sub-second hybrid RAG…");
        const res = await askShelf(text);
        setResultData({ type: "ask", data: res });
      }
    } catch (err) {
      setResultData({
        type: "error",
        error: "Execution encountered a transient network error. Please try again."
      });
    } finally {
      setIsRunning(false);
      setStatusMessage("");
    }
  }

  function handleCopyReport(text) {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      {/* Floating Vibrant Launcher Pill */}
      <div className="agent-studio-launcher">
        <button
          type="button"
          className={`agent-studio-trigger ${isOpen ? "active" : ""}`}
          onClick={onToggle}
          aria-expanded={isOpen}
          title="Open Tri-Tier Agent Studio (AutoGPT · CrewAI · Ask)"
        >
          <span className="agent-glow-orb" />
          <span className="agent-trigger-icon">⚡</span>
          <span className="agent-trigger-text">
            <strong>Agent Studio</strong>
            <small>AutoGPT · CrewAI · Ask</small>
          </span>
          <span className="agent-tier-badge">Tri-Tier</span>
        </button>
      </div>

      {/* Slide-Up / Floating Studio Window */}
      {isOpen && (
        <aside className="agent-studio-panel" aria-label="Agent Studio">
          {/* Header */}
          <div className="agent-studio-header">
            <div className="agent-header-title">
              <span className="agent-header-icon">✨</span>
              <div>
                <h3>Autonomous Agent Studio</h3>
                <p>Run open-ended goal loops & multi-persona collaborative swarms</p>
              </div>
            </div>
            <button
              type="button"
              className="agent-studio-close"
              onClick={onToggle}
              aria-label="Close Agent Studio"
            >
              ✕
            </button>
          </div>

          {/* Mode Selector Tabs */}
          <div className="agent-mode-tabs">
            <button
              type="button"
              className={`agent-tab-btn ${activeTab === "autogpt" ? "active autogpt" : ""}`}
              onClick={() => { setActiveTab("autogpt"); setResultData(null); }}
            >
              <span className="tab-icon">🧠</span>
              <span className="tab-info">
                <strong>AutoGPT Loop</strong>
                <small>Tier 3 · Self-Criticism</small>
              </span>
            </button>

            <button
              type="button"
              className={`agent-tab-btn ${activeTab === "crew_expense" ? "active crew" : ""}`}
              onClick={() => { setActiveTab("crew_expense"); setResultData(null); }}
            >
              <span className="tab-icon">🧾</span>
              <span className="tab-info">
                <strong>Expense Crew</strong>
                <small>Tier 2 · 3 Specialists</small>
              </span>
            </button>

            <button
              type="button"
              className={`agent-tab-btn ${activeTab === "crew_incident" ? "active sre" : ""}`}
              onClick={() => { setActiveTab("crew_incident"); setResultData(null); }}
            >
              <span className="tab-icon">🚨</span>
              <span className="tab-info">
                <strong>SRE Triage Crew</strong>
                <small>Tier 2 · Incident Post-Mortem</small>
              </span>
            </button>

            <button
              type="button"
              className={`agent-tab-btn ${activeTab === "ask" ? "active ask" : ""}`}
              onClick={() => { setActiveTab("ask"); setResultData(null); }}
            >
              <span className="tab-icon">⚡</span>
              <span className="tab-info">
                <strong>Quick Ask</strong>
                <small>Tier 1 · Sub-Second QA</small>
              </span>
            </button>
          </div>

          {/* Preset Prompts Row */}
          <div className="agent-presets-scroll">
            <span className="presets-label">Quick Scenarios:</span>
            {(PRESETS[activeTab] || []).map((preset) => (
              <button
                key={preset.label}
                type="button"
                className="agent-preset-chip"
                onClick={() => {
                  setPrompt(preset.query);
                  handleExecute(preset.query);
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Prompt Input Form */}
          <form
            className="agent-input-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleExecute();
            }}
          >
            <div className="agent-input-wrapper">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  activeTab === "autogpt"
                    ? "Enter an autonomous goal (e.g. Find all flight boarding passes and check gate numbers)…"
                    : activeTab === "crew_expense"
                    ? "Specify expenses to audit (e.g. Third Wave Coffee receipts and UPI totals)…"
                    : activeTab === "crew_incident"
                    ? "Specify error to triage (e.g. Nginx 504 upstream timeout error log)…"
                    : "Ask any question about your screenshot wall…"
                }
                rows={2}
                disabled={isRunning}
              />
              <div className="agent-form-footer">
                <span className="agent-engine-tag">
                  {activeTab === "autogpt" && "Gemini 2.5 Flash-Lite · ReAct Loop"}
                  {activeTab === "crew_expense" && "CrewAI 1.15 · Sequential Process"}
                  {activeTab === "crew_incident" && "CrewAI 1.15 · Root-Cause Triangulation"}
                  {activeTab === "ask" && "LangGraph · Hybrid pgvector RRF"}
                </span>

                <button
                  type="submit"
                  className={`agent-execute-btn ${isRunning ? "loading" : ""}`}
                  disabled={isRunning || (!prompt.trim() && !isRunning)}
                >
                  {isRunning ? (
                    <>
                      <span className="agent-spinner" />
                      <span>Running Agent…</span>
                    </>
                  ) : (
                    <>
                      <span>Deploy Agent</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Execution Progress Banner */}
          {isRunning && (
            <div className="agent-running-banner">
              <span className="agent-radar" />
              <span>{statusMessage || "Agent reasoning in progress…"}</span>
            </div>
          )}

          {/* Results Display */}
          {resultData && (
            <div className="agent-results-area">
              {/* AUTOGPT RESULTS */}
              {resultData.type === "autogpt" && (
                <div className="autogpt-results">
                  <div className="results-header">
                    <h4>
                      <span>🧠 AutoGPT Autonomous Trace</span>
                      <span className="badge-step-count">{resultData.data.steps_taken} Steps Completed</span>
                    </h4>
                    <button
                      type="button"
                      className="btn-copy-report"
                      onClick={() => handleCopyReport(resultData.data.final_report)}
                    >
                      {copied ? "✓ Copied Dossier" : "Copy Dossier"}
                    </button>
                  </div>

                  {/* Step Trace Stream */}
                  <div className="autogpt-steps-container">
                    {(resultData.data.trace || []).map((step) => (
                      <div key={step.step_number} className="autogpt-step-card">
                        <div className="step-card-header">
                          <span className="step-num-pill">Step {step.step_number}</span>
                          <span className="step-action-tag">
                            <code>{step.action}({JSON.stringify(step.action_input)})</code>
                          </span>
                        </div>

                        <div className="step-grid">
                          <div className="step-row thought">
                            <span className="row-tag">💭 Thought:</span>
                            <p>{step.thought}</p>
                          </div>
                          <div className="step-row reasoning">
                            <span className="row-tag">💡 Reasoning:</span>
                            <p>{step.reasoning}</p>
                          </div>
                          {step.criticism && (
                            <div className="step-row criticism">
                              <span className="row-tag">🔍 Self-Criticism:</span>
                              <p>{step.criticism}</p>
                            </div>
                          )}
                          <div className="step-row observation">
                            <span className="row-tag">👁️ Observation:</span>
                            <p>{step.observation}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Final Report */}
                  <div className="agent-final-report-box">
                    <div className="report-title">📄 Synthesized Intelligence Dossier</div>
                    <div className="report-content">
                      <pre>{resultData.data.final_report}</pre>
                    </div>
                  </div>
                </div>
              )}

              {/* CREWAI EXPENSE AUDITOR RESULTS */}
              {resultData.type === "crew_expense" && (
                <div className="crew-results">
                  <div className="results-header">
                    <h4>
                      <span>🧾 CrewAI Collaborative Expense Pipeline</span>
                      <span className="badge-crew-count">3 Specialist Personas</span>
                    </h4>
                    <button
                      type="button"
                      className="btn-copy-report"
                      onClick={() => handleCopyReport(resultData.data.result)}
                    >
                      {copied ? "✓ Copied Ledger" : "Copy Ledger"}
                    </button>
                  </div>

                  {/* 3 Agents Handoff Chain */}
                  <div className="crew-agents-chain">
                    {(resultData.data.agents || []).map((ag, idx) => (
                      <div key={ag.role} className="crew-agent-card">
                        <div className="agent-card-mast">
                          <div className="agent-avatar">
                            {idx === 0 ? "🕵️" : idx === 1 ? "⚖️" : "💼"}
                          </div>
                          <div>
                            <strong>{ag.role}</strong>
                            <small>{ag.action || "Specialist Task"}</small>
                          </div>
                          <span className="agent-status-badge">Completed ✓</span>
                        </div>
                        <p className="agent-output-text">{ag.output}</p>
                      </div>
                    ))}
                  </div>

                  {/* Final Synthesis */}
                  <div className="agent-final-report-box">
                    <div className="report-title">📊 Executive Reimbursement Ledger</div>
                    <div className="report-content">
                      <pre>{resultData.data.result}</pre>
                    </div>
                  </div>
                </div>
              )}

              {/* CREWAI SRE INCIDENT TRIAGE RESULTS */}
              {resultData.type === "crew_incident" && (
                <div className="crew-results">
                  <div className="results-header">
                    <h4>
                      <span>🚨 CrewAI SRE Incident Triage Pipeline</span>
                      <span className="badge-crew-count">3 SRE Personas</span>
                    </h4>
                    <button
                      type="button"
                      className="btn-copy-report"
                      onClick={() => handleCopyReport(resultData.data.result)}
                    >
                      {copied ? "✓ Copied Post-Mortem" : "Copy Post-Mortem"}
                    </button>
                  </div>

                  <div className="crew-agents-chain">
                    {(resultData.data.agents || []).map((ag, idx) => (
                      <div key={ag.role} className="crew-agent-card sre">
                        <div className="agent-card-mast">
                          <div className="agent-avatar">
                            {idx === 0 ? "📡" : idx === 1 ? "🩺" : "🛡️"}
                          </div>
                          <div>
                            <strong>{ag.role}</strong>
                            <small>{ag.action || "Triage Task"}</small>
                          </div>
                          <span className="agent-status-badge sre">Diagnosed ✓</span>
                        </div>
                        <p className="agent-output-text">{ag.output}</p>
                      </div>
                    ))}
                  </div>

                  <div className="agent-final-report-box">
                    <div className="report-title">🛠️ Remediation & Post-Mortem Guide</div>
                    <div className="report-content">
                      <pre>{resultData.data.result}</pre>
                    </div>
                  </div>
                </div>
              )}

              {/* QUICK ASK RESULTS */}
              {resultData.type === "ask" && (
                <div className="ask-results">
                  <div className="ask-answer-box">
                    <p className={resultData.data.refused ? "answer refused" : "answer"}>
                      {resultData.data.answer}
                    </p>
                    {resultData.data.citations?.length > 0 && (
                      <div className="ask-citations">
                        <span className="citations-label">Grounded Sources:</span>
                        <div className="cites">
                          {resultData.data.citations.map((cite) => (
                            <figure key={cite.id} className="cite">
                              <img src={thumbUrl(cite.id)} alt={cite.filename} loading="lazy" />
                              <figcaption>{cite.filename}</figcaption>
                            </figure>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ERROR STATE */}
              {resultData.type === "error" && (
                <div className="agent-error-box">
                  <p>{resultData.error}</p>
                </div>
              )}
            </div>
          )}
        </aside>
      )}
    </>
  );
}
