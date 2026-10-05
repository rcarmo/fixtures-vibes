import type { PaneInstance } from './pane-types.js';

export interface RetainedPaneEntry {
  path: string;
  extensionId: string;
  host: HTMLElement;
  instance: PaneInstance;
}

/** Keeps opt-in tab panes mounted while they are inactive. */
export class RetainedPaneCache {
  private readonly entries = new Map<string, RetainedPaneEntry>();

  get(path: string, extensionId: string): RetainedPaneEntry | null {
    const entry = this.entries.get(path) ?? null;
    if (!entry) return null;
    if (entry.extensionId === extensionId) return entry;
    this.remove(path);
    return null;
  }

  set(entry: RetainedPaneEntry): void {
    const existing = this.entries.get(entry.path);
    if (existing && existing.instance !== entry.instance) {
      this.remove(entry.path);
    }
    this.entries.set(entry.path, entry);
  }

  owns(path: string, instance: PaneInstance): boolean {
    return this.entries.get(path)?.instance === instance;
  }

  /** Release ownership without disposing an instance that is moving to another host. */
  release(path: string, instance: PaneInstance): RetainedPaneEntry | null {
    const entry = this.entries.get(path) ?? null;
    if (!entry || entry.instance !== instance) return null;
    this.entries.delete(path);
    return entry;
  }

  activate(path: string | null): void {
    for (const entry of this.entries.values()) {
      const active = entry.path === path;
      entry.host.hidden = !active;
      if (active) entry.host.removeAttribute('aria-hidden');
      else entry.host.setAttribute('aria-hidden', 'true');
    }
  }

  deactivate(path: string): void {
    const entry = this.entries.get(path);
    if (!entry) return;
    entry.host.hidden = true;
    entry.host.setAttribute('aria-hidden', 'true');
  }

  remove(path: string): boolean {
    const entry = this.entries.get(path);
    if (!entry) return false;
    this.entries.delete(path);
    try {
      entry.instance.dispose();
    } finally {
      entry.host.remove();
    }
    return true;
  }

  prune(openPaths: ReadonlySet<string>): void {
    for (const path of [...this.entries.keys()]) {
      if (!openPaths.has(path)) this.remove(path);
    }
  }

  disposeAll(): void {
    for (const path of [...this.entries.keys()]) this.remove(path);
  }

  get size(): number {
    return this.entries.size;
  }
}
