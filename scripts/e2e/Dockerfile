FROM node:22-bookworm

RUN curl -fsSL https://bun.sh/install | bash \
  && cp /root/.bun/bin/bun /usr/local/bin/bun

WORKDIR /app

ENV NODE_OPTIONS="--disable-warning=ExperimentalWarning"

COPY package.json bun.lock tsconfig.json tsconfig.plugin-sdk.dts.json tsdown.config.ts vitest.config.ts vitest.e2e.config.ts openclaw.mjs ./
COPY src ./src
COPY test ./test
COPY scripts ./scripts
COPY docs ./docs
COPY skills ./skills
COPY patches ./patches
COPY ui ./ui
COPY extensions/memory-core ./extensions/memory-core
COPY vendor/a2ui/renderers/lit ./vendor/a2ui/renderers/lit
COPY apps/shared/OpenClawKit/Tools/CanvasA2UI ./apps/shared/OpenClawKit/Tools/CanvasA2UI

RUN bun install --frozen-lockfile
RUN bun run build
RUN bun run ui:build

CMD ["bash"]
