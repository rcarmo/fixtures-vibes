// Absolute path of a web/src module as the build sees it (Classic overlay, else vendored Piclaw). Bun's test runtime
// does not run plugin onResolve for a test file's own imports, so tests import Piclaw modules through this path.
import { overlayResolver } from '../../scripts/piclaw-web.mjs';

const root = new URL('../..', import.meta.url).pathname.replace(/\/$/, '');
export const piclawModule = (path: string): string => {
  const file = overlayResolver(root).resolve(`${root}/src/index.ts`, `./${path}`);
  if (!file) throw new Error(`no Classic or vendored Piclaw module for web/src/${path}`);
  return file;
};
