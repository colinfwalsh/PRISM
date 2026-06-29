import net from 'node:net';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Tiny arg parser: handles --flag value pairs and bare positionals ---
function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        args[key] = argv[++i];
      } else {
        args[key] = true;
      }
    } else {
      args._.push(argv[i]);
    }
  }
  return args;
}

const [subcommand, ...rest] = process.argv.slice(2);
const args = parseArgs(rest);

async function main() {
  switch (subcommand) {
    case 'start':         return cmdStart();
    case 'next':          return cmdNext();
    case 'answer':        return cmdAnswer();
    case 'round-complete': return cmdRoundComplete();
    case 'stop':          return cmdStop();
    default:
      process.stderr.write(`Unknown subcommand: ${subcommand}\n`);
      process.stderr.write('Usage: cli.mjs <start|next|answer|round-complete|stop> [options]\n');
      process.exit(1);
  }
}

// --- start [ref] [--exact <expr>] ---
async function cmdStart() {
  const ref = args._[0];
  const exact = args.exact;

  // Find a free port
  const port = await new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const { port: p } = srv.address();
      srv.close(() => resolve(p));
    });
    srv.on('error', reject);
  });

  // Build args for the server process
  const serverPath = path.join(__dirname, 'server.mjs');
  const refArgs = [];
  if (ref) refArgs.push(ref);
  if (exact) refArgs.push('--exact', exact);

  const child = spawn(
    process.execPath,
    [serverPath, '--port', String(port), ...refArgs],
    { detached: true, stdio: 'ignore' }
  );
  child.unref();

  // Poll until the server responds
  const url = `http://localhost:${port}`;
  let ready = false;
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${url}/api/diff`, { signal: AbortSignal.timeout(1000) });
      if (r.ok) { ready = true; break; }
    } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 150));
  }

  if (!ready) {
    process.stderr.write('Server failed to start within 10s\n');
    process.exit(1);
  }

  // Open browser (best-effort; swallow errors for headless envs)
  try {
    const openCmd = process.platform === 'darwin' ? 'open'
      : process.platform === 'linux' ? 'xdg-open'
      : 'cmd';
    const openArgs = process.platform === 'win32' ? ['/c', 'start', url] : [url];
    const b = spawn(openCmd, openArgs, { detached: true, stdio: 'ignore' });
    b.unref();
  } catch { /* ignore */ }

  process.stdout.write(JSON.stringify({ url, port }) + '\n');
}

// --- next --port <N> ---
async function cmdNext() {
  const port = args.port;
  if (!port) { process.stderr.write('--port required\n'); process.exit(1); }

  const TIMEOUT_MS = 60000; // slightly longer than default POLL_MS (50s)
  const r = await fetch(`http://localhost:${port}/api/agent/next`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = await r.json();
  process.stdout.write(JSON.stringify(data) + '\n');
}

// --- answer --port <N> --question <id> --answer-file <path> ---
async function cmdAnswer() {
  const port = args.port;
  const questionId = parseInt(args.question, 10);
  const answerFile = args['answer-file'];
  if (!port || isNaN(questionId) || !answerFile) {
    process.stderr.write('--port, --question, and --answer-file are required\n');
    process.exit(1);
  }

  const markdown = readFileSync(answerFile, 'utf8');
  const r = await fetch(`http://localhost:${port}/api/agent/answer`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ questionId, markdown }),
  });
  const data = await r.json();
  process.stdout.write(JSON.stringify(data) + '\n');
}

// --- round-complete --port <N> --summary-file <path> ---
async function cmdRoundComplete() {
  const port = args.port;
  const summaryFile = args['summary-file'];
  if (!port || !summaryFile) {
    process.stderr.write('--port and --summary-file are required\n');
    process.exit(1);
  }

  const summary = readFileSync(summaryFile, 'utf8');
  const r = await fetch(`http://localhost:${port}/api/agent/round-complete`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ summary }),
  });
  const data = await r.json();
  process.stdout.write(JSON.stringify(data) + '\n');
}

// --- stop --port <N> ---
async function cmdStop() {
  const port = args.port;
  if (!port) { process.stderr.write('--port required\n'); process.exit(1); }

  try {
    const r = await fetch(`http://localhost:${port}/api/shutdown`, {
      method: 'POST',
      signal: AbortSignal.timeout(5000),
    });
    await r.json().catch(() => {});
  } catch { /* server may close socket as it exits — that's fine */ }

  process.stdout.write(JSON.stringify({ ok: true }) + '\n');
}

main().catch(err => {
  process.stderr.write(String(err) + '\n');
  process.exit(1);
});
