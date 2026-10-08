# Compliance: piclaw 3.3.0

| Scenarios | Passed | Failed | Skipped | Listed failing | No suite test yet |
|---:|---:|---:|---:|---:|---:|
| 310 | 14 | 0 | 0 | 17 | 279 |

Results: `oracle/piclaw/3.3.0/2026-10-08-b17ef01-330-focused/results.json` (run started 2026-10-08T06:02:34.230Z)
Skips: `profiles/piclaw-3.3.0-skips.json` (19 listed)

Gate: OK

## Covered scenarios

- `@ux-shared-001` failing-but-skipped:known-defect — Open and dismiss the workspace menu
- `@ux-shared-005` failing-but-skipped:known-defect — Ignore consumed, modified and composing keys
- `@ux-shared-015` passed — Expose only supported session mutations
- `@ux-shared-023` failing-but-skipped:known-defect — Cancel the captured active turn across reconnect
- `@ux-shared-032` failing-but-skipped:known-defect — A rejected queue action keeps the item recoverable
- `@ux-shared-033` failing-but-skipped:known-defect — Text shown and copied matches what was written
- `@ux-shared-031` failing-but-skipped:known-defect — Render safe model-generated SVG as an isolated image
- `@ux-original-005` failing-but-skipped:known-defect — Ignore consumed and modified typeahead events
- `@ux-original-015` failing-but-skipped:known-defect — Use the session actions actually supplied by the client
- `@ux-original-018` failing-but-skipped:known-defect — Reorder and remove queued follow-ups with reconciliation
- `@ux-original-030` failing-but-skipped:known-defect — A failed Steer warns and keeps the item queued
- `@ux-original-023` failing-but-skipped:known-defect — Refresh active-turn state after reconnect and request stop
- `@ux-original-027` passed — Route tool execution through the Classic status and Output panes
- `@ux-extra-014` passed — Route widget bridge actions through the host
- `@ux-workspace-019` failing-but-skipped:known-defect — Keep edits made while a save is in progress
- `@ux-workspace-018` failing-but-skipped:known-defect — Resolve an editor file conflict with the supplied actions
- `@ux-chat-lifecycle-002` passed — Streaming thoughts and response drafts have separate panes
- `@ux-chat-lifecycle-003` passed — Tool output belongs to the Output status pane
- `@ux-chat-lifecycle-006` passed — A streaming draft keeps every chunk in order
- `@ux-chat-lifecycle-007` passed — A running turn in one session does not leak into another
- `@ux-chat-lifecycle-008` passed — A running tool shows what it is doing and for how long
- `@ux-compaction-001` passed — Render compaction using supplied status state
- `@ux-compaction-002` passed — Reconcile compaction events with client status
- `@ux-compaction-003` passed — Request stop through the visible compaction control
- `@ux-compaction-008` failing-but-skipped:known-defect — Handle a model command using the configured provider catalogue
- `@ux-context-004` passed — Show the supplied compaction title and elapsed label
- `@ux-reconnect-001` failing-but-skipped:known-defect — Clear transient agent displays while disconnected
- `@ux-theme-008` passed — Switching tints visibly changes accent color
- `@ux-thoughts-005` passed — Preserve text when changing disclosure state
- `@ux-keychain-004` failing-but-skipped:known-defect — Delete an entry after confirming
- `@ux-terminal-006` failing-but-skipped:known-defect — Pop out terminal to new window (desktop)
