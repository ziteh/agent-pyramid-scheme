# Agent Pyramid Scheme

Let agents drive agents, assign simple yet tedious one-off tasks to sub-agents.

## Usage

Build:

```bash
pnpm install
pnpm build
```

MCP config:

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

## TODO

- [ ] Async task mode: Add a non-blocking mode for `implement_task`, return a task ID immediately.
