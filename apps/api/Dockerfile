FROM oven/bun:1-alpine
WORKDIR /app

# Copy workspace manifests first for layer caching
COPY package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Clean root package.json for Bun:
#   - Remove "packageManager" (pnpm-only)
#   - Remove "pnpm" config block (onlyBuiltDependencies)
#   - Narrow workspaces to only what the API needs (skip apps/web)
RUN apk add --no-cache jq && \
    jq 'del(.packageManager, .pnpm, .engines) | .workspaces = ["packages/*", "apps/api"]' package.json > package.tmp.json && \
    mv package.tmp.json package.json

# Install all workspace dependencies
RUN bun install

# Copy source
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

EXPOSE 3001

CMD ["bun", "run", "apps/api/src/index.ts"]
