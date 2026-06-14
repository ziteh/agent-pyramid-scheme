// MCP resource

export const USAGE_GUIDE = `# Agent Pyramid Scheme — Usage Guide

APS lets you delegate self-contained tasks to a sub-agent that has full file read/write and bash access inside the configured project directory. Keep high-level planning and review in the main agent; hand off implementation, investigation, and boilerplate to the sub-agent.

## Tools

- \`delegate_task\` — delegate a task (sync by default; \`async: true\` returns a task ID to poll separately)
- \`get_task_result\` — poll an async task by task ID; keep polling until status is \`done\` or \`error\`
- \`list_tasks\` — list all currently running async task IDs
- \`cancel_task\` — cancel a running async task by task ID; aborts the in-flight LLM request immediately

> **Note:** Sub-agents are slower — a task may take a few minutes. Prefer async mode (\`async: true\`) so you can delegate multiple tasks concurrently and continue other work while they run. Avoid tight polling loops; check back after doing something useful rather than calling \`get_task_result\` in a high-frequency spin-wait.

## Sub-agent Capabilities and Constraints

Tools available to the sub-agent: \`read_file\`, \`write_file\`, \`execute_bash\`, \`task_complete\`.

Constraints:
- Dangerous commands (rm -rf /, curl|bash, /etc/, ~/.ssh/) are blocked
- execute_bash is sandboxed to the project root
- Max 30 tool-call iterations per task

## Writing Good Task Descriptions

Include: what to do, relevant file paths, acceptance criteria, and constraints. The more specific, the better.

Good:
  Read src/auth/middleware.ts. Add validation that userId is a non-empty string in the authenticate function.
  Write a test in src/auth/middleware.test.ts matching the existing style. Run \`pnpm test src/auth\` to verify.

Poor:
  Fix auth

## Git Worktree (Recommended)

Run the sub-agent in a separate git worktree to keep its changes isolated from your main working tree.

Setup:
  git worktree add ../my-project-agent-work -b agent/feature-name

Point --project-dir at the worktree, or pass it per task via working_dir.

For parallel async tasks, give each its own worktree to avoid file conflicts:
  git worktree add ../project-task-a -b agent/task-a
  git worktree add ../project-task-b -b agent/task-b
  delegate_task(task_desc="...", working_dir="/path/to/project-task-a", async=true)
  delegate_task(task_desc="...", working_dir="/path/to/project-task-b", async=true)

After the sub-agent finishes:
  git diff main..agent/feature-name   # review
  git merge agent/feature-name        # merge
  git worktree remove ../my-project-agent-work && git branch -d agent/feature-name

## Patterns

Parallel async tasks:
  id_A = delegate_task(task_desc="...", async=true)
  id_B = delegate_task(task_desc="...", async=true)
  poll get_task_result(id_A) and get_task_result(id_B) until done

Cancel a task if the direction changes:
  ids = list_tasks()           # see what's running
  cancel_task(task_id=id_A)    # abort immediately

Sequential dependent tasks:
  result = delegate_task("Investigate bug in X, summarize root cause")
  delegate_task("Fix the bug: <root cause from previous result>")

Investigation then implementation:
  summary = delegate_task("Read src/payments/ and summarize the data flow")
  delegate_task("Implement refund feature in src/payments/refund.ts based on: <summary>")

## What to Delegate vs. Keep

Delegate: feature implementation, refactoring a module, running tests, code review, codebase search, writing boilerplate.
Keep: architecture decisions, coordinating multiple sub-agent results, tasks that require your review before the next step.
`;
