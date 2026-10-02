# Changelog

## v0.1.0-rc.6

- Fix the contract test so `profiles/*-skips.json` is validated against the skips schema (rc.5 shipped with that test failing).

## v0.1.0-rc.5

- Shared scenarios reconciled against installed Piclaw 3.2.5 (no `@reconcile-3.2.5` left in `shared-ux.feature`):
  - Plan (`009`–`012`): stored Markdown and a session-scoped `plan` tool; no server revision numbers. A dirty editor keeps
    local text on a remote update; Refresh replaces it, accepting any discard confirmation. Submit saves first and cancels
    rather than retargets if the session changes.
  - `017` Return to editor: only the shared core (queued text returns once, no duplicates). Replace-vs-merge with a newer
    draft is not canonical yet (Piclaw replaces; Vibes/Tau merge).
  - `019` Steer into the matching active run; new `@ux-shared-030` idle Steer behind `@cap-steer-idle` (Piclaw enables it).
  - `028` SVG safety for every runtime (no script, no fetch, source visible, raw HTML escaped); new `@ux-shared-031`
    image preview behind `@cap-svg-render`.
- New spec `suite/specs/shared-svg.spec.ts` (`028`, `031`).
- Piclaw 3.2.5 defect: assistant text is stored HTML-escaped, so the SVG fence handler parses `&lt;svg…`, fails and shows
  double-escaped source. Ordinary code fences are unaffected. The reference profile lists `@ux-shared-031` as `known-defect`
  in `profiles/piclaw-3.2.5-skips.json`.

## v0.1.0-rc.4

- README: a capability claim means the user-visible surface exists; failing tagged scenarios need per-ID skips
  (`not-implemented`, `known-defect`, `intentional-divergence`) rather than a dropped claim. Listed skips still run.

## v0.1.0-rc.3

- Owner review (@tau, @gi): `@cap-stop` moved from `@ux-auth-012` (leaving an invitation) to `@ux-original-023`, `@ux-shared-023`
  and `@ux-compaction-003`; `@cap-message-delete` on `@ux-original-024`/`@ux-shared-024`; `@cap-read-aloud` on
  `@ux-timeline-027/028`; `@cap-slash-commands` on `@ux-single-passkeys-023`.
- New `@cap-messages-tool` (`@ux-original-025`, `@ux-shared-025`) replaces the misleading model-picker requirement;
  `@ux-shared-012` (Plan tool) needs `@cap-plan-sidebar` + `@cap-tool-output`, not add-ons or the model picker.
- `@cap-annotation` split into `@cap-image-annotation` (`@ux-timeline-001..007`) and `@cap-text-highlights` (`008..012`).
- Passkey Settings scenarios are a `@proposal`, not 3.2.5 observations: Classic rows only, all `@reconcile-3.2.5`.
- Known follow-ups: split multi-picker scenarios (`@ux-original-021`, `@ux-shared-021`); environment gating for
  browser/device-specific mobile scenarios.

## v0.1.0-rc.2

- Fix `bun.lock` so `bun install --frozen-lockfile` works on a clean checkout (Bun 1.3.14).

## v0.1.0-rc.1

- Classic Gherkin: 267 scenarios with preserved `@ux-<area>-NNN` IDs and 29 shared scenarios minted as `@ux-shared-001..029`.
- `@cap-*` vocabulary (`capabilities.json`); every scenario carries the capabilities it needs.
- Schemas for runtime profiles, skips files and evidence manifests.
- Deterministic fixture model with a control API (gates, reasoning, tools, usage, failures).
- Bun/Playwright compliance suite with lifecycle or external runtimes, automatic capability skips and a report gate.
- Reference profile for Piclaw 3.2.5. 43 scenarios are tagged `@reconcile-3.2.5` pending oracle review.
