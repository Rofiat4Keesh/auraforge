import { serveUploadedImage } from "@/server/controllers/upload.controller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = serveUploadedImage;
