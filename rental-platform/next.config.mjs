/** @type {import('next').NextConfig} */

// Local-development image host (the API's static-file server on :5001).
const remotePatterns = [
  { protocol: "http", hostname: "localhost", port: "5001", pathname: "/uploads/**" },
  { protocol: "http", hostname: "127.0.0.1", port: "5001", pathname: "/uploads/**" },
];

// Production image host(s) are environment-driven so no domain is hard-coded.
// NEXT_PUBLIC_STORAGE_URL is the canonical uploads origin (the API domain that serves
// /uploads/...); NEXT_PUBLIC_API_URL is a fallback. Both are read at build time.
for (const raw of [process.env.NEXT_PUBLIC_STORAGE_URL, process.env.NEXT_PUBLIC_API_URL]) {
  if (!raw) continue;
  try {
    const u = new URL(raw);
    const pattern = {
      protocol: u.protocol.replace(/:$/, ""),
      hostname: u.hostname,
      pathname: "/uploads/**",
    };
    if (u.port) pattern.port = u.port;
    const exists = remotePatterns.some(
      (p) => p.protocol === pattern.protocol && p.hostname === pattern.hostname && (p.port ?? "") === (pattern.port ?? "")
    );
    if (!exists) remotePatterns.push(pattern);
  } catch {
    // Ignore malformed NEXT_PUBLIC_* values; fall back to the localhost patterns above.
  }
}

const nextConfig = {
  images: {
    remotePatterns,
  },
};

export default nextConfig;
