# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

PRISM is a toolkit of slash commands, sub-agents, and skills for structured AI coding workflows. It is a *distribution* repo: the markdown definitions here are copied into your AI coding tools by `install.sh`. It targets **Claude Code** (commands + agents + skills) and **Windsurf** (commands installed as workflows).

The name tracks five workflow phases — **P**lan, **R**esearch, **I**mplement, **S**ynthesize, **M**aintain. See `README.md` for the full catalog of what ships and how the pieces fit together.

## Repository Structure

- `commands/` — slash commands (`/<name>` in Claude Code). One markdown file per command.
- `agents/` — sub-agent definitions invoked via the Task tool (Claude Code only).
- `skills/` — skills, each a `<name>/SKILL.md` plus any bundled scripts/assets (Claude Code only).
- `install.sh` — interactive installer that copies the above into `$CLAUDE_HOME` (default `~/.claude`) and/or a Windsurf project.
- `README.md` — the source of truth for the installed catalog. Keep it in sync.
- `diff-review/` — runnable tool code (a zero-runtime-dependency Node server + React/Vite UI) backing `/diff_review`; lives at the repo root, separate from the markdown definitions, and is built/deployed by `install.sh`; `install.sh` also registers a Claude Code `Notification` hook (via `diff-review/server/install-hook.mjs`) that bridges permission prompts and idle waits to the browser as desktop notifications.

This repo ships markdown definitions plus the `diff-review/` tool; aside from `diff-review/` (which has its own Node build) there is no build step or test suite at the root, and `install.sh` is plain bash.

## Authoring Conventions

### Commands (`commands/*.md`)

```yaml
---
description: One-sentence description of what the command does.
model: opus   # optional; omit to inherit the session model
---
```

The filename (minus `.md`) becomes the command name. Bodies typically open with a `## Use Subagents As Much As Possible` section, then a step-by-step process, an output format, and guidelines.

### Sub-agents (`agents/*.md`)

```yaml
---
name: agent-name
description: What the agent does and exactly when to call it.
tools: Read, Grep, Glob, LS
model: sonnet   # sonnet for most; opus for heavy reasoning
---
```

Bodies follow a consistent shape: a role statement, a `## CRITICAL` constraints block, core responsibilities, a workflow, an output format, and guidelines.

### Skills (`skills/<name>/SKILL.md`)

```yaml
---
name: skill-name
description: What the skill covers and when to use it.
---
```

A skill directory may bundle scripts and assets alongside `SKILL.md`.

### When adding a command / agent / skill

1. Create the file(s) in the appropriate directory with correct frontmatter.
2. Update `README.md` to list it in the relevant table.
3. If other commands or agents should reference it, update them too.

## Development Conventions

### TODO Annotations

We use a priority-based TODO annotation system:

- `TODO(0)`: Critical - never merge
- `TODO(1)`: High - architectural flaws, major bugs
- `TODO(2)`: Medium - minor bugs, missing features
- `TODO(3)`: Low - polish, tests, documentation
- `TODO(4)`: Questions/investigations needed
- `PERF`: Performance optimization opportunities

## Additional Resources

- `README.md` — full catalog of commands, agents, and skills, plus the `~/thoughts/` workspace layout.
