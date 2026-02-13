# OpenClaw Codebase Patterns

**Always reuse existing code - no redundancy!**

## Tech Stack

- **Runtime**: Bun 1.3+ (Node 22+ still supported where needed)
- **Language**: TypeScript (ESM, strict mode)
- **Package Manager**: Bun (keep `bun.lock` in sync)
- **Lint/Format**: Oxlint, Oxfmt (`bun run check`)
- **Tests**: Vitest with V8 coverage
- **CLI Framework**: Commander + clack/prompts
- **Build**: tsdown (outputs to `dist/`)

## Anti-Redundancy Rules

- Avoid files that just re-export from another file. Import directly from the original source.
- If a function already exists, import it - do NOT create a duplicate in another file.
- Before creating any formatter, utility, or helper, search for existing implementations first.

## Source of Truth Locations

### Formatting Utilities (`src/infra/`)

- **Time formatting**: `src\infra\format-time`

**NEVER create local `formatAge`, `formatDuration`, `formatElapsedTime` functions - import from centralized modules.**

### Terminal Output (`src/terminal/`)

- Tables: `src/terminal/table.ts` (`renderTable`)
- Themes/colors: `src/terminal/theme.ts` (`theme.success`, `theme.muted`, etc.)
- Progress: `src/cli/progress.ts` (spinners, progress bars)

### CLI Patterns

- CLI option wiring: `src/cli/`
- Commands: `src/commands/`
- Dependency injection via `createDefaultDeps`

## Import Conventions

- Use `.js` extension for cross-package imports (ESM)
- Direct imports only - no re-export wrapper files
- Types: `import type { X }` for type-only imports

## Code Quality

- TypeScript (ESM), strict typing, avoid `any`
- Keep files under ~700 LOC - extract helpers when larger
- Colocated tests: `*.test.ts` next to source files
- Run `bun run check` before commits (lint + format)
- Run `bun run tsgo` for type checking

## Stack & Commands

- **Package manager**: bun (`bun install`)
- **Dev**: `bun run openclaw ...` or `bun run dev`
- **Type-check**: `bun run tsgo`
- **Lint/format**: `bun run check`
- **Tests**: `bun run test`
- **Build**: `bun run build`

If you are coding together with a human, do NOT use scripts/committer, but git directly and run the above commands manually to ensure quality.
