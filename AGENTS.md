<!-- RUI-PROFILE-LIFECYCLE-20261005 -->
## Current profiling and cleanup rule — supersedes older text below

Rui's explicit rule: **profile and tune during pre-release tests; remove profiling data immediately after analysis/use.** Ordinary development tests do not require profiling on every run. Targeted diagnostic profiling is optional when useful and follows the same disposal rule.

- During pre-release verification, capture CPU and heap/allocation behaviour, analyse hotspots and tune avoidable allocations/repeated work. Compare equivalent workloads without weakening correctness/security/numerical contracts. For Go, inspect CPU, alloc_space and alloc_objects; coverage alone is not profiling.
- Keep captures and matching artifacts only while the current analysis needs them. Once used, immediately delete raw profiles, traces, matching test binaries, temporary fixtures and disposable logs, including failed/probe artifacts after diagnosis. Retain only concise conclusions and important measurements/limitations. Do not keep indefinite raw archives or copy them into exports/reports/evidence to evade cleanup.
- Remove all completed disposable cache/build/test/run data promptly. Never delete files still in use: finish or safely pause the owning job and clean at a safe boundary. Preserve source, installed toolchains, durable datasets/checkpoints and intentional release assets. Minimise disk usage; no random exports or redundant snapshots.
- This rule overrides **every conflicting older paragraph in this file and linked local guidance**, including “profile every test”, “unprofiled tests prohibited”, “retain all raw evidence”, “never delete profiles” and cleanup exclusions based only on an evidence/profiles directory name. Update helper/CI cleanup behaviour accordingly; do not weaken pre-release analysis.
- Existing no-agent-contact and execution-pause rules remain unchanged. This policy grants no unsolicited coordination or automatic job restart.
<!-- /RUI-PROFILE-LIFECYCLE-20261005 -->



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

- Root, resolved once by `mk/project-tmp.mjs` (vendored here, so CI needs no host tooling), always ending in
  `/<project>` (`PROJECT_NAME`, default `fixtures-vibes`):
  1. explicit `PROJECT_TMP_BASE` → `<base>/<project>`; `PROJECT_TMP_ROOT` (absolute, project-named, owned, not a
     symlink) is kept for compatibility. Both set must agree; an unusable explicit value fails, never falls back;
  2. CI (`CI`, `GITHUB_ACTIONS`, `GITLAB_CI`, `TF_BUILD`, `CIRCLECI`): `$RUNNER_TEMP`, then the original inherited
     `TMPDIR`, then the system temp directory, even when `/workspace/tmp` exists;
  3. local: a usable `/workspace/tmp`, then the system temp directory (`/tmp/<project>` on POSIX).
  The inherited `TMPDIR` is snapshotted as `PROJECT_ORIGINAL_TMPDIR` before it is redirected.
- Layout: `cache/<tool>/` (bun, npm, xdg, go) for rebuildable caches, `build/` for generated output, `tests/` and
  `logs/` for disposable test/log scratch, `runs/<purpose>/<run-id>/` (`suite`, `ui-classic`, `ui-vibes`, `ui-tau`,
  or `RUN_PURPOSE=…`) for isolated runs. Raw profiling data is transient; delete it immediately after analysis.
- `mk/project-paths.mk`, included by every Makefile here, exports the resolved `PROJECT_TMP_ROOT` (children never
  resolve again, so a run directory used as `TMPDIR` is not nested into), `TMPDIR`/`TMP`/`TEMP`, `FIXTURES_RUN_ROOT`,
  `XDG_CACHE_HOME`, `BUN_INSTALL_CACHE_DIR`, `npm_config_cache` and `GOCACHE`.
- A runtime running the suite or a UI build from its submodule names itself (`PROJECT_NAME=<runtime>`, optionally
  `PROJECT_TMP_BASE=<abs base>`), so the scratch is the runtime's. Direct commands (Playwright, `bun build.js`, fixture binaries) first run
  `eval "$(make -s env RUN_PURPOSE=<purpose>)"`; never bare `/tmp` or home caches.
- The suite resolves the same way when started directly (global setup creates `runs/suite/<id>` and exports it), then
  creates the model's and each runtime's root under `FIXTURES_RUN_ROOT` (owned directory, checked) with a private
  `tmp/` as the process's `TMPDIR`, and removes it when it stops (`FIXTURES_KEEP_ROOTS=1` keeps it).
- Keep concise conclusions and canonical oracle records; raw profiling data in test-results is disposable after analysis. Playwright's browsers are an
  installed toolchain (`PLAYWRIGHT_BROWSERS_PATH`, default `~/.cache/ms-playwright`), not scratch.
- `make clean-scratch` removes only this project's `runs/` and `build/`; it refuses any other root.

## Test profiling

- Profile and tune during pre-release testing; ordinary development runs are not profiled. `make test PROFILING=1`
  (and `make suite … PROFILING=1`) captures into the disposable scratch
  `$(PROJECT_TMP_ROOT)/runs/profiles/<purpose>-<run-id>/` with `run-<target>.json` (command, revision, Bun/Node
  versions, sampling settings); `tools/profile-summary.mjs` writes and prints `summary.txt`, then the raw captures are
  deleted. Analyse the summary: separate repository frames (marked `*`) from runner/runtime overhead, compare like
  workloads and tune avoidable work.
- `PROFILE_KEEP=1` keeps the raw captures for deeper analysis; delete them (`make clean-scratch`) as soon as that analysis
  is done. Keep only the conclusions (workload, revision, result, changes, open hotspots), never raw profiles, test
  binaries or run logs.
- The Playwright runner and workers get V8 `--cpu-prof`/`--heap-prof`; Bun scripts get Bun's `--cpu-prof`/`--heap-prof`
  (a heap snapshot, not allocation sites). `bun test` runs under `mk/bun-test-profile.ts` (JSC `profile()` CPU samples
  and a heap snapshot at the end; JSC's `startSamplingProfiler` crashes Bun 1.4.2). Report its limits: live heap at the
  end rather than allocation history, and no profiles for subprocesses the tests spawn.
  Browsers and the runtime under test are profiled by their owners.
- Claims need comparable evidence: a performance or memory change needs baseline and candidate captures of the same
  workload (with repetitions), analysed before they are deleted; a single capture or a heap snapshot at the end shows
  neither growth nor profiler overhead.

## Suite changes requested by runtime owners

Piclaw 3.3.0 is the current oracle; 3.2.5 records are immutable history. Change a spec only when it is wrong against Piclaw: asserting something Piclaw does not
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
