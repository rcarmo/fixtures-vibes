// Pure catalogue projection: auto presets show both palettes, fixed presets
// show their own mode. Never sample the currently applied page's CSS.
export const previewColorKeys = ['bgPrimary', 'bgSecondary', 'textPrimary', 'textSecondary', 'borderColor', 'accent', 'danger', 'success'] as const;
export function themePreviews(preset: any) {
    if (!preset) return [];
    const modes = preset.mode === 'auto' ? ['light', 'dark'] : [preset.mode];
    return modes.flatMap(mode => {
        const palette = preset[mode] || preset.dark || preset.light;
        if (!palette) return [];
        return [{ mode, colors: previewColorKeys.map(key => ({ key, color: palette[key] })).filter(entry => typeof entry.color === 'string' && entry.color) }];
    });
}
