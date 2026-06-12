import path from "node:path";
import process from "node:process";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { ProgressToken } from "@modelcontextprotocol/sdk/types.js";
import * as z from "zod";
import { type AgentConfig, runAgentLoop } from "./agent.js";

type ServerArgs = AgentConfig & { projectDir?: string };

function parseArgs(argv: string[]): ServerArgs {
  const args = argv.slice(2);
  let baseUrl = "http://localhost:11434/v1";
  let model = "gemma4:26b";
  let projectDir: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--base-url" && args[i + 1]) baseUrl = args[++i];
    if (args[i] === "--model" && args[i + 1]) model = args[++i];
    if (args[i] === "--project-dir" && args[i + 1]) projectDir = args[++i];
  }

  return { baseUrl, model, projectDir };
}

const { projectDir, ...agentConfig } = parseArgs(process.argv);
const server = new McpServer({
  name: "agent-pyramid-scheme",
  version: "0.1.0",
});

server.registerTool(
  "implement_task",
  {
    description:
      "Delegate a self-contained coding task to the local sub-agent. " +
      "The agent can read/write files and execute bash commands. " +
      "Provide a clear, detailed task description including file paths, interfaces, and acceptance criteria.",
    inputSchema: {
      task_desc: z
        .string()
        .describe(
          "Detailed description of exactly what to implement, including file paths and expected behaviour",
        ),
      working_dir: z
        .string()
        .optional()
        .describe(
          "Working directory for the task; resolved relative to --project-dir when set",
        ),
    },
  },
  async ({ task_desc, working_dir }, extra) => {
    const resolvedDir = projectDir
      ? path.resolve(projectDir, working_dir ?? ".")
      : working_dir;

    const fullTask = resolvedDir
      ? `Project root / working directory: ${resolvedDir}\n\n${task_desc}`
      : task_desc;

    const progressToken: ProgressToken | undefined = extra._meta?.progressToken;

    const onProgress =
      progressToken !== undefined
        ? async (progress: number, total: number, message: string) => {
            await extra.sendNotification({
              method: "notifications/progress",
              params: { progressToken, progress, total, message },
            });
          }
        : undefined;

    try {
      const result = await runAgentLoop(agentConfig, fullTask, onProgress);
      return { content: [{ type: "text", text: result }] };
    } catch (err) {
      return {
        content: [
          { type: "text", text: `Agent error: ${(err as Error).message}` },
        ],
        isError: true,
      };
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  const dirInfo = projectDir ? ` project: ${projectDir}` : "";
  console.error(
    `MCP server running — model: ${agentConfig.model} @ ${agentConfig.baseUrl}${dirInfo}`,
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
