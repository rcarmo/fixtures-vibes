#!/usr/bin/env bun
/**
 * fixture-model-server — runtime-neutral deterministic model for fixtures-vibes.
 *
 * OpenAI-compatible `/v1/chat/completions` (streaming and non-streaming) plus a control API,
 * so compliance tests can script and hold turns without runtime internals.
 *
 * Directives are read from the latest user (or tool) message, in order. They form a script:
 *   [think:TEXT]       stream TEXT as reasoning (`reasoning_content` deltas)
 *   [gate:NAME]        pause here until POST /control/gates/NAME/open (anything before it is already streamed)
 *   [say:TEXT]         stream TEXT as visible content (may repeat; each is one chunk)
 *   [reply:TEXT]       shorthand: the whole visible reply (if no [say:])
 *   [chunks:N]         split [reply:]/default text into N chunks
 *   [usage:P]          report usage.prompt_tokens = P (completion = visible length/4, min 1)
 *   [tool:NAME JSON]   respond with one tool call NAME(JSON) instead of content
 *   [after-tool:TEXT]  reply used for the follow-up request that carries the tool result
 *   [fail:STATUS]      respond with HTTP STATUS before streaming
 *   [after-tool-fail:STATUS]  respond with HTTP STATUS to the request that carries the tool result
 * A literal backslash-n (\n) inside a directive value becomes a newline.
 * Without directives the reply is `Fixture reply: <last line of the prompt>` (runtimes wrap prompts differently).
 *
 * Control API:
 *   GET  /control/health
 *   POST /control/reset            fail held requests, forget all gates, clear the log and any outage
 *   POST /control/fail?status=S&count=N  fail the next N completion requests with HTTP S (count=0 clears)
 *   GET  /control/gates            { name: { open, waiting } }
 *   POST /control/gates/NAME/open
 *   POST /control/gates/open-all   release every held request (cleanup between tests)
 *   GET  /control/health           { ok, inflight } — completion requests not yet finished
 *   GET  /control/log              received requests (model, roles, last text, directives, offered tools, tool result, aborted)
 */

type Waiter = { resolve: () => void; reject: (e: Error) => void };
type Gate = { open: boolean; waiters: Waiter[] };
type Step =
  | { kind: "think" | "say"; text: string }
  | { kind: "gate"; name: string };

const gates = new Map<string, Gate>();
let outage: { status: number; remaining: number } | null = null;
let inflight = 0;
const log: Array<Record<string, unknown>> = [];

const gate = (name: string): Gate => {
  let g = gates.get(name);
  if (!g) gates.set(name, (g = { open: false, waiters: [] }));
  return g;
};
const waitGate = (name: string, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const g = gate(name);
    if (g.open) return resolve();
    const w: Waiter = { resolve, reject };
    g.waiters.push(w);
    signal.addEventListener("abort", () => {
      const i = g.waiters.indexOf(w);
      if (i >= 0) g.waiters.splice(i, 1);
      reject(new Error("aborted"));
    }, { once: true });
  });

const textOf = (content: unknown): string =>
  typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content.map((p: any) => (typeof p?.text === "string" ? p.text : "")).join("")
      : "";

// Values may contain escaped brackets (\[ and \]) so tool arguments can carry Markdown checklists.
const DIRECTIVE = /\[(think|gate|say|reply|chunks|usage|tool|after-tool-fail|after-tool|fail):((?:\\[\[\]]|[^\]])*)\]/g;
const HAS_DIRECTIVE = new RegExp(DIRECTIVE.source);
const unbracket = (v: string) => v.replace(/\\([\[\]])/g, "$1");

function plan(text: string) {
  // A literal backslash-n inside a directive value becomes a newline, so single-line prompts can script Markdown.
  const all = [...text.matchAll(DIRECTIVE)].map((m) => ({ k: m[1], v: unbracket(m[1] === "tool" ? m[2] : m[2].replace(/\\n/g, "\n")) }));
  const first = (k: string) => all.find((d) => d.k === k)?.v;
  const lastLine = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).pop() || "";
  const visible = lastLine.replace(DIRECTIVE, "").trim();
  const steps: Step[] = [];
  for (const d of all) {
    if (d.k === "think") steps.push({ kind: "think", text: d.v });
    else if (d.k === "gate") steps.push({ kind: "gate", name: d.v });
    else if (d.k === "say") steps.push({ kind: "say", text: d.v });
  }
  if (!steps.some((s) => s.kind === "say")) {
    const reply = first("reply") ?? `Fixture reply: ${visible}`;
    const n = Math.max(1, Math.min(Number(first("chunks") || 1), reply.length || 1));
    const size = Math.ceil(reply.length / n) || 1;
    for (let i = 0; i < reply.length; i += size) steps.push({ kind: "say", text: reply.slice(i, i + size) });
    if (!reply.length) steps.push({ kind: "say", text: "" });
  }
  const tool = first("tool");
  let toolCall: { name: string; args: string } | null = null;
  if (tool !== undefined) {
    const sp = tool.indexOf(" ");
    toolCall = { name: sp < 0 ? tool : tool.slice(0, sp), args: sp < 0 ? "{}" : tool.slice(sp + 1) };
  }
  return {
    steps, toolCall, afterTool: first("after-tool"), afterToolFail: first("after-tool-fail"), fail: first("fail"),
    usage: first("usage") ? Number(first("usage")) : undefined, directives: all,
  };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const port = Number(process.env.FIXTURE_MODEL_PORT || 9920);
let seq = 0;

Bun.serve({
  port,
  hostname: process.env.FIXTURE_MODEL_HOST || "127.0.0.1",
  idleTimeout: 0,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/control/health") return json({ ok: true, inflight });
    if (url.pathname === "/control/reset" && req.method === "POST") {
      // Fail held requests so no stray reply lands after the scenario that owned them.
      for (const g of gates.values()) g.waiters.splice(0).forEach((w) => w.reject(new Error("reset")));
      gates.clear();
      log.length = 0;
      outage = null;
      return json({ ok: true });
    }
    if (url.pathname === "/control/fail" && req.method === "POST") {
      // Simulated provider outage: the next `count` completion requests fail with `status` (count=0 clears).
      const status = Number(url.searchParams.get("status") || 500);
      const count = Number(url.searchParams.get("count") || 1);
      outage = count > 0 ? { status, remaining: count } : null;
      return json({ ok: true, outage });
    }
    if (url.pathname === "/control/gates") {
      return json(Object.fromEntries([...gates].map(([k, g]) => [k, { open: g.open, waiting: g.waiters.length }])));
    }
    if (url.pathname === "/control/gates/open-all" && req.method === "POST") {
      // Release every held request (test cleanup); unlike reset, held turns complete normally.
      for (const g of gates.values()) { g.open = true; g.waiters.splice(0).forEach((w) => w.resolve()); }
      return json({ ok: true });
    }
    const open = url.pathname.match(/^\/control\/gates\/([^/]+)\/open$/);
    if (open && req.method === "POST") {
      const g = gate(decodeURIComponent(open[1]));
      g.open = true;
      g.waiters.splice(0).forEach((w) => w.resolve());
      return json({ ok: true });
    }
    if (url.pathname === "/control/log") return json(log);
    // Two interchangeable models, so model selection can be tested without any real provider.
    if (url.pathname === "/v1/models") return json({ object: "list", data: ["fixture-1", "fixture-2"].map((id) => ({ id, object: "model" })) });
    if (url.pathname !== "/v1/chat/completions" || req.method !== "POST") return json({ error: "not found" }, 404);
    inflight++;
    let res: Response;
    try { res = await completion(req); } catch (e) { inflight--; throw e; }
    if (!res.body || !(res.headers.get("content-type") || "").includes("event-stream")) { inflight--; return res; }
    let settled = false;
    const settle = () => { if (!settled) { settled = true; inflight--; } };
    const counted = res.body.pipeThrough(new TransformStream({ flush: settle }));
    req.signal.addEventListener("abort", settle);
    return new Response(counted, { status: res.status, headers: res.headers });
  },
});

async function completion(req: Request): Promise<Response> {
  {

    const body: any = await req.json();
    const messages: any[] = body.messages || [];
    const last = messages[messages.length - 1];
    // The current turn's user messages: runtimes may append context (e.g. a Plan) as extra user messages after the
    // prompt, and tool follow-ups add assistant tool_calls + tool results. Prefer the one that carries directives.
    const turnUsers: any[] = [];
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "tool" || (m.role === "assistant" && m.tool_calls?.length)) continue;
      if (m.role !== "user") break;
      turnUsers.unshift(m);
    }
    const lastUser = turnUsers.find((m) => HAS_DIRECTIVE.test(textOf(m.content)))
      ?? [...messages].reverse().find((m) => m.role === "user");
    const prompt = textOf(lastUser?.content);
    const p = plan(prompt);
    const toolFollowUp = last?.role === "tool";
    const entry: Record<string, unknown> = {
      at: new Date().toISOString(), model: body.model, roles: messages.map((m) => m.role),
      prompt: prompt.split(/\r?\n/).filter(Boolean).pop() || "", directives: p.directives,
      // Expanded skills in the turn's prompt (pi `/skill:<name>` → `<skill name="…" …>` block).
      skills: [...prompt.matchAll(/<skill name="([^"]+)"/g)].map((m) => m[1]),
      toolFollowUp, stream: !!body.stream, aborted: false,
      tools: (body.tools || []).map((t: any) => t?.function?.name).filter(Boolean),
      ...(toolFollowUp ? { toolResult: textOf(last.content).slice(0, 2000) } : {}),
    };
    log.push(entry);

    if (outage && outage.remaining > 0) {
      outage.remaining -= 1;
      const status = outage.status;
      if (outage.remaining === 0) outage = null;
      entry.outage = status;
      return json({ error: { message: `fixture outage ${status}` } }, status);
    }
    if (p.fail) return json({ error: { message: `fixture failure ${p.fail}` } }, Number(p.fail) || 500);

    // A tool result arrived: answer with [after-tool:] or echo the tool output.
    let steps = p.steps;
    let toolCall = p.toolCall;
    if (toolFollowUp && p.afterToolFail) {
      return json({ error: { message: `fixture failure ${p.afterToolFail} after tool` } }, Number(p.afterToolFail) || 500);
    }
    if (toolFollowUp) {
      toolCall = null;
      const reply = p.afterTool ?? `Fixture tool result: ${textOf(last.content).slice(0, 200)}`;
      steps = [{ kind: "say", text: reply }];
    }

    const id = `fixture-${++seq}`;
    const created = Math.floor(Date.now() / 1000);
    const visibleText = steps.filter((s) => s.kind === "say").map((s: any) => s.text).join("");
    const usage = {
      prompt_tokens: p.usage ?? 10,
      completion_tokens: Math.max(1, Math.ceil(visibleText.length / 4)),
      total_tokens: (p.usage ?? 10) + Math.max(1, Math.ceil(visibleText.length / 4)),
    };
    const toolCalls = toolCall
      ? [{ id: `call_${seq}`, type: "function", function: { name: toolCall.name, arguments: toolCall.args } }]
      : null;

    if (!body.stream) {
      for (const s of steps) if (s.kind === "gate") {
        try { await waitGate(s.name, req.signal); } catch { entry.aborted = true; return new Response(null, { status: 499 }); }
      }
      const reasoning = steps.filter((s) => s.kind === "think").map((s: any) => s.text).join("");
      return json({
        id, object: "chat.completion", created, model: body.model, usage,
        choices: [{
          index: 0, finish_reason: toolCalls ? "tool_calls" : "stop",
          message: { role: "assistant", content: toolCalls ? null : visibleText, ...(reasoning ? { reasoning_content: reasoning } : {}), ...(toolCalls ? { tool_calls: toolCalls } : {}) },
        }],
      });
    }

    const enc = new TextEncoder();
    const frame = (delta: Record<string, unknown>, finish: string | null = null, extra: Record<string, unknown> = {}) =>
      enc.encode(`data: ${JSON.stringify({ id, object: "chat.completion.chunk", created, model: body.model, choices: [{ index: 0, delta, finish_reason: finish }], ...extra })}\n\n`);
    const stream = new ReadableStream({
      async start(c) {
        try {
          c.enqueue(frame({ role: "assistant" }));
          for (const s of steps) {
            if (s.kind === "gate") await waitGate(s.name, req.signal);
            else if (s.kind === "think") c.enqueue(frame({ reasoning_content: s.text }));
            else if (!toolCalls && s.text) c.enqueue(frame({ content: s.text }));
          }
          if (toolCalls) {
            c.enqueue(frame({ tool_calls: toolCalls.map((t, index) => ({ index, ...t })) }));
            c.enqueue(frame({}, "tool_calls", { usage }));
          } else {
            c.enqueue(frame({}, "stop", { usage }));
          }
          c.enqueue(enc.encode("data: [DONE]\n\n"));
          c.close();
        } catch {
          entry.aborted = true;
          try { c.close(); } catch {}
        }
      },
      cancel() { entry.aborted = true; },
    });
    return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache" } });
  }
}
console.log(`fixture-model-server listening on ${port}`);
