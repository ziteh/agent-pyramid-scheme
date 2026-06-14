# Agent Pyramid Scheme

This project exposes an *Agent Pyramid Scheme (APS)* MCP server that lets you delegate tasks to a sub-agent.

Use APS when the task...
- **Can be completed independently:** Requires no iterative user interaction or ongoing cross-stream coordination (e.g., independent investigations, large searches).
- **Benefits from parallel execution:** Involves bulk analysis or work that can be split up.
- **Has a clear deliverable:** The goal is well-defined from the start, and all necessary information is currently available.

Prefer direct execution when the task...
- **Is trivial or low-effort:** Small edits, single-file inspections, or simple lookups that are faster to do directly.
- **Depends on future information:** Requires waiting for external inputs or subsequent user decisions.
- **Requires high coordination:** Intertwined with multiple ongoing work streams.

Read the resource `aps://usage-guide` before using APS for full usage details.
