# PRISM

```
██████╗ ██████╗ ██╗███████╗███╗   ███╗      ╱│
██╔══██╗██╔══██╗██║██╔════╝████╗ ████║     ╱ │  ━━━━━ Plan
██████╔╝██████╔╝██║███████╗██╔████╔██║    ╱  │ ━━━━━━ Research
██╔═══╝ ██╔══██╗██║╚════██║██║╚██╔╝██║   ╱   │━━━━━━━ Implement
██║     ██║  ██║██║███████║██║ ╚═╝ ██║  ╱    │ ━━━━━━ Synthesize
╚═╝     ╚═╝  ╚═╝╚═╝╚══════╝╚═╝     ╚═╝ ╱_____│  ━━━━━ Maintain
```

> A toolkit of commands, sub-agents, and skills for AI coding workflows.

PRISM installs a curated set of slash commands, sub-agents, and a skill into your AI coding tools. It is currently supported in **Claude Code** (commands + agents + skills) and **Windsurf** (commands installed as workflows).

The acronym tracks the five phases of a structured coding workflow:

| Phase | What it covers |
| --- | --- |
| **P**lan | Produce a detailed, file-grounded implementation plan and iterate on it |
| **R**esearch | Document the codebase as-is — locate, analyze, find patterns |
| **I**mplement | Execute approved plans with small, well-defined coder/architect units |
| **S**ynthesize | Hand off context between sessions, resume work, capture decisions |
| **M**aintain | Validate that work matches the plan; review colleagues' branches locally |

---

## Install

```bash
./install.sh                  # interactive prompt
./install.sh --claude         # install Claude Code only
./install.sh --windsurf       # install Windsurf workflows (to CWD)
./install.sh --all            # install everywhere
./install.sh --help
```

Destinations:

- **Claude Code** → `$CLAUDE_HOME` (defaults to `~/.claude`)
  - `commands/` → `~/.claude/commands/`
  - `agents/`   → `~/.claude/agents/`
  - `skills/`   → `~/.claude/skills/`
- **Windsurf** → `$WINDSURF_PROJECT_DIR` (defaults to `./.windsurf`)
  - `commands/` → `./.windsurf/workflows/`
  - Windsurf does not natively support sub-agents or skills — only commands install as workflows.

Existing files at the destination are renamed to `<name>.bak.<timestamp>` before being overwritten, so re-running the installer is non-destructive.

### Environment overrides

| Variable | Purpose | Default |
| --- | --- | --- |
| `CLAUDE_HOME` | Claude Code install root | `$HOME/.claude` |
| `WINDSURF_PROJECT_DIR` | Windsurf `.windsurf` directory | `$PWD/.windsurf` |

---

## What gets installed

### Commands (`commands/`)

Slash commands in Claude Code (`/<name>`), or workflows in Windsurf.

| Command | Description |
| --- | --- |
| `/create_plan` | Interactively build a detailed implementation plan grounded in the codebase (uses `opus`) |
| `/iterate_plan` | Update an existing plan based on feedback, keeping it grounded in reality (uses `opus`) |
| `/implement_plan` | Execute an approved plan phase-by-phase with verification |
| `/quick_loop` | Express plan-and-implement loop for small, well-defined tasks; bails to `/create_plan` if the task is too big (uses `opus`) |
| `/validate_plan` | Verify an implementation against its plan and surface deviations |
| `/research_codebase` | Document the codebase as-is via parallel sub-agents (uses `opus`) |
| `/create_handoff` | Write a concise handoff document to transfer work to another session |
| `/resume_handoff` | Resume work from a handoff document with context recovery |
| `/local_review` | Set up a worktree to review a colleague's branch (`gh_username:branchName`) |
| `/diff_review` | Open a git diff in the browser for interactive human review with a live agent feedback loop — questions answered live, change-requests applied on Submit, diff refreshes each round (uses `opus`) |

### Sub-agents (`agents/`) — Claude Code only

Specialized agents invoked via the `Task` tool with `subagent_type`.

| Agent | Role | Model |
| --- | --- | --- |
| `architecture-agent` | Makes pattern/design judgment calls; decomposes broad work into coder-agent-sized sub-tasks. Read-only. | `opus` |
| `coder-agent` | Implements small, well-defined coding tasks with precise specs and acceptance criteria. | `sonnet` |
| `codebase-locator` | Finds **where** code lives — files, directories, components. | `sonnet` |
| `codebase-analyzer` | Explains **how** code works with `file:line` references. Documentarian, not critic. | `sonnet` |
| `codebase-pattern-finder` | Surfaces concrete examples of existing patterns to model new work after. | `sonnet` |
| `thoughts-locator` | Discovers relevant documents in the `~/thoughts/` directory. | `sonnet` |
| `thoughts-analyzer` | Deep-dives into specific thoughts documents to extract key insights. | `sonnet` |
| `web-search-researcher` | External research via `WebSearch` / `WebFetch`. | `sonnet` |
| `diff-review-agent` | Drives the interactive browser diff-review loop — answers the reviewer's questions live and applies queued change-requests on submit, until Finish. | `opus` |

The research/analyzer agents are strict **documentarians** — they describe what exists rather than recommending changes. `architecture-agent` and `coder-agent` are the action-oriented pair: architect decides and decomposes, coder executes.

### Skills (`skills/`) — Claude Code only

| Skill | Description |
| --- | --- |
| `rlm-recursive-context` | Recursive Language Models-style handling for inputs that don't fit in one pass: treat long inputs as external objects, slice them, and stitch results from sub-call variables. |

### Tools (`diff-review/`) — Claude Code only

Runnable tool code lives at the **repo root**, separate from the markdown definitions. `diff-review/` is a zero-runtime-dependency Node server plus a React/Vite UI that backs `/diff_review` and the `diff-review-agent`. `install.sh` builds it (`npm ci && npm run build`) and deploys the runtime (`server/` + `dist/` + `package.json`) to `$CLAUDE_HOME/diff-review`. It requires Node/npm; if npm is absent the installer skips it with a warning. The UI includes a PRISM logo, drag-to-select line highlighting, and desktop notifications for session start, answered questions, and new review rounds. `install.sh` also registers a Claude Code `Notification` hook (`diff-review/server/install-hook.mjs`) so permission prompts and idle waits are surfaced as clickable desktop notifications that focus the browser window.

---

## How the pieces fit together

A typical PRISM session walks through the acronym:

1. **Research** — `/research_codebase` (or `codebase-locator` + `codebase-analyzer` directly) to map out the relevant area.
2. **Plan** — `/create_plan` to produce a phased plan; `/iterate_plan` to refine it.
3. **Implement** — `/implement_plan` drives execution, delegating to `architecture-agent` and `coder-agent` for the actual edits.
4. **Synthesize** — `/create_handoff` at the end of a session; `/resume_handoff` at the start of the next.
5. **Maintain** — `/validate_plan` to confirm the implementation matches the plan; `/local_review` to inspect a colleague's branch in an isolated worktree.

For small, well-defined changes, `/quick_loop` collapses the **Plan → Implement** steps into a single express pass: quick targeted research, a short inline plan you sign off on, `coder-agent` execution, and verification — with a hard scope gate that stops and points you to `/create_plan` the moment the task proves too big (multiple subsystems, a design decision, ambiguous requirements). It writes no `~/thoughts/` artifacts; reach for the full pipeline when you need one.

### The `~/thoughts/` workspace

PRISM commands persist artifacts under `~/thoughts/{project_name}/`, where `{project_name}` is `basename $(pwd)` of the working directory. Subdirectories used by the commands:

- `~/thoughts/{project_name}/research/` — research documents
- `~/thoughts/{project_name}/plans/` — implementation plans
- `~/thoughts/{project_name}/tickets/` — ticket files
- `~/thoughts/{project_name}/handoffs/` — handoff documents

This keeps long-lived planning artifacts outside the project repo while still scoping them per-project.

---

## License

Apache License 2.0 — see [`LICENSE`](./LICENSE).
