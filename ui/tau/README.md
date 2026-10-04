# tau-prime web front-end

Legacy imported Vibes front-end for tau-prime, kept in maintenance until tau-prime adopts `../classic` (see
`../README.md`). Imported from rcarmo/tau-prime `src/tau_web/{vibes,static}` at the revision in `SOURCE-REVISION`.

| Path | Contents |
|---|---|
| `static/` | The served tree, including the committed bundle in `static/dist/` |
| `sdk/` | Extension UI, frontend SDK and widget bridge scripts, plus licence notices (served under `/static/`) |
| `tests/` | Adapter unit tests (`make test`) and browser harnesses |
| `UPSTREAM.md`, `source-revision.txt` | Provenance of the imported Vibes front-end |

`make build` rewrites `static/dist` (commit it); `make test` and `make lint` check the sources.
tau-prime links `src/tau_web/vibes` to this directory and `src/tau_web/static` to `sdk/`.
