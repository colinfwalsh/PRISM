#!/usr/bin/env node
// Idempotently registers the diff-review "Notification" hook in
// $CLAUDE_HOME/settings.json so permission prompts / idle waits get bridged to
// the browser as desktop notifications. Preserves any existing settings and
// other Notification hooks; re-running replaces only our own entry.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const CLAUDE_HOME =
  process.env.CLAUDE_HOME || path.join(os.homedir(), ".claude");
const settingsPath = path.join(CLAUDE_HOME, "settings.json");
const hookScript = path.join(CLAUDE_HOME, "diff-review", "server", "notify-hook.mjs");
const command = `node "${hookScript}"`;
const matcher = "permission_prompt|idle_prompt";
const MARKER = "diff-review/server/notify-hook.mjs";

let settings = {};
try {
  settings = JSON.parse(readFileSync(settingsPath, "utf8"));
} catch {
  /* missing or unparsable — start fresh */
}

if (typeof settings !== "object" || settings === null) settings = {};
if (typeof settings.hooks !== "object" || settings.hooks === null) {
  settings.hooks = {};
}

const existing = Array.isArray(settings.hooks.Notification)
  ? settings.hooks.Notification
  : [];

const isOurs = (entry) =>
  entry &&
  Array.isArray(entry.hooks) &&
  entry.hooks.some(
    (h) => typeof h?.command === "string" && h.command.includes(MARKER)
  );

const cleaned = existing.filter((e) => !isOurs(e));
cleaned.push({ matcher, hooks: [{ type: "command", command }] });
settings.hooks.Notification = cleaned;

mkdirSync(CLAUDE_HOME, { recursive: true });
writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
console.log(`Registered diff-review Notification hook in ${settingsPath}`);
