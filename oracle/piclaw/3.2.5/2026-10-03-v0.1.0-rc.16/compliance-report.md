# Compliance: piclaw 3.2.5

| Scenarios | Passed | Failed | Skipped | Listed failing | No suite test yet |
|---:|---:|---:|---:|---:|---:|
| 306 | 88 | 0 | 0 | 18 | 200 |

Results: `test-results/compliance.json` (run started 2026-10-03T05:06:46.168Z)
Skips: `profiles/piclaw-3.2.5-skips.json` (18 listed)

Gate: OK

## Covered scenarios

- `@ux-shared-001` failing-but-skipped:known-defect — Open and dismiss the workspace menu
- `@ux-shared-002` passed — Show and hide the native workspace
- `@ux-shared-003` passed — Type on the idle timeline to open Quick actions
- `@ux-shared-004` passed — Do not steal typing from an interactive surface
- `@ux-shared-005` failing-but-skipped:known-defect — Ignore consumed, modified and composing keys
- `@ux-shared-006` passed — Dismiss Quick actions without side effects
- `@ux-shared-008` passed — Discover loaded skills through canonical slash commands
- `@ux-shared-009` passed — Open Plan and edit the stored Markdown
- `@ux-shared-010` passed — Preserve dirty Plan text on a remote update
- `@ux-shared-011` passed — Submit Plan to the captured session
- `@ux-shared-012` passed — Expose canonical Plan Markdown and the Plan tool to the model
- `@ux-shared-013` passed — Open, search and dismiss the session picker
- `@ux-shared-014` failing-but-skipped:known-defect — Select one coherent session view
- `@ux-shared-015` passed-this-run:known-defect(intermittent) — Expose only supported session mutations
- `@ux-shared-016` passed — Queue two follow-ups exactly once
- `@ux-shared-017` passed — Return a queued item to the editor
- `@ux-shared-018` passed — Reorder and remove by durable identity
- `@ux-shared-019` passed — Steer a queued item into the matching active run
- `@ux-shared-020` passed — Search and select a model authoritatively
- `@ux-shared-021` passed — Find and activate picker entries without changing unsupported state
- `@ux-shared-022` passed — Reject stale or unsupported model state
- `@ux-shared-023` failing-but-skipped:known-defect — Cancel the captured active turn across reconnect
- `@ux-shared-024` passed — Copy and delete timeline messages through native actions
- `@ux-shared-025` passed — Let the model identify bounded ranges of persisted messages
- `@ux-shared-028` passed — Model-generated SVG cannot run code or fetch resources
- `@ux-shared-029` passed — Copy and read assistant content truthfully
- `@ux-shared-032` failing-but-skipped:known-defect — A rejected queue action keeps the item recoverable
- `@ux-shared-033` failing-but-skipped:known-defect — Text shown and copied matches what was written
- `@ux-shared-031` failing-but-skipped:known-defect — Render safe model-generated SVG as an isolated image
- `@ux-original-001` passed — Open and dismiss the workspace menu
- `@ux-original-002` passed — Toggle workspace visibility without submitting the draft
- `@ux-original-003` passed — Open Quick Actions by typing outside interactive controls
- `@ux-original-004` passed — Do not open timeline typeahead from excluded targets
- `@ux-original-005` failing-but-skipped:known-defect — Ignore consumed and modified typeahead events
- `@ux-original-006` passed — Dismiss Quick Actions without executing a result
- `@ux-original-007` passed — Insert a Quick Actions command into the composer
- `@ux-original-008` passed — Discover loaded skills in the command catalogue
- `@ux-original-009` passed — Save Markdown through the Plan sidebar
- `@ux-original-010` passed — Keep dirty Plan text when a remote update arrives
- `@ux-original-011` passed — Save a Plan before submitting it to the model
- `@ux-original-012` passed — Represent checklist progress in the Plan sidebar
- `@ux-original-013` passed — Open and dismiss the Classic session picker
- `@ux-original-014` failing-but-skipped:known-defect — Select another session through the picker
- `@ux-original-015` failing-but-skipped:known-defect — Use the session actions actually supplied by the client
- `@ux-original-016` passed — Display queued follow-ups during a busy turn
- `@ux-original-017` passed — Return a queued follow-up to the Classic editor
- `@ux-original-018` passed — Reorder and remove queued follow-ups with reconciliation
- `@ux-original-019` passed — Steer a queued item using the backend-authoritative action
- `@ux-original-030` failing-but-skipped:known-defect — A failed Steer warns and keeps the item queued
- `@ux-original-020` passed — Select a model for the selected chat
- `@ux-original-021` passed — Navigate the Classic picker lists
- `@ux-original-022` passed — Render model capabilities without inventing values
- `@ux-original-023` passed-this-run:known-defect(intermittent) — Refresh active-turn state after reconnect and request stop
- `@ux-original-024` passed — Copy and delete messages using their actual controls
- `@ux-original-025` passed — Retrieve explicit message IDs and bounded row windows
- `@ux-original-026` passed — Keep attachment upload state separate from message submission
- `@ux-original-027` passed-this-run:known-defect(intermittent) — Route tool execution through the Classic status and Output panes
- `@ux-original-028` passed — Copy code and transfer post speech ownership
- `@ux-original-029` passed — Render a safe fenced SVG as an isolated image and retain source
- `@ux-chat-lifecycle-001` passed — An idle chat does not manufacture an activity pane
- `@ux-chat-lifecycle-002` passed-this-run:known-defect(intermittent) — Streaming thoughts and response drafts have separate panes
- `@ux-chat-lifecycle-003` passed-this-run:known-defect(intermittent) — Tool output belongs to the Output status pane
- `@ux-chat-lifecycle-004` passed — A persisted assistant reply retains its identity and Markdown
- `@ux-chat-lifecycle-005` passed — A terminal provider error is not a user input or a tool success
- `@ux-chat-lifecycle-006` passed — A streaming draft keeps every chunk in order
- `@ux-chat-lifecycle-007` passed-this-run:known-defect(intermittent) — A running turn in one session does not leak into another
- `@ux-chat-lifecycle-008` passed-this-run:known-defect(intermittent) — A running tool shows what it is doing and for how long
- `@ux-compose-001` passed — Clear captured content while allowing a new draft
- `@ux-compose-002` passed — Restore a failed submission alongside newer text
- `@ux-compose-003` passed — Reject an entirely empty submission
- `@ux-compose-004` passed — Return a queued message replaces the current editor draft
- `@ux-compose-005` passed — Keep upload progress separate from sending state
- `@ux-compose-006` passed — Submit captures the destination chat
- `@ux-compose-012` passed — A failed send keeps its uploaded attachment for the retry
- `@ux-theme-001` passed — /theme with no arguments shows available themes
- `@ux-theme-002` passed — /theme ristretto applies dark theme visually
- `@ux-theme-003` passed — /theme default restores from ristretto visually
- `@ux-theme-004` passed — /theme dark returns error — not a valid theme name
- `@ux-theme-005` passed — /theme survives page refresh
- `@ux-theme-006` passed — /tint hex changes accent and background on default theme
- `@ux-theme-007` passed — /tint named color works on default theme
- `@ux-theme-008` passed — Switching tints visibly changes accent color
- `@ux-theme-009` passed — /tint off clears tint and restores vanilla default
- `@ux-theme-010` passed — /tint with no args shows usage
- `@ux-theme-011` passed — /tint invalid value returns error
- `@ux-theme-012` passed — /tint survives page refresh
- `@ux-theme-013` passed — Tint on default, switch to ristretto, switch back
- `@ux-theme-014` passed — /tint on ristretto switches to default+tint
- `@ux-theme-015` passed — Round-trip visual consistency
- `@ux-thoughts-001` passed — Render collapsed thought content with disclosure state
- `@ux-thoughts-002` passed — Continue updating content independently of disclosure
- `@ux-thoughts-003` passed — Toggle thought panel expansion
- `@ux-thoughts-004` passed — Collapse an expanded status panel with Escape
- `@ux-thoughts-005` passed — Preserve text when changing disclosure state
- `@ux-pwa-001` passed — Serve a manifest with declared application icons
- `@ux-pwa-002` passed — Use configured agent-avatar URLs for manifest icons
- `@ux-pwa-003` passed — Fall back to static icons without an avatar
- `@ux-pwa-004` passed — Request sized Apple touch icons
- `@ux-pwa-005` passed — Prefer PNG avatars for favicon compatibility
- `@ux-pwa-006` passed — Vary avatar icon cache URLs with the avatar version
- `@ux-timeline-017` passed — Delete a single message without visible replies
- `@ux-timeline-019` passed — A synthetic Replies exist rejection exposes the otherwise dormant retry prompt
- `@ux-timeline-020` passed — Deleting a message with visible replies asks for cascade confirmation
- `@ux-timeline-021` passed — Confirming cascade deletes the parent and visible replies together
- `@ux-timeline-022` passed — Cancelling cascade preserves the parent and visible replies
- `@ux-timeline-029` passed — Post times are shown in the viewer's time zone
