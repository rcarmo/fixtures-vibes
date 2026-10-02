# Changelog

## v0.1.0-rc.12

- PWA avatar scenarios reconciled against Piclaw 3.2.5 with specs: `@ux-pwa-002` (avatar icons replace the defaults and
  serve PNGs at their declared sizes; clearing restores the defaults) and `@ux-pwa-006` (changing the avatar changes every
  icon URL; the icon centre colour follows the avatar, checked within a tolerance). The specs always clear the avatar.
- New capability `@cap-agent-avatar` and profile `commands.setAgentAvatar` / `commands.clearAgentAvatar` (composer text;
  `{source}` is a PNG data URL). Piclaw: `/agent-avatar {source}` and `/agent-avatar clear`.
- Avatar commands survive Piclaw's agent-message rate limit (30/min, no `Retry-After`): on HTTP 429 the spec waits out
  the window once and resends.
- Portability (reported by @gi): `@ux-compose-006` picks the session entry as `option` or `menuitem` by session
  identifier and no longer checks a Piclaw-style `@name` button; `@ux-compose-005` checks the submit button's own
  `Uploading…`/`Sending…` label, so other upload controls such as an enabled "Cancel uploads" do not match.
- Only the 26 passkey `@proposal` scenarios remain tagged `@reconcile-3.2.5`.

## v0.1.0-rc.11

- Reconciled against Piclaw 3.2.5 with specs, all six projects:
  - composer `@ux-compose-002/004/005/006`: failed-send restore, Return to editor (replace), upload vs sending state,
    destination chat captured at submit
  - Steer `@ux-original-019`
  - synthetic "Replies exist" retry prompt `@ux-timeline-019`
  Wording now states only observable behaviour; reference merging in 002/004 is out of the contract (no portable way to add references).
- New `@ux-original-030` (split from 019): a failed Steer warns and the item returns to the stack. Piclaw 3.2.5 keeps it
  hidden until reload although `/agent/queue-state` still lists it; listed as a 3.2.5 known defect.
- `@ux-timeline-018` is `@oracle-defect`: documents the 3.2.5 orphaning of stored replies on non-cascade delete (checked
  over the public API). It is not a compliance requirement and has no spec.
- `@ux-shared-031`: web agent text is HTML-escaped at store time (deliberate) and the SVG fence renderer runs before
  entity decoding, so agent-authored SVG shows `&lt;svg` source instead of the sanitised image (#1505).
- Reference run (rc.11): 264 tests; 38 scenario IDs pass in all six projects; gate OK with three listed known defects.
- Piclaw 3.2.5 known defects now have issues: rcarmo/piclaw#1505 (`@ux-shared-031`), #1506 (`@ux-original-030`),
  #1507 (`@ux-chat-lifecycle-002`, WebKit desktop only: the drafting status is received but not rendered).
- Skips: optional `projects` (scope a skip to some Playwright projects) and `intermittent` (known defects that do not
  reproduce every run are not stale when they pass).
- `suite/net.ts`: hold or fail browser writes by body marker, multipart upload name (WebKit omits file bytes) or "first
  write to a new endpoint" (background presence/visibility writes are learned first). No runtime route names.
- `make suite` deletes previous results and reports first; the report records its results file, run start time, skips
  file and listed IDs. A run that writes no results can no longer be reported from an older run's JSON.

## v0.1.0-rc.10

- Isolation: lifecycle runtimes now start per Playwright worker. A failed test replaces the worker, so the next test gets a
  fresh runtime and store; held turns and outages cannot poison later scenarios. After every test the suite also releases
  all gates, clears any outage and waits until no model request is in flight.
- Fixture model: `POST /control/gates/open-all`, `inflight` in `/control/health`, `\[`/`\]` escapes in directive values,
  and directives are read from the current turn's user messages (runtimes may append context such as a Plan after the prompt).
- Profile `approval: {"button": "<regex>"}` (opt-in) for runtimes that always require tool approval; `tools.activate` for
  runtimes that gate tools behind an activation tool.
- Thought panel specs scope the disclosure control to Thoughts (other panels have their own toggles).
- Newly verified against Piclaw 3.2.5 with specs: Plan `@ux-shared-009..012` and `@ux-original-009..012` (no `@cap-addons`;
  live remote-change warning is not required), PWA `@ux-pwa-001/003/004/005`, composer `@ux-compose-001/003`,
  Quick Actions `@ux-original-007/008`, SVG `@ux-original-029` (user-authored post).
- Reference run: 33 scenario IDs pass in all six projects; `@ux-shared-031` remains the listed 3.2.5 known defect.

## v0.1.0-rc.9

- Profile `tools` map: canonical `shell` → runtime tool name (default `bash`). Specs ask for `runtime.toolName('shell')`.
- `@ux-chat-lifecycle-003` ignores the prompt bubble (which contains the directive) when looking for Output, output and tool name.
- `@ux-chat-lifecycle-005` proves the tool ran: the fixture model must receive its output in the follow-up request.
- Thought panel `@ux-thoughts-001..005` reworded to observable behaviour and verified against Piclaw 3.2.5
  (`suite/specs/thoughts-panel.spec.ts`): newest nine lines collapsed, "more" toggles, Escape collapses, no text lost.

## v0.1.0-rc.8

- Message deletion `@ux-timeline-017`, `020`, `021`, `022` verified against Piclaw 3.2.5 (`suite/specs/message-deletion.spec.ts`).
  3.2.5 removes posts immediately (no transitional removing state); the cascade prompt reads
  "Delete this message and its N replies?" for N visible replies. `018`/`019` remain to reconcile.
- `Runtime.newSession()` retries HTTP 429 (Retry-After or exponential backoff); Piclaw rate-limits session creation.
- Feature descriptions no longer reference runtime repository paths; a catalogue test enforces this.

## v0.1.0-rc.7

- `@ux-shared-028` (SVG safety) no longer requires `@cap-svg-render`; it applies to every runtime.
- Chat lifecycle `@ux-chat-lifecycle-001..005` verified against Piclaw 3.2.5 with new specs (`suite/specs/chat-lifecycle.spec.ts`);
  `005` now requires `@cap-tool-output` because its setup completes a tool.
- Fixture model: `[after-tool-fail:STATUS]`, `POST /control/fail?status=S&count=N` (simulated outage), offered tools and tool
  results in `/control/log`; `Runtime.outage()` helper.
- Lifecycle runs export `FIXTURE_MODEL_NAMED_URL` (`http://fixture-model.localhost:PORT/v1`) and serve the model dual-stack.
  Piclaw-family runtimes switch to a reduced local-lite prompt and tool set for loopback/private model URLs.
- Reference instance now points Piclaw at `fixture-model.localhost` (hosts entry on the VM), so it runs the full tool set.
  Earlier reference runs used the local-lite profile.

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
