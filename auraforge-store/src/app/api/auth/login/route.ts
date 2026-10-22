import { loginController } from "@/server/controllers/auth.controller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = loginController;
