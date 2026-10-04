# Web front-ends

Front-end code for every runtime lives here and reaches each runtime only through its `references/fixtures-vibes`
submodule. The front-end owner (see `AGENTS.md`) edits these trees; runtimes do not.

| Tree | Status | Consumer |
|---|---|---|
| `classic/` | **Shared Classic UI** — Piclaw 3.2.5 components, the Plan sidebar add-on, and the adapter layer | Gi (`giui.Static`) |
| `vibes/` | Legacy Vibes front-end, maintenance only until Vibes adopts `classic/` | Vibes Python (`src/vibes/static` symlink) |
| `tau/` | Legacy imported Vibes front-end, maintenance only until tau-prime adopts `classic/` | tau-prime (`src/tau_web/{vibes,static}` symlinks) |

`classic/` (imported from Gi) was chosen as the shared base by compliance results against Piclaw 3.2.5: it is Piclaw's own front-end,
passes far more of the suite than the Vibes lineage, and takes Piclaw features (Plan, widgets) without rewrites.

A runtime adopts the shared UI by implementing the backend surface in [API.md](API.md) and serving the
`classic/static` tree; the compliance suite is the acceptance test. Once a runtime switches, its legacy tree
is deleted.
