import { expect, test } from 'bun:test';
import { pageRequestLifetime } from '../../src/gi-page-requests';

test('page replacement cancels requests; restore creates a fresh lifetime', () => {
    const target = new EventTarget();
    const signal = pageRequestLifetime(target as any);
    const first = signal();
    expect(first.aborted).toBe(false);
    target.dispatchEvent(new Event('pagehide'));
    expect(first.aborted).toBe(true);
    expect(signal().aborted).toBe(true);
    target.dispatchEvent(new Event('pageshow'));
    expect(signal().aborted).toBe(false);
    expect(first.aborted).toBe(true);
});
test('navigation cancels before pagehide; restoration renews the lifetime', () => {
    const target = new EventTarget();
    const signal = pageRequestLifetime(target as any);
    const active = signal();
    target.dispatchEvent(new Event('beforeunload'));
    expect(active.aborted).toBe(true);
    expect(signal().aborted).toBe(true);
    target.dispatchEvent(new Event('pagehide'));
    target.dispatchEvent(new Event('pageshow'));
    expect(signal().aborted).toBe(false);
});
test('caller abort and page abort both remain authoritative', () => {
    const target = new EventTarget();
    const signal = pageRequestLifetime(target as any);
    const caller = new AbortController();
    const combined = signal(caller.signal);
    caller.abort(); expect(combined.aborted).toBe(true);
    expect(signal().aborted).toBe(false);
    const other = signal(new AbortController().signal);
    target.dispatchEvent(new Event('pagehide'));
    expect(other.aborted).toBe(true);
});
