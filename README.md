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

```sh
make -C references/fixtures-vibes deps          # Bun deps + Chromium/WebKit (needs bun and node)
make -C references/fixtures-vibes compliance PROFILE=$PWD/tests/fixtures-vibes/profile.json
```

`compliance` runs the Playwright suite (Chromium and WebKit × phone, tablet, desktop; zero retries), then the report gate.
Outputs go to `references/fixtures-vibes/test-results/` (git-ignored, so the submodule stays clean):

- `compliance-report-<runtime>.{md,json}`: status per scenario ID,
- `evidence-<runtime>.json`: ID → passing test titles, per project.

The gate fails when a covered scenario fails, when a test is skipped for a capability the skips file does not list, when a
skip is stale (the scenario passes), names an unknown ID or is duplicated, when a `capability-absent` skip names a claimed
capability, and when the profile or skips file does not match its schema. Scenarios without a shared test yet are reported
as `no-suite-test` and do not fail the gate. A listed skip does not stop the test from running: a listed scenario that fails
is reported as `failing-but-skipped`, and one that passes makes the skip stale.

### Runtime profile

Use `lifecycle` when the suite should start the runtime, or `external` for an instance you manage yourself.
Lifecycle commands run under `/bin/sh` with `FIXTURES_ROOT` (fresh temp dir), `FIXTURES_PORT`, `FIXTURE_MODEL_URL`
(OpenAI-compatible base URL ending in `/v1`) and `FIXTURE_MODEL_ID` (`fixture-1`). `start` must stay in the foreground.
`FIXTURE_MODEL_NAMED_URL` is the same server as `http://fixture-model.localhost:PORT/v1`: Piclaw-family runtimes switch to a
reduced "local-lite" prompt and tool set for loopback/private model URLs, so use the named URL when tool scenarios must see
the full tool set (`*.localhost` must resolve to loopback; add a hosts entry where it does not).

```json
{
  "runtime": "vibes-python",
  "version": "9a34046",
  "lifecycle": {
    "prepare": "mkdir -p \"$FIXTURES_ROOT/pi\" && printf '{\"providers\":{\"fixture\":{\"baseUrl\":\"%s\",\"api\":\"openai-completions\",\"apiKey\":\"fixture-local-only\",\"models\":[{\"id\":\"fixture-1\"}]}}}' \"$FIXTURE_MODEL_URL\" > \"$FIXTURES_ROOT/pi/models.json\"",
    "start": "PI_CODING_AGENT_DIR=\"$FIXTURES_ROOT/pi\" VIBES_PORT=$FIXTURES_PORT VIBES_PI_MODEL=fixture/fixture-1 exec ./serve"
  },
  "readiness": { "path": "/health", "status": 200 },
  "session": { "open": "/" },
  "capabilities": ["@cap-queue", "@cap-stop"],
  "skips": "skips.json"
}
```

`tools` maps canonical tool names used by specs to the runtime's names. Today only `shell` exists: it must run a POSIX
shell command given `{"command": "..."}` (default `bash`). Mapping a name adapts naming only; the tool must still run.

`approval` is opt-in for runtimes that always ask before running a tool and cannot be pre-approved by configuration:
`"approval": {"button": "^Allow "}` makes the suite click the matching control whenever it appears. Prefer configuring
approval in `prepare` when the runtime allows it.

`session.create` is optional. Without it, tests share the runtime's default session; specs use unique markers so that is safe.
Claim a capability when the runtime exposes that user-visible surface, even if some tagged scenarios still fail. Every such
scenario then needs its own skips entry (`not-implemented`, `known-defect` or `intentional-divergence`); do not drop a claim
to hide failures. Skips stay authoritative per scenario ID. Specs never list capabilities themselves: a test is skipped
automatically when the profile lacks a `@cap-*` tag of its scenario.

### Skips file

```json
{
  "runtime": "vibes-python",
  "fixturesVibes": "v0.1.0-rc.10",
  "skips": [
    { "id": "@ux-original-016", "reason": "capability-absent", "capability": "@cap-queue", "detail": "No follow-up queue yet." }
  ]
}
```

Reasons: `capability-absent` (needs `capability`), `intentional-divergence` (needs `approvedBy`), `not-implemented` and
`known-defect` (need `issue`), `environment-limit`.

Optional `projects` limits a skip to some Playwright projects (for example `["webkit-desktop"]`); failures in other
projects still fail the gate. `intermittent: true` (known defects only) stops a run in which the scenario happens to
pass from being reported as a stale skip; give the observed failure rate in `detail`.

## Status

Scenarios tagged `@reconcile-3.2.5` are still being checked against the installed Piclaw 3.2.5 and may change wording.
Shared IDs were minted per scenario; `features/canonical/shared-id-map.json` maps the old positional IDs.

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
| `[after-tool-fail:STATUS]` | Fail only the follow-up request that carries the tool result. |

Control API: `GET /control/health`, `GET /control/gates`, `POST /control/gates/NAME/open`, `GET /control/log`
(requests, offered tools, tool results), `POST /control/fail?status=S&count=N` (simulated provider outage for the next N
requests) and `POST /control/reset`.

Inside directive values, `\n` is a newline (except in `tool`) and `\[` / `\]` are literal brackets, so tool arguments can
carry Markdown checklists such as `- \[ \] item`.

Without directives the reply is `Fixture reply: <last line of the prompt>`.
