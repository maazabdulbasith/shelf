"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import AmbientField from "./components/AmbientField";
import AskDock from "./components/AskDock";
import Logo from "./components/Logo";
import ShotCard from "./components/ShotCard";
import { askShelf, fetchShots, uploadShot } from "./lib/api";

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
  const [shots, setShots] = useState([]);
  const [phase, setPhase] = useState("loading");
  const [notice, setNotice] = useState("");
  const [dragDepth, setDragDepth] = useState(0);
  const [pinned, setPinned] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [asking, setAsking] = useState(false);
  const [open, setOpen] = useState(false);
  const loaded = useRef(false);

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
      applyShots(next, setShots);
      setNotice("");
      setPhase("ready");
    }, 200);
    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [query]);

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

  async function onDrop(event) {
    event.preventDefault();
    setDragDepth(0);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    setNotice("Keeping that screenshot…");
    try {
      await uploadShot(file);
      const next = await fetchShots(query);
      applyShots(next, setShots);
      setNotice("");
      setPhase("ready");
    } catch {
      setNotice("That drop did not land.");
    }
  }

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

  const compact = pinned || query.length > 0;
  const countLabel = phase === "loading" ? "Opening the wall" : phase === "searching" ? "Rearranging" : `${shots.length} on the wall`;

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
        <p className="count" aria-live="polite">
          {countLabel}
        </p>
      </header>

      {notice ? <p className="notice">{notice}</p> : null}

      {phase !== "offline" && shots.length === 0 && phase !== "loading" ? (
        <section className="empty">
          <p>The wall is clear.</p>
          <span>Drop a screenshot, or let the folder watcher bring one in.</span>
        </section>
      ) : null}

      <section className="wall" aria-label="Screenshots">
        {shots.map((shot) => (
          <ShotCard key={shot.id} shot={shot} active={query.trim().length > 0} />
        ))}
      </section>

      {dragDepth > 0 ? (
        <div className="drop">
          <strong>Release to keep it</strong>
          <span>It stays on this machine.</span>
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
