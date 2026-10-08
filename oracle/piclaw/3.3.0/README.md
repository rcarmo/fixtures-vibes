# Piclaw 3.3.0 reference

The dedicated reference at `192.168.1.236:8090` runs the baseline Piclaw 3.3.0 release, tagged commit
`e4c2b9a3536eb64361da86237a4dfc970d772682`. `identity.json` records the served app, CSS and editor asset hashes.
The deterministic fixture model listens on port 9920. State is isolated under `/srv/piclaw-fixtures/3.3.0`;
the former release/state and all `oracle/piclaw/3.2.5/` records are preserved.

- Profile: `profiles/piclaw-3.3.0-reference.json`.
- Current exceptions: `profiles/piclaw-3.3.0-skips.json`.
- Installer: `install-reference.sh root@192.168.1.236 /opt/piclaw/releases/piclaw-3.3.0-linux-x64-baseline`.
  It updates only the dedicated fixture services. It requires private configuration files (`0600`) and uses
  `/tmp/fixtures-vibes/runs/reference-3.3.0/tmp` for disposable remote temporary files.
- Plan/editor revision-safe writes proposed in [fixtures-vibes #1](https://github.com/rcarmo/fixtures-vibes/issues/1)
  are not part of the Piclaw 3.3.0 guarantee. The existing shared adapter drops loaded revisions; this record
  does not establish atomic stale-save protection.

## Focused defect revalidation — 2026-10-08

`2026-10-08-b17ef01-330-focused/` contains 216 selected test outcomes across the six Chromium/WebKit layouts:
**122 passed, 90 failed, 4 skipped**. Thirty-one scenario IDs were selected. This is a focused multi-run record,
not full compliance or CI verification. The report's `no-suite-test` rows include scenarios outside this selection.

The initial run produced 112 passes, 100 failures and four skips. Ten Chromium-phone outcomes were invalid because
session startup rejected the installer's initially world-readable configuration. After changing the configuration
to `0600`, a separate zero-retry setup check passed all ten. The record replaces only those setup-invalid outcomes
with that check; `results.json.revalidation` preserves both run start times, replacement count and reason. The
original diagnostic failures remain documented here and are not treated as product defects. The installer now
uses `umask 077` and explicit private configuration modes.

Thirteen previous defect listings were removed from the new 3.3.0 skip profile:
`chat-lifecycle-002/003/006/007/008`, `original-027`, `shared-015`, `compaction-001/002/003`, `context-004`,
`theme-008` and `thoughts-005` (all `@ux-` IDs). The current profile contains 17 known-defect entries and two Linux
capability exclusions. Project scopes and observed failure rates reflect this run. A passing focused check does
not prove an intermittent defect can never recur.

The editor failures in Piclaw #1524 and #1526, and the typeahead failure in #1513, still reproduce in the tagged
release. Their upstream closure dates (2026-10-07) postdate the v3.3.0 tag (2026-10-06); this revalidation does not
reject the later fixes. Terminal #1531 remains a WebKit-desktop failure; its four narrow-layout cases skip by design.
Widget bridge #1545 remains an upstream source-level security concern: the functional `extra-014` bridge tests pass
6/6, but they do not validate same-origin isolation or rejection of messages from an unrelated frame.

Pre-release runner CPU and allocation sampling was analysed: the runner was 99.8% idle, repository self time was
small, and sampled allocation stacks were dominated by Node/Playwright loading. No actionable repeated work or
performance improvement was identified. The remote runtime and browser were not profiled by this runner capture.
Raw profiles, traces, fixtures and disposable logs are deleted after analysis; concise outcomes and identity remain.

Future reference records are immutable. `tools/record-oracle.ts` accepts `FIXTURES_RESULTS` for a reviewed result
file and retains explicit revalidation provenance. Do not overwrite this record when running the full suite.
