---
description: Opens a git diff in the browser for interactive human review with a live agent feedback loop — answer the human's questions live, apply their queued change-requests on submit, and refresh the diff each round until they finish.
model: opus
---

# Diff Review

Opens a rendered git diff in the browser and drives a live, round-trip review loop: the human highlights lines to ask questions or queue change-requests, the agent answers and applies edits, and the diff refreshes for the next round.

## Use Subagents As Much As Possible

You are the conductor of the review loop, not the implementer. Delegate to keep main-context budget flat across what may be many polling iterations:

- **coder-agent** — apply non-trivial change-requests (anything beyond a single mechanical line edit: multi-file changes, logic edits, anything requiring type-checking).
- **codebase-analyzer** — investigate *how* a specific piece of code works when a question needs more than session memory to answer.
- **codebase-locator** — find *where* relevant code lives when a question references a symbol or file you have not read.
- **utility-agent** — run verification commands (tests, lint, builds) after applying edits in a submit round.

## Process

### Step 1: Resolve TOOL_DIR

Resolve the tool directory using this precedence (use the first one that is set):

```
TOOL_DIR = $PRISM_DIFF_REVIEW_HOME
        ?? "${CLAUDE_HOME:-$HOME/.claude}/diff-review"
        ?? "./diff-review"   # dev-from-repo fallback
```

### Step 2: Start the server

Run:

```
node $TOOL_DIR/server/cli.mjs start [ref] [--exact <expr>]
```

Diff scope rules:

- No `ref` argument → diffs `HEAD` (all uncommitted changes).
- A branch or ref name (e.g. `main`) → `git diff <ref>...HEAD` (changes since that branch diverged).
- A commit-ish offset (e.g. `HEAD~3`) → `git diff <ref> HEAD`.
- `--exact "<expr>"` → the expression is passed verbatim to git diff.

The command picks a free port, spawns the server detached, waits until it is listening, auto-opens the browser, and prints:

```json
{ "url": "http://localhost:<N>", "port": N }
```

Parse `url` and `port` from that output.

### Step 3: Announce the review to the user

Tell the user:

> Review open at `<url>`. Highlight lines to ask a question or queue a change-request; Submit applies all queued changes; Finish ends the review.

### Step 4: Run the event loop

Loop until a `finish` event arrives. Each iteration is one call:

```
node $TOOL_DIR/server/cli.mjs next --port <port>
```

`next` is a blocking long-poll that returns exactly **one** event JSON and exits. Handle each event type:

---

**`question`** — `{ type: "question", id, file, side, startLine, endLine, text }`

1. Draw on session memory of *why* the highlighted change was made. If deeper investigation is needed, use codebase-analyzer or Read/Grep on the relevant file and line range.
2. Write the markdown answer to a temp file (e.g. `/tmp/answer-<id>.md`).
3. Post it:
   ```
   node $TOOL_DIR/server/cli.mjs answer --port <port> --question <id> --answer-file /tmp/answer-<id>.md
   ```
4. Continue the loop.

---

**`submit`** — `{ type: "submit", changeRequests: [...] }`

1. For each change-request, apply the edit. Use Edit/Write directly for simple, mechanical single-file changes; delegate to **coder-agent** for anything non-trivial.
2. Optionally verify with **utility-agent** (lint, tests, build) when the changed code has test coverage.
3. Write a round summary to a temp file (e.g. `/tmp/round-summary.md`) — list each change applied.
4. Signal completion:
   ```
   node $TOOL_DIR/server/cli.mjs round-complete --port <port> --summary-file /tmp/round-summary.md
   ```
   The server recomputes the diff and bumps the round counter; the browser refreshes automatically.
5. Continue the loop.

---

**`finish`** — `{ type: "finish" }`

Break out of the loop.

---

**`heartbeat`** — `{ type: "heartbeat" }`

The poll timed out with no pending events. Continue the loop immediately — no action needed. The human is still reviewing.

---

### Step 5: Stop the server

```
node $TOOL_DIR/server/cli.mjs stop --port <port>
```

### Step 6: Report

Summarize the session:

```
Review complete.

Questions answered: N
- Round 1: [brief list of questions answered]
- ...

Changes applied: N (across M submit rounds)
- Round 1: [brief list of changes]
- ...
```

## Delegating the whole command

This command's behavior is also available as the **diff-review-agent** sub-agent. Invoke it from other commands or agents when you want to hand off the entire review loop rather than drive it inline.

## Guidelines

- **Answer from knowledge first.** The most useful answers explain *why* a change exists, not just *what* it does. Use the session's context before reaching for research agents.
- **Treat change-requests as directives.** Each one is scoped to the highlighted line range; apply it as specified. When a change-request is ambiguous, interpret it conservatively (smallest change that satisfies the intent) and note the interpretation in the round summary.
- **Keep iterations bounded.** Each `next` call is one tool invocation. The loop stays flat in context no matter how many rounds the review takes.
- **Stay in the loop.** A `heartbeat` is not a failure — the human is still reviewing. Keep polling.
- **Stop cleanly.** Always call `stop` after `finish`, even if a round encountered an error.
- **Verify after submit rounds** when the change-requests touch code that is covered by tests. Broken code is worse than a slow review.
