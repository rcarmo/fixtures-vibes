// Loaded xterm addons must be torn down while the core is still alive. Some
// addon disposers schedule viewport refreshes; letting Terminal.dispose run
// them after core disposal can leave a callback reading a missing renderer.
export function patchTerminalLifecycle(source) {
  if (source.includes('this.addonDisposables')) throw Error('Terminal lifecycle already patched');
  const pairs = [
    ['    this.loadedAddons = [];', '    this.loadedAddons = [];\n    this.addonDisposables = [];'],
    ['      this.loadedAddons.push(name);', '      this.loadedAddons.push(name);\n      this.addonDisposables.push(addon);'],
    ['    try { this.rendererAddon?.dispose?.(); } catch (error) { debugTerminalCleanup("renderer addon cleanup", error); }\n    try { this.fitAddon?.dispose?.(); } catch (error) { debugTerminalCleanup("fit addon cleanup", error); }',
     '    // Drain every successfully loaded addon, including ligatures/image, before the core.\n    for (const addon of this.addonDisposables.splice(0).reverse()) {\n      try { addon.dispose?.(); } catch (error) { debugTerminalCleanup("addon cleanup", error); }\n    }'],
  ];
  for (const [from, to] of pairs) {
    if (source.split(from).length !== 2) throw Error('Terminal lifecycle anchor drifted: ' + from);
    source = source.replace(from, to);
  }
  return source;
}
