# Agent rules for fixtures-vibes

## Scope: shared UX behaviour only

This repository owns **only shared, user-visible Classic web UI behaviour**: the Gherkin features, the black-box
compliance suite that checks them, the deterministic fixture model it drives, and the reference evidence.

It does **not** own, and must not contain:

* **TUI** behaviour, or any non-web client.
* **Back-ends**: server, API, storage, agent, provider or tool behaviour, except as it is visible in the web UI.
* **Runtime specifics**: one runtime's routes, commands, settings, storage keys, prompt or summary formats, file
  layouts or product features. Express runtime differences with `@cap-*` tags, profile data and skips.
* **Product code**: no UI source, assets or build (the uniform Classic UI lives in its own repository), and no
  runtime adapters.

When a scenario or spec needs a runtime detail to work, the detail goes in that runtime's profile, or the scenario is
rewritten in terms of what a user sees. If neither works, the behaviour is not shared and belongs to the runtime.

## Rules

* Scope is the **Classic** web UI only. Visual-interface and runtime-internal behaviour stay in each runtime.
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
* Git: never rebase; commit as Rui Carmo <rui.carmo@gmail.com>.
