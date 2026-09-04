"use client";

import { useRef, useState } from "react";
import type { Rect } from "@/lib/engine/outline";

export default function RectSelector({
  src,
  rect,
  onChange,
  overlayColor = "#FFF000",
}: {
  src: string;
  rect: Rect | null;
  onChange: (rect: Rect | null) => void;
  overlayColor?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [drawing, setDrawing] = useState<Rect | null>(null);

  function toFrac(clientX: number, clientY: number) {
    const el = ref.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (clientY - r.top) / r.height)),
    };
  }

  function beginDraw(clientX: number, clientY: number) {
    start.current = toFrac(clientX, clientY);
    setDrawing({ x: start.current.x, y: start.current.y, w: 0, h: 0 });
  }

  function updateDraw(clientX: number, clientY: number) {
    if (!start.current) return;
    const p = toFrac(clientX, clientY);
    const x = Math.min(start.current.x, p.x);
    const y = Math.min(start.current.y, p.y);
    const w = Math.abs(p.x - start.current.x);
    const h = Math.abs(p.y - start.current.y);
    setDrawing({ x, y, w, h });
  }

  function endDraw() {
    if (drawing && drawing.w > 0.01 && drawing.h > 0.01) onChange(drawing);
    start.current = null;
    setDrawing(null);
  }

  const active = drawing ?? rect;

  return (
    <div
      ref={ref}
      className="relative w-full touch-none select-none overflow-hidden rounded-xl bg-studio-gray-950"
      onMouseDown={(e) => beginDraw(e.clientX, e.clientY)}
      onMouseMove={(e) => e.buttons === 1 && updateDraw(e.clientX, e.clientY)}
      onMouseUp={endDraw}
      onMouseLeave={() => start.current && endDraw()}
      onTouchStart={(e) => beginDraw(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchMove={(e) => updateDraw(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchEnd={endDraw}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Sélection de zone" className="pointer-events-none block w-full" draggable={false} />
      {active && (
        <div
          className="pointer-events-none absolute border-2"
          style={{
            left: `${active.x * 100}%`,
            top: `${active.y * 100}%`,
            width: `${active.w * 100}%`,
            height: `${active.h * 100}%`,
            borderColor: overlayColor,
            background: `${overlayColor}22`,
          }}
        />
      )}
      {rect && !drawing && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onChange(null);
          }}
          className="absolute top-2 right-2 rounded-full bg-studio-black/70 px-2 py-1 text-[10px] font-bold text-white"
        >
          EFFACER LA ZONE
        </button>
      )}
      {!rect && !drawing && (
        <p className="pointer-events-none absolute bottom-2 left-2 rounded bg-studio-black/70 px-2 py-1 text-[10px] text-white">
          Dessinez une zone en cliquant-glissant
        </p>
      )}
    </div>
  );
}
