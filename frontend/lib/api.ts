"use client";

import { useCallback, useMemo } from "react";

import { useRole } from "../components/role-context";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;

  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

async function buildApiError(response: Response): Promise<ApiError> {
  const status = response.status;
  let message = response.statusText || `Request failed with status ${status}`;
  let details: unknown;

  try {
    const data = await response.clone().json();
    details = data;
    if (typeof data === "object" && data !== null) {
      const potentialMessage =
        (data as Record<string, unknown>).message ??
        (data as Record<string, unknown>).detail ??
        (data as Record<string, unknown>).error;
      if (typeof potentialMessage === "string" && potentialMessage.trim().length > 0) {
        message = potentialMessage;
      }
    }
  } catch {
    try {
      const text = await response.text();
      if (text.trim().length > 0) {
        message = text;
      }
    } catch {
      // ignore secondary parsing errors
    }
  }

  return new ApiError(message, status, details);
}

export type ApiClient = {
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
  get: <T>(path: string, init?: RequestInit) => Promise<T>;
  post: <T>(path: string, init?: RequestInit) => Promise<T>;
};

const ensureHeaders = (init?: RequestInit, role?: string, userId?: string) => {
  const headers = new Headers(init?.headers ?? {});
  if (role) {
    headers.set("X-User-Role", role);
  }
  if (userId) {
    headers.set("X-User-Id", userId);
  }
  return headers;
};

export function useApiClient(): ApiClient {
  const { role, userId } = useRole();

  const request = useCallback(
    async <T>(path: string, init: RequestInit = {}) => {
      const headers = ensureHeaders(init, role, userId);
      if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }

      const response = await fetch(`${API_BASE}${path}`, {
        ...init,
        method: init.method ?? "GET",
        headers,
        cache: "no-store",
      });

      if (!response.ok) {
        throw await buildApiError(response);
      }

      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        return (await response.json()) as T;
      }
      return (await response.text()) as T;
    },
    [role, userId]
  );

  return useMemo<ApiClient>(
    () => ({
      request,
      get: <T>(path: string, init?: RequestInit) => request<T>(path, { ...init, method: "GET" }),
      post: <T>(path: string, init?: RequestInit) => request<T>(path, { ...init, method: "POST" }),
    }),
    [request]
  );
}
