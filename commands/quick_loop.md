---
description: Quick build/verify loop for small, well-defined tasks — research, brief inline plan, implement, verify. Bails to /create_plan if the task is too big.
model: opus
---

# Quick Loop

You are tasked with driving a **small, well-defined** change to completion in a single tight loop: quick targeted research → a short inline plan → implementation via sub-agents → verification → report.

This command is the lightweight alternative to the full `/create_plan` → `/iterate_plan` → `/implement_plan` ceremony. It exists for tasks that are small and unambiguous enough that the heavy planning pipeline would be overkill.

**The most important rule: know your limits.** If at any point the task turns out to be larger, more ambiguous, or more architecturally involved than "small and well-defined," you must **STOP immediately** and tell the user to use `/create_plan` instead. Do not push through. Failing fast is the feature, not a failure.

## Use Subagents As Much As Possible

You are the conductor, not the implementer. Parallelize research, preserve main-context budget, and route each task to the agent best suited for it. Available subagents:

- **coder-agent** — Implements small, well-defined coding tasks from a precise spec (files, exact changes, acceptance criteria). Your default for making the change.
- **codebase-locator** — Finds WHERE files, directories, and components live (a smarter Grep/Glob/LS).
- **codebase-analyzer** — Explains HOW specific code works, with file:line detail.
- **codebase-pattern-finder** — Finds similar implementations and concrete code examples to model after.
- **utility-agent** — Executes tool calls (primarily bash commands) on behalf of the main agent; use it to offload running tests, builds, and searches and keep the main context focused.

Note: **architecture-agent is deliberately NOT in this list.** If you find yourself needing it — i.e., the task requires a genuine design/judgment call (which pattern, where new code lives, how to phase the work) — that is your signal that the task is **out of scope for quick_loop**. Bail to `/create_plan` (see Scope Gate).

## Scope Gate

`quick_loop` is only for tasks that are **all** of the following:

**In scope — proceed:**
- A single, well-defined change with clear, verifiable acceptance criteria
- Touches a small number of files (rough heuristic: ~1–3 files, same subsystem)
- Follows an existing, established pattern — no new design decision required
- A localized bug fix with a known or quickly-findable cause
- A small additive feature that mirrors existing code
- Verifiable with existing checks (`make check test`, or a targeted test/command)

**Out of scope — STOP and recommend `/create_plan`:**
- Requires a genuine architectural or design decision (competing patterns, contested "where should this live," a new abstraction)
- Spans multiple subsystems, or more than a handful of files
- Needs phasing — it can't be done in one coherent pass
- Requirements are ambiguous and would need back-and-forth iteration to pin down
- Involves schema/data migrations, cross-cutting refactors, or public API/contract changes
- Has multiple unknowns that require deep research before the approach is clear
- Would require architecture-agent to decompose the work

When you determine a task is out of scope, respond with this and stop:

```
⛔ This is beyond the scope of /quick_loop.

Reason: [one specific sentence — e.g., "it requires choosing between two competing
caching patterns, which is a design decision," or "it spans the daemon, the CLI, and
the WUI — more than a quick loop should touch."]

Recommended next step:
  /create_plan [restate the task]

That command will research thoroughly, weigh design options, and produce a phased,
reviewable plan.
```

Apply the gate at two moments:
1. **Up front** — after quick research, before writing the inline plan.
2. **Continuously** — if implementation or verification reveals hidden complexity (coder-agent escalates, a "small" change cascades, verification keeps failing for structural reasons), bail mid-flight. Don't sink-cost your way through.

## Process

### Step 0: Capture the task

- If a task description was provided as an argument, use it.
- If no argument was provided, respond:
  ```
  What small, well-defined task should I loop on? Give me the change and how I'll know it's done.

  Heads up: /quick_loop is for small, unambiguous changes. If it turns out to be larger or
  needs design decisions, I'll stop and point you to /create_plan.
  ```
  Then wait.

### Step 1: Quick targeted research

Keep this lean — this is not the deep, parallel research sweep of `/create_plan`.

1. Read any files the user explicitly referenced, **fully** (no limit/offset).
2. Spawn focused sub-agents only as needed:
   - **codebase-locator** to find where the relevant code lives.
   - **codebase-analyzer** to understand the specific function/flow you'll touch (file:line).
   - **codebase-pattern-finder** if you need an existing pattern to mirror.
3. Read the handful of files you'll actually change, fully, into main context.

Stop researching as soon as you understand the change well enough to specify it. If research keeps expanding — more files, more unknowns, no clear pattern — that's a Scope Gate signal.

### Step 2: Apply the Scope Gate (up front)

Make the in-scope / out-of-scope call now, grounded in what research found. If out of scope, emit the bail message and stop. Otherwise continue.

### Step 3: Short inline plan + confirm

Present a **brief** plan in chat (no thoughts/ file). Keep it to ~3–5 bullets:

```
Quick plan for: [task]

- Files: [path/to/file.ext:line, ...]
- Change: [what changes, concretely — 1–3 bullets]
- Acceptance: [how we'll verify — e.g., `make check test`, a specific test, a command]
- Out of scope: [anything explicitly not included]

Look right? (reply to adjust, or 'go' to implement)
```

Wait for a quick OK. If the user's reply reveals the task is bigger or fuzzier than it looked, re-apply the Scope Gate.

### Step 4: Implement via coder-agent

Delegate the change to **coder-agent** with a precise spec — goal, files, exact change, acceptance criteria, and out-of-scope — copied from the inline plan. Do not implement in the main context (rare exception: a single-file edit of ≤5 lines that is purely mechanical and has no acceptance command to run).

Handle escalations as bail signals, not as work to absorb:
- **coder-agent returns `NEEDS ARCHITECTURE DECISION`** → the task needs a design call. **Bail to `/create_plan`** rather than reaching for architecture-agent.
- **coder-agent returns `TASK UNDERSPECIFIED`** → if you can tighten the spec from research in one pass, do so and re-invoke. If it needs decomposition, **bail to `/create_plan`**.

### Step 5: Verify (the loop)

1. Run the acceptance checks — usually `make check test`, or the targeted command from the plan. Offload to **utility-agent** to keep main context clean.
2. If checks pass → go to Step 6.
3. If checks fail → diagnose. If the fix is small and mechanical, re-invoke coder-agent with a refined spec and re-verify. **Cap this at ~2 fix attempts.** If it still fails, or the failure reveals a structural/design problem rather than a quick fix, **bail to `/create_plan`** with the diagnosis.

### Step 6: Report

```
✅ Done: [task]

Changes:
- [file:line — what changed]

Verification:
- [check that ran] → passed

[Any manual verification the user should do, if applicable.]
```

If a phase touched anything requiring human judgment to confirm (UI, behavior under load), note it for manual verification rather than claiming it works.

## Guidelines

- **Fail fast, loudly, early.** The whole value of this command is the guardrail. When in doubt about scope, bail — `/create_plan` is cheap and a half-done quick loop on a too-big task is expensive.
- **Stay quick.** No thoughts/ plan file, no deep parallel research sweep, no phasing. If the task wants those, it wants `/create_plan`.
- **Delegate.** You orchestrate; coder-agent implements; codebase-* agents research; utility-agent runs commands.
- **Be honest in the report.** If tests failed, say so. If a step was skipped, say so. Don't claim done until verified.

## Example

```
User: /quick_loop add a --json flag to the `status` command that prints the result as JSON

Assistant: [reads status command, locates the flag-parsing + output code via codebase-analyzer]
[Scope Gate: single command, mirrors existing --verbose flag, one file → in scope]

Quick plan for: add --json flag to `status`
- Files: hlyr/src/commands/status.ts:40 (flag def), :88 (output)
- Change: register --json bool flag; when set, JSON.stringify the result object instead of the table render
- Acceptance: `make -C hlyr check test`; `hlyr status --json` emits valid JSON
- Out of scope: changing the default human-readable output

Look right? (reply to adjust, or 'go' to implement)

User: go

Assistant: [coder-agent implements] → [utility-agent runs checks] → passed → reports
```
