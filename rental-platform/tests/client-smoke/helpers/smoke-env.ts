const DEFAULT_API_URL = "http://localhost:5001";

export const CLIENT_SMOKE_API_URL =
  process.env.CLIENT_SMOKE_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  DEFAULT_API_URL;

export function apiUrl(path: string): string {
  const base = CLIENT_SMOKE_API_URL.replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}
