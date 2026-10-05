# Piclaw 3.2.5 reference evidence

Each dated directory is one compliance run of the shared suite against the reference instance. Records are immutable:
`make oracle` refuses to overwrite one, and a later run gets a new directory.

## Reference instance

| | |
|---|---|
| Release | `piclaw-3.2.5-linux-x64-baseline` (the installed oracle, `/opt/piclaw/current`) |
| Classic `app.bundle.js` | `65205f9b4339289f896120f3a7510a75baf14e7e085f39ed47e593ec9eb052d5` |
| Classic `app.bundle.js.map` | `6fa35edad38ab67f75b9defd53699b02bb6fa0c330aa353327456bef25ede769` |
| Classic `app.bundle.css` | `24b81c0f900f87b0ed439aa67da3baa5b844e7e97e1e25520196e998af876722` |
| Profile | `profiles/piclaw-3.2.5-reference.json` (external instance) |
| Skips | `profiles/piclaw-3.2.5-skips.json` |
| Models | `control/fixture-model-server.ts` as provider `fixture`, models `fixture-1` (default) and `fixture-2` |

`install-reference.sh user@host` installs the instance (release under `/opt/piclaw-fixtures`, state under
`/srv/piclaw-fixtures`, units `fixture-model` and `piclaw-fixtures`); rerunning it reinstalls, `--uninstall` removes it.
The instance runs with its own workspace, store and data directories, separate from any other Piclaw. Start each
reference run from a fresh store: tests do not delete the sessions they create, and thousands of leftover sessions slow
the session picker and editor enough to fail unrelated scenarios. On the VM, stop `piclaw-fixtures`, move
`/srv/piclaw-fixtures/store` and `/srv/piclaw-fixtures/data/sessions` to `/srv/piclaw-fixtures-backup/<timestamp>/`,
and start the service again; the workspace and agent configuration stay. It reaches the fixture model through a hostname: Piclaw reduces its tool set for model
URLs on loopback or private addresses, so an IP-address URL would test a degraded Piclaw.

## Contents of a record

- `results.json`: every test outcome (title, spec file, project, status, duration) without captured output.
- `compliance-report.json` / `.md`: per-scenario status and the gate result from `suite/report.ts`.
- `evidence.json`: scenario ID to the passing tests that cover it.

## Known 3.2.5 defects

Listed in the skips file and filed upstream:

- rcarmo/piclaw#1505: agent-authored `svg` fences show escaped source instead of the sanitised image (`@ux-shared-031`).
- rcarmo/piclaw#1506: a failed Steer leaves the queued item hidden until reload (`@ux-original-030`).
- rcarmo/piclaw#1507: on WebKit at desktop size the "Writing response..." status is received but often not rendered
  (`@ux-chat-lifecycle-002`, intermittent). Since rc.15, transient Draft, running-tool status, Output pane and post-reload
  Stop renders are also listed for WebKit (`@ux-chat-lifecycle-003`, `-007`, `-008`, `@ux-shared-015`).
- rcarmo/piclaw#1509: the workspace menu loses keyboard focus on Escape (`@ux-shared-001`).
- rcarmo/piclaw#1511: code with angle brackets is rendered and copied incorrectly (`@ux-shared-033`).
- rcarmo/piclaw#1513: consumed and repeated keydowns open Quick actions (`@ux-shared-005`).
- rcarmo/piclaw#1515: the session picker stays empty until the current session's first timeline page loads. It is not
  listed, because the `@ux-shared-014` spec avoids that delay.
- rcarmo/piclaw#1518: on phone widths a disabled Thinking level select covers the session button. It is not listed,
  because the `@ux-shared-022` spec opens the picker by keyboard.
- rcarmo/piclaw#1519: after an SSE reconnect and Stop, a newer turn can run with no Stop, Draft or status
  (`@ux-shared-023`, intermittent).

`@ux-timeline-018` documents a further 3.2.5 behaviour (a non-cascade delete orphans stored replies). It is not a
compliance requirement and has no spec.
