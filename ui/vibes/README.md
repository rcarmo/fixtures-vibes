# Vibes web front-end

Owned by the fixtures-vibes front-end owner. Yanked verbatim from rcarmo/vibes at the revision in `SOURCE-REVISION`,
keeping the Vibes repository layout so `build.js` runs unchanged from this directory:

- `static/` — the served tree (`/static`), including the committed bundle in `dist/`
- `tests/unit/` — front-end unit tests (`make test`)
- `tests/browser/` — component/app browser harnesses against synthetic backends (`make browser`)

`make build` rewrites `static/dist` (commit it); `make test` and `make lint` check the sources.
Vibes serves `static` from its `references/fixtures-vibes` submodule.
