/**
 * Runtime profile loading and session/model helpers for the compliance suite.
 * Black-box only: everything goes through the runtime's public HTTP interface and the fixture model control API.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

export type Profile = {
  runtime: string;
  version: string;
  external?: { baseUrl: string; modelControlUrl: string };
  lifecycle?: { prepare: string; start: string; reset?: string; env?: Record<string, string> };
  readiness: { path: string; status?: number; timeoutMs?: number };
  session: {
    create?: { method: 'POST' | 'PUT'; path: string; headers?: Record<string, string>; body?: unknown; idField?: string };
    open: string;
  };
  auth?: { mode?: 'none' | 'bearer' | 'cookie'; headers?: Record<string, string> };
  capabilities: string[];
  skips?: string;
  selectors?: Record<string, string>;
  routes?: Record<string, string>;
  tools?: { shell?: string; activate?: string };
  approval?: { button: string };
  commands?: { setAgentAvatar?: string; clearAgentAvatar?: string; selectModel?: string };
  compaction?: { when?: string; summaries: string[] };
  rateLimit?: { path: string; perMinute: number };
};

export function profilePath(): string {
  const p = process.env.FIXTURES_PROFILE;
  if (!p) throw new Error('Set FIXTURES_PROFILE to a runtime profile JSON file.');
  return resolve(p);
}

export function loadProfile(path = profilePath()): Profile & { dir: string } {
  return { ...JSON.parse(readFileSync(path, 'utf8')), dir: dirname(path) };
}

/** Canonical selectors. Profiles may override a key only when markup cannot match. */
export const canonicalSelectors: Record<string, string> = {
  appShell: '.app-shell',
  composeBox: '.compose-box',
  // A focused menu item, or the aria-selected option of a listbox.
  pickerHighlight: ':is([role="menuitem"], [role="menuitemradio"], [role="option"]):focus, [role="option"][aria-selected="true"]',
  editorText: '.cm-content',
  composeInput: '.compose-box textarea',
  sendButton: '[data-testid="send-button"]',
  stopButton: '[data-testid="stop-button"]',
  queueItem: '[data-testid="queue-item"]',
  timeline: '.timeline',
  timelinePost: '.timeline .post',
  agentPost: '.timeline .post.agent-post',
  userPost: '.timeline .post:not(.agent-post)',
  /** The keyboard-highlighted Quick actions result. */
  quickActionHighlight: '[role="option"][aria-selected="true"]',
  quickActionItem: '[role="option"]',
};

export function selector(profile: Profile, key: string): string {
  return profile.selectors?.[key] ?? canonicalSelectors[key] ?? (() => { throw new Error(`Unknown selector ${key}`); })();
}

const fill = (value: unknown, vars: Record<string, string>): unknown =>
  typeof value === 'string' ? value.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`)
    : Array.isArray(value) ? value.map(v => fill(v, vars))
    : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fill(v, vars)]))
    : value;

const pick = (obj: any, path: string) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

export class Runtime {
  constructor(readonly profile: Profile, readonly baseUrl: string, readonly modelUrl: string) {}

  static fromProfile(profile: Profile, baseUrl?: string) {
    const base = baseUrl ?? profile.external?.baseUrl ?? process.env.FIXTURES_BASE_URL;
    const model = profile.external?.modelControlUrl ?? process.env.FIXTURES_MODEL_URL;
    if (!base || !model) throw new Error('Lifecycle profile not started: run through the suite config (global setup sets FIXTURES_BASE_URL).');
    return new Runtime(profile, base.replace(/\/$/, ''), model.replace(/\/$/, ''));
  }

  has(cap: string) { return this.profile.capabilities.includes(cap); }

  /** Runtime name of a canonical tool; 'shell' takes {"command": string}. */
  toolName(canonical: 'shell') { return this.profile.tools?.[canonical] ?? 'bash'; }

  /** Directive prefix turn that activates `names` when the runtime gates tools behind an activation tool. */
  activationTurn(names: string[]): string | null {
    const tool = this.profile.tools?.activate;
    return tool ? `[tool:${tool} ${JSON.stringify({ names }).replace(/[[\]]/g, m => '\\' + m)}][after-tool:activated]` : null;
  }

  async ready() {
    const { path, status = 200, timeoutMs = 30000 } = this.profile.readiness;
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      try { if ((await fetch(this.baseUrl + path)).status === status) return; } catch {}
      await new Promise(r => setTimeout(r, 250));
    }
    throw new Error(`${this.profile.runtime} not ready at ${path}`);
  }

  /** Create a fresh session through the runtime's public API and return its URL. */
  /** `name`, when given, must be unique and handle-safe (lowercase letters, digits, hyphens). */
  async newSession(name = `fx${randomUUID().replace(/-/g, '').slice(0, 12)}`): Promise<{ id: string; url: string }> {
    const vars = { name };
    let id = 'default';
    const c = this.profile.session.create;
    if (c) {
      // Runtimes may rate-limit session creation; honour Retry-After, otherwise back off exponentially (~60s total).
      let res: Response;
      for (let attempt = 0; ; attempt++) {
        res = await fetch(this.baseUrl + fill(c.path, vars), {
          method: c.method,
          headers: { 'content-type': 'application/json', ...(this.profile.auth?.headers ?? {}), ...(c.headers ?? {}) },
          body: c.body === undefined ? undefined : JSON.stringify(fill(c.body, vars)),
        });
        if (res.status !== 429 || attempt >= 6) break;
        const wait = Number(res.headers.get('retry-after')) * 1000 || 1000 * 2 ** attempt;
        await new Promise(r => setTimeout(r, Math.min(wait, 30_000)));
      }
      if (!res.ok) throw new Error(`session create failed: ${res.status}`);
      id = String(pick(await res.json(), c.idField ?? 'id'));
    }
    return { id, url: this.baseUrl + fill(this.profile.session.open, { ...vars, id: encodeURIComponent(id) }) };
  }

  /** Script the next model requests (any kind, e.g. a compaction summary) with directive strings, in order. Replaces
   *  any earlier script; test cleanup clears it. */
  async script(prompts: (string | { when?: string; prompt: string })[]) {
    const r = await fetch(`${this.modelUrl}/control/script`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompts }) });
    if (!r.ok) throw new Error(`script: ${r.status}`);
  }

  async openGate(name: string) {
    const r = await fetch(`${this.modelUrl}/control/gates/${encodeURIComponent(name)}/open`, { method: 'POST' });
    if (!r.ok) throw new Error(`gate ${name}: ${r.status}`);
  }

  async gates(): Promise<Record<string, { open: boolean; waiting: number }>> {
    return (await fetch(`${this.modelUrl}/control/gates`)).json();
  }

  /** Simulated provider outage: the next `count` model requests fail with `status` (count 0 clears). */
  async outage(status: number, count: number) {
    const r = await fetch(`${this.modelUrl}/control/fail?status=${status}&count=${count}`, { method: 'POST' });
    if (!r.ok) throw new Error(`outage: ${r.status}`);
  }

  /** Test cleanup: release held turns, end any outage, and wait until the runtime stops talking to the model. */
  async releaseAll(timeoutMs = 30_000) {
    await fetch(`${this.modelUrl}/control/gates/open-all`, { method: 'POST' });
    await this.script([]);
    await this.outage(500, 0);
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      const h = await (await fetch(`${this.modelUrl}/control/health`)).json();
      if (!h.inflight) return;
      await new Promise(r => setTimeout(r, 200));
    }
  }

  async modelLog(): Promise<any[]> { return (await fetch(`${this.modelUrl}/control/log`)).json(); }
}

/** Unique gate names keep concurrent sessions on a shared external instance independent. */
export const gateName = (label: string) => `${label}-${randomUUID().slice(0, 8)}`;
