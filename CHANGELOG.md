# Changelog

## Unreleased

- Keychain is mandatory (`@ux-keychain-001..007`): Settings management (may be simpler than Piclaw's), literal
  `$NAME`/`${NAME}` injection and `keychain:` placeholders. Profiles may set `keychain.masterPassword`.
- Shell environment is mandatory (`@ux-shell-env-001..010`): Piclaw's shell detection, reference detection in all four
  syntaxes with retrieval of only referenced entries, variable naming, placeholder failures and the Settings
  Environment section. Windows scenarios need the new `@cap-windows-shell` (not claimed by the Linux reference).
- Concurrent sessions are mandatory (`@ux-chat-lifecycle-009`).
- `@ux-shell-009` and `@ux-workspace-010..013` require `@cap-editor`.
- `@ux-compose-008` states that a message reference shows the message's own ID (`msg:<id>`).
- Adaptive Cards removed from the suite (Rui, 2026-10-04): `@ux-extra-002/003` and `@cap-adaptive-cards` are retired.

## v0.1.0 — 2026-10-03

First release for adoption. Evidence: the full rc.16 reference gate against Piclaw 3.2.5
(`oracle/piclaw/3.2.5/2026-10-03-v0.1.0-rc.16`), plus targeted six-project runs for each change since.

Changes since rc.16:
- Picker helpers match entries by accessible name and treat only the keyboard highlight as highlighted.
- shared/original-014 delays a session's reads only after it has loaded.
- New specs for shell menu and layout (`@ux-shell-001..009`) and compaction and model controls
  (`@ux-compaction-001..004`, `006..008`).
- The fixture model accepts `POST /control/script` (optionally with `when`).
- Runtime profiles can declare `commands.selectModel`, which `@cap-compaction` requires.

Scenarios without a spec are reported as "No suite test yet"; coverage grows in later releases.

## Earlier release candidates

- Classic `@ux-original-*` scenarios (Gi's reference catalogue) now have specs.
  - Where an original states the same contract as a shared scenario, both run the same test body, each under its own
    ID, and original-only clauses are gated by ID: 001–006 and 013–015, 017/018, 020–025, 027 (with
    `@ux-chat-lifecycle-003`) and 028 (with `@ux-shared-029`).
  - Original-only clauses now covered:
    - 003: native groups.
    - 006: the query is cleared after dismissal.
    - 017: focus and cursor land at the end of the restored text.
    - 018: a failed removal warns and the row comes back.
    - 021: Control+Home/End in the model search.
    - 024: cascade delete, cancel and accept.
    - 025: explicit all-chat scope in single-user mode.
    - 027: the "Waiting for model" phase after the tool, the thought surviving, no Completed footer, no panes after an
      idle reload.
  - `@ux-original-026` (new spec): a failed upload is reported and nothing is sent; the next successful upload reaches
    the message.
- Original text corrected to Piclaw 3.2.5:
  - 015 and 020: a failed pin or a rejected model switch shows no message; the previous state stays and nothing
    claims success.
  - 025: `missing_row_ids` is in the tool details only.
  - 027: no Draft is shown for assistant text before a tool call.
- Listings: `@ux-original-005` (#1513), `@ux-original-023` (#1519), `@ux-original-027` (WebKit, #1507). Each mirrors
  its shared or lifecycle counterpart.
- Fixture model: `[after-tool-gate:NAME]` holds the follow-up request after a tool result.

## v0.1.0-rc.15

Gate run rc15b executed `387422e` against Piclaw 3.2.5: Gate OK. 306 scenarios: 59 passed, 0 failed, 12 listed failing,
235 without a suite test. The tag commit adds only the skips listings below and this changelog.

- WebKit listings for rcarmo/piclaw#1507, a transient-status render defect: `@ux-chat-lifecycle-003`, `-007` and
  `-008`, and `@ux-shared-015`, each for webkit-phone, webkit-tablet and webkit-desktop. Isolated reproduction failed 7
  of 20 runs, and 5 of 20 with the EventSource confirmed open.

- First fixtures from the Vibes UI PRs #20–#22 (requested via @vibes), reconciled against Piclaw 3.2.5:
  - `@ux-chat-lifecycle-006`: a streaming Draft keeps every chunk in order, not only the latest.
  - `@ux-timeline-029`: post times use the viewer's time zone. The spec runs at UTC+05:45 and reads a `time[datetime]`
    attribute or a dated title in the page.
  - `@ux-compose-012`: a failed send restores the text and the uploaded attachment, and the retry delivers once. 3.2.5
    re-uploads on retry; the contract covers only the delivered result.
  - `@ux-shared-026` now also requires a new `@cap-upload-cancel`. 3.2.5 has no upload cancel control, so the scenario
    stays without a spec.
  - `@ux-chat-lifecycle-007`: a running turn in one session does not leak its draft, status, Stop control or reply into
    another session's tab, and vice versa.
  - Not added:
    - Permission-request review (#20): 3.2.5 raises agent requests only from extension UI calls, so a stock reference
      instance has none to observe.
    - Resource meters (#21): not shown by default in 3.2.5.
    - Session-scoped composer attachments (#22): in 3.2.5 an attachment stays in the composer across a session switch;
      submit-time destination capture is `@ux-compose-006`.
    Each needs a decision before it becomes contract.
- `@ux-shared-008` has a spec. Each skill appears once in Slash commands and is searchable by description. Activating it
  inserts the command. Sending it expands only that skill. An unknown skill reports an error without a model turn.
- `@ux-shared-007` and `@ux-shared-008` corrected to the oracle: inserting a command replaces the composer text with
  exactly the command (`@ux-original-007`). The previous wording, which kept the existing draft and added a trailing
  space, contradicted Piclaw 3.2.5.
- `@ux-shared-014` has a spec. While "main"'s status, queue and commands reads are delayed, "research" is chosen by
  keyboard. After the late responses arrive, the timeline, model, session label and composer destination still belong
  to "research". The composer itself is shared across sessions in 3.2.5. Delaying "main"'s first timeline page instead
  leaves the picker empty (rcarmo/piclaw#1515), so the spec does not delay that read.
- `@ux-shared-023` has a spec. A busy turn survives a dropped SSE connection. Stop then cancels only that turn; a turn
  in another session keeps running. The composer draft stays, and the queued follow-up runs afterwards. A newer turn is
  not stopped by the old turn's late events.
- `@ux-shared-025` corrected to the oracle and given a spec:
  - Explicit IDs come back with at most the requested surrounding rows from their own session.
  - A missing ID yields nothing in its place, and nothing is substituted.
  - A bounded search after a row returns only that session's rows, with a truthful count.
  - Returned content starts no turn.
  - Dropped: "timeline order" and "missing IDs are reported". 3.2.5 uses request order and reports missing IDs only in
    tool details.
  - Fixture tool arguments must escape `[`/`]`.
- `@ux-shared-022` has a spec:
  - A model switch still pending when the view moves to another session does not relabel that session.
  - A rejected switch keeps the prior model and the composer draft.
  - Models that do not advertise reasoning get no thinking level: a thinking control is disabled or offers only "off".
  - Native compaction is actionable.
  - "Unknown context" and "local estimates" cannot be constructed with fixture models, which report usage.
  - On phone widths, 3.2.5's disabled Thinking level select covers part of the session button (rcarmo/piclaw#1518).
    The spec opens the picker by keyboard.
- `@ux-shared-015` has a spec:
  - A rejected pin leaves the picker open, with the search, entry and selection usable.
  - Pinning round-trips and survives a reload.
  - A running session cannot be removed: 3.2.5 refuses the archive, and the turn continues.
- `@ux-shared-021` has specs for both examples:
  - Session picker: search by identifier; typeahead outside the search field prefers the prefix match; Arrow, Home,
    End, PageUp and PageDown move within the results; Escape restores focus and keeps the session; Enter switches
    exactly once.
  - Model picker: 3.2.5 keeps focus in its search combobox, so the spec covers search, Arrow/Page keys, Escape, and
    Enter activating a fixture model once. The keyboard highlight is the combobox's active descendant, not
    `aria-selected`. The open per-picker split question is noted in the feature.
- `@ux-chat-lifecycle-008` (new): a running tool shows its name, arguments and an elapsed time that counts from the
  tool's start and advances. The status clears when the turn ends. This is Piclaw 3.2.5's only tool-execution surface.
- `@ux-shared-027` now also requires a new `@cap-tool-pane`. 3.2.5 has no disclosable tool pane, so the scenario stays
  without a spec.
- New helper `suite/points.ts` (`quietTimelinePoint()`), now used by the Quick actions and workspace-menu dismissal specs:
  - It accepts a point only inside the timeline, with no control between the hit target and the timeline.
  - The timeline itself may be focusable; Gi's `tabindex=0` conversation region previously left no usable point on
    empty phone/tablet timelines (reported by @gi).
  - It waits for the timeline to render.
- Stabilised after the first full rc.15 run:
  - The model picker spec waits for its search combobox, which it finds by `aria-controls`; the Thinking `<select>` is
    also a combobox.
  - `@ux-shared-015` checks Stop rather than the Draft after reloading a page with a running turn. 3.2.5 does not
    repaint a held Draft until new output arrives.
- `@ux-shared-023` is listed as a known 3.2.5 defect (rcarmo/piclaw#1519). It fails intermittently: after a reconnect
  and Stop with a queued follow-up, the next turn can run with no Stop, Draft or status.
- `runtime.newSession(name?)` accepts a unique session name.
- `suite/net.ts` adds `holdReads()`, and `installSseDrop()`, which closes the page's EventSources and fires `error` as a
  network drop would.
- The fixture model now prefers the *latest* user message that carries directives. An aborted turn leaves no
  assistant reply, so its prompt can precede the next one.
- The fixture model log records `skills`: the names of expanded `<skill name="…">` blocks in the turn's prompt.
- `holdWrites()` returns `disarm()`, so later matching writes pass through.

## v0.1.0-rc.14

- Reference run (recorded in `oracle/piclaw/3.2.5/2026-10-02-v0.1.0-rc.14`): scenarios 52 passed, 7 listed Piclaw 3.2.5
  defects (#1505, #1506, #1507, #1509, #1511, #1513), 242 with no suite test yet; gate OK.

- Shared shell specs (`suite/specs/shared-shell.spec.ts`), reconciled against Piclaw 3.2.5:
  - `@ux-shared-001`: workspace menu open/dismiss by pointer and keyboard. Focus must return to the menu button only
    after keyboard dismissal; a pointer dismissal keeps browser default focus. Piclaw 3.2.5 drops focus to `body` on
    Escape (rcarmo/piclaw#1509, listed).
  - `@ux-shared-002`: show and hide the workspace; "hidden" includes collapsed to zero size. The untested
    narrow-layout backdrop clause was dropped.
  - `@ux-shared-013`: session picker search focus, find by identifier, Escape restores focus. The untested
    paint-timing and anchoring clauses were dropped.
- Shared Quick actions specs (`suite/specs/shared-quick-actions.spec.ts`):
  - `@ux-shared-003`: typing on the timeline opens with the typed query; exact title is preferred over a prefix match;
    the arrow keys wrap; Enter runs the highlighted action and keeps the draft.
  - `@ux-shared-006`: Escape or an outside click closes with no side effects.
  The untested grouping clause and the "close control" example were dropped.
- New canonical selector `quickActionHighlight` (`[role="option"][aria-selected="true"]`). Piclaw 3.2.5 exposes the
  highlight only as a CSS class, so its profile overrides it (rcarmo/piclaw#1510).
- Shared copy, delete and read-aloud specs (`suite/specs/shared-copy.spec.ts`):
  - `@ux-shared-024`: Copy message / Delete message / Copy code actions; copy gives the authored Markdown and shows
    "Copied" before returning to idle; a rejected delete keeps the message; an accepted one removes only it.
  - `@ux-shared-029`: Copy code is exact. Read aloud appears only on assistant posts and only with browser speech
    support. Starting another post takes over, and the old post's late end callback does nothing. Speech uses an
    in-page stub engine.
  Clipboard contents are recorded from the page's `copy` event and `navigator.clipboard.writeText`.
- New shared `@ux-shared-033`: displayed and copied text matches what was written, for code with angle brackets and
  for Copy message on assistant posts. Piclaw 3.2.5 fails both (rcarmo/piclaw#1511: `< b && c >` in a fence becomes a
  `<b>` tag; #1505: assistant Copy message copies `&lt;`). Listed.
- `@ux-shared-004`: typing inside the composer, a search input, a button, the workspace sidebar or the session picker
  does not open Quick actions and reaches that surface. The contenteditable and modal-dialog example rows were removed;
  a fresh 3.2.5 session has neither surface.
- `@ux-shared-005`: whitespace, Ctrl/Meta/Alt, composing, repeated and already-prevented keys do not open Quick
  actions. Repeat and composition are dispatched events; a plain dispatched key is checked to open the palette, so the
  check is meaningful. Piclaw 3.2.5 opens on prevented and repeated keys (rcarmo/piclaw#1513; listed).
- `@ux-shared-020` (`suite/specs/shared-model-picker.spec.ts`): pointer and keyboard model selection. The fixture
  server records which model each turn used, so the spec checks the next turn really uses the chosen model in that
  session only. Only fixture models are selected; a reference instance may also list real, billable providers. The
  untested context-window and references clauses were dropped.
- The fixture server advertises `fixture-1` and `fixture-2` (it already answered any model ID). Profiles that claim
  `@cap-model-picker` must register both. The Piclaw reference registers `fixture-2` ("Fixture Model Two").
- Profile `rateLimit: {path, perMinute}` paces matching browser writes under a known limit, using a sliding minute
  per worker. The Piclaw reference paces `^/agent/[^/]+/message$` at 28/min (its limit is 30). 429 backoff stays as a
  fallback. Without pacing, the larger suite hit the limit for long stretches, and backoff then pushed late tests
  past their timeouts.
- Spec races reported by @gi:
  - `@ux-shared-016` polls the queue order, because a runtime may replace an optimistic row with its durable row
    mid-read.
  - `@ux-compose-003` takes its baseline after the seed's own user post is shown.
- New canonical selector `userPost` (`.timeline .post:not(.agent-post)`).

## v0.1.0-rc.13

- Shared queue specs, reconciled against Piclaw 3.2.5: `@ux-shared-016` (FIFO, delivered once each), `017` (Return to
  editor; the agent receives the text only when sent), `018` (move up persists; removal drops exactly that item) and
  `019` (double Steer delivers once, in that session only). Their failure clauses now live in a new shared
  `@ux-shared-032`: a rejected Return, Cancel or Steer must show a failure, bring the item back without a reload and
  deliver it at most once. Piclaw 3.2.5 fails all three actions (rcarmo/piclaw#1506, intermittent).
- `@ux-shared-030` (idle Steer) still has no spec. In 3.2.5, Stop discards the queue and queued items dispatch as soon
  as a run ends, so an idle session with a queued item cannot be built black-box.
- The `page` fixture retries writes answered with HTTP 429 (2/4/8/8/8 s, or `Retry-After`). Piclaw allows 30 agent
  messages per sliding minute. Specs no longer call `page.unrouteAll`. The fixture unroutes with `ignoreErrors` when a
  test ends.
- `@ux-chat-lifecycle-002` (rcarmo/piclaw#1507) is now listed for all projects. It is timing-dependent and was also
  seen on Chromium tablet.
- Reference run: 318 tests; scenarios 44 passed, 4 listed failing, 252 with no suite test yet; gate OK.

## rc.12 follow-up

- Oracle evidence: `oracle/piclaw/3.2.5/` (instance identity and hashes) and the first immutable record,
  `2026-10-02-v0.1.0-rc.12`. 276 tests: 265 passed, 11 failures, all in the three listed defects. Scenarios: 40 passed,
  3 listed failing, 256 with no suite test yet. Gate OK.
- `make oracle PROFILE=…` (`tools/record-oracle.ts`) records the last run when its gate is OK and refuses to overwrite.

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
