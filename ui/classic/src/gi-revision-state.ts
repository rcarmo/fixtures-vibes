// Opaque loaded revisions are document baselines, not freshness tokens to fetch at save time.
export type Revision = string | number;
export function validRevision(value: unknown): value is Revision {
    return (typeof value === 'string' && value.length > 0) || (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0);
}
export function snapshotRevision(snapshot: any): Revision | null {
    return snapshot && typeof snapshot.text === 'string' && snapshot.truncated === false && validRevision(snapshot.revision) ? snapshot.revision : null;
}
export function requireRevision(value: unknown): Revision {
    if (!validRevision(value)) throw Object.assign(new Error('Revision-safe persistence is unavailable; this document is read-only.'), { code: 'revision_required' });
    return value;
}
export function isRevisionConflict(error: any): boolean {
    return error?.status === 409 && ['revision_conflict', 'plan_revision_conflict', 'file_revision_conflict'].includes(error?.code);
}

/** Confirm the exact snapshot whose revision will authorise Overwrite; never adopt a revision from an error. */
export async function reviewOverwrite(doc: Document, path: string, snapshot: any): Promise<boolean> {
    requireRevision(snapshotRevision(snapshot));
    // Use the owner's native confirmation, as the shared conflict workflow already does for Reload.
    // Suppressed dialogs or a detached document fail closed. Never truncate the reviewed snapshot.
    return doc.defaultView?.confirm(`Overwrite saved version of ${path} with your draft?\n\nCurrent saved content:\n${snapshot.text}\n\nAnother change will cause a new conflict.`) === true;
}
