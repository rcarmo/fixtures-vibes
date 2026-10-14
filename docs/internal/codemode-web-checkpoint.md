# F3 web cards: paused checkpoint

Status: incomplete draft, not integrated or accepted. Work paused at Rui's request.

The draft is `ui/classic/src/gi-codemode-cards.ts`. No UI wiring, backend adoption, capability change or issue closure is included.

## Established transport boundary

The preceding live Gi probe observed nested tool envelopes on `/sse/topics?topic=runtime.tool&session_id=<id>`, not the legacy `/sse/stream`. The conversation view excludes tool-result rows. A renderer therefore needs an explicit persisted-result source as well as the topic subscription; changing the current conversation request blindly would alter pagination and generic message presentation.

## Resume here

1. Correct the draft against the actual envelope contract: session identity is on the envelope; lifecycle state is its `type` (`tool_started`, `tool_finished`, `tool_failed`, and stopped states), not `payload.phase`. Settled failure/unknown duration must not become running or successful by inference.
2. Read full-output references from `details.fullOutputPath`, validate measured durations, fence reused parent occurrences and session/turn identity, and keep first terminal results immutable. Use the authenticated output contract, never an arbitrary filesystem URL.
3. Wire bounded literal-text cards through an upstream overlay or checked build adapter without editing vendored Piclaw bytes. Preserve conversation paging, reconnect and chat-switch guards.
4. Add projection, stream lifecycle and mounted rendering tests. Verify real Gi live/reload, error/interruption, missing details, two sessions, narrow layouts and the applicable browser/device matrix. Then independently verify the final Gi pin.

## Verification and remaining gates

Only a standalone draft import/parser smoke check is intended for this checkpoint. It is not F3 acceptance; no broad-suite or performance result is claimed. F1 broader editor/unit gates remain open. Earlier profiled F1 repeats recorded 3/4 rather than the claimed 4/4; reconcile the published claim before declaring that gate passed. C1/R2 implementation remains approval-gated.

The protected Gi `third_party/joker/AGENTS.md` edit is untouched. No integration into main or deployment is authorised by this checkpoint push.
