# Agent Pyramid Scheme (APS)

Agents delegating to agents — hand off implementation work to a sub-agent, keeping your main agent's context clean and your token costs down.

A layered agent architecture: the main agent (e.g. Claude Opus, Fable, the powerful and expensive models) handles planning and review, while well-scoped implementation tasks are delegated to a sub-agent (e.g. Qwen3-Coder, DeepSeek-V4, the inexpensive models). This keeps the main agent's context window focused and reduces token costs for repetitive implementation work.

## Usage

**Build:**

```bash
pnpm install
pnpm build
```

**MCP config:**

```json
{
  "mcpServers": {
    "agent-pyramid-scheme": {
      "type": "stdio",
      "command": "node",
      "args": [
        "/path/to/agent-pyramid-scheme/build/index.js",
        "--base-url", "http://localhost:11434/v1",
        "--model", "gemma4:26b",
        "--project-dir", "/path/to/your/project"
      ]
    }
  }
}
```

API key env: `AGENT_PYRAMID_SCHEME_LLM_API_KEY`

**Inspector:**

```bash
AGENT_PYRAMID_SCHEME_LLM_API_KEY="$OPENROUTER_API_KEY" pnpm inspector node build/index.js \
  --base-url "https://openrouter.ai/api/v1" \
  --model "nvidia/nemotron-3-super-120b-a12b:free" \
  --project-dir "/path/to/project/"
```

**Guide:**

Paste the contents of [USAGE.md](USAGE.md) into your `AGENTS.md` or `CLAUDE.md` to let the LLM know how to use APC.

## TODO

- [ ] Abort task feature
- [ ] WebUI
