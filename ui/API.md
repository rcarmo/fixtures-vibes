# Classic web UI backend contract

The shared Classic web UI is the `ui/classic` tree: Piclaw 3.2.5's own web components, its Plan sidebar add-on, and an
adapter layer (`src/api.ts`, `src/gi-*.ts`). A runtime adopts the UI by serving its static tree and
implementing the HTTP and SSE surface below. The UI is not edited per runtime.

- **Reference implementation:** rcarmo/gi `internal/web` at **5a68f40** (handler names below), with the Gi docs cited at
  the same revision. Request and response shapes are those of the reference handlers; where a doc disagrees, the
  handler wins. Terminal and VNC follow Piclaw **v3.2.5** (rcarmo/piclaw, `runtime/src/channels/web/{terminal,vnc}/`)
  until Gi implements them. This file names the revision it was checked against; update it when the UI changes.
- **Acceptance:** the fixtures-vibes compliance suite against the runtime's profile. This file lists the surface;
  the Gherkin features and specs define the behaviour.
- **Sessions:** the UI addresses a session as `chat_jid = gi:<session-id>` for every runtime (`gi:` is the UI's
  literal prefix, not a runtime name); HTTP routes take the bare `<session-id>`. The SSE stream takes `chat_jid`.
- **Errors:** non-2xx responses carry JSON `{error, code?}`; the UI shows `error`.

## Static assets

Serve `ui/classic/static` at `/` (Gi embeds it as `giui.Static`): `index.html` for `/` and unknown app
routes, plus `/dist/`, `/css/`, `/fonts/`, `/js/`, `/editor-vendor/`, icons. Also `/manifest.json`,
`/avatar/agent`, and `/static/icon-192.png`, `/static/icon-512.png`, `/static/js/vendor/*` (panes load vendor
scripts under `/static/`). `ui/classic/theme-catalogue.json` backs the `/theme` command.

## Event stream

| Stream | Notes |
|---|---|
| `GET /sse/stream?chat_jid=gi:<s>` | Per-session stream (`handleSSEStream`, `internal/web/sse.go`). `text/event-stream`, `event:` name + JSON `data:`. |
| `GET /api/sessions/{s}/route-events` | Route/peer events for the session picker (`handleSessionRouteEvents`). |

Event names the UI handles (Piclaw vocabulary): `connected` (carries `app_asset_version`), `new_post`,
`agent_response`, `agent_status`, `agent_draft`, `agent_draft_delta`, `agent_thought`, `agent_thought_delta`,
`agent_followup_queued`, `agent_followup_consumed`, `agent_followup_removed`, `agent_steer_queued`,
`queue_changed`, `compaction_*`, `tool_activity_changed`, `interaction_updated`, `interaction_deleted`,
`model_changed`, `workspace_update`, `ui_theme`, `ui_meters`, `extension_ui_*` (Plan uses
`extension_ui_status` with `key: plan.changes`). Assistant posts may carry `content_blocks` (including
`generated_widget`).

## Sessions, timeline and turns

| Method | Path | UI caller | Reference |
|---|---|---|---|
| GET, POST | `/api/sessions` | `getAgents`, `getChatBranches`, `ensureDefaultSession` | `handleSessions` |
| GET, PATCH | `/api/sessions/{s}` | `ensureDefaultSession`, `mutateChatSession` (rename, pin, archive) | `handleSessionSubroutes` |
| POST | `/api/sessions/{s}/fork` | `forkChatBranch` | " |
| GET | `/api/sessions/{s}/messages?view=conversation&limit&before&after` | `getTimeline` | " (`docs/internal/message-retrieval.md`) |
| DELETE | `/api/sessions/{s}/messages/{id}` | `deletePost` | " (`message-deletion.md`) |
| GET | `/api/sessions/{s}/search?q&scope&limit&offset&view` | `searchPosts` | " |
| POST | `/api/sessions/{s}/prompt` `{prompt, intent: prompt\|steer\|queue, client_request_id, media[], parent_turn_id?, target_agent_id?}` | `sendAgentMessage`, `createPost` | " |
| GET | `/api/sessions/{s}/send-receipt` | `recoverSubmittedPrompt` | " (ADR 0011) |
| GET, POST | `/api/sessions/{s}/activity` (POST `{turn_id}` cancels) | `getAgentStatus`, `cancelSessionRun` | " |
| GET, PATCH | `/api/sessions/{s}/queue` (PATCH reorders) | `getAgentQueueState`, `reorderAgentQueueItem` | " (`queue-reorder-2026-09-28.md`) |
| DELETE | `/api/sessions/{s}/queue/{id}` | `removeAgentQueueItem` | " |
| POST | `/api/sessions/{s}/queue/{id}/steer` | `steerAgentQueueItem` | " (ADR 0018) |
| GET, POST | `/api/sessions/{s}/compaction` | `getSessionCompaction`, `compactSession` | " (ADR 0022) |
| POST | `/api/sessions/{s}/peer-message` | `sendPeerAgentMessage` | " |
| GET, POST (multipart upload) | `/api/sessions/{s}/media`; GET `/api/sessions/{s}/media/{id}` | `uploadMedia`, `recoverQueueDraft` | " (`media-ingestion-contract.md`) |
| GET | `/api/media/{id}`, `/api/media/{id}/raw`; `/media/{id}` (post bodies) | `getMediaInfo`, `getMediaUrl`, `Post` | `handleMediaLookup` |

## Models and settings

| Method | Path | UI caller | Reference |
|---|---|---|---|
| GET, PATCH | `/api/sessions/{s}/model` | `getAgentModels`, `selectAgentModel`, `selectAgentThinking` | `handleSessionSubroutes` (`model-panel.md`, `session-thinking.md`) |
| GET | `/api/runtime/config` | `getRuntimeConfig`, `getAgents`, `getAgentModels` | `handleRuntimeConfig` |
| GET | `/api/quick-actions` | `getQuickActionsSettings`, `getAgentCommands` | `handleQuickActions` |
| GET | `/api/system-metrics` | `getSystemMetrics` | `handleSystemMetrics` |
| GET, PATCH | `/api/settings/identity` | `getGiIdentity`, `saveGiIdentity` | `handleSettingsIdentity` |
| GET, PATCH | `/api/settings/compaction` | `getGiCompactionPolicy`, `saveGiCompactionPolicy` | `handleCompactionPolicy` |
| GET, PATCH, DELETE | `/api/settings/providers` | `getGiProviders`, `saveGiProviderKey`, `removeGiProviderKey` | `handleProviderSettings` |
| GET, POST | `/api/settings/general` | `getGeneralSettings`, `saveGeneralSettings` | `handleGeneralSettings` |

## Keychain and environment

| Method | Path | UI caller | Reference |
|---|---|---|---|
| GET, POST, DELETE | `/api/settings/keychain` | `listKeychain`, `saveKeychainEntry`, `deleteKeychainEntry` | `handleKeychain` (`keychain.md`) |
| POST | `/api/settings/keychain/reveal` `{name, master_password?}` (401 `needs_master_password`) | `revealKeychainEntry` | `handleKeychainReveal` |
| GET, POST | `/api/settings/environment` `{name, value}` | `getEnvironmentSettings`, `setEnvironmentOverride`, `clearEnvironmentOverride` | `handleEnvironment` (`shell-environment.md`) |

## Workspace

| Method | Path | UI caller | Reference |
|---|---|---|---|
| GET | `/api/workspace/tree` | `getWorkspaceTree` | `handleWorkspaceTree` |
| GET, POST, PUT, DELETE | `/api/workspace/file` | `getWorkspaceFile`, `createWorkspaceFile`, `updateWorkspaceFile`, `deleteWorkspaceFile`, download URLs | `handleWorkspaceFile` |
| GET | `/api/workspace/raw` | `getWorkspaceRawUrl` | `handleWorkspaceRaw` |
| GET | `/api/workspace/stat` | `getWorkspaceFileStat` | `handleWorkspaceStat` |
| POST | `/api/workspace/upload`, `/api/workspace/rename`, `/api/workspace/move` | `uploadWorkspaceFile`, `renameWorkspaceFile`, `moveWorkspaceEntry` | `handleWorkspaceUpload`, `…Rename`, `…Move` |
| GET, POST | `/api/workspace/index` | `getWorkspaceIndexStatus`, `reindexWorkspace` | `handleWorkspaceIndex` |
| GET, PUT | `/workspace/file`, GET `/workspace/raw` | kanban, mindmap, image, office panes; standalone tabs (Piclaw routes) | not yet in reference |

## Plan and widgets

| Method | Path | UI caller | Reference |
|---|---|---|---|
| GET, POST | `/api/sessions/{s}/plan` (`{markdown}` or `{action: reset}`) | `gi-plan-sidebar.ts` (vendored Piclaw add-on) | `handleSessionSubroutes` (`session-plan.md`) |
| GET | `/api/sessions/{s}/widgets/{id}` | artifact lookup | " (`dashboard-widgets.md`) |

Widgets render in an iframe sandboxed with `allow-scripts` but not `allow-same-origin`, so widget code has an opaque
origin and reaches the host only through the `piclawWidget` bridge (`postMessage`; the host accepts messages only from
that iframe). Bridge `submit` posts to `/api/sessions/{s}/prompt` for the opening session; `close` is local;
`requestRefresh` rebuilds the dashboard snapshot from the session routes above. Static files that widgets import as ES
modules must be served with `Access-Control-Allow-Origin: *`.

## Terminal and VNC (Piclaw v3.2.5 routes; Gi implementation pending, gi#45, gi#47)

Session, handoff and WebSocket frame shapes are those of Piclaw v3.2.5 `terminal-session-service.ts` and
`vnc-session-service.ts`, as consumed by the UI's `panes/terminal-pane.ts` and `panes/vnc-pane.ts`.

| Method | Path | UI caller |
|---|---|---|
| GET | `/terminal/session` | `fetchTerminalSession` |
| WebSocket | `/terminal/ws` | terminal pane |
| POST | `/terminal/handoff` | `requestTerminalHandoff` |
| GET | `/vnc/session` | `fetchVncSession` |
| WebSocket | `/vnc/ws` | VNC pane (remote-display decoder) |
| POST | `/vnc/handoff` | VNC pop-out |

## Authentication (when the runtime offers auth)

`/api/auth/status`, `/api/auth/policy`, `/api/auth/session` (POST login), `/api/auth/session/logout`,
`/api/auth/session/proof`, `/api/auth/session/reauth/totp`, `/api/auth/setup/*`, `/api/auth/passkeys`,
`/api/auth/passkeys/{op}/start|finish`, and the login page's `/auth/verify`, `/auth/webauthn/login/start|finish`
(`gi-auth.ts`, `gi-passkeys.ts`, `gi-settings-authentication.ts`, `gi-settings-setup.ts`, `login.ts`; reference
`internal/web/auth*.go`, `passkeys.md`). The app does not mount until `GET /api/auth/status` answers, so a runtime
without auth must still serve it. `parseAuthPolicy` (`gi-auth-policy.ts`) requires `mode: "single-user"` and boolean
`enrolled`, `authenticated`, `totp_enabled`, `browser_login_available`; an auth-free runtime answers:

```json
{"mode":"single-user","enrolled":false,"authenticated":true,"totp_enabled":false,"browser_login_available":false,
 "setup_available":false,"totp_login_available":false,"passkeys_enabled":false,"passkey_login_available":false}
```

## Other calls

`/agent/push/presence` (POST, web push presence), `/agent/session-tree` (session tree widget) and
`/agent/commands` (compose box) are Piclaw routes still referenced by vendored components; a runtime may answer
404 and the UI degrades.
