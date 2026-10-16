// Retain the release dialog, using the shared runtime contract instead of Piclaw's private endpoint.
export function patchAboutDialog(source) {
  const pairs = [
    ["    piclaw: string;\n    piAi: string;\n    bun: string;", "    runtime: string;\n    classic: string;"],
    ["fetch('/agent/about',", "fetch('/api/runtime/config',"],
    ["setVersions(data);", "setVersions({ runtime: typeof data?.version === 'string' ? data.version : 'Unknown', classic: 'Piclaw v3.3.4-ux' });"],
    ["['PiClaw', versions?.piclaw, 'https://github.com/rcarmo/piclaw'],\n                ['pi-ai', versions?.piAi, 'https://github.com/earendil-works/pi/tree/main/packages/ai'],\n                ['Bun', versions?.bun, 'https://github.com/oven-sh/bun'],", "['Runtime', versions?.runtime, 'https://github.com/rcarmo/fixtures-vibes'],\n                ['Classic UI', versions?.classic, 'https://github.com/rcarmo/piclaw/tree/v3.3.4-ux'],"],
  ];
  for (const [from, to] of pairs) {
    if (source.split(from).length !== 2) throw new Error('About dialog adapter anchor changed');
    source = source.replace(from, to);
  }
  return source;
}
