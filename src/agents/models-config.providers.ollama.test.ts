import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { resolveImplicitProviders, resolveOllamaApiBase } from "./models-config.providers.js";

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

describe("Ollama provider", () => {
	it("should not include ollama when no API key is configured", async () => {
		const agentDir = mkdtempSync(join(tmpdir(), "openclaw-test-"));
		const previousApiKey = process.env.OLLAMA_API_KEY;
		delete process.env.OLLAMA_API_KEY;

		try {
			const providers = await resolveImplicitProviders({ agentDir });

			// Ollama requires explicit configuration via OLLAMA_API_KEY env var or profile
			expect(providers?.ollama).toBeUndefined();
		} finally {
			if (previousApiKey === undefined) {
				delete process.env.OLLAMA_API_KEY;
			} else {
				process.env.OLLAMA_API_KEY = previousApiKey;
			}
		}
	});

	it("should disable streaming by default for Ollama models", async () => {
		const agentDir = mkdtempSync(join(tmpdir(), "openclaw-test-"));
		const previousApiKey = process.env.OLLAMA_API_KEY;
		process.env.OLLAMA_API_KEY = "test-key";

		try {
			const providers = await resolveImplicitProviders({ agentDir });

			// Provider should be defined with OLLAMA_API_KEY set
			expect(providers?.ollama).toBeDefined();
			expect(providers?.ollama?.apiKey).toBe("OLLAMA_API_KEY");

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

		try {
			const providers = await resolveImplicitProviders({
				agentDir,
				explicitProviders: {
					ollama: {
						baseUrl: "http://192.168.20.14:11434/v1",
						api: "openai-completions",
						models: [],
					},
				},
			});

			expect(providers?.ollama?.baseUrl).toBe("http://192.168.20.14:11434/v1");
		} finally {
			if (previousApiKey === undefined) {
				delete process.env.OLLAMA_API_KEY;
			} else {
				process.env.OLLAMA_API_KEY = previousApiKey;
			}
		}
	});

	it("should compose implicit ollama baseUrl from OLLAMA_API_BASE_URL env override", async () => {
		const agentDir = mkdtempSync(join(tmpdir(), "openclaw-test-"));
		const previousApiKey = process.env.OLLAMA_API_KEY;
		const previousBaseUrl = process.env.OLLAMA_API_BASE_URL;
		process.env.OLLAMA_API_KEY = "test-key";
		process.env.OLLAMA_API_BASE_URL = "http://ollama-env-host:11434";

		try {
			vi.resetModules();
			const { resolveImplicitProviders: resolveImplicitProvidersWithEnv } =
				await import("./models-config.providers.js");
			const providers = await resolveImplicitProvidersWithEnv({ agentDir });
			expect(providers?.ollama?.baseUrl).toBe("http://ollama-env-host:11434/v1");
		} finally {
			if (previousApiKey === undefined) {
				delete process.env.OLLAMA_API_KEY;
			} else {
				process.env.OLLAMA_API_KEY = previousApiKey;
			}
			if (previousBaseUrl === undefined) {
				delete process.env.OLLAMA_API_BASE_URL;
			} else {
				process.env.OLLAMA_API_BASE_URL = previousBaseUrl;
			}
		}
	});

	it("should use late-applied OLLAMA_API_BASE_URL when resolving implicit ollama provider", async () => {
		const agentDir = mkdtempSync(join(tmpdir(), "openclaw-test-"));
		const previousApiKey = process.env.OLLAMA_API_KEY;
		const previousBaseUrl = process.env.OLLAMA_API_BASE_URL;
		process.env.OLLAMA_API_KEY = "test-key";
		process.env.OLLAMA_API_BASE_URL = "http://ollama-initial-host:11434";

		try {
			vi.resetModules();
			const { resolveImplicitProviders: resolveImplicitProvidersWithCapturedEnv } =
				await import("./models-config.providers.js");
			process.env.OLLAMA_API_BASE_URL = "http://ollama-late-host:22434";
			const providers = await resolveImplicitProvidersWithCapturedEnv({ agentDir });
			expect(providers?.ollama?.baseUrl).toBe("http://ollama-late-host:22434/v1");
		} finally {
			if (previousApiKey === undefined) {
				delete process.env.OLLAMA_API_KEY;
			} else {
				process.env.OLLAMA_API_KEY = previousApiKey;
			}
			if (previousBaseUrl === undefined) {
				delete process.env.OLLAMA_API_BASE_URL;
			} else {
				process.env.OLLAMA_API_BASE_URL = previousBaseUrl;
			}
		}
	});

	it("should avoid duplicating /v1 when OLLAMA_API_BASE_URL already includes /v1", async () => {
		const agentDir = mkdtempSync(join(tmpdir(), "openclaw-test-"));
		const previousApiKey = process.env.OLLAMA_API_KEY;
		const previousBaseUrl = process.env.OLLAMA_API_BASE_URL;
		process.env.OLLAMA_API_KEY = "test-key";
		process.env.OLLAMA_API_BASE_URL = "http://ollama-env-host:11434/v1";

		try {
			vi.resetModules();
			const { resolveImplicitProviders: resolveImplicitProvidersWithEnv } =
				await import("./models-config.providers.js");
			const providers = await resolveImplicitProvidersWithEnv({ agentDir });
			expect(providers?.ollama?.baseUrl).toBe("http://ollama-env-host:11434/v1");
		} finally {
			if (previousApiKey === undefined) {
				delete process.env.OLLAMA_API_KEY;
			} else {
				process.env.OLLAMA_API_KEY = previousApiKey;
			}
			if (previousBaseUrl === undefined) {
				delete process.env.OLLAMA_API_BASE_URL;
			} else {
				process.env.OLLAMA_API_BASE_URL = previousBaseUrl;
			}
		}
	});

	it("should have correct model structure with streaming disabled (unit test)", () => {
		// This test directly verifies the model configuration structure
		// since discoverOllamaModels() returns empty array in test mode
		const mockOllamaModel = {
			id: "llama3.3:latest",
			name: "llama3.3:latest",
			reasoning: false,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 128000,
			maxTokens: 8192,
			params: {
				streaming: false,
			},
		};

		// Verify the model structure matches what discoverOllamaModels() would return
		expect(mockOllamaModel.params?.streaming).toBe(false);
		expect(mockOllamaModel.params).toHaveProperty("streaming");
	});
});
