---
description: Code review of the current working branch (or a specified branch)
---

# Local Review

You are tasked with performing a code review of changes on the current working branch, or on a branch specified as an argument.

## Process

1. **Determine the branch to review**:
   - If an argument is provided, use it as the branch name to review.
   - Otherwise, use the current branch (`git rev-parse --abbrev-ref HEAD`).
   - Identify the base branch (usually `main` or `master` — check `git symbolic-ref refs/remotes/origin/HEAD` or fall back to `main`).
   - If the branch to review is the same as the base branch, inform the user there is nothing to review and stop.

2. **Gather the diff**:
   - Run `git fetch origin` to make sure refs are up to date.
   - Get the list of changed files: `git diff --name-status BASE...BRANCH`
   - Get the full diff: `git diff BASE...BRANCH`
   - Get the commit history: `git log --oneline BASE..BRANCH`

3. **Review the changes**:
   - Read each changed file in full (not just the diff) so context around the changes is clear.
   - Evaluate the changes for:
     - **Correctness**: bugs, logic errors, edge cases, error handling
     - **Security**: injection risks, auth/authz issues, secret handling, OWASP concerns
     - **Design**: appropriateness of abstractions, coupling, code organization
     - **Consistency**: matches existing patterns and conventions in the codebase
     - **Tests**: adequate coverage for the changes, missing test cases
     - **Performance**: obvious inefficiencies, N+1 queries, unnecessary work
     - **Readability**: naming, comments where genuinely needed, clarity

4. **Report findings**:
   - Group findings by severity: **Blocking**, **Should fix**, **Nits/suggestions**.
   - For each finding, cite the file and line number (`path/to/file.ts:42`).
   - Be specific — explain *what* is wrong and *why*, and propose a concrete fix where possible.
   - If the branch looks good overall, say so explicitly; don't manufacture issues.

## Example Usage

```
/local_review
```
Reviews the current working branch against the base branch.

```
/local_review feature/new-thing
```
Reviews `feature/new-thing` against the base branch.
