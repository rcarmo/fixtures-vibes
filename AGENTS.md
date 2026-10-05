# Agent rules for fixtures-vibes

## Scope: shared Web UX behaviour only

This repository owns **only shared, user-visible Classic web UI behaviour**: the Gherkin features, the black-box
compliance suite that checks them, the deterministic fixture model it drives, and the reference evidence.

It does **not** own, and must not contain:

* **TUI** behaviour, or any non-web client.
* **Back-ends**: server, API, storage, agent, provider or tool behaviour, except as it is visible in the web UI.
* **Runtime specifics**: one runtime's routes, commands, settings, storage keys, prompt or summary formats, file
  layouts or product features. Express runtime differences with `@cap-*` tags, profile data and skips.
* **Product code**: no UI source, assets or build (the uniform Classic UI lives in its own repository), and no
  runtime adapters.

The suite also owns the **general Playwright UI tests** for shared behaviour. Runtimes do not keep their own copies of
browser tests for shared UX: they contribute them here, bound to a scenario ID (add the scenario if none fits), and keep
only adapter and runtime-specific tests.

When a scenario or spec needs a runtime detail to work, the detail goes in that runtime's profile, or the scenario is
rewritten in terms of what a user sees. If neither works, the behaviour is not shared and belongs to the runtime.

## Rules

* Scope is the **Classic** web UI only. Visual-interface is out of scope and runtime-internal behaviour stay in each runtime.
* The installed Piclaw release is the oracle for any divergence. Record the version and full asset hashes with every
  piece of evidence. Never relabel older evidence as a newer version; add new evidence alongside it.
* Scenario IDs are stable. Never renumber, reuse or delete an ID; deprecate it with a tag and a note instead.
* Features describe user-visible behaviour. No runtime names, ports, paths, CSS selectors or implementation detail.
  Runtime differences are expressed with `@cap-*` tags and skips, never by editing shared text.
* The compliance suite is black-box: HTTP and browser only, through the runtime's public interface. No imports from
  runtime source, no database writes, no request interception to fake server state.
* Runtime profiles contain data only (lifecycle commands, readiness, session bootstrap, capabilities, optional
  selector/route maps). No assertions and no scenario branching.
* Hashes in `MANIFEST.json` are for fixture provenance only, never for judging generated output or screenshots.
* Every change runs `bun test` here and the suite against the Piclaw reference before tagging.
* Test runs (Rui): focused runs come first (one spec or scenario, the projects that matter). A full or otherwise
  massive run (the whole suite, or every project at once) happens at most once every 4 hours per agent.
* Git: never rebase; commit as Rui Carmo <rui.carmo@gmail.com>.

## Caches and scratch

- Root, resolved once by `mk/project-tmp.mjs` (vendored here, so CI needs no host tooling): an explicit
  `PROJECT_TMP_ROOT` (absolute, named after the project, owned, not a symlink; anything else fails), else
  `/workspace/tmp/<project>` when `/workspace/tmp` exists, else `$RUNNER_TEMP/<project>`, `$TMPDIR/<project>` or the
  platform temp directory + `/<project>`. The project is `PROJECT_NAME` (default `fixtures-vibes`). Layout:
  `cache/<tool>/` (bun, npm, xdg, go), `build/`, `runs/<purpose>/<run-id>/` (`suite`, `ui-classic`, `ui-vibes`,
  `ui-tau`, or `RUN_PURPOSE=…`).
- `mk/project-paths.mk`, included by every Makefile here, exports the resolved `PROJECT_TMP_ROOT` (children never
  resolve again, so a run directory used as `TMPDIR` is not nested into), `TMPDIR`/`TMP`/`TEMP`, `FIXTURES_RUN_ROOT`,
  `XDG_CACHE_HOME`, `BUN_INSTALL_CACHE_DIR`, `npm_config_cache` and `GOCACHE`.
- A runtime running the suite or a UI build from its submodule names itself (`PROJECT_NAME=<runtime>`, optionally
  `PROJECT_TMP_ROOT=/workspace/tmp/<runtime>`), so the scratch is the runtime's. Direct commands (Playwright, `bun build.js`, fixture binaries) first run
  `eval "$(make -s env RUN_PURPOSE=<purpose>)"`; never bare `/tmp` or home caches.
- The suite resolves the same way when started directly (global setup creates `runs/suite/<id>` and exports it), then
  creates the model's and each runtime's root under `FIXTURES_RUN_ROOT` (owned directory, checked) with a private
  `tmp/` as the process's `TMPDIR`, and removes it when it stops (`FIXTURES_KEEP_ROOTS=1` keeps it).
- Retained evidence stays out of scratch: `test-results/` (reports), `oracle/` (records). Playwright's browsers are an
  installed toolchain (`PLAYWRIGHT_BROWSERS_PATH`, default `~/.cache/ms-playwright`), not scratch.
- `make clean-scratch` removes only this project's `runs/` and `build/`; it refuses any other root.

## Suite changes requested by runtime owners

Piclaw 3.2.5 is the oracle. Change a spec only when it is wrong against Piclaw: asserting something Piclaw does not
do, relying on an unstated Piclaw implementation detail outside the scenario, or missing a capability tag the scenario
needs. Never loosen a spec to fit a port's limitation or quirk (a different label, a missing control, a global lock);
that is a runtime defect, fixed in the runtime or recorded as a skip with an issue. Check the claim against the oracle
(source and a run) before editing.

## Ownership

Per Rui (2026-10-04), the fixtures-vibes agent owns this repository and the front-end code of every implementation:
Vibes Python `src/vibes/static/`, tau-prime `src/tau_web/vibes/`
and Gi `web/`, including their front-end builds and tests, plus the selector maps and front-end capability claims in
runtime profiles. Runtime agents own backends, APIs, runtime lifecycle and publication of their repositories; UI
changes they need are requested from the front-end owner with the backend API contract.
