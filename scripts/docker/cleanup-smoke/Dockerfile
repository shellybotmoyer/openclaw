FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    git \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /repo
COPY package.json bun.lock ./
RUN curl -fsSL https://bun.sh/install | bash \
  && cp /root/.bun/bin/bun /usr/local/bin/bun \
  && bun install --frozen-lockfile

COPY . .
COPY scripts/docker/cleanup-smoke/run.sh /usr/local/bin/openclaw-cleanup-smoke
RUN chmod +x /usr/local/bin/openclaw-cleanup-smoke

ENTRYPOINT ["/usr/local/bin/openclaw-cleanup-smoke"]
