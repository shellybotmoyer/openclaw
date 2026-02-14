# Ollama Cloud Integration Notes

Development notes for the Ollama Cloud provider integration in OpenClaw.

## Architecture

### Provider Discovery Flow

```
CLI/Gateway startup
  -> ensureOpenClawModelsJson(cfg)
    -> resolveImplicitProviders(cfg, authStore)
      -> Check for OLLAMA_API_KEY env var or auth-profiles.json entry
      -> If found: buildOllamaProvider(baseUrl, apiKey)
        -> discoverOllamaModels(baseUrl, apiKey)
          -> fetch("${apiBase}/api/tags", { Authorization: Bearer })
          -> Parse response into ModelDefinitionConfig[]
        -> Return ProviderConfig { baseUrl, api: "openai-completions", models }
    -> mergeProviders(implicit, explicit)
    -> normalizeProviders()
    -> Write to ~/.openclaw/agents/main/agent/models.json
```

### Key Files

| File                                     | Purpose                                                                                                   |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `src/agents/models-config.providers.ts`  | `resolveOllamaApiBase()`, `discoverOllamaModels()`, `buildOllamaProvider()`, `resolveImplicitProviders()` |
| `src/agents/models-config.ts`            | `ensureOpenClawModelsJson()` — writes models.json                                                         |
| `src/agents/model-auth.ts`               | `resolveEnvApiKey()` — API key resolution from env/auth store                                             |
| `src/agents/model-selection.ts`          | `resolveConfiguredModelRef()`, `resolveDefaultModelForAgent()`                                            |
| `src/agents/model-fallback.ts`           | Runtime fallback when primary model fails                                                                 |
| `src/agents/pi-embedded-runner/model.ts` | "Unknown model" error source (ModelRegistry.find fails)                                                   |
| `src/agents/ollama-discovery.test.ts`    | 23-test suite for Ollama discovery                                                                        |

### URL Resolution (`resolveOllamaApiBase`)

Priority chain (first non-empty wins):

1. `configuredBaseUrl` parameter
2. `process.env.OLLAMA_API_BASE_URL`
3. `process.env.OLLAMA_API_BASE`
4. `process.env.OLLAMA_HOST`
5. Default: `http://127.0.0.1:11434`

All values are trimmed. Trailing `/v1` is stripped (case-insensitive).

**Important:** Uses `||` not `??` to skip empty strings.

### API Key Resolution

For Ollama, the API key is resolved from:

1. `OLLAMA_API_KEY` environment variable
2. `ollama:default` entry in `auth-profiles.json`

The key is sent as `Authorization: Bearer <key>` in both discovery and inference requests.

### models.json Structure (Ollama provider)

```json
{
  "providers": {
    "ollama": {
      "baseUrl": "https://ollama.com/v1",
      "api": "openai-completions",
      "apiKey": "ollama:default",
      "models": [
        {
          "id": "minimax-m2.5",
          "name": "minimax-m2.5",
          "reasoning": false,
          "input": ["text"],
          "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
          "contextWindow": 128000,
          "maxTokens": 4096,
          "params": { "streaming": false }
        }
      ]
    }
  }
}
```

### Discovery Endpoint

- URL: `${apiBase}/api/tags` (note: `/v1` is stripped before appending `/api/tags`)
- Method: GET
- Auth: `Authorization: Bearer <apiKey>` (required for Ollama Cloud)
- Timeout: 5 seconds
- Response: `{ models: [{ name, modified_at, size, digest }] }`

### Reasoning Detection

Models are marked as `reasoning: true` if their name contains:

- `r1`
- `reasoning`

### Streaming

Disabled by default (`params.streaming: false`) due to pi-coding-agent SDK issue #1205.

## Deployment Requirements

### Gateway Service (systemd)

The gateway service needs access to Ollama env vars for URL resolution:

```ini
EnvironmentFile=/home/cmoyer/.env
```

Without this, `resolveOllamaApiBase()` falls back to localhost and discovery fails silently.

### Auth Profiles

API key must be in `~/.openclaw/agents/main/agent/auth-profiles.json`:

```json
"ollama:default": {
  "type": "api_key",
  "provider": "ollama",
  "key": "<OLLAMA_API_KEY>"
}
```

### Regenerating models.json

After changing env vars or auth:

```bash
dotenv -e ~/.env openclaw models list --all --provider ollama --plain
```

## Testing

Test file: `src/agents/ollama-discovery.test.ts`

Tests use `OLLAMA_DISCOVERY_TEST=1` env var to bypass the `VITEST` skip guard.
Tests mock `globalThis.fetch` via `vi.spyOn`.

Run: `bun run test src/agents/ollama-discovery.test.ts`

## Known Issues / Gotchas

1. **Silent failure:** Discovery returns `[]` on any error (network, HTTP, parse). Enable `OPENCLAW_DEBUG=1` to see warnings.
2. **Cooldown:** If Ollama Cloud returns HTTP 500, the auth profile goes into cooldown and all subsequent requests fall back until cooldown expires.
3. **models.json staleness:** If env vars change but no CLI command is run, models.json keeps the old data. Gateway restart alone doesn't regenerate it — need to run an `openclaw models` command with the correct env vars.
4. **5s timeout:** Discovery has a 5-second timeout. Slow Ollama instances may time out, resulting in 0 models.
