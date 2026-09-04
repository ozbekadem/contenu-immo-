"use client";

import { useRef, useState } from "react";

export default function BeforeAfterSlider({ beforeSrc, afterSrc, alt }: { beforeSrc: string; afterSrc: string; alt: string }) {
  const [pos, setPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  function updateFromClientX(clientX: number) {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, pct)));
  }

  return (
    <div
      ref={containerRef}
      className="relative aspect-[4/3] w-full select-none overflow-hidden rounded-xl bg-studio-gray-950 touch-none"
      onMouseDown={(e) => {
        dragging.current = true;
        updateFromClientX(e.clientX);
      }}
      onMouseMove={(e) => dragging.current && updateFromClientX(e.clientX)}
      onMouseUp={() => (dragging.current = false)}
      onMouseLeave={() => (dragging.current = false)}
      onTouchStart={(e) => updateFromClientX(e.touches[0].clientX)}
      onTouchMove={(e) => updateFromClientX(e.touches[0].clientX)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={afterSrc} alt={`${alt} - après`} className="absolute inset-0 h-full w-full object-contain" draggable={false} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={beforeSrc}
        alt={`${alt} - avant`}
        className="absolute inset-0 h-full w-full object-contain"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        draggable={false}
      />
      <div className="pointer-events-none absolute top-2 left-2 rounded bg-studio-black/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
        Avant
      </div>
      <div className="pointer-events-none absolute top-2 right-2 rounded bg-studio-yellow/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-studio-black">
        Après
      </div>
      <div className="absolute inset-y-0 w-0.5 bg-studio-yellow" style={{ left: `${pos}%` }}>
        <div className="absolute top-1/2 left-1/2 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-studio-yellow text-studio-black shadow-lg">
          ↔
        </div>
      </div>
    </div>
  );
}
