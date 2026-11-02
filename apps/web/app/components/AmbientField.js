"use client";

import { useEffect, useRef } from "react";

function paintNoise(size) {
  const grain = document.createElement("canvas");
  grain.width = size;
  grain.height = size;
  const context = grain.getContext("2d");
  const pixels = context.createImageData(size, size);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const tone = 200 + Math.random() * 55;
    pixels.data[index] = tone;
    pixels.data[index + 1] = tone;
    pixels.data[index + 2] = tone;
    pixels.data[index + 3] = 20;
  }
  context.putImageData(pixels, 0, 0);
  return grain;
}

export default function AmbientField() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const context = canvas.getContext("2d", { alpha: false });
    const grain = paintNoise(96);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pointer = { x: 0.62, y: 0.28, tx: 0.62, ty: 0.28 };
    let frame = 0;
    let last = 0;
    let alive = true;

    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.25);
      canvas.width = Math.max(1, Math.floor(window.innerWidth * ratio * 0.45));
      canvas.height = Math.max(1, Math.floor(window.innerHeight * ratio * 0.45));
    }

    function light(x, y, radius, color) {
      const width = canvas.width;
      const height = canvas.height;
      const glow = context.createRadialGradient(
        x * width,
        y * height,
        0,
        x * width,
        y * height,
        radius * Math.max(width, height)
      );
      glow.addColorStop(0, color);
      glow.addColorStop(1, "rgba(8,7,13,0)");
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);
    }

    function draw(now) {
      if (!alive) return;
      frame = requestAnimationFrame(draw);
      if (!reduce && now - last < 34) return;
      last = now;
      const time = reduce ? 0.4 : now * 0.00007;
      pointer.x += (pointer.tx - pointer.x) * 0.035;
      pointer.y += (pointer.ty - pointer.y) * 0.035;

      // Dark obsidian canvas
      context.fillStyle = "#08070d";
      context.fillRect(0, 0, canvas.width, canvas.height);

      // Startup Aurora: Radiant Electric Violet, Cyber Cyan, Coral Tangerine & Emerald
      light(
        0.18 + Math.sin(time) * 0.08 + (pointer.x - 0.5) * 0.08,
        0.18 + Math.cos(time * 0.8) * 0.06,
        0.65,
        "rgba(139,92,246,0.30)"
      );
      light(
        0.82 + Math.cos(time * 0.65) * 0.07,
        0.28 + Math.sin(time * 0.55) * 0.06 + (pointer.y - 0.5) * 0.07,
        0.58,
        "rgba(6,182,212,0.26)"
      );
      light(
        0.48 + Math.sin(time * 0.45 + 1) * 0.1,
        0.82 + (pointer.y - 0.4) * 0.06,
        0.55,
        "rgba(249,115,22,0.20)"
      );
      light(
        0.28 + Math.cos(time * 0.5) * 0.06,
        0.65 + Math.sin(time * 0.7) * 0.05,
        0.45,
        "rgba(16,185,129,0.16)"
      );

      context.globalAlpha = 0.18;
      context.drawImage(grain, 0, 0, canvas.width, canvas.height);
      context.globalAlpha = 1;

      if (reduce) {
        alive = false;
        cancelAnimationFrame(frame);
      }
    }

    function onMove(event) {
      pointer.tx = event.clientX / window.innerWidth;
      pointer.ty = event.clientY / window.innerHeight;
    }

    function onHide() {
      if (document.hidden) {
        alive = false;
        cancelAnimationFrame(frame);
        return;
      }
      if (!alive && !reduce) {
        alive = true;
        frame = requestAnimationFrame(draw);
      }
    }

    resize();
    frame = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("visibilitychange", onHide);
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);

  return <canvas ref={ref} className="ambient" aria-hidden="true" />;
}
