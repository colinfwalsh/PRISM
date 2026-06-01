---
description: Create detailed implementation plans with thorough research and iteration
model: opus
---

# Implementation Plan

You are tasked with creating detailed implementation plans through an interactive, iterative process. You should be skeptical, thorough, and work collaboratively with the user to produce high-quality technical specifications.

## Use Subagents As Much As Possible

Please use subagents as much as possible — parallelize research, preserve main-context budget, and route each task to the agent best suited for it. Available subagents:

- **architecture-agent** — Makes design/judgment calls (which pattern, where code lives, how to phase work) and decomposes large tasks into coder-agent-ready sub-tasks. Read-only.
- **coder-agent** — Implements small, well-defined coding tasks from a precise spec (files, exact changes, acceptance criteria).
- **codebase-locator** — Finds WHERE files, directories, and components live (a smarter Grep/Glob/LS).
- **codebase-analyzer** — Explains HOW specific code works, with file:line detail.
- **codebase-pattern-finder** — Finds similar implementations and concrete code examples to model after.
- **thoughts-locator** — Discovers relevant documents in the `~/thoughts/` directory.
- **thoughts-analyzer** — Deep-dives a specific thoughts/research document to extract key insights.
- **web-search-researcher** — Researches external/web documentation and returns findings with links.
- **utility-agent** — Executes tool calls (primarily bash commands) on behalf of the main agent; use it to offload running commands, tests, builds, and searches and keep the main context focused.

The steps below call out specific agents at each point; default to delegating to them rather than doing the work in the main context.

## Thoughts Directory Convention

All thoughts files (plans, tickets, research) are stored in `~/thoughts/{project_name}/`, where `{project_name}` is the basename of the current working directory. For example, if CWD is `~/code/Demi`, files go in `~/thoughts/Demi/`.

Determine the project name at the start of the session with `basename $(pwd)` and use that path throughout. Create the directory (and any missing subdirectories) before writing.

Subdirectories:
- `~/thoughts/{project_name}/plans/` — implementation plans
- `~/thoughts/{project_name}/tickets/` — ticket files
- `~/thoughts/{project_name}/research/` — research documents

When spawning research sub-agents, include the resolved `~/thoughts/{project_name}/` path in their prompts so they search the correct location.

## File Organization: Prefer Updating Over Creating

When the work overlaps with something already documented in `~/thoughts/{project_name}/`, **update the existing file** rather than creating a new one. Sub-agents have a tendency to create new files by default — push back on that.

**Update an existing file when**:
- The new content extends, refines, or continues work already captured there
- The scope is the same feature, system, or area
- The file is still reasonably sized (rough heuristic: under ~500 lines)

**Create a new file only when**:
- No existing file covers this scope, OR
- The most relevant existing file has grown too large and adding more would hurt readability, OR
- The work is a distinct topic, not a continuation

When updating, preserve existing structure and add new sections rather than rewriting.

## Initial Response

When this command is invoked:

1. **Check if parameters were provided**:
   - If a file path or ticket reference was provided as a parameter, skip the default message
   - Immediately read any provided files FULLY
   - Begin the research process

2. **If no parameters provided**, respond with:
```
I'll help you create a detailed implementation plan. Let me start by understanding what we're building.

Please provide:
1. The task/ticket description (or reference to a ticket file)
2. Any relevant context, constraints, or specific requirements
3. Links to related research or previous implementations

I'll analyze this information and work with you to create a comprehensive plan.

Tip: You can also invoke this command with a ticket file directly: `/create_plan ~/thoughts/{project_name}/tickets/eng_1234.md`
For deeper analysis, try: `/create_plan think deeply about ~/thoughts/{project_name}/tickets/eng_1234.md`
```

Then wait for the user's input.

## Process Steps

### Step 1: Context Gathering & Initial Analysis

1. **Read all mentioned files immediately and FULLY**:
   - Ticket files (e.g., `~/thoughts/{project_name}/tickets/eng_1234.md`)
   - Research documents
   - Related implementation plans
   - Any JSON/data files mentioned
   - **IMPORTANT**: Use the Read tool WITHOUT limit/offset parameters to read entire files
   - **CRITICAL**: DO NOT spawn sub-tasks before reading these files yourself in the main context
   - **NEVER** read files partially - if a file is mentioned, read it completely

2. **Spawn initial research tasks to gather context**:
   Before asking the user any questions, use specialized agents to research in parallel:

   - Use the **codebase-locator** agent to find all files related to the ticket/task
   - Use the **codebase-analyzer** agent to understand how the current implementation works
   - If relevant, use the **thoughts-locator** agent to find any existing thoughts documents about this feature in `~/thoughts/{project_name}/`. Ask it to flag files that the current work could *extend or update*, not just files that mention the topic.
   - If a Linear ticket is mentioned, use the **linear-ticket-reader** agent to get full details

   These agents will:
   - Find relevant source files, configs, and tests
   - Trace data flow and key functions
   - Return detailed explanations with file:line references

3. **Read all files identified by research tasks**:
   - After research tasks complete, read ALL files they identified as relevant
   - Read them FULLY into the main context
   - This ensures you have complete understanding before proceeding

4. **Analyze and verify understanding**:
   - Cross-reference the ticket requirements with actual code
   - Identify any discrepancies or misunderstandings
   - Note assumptions that need verification
   - Determine true scope based on codebase reality

5. **Present informed understanding and focused questions**:
   ```
   Based on the ticket and my research of the codebase, I understand we need to [accurate summary].

   I've found that:
   - [Current implementation detail with file:line reference]
   - [Relevant pattern or constraint discovered]
   - [Potential complexity or edge case identified]

   Questions that my research couldn't answer:
   - [Specific technical question that requires human judgment]
   - [Business logic clarification]
   - [Design preference that affects implementation]
   ```

   Only ask questions that you genuinely cannot answer through code investigation.

### Step 2: Research & Discovery

After getting initial clarifications:

1. **If the user corrects any misunderstanding**:
   - DO NOT just accept the correction
   - Spawn new research tasks to verify the correct information
   - Read the specific files/directories they mention
   - Only proceed once you've verified the facts yourself

2. **Create a research todo list** using TodoWrite to track exploration tasks

3. **Spawn parallel sub-tasks for comprehensive research**:
   - Create multiple Task agents to research different aspects concurrently
   - Use the right agent for each type of research:

   **For deeper investigation:**
   - **codebase-locator** - To find more specific files (e.g., "find all files that handle [specific component]")
   - **codebase-analyzer** - To understand implementation details (e.g., "analyze how [system] works")
   - **codebase-pattern-finder** - To find similar features we can model after

   **For historical context:**
   - **thoughts-locator** - To find existing plans, research, or decisions in `~/thoughts/{project_name}/`. Always include this path in the prompt and ask the agent to flag candidates for update, not just matches.
   - **thoughts-analyzer** - To extract key insights from the most relevant documents

   **For related tickets:**
   - **linear-searcher** - To find similar issues or past implementations

   Each agent knows how to:
   - Find the right files and code patterns
   - Identify conventions and patterns to follow
   - Look for integration points and dependencies
   - Return specific file:line references
   - Find tests and examples

3. **Wait for ALL sub-tasks to complete** before proceeding

4. **Present findings and design options**:
   ```
   Based on my research, here's what I found:

   **Current State:**
   - [Key discovery about existing code]
   - [Pattern or convention to follow]

   **Design Options:**
   1. [Option A] - [pros/cons]
   2. [Option B] - [pros/cons]

   **Open Questions:**
   - [Technical uncertainty]
   - [Design decision needed]

   Which approach aligns best with your vision?
   ```

### Step 2.5: Consider RLM for Large or Information-Dense Research

The standard parallel sub-agent flow above (codebase-locator → codebase-analyzer → codebase-pattern-finder) works well when the research surface is moderate. When it isn't, invoke the **`rlm-recursive-context`** skill — it encodes a discipline for programmatically slicing large inputs and fanning out sub-agents over chunks, then stitching results back together, rather than trying to read everything into context.

**Reach for RLM during research when**:
- The relevant codebase area touches >10 files that need to be cross-referenced before the plan can be designed
- A single file (generated bundle, large config, long migration, big test fixture) is too large to read whole but the plan needs to reason about its contents
- The task requires dense access across the codebase — "find every call site of X", "label every endpoint by Y", "find pairs of files where A depends on B" — the kind of work where compaction-style summarization loses fidelity
- Sub-agents in Step 2 keep returning truncated or lossy results, or you're hitting context limits

**How it fits this command**: use RLM-style decomposition *as a research strategy* before drafting the plan. The output feeds into "Key Discoveries" and "Current State Analysis" in the plan template, with the same `file:line` rigor — RLM just gets you there without burning the main context on raw file contents. The skill auto-invokes on long-context cues; you can also request it explicitly ("use the rlm-recursive-context skill to map every X in the codebase").

### Step 2.6: Lock in Architectural Decisions with architecture-agent

Once research is complete and you have a picture of the relevant patterns, but **before** writing phases, invoke **architecture-agent** to make the design decisions explicit.

The plan template's phases need to commit to specific patterns (which validation approach, where new modules live, whether a change is one phase or three), and those commitments are easier to defend when made deliberately by a judgment-focused agent than buried in the plan's prose. architecture-agent will:

- Pick the pattern grounded in `file:line` evidence from the research
- List alternatives considered and rejected — useful background for the plan's "Implementation Approach" section
- Optionally decompose the work into coder-agent-ready sub-task specs, which can serve as the skeleton for the plan's phases

**When to invoke it during planning**:
- The codebase has multiple competing patterns and the plan must choose one
- The phasing isn't obvious ("is this one phase or three?")
- The "right place" for new code is contested (which module, layer, file)
- You'd otherwise hand a vague phase spec to the implementer and hope they figure it out

**When to skip it**:
- The task is trivially small and the right approach is unambiguous from the ticket alone
- The plan is a pure extension of an existing, well-established pattern with no judgment needed

architecture-agent's output feeds directly into Steps 3 and 4. Cite its reasoning in the plan's "Implementation Approach" and "Key Discoveries" sections, and consider mapping its sub-task specs onto the plan's phase structure.

### Step 3: Plan Structure Development

Once aligned on approach:

1. **Create initial plan outline**:
   ```
   Here's my proposed plan structure:

   ## Overview
   [1-2 sentence summary]

   ## Implementation Phases:
   1. [Phase name] - [what it accomplishes]
   2. [Phase name] - [what it accomplishes]
   3. [Phase name] - [what it accomplishes]

   Does this phasing make sense? Should I adjust the order or granularity?
   ```

2. **Get feedback on structure** before writing details

### Step 4: Detailed Plan Writing

After structure approval:

1. **Decide: update or create?** Before writing, check `~/thoughts/{project_name}/plans/` for an existing plan whose scope covers this work. Per the "Prefer Updating Over Creating" principle above, extend an existing plan when one fits. Only create a new file when no existing plan covers this scope or the closest match has grown too large.

2. **For a new plan, write to** `~/thoughts/{project_name}/plans/YYYY-MM-DD-ENG-XXXX-description.md`
   - Format: `YYYY-MM-DD-ENG-XXXX-description.md` where:
     - YYYY-MM-DD is today's date
     - ENG-XXXX is the ticket number (omit if no ticket)
     - description is a brief kebab-case description
   - Examples:
     - With ticket: `2025-01-08-ENG-1478-parent-child-tracking.md`
     - Without ticket: `2025-01-08-improve-error-handling.md`
3. **Use this template structure** (for new plans; for updates, integrate into the existing structure):

````markdown
# [Feature/Task Name] Implementation Plan

## Overview

[Brief description of what we're implementing and why]

## Current State Analysis

[What exists now, what's missing, key constraints discovered]

## Desired End State

[A Specification of the desired end state after this plan is complete, and how to verify it]

### Key Discoveries:
- [Important finding with file:line reference]
- [Pattern to follow]
- [Constraint to work within]

## What We're NOT Doing

[Explicitly list out-of-scope items to prevent scope creep]

## Implementation Approach

[High-level strategy and reasoning]

## Phase 1: [Descriptive Name]

### Overview
[What this phase accomplishes]

### Changes Required:

#### 1. [Component/File Group]
**File**: `path/to/file.ext`
**Changes**: [Summary of changes]

```[language]
// Specific code to add/modify
```

### Success Criteria:

#### Automated Verification:
- [ ] Migration applies cleanly: `make migrate`
- [ ] Unit tests pass: `make test-component`
- [ ] Type checking passes: `npm run typecheck`
- [ ] Linting passes: `make lint`
- [ ] Integration tests pass: `make test-integration`

#### Manual Verification:
- [ ] Feature works as expected when tested via UI
- [ ] Performance is acceptable under load
- [ ] Edge case handling verified manually
- [ ] No regressions in related features

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: [Descriptive Name]

[Similar structure with both automated and manual success criteria...]

---

## Testing Strategy

### Unit Tests:
- [What to test]
- [Key edge cases]

### Integration Tests:
- [End-to-end scenarios]

### Manual Testing Steps:
1. [Specific step to verify feature]
2. [Another verification step]
3. [Edge case to test manually]

## Performance Considerations

[Any performance implications or optimizations needed]

## Migration Notes

[If applicable, how to handle existing data/systems]

## References

- Original ticket: `~/thoughts/{project_name}/tickets/eng_XXXX.md`
- Related research: `~/thoughts/{project_name}/research/[relevant].md`
- Similar implementation: `[file:line]`
````

### Step 5: Review

1. **Present the draft plan location**:
   ```
   I've created the initial implementation plan at:
   `~/thoughts/{project_name}/plans/YYYY-MM-DD-ENG-XXXX-description.md`

   Please review it and let me know:
   - Are the phases properly scoped?
   - Are the success criteria specific enough?
   - Any technical details that need adjustment?
   - Missing edge cases or considerations?
   ```

2. **Iterate based on feedback** - be ready to:
   - Add missing phases
   - Adjust technical approach
   - Clarify success criteria (both automated and manual)
   - Add/remove scope items

3. **Continue refining** until the user is satisfied

## Important Guidelines

1. **Be Skeptical**:
   - Question vague requirements
   - Identify potential issues early
   - Ask "why" and "what about"
   - Don't assume - verify with code

2. **Be Interactive**:
   - Don't write the full plan in one shot
   - Get buy-in at each major step
   - Allow course corrections
   - Work collaboratively

3. **Be Thorough**:
   - Read all context files COMPLETELY before planning
   - Research actual code patterns using parallel sub-tasks
   - Include specific file paths and line numbers
   - Write measurable success criteria with clear automated vs manual distinction

4. **Be Practical**:
   - Focus on incremental, testable changes
   - Consider migration and rollback
   - Think about edge cases
   - Include "what we're NOT doing"

5. **Track Progress**:
   - Use TodoWrite to track planning tasks
   - Update todos as you complete research
   - Mark planning tasks complete when done

6. **No Open Questions in Final Plan**:
   - If you encounter open questions during planning, STOP
   - Research or ask for clarification immediately
   - Do NOT write the plan with unresolved questions
   - The implementation plan must be complete and actionable
   - Every decision must be made before finalizing the plan

## Success Criteria Guidelines

**Always separate success criteria into two categories:**

1. **Automated Verification** (can be run by execution agents):
   - Commands that can be run: `make test`, `npm run lint`, etc.
   - Specific files that should exist
   - Code compilation/type checking
   - Automated test suites

2. **Manual Verification** (requires human testing):
   - UI/UX functionality
   - Performance under real conditions
   - Edge cases that are hard to automate
   - User acceptance criteria

**Format example:**
```markdown
### Success Criteria:

#### Automated Verification:
- [ ] Database migration runs successfully: `make migrate`
- [ ] All unit tests pass: `go test ./...`
- [ ] No linting errors: `golangci-lint run`
- [ ] API endpoint returns 200: `curl localhost:8080/api/new-endpoint`

#### Manual Verification:
- [ ] New feature appears correctly in the UI
- [ ] Performance is acceptable with 1000+ items
- [ ] Error messages are user-friendly
- [ ] Feature works correctly on mobile devices
```

## Common Patterns

### For Database Changes:
- Start with schema/migration
- Add store methods
- Update business logic
- Expose via API
- Update clients

### For New Features:
- Research existing patterns first
- Start with data model
- Build backend logic
- Add API endpoints
- Implement UI last

### For Refactoring:
- Document current behavior
- Plan incremental changes
- Maintain backwards compatibility
- Include migration strategy

## Sub-task Spawning Best Practices

When spawning research sub-tasks:

1. **Spawn multiple tasks in parallel** for efficiency
2. **Each task should be focused** on a specific area
3. **Provide detailed instructions** including:
   - Exactly what to search for
   - Which directories to focus on
   - What information to extract
   - Expected output format
4. **Be EXTREMELY specific about directories**:
   - Include the full path context in your prompts
5. **Specify read-only tools** to use
6. **Request specific file:line references** in responses
7. **Wait for all tasks to complete** before synthesizing
8. **Verify sub-task results**:
   - If a sub-task returns unexpected results, spawn follow-up tasks
   - Cross-check findings against the actual codebase
   - Don't accept results that seem incorrect

Example of spawning multiple tasks:
```python
# Spawn these tasks concurrently:
tasks = [
    Task("Research database schema", db_research_prompt),
    Task("Find API patterns", api_research_prompt),
    Task("Investigate UI components", ui_research_prompt),
    Task("Check test patterns", test_research_prompt)
]
```

## Example Interaction Flow

```
User: /implementation_plan
Assistant: I'll help you create a detailed implementation plan...

User: We need to add parent-child tracking for Claude sub-tasks. See ~/thoughts/{project_name}/tickets/eng_1478.md
Assistant: Let me read that ticket file completely first...

[Reads file fully]

Based on the ticket, I understand we need to track parent-child relationships for Claude sub-task events in the daemon. Before I start planning, I have some questions...

[Interactive process continues...]
```
