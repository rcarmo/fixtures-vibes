import { test, expect } from 'bun:test';
import { SSEClient } from '../../src/gi-sse-client';

class FakeSource {
  static sources: FakeSource[] = [];
  handlers = new Map<string, Function>();
  onerror: Function | null = null;
  closed = false;
  constructor(public url: string) { FakeSource.sources.push(this); }
  addEventListener(type: string, handler: Function) { this.handlers.set(type, handler); }
  close() { this.closed = true; }
  emit(type: string, data: any = {}) { this.handlers.get(type)?.({ data: JSON.stringify(data) }); }
}

test('extension requests and Plan statuses cross the live SSE transport without reshaping', () => {
  const old = globalThis.EventSource;
  globalThis.EventSource = FakeSource as any;
  const events: any[] = [];
  const client = new SSEClient((type, data) => events.push({ type, data }), () => {}, { chatJid: 'gi:A' });
  try {
    client.connect(); const first = FakeSource.sources.at(-1)!;
    client.forceReconnect(); const live = FakeSource.sources.at(-1)!;
    const request = { kind: 'custom', request_id: 'one', chat_jid: 'gi:A', options: { action: 'open_workspace_file', path: 'notes/a.md' } };
    const status = { key: 'plan.changes', chat_jid: 'gi:A', source: 'tool' };
    first.emit('extension_ui_request', request); first.emit('extension_ui_status', status);
    live.emit('extension_ui_request', request); live.emit('extension_ui_status', status);
    expect(events).toEqual([{ type: 'extension_ui_request', data: request }, { type: 'extension_ui_status', data: status }]);
    client.disconnect(); live.emit('extension_ui_request', request);
    expect(events).toHaveLength(2);
  } finally { client.disconnect(); globalThis.EventSource = old; }
});

test('closed and superseded SSE sources cannot deliver status/data or create reconnect timers', () => {
  const old = globalThis.EventSource;
  globalThis.EventSource = FakeSource as any;
  const events: string[] = [], statuses: string[] = [];
  const client = new SSEClient(type => events.push(type), status => statuses.push(status), { chatJid: 'gi:A' });
  try {
    client.connect(); const first = FakeSource.sources.at(-1)!;
    // Reconnect while still connecting must create a fresh connection.
    client.forceReconnect(); const second = FakeSource.sources.at(-1)!;
    expect(second).not.toBe(first);
    first.emit('connected'); first.emit('agent_draft_delta'); first.onerror?.();
    expect(events).toEqual([]); expect(statuses).toEqual([]); expect(client.reconnectTimeout).toBeNull();
    second.emit('connected'); second.emit('queue_changed');
    expect(events).toEqual(['connected', 'queue_changed']); expect(statuses).toEqual(['connected']);
    second.onerror?.(); expect(second.closed).toBe(true); expect(client.status).toBe('disconnected');
    second.emit('agent_draft_delta'); second.emit('extension_ui_request'); second.emit('extension_ui_status');
    expect(events).toEqual(['connected', 'queue_changed']);
    client.disconnect(); expect(client.reconnectTimeout).toBeNull();
    second.onerror?.(); expect(client.reconnectTimeout).toBeNull();
  } finally { client.disconnect(); globalThis.EventSource = old; }
});
