// xterm's overview ruler defaults to an opaque white left border. Match the
// terminal background rather than disabling the ruler/scrollbar or markers.
export function patchTerminalRuler(source) {
    const anchor = '  return {\n    background,\n    foreground,\n    cursor:';
    if (source.split(anchor).length !== 2) throw Error('Terminal ruler anchor changed');
    return source.replace(anchor, '  return {\n    background,\n    overviewRulerBorder: background,\n    foreground,\n    cursor:');
}
