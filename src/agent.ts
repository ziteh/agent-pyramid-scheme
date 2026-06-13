import { AGENT_TOOLS, runTool } from "./tools.js";
import type { Message, ToolCall } from "./types.js";

const MAX_ITERATIONS = 30;

export type AgentConfig = {
  baseUrl: string;
  model: string;
  apiKey?: string;
};

export type ProgressCallback = (
  progress: number,
  total: number,
  message: string,
) => Promise<void>;

const SYSTEM_PROMPT = `You are an expert software engineer acting as an autonomous coding agent.
You will receive a specific implementation task. Use the available tools to complete it:
- read_file: inspect existing files for context
- write_file: create or update source files
- execute_bash: compile, run tests, install deps, verify behaviour
- task_complete: call when the task is fully implemented AND verified

Work methodically: understand requirements → plan → implement → verify → complete.
Always call task_complete with a clear summary when you are done.`;

export async function runAgentLoop(
  config: AgentConfig,
  taskDesc: string,
  onProgress?: ProgressCallback,
): Promise<string> {
  const messages: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: taskDesc },
  ];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`;

    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: config.model,
        messages,
        tools: AGENT_TOOLS,
        // tool_choice: "required",
        tool_choice: "auto",
        stream: false,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API ${res.status}: ${text}`);
    }

    const data = (await res.json()) as {
      choices: Array<{
        finish_reason: string;
        message: {
          role: "assistant";
          content: string | null;
          tool_calls?: ToolCall[];
        };
      }>;
    };

    const assistantMsg = data.choices[0].message;
    messages.push(assistantMsg);

    const toolCalls = assistantMsg.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      return assistantMsg.content ?? "(agent gave no output)";
    }

    let completionSummary: string | null = null;

    for (const tc of toolCalls) {
      let args: Record<string, string> = {};
      try {
        args = JSON.parse(tc.function.arguments) as Record<string, string>;
      } catch {
        args = {};
      }

      const label = `[${i + 1}/${MAX_ITERATIONS}] ${tc.function.name}(${JSON.stringify(args).slice(0, 80)})`;
      console.error(`[agent] ${label}`);
      await onProgress?.(i + 1, MAX_ITERATIONS, label);
      const result = await runTool(tc.function.name, args);

      messages.push({ role: "tool", tool_call_id: tc.id, content: result });

      if (tc.function.name === "task_complete") {
        completionSummary = result;
      }
    }

    if (completionSummary !== null) return completionSummary;
  }

  return `[agent-pyramid-scheme] Agent hit max iterations (${MAX_ITERATIONS}) without completing.`;
}
