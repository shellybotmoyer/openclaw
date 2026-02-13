#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if ! command -v bun >/dev/null 2>&1; then
	echo "bun is required but was not found in PATH."
	echo "Install Bun first: https://bun.sh"
	exit 1
fi

exec bun scripts/deploy.ts "$@"
