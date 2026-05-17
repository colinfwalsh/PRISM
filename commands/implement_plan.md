---
description: Implement technical plans from ~/thoughts/{project_name}/plans with verification
---

# Implement Plan

You are tasked with implementing an approved technical plan from `~/thoughts/{project_name}/plans/` (where `{project_name}` is the basename of the current working directory). These plans contain phases with specific changes and success criteria.

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
- Follow the plan's intent while adapting to what you find
- Implement each phase fully before moving to the next
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

## Using coder-agent and architecture-agent

Implementation is the natural place to lean on the two action-oriented sub-agents:

- **coder-agent** — hand it well-defined phase steps. If a phase says "in `path/to/file.ts:45-67`, replace the inline validation with a call to `validateFoo`, add the corresponding test, run `make check test`", that's exactly the spec coder-agent expects: files, exact change, acceptance criteria, out-of-scope. It will execute and verify, returning either `COMPLETE` (with the commands it ran) or one of three structured failure reports.

- **architecture-agent** — escalate when you hit ambiguity. If a phase references a pattern but the codebase has competing options, or if the plan says "add validation" without committing to where, invoke architecture-agent instead of guessing. It returns a grounded decision (with `file:line` evidence) and, if the work is larger than a single coder-agent invocation, a sequence of coder-agent-ready sub-task specs.

**Decision tree per phase**:
1. Phase is already well-defined (specific files, exact change, criteria) → **coder-agent**
2. Phase is ambiguous or larger than a single coder-agent task → **architecture-agent**, then **coder-agent** on its resulting sub-tasks
3. Phase is small enough that delegation overhead exceeds the work itself (e.g., a 2-3 line edit) → do it directly in the main context

**If coder-agent returns `NEEDS ARCHITECTURE DECISION`**, follow its suggestion: invoke architecture-agent, then re-invoke coder-agent with the resulting spec. Don't try to make the call yourself in the main context — guessing here is the failure mode architecture-agent exists to prevent.

**Don't reflexively delegate.** Sub-agent invocations have overhead. Small, obvious edits stay in main context. The delegation pattern earns its keep on multi-file phases, ambiguous specs, or anywhere you'd otherwise wing it.

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
