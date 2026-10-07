# fixtures-vibes

This repository contains shared references and the compliance suite for the "Classic" web UI I designed for `vibes` and then adopted for `piclaw`, `gi`, various `vibes` experiments (Python and Go) and `tau-prime`. Since they were all reinventing a few wheels, I decided to centralize the core behaviors and assets for non-`piclaw` projects here.

This is managed by a `piclaw` instance, which acts as oracle and orchestrates the capture of UX behavior into fixtures:

- The agent inspects itself or another running copy of `piclaw`
- It captures live test fixtures and behaviors as HTML/JS/Gherkin files
- It then validates and tags feature files accordingly and asks the sub-agents in charge of each project to adopt the feature files
- They then implement their own backend-specific tests in whatever language they run

Any local deviations are either specific to the runtime or tool (`gi` and `tau-prime` both have TUIs, which are out of scope here) or corrected to align with the web UX.

# Agent Guidance

The installed Piclaw release is the behavioural oracle; the current reference is **Piclaw 3.2.5**.
The shared `ui/classic` sources are pinned to **Piclaw v3.3.0** (`e4c2b9a3536e…`); updating the dedicated reference
and its recorded evidence is a separate step. Existing `oracle/piclaw/3.2.5/` records stay unchanged.

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
git -C references/fixtures-vibes checkout v0.2.0
```

Then provide a runtime profile (`schemas/runtime-profile.schema.json`) and a skips file (`schemas/skips.schema.json`) in your
repository, and run the suite against it. Do not edit submodule files; change this repository first and bump the pin.

```sh
make -C references/fixtures-vibes deps          # Bun deps + Chromium/WebKit (needs bun and node)
make -C references/fixtures-vibes compliance PROFILE=$PWD/tests/fixtures-vibes/profile.json PROJECT_NAME=<runtime>
```

The run's scratch (`runs/suite/<run-id>/`, with `TMPDIR` inside it) and tool caches (`cache/<tool>/`) go under the
runtime's temporary root: `<PROJECT_TMP_BASE>/<runtime>` if a base is given; in CI `$RUNNER_TEMP`, the original
`TMPDIR` or the system temp directory; locally `/workspace/tmp` or the system temp directory, each + `/<runtime>`.
See `mk/project-tmp.mjs`.

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

`selectors` overrides canonical CSS selectors, only where markup cannot match them. Specs prefer accessible roles and
names; the canonical selectors are `appShell`, `composeInput`, `sendButton`, `stopButton`, `queueItem`, `timeline`,
`timelinePost`, `agentPost`, `userPost` and `quickActionHighlight` (see `suite/runtime.ts`).

`commands` holds composer text the suite types to seed settings that have no shared API. Today:
`setAgentAvatar` (with `{source}`, a PNG data URL) and `clearAgentAvatar`, both required for `@cap-agent-avatar`.

The fixture model advertises `fixture-1` and `fixture-2`. A profile that claims `@cap-model-picker` must register both
(the second may be named "Fixture Model Two") so selection can be tested without any real provider.

`keychain.masterPassword` is the password that unlocks secret reveal in the Keychain settings section (test instances
only). The keychain scenarios (`features/classic/keychain/`) carry no `@cap-*` tag apart from the settings dialog: every
runtime must keep a Piclaw-like keychain, manage it in Settings (the section may be simpler and look different; the specs
find controls by role and loose names and check behaviour only) and apply the same shell substitution rules (`$NAME` /
`${NAME}` injection from entry names, `keychain:<name>[:field]` placeholders). Failures there are defects, not skips.
`features/classic/shell-environment/` pins the shell tool to Piclaw 3.2.5 exactly: shell detection (`$SHELL`, then bash;
on Windows PowerShell before cmd, under `@cap-windows-shell`), textual detection of `$NAME`, `${NAME}`, `$env:NAME` and
`%NAME%` references with retrieval of only the referenced keychain entries, Piclaw's variable naming (identifiers kept,
collisions resolved by name order), placeholder failures, and the Settings Environment section (overrides applied to
later commands, persisted, keychain variables excluded). Those scenarios are mandatory too.
Core suite (Rui, 2026-10-04): keychain, shell environment, concurrent sessions, terminal, the CodeMirror editor
(including Vim mode and Markdown preview), VNC, the Plan sidebar and widgets are required of every runtime and carry no
capability tag. A runtime that lacks one lists each failing scenario as `not-implemented` (tracked gap) or
`known-defect`, both with an issue; `capability-absent` is only for scenarios that carry the capability (the gate
rejects it otherwise). Windows shell support is core but build-only: `@cap-windows-shell` scenarios are claimed only
by a runtime tested on a Windows host, so Linux runtimes and the reference list them as `capability-absent`.
Removed from the suite: Adaptive Cards, text highlights, image annotation.

`@ux-chat-lifecycle-009` mandates concurrent sessions: turns in different sessions are at the model at the same time and
complete independently, as in Piclaw. A runtime-wide single-active-session guard fails it; it is a defect, not a skip.

`session.create` is optional. Without it, tests share the runtime's default session; specs use unique markers so that is safe.
Claim a capability when the runtime exposes that user-visible surface, even if some tagged scenarios still fail. Every such
scenario then needs its own skips entry (`not-implemented`, `known-defect` or `intentional-divergence`); do not drop a claim
to hide failures. Skips stay authoritative per scenario ID. Specs never list capabilities themselves: a test is skipped
automatically when the profile lacks a `@cap-*` tag of its scenario.

### Skips file

```json
{
  "runtime": "vibes-python",
  "fixturesVibes": "v0.2.0",
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

Only the 26 passkey `@proposal` scenarios still carry `@reconcile-3.2.5`. Shared IDs were minted per scenario;
`features/canonical/shared-id-map.json` maps the old positional IDs. Many scenarios have no spec yet; the report lists
them as "no suite test yet", which does not fail the gate.

## Test lifecycle

For lifecycle profiles, `make compliance PROFILE=…`:

1. deletes previous results and reports, so a report can never describe an older run;
2. starts one fixture model for the run (global setup);
3. per Playwright worker, creates a fresh temp root, runs `prepare`, starts the runtime and waits for readiness. A failed
   test replaces the worker, so the next test gets a fresh runtime;
4. after every test, releases held turns and ends any simulated outage;
5. stops the runtime, then the fixture model, and removes their temp roots (`FIXTURES_KEEP_ROOTS=1` keeps them for
   debugging; a runtime that never becomes ready reports the tail of its `runtime.log`).

Never reset the fixture model under a live runtime: held requests fail and runtimes may retry them.

Rate limits are not under test. A profile may declare `"rateLimit": {"path": "<regex>", "perMinute": N}` to pace
matching browser writes over a sliding minute. Writes answered with HTTP 429 are still retried with backoff
(2/4/8/8/8 s, or `Retry-After`).
Specs that need slow or failing requests use `suite/net.ts`, which matches requests by what the page sends, never by
runtime route names.

`make oracle PROFILE=…` records the last run as immutable evidence under `oracle/<runtime>/<version>/` when its gate is
OK. Only the Piclaw reference is recorded there.

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

## Web front-ends

`ui/` holds the web front-end of every runtime (see [ui/README.md](ui/README.md)); runtimes consume it through this
submodule. `ui/classic` is the shared Classic UI and [ui/API.md](ui/API.md) is the backend contract a runtime implements to
adopt it.
