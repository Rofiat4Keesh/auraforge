import { listMyOrdersController } from "@/server/controllers/checkout.controller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = listMyOrdersController;
