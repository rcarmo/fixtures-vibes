# Piclaw Plan sidebar add-on web entry (vendored)

`index.ts` is `@rcarmo/piclaw-addon-plan-sidebar` 0.1.25 `web/index.ts` (MIT), unmodified
(sha256 db031d33487eb92ff7fa850b70e55242a3bb6dd83b5c8589c7cea5140bcdec3d).
`scripts/piclaw-plan-sidebar-adapter.mjs` routes its two HTTP calls to Gi at build time
(`web/src/gi-plan-sidebar.ts`); the build fails if the source hash or anchor changes.
