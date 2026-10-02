# Compliance: piclaw 3.2.5

| Scenarios | Passed | Failed | Skipped | Listed failing | No suite test yet |
|---:|---:|---:|---:|---:|---:|
| 299 | 40 | 0 | 0 | 3 | 256 |

Results: `test-results/compliance.json` (run started 2026-10-02T15:42:23.214Z)
Skips: `profiles/piclaw-3.2.5-skips.json` (3 listed)

Gate: OK

## Covered scenarios

- `@ux-shared-009` passed — Open Plan and edit the stored Markdown
- `@ux-shared-010` passed — Preserve dirty Plan text on a remote update
- `@ux-shared-011` passed — Submit Plan to the captured session
- `@ux-shared-012` passed — Expose canonical Plan Markdown and the Plan tool to the model
- `@ux-shared-028` passed — Model-generated SVG cannot run code or fetch resources
- `@ux-shared-031` failing-but-skipped:known-defect — Render safe model-generated SVG as an isolated image
- `@ux-original-007` passed — Insert a Quick Actions command into the composer
- `@ux-original-008` passed — Discover loaded skills in the command catalogue
- `@ux-original-009` passed — Save Markdown through the Plan sidebar
- `@ux-original-010` passed — Keep dirty Plan text when a remote update arrives
- `@ux-original-011` passed — Save a Plan before submitting it to the model
- `@ux-original-012` passed — Represent checklist progress in the Plan sidebar
- `@ux-original-016` passed — Display queued follow-ups during a busy turn
- `@ux-original-019` passed — Steer a queued item using the backend-authoritative action
- `@ux-original-030` failing-but-skipped:known-defect — A failed Steer warns and keeps the item queued
- `@ux-original-029` passed — Render a safe fenced SVG as an isolated image and retain source
- `@ux-chat-lifecycle-001` passed — An idle chat does not manufacture an activity pane
- `@ux-chat-lifecycle-002` failing-but-skipped:known-defect — Streaming thoughts and response drafts have separate panes
- `@ux-chat-lifecycle-003` passed — Tool output belongs to the Output status pane
- `@ux-chat-lifecycle-004` passed — A persisted assistant reply retains its identity and Markdown
- `@ux-chat-lifecycle-005` passed — A terminal provider error is not a user input or a tool success
- `@ux-compose-001` passed — Clear captured content while allowing a new draft
- `@ux-compose-002` passed — Restore a failed submission alongside newer text
- `@ux-compose-003` passed — Reject an entirely empty submission
- `@ux-compose-004` passed — Return a queued message replaces the current editor draft
- `@ux-compose-005` passed — Keep upload progress separate from sending state
- `@ux-compose-006` passed — Submit captures the destination chat
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
