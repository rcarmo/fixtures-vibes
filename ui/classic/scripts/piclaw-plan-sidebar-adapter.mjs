// Routes the vendored Piclaw Plan sidebar add-on's HTTP helper to Gi (src/gi-plan-sidebar.ts).
import { createHash } from 'node:crypto';

const SHA256 = 'db031d33487eb92ff7fa850b70e55242a3bb6dd83b5c8589c7cea5140bcdec3d';
const ANCHOR = `  async function apiJson(url, options) {
    const response = await fetch(url, { credentials: "same-origin", ...options });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok === false) throw new Error(payload?.error || \`\${response.status} \${response.statusText}\`);
    return payload;
  }`;

export function patchPlanSidebar(source) {
  const sha = createHash('sha256').update(source).digest('hex');
  if (sha !== SHA256) throw new Error(`plan sidebar add-on source changed (${sha})`);
  if (!source.includes(ANCHOR)) throw new Error('plan sidebar apiJson anchor not found');
  return `import { giPlanSidebarRequest } from '../../src/gi-plan-sidebar.ts';\n`
    + source.replace(ANCHOR, '  async function apiJson(url, options) {\n    return giPlanSidebarRequest(url, options);\n  }');
}

export function piclawPlanSidebarAdapter() {
  return { name: 'gi-plan-sidebar', setup(build) {
    build.onLoad({ filter: /[\\/]plan-sidebar-0\.1\.25[\\/]index\.ts$/ }, async args => ({
      contents: patchPlanSidebar(await Bun.file(args.path).text()), loader: 'ts',
    }));
  } };
}
