# KAZA public storefront (demo, Next.js 16) — production image.
# Build context = ./demo ; this Dockerfile lives in infra/ so the app dir stays untouched.
# No output:'standalone' (hands-off), so we ship the full build + run `next start`.

# ── Build stage ──
FROM node:20-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# NEXT_PUBLIC_* are baked at build time. STORAGE_URL is empty on purpose so unit-image
# src becomes relative '/uploads/...' (served same-origin via Nginx) — Blocker B2.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_PLATFORM_URL
ARG NEXT_PUBLIC_STORAGE_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_PLATFORM_URL=$NEXT_PUBLIC_PLATFORM_URL \
    NEXT_PUBLIC_STORAGE_URL=$NEXT_PUBLIC_STORAGE_URL \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ── Runtime stage ──
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

COPY --from=build /app ./

EXPOSE 3000
CMD ["npm", "run", "start"]
