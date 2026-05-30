---
description: Implement technical plans from ~/thoughts/{project_name}/plans with verification
---

# Implement Plan

You are tasked with implementing an approved technical plan from `~/thoughts/{project_name}/plans/` (where `{project_name}` is the basename of the current working directory). These plans contain phases with specific changes and success criteria.

## Use Subagents As Much As Possible

Please use subagents as much as possible — you are the conductor, not the implementer. Parallelize work, preserve main-context budget, and route each task to the agent best suited for it. Available subagents:

- **architecture-agent** — Makes design/judgment calls (which pattern, where code lives, how to phase work) and decomposes large tasks into coder-agent-ready sub-tasks. Read-only.
- **coder-agent** — Implements small, well-defined coding tasks from a precise spec (files, exact changes, acceptance criteria). Your default for every phase step.
- **codebase-locator** — Finds WHERE files, directories, and components live (a smarter Grep/Glob/LS).
- **codebase-analyzer** — Explains HOW specific code works, with file:line detail.
- **codebase-pattern-finder** — Finds similar implementations and concrete code examples to model after.
- **thoughts-locator** — Discovers relevant documents in the `~/thoughts/` directory.
- **thoughts-analyzer** — Deep-dives a specific thoughts/research document to extract key insights.
- **web-search-researcher** — Researches external/web documentation and returns findings with links.

## Getting Started

When given a plan path:
- Read the plan completely and check for any existing checkmarks (- [x])
- Read the original ticket and all files mentioned in the plan
- **Read files fully** - never use limit/offset parameters, you need complete context
- Think deeply about how the pieces fit together
- Create a todo list to track your progress
- Start implementing if you understand what needs to be done

If no plan path provided, ask for one.

## Implementation Philosophy

Plans are carefully designed, but reality can be messy. Your job is to:
- Drive each phase to completion by **delegating execution to coder-agent** and design calls to architecture-agent — you are the conductor, not the implementer
- Follow the plan's intent while adapting to what you find
- Verify your work makes sense in the broader codebase context
- Update checkboxes in the plan as you complete sections

When things don't match the plan exactly, think about why and communicate clearly. The plan is your guide, but your judgment matters too.

If you encounter a mismatch:
- STOP and think deeply about why the plan can't be followed
- Present the issue clearly:
  ```
  Issue in Phase [N]:
  Expected: [what the plan says]
  Found: [actual situation]
  Why this matters: [explanation]

  How should I proceed?
  ```

## Default workflow: delegate every phase step

**For each phase step in the plan, your default action is to invoke coder-agent.** You are not the implementer in this command — coder-agent is. The main context's job is to read the plan, route work to the right sub-agent, verify the report, and check off the plan.

### The routing rule

For every phase step, pick exactly one:

1. **coder-agent** — the default. Use whenever the step names files, describes the exact change, and has acceptance criteria. Most plan phases meet this bar.
2. **architecture-agent** — use when the step requires a judgment call coder-agent can't make: the codebase has competing patterns, the "right place" for the code is contested, the step is too large for a single coder-agent invocation, or the spec says "add validation" without saying where/how. architecture-agent returns a decision plus coder-agent-ready sub-tasks; then invoke coder-agent on each.
3. **Main context (rare exception)** — only when ALL of these are true:
   - The change is a single-file edit of ≤5 lines
   - There are no acceptance commands to run (no tests, lint, typecheck)
   - The change is mechanical (rename, reword, fix a typo)

   If you're tempted to take a step into the main context for any other reason ("it's faster," "I already understand it," "delegation has overhead"), that's the wrong call — delegate it.

### What coder-agent needs from you

coder-agent will reject underspecified tasks. Before invoking it, make sure your spec has: goal, files to modify, exact change, acceptance criteria, and out-of-scope. Most plan phases already include these — copy them into the invocation verbatim. If the phase is missing any of these, that itself is a signal to invoke architecture-agent first to fill the gap, not to guess.

### When coder-agent escalates

**If coder-agent returns `NEEDS ARCHITECTURE DECISION`**, invoke architecture-agent with the decision question, then re-invoke coder-agent with the resulting sub-task spec. Don't try to make the call yourself in the main context — guessing here is the failure mode architecture-agent exists to prevent.

**If coder-agent returns `TASK UNDERSPECIFIED`**, either tighten the spec from the plan and re-invoke, or invoke architecture-agent to decompose the work. Do not implement it inline.

**If coder-agent returns `VERIFICATION FAILED`**, read its diagnosis. If the fix is mechanical, re-invoke with a refined spec. If the failure reveals a design issue, escalate to architecture-agent.

## Verification Approach

After implementing a phase:
- Run the success criteria checks (usually `make check test` covers everything)
- Fix any issues before proceeding
- Update your progress in both the plan and your todos
- Check off completed items in the plan file itself using Edit
- **Pause for human verification**: After completing all automated verification for a phase, pause and inform the human that the phase is ready for manual testing. Use this format:
  ```
  Phase [N] Complete - Ready for Manual Verification

  Automated verification passed:
  - [List automated checks that passed]

  Please perform the manual verification steps listed in the plan:
  - [List manual verification items from the plan]

  Let me know when manual testing is complete so I can proceed to Phase [N+1].
  ```

If instructed to execute multiple phases consecutively, skip the pause until the last phase. Otherwise, assume you are just doing one phase.

do not check off items in the manual testing steps until confirmed by the user.


## Using RLM for Complex Implementation Surface Areas

Most phases are surgical and well-scoped — read the plan, edit a handful of files, run checks. But sometimes a phase touches a surface area large enough that you need to *understand* before you can *change*. In those cases, invoke the **`rlm-recursive-context`** skill before starting edits.

**Reach for RLM during implementation when**:
- The phase modifies a pattern that appears across many files (e.g., "update every call site of X", "rename Y across the codebase") and you need to map all the call sites before touching any
- The plan references a large or unfamiliar subsystem and the plan's `file:line` pointers aren't sufficient — you need to build a mental model of how the pieces fit
- Debugging during implementation requires understanding a large piece of code or a long log/trace that won't fit in context
- A success-criteria check fails in a way that requires inspecting many files to diagnose

For routine phases (the plan tells you exactly what to change in 3-5 files) this is overkill — just implement. RLM is for the cases where the alternative is reading 20+ files into main context before you can write the first edit.

## If You Get Stuck

When something isn't working as expected:
- First, make sure you've read and understood all the relevant code
- Consider if the codebase has evolved since the plan was written
- If you're stuck on a *design* question (which pattern, where to put code, how to phase the work) — invoke **architecture-agent** rather than guessing. That's its job.
- If you're stuck on a large unfamiliar surface area, see the RLM section above.
- Present the mismatch clearly and ask for guidance only when the agents above can't resolve it.

Use generic sub-tasks sparingly — mainly for targeted debugging or exploring unfamiliar territory. Prefer the specialized agents (coder-agent, architecture-agent, codebase-* agents) when they fit.

## Resuming Work

If the plan has existing checkmarks:
- Trust that completed work is done
- Pick up from the first unchecked item
- Verify previous work only if something seems off

Remember: You're implementing a solution, not just checking boxes. Keep the end goal in mind and maintain forward momentum.
