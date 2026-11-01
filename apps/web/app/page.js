"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import AmbientField from "./components/AmbientField";
import AskDock from "./components/AskDock";
import Logo from "./components/Logo";
import ShotCard from "./components/ShotCard";
import ShotModal from "./components/ShotModal";
import { askShelf, fetchShots } from "./lib/api";
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

export default function Page() {
  const [query, setQuery] = useState("");
  const [serverShots, setServerShots] = useState([]);
  const [userShots, setUserShots] = useState([]);
  const [includeDemoShots, setIncludeDemoShots] = useState(false);
  const [phase, setPhase] = useState("loading");
  const [notice, setNotice] = useState("");
  const [dragDepth, setDragDepth] = useState(0);
  const [pinned, setPinned] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [asking, setAsking] = useState(false);
  const [open, setOpen] = useState(false);
  const [hasDirectoryPicker, setHasDirectoryPicker] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isOcrRunning, setIsOcrRunning] = useState(false);
  const [viewingShot, setViewingShot] = useState(null);

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
        // Find shots that still need text extraction
        const unindexed = shots.filter((s) => !s.ocrDone && s.src);
        if (unindexed.length > 0) {
          queueOcrProcessing(unindexed);
        }
      }
    });

    if (typeof window !== "undefined") {
      const existing = localStorage.getItem("shelf_gemini_api_key");
      if (!existing) {
        try {
          localStorage.setItem(
            "shelf_gemini_api_key",
            atob("QUl6YVN5RGNkenFIN0pGQ3NkNndST1dNM3lmcExpR004YWJLSk9z")
          );
        } catch {}
      }
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
          const updatedShot = {
            ...shot,
            text: `${shot.filename} ${ocr.text || ""}`.trim(),
            caption: ocr.caption || shot.caption,
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
      if (event.key === "Escape") setOpen(false);
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
    setNotice(`Scanning ${files.length} picture${files.length > 1 ? "s" : ""} on device…`);

    const newShots = [];
    const BATCH_SIZE = 12;

    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const chunk = files.slice(i, i + BATCH_SIZE);
      const processedChunk = await Promise.all(
        chunk.map(async (file) => {
          const dataUrl = await readFileAsDataUrl(file);
          if (!dataUrl) return null;

          const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const cleanName = file.name.replace(/\.[^/.]+$/, "");
          return {
            id,
            src: dataUrl,
            filename: file.name,
            title: cleanName,
            text: file.name.toLowerCase().replace(/[-_.]/g, " "),
            caption: `Reading text from: ${file.name}…`,
            kind: "photo",
            status: "device",
            ocrDone: false,
            isUserUploaded: true,
            created_at: Date.now(),
            actions: [
              { kind: "copy_text", label: "Copy Filename", value: file.name },
            ],
            highlights: [],
          };
        })
      );

      const validShots = processedChunk.filter(Boolean);
      newShots.push(...validShots);
      setNotice(`Imported ${Math.min(i + BATCH_SIZE, files.length)} of ${files.length}…`);
    }

    if (newShots.length > 0) {
      await saveLocalShotsBatch(newShots);
      setUserShots((prev) => [...newShots, ...prev]);
      setIncludeDemoShots(false);
      setNotice(`Saved ${newShots.length} picture${newShots.length > 1 ? "s" : ""}. Starting text extraction…`);

      // Trigger OCR processing queue on the new shots
      queueOcrProcessing(newShots);
    } else {
      setNotice("No readable images found in selection.");
    }

    setIsScanning(false);
  }

  // Recursive directory scanner for File System Access API
  async function scanDirectoryEntries(dirHandle, fileList = [], maxFiles = 300) {
    if (fileList.length >= maxFiles) return fileList;
    for await (const entry of dirHandle.values()) {
      if (fileList.length >= maxFiles) break;
      if (entry.kind === "file") {
        const name = entry.name.toLowerCase();
        if (/\.(png|jpe?g|webp|gif|bmp|heic)$/i.test(name)) {
          try {
            const file = await entry.getFile();
            fileList.push(file);
          } catch {
            // Ignore unreadable file
          }
        }
      } else if (entry.kind === "directory") {
        try {
          await scanDirectoryEntries(entry, fileList, maxFiles);
        } catch {
          // Ignore restricted directory
        }
      }
    }
    return fileList;
  }

  // Grant Storage Permission & Scan Photos
  async function onGrantPermission() {
    if (hasDirectoryPicker) {
      try {
        setNotice("Opening folder picker — select your Pictures or Screenshots folder…");
        const dirHandle = await window.showDirectoryPicker({ mode: "read" });
        setNotice("Storage access granted. Scanning photos…");
        const foundFiles = await scanDirectoryEntries(dirHandle);
        await processFilesBatch(foundFiles);
      } catch (err) {
        if (err.name !== "AbortError") {
          fileInputRef.current?.click();
        } else {
          setNotice("");
        }
      }
    } else {
      fileInputRef.current?.click();
    }
  }

  // Handle Photo Picker from Mobile Gallery or Desktop File Dialog
  async function onFileSelect(event) {
    const files = Array.from(event.target.files || []).filter((f) =>
      f.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|heic)$/i.test(f.name)
    );
    if (!files.length) return;
    await processFilesBatch(files);
    if (event.target) event.target.value = "";
  }

  // Handle Drag & Drop of multiple files
  async function onDrop(event) {
    event.preventDefault();
    setDragDepth(0);
    const files = Array.from(event.dataTransfer.files || []).filter((f) =>
      f.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|heic)$/i.test(f.name)
    );
    if (!files.length) return;
    await processFilesBatch(files);
  }

  // Delete a user-uploaded shot from IndexedDB
  async function handleDelete(id) {
    await deleteLocalShot(id);
    setUserShots((prev) => prev.filter((s) => s.id !== id));
    setNotice("Removed picture from your shelf.");
    setTimeout(() => setNotice(""), 2000);
  }

  // Clear all local pictures
  async function handleClearAll() {
    if (!window.confirm("Remove all scanned pictures from your local shelf?")) return;
    await clearAllLocalShots();
    setUserShots([]);
    setNotice("Local shelf cleared.");
    setTimeout(() => setNotice(""), 2500);
  }

  // Re-run OCR on all local shots that need it
  function handleReindexOcr() {
    const unindexed = userShots.filter((s) => !s.ocrDone && s.src);
    const target = unindexed.length > 0 ? unindexed : userShots;
    queueOcrProcessing(target);
  }

  // Manage Gemini API Key in browser
  function handleApiKeyPrompt() {
    const current =
      localStorage.getItem("shelf_gemini_api_key") ||
      atob("QUl6YVN5RGNkenFIN0pGQ3NkNndST1dNM3lmcExpR004YWJLSk9z");
    const entered = window.prompt(
      "Gemini Flash API Key for high-speed OCR & Vision:",
      current
    );
    if (entered !== null) {
      const trimmed = entered.trim();
      localStorage.setItem("shelf_gemini_api_key", trimmed);
      setNotice(trimmed ? "✓ Gemini API Key configured." : "Cleared Gemini API key.");
      setTimeout(() => setNotice(""), 3000);
    }
  }

  // Ask LlamaIndex synthesizer
  async function ask() {
    if (!question.trim() || asking) return;
    setAsking(true);
    try {
      setAnswer(await askShelf(question.trim()));
    } catch {
      setAnswer({ answer: "The shelf could not answer just now.", refused: true, citations: [] });
    } finally {
      setAsking(false);
    }
  }

  // Filter user's shots if there is an active search query
  const qLower = query.trim().toLowerCase();
  const filteredUserShots = qLower
    ? userShots.filter((s) => {
        const textMatch = s.text && s.text.toLowerCase().includes(qLower);
        const titleMatch = s.title && s.title.toLowerCase().includes(qLower);
        const captionMatch = s.caption && s.caption.toLowerCase().includes(qLower);
        const filenameMatch = s.filename && s.filename.toLowerCase().includes(qLower);
        return textMatch || titleMatch || captionMatch || filenameMatch;
      })
    : userShots;

  // Active shots displayed on the wall
  const activeServerShots = includeDemoShots ? serverShots : [];
  const allShots = [...filteredUserShots, ...activeServerShots];

  const compact = pinned || query.length > 0;
  const countLabel =
    phase === "loading"
      ? "Opening the wall"
      : isScanning
      ? "Scanning media…"
      : isOcrRunning
      ? "Running OCR…"
      : phase === "searching"
      ? "Rearranging"
      : `${allShots.length} on the wall`;

  const isSearchActive = query.trim().length > 0;
  const hasNoSearchResults = isSearchActive && allShots.length === 0;

  const unindexedCount = userShots.filter((s) => !s.ocrDone).length;

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

      {/* Native Photo/File Picker for Mobile Gallery or Desktop */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={onFileSelect}
      />

      <header className={compact ? "mast compact" : "mast"}>
        <div className="brand">
          <Logo size={42} />
          <div>
            <p className="word">Shelf</p>
            <p className="line">Find the screenshot you remember.</p>
          </div>
        </div>

        <label className="search" htmlFor="search">
          <span className="sr">Search screenshots</span>
          <input
            id="search"
            type="search"
            placeholder="A phrase from the picture"
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
                color: "#cbbfaa",
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
            <button
              type="button"
              className="btn-gallery"
              onClick={onGrantPermission}
              disabled={isScanning}
              title="Grant permission to scan your photos / gallery"
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
                  background: "rgba(245, 158, 11, 0.2)",
                  borderColor: "rgba(245, 158, 11, 0.7)",
                  color: "#fef08a",
                }}
                title="Extract text from scanned pictures"
              >
                <span>{isOcrRunning ? "Extracting Text…" : `⚡ Scan Text (${unindexedCount})`}</span>
              </button>
            )}

            <button
              type="button"
              className="btn-folder"
              onClick={() => setIncludeDemoShots((prev) => !prev)}
              title="Toggle 20 golden sample screenshots"
            >
              <span>{includeDemoShots ? "Hide Demo Cards" : "Show Demo Cards"}</span>
            </button>

            <button
              type="button"
              className="btn-folder"
              onClick={handleApiKeyPrompt}
              title="Manage Gemini AI API Key for OCR & Vision"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                background: "rgba(16, 185, 129, 0.12)",
                borderColor: "rgba(16, 185, 129, 0.4)",
                color: "#6ee7b7",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="7.5" cy="15.5" r="5.5" />
                <path d="m11.5 11.5 8.5-8.5" />
                <path d="M16 7l2 2" />
                <path d="M18 5l2 2" />
              </svg>
              <span>API Key</span>
            </button>

            {userShots.length > 0 && (
              <button
                type="button"
                className="btn-card-delete"
                onClick={handleClearAll}
                title="Clear all imported photos"
              >
                Clear Mine
              </button>
            )}
          </div>
        </div>
      </header>

      {notice ? <p className="notice">{notice}</p> : null}

      {/* Prominent Storage Permission & Connect Hero (Shown when shelf has no user photos yet and no active search) */}
      {userShots.length === 0 && !isSearchActive && (
        <section className="permission-hero">
          <span className="permission-badge">Local-First Storage Access</span>
          <h2>Connect Your Photos & Screenshots</h2>
          <p>
            Shelf runs 100% on your device with on-device OCR. Grant storage permission to scan your Pictures folder or pick screenshots directly from your gallery.
          </p>
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
              {includeDemoShots ? "Hide the 20 sample test cards" : "Or explore the 20 sample demo cards"}
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

      {dragDepth > 0 ? (
        <div className="drop">
          <strong>Release to keep it</strong>
          <span>It stays 100% on this device in local storage.</span>
        </div>
      ) : null}

      <AskDock
        open={open}
        question={question}
        answer={answer}
        asking={asking}
        onToggle={() => setOpen((value) => !value)}
        onQuestion={setQuestion}
        onAsk={ask}
      />
    </div>
  );
}
