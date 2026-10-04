# tau-prime web front-end

Owned by the fixtures-vibes front-end owner. Yanked verbatim from rcarmo/tau-prime `src/tau_web/{vibes,static}` at the
revision in `SOURCE-REVISION`, keeping that layout so `vibes/build.js` (which also reads `../static`) runs unchanged:

- `vibes/` — the imported Vibes front-end (see `vibes/UPSTREAM.md`), built bundle in `vibes/static/dist/`
- `static/` — extension UI, frontend SDK and widget bridge scripts plus licence notices
- `vibes/tests/` — front-end adapter tests (`bun test`) and browser harnesses

`make build` rewrites `vibes/static/dist` (commit it); `make test` and `make lint` check the sources.
tau-prime serves and packages these from its `references/fixtures-vibes` submodule.
