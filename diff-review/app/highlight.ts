// highlight.ts — per-line Prism highlighting for diff cells.
//
// LIMITATION: tokenization is per-line, so multi-line constructs (block
// comments, multi-line template strings/heredocs) may mis-highlight. This is
// the accepted v1 tradeoff — DiffLine is per-line and hunks interleave del/add
// buffers, so cross-line lexer state cannot be carried correctly.
import * as Prism from "prismjs";
import "prismjs/components/prism-markup-templating"; // prereq for php
import "prismjs/components/prism-typescript";        // <- javascript
import "prismjs/components/prism-jsx";               // <- markup + javascript
import "prismjs/components/prism-tsx";               // <- jsx + typescript
import "prismjs/components/prism-c";                 // <- clike
import "prismjs/components/prism-cpp";               // <- c
import "prismjs/components/prism-csharp";            // <- clike
import "prismjs/components/prism-java";              // <- clike
import "prismjs/components/prism-scala";             // <- java
import "prismjs/components/prism-kotlin";            // <- clike
import "prismjs/components/prism-go";                // <- clike
import "prismjs/components/prism-ruby";              // <- clike
import "prismjs/components/prism-php";               // <- markup-templating
import "prismjs/components/prism-scss";              // <- css
import "prismjs/components/prism-markdown";          // <- markup
import "prismjs/components/prism-python";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-json";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-toml";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-swift";
import "prismjs/components/prism-lua";
import "prismjs/components/prism-perl";
import "prismjs/components/prism-docker";
import "prismjs/components/prism-graphql";
import "prismjs/components/prism-diff";

const EXT_TO_LANG: Record<string, string> = {
  js: "javascript", mjs: "javascript", cjs: "javascript", jsx: "jsx",
  ts: "typescript", tsx: "tsx", py: "python", go: "go", rs: "rust",
  json: "json", yml: "yaml", yaml: "yaml", toml: "toml",
  css: "css", scss: "scss", html: "markup", xml: "markup", svg: "markup",
  sh: "bash", bash: "bash", zsh: "bash", md: "markdown", sql: "sql",
  java: "java", c: "c", h: "c", cc: "cpp", cpp: "cpp", hpp: "cpp",
  cs: "csharp", rb: "ruby", php: "php", swift: "swift", kt: "kotlin",
  kts: "kotlin",
  scala: "scala", lua: "lua", pl: "perl", graphql: "graphql", gql: "graphql",
};
const BASENAME_TO_LANG: Record<string, string> = {
  dockerfile: "docker", makefile: "bash",
};

export function languageForPath(path: string | null): string | null {
  if (!path) return null;
  const base = path.split("/").pop()!.toLowerCase();
  if (BASENAME_TO_LANG[base]) return BASENAME_TO_LANG[base];
  const ext = base.includes(".") ? base.slice(base.lastIndexOf(".") + 1) : "";
  return EXT_TO_LANG[ext] ?? null;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;")
          .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function highlightLine(content: string, lang: string | null): string {
  if (!content) return "";
  if (lang && Prism.languages[lang]) {
    return Prism.highlight(content, Prism.languages[lang], lang);
  }
  return escapeHtml(content);
}
