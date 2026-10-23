import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { HttpError, handle, ok } from "@/lib/http";
import { MAX_UPLOAD_BYTES, getUploadedImage, saveUploadedImage } from "@/server/services/upload.service";

/**
 * POST /api/admin/uploads  (admin only)
 * Body: multipart/form-data with one field named "file".
 * Returns { id, url, contentType, size, width, height }. Put `url` into a product's images.
 */
export const uploadImageController = handle(async (req: NextRequest) => {
  const admin = await requireAdmin();

  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) {
    throw new HttpError(413, `That image is too large. The limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new HttpError(400, "Send the image as multipart/form-data with a field named \"file\".");
  }
  const file = form.get("file");
  if (!file || typeof file === "string") throw new HttpError(422, "Choose an image to upload.");

  return ok(await saveUploadedImage(file, admin.id), 201);
});

/** GET /media/uploads/:id — public; product pages show these images to every shopper. */
export async function serveUploadedImage(_req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  const image = await getUploadedImage(id);
  if (!image) return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  return new Response(new Uint8Array(image.data), {
    status: 200,
    headers: {
      "Content-Type": image.contentType,
      "Content-Length": String(image.size),
      // An uploaded image never changes (a new upload gets a new id), so browsers and CDNs may keep it for a year.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
