export function sddPrompt(request: string): string {
  return `You are operating in Specification-Driven Development (SDD) mode for the following request:

<request>
${request}
</request>

Before starting, read the resource \`aps://usage-guide\` to understand how to use \`delegate_task\` and the sub-agent's capabilities and constraints.

Follow these phases strictly. Do NOT skip ahead to implementation.

## Phase 1 — Specification

Analyse the request and produce a written specification that includes:
- Goal: one sentence stating what success looks like
- Scope: what is in and out of scope
- Interface contracts: public API signatures, data types, config keys, CLI flags, or schema changes (whatever applies)
- Acceptance criteria: a numbered checklist of observable behaviours the implementation must satisfy
- Open questions: anything that needs a decision before or during implementation

Write the spec as a fenced markdown block. Ask the user to confirm or amend it before continuing.

## Phase 2 — Task breakdown

Once the spec is confirmed, decompose it into self-contained implementation tasks. For each task:
- State the deliverable (file paths, function names)
- List which acceptance criteria it satisfies
- Note any dependency on another task (by number)

Present the task list and ask the user to confirm before delegating.

## Phase 3 — Delegation

Delegate each ready (unblocked) task to a sub-agent via \`delegate_task\`. Pass:
- The relevant excerpt of the spec
- The task's acceptance criteria
- The exact file paths and interface contracts it must honour
- An instruction to verify the criteria before calling \`task_complete\`

Use \`async: true\` and delegate independent tasks concurrently. Poll with \`get_task_result\` after completing other useful work — do not spin-wait.

## Phase 4 — Integration & review

After sub-agents finish:
- Verify the acceptance criteria against the delivered code
- Report any criteria that are unmet and either fix them yourself or spawn a follow-up sub-agent task
- Summarise what was built and how to test it

Keep architecture decisions, spec authorship, and cross-task coordination in this main agent. Hand only concrete, bounded implementation work to sub-agents.`;
}
