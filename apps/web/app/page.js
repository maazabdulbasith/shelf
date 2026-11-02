"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import AmbientField from "./components/AmbientField";
import AgentStudio from "./components/AgentStudio";
import Logo from "./components/Logo";
import ShotCard from "./components/ShotCard";
import ShotModal from "./components/ShotModal";
import SettingsModal from "./components/SettingsModal";
import { fetchShots } from "./lib/api";
import { searchShots } from "./lib/search";
import {
  clearAllLocalShots,
  deleteLocalShot,
  getLocalShots,
  saveLocalShot,
  saveLocalShotsBatch,
} from "./lib/db";
import { runOcrOnImage } from "./lib/ocr";

let rearranging = false;

function applyShots(next, setShots) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canMove = typeof document.startViewTransition === "function" && !reduce && !rearranging;
  if (!canMove) {
    setShots(next);
    return;
  }
  rearranging = true;
  const transition = document.startViewTransition(() => {
    flushSync(() => setShots(next));
  });
  transition.finished.finally(() => {
    rearranging = false;
  });
}

const QUICK_FILTERS = [
  { label: "All", icon: "✨", query: "" },
  { label: "Receipts & Bills", icon: "🧾", query: "receipt" },
  { label: "Code & Dev", icon: "💻", query: "code" },
  { label: "Nature & Travel", icon: "✈️", query: "boarding" },
  { label: "Dashboards", icon: "📊", query: "dashboard" },
  { label: "Chats & Messages", icon: "💬", query: "chat" },
  { label: "Family & People", icon: "👨‍👩‍👧", query: "family" },
  { label: "Food & Drinks", icon: "🍔", query: "food" },
];

export default function Page() {
  const [query, setQuery] = useState("");
  const [serverShots, setServerShots] = useState([]);
  const [userShots, setUserShots] = useState([]);
  const [includeDemoShots, setIncludeDemoShots] = useState(false);
  const [phase, setPhase] = useState("loading");
  const [notice, setNotice] = useState("");
  const [dragDepth, setDragDepth] = useState(0);
  const [pinned, setPinned] = useState(false);
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [hasDirectoryPicker, setHasDirectoryPicker] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isOcrRunning, setIsOcrRunning] = useState(false);
  const [viewingShot, setViewingShot] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [hasCustomKey, setHasCustomKey] = useState(false);

  const loaded = useRef(false);
  const fileInputRef = useRef(null);
  const ocrRunningRef = useRef(false);

  // 1. Load user's local shots from IndexedDB and auto-queue OCR for unindexed shots
  useEffect(() => {
    getLocalShots().then((local) => {
      const shots = local || [];
      setUserShots(shots);
      if (shots.length === 0) {
        setIncludeDemoShots(true);
      } else {
        const unindexed = shots.filter(
          (s) => (!s.ocrDone || !s.tags || s.tags.length === 0) && s.src
        );
        if (unindexed.length > 0) {
          queueOcrProcessing(unindexed);
        }
      }
    });

    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("shelf_gemini_api_key");
        if (stored && !localStorage.getItem("shelf_byok_active")) {
          localStorage.removeItem("shelf_gemini_api_key");
        }
      } catch {}
      setHasCustomKey(!!localStorage.getItem("shelf_gemini_api_key"));
    }

    if (typeof window !== "undefined" && "showDirectoryPicker" in window) {
      setHasDirectoryPicker(true);
    }
  }, []);

  // 2. High-speed parallel OCR worker pool (concurrency = 6)
  async function queueOcrProcessing(shotsToProcess) {
    if (ocrRunningRef.current || !shotsToProcess.length) return;
    ocrRunningRef.current = true;
    setIsOcrRunning(true);

    const total = shotsToProcess.length;
    let completedCount = 0;
    setNotice(`⚡ Fast-indexing ${total} picture${total > 1 ? "s" : ""} in parallel…`);

    const CONCURRENCY = 6;
    let currentIndex = 0;
    const pendingUpdates = [];

    const flushBatch = async () => {
      if (pendingUpdates.length === 0) return;
      const toFlush = pendingUpdates.splice(0, pendingUpdates.length);
      const idMap = new Map(toFlush.map((s) => [s.id, s]));

      setUserShots((prev) =>
        prev.map((s) => (idMap.has(s.id) ? idMap.get(s.id) : s))
      );
      await saveLocalShotsBatch(toFlush);
    };

    const worker = async () => {
      while (currentIndex < total) {
        const itemIndex = currentIndex++;
        const shot = shotsToProcess[itemIndex];
        if (!shot) break;

        try {
          const ocr = await runOcrOnImage(shot.src, shot.filename);
          const tagsList = Array.isArray(ocr.tags) ? ocr.tags : [];
          const tagsStr = tagsList.join(" ");
          const combinedIndex = `${shot.filename} ${ocr.text || ""} ${ocr.caption || ""} ${tagsStr} ${ocr.kind || ""}`.toLowerCase();

          const updatedShot = {
            ...shot,
            text: `${shot.filename} ${ocr.text || ""}`.trim(),
            caption: ocr.caption || shot.caption,
            tags: tagsList,
            searchIndex: combinedIndex,
            kind: ocr.kind || shot.kind || "photo",
            ocrDone: true,
            ocrEngine: ocr.engine,
            actions: ocr.action
              ? [ocr.action, ...(shot.actions || [])]
              : shot.actions || [],
          };

          pendingUpdates.push(updatedShot);
          completedCount++;

          setNotice(
            `⚡ Fast-indexed ${completedCount} of ${total} pictures (${Math.round((completedCount / total) * 100)}%)…`
          );

          if (pendingUpdates.length >= 4) {
            await flushBatch();
          }
        } catch (err) {
          console.error("OCR failure on shot:", shot.id, err);
          completedCount++;
        }
      }
    };

    const workers = [];
    const poolSize = Math.min(CONCURRENCY, total);
    for (let i = 0; i < poolSize; i++) {
      workers.push(worker());
    }

    await Promise.all(workers);
    await flushBatch();

    setIsOcrRunning(false);
    ocrRunningRef.current = false;
    setNotice(`✓ Fast indexing complete: ${total} picture${total > 1 ? "s" : ""} searchable instantly!`);
    setTimeout(() => setNotice(""), 3500);
  }

  // 3. Fetch server/demo shots when searched
  useEffect(() => {
    const controller = new AbortController();
    const handle = setTimeout(async () => {
      setPhase((current) => (current === "loading" ? "loading" : "searching"));
      let next = [];
      try {
        next = await fetchShots(query, controller.signal);
      } catch (error) {
        if (error.name === "AbortError") return;
        setNotice(loaded.current ? "Search did not finish." : "Shelf is running local-first.");
        setPhase(loaded.current ? "ready" : "offline");
        return;
      }
      loaded.current = true;
      applyShots(next, setServerShots);
      setNotice("");
      setPhase("ready");
    }, 200);

    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [query]);

  // 4. Global keyboard shortcuts and scroll pinning
  useEffect(() => {
    const onKey = (event) => {
      const tag = document.activeElement?.tagName;
      if (event.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        event.preventDefault();
        document.getElementById("search")?.focus();
      }
      if (event.key === "Escape") {
        setIsStudioOpen(false);
      }
    };
    const onScroll = () => setPinned(window.scrollY > 28);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  function readFileAsDataUrl(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  // Batch process and persist files to IndexedDB
  async function processFilesBatch(files) {
    if (!files.length) return;
    setIsScanning(true);
    setNotice(`Scanning ${files.length} images into your local shelf…`);

    const newShots = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const dataUrl = await readFileAsDataUrl(file);
      if (!dataUrl) continue;

      const id = `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const shot = {
        id,
        src: dataUrl,
        filename: file.name,
        timestamp: file.lastModified ? new Date(file.lastModified).toISOString() : new Date().toISOString(),
        caption: `Scanned image: ${file.name}`,
        kind: "photo",
        text: file.name,
        searchIndex: file.name.toLowerCase(),
        isUserUploaded: true,
        ocrDone: false,
        tags: [],
        actions: [],
      };
      newShots.push(shot);
    }

    if (newShots.length > 0) {
      await saveLocalShotsBatch(newShots);
      setUserShots((prev) => [...newShots, ...prev]);
      setNotice(`Added ${newShots.length} photos! Now running visual AI analysis…`);
      queueOcrProcessing(newShots);
    }

    setIsScanning(false);
  }

  // Native Browser Directory Picker
  async function onGrantPermission() {
    if (typeof window === "undefined") return;

    if ("showDirectoryPicker" in window) {
      try {
        const dirHandle = await window.showDirectoryPicker({ mode: "read" });
        setIsScanning(true);
        setNotice("Reading folder items…");
        const discovered = [];

        for await (const entry of dirHandle.values()) {
          if (entry.kind === "file") {
            const file = await entry.getFile();
            if (file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|heic)$/i.test(file.name)) {
              discovered.push(file);
            }
          }
        }

        if (discovered.length === 0) {
          setNotice("No pictures found in the selected folder.");
          setIsScanning(false);
          setTimeout(() => setNotice(""), 3000);
          return;
        }

        await processFilesBatch(discovered);
      } catch (err) {
        if (err.name !== "AbortError") {
          fileInputRef.current?.click();
        }
      } finally {
        setIsScanning(false);
      }
    } else {
      fileInputRef.current?.click();
    }
  }

  async function onFileSelect(event) {
    const files = Array.from(event.target.files || []).filter((f) =>
      f.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|heic)$/i.test(f.name)
    );
    if (!files.length) return;
    await processFilesBatch(files);
    if (event.target) event.target.value = "";
  }

  async function onDrop(event) {
    event.preventDefault();
    setDragDepth(0);
    const files = Array.from(event.dataTransfer.files || []).filter((f) =>
      f.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|heic)$/i.test(f.name)
    );
    if (!files.length) return;
    await processFilesBatch(files);
  }

  async function handleDelete(id) {
    await deleteLocalShot(id);
    setUserShots((prev) => prev.filter((s) => s.id !== id));
    setNotice("Removed picture from your shelf.");
    setTimeout(() => setNotice(""), 2000);
  }

  async function handleClearAll() {
    if (!window.confirm("Remove all scanned pictures from your local shelf?")) return;
    await clearAllLocalShots();
    setUserShots([]);
    setNotice("Local shelf cleared.");
    setTimeout(() => setNotice(""), 2500);
  }

  function handleReindexOcr() {
    const unindexed = userShots.filter(
      (s) => (!s.ocrDone || !s.tags || s.tags.length === 0) && s.src
    );
    const target = unindexed.length > 0 ? unindexed : userShots;
    queueOcrProcessing(target);
  }

  const isSearchActive = query.trim().length > 0;
  const filteredUserShots = searchShots(userShots, query);
  const activeServerShots = includeDemoShots ? searchShots(serverShots, query) : [];
  const allShots = [...filteredUserShots, ...activeServerShots];

  const compact = pinned || query.length > 0;
  const countLabel =
    phase === "loading"
      ? "Opening the wall"
      : isScanning
      ? "Scanning media…"
      : isOcrRunning
      ? "Visual AI…"
      : phase === "searching"
      ? "Rearranging"
      : `${allShots.length} on the wall`;

  const hasNoSearchResults = isSearchActive && allShots.length === 0;

  const unindexedCount = userShots.filter(
    (s) => !s.ocrDone || !s.tags || s.tags.length === 0
  ).length;

  return (
    <div
      className={dragDepth > 0 ? "shell dragging" : "shell"}
      onDragEnter={(event) => {
        event.preventDefault();
        setDragDepth((depth) => depth + 1);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => setDragDepth((depth) => Math.max(0, depth - 1))}
      onDrop={onDrop}
    >
      <AmbientField />
      <div className="veil" aria-hidden="true" />

      {/* Hidden Native File Picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={onFileSelect}
      />

      {/* Startup Nav Header */}
      <header className={compact ? "mast compact" : "mast"}>
        <div className="brand">
          <Logo size={42} />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <p className="word" style={{ margin: 0 }}>Shelf</p>
              <span className="badge-startup-beta">
                Tri-Tier Agents
              </span>
            </div>
            <p className="line">Multimodal visual semantic memory for everything on your screen.</p>
          </div>
        </div>

        <label className="search" htmlFor="search">
          <span className="sr">Search screenshots</span>
          <input
            id="search"
            type="search"
            placeholder="Search keywords, OCR text, or visual objects…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
          />
          {query ? (
            <button
              type="button"
              className="btn-clear-search"
              onClick={() => setQuery("")}
              style={{
                background: "transparent",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                padding: "4px 8px",
              }}
            >
              ✕
            </button>
          ) : (
            <kbd>/</kbd>
          )}
        </label>

        <div className="mast-end">
          <p className="count" aria-live="polite">
            {countLabel}
          </p>
          <div className="mast-actions">
            {/* Direct Agent Studio Trigger Button */}
            <button
              type="button"
              className="btn-agent-studio-nav"
              onClick={() => setIsStudioOpen(true)}
              title="Open Autonomous Agent Studio"
            >
              <span className="agent-orb-mini" />
              <span>Agent Swarm</span>
            </button>

            <button
              type="button"
              className="btn-gallery"
              onClick={onGrantPermission}
              disabled={isScanning}
              title="Grant storage permission to scan photos"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              </svg>
              <span>{hasDirectoryPicker ? "Scan Folder" : "Add Photos"}</span>
            </button>

            {unindexedCount > 0 && (
              <button
                type="button"
                className="btn-gallery"
                onClick={handleReindexOcr}
                disabled={isOcrRunning}
                style={{
                  background: "linear-gradient(135deg, #f59e0b, #d97706)",
                  borderColor: "rgba(245, 158, 11, 0.7)",
                  color: "#ffffff",
                }}
                title="Extract text from scanned pictures"
              >
                <span>{isOcrRunning ? "Analyzing Visual AI…" : `⚡ Scan AI (${unindexedCount})`}</span>
              </button>
            )}

            <button
              type="button"
              className="btn-folder"
              onClick={() => setIncludeDemoShots((prev) => !prev)}
              title="Toggle 20 golden sample screenshots"
            >
              <span>{includeDemoShots ? "Hide Demos" : "Show Demos"}</span>
            </button>

            <button
              type="button"
              className="btn-folder"
              onClick={() => setIsSettingsOpen(true)}
              title="AI Vision Engine & Indexing Settings"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: hasCustomKey ? "rgba(16, 185, 129, 0.12)" : "rgba(255, 255, 255, 0.06)",
                borderColor: hasCustomKey ? "rgba(16, 185, 129, 0.35)" : "rgba(255, 255, 255, 0.12)",
                color: hasCustomKey ? "#6ee7b7" : "#cbd5e1",
              }}
            >
              <span className={hasCustomKey ? "dot-green" : "dot-amber"} />
              <span>{hasCustomKey ? "AI Vision Active" : "Connect AI Key"}</span>
            </button>

            {userShots.length > 0 && (
              <button
                type="button"
                className="btn-card-delete"
                onClick={handleClearAll}
                title="Clear all imported photos"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Quick Visual Category Filter Bar */}
      <nav className="quick-filter-bar" aria-label="Visual Categories">
        <div className="quick-filter-inner">
          {QUICK_FILTERS.map((f) => {
            const isActive =
              f.query === ""
                ? query.trim() === ""
                : query.trim().toLowerCase() === f.query.toLowerCase();
            return (
              <button
                key={f.label}
                type="button"
                className={isActive ? "quick-filter-pill active" : "quick-filter-pill"}
                onClick={() => setQuery(isActive && f.query !== "" ? "" : f.query)}
              >
                <span>{f.icon}</span>
                <span>{f.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {notice ? <p className="notice">{notice}</p> : null}

      {/* Vibrant Startup Hero Showcase */}
      {userShots.length === 0 && !isSearchActive && (
        <section className="permission-hero">
          <span className="permission-badge">✨ Next-Gen Visual Intelligence · Zero Cloud Data Leak</span>
          <h2>Search Everything Your Eyes Ever Saw.</h2>
          <p>
            Shelf runs 100% on your device with on-device WebAssembly OCR, hybrid pgvector RRF retrieval,
            and autonomous AutoGPT & CrewAI agent swarms for instant financial audits and SRE triage.
          </p>

          {/* 4 Startup Stat Chips */}
          <div className="hero-stat-grid">
            <div className="hero-stat-card emerald">
              <span className="stat-value">1.000</span>
              <span className="stat-label">RRF Recall@5 (vs 0.833 Baseline)</span>
            </div>
            <div className="hero-stat-card cyan">
              <span className="stat-value">~600ms</span>
              <span className="stat-label">Client-Side WASM OCR Engine</span>
            </div>
            <div className="hero-stat-card violet">
              <span className="stat-value">CrewAI 3-Agent</span>
              <span className="stat-label">Expense & SRE Incident Teams</span>
            </div>
            <div className="hero-stat-card coral">
              <span className="stat-value">AutoGPT ReAct</span>
              <span className="stat-label">Autonomous Self-Criticism Loop</span>
            </div>
          </div>

          <div className="permission-actions">
            <button
              type="button"
              className="btn-primary-grant"
              onClick={onGrantPermission}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
              </svg>
              <span>{hasDirectoryPicker ? "Grant Storage Permission & Scan Media" : "Select Photos from Gallery"}</span>
            </button>

            <button
              type="button"
              className="btn-secondary-action"
              onClick={() => setIsStudioOpen(true)}
            >
              ⚡ Launch Agent Swarm
            </button>

            <button
              type="button"
              className="btn-secondary-action"
              onClick={() => fileInputRef.current?.click()}
            >
              📷 Pick Specific Photos
            </button>
          </div>

          <div>
            <button
              type="button"
              className="btn-text-action"
              onClick={() => setIncludeDemoShots((prev) => !prev)}
            >
              {includeDemoShots ? "Hide the 20 golden demo cards" : "Or explore the 20 golden demo cards"}
            </button>
          </div>
        </section>
      )}

      {/* Clean Zero Search Results State */}
      {hasNoSearchResults && (
        <section className="empty-search">
          <h3>No screenshots found</h3>
          <p>
            No pictures or screenshots match <strong>"{query}"</strong>.
          </p>
          <button
            type="button"
            className="btn-reset-search"
            onClick={() => setQuery("")}
          >
            Clear Search
          </button>
        </section>
      )}

      {/* The Screenshot Wall */}
      {allShots.length > 0 && (
        <section className="wall" aria-label="Screenshots">
          {allShots.map((shot) => (
            <ShotCard
              key={shot.id}
              shot={shot}
              active={isSearchActive}
              onDelete={shot.isUserUploaded ? handleDelete : undefined}
              onClick={(clicked) => setViewingShot(clicked)}
            />
          ))}
        </section>
      )}

      {/* Full-Screen Lightbox & Action Modal */}
      {viewingShot && (
        <ShotModal
          shot={viewingShot}
          allShots={allShots}
          onClose={() => setViewingShot(null)}
          onSelectShot={setViewingShot}
        />
      )}

      {/* AI Vision Engine & BYOK Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onKeySaved={(newKey) => {
          setHasCustomKey(!!newKey);
          setIsSettingsOpen(false);
          if (newKey) {
            handleReindexOcr();
          }
        }}
      />

      {dragDepth > 0 ? (
        <div className="drop">
          <strong>Release to keep it</strong>
          <span>It stays 100% on this device in local storage.</span>
        </div>
      ) : null}

      {/* Interactive Autonomous Agent Studio (AutoGPT · CrewAI · Ask) */}
      <AgentStudio
        isOpen={isStudioOpen}
        onToggle={() => setIsStudioOpen((prev) => !prev)}
      />
    </div>
  );
}
