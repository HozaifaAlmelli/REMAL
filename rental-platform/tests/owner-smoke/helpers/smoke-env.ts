const DEFAULT_OWNER_SMOKE_API_URL = "http://localhost:5001";

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export const OWNER_SMOKE_API_URL = trimTrailingSlash(
  process.env.OWNER_SMOKE_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    DEFAULT_OWNER_SMOKE_API_URL
);

export function apiUrl(path: string): string {
  return `${OWNER_SMOKE_API_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

