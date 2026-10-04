# Classic web UI

The shared web front-end: Piclaw 3.2.5's web components with the adapter layer that maps them onto the backend contract in
[../API.md](../API.md). Imported from rcarmo/gi at the revision in `SOURCE-REVISION`.

| Path | Contents |
|---|---|
| `src/` | Sources: Piclaw components, `ui/` and `panes/`, plus the adapter (`api.ts`, `app.ts`, `gi-*.ts`) |
| `piclaw/<name>-<version>/` | Unmodified Piclaw sources pinned by hash and wired in by `scripts/piclaw-*-adapter.mjs` |
| `scripts/` | Build-time adapters and anchored patches (`patch-*.mjs`), each failing the build if its anchor moves |
| `static/` | The served tree, including the committed build output (`dist/`, `js/vendor/`, `editor-vendor/`, fonts, CSS) |
| `theme-catalogue.json` | Generated theme catalogue for the `/theme` command |
| `tests/unit/`, `tests/fixtures/` | Front-end unit tests and their fixtures |
| `embed.go` | `package giui` (`Static`, `ThemeCatalogue`) for Go runtimes |

`make build` rewrites `static/` and `theme-catalogue.json` (commit both); `make test` and `make check` verify the sources.
