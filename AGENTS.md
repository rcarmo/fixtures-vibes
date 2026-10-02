# Agent rules for fixtures-vibes

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
