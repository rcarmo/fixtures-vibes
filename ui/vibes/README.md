# Vibes web front-end

Owned by the fixtures-vibes front-end owner. Yanked verbatim from rcarmo/vibes at the revision in `SOURCE-REVISION`,
keeping the Vibes repository layout so `build.js` runs unchanged from this directory:

- `src/vibes/static/` — the served tree (`/static`), including the committed bundle in `dist/`
- `tests/frontend/` — front-end unit tests (`bun test`)

`make build` rewrites `src/vibes/static/dist` (commit it); `make test` and `make lint` check the sources.
Vibes serves `src/vibes/static` from its `references/fixtures-vibes` submodule.
