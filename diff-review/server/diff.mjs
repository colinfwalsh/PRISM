import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Run `git diff` and parse the output into structured JSON.
 *
 * @param {string|undefined} ref   - Branch/tag/commit-ish to diff against HEAD.
 * @param {string|undefined} exact - Verbatim extra args forwarded to `git diff`.
 * @returns {{ baseRef: string|null, files: object[] }}
 */
export async function computeDiff(ref, exact) {
  let diffArgs;
  let baseRef;

  if (exact) {
    // Verbatim user-supplied args, split on whitespace to avoid shell injection.
    diffArgs = ['diff', '--no-color', ...exact.trim().split(/\s+/)];
    baseRef = exact;
  } else if (!ref) {
    // No ref: compare HEAD against the working tree (staged + unstaged).
    diffArgs = ['diff', '--no-color', 'HEAD'];
    baseRef = null;
  } else if (ref === 'HEAD' || ref.includes('~') || ref.includes('^')) {
    // Commit-ish offset (e.g. HEAD~3): two-dot range.
    diffArgs = ['diff', '--no-color', ref, 'HEAD'];
    baseRef = ref;
  } else {
    // Plain branch/tag name: three-dot PR-style from merge-base.
    diffArgs = ['diff', '--no-color', `${ref}...HEAD`];
    baseRef = ref;
  }

  const { stdout } = await execFileAsync('git', diffArgs, {
    cwd: process.cwd(),
    maxBuffer: 64 * 1024 * 1024,
  });

  const files = parseDiff(stdout);
  return { baseRef, files };
}

// ---------------------------------------------------------------------------
// Unified-diff parser
// ---------------------------------------------------------------------------

const HUNK_HEADER_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/;

function parseDiff(diffText) {
  if (!diffText.trim()) return [];

  const rawLines = diffText.split('\n');
  const files = [];

  let currentFile = null;
  let currentHunk = null;
  // Running line-number cursors, reset per hunk.
  let oldLineNo = 0;
  let newLineNo = 0;

  const finalizeHunk = () => {
    if (currentHunk && currentFile) {
      currentFile.hunks.push(currentHunk);
      currentHunk = null;
    }
  };

  const finalizeFile = () => {
    if (currentFile) {
      finalizeHunk();
      files.push(currentFile);
      currentFile = null;
    }
  };

  for (const line of rawLines) {
    // -----------------------------------------------------------------------
    // New file section
    // -----------------------------------------------------------------------
    if (line.startsWith('diff --git ')) {
      finalizeFile();

      // Extract fallback paths from "diff --git a/<old> b/<new>".
      // These are used when ---/+++ lines are absent (pure renames, binary files).
      const m = line.match(/^diff --git a\/(.*) b\/(.*)$/);
      currentFile = {
        oldPath: m ? m[1] : null,
        newPath: m ? m[2] : null,
        status: 'modified',
        hunks: [],
      };
      currentHunk = null;
      continue;
    }

    if (!currentFile) continue;

    // -----------------------------------------------------------------------
    // File-header metadata lines
    // -----------------------------------------------------------------------
    if (line.startsWith('new file mode')) {
      currentFile.status = 'added';
    } else if (line.startsWith('deleted file mode')) {
      currentFile.status = 'deleted';
    } else if (line.startsWith('rename from ')) {
      currentFile.oldPath = line.slice('rename from '.length);
      currentFile.status = 'renamed';
    } else if (line.startsWith('rename to ')) {
      currentFile.newPath = line.slice('rename to '.length);
      currentFile.status = 'renamed';

    // -----------------------------------------------------------------------
    // --- / +++ path lines (may override fallback / rename paths)
    // -----------------------------------------------------------------------
    } else if (line.startsWith('--- ')) {
      const rest = line.slice(4);
      if (rest === '/dev/null') {
        currentFile.oldPath = null;
      } else {
        currentFile.oldPath = rest.startsWith('a/') ? rest.slice(2) : rest;
      }
    } else if (line.startsWith('+++ ')) {
      const rest = line.slice(4);
      if (rest === '/dev/null') {
        currentFile.newPath = null;
      } else {
        currentFile.newPath = rest.startsWith('b/') ? rest.slice(2) : rest;
      }

    // -----------------------------------------------------------------------
    // Hunk header  "@@ -old,count +new,count @@ optional-context"
    // -----------------------------------------------------------------------
    } else if (line.startsWith('@@ ')) {
      finalizeHunk();

      const m = HUNK_HEADER_RE.exec(line);
      if (!m) continue; // malformed — skip

      const oldStart = parseInt(m[1], 10);
      const newStart = parseInt(m[3], 10);
      oldLineNo = oldStart;
      newLineNo = newStart;

      currentHunk = {
        oldStart,
        oldLines: m[2] !== undefined ? parseInt(m[2], 10) : 1,
        newStart,
        newLines: m[4] !== undefined ? parseInt(m[4], 10) : 1,
        header: line,
        lines: [],
      };

    // -----------------------------------------------------------------------
    // Hunk body lines
    // -----------------------------------------------------------------------
    } else if (currentHunk) {
      if (line === '\\ No newline at end of file') {
        // Skip — do not emit and do not advance counters.
        continue;
      }

      const marker = line[0];
      const content = line.slice(1);

      if (marker === ' ') {
        currentHunk.lines.push({
          type: 'context',
          oldLineNo: oldLineNo++,
          newLineNo: newLineNo++,
          content,
        });
      } else if (marker === '-') {
        currentHunk.lines.push({
          type: 'del',
          oldLineNo: oldLineNo++,
          newLineNo: null,
          content,
        });
      } else if (marker === '+') {
        currentHunk.lines.push({
          type: 'add',
          oldLineNo: null,
          newLineNo: newLineNo++,
          content,
        });
      }
      // Any other marker (e.g. empty trailing line from split) is ignored.
    }
  }

  // Flush the last file/hunk.
  finalizeFile();

  return files;
}
