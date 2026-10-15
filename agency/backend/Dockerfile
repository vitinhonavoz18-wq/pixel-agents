# PIXEL AGENCY backend — build from the repository root:
#   docker build -f agency/backend/Dockerfile -t pixel-agency-backend .
FROM node:22-bookworm-slim AS build
WORKDIR /repo
COPY core ./core
COPY server/src ./server/src
COPY agency/package.json agency/package-lock.json agency/tsconfig.base.json ./agency/
COPY agency/shared ./agency/shared
COPY agency/backend ./agency/backend
COPY agency/desktop-bridge/package.json ./agency/desktop-bridge/package.json
WORKDIR /repo/agency
RUN npm ci --workspace backend --include-workspace-root=false --ignore-scripts \
 && npm run build -w backend

FROM node:22-bookworm-slim
# git: per-mission clones. chromium (optional) enables AGENCY_ENABLE_CAPTURE.
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates tini \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --create-home --uid 10001 agency
WORKDIR /app
COPY --from=build /repo/agency/node_modules ./node_modules
COPY --from=build /repo/agency/backend/dist ./dist
COPY agency/backend/package.json ./package.json
ENV NODE_ENV=production AGENCY_DATA_DIR=/data PORT=8787
RUN mkdir -p /data && chown agency:agency /data
USER agency
VOLUME ["/data"]
EXPOSE 8787
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/server.js"]
