#!/usr/bin/env bun
// Probe a running runtime for the read-only (GET) surface listed in ui/API.md.
// Usage: bun ui/classic/scripts/probe-api.ts <base-url> [session-id]
// The route list is parsed from API.md, so the document stays the single source.
// File routes are probed with ?path= set to the first file in /api/workspace/tree, so the workspace needs one file.
// A route counts as served unless it answers 404 without a JSON {error} body, 405 or 501.
// Exit status is 1 when the boot checks fail or any listed GET route is not served.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const base = (process.argv[2] ?? "").replace(/\/$/, "");
if (!base) {
  console.error("usage: probe-api.ts <base-url> [session-id]");
  process.exit(2);
}

type Row = { section: string; path: string };

function getRoutes(markdown: string): Row[] {
  const rows: Row[] = [];
  let section = "";
  for (const line of markdown.split("\n")) {
    if (line.startsWith("## ")) section = line.slice(3).trim();
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length < 4 || !/^(GET|POST|PUT|PATCH|DELETE|WebSocket)\b/.test(cells[1])) continue;
    // Paths after an explicit method word inside the cell (e.g. "...; GET `/x`") are GET too.
    const methods = cells[1];
    for (const m of cells[2].matchAll(/(?:\b(GET|POST|PUT|PATCH|DELETE)\s+)?`(\/[^`\s]*)`/g)) {
      const method = m[1] ?? (methods.includes("GET") ? "GET" : "");
      if (method !== "GET") continue;
      const path = m[2].split("?")[0];
      if (/\{(?!s\})[^}]+\}/.test(path)) continue; // needs a resource id
      rows.push({ section, path });
    }
  }
  return [...new Map(rows.map((r) => [r.path, r])).values()];
}

async function served(url: string): Promise<{ status: number; ok: boolean }> {
  const res = await fetch(url, { headers: { accept: "application/json" }, redirect: "manual" });
  const body = await res.text();
  if (res.status === 405 || res.status === 501) return { status: res.status, ok: false };
  if (res.status === 404) {
    try {
      return { status: 404, ok: typeof JSON.parse(body)?.error === "string" };
    } catch {
      return { status: 404, ok: false };
    }
  }
  return { status: res.status, ok: true };
}

async function firstEvent(url: string): Promise<string> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 3000);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { accept: "text/event-stream" } });
    const reader = res.body!.getReader();
    let text = "";
    while (!text.includes("\n\n")) {
      const { value, done } = await reader.read();
      if (done) break;
      text += new TextDecoder().decode(value);
    }
    return /^event:\s*(\S+)/m.exec(text)?.[1] ?? "";
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
    ctl.abort();
  }
}

const apiDoc = readFileSync(join(import.meta.dir, "../../API.md"), "utf8");
const failures: string[] = [];

// Boot checks: the app does not mount without these.
const auth = await fetch(`${base}/api/auth/status`).then((r) => r.json()).catch(() => null);
const authOk = auth?.mode === "single-user" &&
  ["enrolled", "authenticated", "totp_enabled", "browser_login_available"].every((k) => typeof auth[k] === "boolean");
if (!authOk) failures.push("boot: /api/auth/status policy shape");

let session = process.argv[3] ?? "";
if (!session) {
  const list = await fetch(`${base}/api/sessions`).then((r) => r.json()).catch(() => null);
  session = list?.sessions?.[0]?.id ?? "";
}
if (!session) failures.push("boot: /api/sessions lists no session (pass a session id)");

const event = session ? await firstEvent(`${base}/sse/stream?chat_jid=gi:${encodeURIComponent(session)}`) : "";
if (event !== "connected") failures.push(`boot: /sse/stream first event is "${event}", not "connected"`);

// File routes answer a plain 404 for a missing file; probe them with a file that exists.
function firstFile(node: any): string {
  if (!node || typeof node !== "object") return "";
  if (node.type === "file" && typeof node.path === "string") return node.path;
  for (const child of [...(node.children ?? []), ...(node.root ? [node.root] : [])]) {
    const found = firstFile(child);
    if (found) return found;
  }
  return "";
}
const file = firstFile(await fetch(`${base}/api/workspace/tree`).then((r) => r.json()).catch(() => null));
const fileRoute = /^(\/api)?\/workspace\/(file|raw|stat)$/;
if (!file) failures.push("boot: /api/workspace/tree lists no file (file routes need one)");

console.log(`boot  auth/status ${authOk ? "ok" : "FAIL"}  session ${session || "-"}  sse ${event || "-"}  file ${file || "-"}`);

let section = "";
for (const row of getRoutes(apiDoc)) {
  if (row.section !== section) console.log(`\n## ${(section = row.section)}`);
  let path = row.path.replace("{s}", encodeURIComponent(session));
  if (fileRoute.test(row.path)) path += `?path=${encodeURIComponent(file)}`;
  const { status, ok } = await served(base + path).catch(() => ({ status: 0, ok: false }));
  console.log(`${ok ? "served " : "MISSING"} ${String(status).padStart(3)}  GET ${row.path}`);
  if (!ok) failures.push(`GET ${row.path}`);
}

console.log(`\n${failures.length ? `${failures.length} missing or failing:\n  ${failures.join("\n  ")}` : "all listed GET routes served"}`);
process.exit(failures.length ? 1 : 0);
