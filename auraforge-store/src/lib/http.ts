import { NextResponse } from "next/server";
import { ZodError } from "zod";

/** An error that carries an HTTP status code, thrown by services and turned into JSON by controllers. */
export class HttpError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}

export function fail(status: number, message: string, details?: unknown): NextResponse {
  return NextResponse.json({ success: false, error: { message, details } }, { status });
}

/** Wrap a controller so every thrown error becomes a consistent JSON response. */
export function handle<Args extends unknown[]>(
  fn: (...args: Args) => Promise<NextResponse>,
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof HttpError) {
        return fail(error.status, error.message, error.details);
      }
      if (error instanceof ZodError) {
        return fail(422, "Please check the highlighted fields.", error.flatten().fieldErrors);
      }
      console.error("[api] Unhandled error:", error);
      return fail(500, "Something went wrong on our side. Please try again.");
    }
  };
}

/** Safely parse a JSON request body. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
}
