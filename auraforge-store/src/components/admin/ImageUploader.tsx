"use client";

/**
 * "Upload photos" box for the Admin Portal: click to choose files (on a phone this also offers the
 * camera), or drag and drop photos onto it. Each photo is shrunk in the browser, uploaded, and its
 * address is handed to `onUploaded` so the form can add it to the product's images.
 */
import { useRef, useState, type DragEvent } from "react";
import { AlertTriangle, Loader2, UploadCloud } from "lucide-react";
import { UploadError, prepareImage, uploadImage } from "@/lib/image-upload";

interface Job {
  id: number;
  name: string;
  progress: number;
  error: string | null;
}

export function ImageUploader({
  onUploaded,
  multiple = false,
  label = "Upload photo",
  hint = "JPG, PNG, WebP or GIF. Big photos are resized automatically.",
  compact = false,
  inputId,
}: {
  onUploaded: (url: string) => void;
  multiple?: boolean;
  label?: string;
  hint?: string;
  compact?: boolean;
  inputId: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [dragging, setDragging] = useState(false);
  const busy = jobs.some((j) => j.error === null && j.progress < 100);

  async function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const files = Array.from(list).slice(0, multiple ? 10 : 1);
    const start = Date.now();
    setJobs(files.map((f, i) => ({ id: start + i, name: f.name, progress: 0, error: null })));

    // One after another, so the images keep the order they were picked in.
    for (let i = 0; i < files.length; i += 1) {
      const id = start + i;
      const update = (patch: Partial<Job>) => setJobs((all) => all.map((j) => (j.id === id ? { ...j, ...patch } : j)));
      try {
        const prepared = await prepareImage(files[i]);
        update({ progress: 5 });
        const url = await uploadImage(prepared, (p) => update({ progress: Math.max(5, p) }));
        update({ progress: 100 });
        onUploaded(url);
      } catch (error) {
        update({ error: error instanceof UploadError ? error.message : "Upload failed. Please try again." });
      }
    }
    setJobs((all) => all.filter((j) => j.error !== null)); // keep only failures on screen
    if (input.current) input.current.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (!busy) void handleFiles(event.dataTransfer.files);
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!dragging) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex items-center gap-3 rounded-xl border-2 border-dashed px-4 transition ${compact ? "py-3" : "py-5"} ${
          dragging ? "border-neon-cyan bg-neon-cyan/10" : "border-obsidian-600 bg-obsidian-900/40 hover:border-neon-cyan/60"
        }`}
      >
        <UploadCloud className={`shrink-0 text-neon-cyan ${compact ? "h-5 w-5" : "h-7 w-7"}`} />
        <div className="min-w-0 flex-1">
          <label htmlFor={inputId} className="cursor-pointer text-sm font-semibold text-ink-100 hover:text-neon-cyan">
            {busy ? "Uploading…" : label}
            <span className="font-normal text-ink-400"> or drag {multiple ? "photos" : "a photo"} here</span>
          </label>
          <p className="text-xs text-ink-500">{hint}</p>
        </div>
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className="btn-ghost shrink-0 py-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {busy ? "Uploading" : "Choose"}
        </button>
        <input
          ref={input}
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
          multiple={multiple}
          className="sr-only"
          onChange={(e) => void handleFiles(e.target.files)}
          disabled={busy}
        />
      </div>

      {jobs.length > 0 && (
        <ul className="mt-2 space-y-1.5" aria-live="polite">
          {jobs.map((job) => (
            <li key={job.id} className="text-xs">
              {job.error ? (
                <p className="flex gap-1.5 text-neon-magenta">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    <span className="font-semibold">{job.name}:</span> {job.error}
                  </span>
                </p>
              ) : (
                <div>
                  <div className="flex justify-between text-ink-400">
                    <span className="truncate">{job.name}</span>
                    <span className="font-mono">{job.progress}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-obsidian-800">
                    <div className="h-full rounded-full bg-neon-cyan transition-all" style={{ width: `${job.progress}%` }} />
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
