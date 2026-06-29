import http from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { computeDiff } from './diff.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, '..', 'dist');

const POLL_MS = parseInt(process.env.DIFF_REVIEW_POLL_MS) || 50000;

const CLAUDE_HOME = process.env.CLAUDE_HOME || path.join(os.homedir(), '.claude');
const SESSION_FILE = path.join(CLAUDE_HOME, 'diff-review', '.session.json');

// --- Argument parsing ---
const argv = process.argv.slice(2);
let port = null;
let ref = undefined;
let exact = undefined;

for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--port') {
    port = parseInt(argv[++i]);
  } else if (argv[i] === '--exact') {
    exact = argv[++i];
  } else if (!argv[i].startsWith('-')) {
    ref = argv[i];
  }
}

if (!port) {
  process.stderr.write('Usage: server.mjs --port <N> [ref] [--exact <expr>]\n');
  process.exit(1);
}

// --- Session state ---
let round = 1;
let diff = { baseRef: null, files: [] };
let questions = [];
let changeRequests = [];
let answers = [];
let submitPending = null;
let finishPending = false;
let lastSummary = null;

let nextQuestionId = 1;
let nextChangeRequestId = 1;
let nextAnswerSeq = 1;

let notifications = [];
let notifySeq = 0;

// Long-poll waiter registries
let agentWaiters = [];   // { resolve, timerId }
let browserWaiters = []; // { resolve, since, timerId }

// --- Utilities ---

function readJsonBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString();
      if (!body.trim()) { resolve({}); return; }
      try { resolve(JSON.parse(body)); } catch { resolve({}); }
    });
  });
}

function sendJson(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(body);
}

// --- Agent channel ---

function pickAgentItem() {
  const q = questions.find(q => q.status === 'pending');
  if (q) {
    q.status = 'in-flight';
    return { type: 'question', id: q.id, file: q.file, side: q.side,
             startLine: q.startLine, endLine: q.endLine, text: q.text };
  }
  if (submitPending) {
    const item = { type: 'submit', changeRequests: submitPending.changeRequests };
    submitPending = null;
    return item;
  }
  if (finishPending) {
    return { type: 'finish' };
  }
  return null;
}

function wakeAgentChannel() {
  if (agentWaiters.length === 0) return;
  const item = pickAgentItem();
  if (!item) return;
  const waiter = agentWaiters.shift();
  clearTimeout(waiter.timerId);
  waiter.resolve(item);
}

// --- Browser channel ---

function getAnswersSince(since) {
  return answers.filter(a => a.seq > since);
}

function wakeBrowserChannel(force = false) {
  let i = 0;
  while (i < browserWaiters.length) {
    const waiter = browserWaiters[i];
    const newAnswers = getAnswersSince(waiter.since);
    if (force || newAnswers.length > 0) {
      browserWaiters.splice(i, 1);
      clearTimeout(waiter.timerId);
      const cursor = newAnswers.length > 0 ? Math.max(...newAnswers.map(a => a.seq)) : waiter.since;
      waiter.resolve({ answers: newAnswers, cursor });
    } else {
      i++;
    }
  }
}

// --- Session portfile ---

function removeSessionFile() {
  try { unlinkSync(SESSION_FILE); } catch {}
}

process.on('exit', removeSessionFile);
process.on('SIGTERM', () => { removeSessionFile(); process.exit(0); });
process.on('SIGINT', () => { removeSessionFile(); process.exit(0); });

// --- Static file serving ---

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
};

const PLACEHOLDER = '<!doctype html><title>diff-review</title><p>UI not built yet.</p>';

function serveStatic(req, res) {
  const parsed = new URL(req.url, 'http://localhost');
  let urlPath = parsed.pathname;
  const isRoot = urlPath === '/';
  if (isRoot) urlPath = '/index.html';

  const filePath = path.resolve(DIST_DIR, '.' + urlPath);
  if (!filePath.startsWith(DIST_DIR)) {
    sendJson(res, { error: 'forbidden' }, 403);
    return;
  }

  if (existsSync(filePath)) {
    const ext = path.extname(filePath);
    res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' });
    res.end(readFileSync(filePath));
  } else if (isRoot) {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(PLACEHOLDER);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
}

// --- HTTP server ---

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const { pathname } = url;

  if (!pathname.startsWith('/api/')) {
    if (req.method === 'GET') return serveStatic(req, res);
    res.writeHead(405); res.end(); return;
  }

  try {
    // GET /api/diff
    if (req.method === 'GET' && pathname === '/api/diff') {
      return sendJson(res, { round, baseRef: diff.baseRef, files: diff.files });
    }

    // POST /api/questions
    if (req.method === 'POST' && pathname === '/api/questions') {
      const body = await readJsonBody(req);
      const id = nextQuestionId++;
      questions.push({ id, file: body.file, side: body.side,
                       startLine: body.startLine, endLine: body.endLine,
                       text: body.text, status: 'pending' });
      wakeAgentChannel();
      return sendJson(res, { id });
    }

    // GET /api/change-requests
    if (req.method === 'GET' && pathname === '/api/change-requests') {
      return sendJson(res, { changeRequests });
    }

    // POST /api/change-requests
    if (req.method === 'POST' && pathname === '/api/change-requests') {
      const body = await readJsonBody(req);
      const id = nextChangeRequestId++;
      changeRequests.push({ id, file: body.file, side: body.side,
                            startLine: body.startLine, endLine: body.endLine,
                            text: body.text });
      return sendJson(res, { id });
    }

    // DELETE /api/change-requests/:id
    const crDelMatch = /^\/api\/change-requests\/(\d+)$/.exec(pathname);
    if (req.method === 'DELETE' && crDelMatch) {
      const id = parseInt(crDelMatch[1]);
      changeRequests = changeRequests.filter(cr => cr.id !== id);
      return sendJson(res, { ok: true });
    }

    // GET /api/answers?since=<cursor>
    if (req.method === 'GET' && pathname === '/api/answers') {
      const rawSince = url.searchParams.get('since');
      const since = (rawSince !== null && !isNaN(parseInt(rawSince, 10)))
        ? parseInt(rawSince, 10) : 0;
      const nowAnswers = getAnswersSince(since);
      if (nowAnswers.length > 0) {
        const cursor = Math.max(...nowAnswers.map(a => a.seq));
        return sendJson(res, { answers: nowAnswers, cursor });
      }
      const data = await new Promise(resolve => {
        const timerId = setTimeout(() => {
          const idx = browserWaiters.findIndex(w => w.resolve === resolve);
          if (idx !== -1) browserWaiters.splice(idx, 1);
          resolve({ answers: [], cursor: since, heartbeat: true });
        }, POLL_MS);
        browserWaiters.push({ resolve, since, timerId });
      });
      return sendJson(res, data);
    }

    // GET /api/agent/next
    if (req.method === 'GET' && pathname === '/api/agent/next') {
      const item = pickAgentItem();
      if (item) return sendJson(res, item);
      const data = await new Promise(resolve => {
        const timerId = setTimeout(() => {
          const idx = agentWaiters.findIndex(w => w.resolve === resolve);
          if (idx !== -1) agentWaiters.splice(idx, 1);
          resolve({ type: 'heartbeat' });
        }, POLL_MS);
        agentWaiters.push({ resolve, timerId });
      });
      return sendJson(res, data);
    }

    // POST /api/agent/answer
    if (req.method === 'POST' && pathname === '/api/agent/answer') {
      const body = await readJsonBody(req);
      const q = questions.find(q => q.id === body.questionId);
      if (q) q.status = 'answered';
      const seq = nextAnswerSeq++;
      answers.push({ seq, questionId: body.questionId, markdown: body.markdown, ts: Date.now() });
      wakeBrowserChannel();
      return sendJson(res, { ok: true });
    }

    // POST /api/submit
    if (req.method === 'POST' && pathname === '/api/submit') {
      submitPending = { changeRequests: [...changeRequests] };
      wakeAgentChannel();
      return sendJson(res, { ok: true });
    }

    // POST /api/agent/round-complete
    if (req.method === 'POST' && pathname === '/api/agent/round-complete') {
      const body = await readJsonBody(req);
      try {
        diff = await computeDiff(ref, exact);
      } catch { /* keep existing diff */ }
      round++;
      changeRequests = [];
      questions = [];
      lastSummary = body.summary;
      wakeBrowserChannel(true);
      return sendJson(res, { round });
    }

    // POST /api/finish
    if (req.method === 'POST' && pathname === '/api/finish') {
      finishPending = true;
      wakeAgentChannel();
      return sendJson(res, { ok: true });
    }

    // POST /api/notify
    if (req.method === 'POST' && pathname === '/api/notify') {
      const body = await readJsonBody(req);
      if (!body.message) {
        return sendJson(res, { error: 'message required' }, 400);
      }
      notifySeq += 1;
      notifications.push({ seq: notifySeq, message: String(body.message), kind: body.kind ? String(body.kind) : 'info', ts: Date.now() });
      return sendJson(res, { ok: true });
    }

    // GET /api/notifications?since=<n>
    if (req.method === 'GET' && pathname === '/api/notifications') {
      const rawSince = url.searchParams.get('since');
      const since = (rawSince !== null && !isNaN(parseInt(rawSince, 10)))
        ? parseInt(rawSince, 10) : 0;
      return sendJson(res, { notifications: notifications.filter(n => n.seq > since), cursor: notifySeq });
    }

    // POST /api/shutdown
    if (req.method === 'POST' && pathname === '/api/shutdown') {
      sendJson(res, { ok: true });
      server.close();
      setTimeout(() => process.exit(0), 50);
      return;
    }

    sendJson(res, { error: 'not found' }, 404);
  } catch (err) {
    try { sendJson(res, { error: String(err) }, 500); } catch { /* already sent */ }
  }
});

// --- Startup ---
try {
  diff = await computeDiff(ref, exact);
} catch {
  diff = { baseRef: null, files: [] };
}

server.listen(port, () => {
  // Goes to stderr so it's visible in foreground/debug runs but harmless when
  // the CLI spawns the server detached with stdio:"ignore".
  console.error(`diff-review server listening on http://localhost:${port}`);
  mkdirSync(path.dirname(SESSION_FILE), { recursive: true });
  writeFileSync(SESSION_FILE, JSON.stringify({ port, url: `http://localhost:${port}`, pid: process.pid, startedAt: Date.now() }));
});
