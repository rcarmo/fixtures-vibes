# Classic web UI

The shared web front-end: Piclaw's own Classic web sources, vendored unmodified, with the adapter layer that maps them
onto the backend contract in [../API.md](../API.md). The Gi-owned files came from rcarmo/gi at the revision in
`SOURCE-REVISION`.

| Path | Contents |
|---|---|
| `piclaw/web-<version>/` | Piclaw's `runtime/` sources the build uses (`web/src`, `web/static/{classic,common}/css`, `web/shared`, `extensions/viewers/editor`, `src/core`), unmodified, with `SOURCE` (repository, ref, commit) and `SHA256SUMS` |
| `piclaw/<name>-<version>/` | Other unmodified Piclaw sources: the Plan sidebar add-on and the standalone viewer pages |
| `src/` | Classic's overlay on `web/src`: the backend adapter (`api.ts`), the Gi shell (`app.ts`, `gi-*.ts`), the add-on stand-in and vendor-library entries; no copied Piclaw components |
| `scripts/` | `vendor-piclaw.mjs` (re-vendor from a Piclaw checkout), `piclaw-web.mjs` (overlay resolver and its anchored patches), other build-time adapters and anchored patches (`patch-*.mjs`), each failing the build if its anchor moves |
| `static/` | The served tree, including the committed build output (`dist/`, `js/vendor/`, `editor-vendor/`, fonts, Gi CSS) |
| `theme-catalogue.json` | Theme catalogue for the `/theme` command, generated from Piclaw's `src/core/ui-theme-catalogue.ts` |
| `tests/unit/`, `tests/fixtures/` | Front-end unit tests and their fixtures |
| `embed.go` | `package giui` (`Static`, `ThemeCatalogue`) for Go runtimes |

A module path under `web/src` resolves to `src/<path>` when Classic has that file and to the vendored Piclaw file
otherwise, in the build and in the unit tests (`tests/unit/piclaw-module.ts`). A Classic file therefore replaces a
Piclaw module entirely; prefer an anchored patch when Gi changes only a few lines.

`/dist/app.bundle.css` is Piclaw's Classic stylesheet (`web/src/styles/app.css` and its imports), without its KaTeX copy:
Classic serves the stylesheet of the npm KaTeX it bundles. Gi's `static/css/gi-*.css` load after it.

To move to another Piclaw release, run `bun scripts/vendor-piclaw.mjs <piclaw-checkout> <tag>`. It copies the build's
import closure at that ref, replaces the old `piclaw/web-*`, and lists Classic modules outside the bundle graph. Then
`make build`, fix any anchored patch whose anchor moved, and run the unit tests and the compliance suite.

`make build` rewrites `static/` and `theme-catalogue.json` (commit both); `make test` and `make check` verify the sources.

The composer is Piclaw’s current `components/compose-box.ts`, wired through its supported props and `services` in
`src/app.ts`. Piclaw owns rendering, draft clearing/restoration, queue return, model/session pickers and voice input.
The host supplies session media uploads (capturing the submitting chat), commands, run-bound Stop/Compact and session
mutations. `scripts/patch-compose-host.mjs` adds batch cancellation, server-authoritative pins when provided, and
IME/repeated-key safety without changing the vendored bytes or native markup.
