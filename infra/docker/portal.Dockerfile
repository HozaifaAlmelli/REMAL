# KAZA operational portals (rental-platform, Next.js 14) — production image.
# Build context = ./rental-platform ; Dockerfile lives in infra/ so the app dir stays untouched.
# No output:'standalone' (hands-off), so we ship the full build + run `next start` on :3001.

# ── Build stage ──
FROM node:20-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# NEXT_PUBLIC_* baked at build time. STORAGE_URL empty => relative '/uploads/...' (Blocker B2).
# ALLOWED_RETURN_ORIGINS must be the prod storefront origin or post-login redirects break.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_STORAGE_URL
ARG NEXT_PUBLIC_APP_ENV
ARG NEXT_PUBLIC_MAPBOX_TOKEN
ARG NEXT_PUBLIC_ALLOWED_RETURN_ORIGINS
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_STORAGE_URL=$NEXT_PUBLIC_STORAGE_URL \
    NEXT_PUBLIC_APP_ENV=$NEXT_PUBLIC_APP_ENV \
    NEXT_PUBLIC_MAPBOX_TOKEN=$NEXT_PUBLIC_MAPBOX_TOKEN \
    NEXT_PUBLIC_ALLOWED_RETURN_ORIGINS=$NEXT_PUBLIC_ALLOWED_RETURN_ORIGINS \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ── Runtime stage ──
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3001

COPY --from=build /app ./

EXPOSE 3001
# `--` forwards the port flag to `next start` (package start script is `next start`).
CMD ["npm", "run", "start", "--", "-p", "3001"]
