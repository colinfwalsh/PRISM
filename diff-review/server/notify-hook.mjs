#!/usr/bin/env node
// Claude Code "Notification" hook bridge for the diff-review tool.
//
// Claude Code pipes a Notification payload to this script on stdin whenever it
// needs the user's attention (e.g. a permission prompt or an idle wait). We
// look up the running diff-review server via its session file and POST the
// message to /api/notify, so the browser can raise a desktop notification.
//
// This must NEVER block or fail Claude Code: it always exits 0, times out fast,
// and silently no-ops when no diff-review session is active.

import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

function done() {
  process.exit(0);
}

// Watchdog: never hang the harness, even if stdin never closes.
setTimeout(done, 3000);

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  raw += chunk;
});
process.stdin.on("end", async () => {
  try {
    const payload = raw ? JSON.parse(raw) : {};
    const message = payload.message || "Claude Code needs your attention.";
    const kind = payload.notification_type || "notification";

    const CLAUDE_HOME =
      process.env.CLAUDE_HOME || path.join(os.homedir(), ".claude");
    const sessionFile = path.join(CLAUDE_HOME, "diff-review", ".session.json");

    let session;
    try {
      session = JSON.parse(readFileSync(sessionFile, "utf8"));
    } catch {
      done(); // no active diff-review session — nothing to bridge
      return;
    }
    if (!session || !session.port) {
      done();
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    try {
      await fetch(`http://127.0.0.1:${session.port}/api/notify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: String(message), kind: String(kind) }),
        signal: controller.signal,
      });
    } catch {
      /* server gone / unreachable — ignore */
    } finally {
      clearTimeout(timer);
    }
  } catch {
    /* malformed payload — ignore */
  }
  done();
});
