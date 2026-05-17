---
description: Set up worktree for reviewing colleague's branch
---

# Local Review

You are tasked with setting up a local review environment for a colleague's branch. This involves creating a worktree, setting up dependencies, and launching a new Claude Code session.

## Process

When invoked with a parameter like `gh_username:branchName`:

1. **Parse the input**:
   - Extract GitHub username and branch name from the format `username:branchname`
   - If no parameter provided, ask for it in the format: `gh_username:branchName`

2. **Extract ticket information**:
   - Look for ticket numbers in the branch name (e.g., `eng-1696`, `ENG-1696`)
   - Use this to create a short worktree directory name
   - If no ticket found, use a sanitized version of the branch name

3. **Set up the remote and worktree**:
   - Determine the repo name from `basename $(git rev-parse --show-toplevel)` — this is both the project name and the GitHub repo name.
   - Check if the remote already exists using `git remote -v`
   - If not, add it: `git remote add USERNAME git@github.com:USERNAME/PROJECT_NAME`
   - Fetch from the remote: `git fetch USERNAME`
   - Create worktree: `git worktree add -b BRANCHNAME ~/wt/PROJECT_NAME/SHORT_NAME USERNAME/BRANCHNAME`

4. **Configure the worktree**:
   - Copy Claude settings if present: `cp .claude/settings.local.json WORKTREE/.claude/ 2>/dev/null || true`
   - Run setup if the project has a Makefile target: `make -C WORKTREE setup` (skip if no `setup` target exists)

## Error Handling

- If worktree already exists, inform the user they need to remove it first
- If remote fetch fails, check if the username/repo exists
- If setup fails, provide the error but continue with the launch

## Example Usage

```
/local_review samdickson22:sam/eng-1696-hotkey-for-yolo-mode
```

This will:
- Add 'samdickson22' as a remote (using the current repo name — e.g. if CWD is `~/code/my-app`, this resolves to `git@github.com:samdickson22/my-app`)
- Create worktree at `~/wt/{project_name}/eng-1696`
- Set up the environment
