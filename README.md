# fixtures-vibes

Shared references and the compliance suite for the **Classic** web UI implemented by Gi, Vibes (Python and Go) and tau-prime.
The installed Piclaw release is the behavioural oracle; the current reference is **Piclaw 3.2.5**.

This repository holds behaviour, not product code:

| Path | Contents |
|---|---|
| `features/` | Runtime-independent Classic Gherkin with stable scenario IDs (`@ux-<area>-NNN`). |
| `capabilities.json` | `@cap-*` vocabulary. A scenario tagged `@cap-X` needs capability X. |
| `schemas/` | JSON Schemas for runtime profiles, skips files and evidence manifests. |
| `control/fixture-model-server.ts` | Deterministic OpenAI-compatible model with a control API, used by every runtime under test. |
| `suite/` | Shared Bun + Playwright compliance suite, run black-box against each runtime. |
| `profiles/` | Reference profile for Piclaw. Runtime profiles live in each runtime repository. |
| `oracle/piclaw/` | Recorded Piclaw evidence per version; older versions are kept as dated, read-only history. |
| `provenance/` | Frozen upstream snapshots with checksums. |
| `MANIFEST.json` | SHA-256 of every consumed file, plus the oracle version and asset hashes (provenance only). |

## Consuming

Add the repository as a submodule pinned to a tag:

```sh
git submodule add https://github.com/rcarmo/fixtures-vibes.git references/fixtures-vibes
git -C references/fixtures-vibes checkout v0.1.0
```

Then provide a runtime profile (`schemas/runtime-profile.schema.json`) and a skips file (`schemas/skips.schema.json`) in your
repository, and run the suite against it. Do not edit submodule files; change this repository first and bump the pin.

## Test lifecycle

For each isolation group the suite:

1. creates a fresh temp root and runs the profile's `prepare` (fresh store/workspace, provider pointed at the fixture model),
2. starts the fixture model and the runtime, and waits for the readiness probe,
3. creates or opens a session through the runtime's public interface,
4. runs scenarios, driving turns with fixture-model directives,
5. stops the runtime, then resets the fixture model.

Never reset the fixture model under a live runtime: held requests fail and runtimes may retry them.

## Fixture model directives

Directives in the latest user message are executed in order:

| Directive | Effect |
|---|---|
| `[think:TEXT]` | Stream reasoning deltas. |
| `[gate:NAME]` | Pause until `POST /control/gates/NAME/open`. |
| `[say:TEXT]` | Stream one visible content chunk. |
| `[reply:TEXT]` / `[chunks:N]` | Whole visible reply, optionally split into N chunks. |
| `[usage:P]` | Report `prompt_tokens = P`. |
| `[tool:NAME JSON]` / `[after-tool:TEXT]` | Emit one tool call, then reply to the tool result. |
| `[fail:STATUS]` | Fail the request with HTTP STATUS. |

Without directives the reply is `Fixture reply: <last line of the prompt>`.
