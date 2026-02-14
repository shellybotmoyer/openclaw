import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  discoverOllamaModels,
  normalizeProviders,
  resolveOllamaApiBase,
} from "./models-config.providers.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Save and restore env vars around each test. */
function envGuard(keys: string[]) {
  const saved = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of keys) {
      saved.set(key, process.env[key]);
      delete process.env[key];
    }
    // Enable discovery inside vitest
    process.env.OLLAMA_DISCOVERY_TEST = "1";
  });

  afterEach(() => {
    for (const [key, value] of saved) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    delete process.env.OLLAMA_DISCOVERY_TEST;
    vi.restoreAllMocks();
  });
}

// ---------------------------------------------------------------------------
// resolveOllamaApiBase
// ---------------------------------------------------------------------------

describe("resolveOllamaApiBase", () => {
  envGuard(["OLLAMA_API_BASE_URL", "OLLAMA_API_BASE", "OLLAMA_HOST"]);

  it("returns default localhost when no env vars are set", () => {
    expect(resolveOllamaApiBase()).toBe("http://127.0.0.1:11434");
  });

  it("uses configuredBaseUrl when provided", () => {
    process.env.OLLAMA_HOST = "https://should-not-use.com";
    expect(resolveOllamaApiBase("https://custom.example.com")).toBe("https://custom.example.com");
  });

  it("strips /v1 suffix from configuredBaseUrl", () => {
    expect(resolveOllamaApiBase("https://ollama.com/v1")).toBe("https://ollama.com");
  });

  it("strips /v1 suffix case-insensitively", () => {
    expect(resolveOllamaApiBase("https://ollama.com/V1")).toBe("https://ollama.com");
  });

  it("strips trailing slashes before /v1", () => {
    expect(resolveOllamaApiBase("https://ollama.com/v1/")).toBe("https://ollama.com");
  });

  it("reads OLLAMA_API_BASE_URL first", () => {
    process.env.OLLAMA_API_BASE_URL = "https://first.example.com/v1";
    process.env.OLLAMA_API_BASE = "https://second.example.com/v1";
    process.env.OLLAMA_HOST = "https://third.example.com";
    expect(resolveOllamaApiBase()).toBe("https://first.example.com");
  });

  it("falls back to OLLAMA_API_BASE", () => {
    process.env.OLLAMA_API_BASE = "https://second.example.com/v1";
    process.env.OLLAMA_HOST = "https://third.example.com";
    expect(resolveOllamaApiBase()).toBe("https://second.example.com");
  });

  it("falls back to OLLAMA_HOST", () => {
    process.env.OLLAMA_HOST = "https://ollama.com";
    expect(resolveOllamaApiBase()).toBe("https://ollama.com");
  });

  it("trims whitespace from env vars", () => {
    process.env.OLLAMA_HOST = "  https://ollama.com  ";
    expect(resolveOllamaApiBase()).toBe("https://ollama.com");
  });

  it("skips empty env vars", () => {
    process.env.OLLAMA_API_BASE_URL = "";
    process.env.OLLAMA_HOST = "https://fallback.com";
    // Empty string is falsy for ?.trim() ?? chain — falls through
    expect(resolveOllamaApiBase()).toBe("https://fallback.com");
  });
});

// ---------------------------------------------------------------------------
// discoverOllamaModels — with fetch mocking
// ---------------------------------------------------------------------------

describe("discoverOllamaModels", () => {
  envGuard(["OLLAMA_HOST", "OLLAMA_API_BASE_URL", "OLLAMA_API_BASE", "OPENCLAW_DEBUG"]);

  it("returns models from a successful /api/tags response", async () => {
    const mockModels = {
      models: [
        { name: "llama3:8b", modified_at: "2024-01-01T00:00:00Z", size: 1000, digest: "abc" },
        { name: "deepseek-r1:14b", modified_at: "2024-01-01T00:00:00Z", size: 2000, digest: "def" },
      ],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockModels), { status: 200 }),
    );

    const models = await discoverOllamaModels("http://test-ollama:11434");

    expect(models).toHaveLength(2);
    expect(models[0]).toMatchObject({
      id: "llama3:8b",
      name: "llama3:8b",
      reasoning: false,
      input: ["text"],
    });
    expect(models[1]).toMatchObject({
      id: "deepseek-r1:14b",
      reasoning: true, // contains "r1"
    });
  });

  it("passes Authorization header when apiKey is provided", async () => {
    const mockModels = { models: [{ name: "test-model", modified_at: "", size: 0, digest: "" }] };

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(mockModels), { status: 200 }));

    await discoverOllamaModels("http://test:11434", "my-secret-key");

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe("http://test:11434/api/tags");
    expect(opts?.headers).toMatchObject({ Authorization: "Bearer my-secret-key" });
  });

  it("does NOT pass Authorization header when apiKey is omitted", async () => {
    const mockModels = { models: [{ name: "test-model", modified_at: "", size: 0, digest: "" }] };

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(mockModels), { status: 200 }));

    await discoverOllamaModels("http://test:11434");

    const [, opts] = fetchSpy.mock.calls[0];
    expect(opts?.headers).toEqual({});
  });

  it("returns empty array on HTTP error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Unauthorized", { status: 401 }),
    );

    const models = await discoverOllamaModels("http://test:11434", "bad-key");
    expect(models).toEqual([]);
  });

  it("returns empty array when no models in response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ models: [] }), { status: 200 }),
    );

    const models = await discoverOllamaModels("http://test:11434");
    expect(models).toEqual([]);
  });

  it("returns empty array on network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const models = await discoverOllamaModels("http://unreachable:11434");
    expect(models).toEqual([]);
  });

  it("strips /v1 from baseUrl before calling /api/tags", async () => {
    const mockModels = { models: [{ name: "m1", modified_at: "", size: 0, digest: "" }] };

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(mockModels), { status: 200 }));

    await discoverOllamaModels("https://ollama.com/v1");

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://ollama.com/api/tags");
  });

  it("sets streaming: false and zero cost for all discovered models", async () => {
    const mockModels = {
      models: [{ name: "test-model", modified_at: "", size: 0, digest: "" }],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockModels), { status: 200 }),
    );

    const models = await discoverOllamaModels("http://test:11434");
    expect(models[0].params).toEqual({ streaming: false });
    expect(models[0].cost).toEqual({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
  });

  it("detects reasoning models by 'reasoning' in name", async () => {
    const mockModels = {
      models: [{ name: "phi-reasoning:14b", modified_at: "", size: 0, digest: "" }],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockModels), { status: 200 }),
    );

    const models = await discoverOllamaModels("http://test:11434");
    expect(models[0].reasoning).toBe(true);
  });

  it("does not warn on failure unless OPENCLAW_DEBUG is set", async () => {
    const warnSpy = vi.spyOn(console, "warn");
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("ECONNREFUSED"));

    await discoverOllamaModels("http://unreachable:11434");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("warns on failure when OPENCLAW_DEBUG is set", async () => {
    process.env.OPENCLAW_DEBUG = "1";
    const warnSpy = vi.spyOn(console, "warn");
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("ECONNREFUSED"));

    await discoverOllamaModels("http://unreachable:11434");
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain("[ollama]");
  });
});

// ---------------------------------------------------------------------------
// normalizeProviders — key normalization fix
// ---------------------------------------------------------------------------

describe("normalizeProviders — key trimming", () => {
  it("trims whitespace from provider keys", () => {
    const result = normalizeProviders({
      providers: {
        "  anthropic  ": {
          baseUrl: "https://api.anthropic.com",
          api: "anthropic-messages",
          models: [],
        },
      },
      authStore: { profiles: {} } as never,
    });

    expect(result).toHaveProperty("anthropic");
    expect(result).not.toHaveProperty("  anthropic  ");
  });

  it("preserves already-trimmed keys unchanged", () => {
    const providers = {
      openai: {
        baseUrl: "https://api.openai.com/v1",
        api: "openai-completions" as const,
        models: [],
      },
    };

    const result = normalizeProviders({
      providers,
      authStore: { profiles: {} } as never,
    });

    expect(result).toHaveProperty("openai");
  });
});
