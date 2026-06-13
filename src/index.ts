import { randomUUID } from "node:crypto";
import path from "node:path";
import process from "node:process";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { ProgressToken } from "@modelcontextprotocol/sdk/types.js";
import * as z from "zod";
import { type AgentConfig, runAgentLoop } from "./agent.js";

type ServerArgs = AgentConfig & { projectDir?: string };

type TaskStatus =
  | { status: "running" }
  | { status: "done"; result: string }
  | { status: "error"; error: string };

const taskRegistry = new Map<string, TaskStatus>();

function parseArgs(argv: string[]): ServerArgs {
  const args = argv.slice(2);
  let baseUrl = "http://localhost:11434/v1";
  let model = "gemma4:26b";
  let projectDir: string | undefined;
  let apiKey: string | undefined = process.env.AGENT_PYRAMID_SCHEME_LLM_API_KEY;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--base-url" && args[i + 1]) baseUrl = args[++i];
    if (args[i] === "--model" && args[i + 1]) model = args[++i];
    if (args[i] === "--project-dir" && args[i + 1]) projectDir = args[++i];
    if (args[i] === "--api-key" && args[i + 1]) apiKey = args[++i];
  }

  return { baseUrl, model, projectDir, apiKey };
}

const { projectDir, ...agentConfig } = parseArgs(process.argv);
const server = new McpServer({
  name: "agent-pyramid-scheme",
  version: "0.1.0",
});

server.registerTool(
  "delegate_task",
  {
    description:
      "Delegate any self-contained task to the sub-agent. " +
      "The agent can read/write files and execute bash commands. " +
      "Suitable for implementation, investigation, research, code review, or any other well-scoped work. " +
      "Provide a clear, detailed task description including relevant file paths and acceptance criteria. " +
      "Set async=true to return a task_id immediately and poll with get_task_result; omit for synchronous execution.",
    inputSchema: {
      task_desc: z
        .string()
        .describe(
          "Detailed description of what the sub-agent should do, including relevant context, file paths, and expected outcome",
        ),
      working_dir: z
        .string()
        .optional()
        .describe(
          "Working directory for the task; resolved relative to --project-dir when set",
        ),
      async: z
        .boolean()
        .optional()
        .describe(
          "If true, return a task_id immediately without waiting for completion. Use get_task_result to poll for the result.",
        ),
    },
  },
  async ({ task_desc, working_dir, async: isAsync }, extra) => {
    const resolvedDir = projectDir
      ? path.resolve(projectDir, working_dir ?? ".")
      : working_dir;

    const fullTask = resolvedDir
      ? `Project root / working directory: ${resolvedDir}\n\n${task_desc}`
      : task_desc;

    if (isAsync) {
      const taskId = randomUUID();
      taskRegistry.set(taskId, { status: "running" });

      runAgentLoop(agentConfig, fullTask, undefined, resolvedDir)
        .then((result) => {
          taskRegistry.set(taskId, { status: "done", result });
        })
        .catch((err: unknown) => {
          taskRegistry.set(taskId, {
            status: "error",
            error: (err as Error).message,
          });
        });

      return { content: [{ type: "text", text: taskId }] };
    }

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
      const result = await runAgentLoop(
        agentConfig,
        fullTask,
        onProgress,
        resolvedDir,
      );
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

server.registerTool(
  "get_task_result",
  {
    description:
      "Check the status of an async task started by delegate_task with async=true. " +
      "Returns the status ('running', 'done', or 'error') and the result when done.",
    inputSchema: {
      task_id: z.string().describe("The task ID returned by delegate_task"),
    },
  },
  async ({ task_id }) => {
    const task = taskRegistry.get(task_id);
    if (!task) {
      // Return task id list for hint?
      return {
        content: [{ type: "text", text: `Unknown task ID: ${task_id}` }],
        isError: true,
      };
    }

    if (task.status === "running") {
      return { content: [{ type: "text", text: '{"status":"running"}' }] };
    }
    if (task.status === "done") {
      taskRegistry.delete(task_id);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ status: "done", result: task.result }),
          },
        ],
      };
    }
    taskRegistry.delete(task_id);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ status: "error", error: task.error }),
        },
      ],
      isError: true,
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP server running...");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
