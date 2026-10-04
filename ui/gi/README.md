# Gi web front-end

Owned by the fixtures-vibes front-end owner. Yanked verbatim from rcarmo/gi at the revision in `SOURCE-REVISION`,
keeping Gi's repository layout so `build.js` and its patch scripts run unchanged from this directory:

- `web/` — sources (`web/src` holds Piclaw 3.2.5's own components/ui/panes, adapted by `scripts/patch-*.mjs` at build time)
- `internal/web/static/` — the served tree, including the committed build output (`dist/`, `js/`, fonts, CSS)
- `internal/web/theme_catalogue.json` — generated theme catalogue used by Gi's `/theme` command
- `embed.go` — `package giui`, embedding the served tree for Gi's Go server

Build: `bun install --frozen-lockfile && bun run build.js` (rewrites `internal/web/static` and the catalogue; commit both).
Gi consumes this only through its `references/fixtures-vibes` submodule.
