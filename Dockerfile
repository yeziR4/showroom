# Docker image for ModelScope Studio (Docker SDK) — reachable from mainland China.
# Builds the same Next.js app that runs on Vercel and serves it on port 7860,
# the only port ModelScope exposes. Everything is fetched from China-friendly
# mirrors (ModelScope base image, npmmirror for Node and npm packages).
#
# Runtime environment variables (set in the Studio's Settings page):
#   AHOLO_API_KEY            required — Aholo Global API key
#   KV_REST_API_URL / _TOKEN optional — share the showcase with the Vercel site
#   ADMIN_KEY                optional — enables /api/admin/hide
#   NEXT_PUBLIC_SITE_URL     optional — this Studio's public URL (link previews)

FROM modelscope-registry.cn-beijing.cr.aliyuncs.com/modelscope-repo/python:3.10 AS base
ARG NODE_VERSION=22.12.0
ARG NODE_MIRROR=https://npmmirror.com/mirrors/node
RUN curl -fsSL "$NODE_MIRROR/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.gz" \
      | tar -xz -C /usr/local --strip-components=1 \
 && node --version && npm --version

FROM base AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --registry=https://registry.npmmirror.com --no-audit --no-fund
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS run
WORKDIR /home/user/app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=7860 HOSTNAME=0.0.0.0 \
    DATA_DIR=/mnt/workspace/showroom
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 7860
CMD ["sh", "-c", "mkdir -p \"$DATA_DIR\" 2>/dev/null || export DATA_DIR=/tmp/showroom; exec node server.js"]
