---
name: rlm-recursive-context
description: Process inputs that are too large or too complex to reason about in a single pass by treating them as an external environment and programmatically decomposing them with sub-agents. Use when: (1) input clearly exceeds what fits comfortably in context (huge files, long PDFs/transcripts, multi-file codebases, large corpora, million-token inputs); (2) the task requires dense access to nearly every part of a long input (counting, aggregation, pairwise comparison, semantic labeling across N items); (3) the task is a complex compositional reasoning problem with interdependent subproblems that benefit from explicit decomposition into a graph of sub-calls; (4) user mentions "long context", "context rot", "too long to fit", "RLM", or "recursive language model". Skip for short inputs that fit easily or simple single-step tasks.
---

# RLM-Style Recursive Context Handling

## What this is

An adaptation of **Recursive Language Models** (Zhang, Kraska, Khattab — MIT CSAIL, arXiv:2512.24601) to Claude Code. The paper's core insight: don't feed arbitrarily long prompts directly into the model. Treat the prompt as an **external object** in a programmatic environment, and write code that **inspects, slices, and recursively dispatches sub-calls** over pieces of it. Final answers are **stitched together from sub-call results stored as variables**, not generated in one autoregressive sweep.

The paper shows this beats vanilla LLM calls, context compaction, retrieval scaffolds, and coding agents on long-context and information-dense tasks — by double-digit margins, at comparable cost.

## The three design choices that make this work

From the paper (Section 2), these are non-negotiable:

1. **Symbolic handle, not inlined text.** Long inputs live in files or REPL variables. The main conversation context holds only metadata (length, structure, a short prefix) and pointers — never the full text.
2. **Output is built, not generated.** The final answer is assembled from sub-call results held in variables/files. This lets outputs exceed any single model call's window.
3. **Symbolic recursion.** Sub-calls are launched **programmatically** inside loops over slices — not by verbalizing "now I'll handle chunk 1, now chunk 2..." in the main turn. This is what gives you Ω(N) or Ω(N²) semantic work over an N-token input.

If you skip any of these, you've reverted to a worse scaffold (the paper's Algorithm 2).

## Mapping the paper to Claude Code tools

| Paper concept | Claude Code equivalent |
|---|---|
| Long prompt `P` as REPL variable | Input written to a file (or loaded once via `Bash` + Python); file path passed around |
| `llm_query(prompt)` — single sub-LLM call | `Agent` with `subagent_type=general-purpose` or `Explore` over one slice |
| `rlm_query(context, query)` — recursive sub-RLM call (depth>1) | `Agent` with `subagent_type=general-purpose`, prompted to itself use this skill on its slice |
| Python REPL with persistent state | `Bash` running Python scripts; intermediate buffers written to `/tmp/` files |
| `FINAL_VAR(...)` — return a variable | Read the aggregated buffer file and synthesize in your final turn |
| Truncated stdout previews | Use `Read` with `offset`/`limit`; `wc -l`, `head`, length checks before reading whole files |

## When to invoke this pattern

Reach for it when **at least one** of these is true:

- The input file/corpus is large enough that reading it whole would burn most of the context window (rule of thumb: >50K tokens, definitely >200K).
- The task requires **dense access** to nearly every part of the input — e.g., "count all X", "find every pair where...", "label each item as...", "aggregate across all documents". Compaction destroys these.
- The task is **compositional with interdependent subproblems** — a reasoning graph where each node is itself non-trivial (LongCoT-mini-style).
- You've already tried a single-shot approach and the model lost track / hallucinated / truncated.

Do **not** reach for it when the input fits comfortably and a direct read + answer would work. RLM-style scaffolding adds latency, cost, and complexity; spend that budget only when the alternative is worse.

## The canonical RLM loop, adapted

1. **Probe, don't ingest.** Establish metadata first: file size, line count, structure (markdown headers? JSON? code? plain prose?), a short prefix. Use `wc`, `head`, `file`, or a small Python script via `Bash`. Do **not** `Read` the whole thing yet.

2. **Choose a decomposition.** This is the most important step — the paper finds that the *first* decomposition attempt dominates final quality (Figure 4a). Pick chunking that matches the task:
   - **Independent items** (documents, log lines, test cases): chunk by item, one sub-agent per batch.
   - **Structured text** (markdown, code repo): chunk by section/file, sub-agent per section.
   - **Pairwise reasoning**: chunk into batches sized so each sub-agent can hold a meaningful window of pairs.
   - **Long flat prose** (transcript, book): chunk by character/token count with rolling-buffer context.

3. **Launch sub-agents in parallel over slices.** The paper batches aggressively to control cost ("aim for ~200K characters per sub-call"). In Claude Code:
   - Send **one message with multiple `Agent` tool calls** so they run concurrently.
   - Give each sub-agent: (a) its slice (as file path + offset/limit, or as inline text if small), (b) the *specific question* you want answered about that slice, (c) instruction to return a short structured answer (not the whole slice back).
   - Tell sub-agents to **report in under N words** to keep their results small.

4. **Persist intermediate buffers.** Sub-agent answers go into a buffer file (or a Python list written via Bash). Never accumulate raw chunks in the main context.

5. **Aggregate.** Either:
   - **Cheap aggregation**: synthesize directly from the buffer in your main turn (if the buffer fits).
   - **Expensive aggregation**: another `Agent` call over the buffer with the original question.

6. **Recurse only when a sub-task is itself complex.** If a single chunk is *still* too large or hard for one sub-agent, spawn a sub-agent and tell it to use this same skill on its slice. The paper notes recursion depth >1 mostly helps on information-dense tasks (OOLONG-Pairs) and hurts when the underlying model is error-prone — don't recurse for its own sake.

## Decomposition patterns (steal these)

The paper's prompts include three canonical patterns. They translate directly:

**Pattern A — Probe + chunk + aggregate** (general long input):
```
1. Inspect: wc -l, head, identify structure
2. Decide chunk size based on task complexity
3. For each chunk: spawn Agent with question + slice
4. Collect short answers into a buffer
5. Spawn one final Agent (or self-synthesize) to answer the original question from the buffer
```

**Pattern B — Section-wise with rolling state** (when later sections depend on earlier ones):
```
1. Identify section boundaries (headers, chapters, files)
2. Iterate sequentially: pass the previous "running summary" + the new section to a sub-agent
3. Sub-agent returns updated running summary
4. Final summary is the answer (or feeds one more synthesis pass)
```

**Pattern C — Decompose into a reasoning graph** (compositional / LongCoT-mini):
```
1. Identify subproblems and their dependencies
2. Topologically sort
3. Solve leaf nodes via sub-agents in parallel
4. Solve dependent nodes once their inputs are ready
5. Root node's answer is final
```

## Cost / quality guardrails

- **Batch aggressively.** Each sub-agent call has fixed overhead. Prefer 10 sub-agents with ~50K-char slices over 100 sub-agents with ~5K-char slices.
- **Truncate intermediate previews.** When a sub-agent returns, store the answer to a file; don't let large outputs accumulate in main context.
- **Cap recursion depth.** Default to depth=1 (sub-agents that don't themselves recurse). Only go deeper if a specific chunk genuinely needs it. The paper shows depth >2 rarely helps and amplifies error rates.
- **Watch for syntax/script errors in batched code.** The paper notes weaker models accumulate errors that cascade through sub-calls. If you're scripting chunking in Bash/Python, validate the script on one small chunk before fan-out.
- **Prime the first decomposition with an example.** When you spawn the first sub-agent, include a one-line "the way to approach this slice is: ..." hint. The paper shows this dominates outcomes (Figure 4a).

## Anti-patterns to avoid

- **Reading the whole long input into context "just to see what's there."** Probe with metadata first.
- **Verbalizing the recursion** ("Let me look at chunk 1... now chunk 2... now chunk 3..."). Do it in code/tool calls, not in narration.
- **Letting sub-agents return their entire input.** They should return *answers*, not echoes.
- **Aggregating in main context when the buffer itself is huge.** That just defers the same problem one level. Spawn an aggregator agent instead.
- **Recursing because it sounds principled.** Depth costs latency and amplifies errors. Justify each layer.

## Quick reference: parallel sub-agents

When you need N independent sub-calls, send **one** message containing N `Agent` blocks. Example shape (not literal code):

```
Agent(description="chunk 1 of 4", subagent_type="general-purpose",
      prompt="<question>. Your slice: <file>:<line-range>. Return <N words>.")
Agent(description="chunk 2 of 4", ...)
Agent(description="chunk 3 of 4", ...)
Agent(description="chunk 4 of 4", ...)
```

The harness runs them concurrently. Their results land back together, ready for aggregation.

## Reference: the paper's actual system prompt

For comparison, this is the prompt the authors used to make GPT-5 act as an RLM (Appendix C.1a, lightly cleaned). The Claude Code adaptation above encodes the same discipline using `Agent` + files in place of `llm_query` + REPL variables.

> You are tasked with answering a query with associated context. You can access, transform, and analyze this context interactively in a REPL environment that can recursively query sub-LLMs, which you are strongly encouraged to use as much as possible. You will be queried iteratively until you provide a final answer.
>
> Your context is a {context_type} with {context_total_length} total characters, broken into chunks of lengths: {context_lengths}.
>
> The REPL is initialized with:
> 1. A `context` variable containing the input.
> 2. A `llm_query(prompt)` function that calls a sub-LLM (handles ~500K chars).
> 3. (depth>1 only) An `rlm_query(context, query)` function that spawns a full RLM loop for complex sub-tasks.
> 4. `print()` to view REPL output.
>
> You will only see truncated REPL outputs, so use `llm_query` on variables you want to analyze. Use variables as buffers to build up your final answer.
>
> An example strategy: figure out a chunking strategy, break the context into smart chunks, query an LLM per chunk with a specific question, save answers to a buffer, then query an LLM with all buffers to produce your final answer. Sub-LLMs are powerful — a viable strategy is 10 documents per sub-LLM query.
>
> When done, return `FINAL(answer)` or `FINAL_VAR(variable_name)`.

The paper finds (Figure 4a) that including worked decomposition examples in the system prompt dominates final quality — even unrelated examples help by priming correct decomposition behavior. That's why the "Decomposition patterns" section exists above.
