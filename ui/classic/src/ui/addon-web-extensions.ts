// Classic hosts no Piclaw add-on web extensions, so no add-on resolves a standalone tab URL (the vendored Piclaw 3.2.5
// tab strip asks before falling back to its built-in viewer routes).
export function resolveAddonStandaloneTabUrl(_path: string, _context: { hasPopOutTab?: boolean } = {}): string | null {
    return null;
}
