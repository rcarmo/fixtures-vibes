# Piclaw 3.2.5 standalone viewers (extracted)

Piclaw serves its tab-mode viewer pages from server routes (`runtime/src/channels/web/http/*-viewer-route.ts`): each
route returns a fixed page from `generate…Page()` with a `VIEWER_CSP` header. These are those pages, extracted
unmodified by `scripts/extract-piclaw-viewers.ts` from rcarmo/piclaw v3.2.5 (`de82f7a0b`), so every runtime serves the
same files. `SOURCES` holds the SHA-256 of each route file read; each page matched the reference instance byte for
byte when extracted, and so did its CSP header.

The build copies `<viewer>/index.html` to `static/<viewer>/index.html`. A runtime serves it at `/<viewer>/` (any
query; the page reads `?path=` itself) with the `Content-Security-Policy` from `csp.json`, `X-Frame-Options:
SAMEORIGIN` and `Cache-Control: no-cache`. The pages load files from `/workspace/raw?path=`; the PDF viewer also loads
attachment PDFs from `/pdf-viewer/source?media=<id>`, a runtime route (see `ui/API.md`).
