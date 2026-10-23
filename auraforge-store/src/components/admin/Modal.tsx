"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * Accessible pop-up used across the Admin Portal (order details, product create/edit).
 * - Closes with the ✕ button, the Escape key, or a click on the dark backdrop.
 * - Locks page scrolling while open and moves keyboard focus into the dialog,
 *   then returns focus to whatever opened it.
 */
export function Modal({
  open,
  onClose,
  title,
  labelledBy,
  size = "lg",
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  /** Visible heading. Omit it when the content renders its own heading and pass `labelledBy`. */
  title?: string;
  labelledBy?: string;
  size?: "md" | "lg" | "xl";
  children: ReactNode;
  footer?: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const width = size === "md" ? "max-w-xl" : size === "lg" ? "max-w-3xl" : "max-w-5xl";
  const headingId = title ? "admin-modal-title" : labelledBy;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
      <button type="button" className="absolute inset-0 animate-fade-in bg-black/75 backdrop-blur-sm" onClick={onClose} aria-label="Close" tabIndex={-1} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        className={`relative flex max-h-[92vh] w-full ${width} animate-fade-in flex-col rounded-t-2xl border border-obsidian-700 bg-obsidian-950 shadow-2xl outline-none sm:rounded-2xl`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-obsidian-800 px-5 py-3">
          {title ? (
            <h2 id="admin-modal-title" className="truncate text-lg font-semibold">
              {title}
            </h2>
          ) : (
            <span />
          )}
          <button type="button" onClick={onClose} className="icon-btn -mr-2" aria-label="Close dialog">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="border-t border-obsidian-800 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
