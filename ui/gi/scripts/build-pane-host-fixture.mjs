import { resolve } from 'node:path';
// Paths resolve from this front-end directory; the bundle is written under the caller's working directory.
const ui = resolve(import.meta.dir, '..');
// Test-only conformance entrypoint; never add this bundle to embedded assets.
const result = await Bun.build({
  entrypoints: [resolve(ui, 'tests/ux/fixtures/pane-host.ts')], target: 'browser', format: 'esm',
  plugins: [{name:'test-preact-vendor',setup(build){
    build.onResolve({filter:/vendor\/preact-htm\.js$/},()=>({path:resolve(ui, 'internal/web/static/js/vendor/preact-htm.js')}));
  }}],
});
if (!result.success) { console.error(result.logs); process.exit(1); }
await Bun.write('test-results/pane-host-fixture.js',result.outputs[0]);
