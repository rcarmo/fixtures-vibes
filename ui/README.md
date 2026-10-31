# Shared Classic frontend

`classic/` is the only frontend in this repository. Every runtime consumes the same source and built assets through
`references/fixtures-vibes/ui/classic`. Runtime-specific UI trees and compatibility aliases are not supported.

Classic uses Piclaw v3.3.4-ux sources with the shared backend adapter, editor and Plan sidebar.
See [Classic's build instructions](classic/README.md) and the [HTTP/SSE contract](API.md).

Consumers implement that contract server-side, serve `classic/static`, run `classic/scripts/probe-api.ts` and
verify their compliance profile. Missing routes or behaviour must be fixed or reported as consumer blockers.
Switching a static path alone does not establish compatibility.

The former Vibes and Tau frontend trees were removed on 2026-10-31. Consumers pinned to earlier revisions keep
those revisions until migrated; consumers adopting this revision must update obsolete static/build paths.
Git history contains the old code. This repository does not retain a second copy, archive or symlink fallback.
