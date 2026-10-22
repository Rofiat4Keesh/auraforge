import type { ApiResponse } from "@/types";

/** Error thrown by apiFetch, carrying the server's message and per-field validation errors. */
export class ApiClientError extends Error {
  status: number;
  fieldErrors: Record<string, string[] | undefined>;

  constructor(status: number, message: string, fieldErrors: Record<string, string[] | undefined> = {}) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

/** Browser-side fetch wrapper for our own /api routes. Returns `data` or throws ApiClientError. */
export async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers || {}),
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiClientError(0, "Network error — please check your connection and try again.");
  }

  let body: ApiResponse<T> | null = null;
  try {
    body = (await response.json()) as ApiResponse<T>;
  } catch {
    body = null;
  }

  if (!body) throw new ApiClientError(response.status, "Unexpected response from the server.");
  if (!body.success) {
    throw new ApiClientError(response.status, body.error.message, body.error.details ?? {});
  }
  return body.data;
}
