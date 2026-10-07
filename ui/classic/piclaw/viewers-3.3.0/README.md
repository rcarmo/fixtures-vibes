# Piclaw 3.3.0 standalone viewers (extracted)

Piclaw serves its tab-mode viewer pages from server routes (`runtime/src/channels/web/http/*-viewer-route.ts`): each
route returns a fixed page from `generate…Page()` with a `VIEWER_CSP` header. These are those pages, extracted
unmodified by `scripts/extract-piclaw-viewers.ts` from rcarmo/piclaw v3.3.0
(`e4c2b9a3536eb64361da86237a4dfc970d772682`), so every runtime serves the same files.
`SOURCES` holds the SHA-256 of each route file read. All five extracted pages and CSPs are unchanged from the
previous v3.2.5 extraction; this update was verified against tagged source, not a new reference-instance run.

The build copies `<viewer>/index.html` to `static/<viewer>/index.html`. A runtime serves it at `/<viewer>/` (any
query; the page reads `?path=` itself) with the `Content-Security-Policy` from `csp.json`, `X-Frame-Options:
SAMEORIGIN` and `Cache-Control: no-cache`. The pages load files from `/workspace/raw?path=`; the PDF viewer also loads
attachment PDFs from `/pdf-viewer/source?media=<id>`, a runtime route (see `ui/API.md`).
