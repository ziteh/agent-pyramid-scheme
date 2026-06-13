import { exec } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);

const BASH_TIMEOUT_MS = 60_000;
const MAX_OUTPUT_CHARS = 8_000;

enum Tools {
  ReadFile = "read_file",
  WriteFile = "write_file",
  ExecuteBash = "execute_bash",
  TaskComplete = "task_complete",
}

export const AGENT_TOOLS = [
  {
    type: "function",
    function: {
      name: Tools.ReadFile,
      description: "Read the content of a file at the given path.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Absolute or relative file path",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: Tools.WriteFile,
      description:
        "Write content to a file, creating parent directories as needed.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path to write" },
          content: { type: "string", description: "File content" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: Tools.ExecuteBash,
      description: "Execute a bash command. Returns stdout and stderr.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Bash command to run" },
          cwd: { type: "string", description: "Optional working directory" },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: Tools.TaskComplete,
      description:
        "Signal that the task is fully implemented and verified. Call this when done.",
      parameters: {
        type: "object",
        properties: {
          summary: {
            type: "string",
            description:
              "Summary of what was implemented: files created, how to build/run, any caveats.",
          },
        },
        required: ["summary"],
      },
    },
  },
];

function truncate(s: string): string {
  if (s.length <= MAX_OUTPUT_CHARS) return s;
  const half = MAX_OUTPUT_CHARS / 2;
  return `${s.slice(0, half)}\n…[truncated ${s.length - MAX_OUTPUT_CHARS} chars]…\n${s.slice(-half)}`;
}

// Basic defense, could be bypassed
const BLOCKED_PATTERNS = [
  /rm\s+-rf\s+\//,
  /curl[^|]+\|\s*(?:bash|sh)/,
  /wget[^|]+\|\s*(?:bash|sh)/,
  /\/etc\//,
  /~\/\.ssh/,
  /\$HOME\/\.ssh/,
];

function isBlockedCommand(command: string): boolean {
  return BLOCKED_PATTERNS.some((p) => p.test(command));
}

function safeCwd(
  requestedCwd: string | undefined,
  projectDir: string | undefined,
): string | undefined {
  if (!projectDir) return requestedCwd;

  const resolved = path.resolve(projectDir, requestedCwd ?? ".");
  // Reject paths that escape the project root
  if (!resolved.startsWith(projectDir + path.sep) && resolved !== projectDir) {
    return projectDir;
  }
  return resolved;
}

export async function runTool(
  name: string,
  args: Record<string, string>,
  projectDir?: string,
): Promise<string> {
  switch (name) {
    case Tools.ReadFile: {
      try {
        return truncate(await fs.readFile(args.path, "utf-8"));
      } catch (err) {
        return `Error reading ${args.path}: ${(err as Error).message}`;
      }
    }

    case Tools.WriteFile: {
      try {
        await fs.mkdir(path.dirname(path.resolve(args.path)), {
          recursive: true,
        });
        await fs.writeFile(args.path, args.content, "utf-8");
        return `Written: ${args.path} (${Buffer.byteLength(args.content, "utf-8")} bytes)`;
      } catch (err) {
        return `Error writing ${args.path}: ${(err as Error).message}`;
      }
    }

    case Tools.ExecuteBash: {
      if (isBlockedCommand(args.command)) {
        return "Dangerous operations prohibited";
      }
      try {
        const { stdout, stderr } = await execAsync(args.command, {
          timeout: BASH_TIMEOUT_MS,
          cwd: safeCwd(args.cwd, projectDir),
          shell: "/bin/bash",
        });
        const parts: string[] = [];
        if (stdout) parts.push(`stdout:\n${stdout}`);
        if (stderr) parts.push(`stderr:\n${stderr}`);
        return truncate(parts.join("\n") || "(no output)");
      } catch (err: unknown) {
        const e = err as { message: string; stdout?: string; stderr?: string };
        return truncate(
          `Exit error: ${e.message}\nstdout: ${e.stdout ?? ""}\nstderr: ${e.stderr ?? ""}`,
        );
      }
    }

    case Tools.TaskComplete:
      return args.summary;

    default:
      return `Unknown tool: ${name}`;
  }
}
