import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/http";

/**
 * Product photo uploads from the Admin Portal.
 *
 * The browser shrinks photos before sending them (see src/lib/image-upload.ts), so a typical
 * upload is 100–600 KB. The server still checks everything itself:
 *  - size limit (MAX_UPLOAD_BYTES)
 *  - the file's real type is read from its first bytes ("magic numbers"), NOT from the file name
 *    or the type the browser claims, so a renamed script can never be stored as an "image".
 *  - only JPEG, PNG, WebP and GIF are accepted (no SVG: SVG files can contain scripts).
 */

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
export const UPLOAD_URL_PREFIX = "/media/uploads/";

type ImageType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

/** Works out the real image type from the file's first bytes. Returns null if it isn't a supported image. */
export function sniffImageType(bytes: Uint8Array): ImageType | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return "image/png";
  }
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(0, 6) === "GIF87a" || ascii(0, 6) === "GIF89a") return "image/gif";
  return null;
}

/** Reads width × height from the image header (no image library needed). Returns null if unknown. */
export function readImageSize(bytes: Uint8Array, type: ImageType): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  try {
    if (type === "image/png") return { width: view.getUint32(16), height: view.getUint32(20) };
    if (type === "image/gif") return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
    if (type === "image/webp") {
      const chunk = String.fromCharCode(...bytes.subarray(12, 16));
      if (chunk === "VP8X") return { width: 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)), height: 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)) };
      if (chunk === "VP8 ") return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
      if (chunk === "VP8L") {
        const b = view.getUint32(21, true);
        return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
      }
      return null;
    }
    // JPEG: walk the segments until a "start of frame" marker
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) return null;
      const marker = bytes[offset + 1];
      const length = view.getUint16(offset + 2);
      const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isFrame) return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };
      offset += 2 + length;
    }
    return null;
  } catch {
    return null;
  }
}

export interface UploadResult {
  id: string;
  url: string;
  contentType: string;
  size: number;
  width: number | null;
  height: number | null;
}

export async function saveUploadedImage(file: File, adminId: string): Promise<UploadResult> {
  if (file.size === 0) throw new HttpError(422, "That file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new HttpError(413, `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = sniffImageType(bytes);
  if (!contentType) throw new HttpError(415, "Please upload a JPG, PNG, WebP or GIF photo.");
  const dimensions = readImageSize(bytes, contentType);

  const saved = await prisma.uploadedImage.create({
    data: {
      contentType,
      data: Buffer.from(bytes),
      size: bytes.length,
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
      fileName: (file.name || "upload").slice(0, 120),
      uploadedBy: adminId,
    },
    select: { id: true },
  });

  return {
    id: saved.id,
    url: `${UPLOAD_URL_PREFIX}${saved.id}`,
    contentType,
    size: bytes.length,
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
  };
}

export async function getUploadedImage(id: string) {
  if (!/^[a-f0-9]{24}$/i.test(id)) return null;
  return prisma.uploadedImage.findUnique({ where: { id }, select: { contentType: true, data: true, size: true } });
}
