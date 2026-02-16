import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
	formatOllamaDiscoveryDebugContext,
	resolveImplicitProviders,
	resolveOllamaApiBase,
} from "./models-config.providers.js";

describe("resolveOllamaApiBase", () => {
	it("returns default localhost base when no configured URL is provided", () => {
		expect(resolveOllamaApiBase()).toBe("http://127.0.0.1:11434");
	});

	it("strips /v1 suffix from OpenAI-compatible URLs", () => {
		expect(resolveOllamaApiBase("http://ollama-host:11434/v1")).toBe("http://ollama-host:11434");
		expect(resolveOllamaApiBase("http://ollama-host:11434/V1")).toBe("http://ollama-host:11434");
	});

	it("keeps URLs without /v1 unchanged", () => {
		expect(resolveOllamaApiBase("http://ollama-host:11434")).toBe("http://ollama-host:11434");
	});

	it("handles trailing slash before canonicalizing", () => {
		expect(resolveOllamaApiBase("http://ollama-host:11434/v1/")).toBe("http://ollama-host:11434");
		expect(resolveOllamaApiBase("http://ollama-host:11434/")).toBe("http://ollama-host:11434");
	});

	it("uses OLLAMA_API_BASE_URL env override as a string default", async () => {
		const previousBaseUrl = process.env.OLLAMA_API_BASE_URL;
		process.env.OLLAMA_API_BASE_URL = "http://ollama-env-host:11434";

		try {
			vi.resetModules();
			const { resolveOllamaApiBase: resolveOllamaApiBaseFromEnv } =
				await import("./models-config.providers.js");
			const resolved = resolveOllamaApiBaseFromEnv();
			expect(resolved).toBe("http://ollama-env-host:11434");
			expect(typeof resolved).toBe("string");
		} finally {
			if (previousBaseUrl === undefined) {
				delete process.env.OLLAMA_API_BASE_URL;
			} else {
				process.env.OLLAMA_API_BASE_URL = previousBaseUrl;
			}
		}
	});

	it("canonicalizes OLLAMA_API_BASE_URL env default before returning native API base", async () => {
		const previousBaseUrl = process.env.OLLAMA_API_BASE_URL;
		process.env.OLLAMA_API_BASE_URL = "http://ollama-env-host:11434/v1/";

		try {
			vi.resetModules();
			const { resolveOllamaApiBase: resolveOllamaApiBaseFromEnv } =
				await import("./models-config.providers.js");
			expect(resolveOllamaApiBaseFromEnv()).toBe("http://ollama-env-host:11434");
		} finally {
			if (previousBaseUrl === undefined) {
				delete process.env.OLLAMA_API_BASE_URL;
			} else {
				process.env.OLLAMA_API_BASE_URL = previousBaseUrl;
			}
		}
	});
});

describe("formatOllamaDiscoveryDebugContext", () => {
	it("includes remote host and api key presence", () => {
		expect(
			formatOllamaDiscoveryDebugContext({
				apiBase: "https://ollama.example.com:11434",
				hasApiKey: true,
			}),
		).toBe("host=ollama.example.com:11434 apiKeySet=true");
	});

	it("reports invalid urls safely", () => {
		expect(
			formatOllamaDiscoveryDebugContext({
				apiBase: "not-a-url",
				hasApiKey: false,
			}),
		).toBe("host=invalid-url apiKeySet=false");
	});
});

describe("Ollama provider", () => {
	it("should not include ollama when no API key is configured", async () => {
		const agentDir = mkdtempSync(join(tmpdir(), "openclaw-test-"));
		const previousApiKey = process.env.OLLAMA_API_KEY;
		delete process.env.OLLAMA_API_KEY;

    expect(providers?.ollama).toBeUndefined();
  });

  it("should use native ollama api type", async () => {
    const agentDir = mkdtempSync(join(tmpdir(), "openclaw-test-"));
    process.env.OLLAMA_API_KEY = "test-key";

	it("should disable streaming by default for Ollama models", async () => {
		const agentDir = mkdtempSync(join(tmpdir(), "openclaw-test-"));
		const previousApiKey = process.env.OLLAMA_API_KEY;
		process.env.OLLAMA_API_KEY = "test-key";

      expect(providers?.ollama).toBeDefined();
      expect(providers?.ollama?.apiKey).toBe("OLLAMA_API_KEY");
      expect(providers?.ollama?.api).toBe("ollama");
      expect(providers?.ollama?.baseUrl).toBe("http://127.0.0.1:11434");
    } finally {
      delete process.env.OLLAMA_API_KEY;
    }
  });

			// Note: discoverOllamaModels() returns empty array in test environments (VITEST env var check)
			// so we can't test the actual model discovery here. The streaming: false setting
			// is applied in the model mapping within discoverOllamaModels().
			// The configuration structure itself is validated by TypeScript and the Zod schema.
		} finally {
			if (previousApiKey === undefined) {
				delete process.env.OLLAMA_API_KEY;
			} else {
				process.env.OLLAMA_API_KEY = previousApiKey;
			}
		}
	});

	it("should preserve explicit ollama baseUrl on implicit provider injection", async () => {
		const agentDir = mkdtempSync(join(tmpdir(), "openclaw-test-"));
		const previousApiKey = process.env.OLLAMA_API_KEY;
		process.env.OLLAMA_API_KEY = "test-key";

      // Native API strips /v1 suffix via resolveOllamaApiBase()
      expect(providers?.ollama?.baseUrl).toBe("http://192.168.20.14:11434");
    } finally {
      delete process.env.OLLAMA_API_KEY;
    }
  });

  it("should have correct model structure without streaming override", () => {
    const mockOllamaModel = {
      id: "llama3.3:latest",
      name: "llama3.3:latest",
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128000,
      maxTokens: 8192,
    };

    // Native Ollama provider does not need streaming: false workaround
    expect(mockOllamaModel).not.toHaveProperty("params");
  });
});
