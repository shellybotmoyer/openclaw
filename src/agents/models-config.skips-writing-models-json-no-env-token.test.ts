import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { withTempHome as withTempHomeBase } from "../../test/helpers/temp-home.js";

async function withTempHome<T>(fn: (home: string) => Promise<T>): Promise<T> {
	return withTempHomeBase(fn, { prefix: "openclaw-models-" });
}

const IMPLICIT_PROVIDER_ENV_VARS = [
	"COPILOT_GITHUB_TOKEN",
	"GH_TOKEN",
	"GITHUB_TOKEN",
	"ANTHROPIC_OAUTH_TOKEN",
	"ANTHROPIC_API_KEY",
	"CHUTES_OAUTH_TOKEN",
	"CHUTES_API_KEY",
	"ZAI_API_KEY",
	"Z_AI_API_KEY",
	"OPENCODE_API_KEY",
	"OPENCODE_ZEN_API_KEY",
	"QWEN_OAUTH_TOKEN",
	"QWEN_PORTAL_API_KEY",
	"MINIMAX_OAUTH_TOKEN",
	"MINIMAX_API_KEY",
	"KIMI_API_KEY",
	"KIMICODE_API_KEY",
	"OPENAI_API_KEY",
	"GEMINI_API_KEY",
	"VOYAGE_API_KEY",
	"GROQ_API_KEY",
	"DEEPGRAM_API_KEY",
	"CEREBRAS_API_KEY",
	"XAI_API_KEY",
	"OPENROUTER_API_KEY",
	"LITELLM_API_KEY",
	"AI_GATEWAY_API_KEY",
	"CLOUDFLARE_AI_GATEWAY_API_KEY",
	"MOONSHOT_API_KEY",
	"XIAOMI_API_KEY",
	"SYNTHETIC_API_KEY",
	"VENICE_API_KEY",
	"MISTRAL_API_KEY",
	"TOGETHER_API_KEY",
	"QIANFAN_API_KEY",
	"OLLAMA_API_KEY",
	"AWS_BEARER_TOKEN_BEDROCK",
	"AWS_ACCESS_KEY_ID",
	"AWS_SECRET_ACCESS_KEY",
	"AWS_PROFILE",
	"AWS_REGION",
	"AWS_DEFAULT_REGION",
] as const;

const MODELS_CONFIG: OpenClawConfig = {
	models: {
		providers: {
			"custom-proxy": {
				baseUrl: "http://localhost:4000/v1",
				apiKey: "TEST_KEY",
				api: "openai-completions",
				models: [
					{
						id: "llama-3.1-8b",
						name: "Llama 3.1 8B (Proxy)",
						api: "openai-completions",
						reasoning: false,
						input: ["text"],
						cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
						contextWindow: 128000,
						maxTokens: 32000,
					},
				],
			},
		},
	},
};

describe("models-config", () => {
	let previousHome: string | undefined;

	beforeEach(() => {
		previousHome = process.env.HOME;
	});

	afterEach(() => {
		process.env.HOME = previousHome;
	});

	it("skips writing models.json when no env token or profile exists", async () => {
		await withTempHome(async (home) => {
			const previousEnv: Partial<Record<(typeof IMPLICIT_PROVIDER_ENV_VARS)[number], string>> =
				{};
			for (const envVar of IMPLICIT_PROVIDER_ENV_VARS) {
				previousEnv[envVar] = process.env[envVar];
				delete process.env[envVar];
			}

			try {
				vi.resetModules();
				const { ensureOpenClawModelsJson } = await import("./models-config.js");

				const agentDir = path.join(home, "agent-empty");
				const result = await ensureOpenClawModelsJson(
					{
						models: { providers: {} },
					},
					agentDir,
				);

				await expect(fs.stat(path.join(agentDir, "models.json"))).rejects.toThrow();
				expect(result.wrote).toBe(false);
			} finally {
				for (const envVar of IMPLICIT_PROVIDER_ENV_VARS) {
					const previous = previousEnv[envVar];
					if (previous === undefined) {
						delete process.env[envVar];
					} else {
						process.env[envVar] = previous;
					}
				}
			}
		});
	});
	it("writes models.json for configured providers", async () => {
		await withTempHome(async () => {
			vi.resetModules();
			const { ensureOpenClawModelsJson } = await import("./models-config.js");
			const { resolveOpenClawAgentDir } = await import("./agent-paths.js");

			await ensureOpenClawModelsJson(MODELS_CONFIG);

			const modelPath = path.join(resolveOpenClawAgentDir(), "models.json");
			const raw = await fs.readFile(modelPath, "utf8");
			const parsed = JSON.parse(raw) as {
				providers: Record<string, { baseUrl?: string }>;
			};

			expect(parsed.providers["custom-proxy"]?.baseUrl).toBe("http://localhost:4000/v1");
		});
	});
	it("adds minimax provider when MINIMAX_API_KEY is set", async () => {
		await withTempHome(async () => {
			vi.resetModules();
			const prevKey = process.env.MINIMAX_API_KEY;
			process.env.MINIMAX_API_KEY = "sk-minimax-test";
			try {
				const { ensureOpenClawModelsJson } = await import("./models-config.js");
				const { resolveOpenClawAgentDir } = await import("./agent-paths.js");

				await ensureOpenClawModelsJson({});

				const modelPath = path.join(resolveOpenClawAgentDir(), "models.json");
				const raw = await fs.readFile(modelPath, "utf8");
				const parsed = JSON.parse(raw) as {
					providers: Record<
						string,
						{
							baseUrl?: string;
							apiKey?: string;
							models?: Array<{ id: string }>;
						}
					>;
				};
				expect(parsed.providers.minimax?.baseUrl).toBe("https://api.minimax.chat/v1");
				expect(parsed.providers.minimax?.apiKey).toBe("MINIMAX_API_KEY");
				const ids = parsed.providers.minimax?.models?.map((model) => model.id);
				expect(ids).toContain("MiniMax-M2.1");
				expect(ids).toContain("MiniMax-VL-01");
			} finally {
				if (prevKey === undefined) {
					delete process.env.MINIMAX_API_KEY;
				} else {
					process.env.MINIMAX_API_KEY = prevKey;
				}
			}
		});
	});
	it("adds synthetic provider when SYNTHETIC_API_KEY is set", async () => {
		await withTempHome(async () => {
			vi.resetModules();
			const prevKey = process.env.SYNTHETIC_API_KEY;
			process.env.SYNTHETIC_API_KEY = "sk-synthetic-test";
			try {
				const { ensureOpenClawModelsJson } = await import("./models-config.js");
				const { resolveOpenClawAgentDir } = await import("./agent-paths.js");

				await ensureOpenClawModelsJson({});

				const modelPath = path.join(resolveOpenClawAgentDir(), "models.json");
				const raw = await fs.readFile(modelPath, "utf8");
				const parsed = JSON.parse(raw) as {
					providers: Record<
						string,
						{
							baseUrl?: string;
							apiKey?: string;
							models?: Array<{ id: string }>;
						}
					>;
				};
				expect(parsed.providers.synthetic?.baseUrl).toBe("https://api.synthetic.new/anthropic");
				expect(parsed.providers.synthetic?.apiKey).toBe("SYNTHETIC_API_KEY");
				const ids = parsed.providers.synthetic?.models?.map((model) => model.id);
				expect(ids).toContain("hf:MiniMaxAI/MiniMax-M2.1");
			} finally {
				if (prevKey === undefined) {
					delete process.env.SYNTHETIC_API_KEY;
				} else {
					process.env.SYNTHETIC_API_KEY = prevKey;
				}
			}
		});
	});
});
