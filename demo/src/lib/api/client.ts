import { ApiError } from "./api-error";
import type { ApiResponse, AuthResponse, Paginated } from "./types";
import { tokenStore } from "@/lib/auth/token-store";

/**
 * Storefront fetch client.
 *
 * Mirrors the platform axios setup: sends credentials (so the cross-origin
 * refresh cookie rides along), injects the in-memory Bearer token, unwraps the
 * `{ success, data, ... }` envelope, and transparently refreshes once on 401.
 */
const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");

type QueryValue = string | number | boolean | undefined | null;

function buildUrl(path: string, params?: Record<string, QueryValue>): string {
  const url = `${API_URL}${path}`;
  if (!params) return url;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.append(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${url}?${qs}` : url;
}

interface RequestOptions {
  body?: unknown;
  params?: Record<string, QueryValue>;
  cache?: RequestCache;
  /** Attach the Bearer token (default true). */
  auth?: boolean;
  _retried?: boolean;
}

// ── Single-flight refresh ──
let refreshPromise: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  if (!API_URL) return null;
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      tokenStore.clear();
      return null;
    }
    const json = (await res.json()) as ApiResponse<AuthResponse>;
    if (!json?.success || !json.data) {
      tokenStore.clear();
      return null;
    }
    tokenStore.setSession(json.data.accessToken, json.data.user);
    return json.data.accessToken;
  } catch {
    tokenStore.clear();
    return null;
  }
}

function ensureRefreshed(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function request<T>(
  method: string,
  path: string,
  opts: RequestOptions = {}
): Promise<ApiResponse<T>> {
  if (!API_URL) {
    throw new ApiError(0, "NEXT_PUBLIC_API_URL is not defined");
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  const token = tokenStore.getAccessToken();
  if (opts.auth !== false && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.params), {
      method,
      headers,
      credentials: "include",
      cache: opts.cache,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Check your connection.");
  }

  let envelope: ApiResponse<T> | null = null;
  try {
    envelope = (await res.json()) as ApiResponse<T>;
  } catch {
    envelope = null;
  }

  // 401 → refresh once, then retry (never for auth endpoints / anonymous calls).
  const isAuthEndpoint = path.includes("/auth/");
  if (
    res.status === 401 &&
    !opts._retried &&
    !isAuthEndpoint &&
    opts.auth !== false
  ) {
    const newToken = await ensureRefreshed();
    if (newToken) {
      return request<T>(method, path, { ...opts, _retried: true });
    }
  }

  if (!res.ok || envelope?.success === false) {
    throw new ApiError(
      res.status,
      envelope?.message ?? `Request failed (${res.status})`,
      envelope?.errors ?? []
    );
  }

  if (!envelope) {
    throw new ApiError(res.status, "Malformed server response");
  }

  return envelope;
}

export const http = {
  get: async <T>(
    path: string,
    params?: Record<string, QueryValue>,
    opts?: { cache?: RequestCache }
  ): Promise<T> => {
    const envelope = await request<T>("GET", path, {
      params,
      cache: opts?.cache,
    });
    return envelope.data as T;
  },

  getPaginated: async <T>(
    path: string,
    params?: Record<string, QueryValue>,
    opts?: { cache?: RequestCache }
  ): Promise<Paginated<T>> => {
    const envelope = await request<T[]>("GET", path, {
      params,
      cache: opts?.cache,
    });
    return {
      items: (envelope.data ?? []) as T[],
      pagination: envelope.pagination,
    };
  },

  post: async <T>(
    path: string,
    body?: unknown,
    opts?: { auth?: boolean }
  ): Promise<T> => {
    const envelope = await request<T>("POST", path, {
      body,
      auth: opts?.auth,
    });
    return envelope.data as T;
  },
};

// ── Session helpers (used by AuthProvider) ──

/** Hydrate the in-memory session from the refresh cookie. Returns true if signed in. */
export async function bootstrapSession(): Promise<boolean> {
  const token = await ensureRefreshed();
  return Boolean(token);
}

export async function logoutSession(): Promise<void> {
  try {
    if (API_URL) {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
      });
    }
  } catch {
    // ignore network errors on logout
  } finally {
    tokenStore.clear();
  }
}
