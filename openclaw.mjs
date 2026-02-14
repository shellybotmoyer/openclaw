#!/usr/bin/env bun

import module from "node:module";

// https://nodejs.org/api/module.html#module-compile-cache
if (module.enableCompileCache && !process.env.NODE_DISABLE_COMPILE_CACHE) {
  try {
    module.enableCompileCache();
  } catch {
    // Ignore errors
  }
}

const isModuleNotFoundError = (err) =>
  err && typeof err === "object" && "code" in err && err.code === "ERR_MODULE_NOT_FOUND";

const installProcessWarningFilter = async () => {
  // Keep bootstrap warnings consistent with the TypeScript runtime.
  for (const specifier of ["./dist/warning-filter.js", "./dist/warning-filter.mjs"]) {
    try {
      const mod = await import(specifier);
      if (typeof mod.installProcessWarningFilter === "function") {
        mod.installProcessWarningFilter();
        return;
      }
    } catch (err) {
      if (isModuleNotFoundError(err)) {
        continue;
      }
      throw err;
    }
  }
};

await installProcessWarningFilter();

const tryImport = async (specifier) => {
  try {
    await import(specifier);
    return true;
  } catch (err) {
    // Only swallow missing-module errors; rethrow real runtime errors.
    if (isModuleNotFoundError(err)) {
      return false;
    }
    throw err;
  }
};

// Bun Direct-TS Mode: Check if OPENCLAW_BUN_DIRECT is set
const useDirectMode = process.env.OPENCLAW_BUN_DIRECT === "1";

if (useDirectMode) {
  // Direct mode: try TypeScript source files first
  if (await tryImport("./src/entry-bun.ts")) {
    // OK - Bun-native TypeScript entry
  } else if (await tryImport("./src/entry.ts")) {
    // OK - fallback entry
  } else if (await tryImport("./dist/entry.js")) {
    // OK - compiled fallback
  } else if (await tryImport("./dist/entry.mjs")) {
    // OK - compiled fallback
  } else {
    throw new Error(
      "openclaw: OPENCLAW_BUN_DIRECT=1 set but no TypeScript or compiled entry found.",
    );
  }
} else {
  // Standard mode: try compiled first, then source
  if (await tryImport("./dist/entry.js")) {
    // OK - standard compiled entry
  } else if (await tryImport("./dist/entry.mjs")) {
    // OK - compiled fallback
  } else if (await tryImport("./src/entry.ts")) {
    // OK - source fallback (for bun users without build)
  } else if (await tryImport("./src/entry-bun.ts")) {
    // OK - bun-native source entry
  } else {
    throw new Error("openclaw: missing dist/entry.(m)js (build output) or src/entry.ts (source).");
  }
}
