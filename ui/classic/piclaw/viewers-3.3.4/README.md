# Piclaw v3.3.4-ux viewer pages

These five pages and `csp.json` are extracted unmodified from the viewer route generators at tagged commit
`78dcfa25838a152fdf936b864306b643b8d1cfbc`. `SOURCES` records each route file's SHA-256 for provenance.
The generators' literal HTML is evaluated without substitutions; extraction rejects interpolated pages.
`make build` copies the pages into `static/<viewer>/index.html`.

This is source extraction, not a new reference-instance compliance run. Historical 3.3.0 and 3.2.5 oracle records
are unchanged. Runtime servers must apply the CSP headers in this directory and serve the viewer routes as pages.
