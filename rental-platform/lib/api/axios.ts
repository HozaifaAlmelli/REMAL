import axios, {
  AxiosError,
  InternalAxiosRequestConfig,
  AxiosResponse,
} from "axios";
import { ApiError } from "./api-error";
import type { ApiResponse } from "./types";
import { useAuthStore } from "@/lib/stores/auth.store";
import { ROUTES } from "@/lib/constants/routes";
import { toastError } from "@/lib/utils/toast";
import type { AuthResponse } from "@/lib/types/auth.types";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_URL) {
  throw new Error("NEXT_PUBLIC_API_URL is not defined");
}

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// ───── Request Interceptor ─────
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ───── Refresh state ─────
let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

/**
 * Lazy-import authService to break the circular dependency
 * (authService imports `api`, and `api` needs authService.refresh).
 */
async function callRefresh(): Promise<AuthResponse | null> {
  const { authService } = await import("@/lib/api/services/auth.service");
  return authService.refresh();
}

// ───── Response Interceptor ─────
api.interceptors.response.use(
  (response: AxiosResponse) => {
    const envelope = response.data as ApiResponse<unknown>;
    if (envelope?.success === false) {
      throw new ApiError(
        response.status,
        envelope.message ?? "Request failed",
        envelope.errors ?? []
      );
    }
    // If the response includes pagination, return { items, pagination }
    // so all paginated hooks receive the correct structure.
    if (envelope?.pagination) {
      return { items: envelope.data, pagination: envelope.pagination } as unknown as AxiosResponse;
    }
    // Unwrap: return the inner `data` field directly
    return envelope.data as unknown as AxiosResponse;
  },
  async (error: AxiosError<ApiResponse<unknown>>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // ── No response (network error) ──
    if (!error.response) {
      toastError("Cannot reach the server. Check your connection.");
      throw new ApiError(0, "Cannot reach the server");
    }

    const { status, data } = error.response;
    const message = data?.message ?? "Request failed";
    const errors = data?.errors ?? [];

    // ── Ignore 401 for auth endpoints ──
    if (status === 401 && (originalRequest.url?.includes('/login') || originalRequest.url?.includes('/register'))) {
      throw new ApiError(status, message, errors);
    }

    // ── 401: try refresh once ──
    if (status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (isRefreshing) {
        // queue this request until the in-flight refresh completes
        return new Promise((resolve, reject) => {
          refreshQueue.push((newToken) => {
            if (newToken) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              resolve(api(originalRequest));
            } else {
              reject(new ApiError(401, "Session expired"));
            }
          });
        });
      }

      isRefreshing = true;
      try {
        const refreshedAuth = await callRefresh();
        const newToken = refreshedAuth?.accessToken ?? null;

        if (refreshedAuth) {
          useAuthStore.getState().setAuth({
            accessToken: refreshedAuth.accessToken,
            expiresInSeconds: refreshedAuth.expiresInSeconds,
            subjectType: refreshedAuth.subjectType,
            user: refreshedAuth.user,
            role: refreshedAuth.subjectType === "Admin" ? refreshedAuth.adminRole : null,
          });
        } else {
          useAuthStore.getState().setAccessToken(null);
        }

        refreshQueue.forEach((cb) => cb(newToken));
        refreshQueue = [];
        isRefreshing = false;

        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }
        throw new ApiError(401, "Session expired");
      } catch {
        refreshQueue.forEach((cb) => cb(null));
        refreshQueue = [];
        isRefreshing = false;

        // Read subjectType BEFORE clearing (clearAuth nulls it)
        const subjectType = useAuthStore.getState().subjectType;
        useAuthStore.getState().clearAuth();

        // Hard redirect to the appropriate login page based on subjectType
        if (typeof window !== "undefined") {
          // Don't redirect if we are already on an auth page (prevents kicking users to admin login)
          if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
            const loginRoute =
              subjectType === "Owner"
                ? ROUTES.auth.ownerLogin
                : subjectType === "Client"
                  ? ROUTES.auth.clientLogin
                  : ROUTES.auth.adminLogin;
            window.location.href = loginRoute;
          }
        }

        throw new ApiError(401, "Session expired");
      }
    }

    // ── 403 ──
    if (status === 403) {
      toastError("You don't have permission to perform this action");
      throw new ApiError(403, message, errors);
    }

    // ── 500+ ──
    if (status >= 500) {
      toastError("Something went wrong. Please try again.");
      throw new ApiError(status, message, errors);
    }

    // ── 400 / 404 / 422 / others — let caller handle ──
    throw new ApiError(status, message, errors);
  }
);

export default api;
