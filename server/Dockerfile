# Build from the repo root so the npm workspace lockfile resolves:
#   docker build -f server/Dockerfile -t prompt-polish-server .
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY extension/package.json extension/
# Root install brings the shared typescript toolchain; the extension
# workspace is excluded — its build deps are irrelevant to the server image.
RUN npm ci --workspace @prompt-polish/server --include-workspace-root --ignore-scripts
COPY server/tsconfig.json server/
COPY server/src server/src
RUN npm run build --workspace @prompt-polish/server \
  && npm prune --omit=dev --ignore-scripts \
  && mkdir -p server/node_modules

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/server/node_modules server/node_modules
COPY --from=build /app/server/dist server/dist
COPY server/package.json server/
USER node
EXPOSE 8787
CMD ["node", "server/dist/index.js"]
