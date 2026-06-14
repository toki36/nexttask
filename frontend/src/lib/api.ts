import type { ApiError } from "@/types";

export const tokenKey = "nexttask.token";
export const userKey = "nexttask.user";
export const apiBase = "/api/backend";

export class ApiRequestError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code = "") {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}, authToken = ""): Promise<T> {
  const headers = new Headers(init.headers);
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    let code = "";
    try {
      const body = (await response.json()) as ApiError;
      code = body.error?.code ?? "";
      message = body.error?.message ?? body.error?.code ?? message;
    } catch {
      // Keep the HTTP status message when the response is not JSON.
    }
    throw new ApiRequestError(message, response.status, code);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : "unknown error";
}

export function isUnauthorizedError(err: unknown) {
  return err instanceof ApiRequestError && err.status === 401;
}
