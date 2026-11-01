"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import AmbientField from "./components/AmbientField";
import AskDock from "./components/AskDock";
import Logo from "./components/Logo";
import ShotCard from "./components/ShotCard";
import { askShelf, fetchShots } from "./lib/api";
import { deleteLocalShot, getLocalShots, saveLocalShot } from "./lib/db";

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
  const [phase, setPhase] = useState("loading");
  const [notice, setNotice] = useState("");
  const [dragDepth, setDragDepth] = useState(0);
  const [pinned, setPinned] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [asking, setAsking] = useState(false);
  const [open, setOpen] = useState(false);
  const [hasDirectoryPicker, setHasDirectoryPicker] = useState(false);

  const loaded = useRef(false);
  const fileInputRef = useRef(null);

  // 1. Load user's local shots from IndexedDB on mount
  useEffect(() => {
    getLocalShots().then((local) => {
      setUserShots(local || []);
    });
    if (typeof window !== "undefined" && "showDirectoryPicker" in window) {
      setHasDirectoryPicker(true);
    }
  }, []);

  // 2. Fetch server / golden shots with search query
  useEffect(() => {
    const controller = new AbortController();
    const handle = setTimeout(async () => {
      setPhase((current) => (current === "loading" ? "loading" : "searching"));
      let next;
      try {
        next = await fetchShots(query, controller.signal);
      } catch (error) {
        if (error.name === "AbortError") return;
        setNotice(loaded.current ? "Search did not finish. The wall stayed put." : "The shelf is not answering.");
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

  // 3. Global keyboard shortcuts and scroll pinning
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

  // Process & persist a single file to IndexedDB
  async function processAndSaveFile(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result;
        const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const cleanName = file.name.replace(/\.[^/.]+$/, "");
        const shot = {
          id,
          src: dataUrl,
          filename: file.name,
          title: cleanName,
          text: file.name.toLowerCase().replace(/[-_.]/g, " "),
          caption: `Device screenshot: ${file.name}`,
          kind: "photo",
          status: "local",
          isUserUploaded: true,
          created_at: Date.now(),
          actions: [
            { kind: "copy_text", label: "Copy Filename", value: file.name },
          ],
          highlights: [],
        };
        await saveLocalShot(shot);
        setUserShots((prev) => [shot, ...prev.filter((s) => s.id !== id)]);
        resolve(shot);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  // Handle Photo Picker from Mobile Gallery or Desktop File Browser
  async function onFileSelect(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setNotice(`Importing ${files.length} screenshot${files.length > 1 ? "s" : ""} from your gallery…`);
    for (const file of files) {
      if (file.type.startsWith("image/")) {
        await processAndSaveFile(file);
      }
    }
    setNotice(`Added ${files.length} screenshot${files.length > 1 ? "s" : ""} to your local shelf.`);
    setTimeout(() => setNotice(""), 3000);
    if (event.target) event.target.value = "";
  }

  // Handle Directory Picker on Desktop (Chrome / Edge)
  async function onPickDirectory() {
    if (!window.showDirectoryPicker) return;
    try {
      const dirHandle = await window.showDirectoryPicker();
      let importedCount = 0;
      setNotice("Scanning local screenshots folder…");
      for await (const entry of dirHandle.values()) {
        if (entry.kind === "file") {
          const name = entry.name.toLowerCase();
          if (name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".webp")) {
            const file = await entry.getFile();
            await processAndSaveFile(file);
            importedCount++;
          }
        }
      }
      setNotice(`Synced ${importedCount} screenshot${importedCount === 1 ? "" : "s"} from folder.`);
      setTimeout(() => setNotice(""), 3500);
    } catch (err) {
      if (err.name !== "AbortError") {
        setNotice("Folder access was not granted.");
      }
    }
  }

  // Handle Drag & Drop of multiple files
  async function onDrop(event) {
    event.preventDefault();
    setDragDepth(0);
    const files = Array.from(event.dataTransfer.files || []);
    if (!files.length) return;
    setNotice(`Keeping ${files.length} screenshot${files.length > 1 ? "s" : ""} on device…`);
    for (const f of files) {
      if (f.type.startsWith("image/")) {
        await processAndSaveFile(f);
      }
    }
    setNotice(`Saved ${files.length} screenshot${files.length > 1 ? "s" : ""} to local shelf.`);
    setTimeout(() => setNotice(""), 2500);
  }

  // Handle Deleting a user-uploaded shot from IndexedDB
  async function handleDelete(id) {
    await deleteLocalShot(id);
    setUserShots((prev) => prev.filter((s) => s.id !== id));
    setNotice("Removed screenshot from local shelf.");
    setTimeout(() => setNotice(""), 2000);
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
        return (
          (s.title && s.title.toLowerCase().includes(qLower)) ||
          (s.text && s.text.toLowerCase().includes(qLower)) ||
          (s.caption && s.caption.toLowerCase().includes(qLower)) ||
          (s.filename && s.filename.toLowerCase().includes(qLower))
        );
      })
    : userShots;

  // Combine user's personal shots + golden set shots
  const allShots = [...filteredUserShots, ...serverShots];

  const compact = pinned || query.length > 0;
  const countLabel =
    phase === "loading"
      ? "Opening the wall"
      : phase === "searching"
      ? "Rearranging"
      : `${allShots.length} on the wall`;

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
      
      {/* Hidden File Picker for Mobile Camera Roll / Desktop Files */}
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
          <kbd>/</kbd>
        </label>

        <div className="mast-end">
          <p className="count" aria-live="polite">
            {countLabel}
          </p>
          <div className="mast-actions">
            <button
              type="button"
              className="btn-gallery"
              onClick={() => fileInputRef.current?.click()}
              title="Pick screenshots from phone gallery or files"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                <circle cx="9" cy="9" r="2"/>
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
              </svg>
              <span>Add from Gallery</span>
            </button>
            {hasDirectoryPicker ? (
              <button
                type="button"
                className="btn-folder"
                onClick={onPickDirectory}
                title="Sync local screenshots folder"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>
                </svg>
                <span>Folder</span>
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {notice ? <p className="notice">{notice}</p> : null}

      {allShots.length === 0 && phase !== "loading" ? (
        <section className="empty">
          <p>The wall is clear.</p>
          <span>Tap <strong>Add from Gallery</strong> to select screenshots from your device.</span>
          <div style={{ marginTop: "18px" }}>
            <button
              type="button"
              className="btn-gallery"
              style={{ padding: "10px 20px", fontSize: "14px" }}
              onClick={() => fileInputRef.current?.click()}
            >
              📷 Pick from Photos / Gallery
            </button>
          </div>
        </section>
      ) : null}

      <section className="wall" aria-label="Screenshots">
        {allShots.map((shot) => (
          <ShotCard
            key={shot.id}
            shot={shot}
            active={query.trim().length > 0}
            onDelete={shot.isUserUploaded ? handleDelete : undefined}
          />
        ))}
      </section>

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
