FROM oven/bun:1-alpine
WORKDIR /app

# Copy workspace manifests first for layer caching
COPY package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Strip "packageManager" field so bun doesn't refuse to install in a pnpm-declared project
RUN sed -i '/"packageManager"/d' package.json

# Install all workspace dependencies
RUN bun install

# Copy source
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

EXPOSE 3001

CMD ["bun", "run", "apps/api/src/index.ts"]
