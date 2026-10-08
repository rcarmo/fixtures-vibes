// Gi's terminal uses server-owned PTYs and reconnect/handoff fencing. Piclaw's
// Safari blanket reattach prohibition leaves the original tab permanently
// detached even though Gi can resume that PTY. Preserve delayed close recovery.
/** Adapt the two Safari-only terminal prohibitions with checked unique anchors. */
export function patchTerminalReattach(source) {
  for (const [from, to] of [
    ['  return isLikelySafariBrowser(options?.runtimeNavigator);', '  return false; // Gi server-owned PTY recovery is browser-independent.'],
  ]) {
    const count = source.split(from).length - 1;
    if (count !== 2) throw Error(`Terminal reattach guards drifted: expected two, got ${count}`);
    source = source.replaceAll(from, to);
  }
  return source;
}
