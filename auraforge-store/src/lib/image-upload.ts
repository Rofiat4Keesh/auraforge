"use client";

/**
 * Browser helpers for uploading product photos from the Admin Portal.
 *
 * 1. prepareImage(): big phone photos (often 4–12 MB, 4000 px wide) are shrunk in the browser to at most
 *    MAX_EDGE pixels on the longest side and re-saved as WebP (or JPEG), usually 100–600 KB. That keeps the
 *    shop fast on mobile data and well under the server's 5 MB limit. Small images are sent unchanged,
 *    and GIFs are never re-encoded (that would stop animation).
 * 2. uploadImage(): sends the file to POST /api/admin/uploads and reports progress (0–100).
 *    It returns the image's address, e.g. "/media/uploads/6718f0c2a1b2c3d4e5f60718".
 */

export const MAX_EDGE = 1600;
export const MAX_UPLOAD_MB = 5;
const KEEP_ORIGINAL_UNDER_BYTES = 900 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export class UploadError extends Error {}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if ("createImageBitmap" in window) {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // fall through to the <img> method below
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new UploadError(
      "This photo format can't be opened in this browser. Save it as JPG or PNG and try again (iPhone HEIC photos convert automatically when picked from your phone).",
    );
  }
}

/** Shrinks/re-encodes a photo if needed. Returns the file to upload. */
export async function prepareImage(file: File): Promise<File> {
  const looksLikeImage = file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name);
  if (!looksLikeImage) throw new UploadError(`"${file.name}" isn't an image. Choose a JPG, PNG, WebP or GIF photo.`);
  if (file.type === "image/gif") {
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) throw new UploadError(`"${file.name}" is larger than ${MAX_UPLOAD_MB} MB.`);
    return file;
  }

  const image = await decode(file);
  try {
    const longest = Math.max(image.width, image.height);
    if (ACCEPTED.includes(file.type) && longest <= MAX_EDGE && file.size <= KEEP_ORIGINAL_UNDER_BYTES) return file;

    const scale = Math.min(1, MAX_EDGE / longest);
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new UploadError("Your browser couldn't prepare this photo. Try a different browser.");
    context.imageSmoothingQuality = "high";
    context.drawImage(image.source, 0, 0, width, height);

    // WebP keeps transparency and is small. Older browsers that can't write WebP fall back to JPEG
    // (on a white background, since JPEG has no transparency).
    let blob = await canvasToBlob(canvas, "image/webp", 0.86);
    let type = "image/webp";
    if (!blob || blob.type !== "image/webp") {
      context.globalCompositeOperation = "destination-over";
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      blob = await canvasToBlob(canvas, "image/jpeg", 0.86);
      type = "image/jpeg";
    }
    if (!blob) throw new UploadError("Your browser couldn't prepare this photo. Try a different browser.");
    const base = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${base}.${type === "image/webp" ? "webp" : "jpg"}`, { type });
  } finally {
    image.close();
  }
}

/** Uploads one prepared image. Calls onProgress with 0–100. Resolves to the image's URL. */
export function uploadImage(file: File, onProgress?: (percent: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/uploads");
    xhr.withCredentials = true;
    xhr.setRequestHeader("Accept", "application/json");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onerror = () => reject(new UploadError("Network error. Check your connection and try again."));
    xhr.onload = () => {
      let body: { success?: boolean; data?: { url: string }; error?: { message?: string } } | null = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = null;
      }
      if (xhr.status >= 200 && xhr.status < 300 && body?.success && body.data?.url) {
        onProgress?.(100);
        resolve(body.data.url);
        return;
      }
      if (xhr.status === 401 || xhr.status === 403) {
        reject(new UploadError("Your admin sign-in has expired. Sign in again, then retry the upload."));
        return;
      }
      reject(new UploadError(body?.error?.message || `Upload failed (error ${xhr.status}). Please try again.`));
    };
    xhr.send(form);
  });
}
