"use client";

import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { fallbackImageFor } from "@/lib/fallback-image";

interface ProductGalleryProps {
  images: string[];
  name: string;
  activeIndex: number;
  onChange: (index: number) => void;
  categorySlug?: string;
}

/** High-resolution image gallery: thumbnails, arrows, keyboard, hover-zoom and full-screen view. */
export function ProductGallery({ images, name, activeIndex, onChange, categorySlug }: ProductGalleryProps) {
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const count = images.length;
  const safeIndex = Math.min(Math.max(activeIndex, 0), Math.max(count - 1, 0));
  const current = images[safeIndex];

  const go = (delta: number) => onChange((safeIndex + delta + count) % count);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") go(1);
    if (e.key === "ArrowLeft") go(-1);
    if (e.key === "Escape") setFullscreen(false);
  };

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setZoom({ x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 });
  };

  if (count === 0) return null;

  return (
    <div className="flex flex-col-reverse gap-3 md:flex-row" onKeyDown={onKey}>
      <div
        className="no-scrollbar flex gap-3 overflow-x-auto md:max-h-[560px] md:flex-col md:overflow-y-auto"
        role="tablist"
        aria-label="Product images"
      >
        {images.map((src, i) => (
          <button
            key={src}
            type="button"
            role="tab"
            aria-selected={i === safeIndex}
            aria-label={`Show image ${i + 1} of ${count}`}
            onClick={() => onChange(i)}
            className={`h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 bg-obsidian-850 transition ${
              i === safeIndex ? "border-neon-cyan shadow-neon" : "border-obsidian-700 opacity-60 hover:opacity-100"
            }`}
          >
            <SafeImage
              src={src}
              fallbackSrc={fallbackImageFor(categorySlug, i)}
              alt=""
              className="h-full w-full object-contain"
            />
          </button>
        ))}
      </div>

      <div className="relative flex-1">
        <div
          className="group relative aspect-square cursor-zoom-in overflow-hidden rounded-2xl border border-obsidian-700 bg-obsidian-850"
          onMouseMove={onMove}
          onMouseLeave={() => setZoom(null)}
          onClick={() => setFullscreen(true)}
          tabIndex={0}
          role="img"
          aria-label={`${name} — image ${safeIndex + 1} of ${count}. Use arrow keys to browse.`}
        >
          <SafeImage
            key={current}
            src={current}
            fallbackSrc={fallbackImageFor(categorySlug, safeIndex)}
            alt={name}
            className="h-full w-full animate-fade-in object-contain transition-transform duration-200"
            style={zoom ? { transform: "scale(1.9)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
          />
          <span className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1 rounded-lg bg-obsidian-950/80 px-2 py-1 font-mono text-[10px] text-ink-300">
            <Expand className="h-3 w-3" /> {safeIndex + 1}/{count}
          </span>
        </div>

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-obsidian-600 bg-obsidian-950/80 text-ink-100 transition hover:border-neon-cyan hover:text-neon-cyan"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-obsidian-600 bg-obsidian-950/80 text-ink-100 transition hover:border-neon-cyan hover:text-neon-cyan"
              aria-label="Next image"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {fullscreen && (
        <div
          className="fixed inset-0 z-[60] flex animate-fade-in items-center justify-center bg-black/95 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${name} images`}
        >
          <button
            type="button"
            onClick={() => setFullscreen(false)}
            className="icon-btn absolute right-4 top-4"
            aria-label="Close"
            autoFocus
          >
            <X className="h-6 w-6" />
          </button>
          {count > 1 && (
            <button
              type="button"
              onClick={() => go(-1)}
              className="icon-btn absolute left-4"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-7 w-7" />
            </button>
          )}
          <SafeImage
            src={current}
            fallbackSrc={fallbackImageFor(categorySlug, safeIndex)}
            alt={name}
            className="max-h-[90vh] max-w-full rounded-2xl object-contain"
          />
          {count > 1 && (
            <button type="button" onClick={() => go(1)} className="icon-btn absolute right-4" aria-label="Next image">
              <ChevronRight className="h-7 w-7" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
