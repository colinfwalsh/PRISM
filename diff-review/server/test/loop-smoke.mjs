/**
 * loop-smoke.mjs — end-to-end smoke test for the diff-review agent⇄server⇄browser loop.
 * No model calls. Plays both "browser" and "stub agent" against the real server.
 * Pure Node built-ins + global fetch (Node 24).
 */

import { spawn } from 'node:child_process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_MJS = path.resolve(__dirname, '../server.mjs');
const REPO_ROOT = path.resolve(__dirname, '../../..');

// Overall safety timeout — can never hang forever.
const watchdog = setTimeout(() => {
  console.error('TIMEOUT: test did not complete within 25s');
  process.exit(1);
}, 25000);
watchdog.unref(); // don't hold the event loop open if everything finishes normally

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

let BASE; // set after port is known

function getJson(urlPath) {
  return fetch(BASE + urlPath).then(r => {
    if (!r.ok) throw new Error(`GET ${urlPath} → ${r.status}`);
    return r.json();
  });
}

function postJson(urlPath, body) {
  return fetch(BASE + urlPath, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => {
    if (!r.ok) throw new Error(`POST ${urlPath} → ${r.status}`);
    return r.json();
  });
}

/**
 * Repeatedly calls fn() every ~150ms until predicate(result) is true.
 * Throws a labeled error if timeoutMs elapses.
 */
async function waitFor(fn, predicate, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let result;
    try { result = await fn(); } catch { /* server not yet up */ }
    if (result !== undefined && predicate(result)) return result;
    await new Promise(r => setTimeout(r, 150));
  }
  throw new Error(`Timeout (${timeoutMs}ms) waiting for: ${label}`);
}

// ---------------------------------------------------------------------------
// Stub agent loop — runs concurrently with the browser script
// ---------------------------------------------------------------------------

function startAgentLoop(state) {
  let done;
  const promise = new Promise(r => { done = r; });

  (async () => {
    try {
      while (true) {
        let ev;
        try {
          ev = await getJson('/api/agent/next');
        } catch {
          break; // server gone
        }

        if (ev.type === 'question') {
          await postJson('/api/agent/answer', {
            questionId: ev.id,
            markdown: `**Stub answer** to Q${ev.id}: resolved.`,
          });
          state.questionsAnswered++;

        } else if (ev.type === 'submit') {
          state.submitCRCount = ev.changeRequests.length;
          await postJson('/api/agent/round-complete', {
            summary: `Applied ${state.submitCRCount} change(s).`,
          });
          state.roundsApplied++;

        } else if (ev.type === 'finish') {
          state.agentSawFinish = true;
          break;

        }
        // heartbeat → continue
      }
    } finally {
      done();
    }
  })();

  return promise;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const port = await getFreePort();
  BASE = `http://localhost:${port}`;

  const child = spawn(
    process.execPath,
    [SERVER_MJS, '--port', String(port)],
    {
      cwd: REPO_ROOT,
      env: { ...process.env, DIFF_REVIEW_POLL_MS: '800' },
      stdio: 'ignore',
    }
  );

  const state = {
    questionsAnswered: 0,
    submitCRCount: 0,
    roundsApplied: 0,
    agentSawFinish: false,
  };

  let passed = false;

  try {
    // 1. Wait for server to be ready (up to 10s).
    await waitFor(
      () => getJson('/api/diff').catch(() => undefined),
      r => r && typeof r.round === 'number',
      10000,
      'server ready'
    );

    // 2. Start the stub agent loop — fire-and-forget for now.
    const agentPromise = startAgentLoop(state);

    // 3. Browser script.

    // a. Post a question.
    const { id: qId } = await postJson('/api/questions', {
      file: 'CLAUDE.md', side: 'new', startLine: 1, endLine: 2, text: 'why?',
    });

    // b. Poll for the answer (long-poll endpoint; 8s budget).
    const answersResult = await waitFor(
      () => getJson(`/api/answers?since=0`),
      r => Array.isArray(r.answers) && r.answers.some(a => a.questionId === qId),
      8000,
      `answer to question ${qId}`
    );
    const foundAnswer = answersResult.answers.find(a => a.questionId === qId);
    if (!foundAnswer.markdown.includes('Stub answer')) {
      throw new Error(`Answer markdown did not contain "Stub answer": ${foundAnswer.markdown}`);
    }

    // c. Post a change-request.
    await postJson('/api/change-requests', {
      file: 'LICENSE', side: 'new', startLine: 1, endLine: 1, text: 'tweak',
    });

    // d. Submit (snapshots change-requests → agent gets submit event → calls round-complete).
    await postJson('/api/submit', {});

    // e. Poll until round bumps to 2 (GET /api/diff is not long-polled; 8s budget).
    await waitFor(
      () => getJson('/api/diff'),
      r => r.round === 2,
      8000,
      'round to become 2'
    );

    // f. Signal finish.
    await postJson('/api/finish', {});

    // 4. Await agent loop (safety cap 10s).
    await Promise.race([
      agentPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Agent loop did not exit within 10s after finish')), 10000)
      ),
    ]);

    // 5. Assertions.
    if (state.questionsAnswered < 1)
      throw new Error(`Expected >= 1 question answered, got ${state.questionsAnswered}`);
    if (!foundAnswer.markdown.includes('Stub answer'))
      throw new Error('Answer markdown check failed');
    if (state.submitCRCount !== 1)
      throw new Error(`Expected exactly 1 change-request in submit event, got ${state.submitCRCount}`);
    if (!state.agentSawFinish)
      throw new Error('Agent loop did not see finish event');

    passed = true;

  } finally {
    // 6. Cleanup — kill server regardless of outcome.
    try { await postJson('/api/shutdown', {}); } catch { /* best-effort */ }
    child.kill();
  }

  // 7. Output & exit (after finally so cleanup always runs).
  if (passed) {
    clearTimeout(watchdog);
    console.log('PASS checklist:');
    console.log(`  [x] ${state.questionsAnswered} question(s) answered by stub agent`);
    console.log('  [x] Answer markdown contained "Stub answer"');
    console.log(`  [x] Round bumped to 2 after ${state.roundsApplied} round-complete call(s)`);
    console.log(`  [x] Submit event carried exactly ${state.submitCRCount} change-request(s)`);
    console.log('  [x] Agent loop received finish event and exited cleanly');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
