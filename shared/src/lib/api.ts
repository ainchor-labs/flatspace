/**
 * Central API client (`@flatspace/shared/lib`).
 *
 * Per the suite rules, ALL client→server calls go through this module. It wraps
 * fetch with: credentials (so the httpOnly JWT cookie rides along), JSON
 * encoding, and typed error handling that surfaces the server's ApiError shape.
 *
 * Requests are relative ("/api/..."); in dev Vite proxies them to Fastify.
 */

import type { ApiError } from "../types/index.ts";

export class ApiRequestError extends Error {
  readonly statusCode: number;
  readonly code: string;
  constructor(payload: ApiError) {
    super(payload.message);
    this.name = "ApiRequestError";
    this.statusCode = payload.statusCode;
    this.code = payload.error;
  }
}

/** Any JSON-serialisable request body. */
type Json = unknown;

async function request<T>(method: string, path: string, body?: Json): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    const err = (data ?? {}) as Partial<ApiError>;
    throw new ApiRequestError({
      error: err.error ?? "Error",
      message: err.message ?? res.statusText,
      statusCode: err.statusCode ?? res.status,
    });
  }

  return data as T;
}

/**
 * POST that expects a binary response (a file download) rather than JSON. Used
 * by export paths that stream a generated file back. Non-OK responses still
 * carry the JSON ApiError shape, so we parse and surface those as usual.
 */
async function requestBlob(method: string, path: string, body?: Json): Promise<Blob> {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    const data = (text ? (JSON.parse(text) as unknown) : {}) as Partial<ApiError>;
    throw new ApiRequestError({
      error: data.error ?? "Error",
      message: data.message ?? res.statusText,
      statusCode: data.statusCode ?? res.status,
    });
  }

  return res.blob();
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: Json) => request<T>("POST", path, body),
  put: <T>(path: string, body?: Json) => request<T>("PUT", path, body),
  patch: <T>(path: string, body?: Json) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
  /** POST a JSON body and receive a binary Blob (e.g. a generated export file). */
  postBlob: (path: string, body?: Json) => requestBlob("POST", path, body),
  /** Upload a file as the raw request body (binary); returns the JSON response. */
  upload: <T>(path: string, body: Blob, contentType?: string) => uploadRequest<T>(path, body, contentType),
};

/** POST a raw binary body (a File/Blob) and parse the JSON response. */
async function uploadRequest<T>(path: string, body: Blob, contentType?: string): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": contentType || body.type || "application/octet-stream" },
    body,
  });

  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const err = (data ?? {}) as Partial<ApiError>;
    throw new ApiRequestError({
      error: err.error ?? "Error",
      message: err.message ?? res.statusText,
      statusCode: err.statusCode ?? res.status,
    });
  }
  return data as T;
}
