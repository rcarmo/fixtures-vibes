// Classic hosts no Piclaw add-on web extensions (add-ons are out of scope), so this stands in for Piclaw's
// ui/addon-web-extensions.ts with empty registries: no add-on resolves a standalone tab URL (the tab strip then falls
// back to its built-in viewer routes) or an attachment preview (the preview modal then uses its built-in kinds).
export function resolveAddonStandaloneTabUrl(_path: string, _context: { hasPopOutTab?: boolean } = {}): string | null {
    return null;
}

export function resolveAddonAttachmentPreview(_contentType: unknown, _filename?: unknown): null {
    return null;
}

export function getAddonAttachmentPreviewLabel(_kind: string | null | undefined): string | null {
    return null;
}

export function getAddonAttachmentPreviewNote(_kind: string | null | undefined): string | null {
    return null;
}

export function buildAddonAttachmentPreviewFrameUrl(_kind: string | null | undefined, _mediaId: number | string, _filename?: string): string | null {
    return null;
}
