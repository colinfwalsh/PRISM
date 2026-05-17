---
description: Document codebase as-is with thoughts directory for historical context
model: opus
---

# Research Codebase

You are tasked with conducting comprehensive research across the codebase to answer user questions by spawning parallel sub-agents and synthesizing their findings.

## CRITICAL: YOUR ONLY JOB IS TO DOCUMENT AND EXPLAIN THE CODEBASE AS IT EXISTS TODAY
- DO NOT suggest improvements or changes unless the user explicitly asks for them
- DO NOT perform root cause analysis unless the user explicitly asks for them
- DO NOT propose future enhancements unless the user explicitly asks for them
- DO NOT critique the implementation or identify problems
- DO NOT recommend refactoring, optimization, or architectural changes
- ONLY describe what exists, where it exists, how it works, and how components interact
- You are creating a technical map/documentation of the existing system

## Thoughts Directory Convention

All thoughts files (plans, tickets, research) are stored in `~/thoughts/{project_name}/`, where `{project_name}` is the basename of the current working directory. For example, if CWD is `~/code/Demi`, files go in `~/thoughts/Demi/`.

Determine the project name at the start of the session with `basename $(pwd)` and use that path throughout. Create the directory (and any missing subdirectories) before writing.

Subdirectories:
- `~/thoughts/{project_name}/plans/` — implementation plans
- `~/thoughts/{project_name}/tickets/` — ticket files
- `~/thoughts/{project_name}/research/` — research documents

When spawning research sub-agents, include the resolved `~/thoughts/{project_name}/` path in their prompts so they search the correct location.

## File Organization: Prefer Updating Over Creating

When the research topic overlaps with something already documented in `~/thoughts/{project_name}/research/`, **update the existing file** rather than creating a new one. Sub-agents have a tendency to create new files by default — push back on that.

**Update an existing research doc when**:
- The new query extends, refines, or continues research already captured there
- The scope is the same feature, system, or area
- The file is still reasonably sized (rough heuristic: under ~500 lines)

**Create a new file only when**:
- No existing research doc covers this scope, OR
- The most relevant existing doc has grown too large and adding more would hurt readability, OR
- The query is a distinct topic, not a continuation

When updating, append a `## Follow-up Research [timestamp]` section (per Step 9) and refresh the frontmatter's `last_updated` fields. Preserve existing structure.

## Initial Setup:

When this command is invoked, respond with:
```
I'm ready to research the codebase. Please provide your research question or area of interest, and I'll analyze it thoroughly by exploring relevant components and connections.
```

Then wait for the user's research query.

## Steps to follow after receiving the research query:

1. **Read any directly mentioned files first:**
   - If the user mentions specific files (tickets, docs, JSON), read them FULLY first
   - **IMPORTANT**: Use the Read tool WITHOUT limit/offset parameters to read entire files
   - **CRITICAL**: Read these files yourself in the main context before spawning any sub-tasks
   - This ensures you have full context before decomposing the research

2. **Analyze and decompose the research question:**
   - Break down the user's query into composable research areas
   - Take time to ultrathink about the underlying patterns, connections, and architectural implications the user might be seeking
   - Identify specific components, patterns, or concepts to investigate
   - Create a research plan using TodoWrite to track all subtasks
   - Consider which directories, files, or architectural patterns are relevant

3. **Spawn parallel sub-agent tasks for comprehensive research:**
   - Create multiple Task agents to research different aspects concurrently
   - We now have specialized agents that know how to do specific research tasks:

   **For codebase research:**
   - Use the **codebase-locator** agent to find WHERE files and components live
   - Use the **codebase-analyzer** agent to understand HOW specific code works (without critiquing it)
   - Use the **codebase-pattern-finder** agent to find examples of existing patterns (without evaluating them)

   **IMPORTANT**: All agents are documentarians, not critics. They will describe what exists without suggesting improvements or identifying issues.

   **For thoughts directory:**
   - Use the **thoughts-locator** agent to discover what documents exist about the topic
   - Use the **thoughts-analyzer** agent to extract key insights from specific documents (only the most relevant ones)

   **For web research (only if user explicitly asks):**
   - Use the **web-search-researcher** agent for external documentation and resources
   - IF you use web-research agents, instruct them to return LINKS with their findings, and please INCLUDE those links in your final report

   **For Linear tickets (if relevant):**
   - Use the **linear-ticket-reader** agent to get full details of a specific ticket
   - Use the **linear-searcher** agent to find related tickets or historical context

   The key is to use these agents intelligently:
   - Start with locator agents to find what exists
   - Then use analyzer agents on the most promising findings to document how they work
   - Run multiple agents in parallel when they're searching for different things
   - Each agent knows its job - just tell it what you're looking for
   - Don't write detailed prompts about HOW to search - the agents already know
   - Remind agents they are documenting, not evaluating or improving

3.5. **Consider RLM for large or information-dense research:**

The parallel sub-agent flow in step 3 is already RLM-flavored — but the **`rlm-recursive-context`** skill goes further. It encodes the discipline of programmatically slicing huge inputs and fanning out sub-agents over chunks, with intermediate results persisted to files rather than accumulated in main context.

**Reach for RLM here when**:
- The research scope spans many files or a multi-million-token codebase — beyond what a handful of `codebase-analyzer` runs can cover without lossy summarization
- The user's question requires **dense access** to nearly every part of the input ("find every X", "label all Y", "count Z across the codebase") — compaction-style synthesis loses fidelity on these
- A single file in scope (large generated file, log dump, transcript, dataset) is too large to read whole but its contents matter to the research
- Earlier sub-agents returned truncated or lossy summaries and you need to go back deeper

**How it fits this command**: RLM is a *technique* layered on top of the existing locator/analyzer agents. The findings still go into the standard research document template in step 6 — `Code References`, `Detailed Findings`, etc. RLM just gets you to those findings without ingesting the entire codebase into main context. The skill auto-invokes on long-context cues; you can request it explicitly when decomposing the research query in step 2.

4. **Wait for all sub-agents to complete and synthesize findings:**
   - IMPORTANT: Wait for ALL sub-agent tasks to complete before proceeding
   - Compile all sub-agent results (both codebase and thoughts findings)
   - Prioritize live codebase findings as primary source of truth
   - Use thoughts/ findings as supplementary historical context
   - Connect findings across different components
   - Include specific file paths and line numbers for reference
   - Highlight patterns, connections, and architectural decisions
   - Answer the user's specific questions with concrete evidence

5. **Decide: update existing or create new, then gather metadata:**
   - **First, check for an existing research doc to update**: Look in `~/thoughts/{project_name}/research/` (use `thoughts-locator` if needed) for a document whose topic covers this query. Per the "Prefer Updating Over Creating" principle above, extend an existing doc when scope overlaps and it's still reasonably sized.
   - **Gather metadata** via Bash: current commit hash (`git rev-parse HEAD`), branch (`git branch --show-current`), repo name, date/time with timezone, researcher identity (`git config user.name` or equivalent)
   - **For a new document**, use filename: `~/thoughts/{project_name}/research/YYYY-MM-DD-ENG-XXXX-description.md`
     - Format: `YYYY-MM-DD-ENG-XXXX-description.md` where:
       - YYYY-MM-DD is today's date
       - ENG-XXXX is the ticket number (omit if no ticket)
       - description is a brief kebab-case description of the research topic
     - Examples:
       - With ticket: `2025-01-08-ENG-1478-parent-child-tracking.md`
       - Without ticket: `2025-01-08-authentication-flow.md`

6. **Generate research document:**
   - Use the metadata gathered in step 4
   - Structure the document with YAML frontmatter followed by content:
     ```markdown
     ---
     date: [Current date and time with timezone in ISO format]
     researcher: [Researcher name from thoughts status]
     git_commit: [Current commit hash]
     branch: [Current branch name]
     repository: [Repository name]
     topic: "[User's Question/Topic]"
     tags: [research, codebase, relevant-component-names]
     status: complete
     last_updated: [Current date in YYYY-MM-DD format]
     last_updated_by: [Researcher name]
     ---

     # Research: [User's Question/Topic]

     **Date**: [Current date and time with timezone from step 4]
     **Researcher**: [Researcher name from thoughts status]
     **Git Commit**: [Current commit hash from step 4]
     **Branch**: [Current branch name from step 4]
     **Repository**: [Repository name]

     ## Research Question
     [Original user query]

     ## Summary
     [High-level documentation of what was found, answering the user's question by describing what exists]

     ## Detailed Findings

     ### [Component/Area 1]
     - Description of what exists ([file.ext:line](link))
     - How it connects to other components
     - Current implementation details (without evaluation)

     ### [Component/Area 2]
     ...

     ## Code References
     - `path/to/file.py:123` - Description of what's there
     - `another/file.ts:45-67` - Description of the code block

     ## Architecture Documentation
     [Current patterns, conventions, and design implementations found in the codebase]

     ## Historical Context (from thoughts/)
     [Relevant insights from `~/thoughts/{project_name}/` with references]
     - `~/thoughts/{project_name}/research/something.md` - Earlier research on X
     - `~/thoughts/{project_name}/plans/notes.md` - Plan referencing Y

     ## Related Research
     [Links to other research documents in `~/thoughts/{project_name}/research/`]

     ## Open Questions
     [Any areas that need further investigation]
     ```

7. **Add GitHub permalinks (if applicable):**
   - Check if on main branch or if commit is pushed: `git branch --show-current` and `git status`
   - If on main/master or pushed, generate GitHub permalinks:
     - Get repo info: `gh repo view --json owner,name`
     - Create permalinks: `https://github.com/{owner}/{repo}/blob/{commit}/{file}#L{line}`
   - Replace local file references with permalinks in the document

8. **Present findings:**
   - Present a concise summary of findings to the user
   - Include key file references for easy navigation
   - Ask if they have follow-up questions or need clarification

9. **Handle follow-up questions:**
   - If the user has follow-up questions, append to the same research document
   - Update the frontmatter fields `last_updated` and `last_updated_by` to reflect the update
   - Add `last_updated_note: "Added follow-up research for [brief description]"` to frontmatter
   - Add a new section: `## Follow-up Research [timestamp]`
   - Spawn new sub-agents as needed for additional investigation
   - Continue updating the document

## Important notes:
- Always use parallel Task agents to maximize efficiency and minimize context usage
- Always run fresh codebase research - never rely solely on existing research documents
- The thoughts/ directory provides historical context to supplement live findings
- Focus on finding concrete file paths and line numbers for developer reference
- Research documents should be self-contained with all necessary context
- Each sub-agent prompt should be specific and focused on read-only documentation operations
- Document cross-component connections and how systems interact
- Include temporal context (when the research was conducted)
- Link to GitHub when possible for permanent references
- Keep the main agent focused on synthesis, not deep file reading
- Have sub-agents document examples and usage patterns as they exist
- Explore all of thoughts/ directory, not just research subdirectory
- **CRITICAL**: You and all sub-agents are documentarians, not evaluators
- **REMEMBER**: Document what IS, not what SHOULD BE
- **NO RECOMMENDATIONS**: Only describe the current state of the codebase
- **File reading**: Always read mentioned files FULLY (no limit/offset) before spawning sub-tasks
- **Critical ordering**: Follow the numbered steps exactly
  - ALWAYS read mentioned files first before spawning sub-tasks (step 1)
  - ALWAYS wait for all sub-agents to complete before synthesizing (step 4)
  - ALWAYS gather metadata before writing the document (step 5 before step 6)
  - NEVER write the research document with placeholder values
- **Frontmatter consistency**:
  - Always include frontmatter at the beginning of research documents
  - Keep frontmatter fields consistent across all research documents
  - Update frontmatter when adding follow-up research
  - Use snake_case for multi-word field names (e.g., `last_updated`, `git_commit`)
  - Tags should be relevant to the research topic and components studied
